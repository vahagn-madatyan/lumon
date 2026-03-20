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
    outputBuffer: createRingBuffer(EXECUTION_CONFIG.ringBufferSize),
  };
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
// Build execution
// ---------------------------------------------------------------------------

/**
 * Start a build for a project.
 * @param {string} projectId
 * @param {{ workspacePath: string, agentType?: string, prompt?: string }} config
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

  // Wire stdout line buffering
  let stdoutRemainder = "";
  proc.stdout.on("data", (chunk) => {
    const text = stdoutRemainder + chunk.toString();
    const lines = text.split("\n");
    stdoutRemainder = lines.pop(); // incomplete last line

    for (const line of lines) {
      if (line.length > 0) {
        agentRecord.outputBuffer.push(line);
        agentRecord.lastOutputLine = line;

        if (onAgentEvent) {
          onAgentEvent({
            type: "build-agent-output",
            projectId,
            agentId,
            stream: "stdout",
            line,
          });
        }
      }
    }
  });

  // Wire stderr line buffering
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
          onAgentEvent({
            type: "build-agent-output",
            projectId,
            agentId,
            stream: "stderr",
            line,
          });
        }
      }
    }
  });

  // Exit handler
  proc.on("close", (code, signal) => {
    // Flush any remaining partial lines
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

    if (code === 0) {
      agentRecord.status = "completed";
      record.status = "completed";
      record.completedAt = new Date().toISOString();
      console.log(`[execution] agent ${agentId} completed (PID ${pid}, ${elapsed}ms)`);

      if (onAgentEvent) {
        onAgentEvent({
          type: "build-agent-completed",
          projectId,
          agentId,
          exitCode: code,
          elapsed,
        });
      }
    } else {
      const errMsg = signal
        ? `Killed by signal ${signal}`
        : `Exit code ${code}`;
      agentRecord.status = "failed";
      agentRecord.error = errMsg;
      record.status = "failed";
      record.error = errMsg;
      record.completedAt = new Date().toISOString();
      console.error(`[execution] agent ${agentId} failed: ${errMsg} (PID ${pid}, ${elapsed}ms)`);

      if (onAgentEvent) {
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

  // Handle spawn-time errors (e.g., ENOENT)
  proc.on("error", (err) => {
    agentRecord.status = "failed";
    agentRecord.error = err.message;
    agentRecord.completedAt = new Date().toISOString();
    record.status = "failed";
    record.error = `Process error: ${err.message}`;
    record.completedAt = new Date().toISOString();
    console.error(`[execution] agent ${agentId} process error: ${err.message}`);

    if (onAgentEvent) {
      onAgentEvent({
        type: "build-agent-failed",
        projectId,
        agentId,
        error: err.message,
      });
    }
  });

  return record;
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

/**
 * Clear all execution state. Used for test cleanup.
 */
export function clear() {
  executionState.clear();
  agentIndex.clear();
}
