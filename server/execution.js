import { spawn as nodeSpawn } from "node:child_process";
import { EXECUTION_CONFIG } from "./config.js";

// ---------------------------------------------------------------------------
// Test injection — matches _setExecFile / _resetExecFile from provisioning.js
// ---------------------------------------------------------------------------

let spawnFn = nodeSpawn;

/**
 * Replace the internal spawn implementation. Used by tests.
 * @param {Function} fn — replacement for child_process.spawn
 */
export function _setSpawn(fn) {
  spawnFn = fn;
}

/** Reset to the real spawn. Used by test teardown. */
export function _resetSpawn() {
  spawnFn = nodeSpawn;
}

// ---------------------------------------------------------------------------
// Ring buffer — fixed-size circular line buffer
// ---------------------------------------------------------------------------

/**
 * Create a ring buffer that retains up to `capacity` lines.
 * @param {number} capacity — max number of lines
 * @returns {{ push: (line: string) => void, getAll: () => string[], length: number }}
 */
export function createRingBuffer(capacity) {
  const buffer = [];
  let head = 0;
  let count = 0;

  return {
    push(line) {
      if (count < capacity) {
        buffer.push(line);
        count++;
      } else {
        buffer[head] = line;
        head = (head + 1) % capacity;
      }
    },
    getAll() {
      if (count < capacity) return buffer.slice();
      // When full, head points to the oldest entry
      return [...buffer.slice(head), ...buffer.slice(0, head)];
    },
    get length() {
      return count;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory execution state
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} projectId → build execution record */
const executionState = new Map();

/** @type {Map<string, object>} agentId → reference to agent record within a build */
const agentIndex = new Map();

// ---------------------------------------------------------------------------
// Common telemetry shape
// ---------------------------------------------------------------------------

/**
 * Create a default (empty) telemetry record.
 * `raw: true` means no structured telemetry was parsed; basic lifecycle only.
 * @returns {object}
 */
export function createDefaultTelemetry() {
  return {
    tokens: { input: 0, output: 0 },
    costUsd: 0,
    progress: null,
    lastOutputSummary: null,
    raw: true,
  };
}

// ---------------------------------------------------------------------------
// Agent telemetry parsers
// ---------------------------------------------------------------------------

/**
 * Parse a single stdout line from Claude Code `--output-format stream-json`.
 *
 * Stream-json emits newline-delimited JSON objects with a `type` field:
 * - `{ type: "system", subtype: "init", ... }` — session start
 * - `{ type: "assistant", message: { content: [...], usage: { input_tokens, output_tokens } }, ... }` — assistant turn
 * - `{ type: "result", subtype: "success"|"error", cost_usd, usage: { input_tokens, output_tokens }, ... }` — final result
 *
 * Returns a telemetry delta object or null if the line isn't parseable.
 * @param {string} line — raw stdout line
 * @returns {{ tokens?: { input: number, output: number }, costUsd?: number, progress?: string, lastOutputSummary?: string } | null}
 */
export function parseClaudeCodeLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || !parsed.type) return null;

  const delta = {};

  // Extract usage / tokens from message or top-level usage
  const usage = parsed.usage || parsed.message?.usage;
  if (usage) {
    delta.tokens = {
      input: typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
      output: typeof usage.output_tokens === "number" ? usage.output_tokens : 0,
    };
  }

  // Extract cost
  if (typeof parsed.cost_usd === "number") {
    delta.costUsd = parsed.cost_usd;
  } else if (typeof parsed.total_cost_usd === "number") {
    delta.costUsd = parsed.total_cost_usd;
  }

  // Progress from type/subtype
  if (parsed.type === "system" && parsed.subtype === "init") {
    delta.progress = "initializing";
  } else if (parsed.type === "assistant") {
    delta.progress = "working";
    // Extract content summary from assistant text
    const content = parsed.message?.content || parsed.content;
    if (typeof content === "string" && content.length > 0) {
      delta.lastOutputSummary = content.slice(0, 200);
    } else if (Array.isArray(content)) {
      const textBlock = content.find((b) => b.type === "text" && b.text);
      if (textBlock) {
        delta.lastOutputSummary = textBlock.text.slice(0, 200);
      }
    }
  } else if (parsed.type === "result") {
    delta.progress = parsed.subtype === "success" ? "completed" : "error";
  }

  return Object.keys(delta).length > 0 ? delta : null;
}

/**
 * Parse a single stdout line from Codex CLI `--json`.
 *
 * Codex emits newline-delimited JSON events with a `type` field:
 * - `{ type: "message", content: "...", ... }` — tool or assistant output
 * - `{ type: "status", status: "running"|"completed"|"error", ... }` — status events
 * - `{ type: "result", usage: { total_tokens, prompt_tokens, completion_tokens }, cost_usd, ... }` — final result
 *
 * Returns a telemetry delta object or null if the line isn't parseable.
 * @param {string} line — raw stdout line
 * @returns {{ tokens?: { input: number, output: number }, costUsd?: number, progress?: string, lastOutputSummary?: string } | null}
 */
export function parseCodexLine(line) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || !parsed.type) return null;

  const delta = {};

  // Extract usage / tokens
  const usage = parsed.usage;
  if (usage) {
    delta.tokens = {
      input: typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : typeof usage.input_tokens === "number"
          ? usage.input_tokens
          : 0,
      output: typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : typeof usage.output_tokens === "number"
          ? usage.output_tokens
          : 0,
    };
  }

  // Extract cost
  if (typeof parsed.cost_usd === "number") {
    delta.costUsd = parsed.cost_usd;
  }

  // Progress from type
  if (parsed.type === "status") {
    delta.progress = parsed.status || "unknown";
  } else if (parsed.type === "result") {
    delta.progress = parsed.error ? "error" : "completed";
  } else if (parsed.type === "message") {
    delta.progress = "working";
    if (typeof parsed.content === "string" && parsed.content.length > 0) {
      delta.lastOutputSummary = parsed.content.slice(0, 200);
    }
  }

  return Object.keys(delta).length > 0 ? delta : null;
}

/**
 * Apply a telemetry delta to the cumulative telemetry record.
 * Token and cost values use latest-wins (each message reports cumulative totals).
 * @param {object} telemetry — the current telemetry record
 * @param {object} delta — parsed delta from a parser
 */
export function applyTelemetryDelta(telemetry, delta) {
  if (delta.tokens) {
    // Use latest values — Claude Code reports cumulative tokens per message
    if (delta.tokens.input > 0) telemetry.tokens.input = delta.tokens.input;
    if (delta.tokens.output > 0) telemetry.tokens.output = delta.tokens.output;
    telemetry.raw = false;
  }
  if (typeof delta.costUsd === "number") {
    telemetry.costUsd = delta.costUsd;
    telemetry.raw = false;
  }
  if (delta.progress) {
    telemetry.progress = delta.progress;
    telemetry.raw = false;
  }
  if (delta.lastOutputSummary) {
    telemetry.lastOutputSummary = delta.lastOutputSummary;
    telemetry.raw = false;
  }
}

/**
 * Select the appropriate telemetry parser for an agent type.
 * Returns null for unknown agent types (falls back to raw lifecycle).
 * @param {string} agentType — "claude" or "codex"
 * @returns {Function|null}
 */
export function getParserForAgent(agentType) {
  switch (agentType) {
    case "claude":
      return parseClaudeCodeLine;
    case "codex":
      return parseCodexLine;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// State management helpers
// ---------------------------------------------------------------------------

function generateAgentId(projectId) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `agent-${projectId}-${ts}-${rand}`;
}

function createBuildRecord(projectId) {
  return {
    projectId,
    status: "idle",
    agents: [],
    startedAt: null,
    completedAt: null,
    error: null,
    escalation: null,
    // Store per-build config + callback so retry/escalation flows can re-use them
    _config: null,
    _onAgentEvent: null,
  };
}

function createAgentRecord(agentId, agentType, pid) {
  return {
    agentId,
    agentType,
    pid,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    exitCode: null,
    error: null,
    lastOutputLine: null,
    retryCount: 0,
    telemetry: createDefaultTelemetry(),
    outputBuffer: createRingBuffer(EXECUTION_CONFIG.ringBufferSize),
  };
}

// ---------------------------------------------------------------------------
// Internal: extract last stderr lines from an agent's output buffer
// ---------------------------------------------------------------------------

function getLastStderrLines(agentRecord, maxLines = 5) {
  const all = agentRecord.outputBuffer.getAll();
  const stderrLines = all
    .filter((l) => l.startsWith("[stderr]"))
    .map((l) => l.replace("[stderr] ", ""));
  return stderrLines.slice(-maxLines);
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

/**
 * Check if an agent CLI is available.
 * @param {string} agentType — "claude" or "codex"
 * @returns {Promise<{ available: boolean, version?: string, error?: string }>}
 */
export async function checkAgentAvailability(agentType) {
  const agentConfig = EXECUTION_CONFIG.agents[agentType];
  if (!agentConfig) {
    return { available: false, error: `Unknown agent type: ${agentType}` };
  }

  return new Promise((resolve) => {
    const proc = spawnFn(agentConfig.command, agentConfig.versionArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      console.log(`[execution] agent availability check failed for ${agentType}: ${err.message}`);
      resolve({ available: false, error: err.message });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const match = stdout.match(agentConfig.versionPattern);
        const version = match ? match[1] : stdout.trim();
        console.log(`[execution] agent ${agentType} available, version: ${version}`);
        resolve({ available: true, version });
      } else {
        const errMsg = stderr.trim() || `exit code ${code}`;
        console.log(`[execution] agent ${agentType} not available: ${errMsg}`);
        resolve({ available: false, error: errMsg });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Internal: wire agent process I/O and exit handling (shared by startBuild
// and retry flows)
// ---------------------------------------------------------------------------

/**
 * Attach stdout/stderr listeners and the exit handler (with retry/escalation
 * logic) to a spawned agent process.
 *
 * @param {object} proc — child process
 * @param {object} record — build record
 * @param {object} agentRecord — agent record
 * @param {Function|null} onAgentEvent — event callback
 * @param {number} timeoutMs — per-agent timeout (0 = disabled)
 */
function wireAgentProcess(proc, record, agentRecord, onAgentEvent, timeoutMs) {
  const { projectId } = record;
  const { agentId, pid } = agentRecord;
  const parser = getParserForAgent(agentRecord.agentType);

  // --- stdout ---
  let stdoutRemainder = "";
  proc.stdout.on("data", (chunk) => {
    const text = stdoutRemainder + chunk.toString();
    const lines = text.split("\n");
    stdoutRemainder = lines.pop();

    for (const line of lines) {
      if (line.length > 0) {
        agentRecord.outputBuffer.push(line);
        agentRecord.lastOutputLine = line;

        // Telemetry parsing
        let telemetrySnapshot = null;
        if (parser) {
          const delta = parser(line);
          if (delta) {
            applyTelemetryDelta(agentRecord.telemetry, delta);
          }
        }
        // Always snapshot for the event (even if raw)
        telemetrySnapshot = { ...agentRecord.telemetry, tokens: { ...agentRecord.telemetry.tokens } };

        if (onAgentEvent) {
          onAgentEvent({
            type: "build-agent-output",
            projectId,
            agentId,
            stream: "stdout",
            line,
            telemetry: telemetrySnapshot,
          });
        }
      }
    }
  });

  // --- stderr ---
  let stderrRemainder = "";
  proc.stderr.on("data", (chunk) => {
    const text = stderrRemainder + chunk.toString();
    const lines = text.split("\n");
    stderrRemainder = lines.pop();

    for (const line of lines) {
      if (line.length > 0) {
        agentRecord.outputBuffer.push(`[stderr] ${line}`);
        agentRecord.lastOutputLine = `[stderr] ${line}`;
        if (onAgentEvent) {
          onAgentEvent({ type: "build-agent-output", projectId, agentId, stream: "stderr", line });
        }
      }
    }
  });

  // --- Timeout ---
  let timeoutTimer = null;
  if (timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      // Mark timed-out and kill
      agentRecord.status = "timed-out";
      agentRecord.error = `Timeout after ${timeoutMs}ms`;
      console.log(`[execution] agent ${agentId} timed out after ${timeoutMs}ms`);
      if (onAgentEvent) {
        onAgentEvent({ type: "timeout", projectId, agentId, timeoutMs });
      }
      try {
        proc.kill("SIGTERM");
      } catch (_) {
        /* already dead */
      }
    }, timeoutMs);
  }

  // --- Exit handler with retry / escalation ---
  proc.on("close", (code, signal) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);

    // Flush partial lines
    if (stdoutRemainder.length > 0) {
      agentRecord.outputBuffer.push(stdoutRemainder);
      agentRecord.lastOutputLine = stdoutRemainder;
    }
    if (stderrRemainder.length > 0) {
      agentRecord.outputBuffer.push(`[stderr] ${stderrRemainder}`);
      agentRecord.lastOutputLine = `[stderr] ${stderrRemainder}`;
    }

    agentRecord.exitCode = code;
    agentRecord.completedAt = new Date().toISOString();
    const elapsed = Date.now() - new Date(agentRecord.startedAt).getTime();

    // ---- Success ----
    if (code === 0) {
      agentRecord.status = "completed";
      record.status = "completed";
      record.completedAt = new Date().toISOString();
      console.log(`[execution] agent ${agentId} completed (PID ${pid}, ${elapsed}ms)`);
      if (onAgentEvent) {
        onAgentEvent({ type: "build-agent-completed", projectId, agentId, exitCode: code, elapsed });
      }
      return;
    }

    // ---- Failure path ----
    const timedOut = agentRecord.status === "timed-out";
    const errMsg = timedOut
      ? agentRecord.error
      : signal
        ? `Killed by signal ${signal}`
        : `Exit code ${code}`;

    if (!timedOut) {
      agentRecord.status = "failed";
      agentRecord.error = errMsg;
    }

    console.error(`[execution] agent ${agentId} failed: ${errMsg} (PID ${pid}, ${elapsed}ms)`);

    // Decide: auto-retry or escalate
    if (agentRecord.retryCount < 1) {
      // ----- Auto-retry (first failure) -----
      agentRecord.retryCount += 1;
      agentRecord.status = "retrying";
      record.status = "running"; // keep the build running during retry
      console.log(`[execution] auto-retrying agent ${agentId} (attempt ${agentRecord.retryCount})`);

      if (onAgentEvent) {
        onAgentEvent({
          type: "retry-started",
          projectId,
          agentId,
          retryCount: agentRecord.retryCount,
          previousError: errMsg,
        });
      }

      // Re-spawn with same config
      respawnAgent(record, agentRecord, onAgentEvent, timeoutMs);
    } else {
      // ----- Escalation (retry exhausted) -----
      agentRecord.status = "failed";
      agentRecord.error = errMsg;
      record.status = "escalated";
      record.completedAt = new Date().toISOString();

      const stderrSnippet = getLastStderrLines(agentRecord);
      record.escalation = {
        status: "raised",
        reason: `Agent ${agentId} failed after retry — ${errMsg}`,
        exitCode: code,
        stderrTail: stderrSnippet,
        raisedAt: new Date().toISOString(),
        acknowledgedAt: null,
        decision: null,
      };

      console.error(`[execution] escalation raised for ${projectId}: ${record.escalation.reason}`);

      if (onAgentEvent) {
        onAgentEvent({
          type: "escalation-raised",
          projectId,
          agentId,
          escalation: { ...record.escalation },
        });
        // Also emit the original failure event
        onAgentEvent({
          type: "build-agent-failed",
          projectId,
          agentId,
          exitCode: code,
          signal,
          error: errMsg,
          elapsed,
        });
      }
    }
  });

  // --- Spawn-time errors ---
  proc.on("error", (err) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    agentRecord.status = "failed";
    agentRecord.error = err.message;
    agentRecord.completedAt = new Date().toISOString();
    record.status = "failed";
    record.error = `Process error: ${err.message}`;
    record.completedAt = new Date().toISOString();
    console.error(`[execution] agent ${agentId} process error: ${err.message}`);

    if (onAgentEvent) {
      onAgentEvent({ type: "build-agent-failed", projectId, agentId, error: err.message });
    }
  });
}

// ---------------------------------------------------------------------------
// Internal: re-spawn an agent (used by auto-retry and manual retry)
// ---------------------------------------------------------------------------

function respawnAgent(record, agentRecord, onAgentEvent, timeoutMs) {
  const { projectId, _config: config } = record;
  const { agentId, agentType } = agentRecord;

  const agentConfig = EXECUTION_CONFIG.agents[agentType];
  const spawnArgs = [...agentConfig.execArgs];
  if (config.prompt) spawnArgs.push(config.prompt);

  let proc;
  try {
    proc = spawnFn(agentConfig.command, spawnArgs, {
      cwd: config.workspacePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
  } catch (spawnErr) {
    agentRecord.status = "failed";
    agentRecord.error = `Retry spawn failed: ${spawnErr.message}`;
    agentRecord.completedAt = new Date().toISOString();
    record.status = "failed";
    record.error = agentRecord.error;
    record.completedAt = new Date().toISOString();
    console.error(`[execution] retry spawn failed for ${projectId}: ${spawnErr.message}`);
    if (onAgentEvent) {
      onAgentEvent({ type: "build-agent-failed", projectId, agentId, error: spawnErr.message });
    }
    return;
  }

  agentRecord.pid = proc.pid;
  agentRecord.status = "running";
  agentRecord.startedAt = new Date().toISOString();
  agentRecord.completedAt = null;
  agentRecord.exitCode = null;
  agentRecord.error = null;
  agentRecord.telemetry = createDefaultTelemetry();

  console.log(`[execution] agent ${agentId} re-spawned with PID ${proc.pid} (retry ${agentRecord.retryCount})`);
  if (onAgentEvent) {
    onAgentEvent({ type: "build-agent-spawned", projectId, agentId, agentType, pid: proc.pid });
  }

  wireAgentProcess(proc, record, agentRecord, onAgentEvent, timeoutMs);
}

// ---------------------------------------------------------------------------
// Build execution
// ---------------------------------------------------------------------------

/**
 * Start a build for a project.
 * @param {string} projectId
 * @param {{ workspacePath: string, agentType?: string, prompt?: string, timeoutMs?: number }} config
 * @param {{ onAgentEvent?: (event: object) => void }} callbacks
 * @returns {Promise<object>} The build record
 */
export async function startBuild(projectId, config, { onAgentEvent } = {}) {
  // Validate config
  if (!config?.workspacePath) {
    throw new Error("[execution] workspacePath is required to start a build");
  }

  const agentType = config.agentType || "claude";
  const agentConfig = EXECUTION_CONFIG.agents[agentType];
  if (!agentConfig) {
    throw new Error(`[execution] Unknown agent type: ${agentType}`);
  }

  // Concurrency guard — reject if already running for this project
  const existing = executionState.get(projectId);
  if (existing?.status === "running") {
    const err = new Error(`[execution] Build already running for ${projectId}`);
    err.code = "BUILD_ALREADY_RUNNING";
    throw err;
  }

  // Pre-flight: check agent availability
  const availability = await checkAgentAvailability(agentType);
  if (!availability.available) {
    throw new Error(`[execution] Agent CLI '${agentType}' is not available: ${availability.error}`);
  }

  // Create build record
  const record = createBuildRecord(projectId);
  record.status = "running";
  record.startedAt = new Date().toISOString();
  record._config = config;
  record._onAgentEvent = onAgentEvent || null;
  executionState.set(projectId, record);

  // Build the spawn args
  const spawnArgs = [...agentConfig.execArgs];
  if (config.prompt) {
    spawnArgs.push(config.prompt);
  }

  // Spawn the agent process
  const agentId = generateAgentId(projectId);
  console.log(`[execution] spawning ${agentType} for ${projectId} (agentId: ${agentId}) in ${config.workspacePath}`);

  let proc;
  try {
    proc = spawnFn(agentConfig.command, spawnArgs, {
      cwd: config.workspacePath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
  } catch (spawnErr) {
    record.status = "failed";
    record.error = `Spawn failed: ${spawnErr.message}`;
    record.completedAt = new Date().toISOString();
    console.error(`[execution] spawn failed for ${projectId}: ${spawnErr.message}`);
    if (onAgentEvent) {
      onAgentEvent({ type: "build-agent-failed", projectId, agentId, error: spawnErr.message });
    }
    throw spawnErr;
  }

  const pid = proc.pid;
  const agentRecord = createAgentRecord(agentId, agentType, pid);
  record.agents.push(agentRecord);
  agentIndex.set(agentId, agentRecord);

  console.log(`[execution] agent ${agentId} spawned with PID ${pid}`);

  // Emit spawned event
  if (onAgentEvent) {
    onAgentEvent({
      type: "build-agent-spawned",
      projectId,
      agentId,
      agentType,
      pid,
    });
  }

  // Compute effective timeout
  const timeoutMs = config.timeoutMs ?? EXECUTION_CONFIG.agentTimeoutMs;

  // Wire I/O, exit handler with retry/escalation, and timeout
  wireAgentProcess(proc, record, agentRecord, onAgentEvent, timeoutMs);

  return record;
}

// ---------------------------------------------------------------------------
// Operator actions: retry agent, acknowledge escalation
// ---------------------------------------------------------------------------

/**
 * Manually retry an agent after an escalation has been acknowledged.
 * @param {string} projectId
 * @param {string} agentId
 * @returns {object} updated agent record snapshot
 */
export function retryAgent(projectId, agentId) {
  const record = executionState.get(projectId);
  if (!record) throw new Error(`[execution] No build found for ${projectId}`);

  const agentRecord = agentIndex.get(agentId);
  if (!agentRecord) throw new Error(`[execution] No agent found: ${agentId}`);

  // Reset escalation
  record.escalation = null;
  record.status = "running";
  record.completedAt = null;
  record.error = null;

  // Bump retry count and re-spawn
  agentRecord.retryCount += 1;
  agentRecord.status = "retrying";

  const onAgentEvent = record._onAgentEvent;
  const timeoutMs = record._config?.timeoutMs ?? EXECUTION_CONFIG.agentTimeoutMs;

  console.log(`[execution] manual retry for agent ${agentId} in ${projectId} (attempt ${agentRecord.retryCount})`);
  if (onAgentEvent) {
    onAgentEvent({
      type: "retry-started",
      projectId,
      agentId,
      retryCount: agentRecord.retryCount,
      previousError: agentRecord.error,
    });
  }

  respawnAgent(record, agentRecord, onAgentEvent, timeoutMs);

  return {
    agentId: agentRecord.agentId,
    status: agentRecord.status,
    retryCount: agentRecord.retryCount,
    pid: agentRecord.pid,
  };
}

/**
 * Acknowledge an escalation for a project.
 * @param {string} projectId
 * @param {'retry' | 'abort'} decision
 * @returns {object} updated status snapshot
 */
export function acknowledgeEscalation(projectId, decision) {
  const record = executionState.get(projectId);
  if (!record) throw new Error(`[execution] No build found for ${projectId}`);
  if (!record.escalation) throw new Error(`[execution] No active escalation for ${projectId}`);
  if (record.escalation.status !== "raised") {
    throw new Error(`[execution] Escalation already acknowledged for ${projectId}`);
  }

  record.escalation.acknowledgedAt = new Date().toISOString();
  record.escalation.decision = decision;
  record.escalation.status = "acknowledged";

  const onAgentEvent = record._onAgentEvent;
  console.log(`[execution] escalation acknowledged for ${projectId}: decision=${decision}`);

  if (onAgentEvent) {
    onAgentEvent({
      type: "escalation-acknowledged",
      projectId,
      decision,
      escalation: { ...record.escalation },
    });
  }

  if (decision === "retry") {
    // Find the last agent that failed and retry it
    const lastAgent = record.agents[record.agents.length - 1];
    if (lastAgent) {
      retryAgent(projectId, lastAgent.agentId);
    }
    return getStatus(projectId);
  }

  if (decision === "abort") {
    record.status = "aborted";
    record.completedAt = new Date().toISOString();
    console.log(`[execution] build aborted for ${projectId}`);
    return getStatus(projectId);
  }

  throw new Error(`[execution] Invalid decision: ${decision}. Must be 'retry' or 'abort'.`);
}

// ---------------------------------------------------------------------------
// Escalation queries
// ---------------------------------------------------------------------------

/**
 * Get all active escalations across projects.
 * @returns {Array<{ projectId: string, escalation: object }>}
 */
export function getActiveEscalations() {
  const results = [];
  for (const [projectId, record] of executionState) {
    if (record.escalation && record.escalation.status === "raised") {
      results.push({ projectId, escalation: { ...record.escalation } });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Active builds query
// ---------------------------------------------------------------------------

/**
 * Get all projectIds with active (running or escalated) builds.
 * Useful for cleanup sweeps and dashboard fleet views.
 * @returns {string[]}
 */
export function getActiveBuilds() {
  const results = [];
  for (const [projectId, record] of executionState) {
    if (record.status === "running" || record.status === "escalated") {
      results.push(projectId);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Status queries
// ---------------------------------------------------------------------------

/**
 * Get current build execution status for a project.
 * @param {string} projectId
 * @returns {object|null}
 */
export function getStatus(projectId) {
  const record = executionState.get(projectId);
  if (!record) return null;

  return {
    projectId: record.projectId,
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    error: record.error,
    escalation: record.escalation ? { ...record.escalation } : null,
    agents: record.agents.map((a) => ({
      agentId: a.agentId,
      agentType: a.agentType,
      pid: a.pid,
      status: a.status,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      exitCode: a.exitCode,
      error: a.error,
      lastOutputLine: a.lastOutputLine,
      outputLines: a.outputBuffer.length,
      retryCount: a.retryCount,
      telemetry: a.telemetry
        ? { ...a.telemetry, tokens: { ...a.telemetry.tokens } }
        : null,
    })),
  };
}

/**
 * Get agent output from ring buffer.
 * @param {string} agentId
 * @returns {string[]|null} Array of output lines, or null if agent not found
 */
export function getAgentOutput(agentId) {
  const agentRecord = agentIndex.get(agentId);
  if (!agentRecord) return null;
  return agentRecord.outputBuffer.getAll();
}

// ---------------------------------------------------------------------------
// Process cleanup
// ---------------------------------------------------------------------------

/**
 * Kill all active agent processes and clear execution state.
 * Used on server shutdown (SIGTERM/SIGINT) to prevent zombie agents.
 *
 * @returns {{ killed: number, alreadyDead: number, errors: Array<{ pid: number, error: string }> }}
 */
export function cleanupAllBuilds() {
  const results = { killed: 0, alreadyDead: 0, errors: [] };
  const pidsAttempted = [];

  for (const [projectId, record] of executionState) {
    for (const agent of record.agents) {
      const { pid, agentId, status } = agent;
      if (!pid) continue;

      // Skip agents already in terminal state with no live process
      if (status === "completed" || status === "aborted") {
        // Probe to see if the process is truly dead
        try {
          process.kill(pid, 0);
        } catch {
          // Already dead — skip
          continue;
        }
      }

      pidsAttempted.push(pid);

      try {
        process.kill(pid, 0); // probe — throws ESRCH if dead
        process.kill(pid, "SIGTERM");
        results.killed++;
        console.log(`[execution] cleanup: killed agent ${agentId} (PID ${pid}) for project ${projectId}`);
      } catch (err) {
        if (err.code === "ESRCH") {
          // Process already dead — expected for completed/failed agents
          results.alreadyDead++;
        } else {
          results.errors.push({ pid, error: err.code || err.message });
          console.error(`[execution] cleanup: failed to kill PID ${pid}: ${err.code || err.message}`);
        }
      }
    }
  }

  const total = pidsAttempted.length;
  console.log(
    `[execution] cleanup: ${results.killed} killed, ${results.alreadyDead} already dead, ${results.errors.length} errors (${total} PIDs checked)`,
  );

  // Clear state after cleanup
  executionState.clear();
  agentIndex.clear();

  return results;
}

/**
 * Detect potential orphaned agent processes on startup.
 *
 * Since execution state is in-memory (no disk persistence), after a server
 * restart the state Map is empty. This function logs an advisory warning
 * so the operator knows to check manually if the prior server crashed.
 *
 * If state is non-empty (hot restart), it reports any builds still in
 * "running" state as potentially orphaned.
 */
export function detectOrphanedProcesses() {
  if (executionState.size === 0) {
    console.log(
      "[execution] orphan-check: in-memory state is empty (fresh start). " +
      "If the prior server crashed, check for orphaned agent processes manually " +
      "(e.g. `ps aux | grep claude` or `ps aux | grep codex`).",
    );
    return { status: "clean-start", orphans: [] };
  }

  // State is non-empty — check for builds that were still running
  const orphans = [];
  for (const [projectId, record] of executionState) {
    if (record.status === "running") {
      for (const agent of record.agents) {
        if (agent.pid && (agent.status === "running" || agent.status === "retrying")) {
          // Probe the PID to see if it's still alive
          let alive = false;
          try {
            process.kill(agent.pid, 0);
            alive = true;
          } catch {
            // Process is dead
          }
          orphans.push({
            projectId,
            agentId: agent.agentId,
            pid: agent.pid,
            alive,
          });
        }
      }
    }
  }

  if (orphans.length > 0) {
    console.warn(
      `[execution] orphan-check: found ${orphans.length} potentially orphaned agent(s):`,
      orphans.map((o) => `PID ${o.pid} (${o.alive ? "alive" : "dead"}) — ${o.projectId}`).join("; "),
    );
  } else {
    console.log("[execution] orphan-check: no orphaned agents detected");
  }

  return { status: "checked", orphans };
}

/**
 * Clear all execution state. Used for test cleanup.
 */
export function clear() {
  executionState.clear();
  agentIndex.clear();
}
