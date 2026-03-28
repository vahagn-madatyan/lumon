import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  parseClaudeCodeLine,
  parseCodexLine,
  createDefaultTelemetry,
  applyTelemetryDelta,
  getParserForAgent,
  startBuild,
  getStatus,
  clear,
  _setSpawn,
  _resetSpawn,
} from "../execution.js";

// ---------------------------------------------------------------------------
// Helpers — fake child process (same pattern as execution-retry.test.js)
// ---------------------------------------------------------------------------

function createFakeProcess(pid = 1234) {
  const proc = new EventEmitter();
  proc.pid = pid;
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.stdout.on("error", () => {});
  proc.stderr.on("error", () => {});
  proc.kill = vi.fn();
  return proc;
}

function installMockSpawn(procOrFactory) {
  const factory =
    typeof procOrFactory === "function" ? procOrFactory : () => procOrFactory;

  _setSpawn((cmd, args, opts) => {
    if (args.includes("--version")) {
      const versionProc = createFakeProcess(9999);
      process.nextTick(() => {
        versionProc.stdout.push(`${cmd} version 1.0.0\n`);
        versionProc.stdout.push(null);
        setTimeout(() => versionProc.emit("close", 0, null), 5);
      });
      return versionProc;
    }
    return factory(cmd, args, opts);
  });
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clear();
});

afterEach(() => {
  _resetSpawn();
  clear();
});

// ===================================================================
// Claude Code parser: parseClaudeCodeLine
// ===================================================================

describe("parseClaudeCodeLine", () => {
  it("returns null for non-JSON lines", () => {
    expect(parseClaudeCodeLine("hello world")).toBeNull();
    expect(parseClaudeCodeLine("")).toBeNull();
    expect(parseClaudeCodeLine("{broken json")).toBeNull();
  });

  it("returns null for valid JSON without type field", () => {
    expect(parseClaudeCodeLine('{"foo":"bar"}')).toBeNull();
    expect(parseClaudeCodeLine("42")).toBeNull();
    expect(parseClaudeCodeLine('"string"')).toBeNull();
    expect(parseClaudeCodeLine("null")).toBeNull();
  });

  it("parses system init event to initializing progress", () => {
    const line = JSON.stringify({ type: "system", subtype: "init", session_id: "abc" });
    const delta = parseClaudeCodeLine(line);
    expect(delta).toEqual({ progress: "initializing" });
  });

  it("parses assistant message with usage tokens", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Creating the auth module..." }],
        usage: { input_tokens: 1500, output_tokens: 300 },
      },
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.tokens).toEqual({ input: 1500, output: 300 });
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBe("Creating the auth module...");
  });

  it("parses assistant message with string content", () => {
    const line = JSON.stringify({
      type: "assistant",
      content: "Writing unit tests for the API",
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBe("Writing unit tests for the API");
  });

  it("truncates long content summaries to 200 chars", () => {
    const longText = "x".repeat(500);
    const line = JSON.stringify({
      type: "assistant",
      content: longText,
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.lastOutputSummary).toHaveLength(200);
  });

  it("extracts top-level usage when message.usage is absent", () => {
    const line = JSON.stringify({
      type: "assistant",
      usage: { input_tokens: 800, output_tokens: 120 },
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.tokens).toEqual({ input: 800, output: 120 });
  });

  it("parses result with success subtype and cost", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      cost_usd: 0.042,
      usage: { input_tokens: 5000, output_tokens: 2000 },
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.progress).toBe("completed");
    expect(delta.costUsd).toBe(0.042);
    expect(delta.tokens).toEqual({ input: 5000, output: 2000 });
  });

  it("parses result with error subtype", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "error",
      cost_usd: 0.015,
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.progress).toBe("error");
    expect(delta.costUsd).toBe(0.015);
  });

  it("extracts total_cost_usd as fallback cost field", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      total_cost_usd: 0.099,
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.costUsd).toBe(0.099);
  });

  it("ignores unknown fields gracefully", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "hello" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      unknown_field: "ignored",
      model: "claude-opus-4-20250514",
      stop_reason: "end_turn",
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.tokens).toEqual({ input: 100, output: 50 });
    expect(delta.progress).toBe("working");
    // No crash, no unknown fields in delta
    expect(Object.keys(delta)).toEqual(
      expect.arrayContaining(["tokens", "progress", "lastOutputSummary"])
    );
  });

  it("handles assistant message with no content", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { usage: { input_tokens: 200, output_tokens: 10 } },
    });
    const delta = parseClaudeCodeLine(line);
    expect(delta.tokens).toEqual({ input: 200, output: 10 });
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBeUndefined();
  });
});

// ===================================================================
// Codex CLI parser: parseCodexLine
// ===================================================================

describe("parseCodexLine", () => {
  it("returns null for non-JSON lines", () => {
    expect(parseCodexLine("plain text output")).toBeNull();
    expect(parseCodexLine("")).toBeNull();
    expect(parseCodexLine("{bad")).toBeNull();
  });

  it("returns null for valid JSON without type field", () => {
    expect(parseCodexLine('{"data":123}')).toBeNull();
    expect(parseCodexLine("true")).toBeNull();
  });

  it("parses status event with running status", () => {
    const line = JSON.stringify({ type: "status", status: "running" });
    const delta = parseCodexLine(line);
    expect(delta).toEqual({ progress: "running" });
  });

  it("parses status event with completed status", () => {
    const line = JSON.stringify({ type: "status", status: "completed" });
    const delta = parseCodexLine(line);
    expect(delta).toEqual({ progress: "completed" });
  });

  it("parses message event with content", () => {
    const line = JSON.stringify({
      type: "message",
      content: "Installing dependencies...",
    });
    const delta = parseCodexLine(line);
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBe("Installing dependencies...");
  });

  it("truncates long message content to 200 chars", () => {
    const longContent = "y".repeat(400);
    const line = JSON.stringify({ type: "message", content: longContent });
    const delta = parseCodexLine(line);
    expect(delta.lastOutputSummary).toHaveLength(200);
  });

  it("parses result event with usage and cost", () => {
    const line = JSON.stringify({
      type: "result",
      usage: { prompt_tokens: 3000, completion_tokens: 1200 },
      cost_usd: 0.031,
    });
    const delta = parseCodexLine(line);
    expect(delta.tokens).toEqual({ input: 3000, output: 1200 });
    expect(delta.costUsd).toBe(0.031);
    expect(delta.progress).toBe("completed");
  });

  it("parses result event with error flag", () => {
    const line = JSON.stringify({
      type: "result",
      error: "something went wrong",
    });
    const delta = parseCodexLine(line);
    expect(delta.progress).toBe("error");
  });

  it("handles usage with input_tokens/output_tokens fallback", () => {
    const line = JSON.stringify({
      type: "result",
      usage: { input_tokens: 1000, output_tokens: 500 },
    });
    const delta = parseCodexLine(line);
    expect(delta.tokens).toEqual({ input: 1000, output: 500 });
  });

  it("ignores unknown fields gracefully", () => {
    const line = JSON.stringify({
      type: "message",
      content: "working",
      model: "gpt-4o",
      tool_calls: [],
      random: true,
    });
    const delta = parseCodexLine(line);
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBe("working");
    expect(delta).not.toHaveProperty("model");
    expect(delta).not.toHaveProperty("tool_calls");
  });

  it("handles message event with empty content", () => {
    const line = JSON.stringify({ type: "message", content: "" });
    const delta = parseCodexLine(line);
    expect(delta.progress).toBe("working");
    expect(delta.lastOutputSummary).toBeUndefined();
  });
});

// ===================================================================
// createDefaultTelemetry
// ===================================================================

describe("createDefaultTelemetry", () => {
  it("returns a fresh telemetry object with raw: true", () => {
    const t = createDefaultTelemetry();
    expect(t).toEqual({
      tokens: { input: 0, output: 0 },
      costUsd: 0,
      progress: null,
      lastOutputSummary: null,
      raw: true,
    });
  });

  it("returns independent objects on each call", () => {
    const a = createDefaultTelemetry();
    const b = createDefaultTelemetry();
    a.tokens.input = 999;
    expect(b.tokens.input).toBe(0);
  });
});

// ===================================================================
// applyTelemetryDelta
// ===================================================================

describe("applyTelemetryDelta", () => {
  it("applies token delta and sets raw: false", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { tokens: { input: 100, output: 50 } });
    expect(t.tokens).toEqual({ input: 100, output: 50 });
    expect(t.raw).toBe(false);
  });

  it("applies cost delta", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { costUsd: 0.05 });
    expect(t.costUsd).toBe(0.05);
    expect(t.raw).toBe(false);
  });

  it("applies progress delta", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { progress: "working" });
    expect(t.progress).toBe("working");
    expect(t.raw).toBe(false);
  });

  it("applies lastOutputSummary", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { lastOutputSummary: "Building auth..." });
    expect(t.lastOutputSummary).toBe("Building auth...");
    expect(t.raw).toBe(false);
  });

  it("accumulates multiple deltas", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { tokens: { input: 100, output: 50 }, progress: "working" });
    applyTelemetryDelta(t, { tokens: { input: 200, output: 80 }, costUsd: 0.02 });
    expect(t.tokens).toEqual({ input: 200, output: 80 });
    expect(t.progress).toBe("working");
    expect(t.costUsd).toBe(0.02);
  });

  it("does not set raw: false for empty deltas", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, {});
    expect(t.raw).toBe(true);
  });

  it("does not update tokens when delta tokens are zero", () => {
    const t = createDefaultTelemetry();
    applyTelemetryDelta(t, { tokens: { input: 500, output: 200 } });
    applyTelemetryDelta(t, { tokens: { input: 0, output: 0 } });
    // Zeros don't overwrite existing non-zero values
    expect(t.tokens).toEqual({ input: 500, output: 200 });
  });
});

// ===================================================================
// getParserForAgent
// ===================================================================

describe("getParserForAgent", () => {
  it('returns parseClaudeCodeLine for "claude"', () => {
    expect(getParserForAgent("claude")).toBe(parseClaudeCodeLine);
  });

  it('returns parseCodexLine for "codex"', () => {
    expect(getParserForAgent("codex")).toBe(parseCodexLine);
  });

  it("returns null for unknown agent types", () => {
    expect(getParserForAgent("unknown")).toBeNull();
    expect(getParserForAgent("cursor")).toBeNull();
    expect(getParserForAgent("")).toBeNull();
  });
});

// ===================================================================
// Graceful degradation: unknown/unparseable output
// ===================================================================

describe("graceful degradation on unknown format", () => {
  it("non-JSON output leaves telemetry as raw: true", () => {
    const t = createDefaultTelemetry();
    const parser = getParserForAgent("claude");
    const lines = [
      "Starting build...",
      "npm install",
      "Build complete.",
    ];
    for (const line of lines) {
      const delta = parser(line);
      if (delta) applyTelemetryDelta(t, delta);
    }
    expect(t.raw).toBe(true);
    expect(t.tokens).toEqual({ input: 0, output: 0 });
  });

  it("partial JSON lines return null from Claude parser", () => {
    expect(parseClaudeCodeLine('{"type":"assistant","message')).toBeNull();
    expect(parseClaudeCodeLine('{')).toBeNull();
  });

  it("partial JSON lines return null from Codex parser", () => {
    expect(parseCodexLine('{"type":"message","con')).toBeNull();
    expect(parseCodexLine("{")).toBeNull();
  });

  it("mixed valid and invalid lines only parse the valid ones", () => {
    const t = createDefaultTelemetry();
    const parser = getParserForAgent("claude");

    const lines = [
      "some plain text",
      JSON.stringify({ type: "assistant", usage: { input_tokens: 100, output_tokens: 20 } }),
      "more plain text",
      "{invalid json",
      JSON.stringify({ type: "result", subtype: "success", cost_usd: 0.01 }),
    ];

    for (const line of lines) {
      const delta = parser(line);
      if (delta) applyTelemetryDelta(t, delta);
    }

    expect(t.raw).toBe(false);
    expect(t.tokens).toEqual({ input: 100, output: 20 });
    expect(t.costUsd).toBe(0.01);
    expect(t.progress).toBe("completed");
  });

  it("unknown agent type means no parser, telemetry stays raw", () => {
    const parser = getParserForAgent("unknown-agent");
    expect(parser).toBeNull();
    // When parser is null, the integration code simply skips parsing
    const t = createDefaultTelemetry();
    expect(t.raw).toBe(true);
  });
});

// ===================================================================
// Integration: telemetry in onAgentEvent during build
// ===================================================================

describe("telemetry integration with agent events", () => {
  it("includes telemetry snapshot in build-agent-output events for Claude agent", async () => {
    const events = [];
    const proc = createFakeProcess(2001);
    installMockSpawn(proc);

    await startBuild("proj-telem-1", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    }, {
      onAgentEvent: (e) => events.push(e),
    });

    await tick();

    // Send a Claude Code JSON line via stdout
    const claudeLine = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Implementing login endpoint" }],
        usage: { input_tokens: 1200, output_tokens: 350 },
      },
    });
    proc.stdout.push(claudeLine + "\n");
    await tick();

    const outputEvents = events.filter((e) => e.type === "build-agent-output");
    expect(outputEvents.length).toBeGreaterThanOrEqual(1);

    const lastOutput = outputEvents[outputEvents.length - 1];
    expect(lastOutput.telemetry).toBeDefined();
    expect(lastOutput.telemetry.tokens).toEqual({ input: 1200, output: 350 });
    expect(lastOutput.telemetry.progress).toBe("working");
    expect(lastOutput.telemetry.lastOutputSummary).toBe("Implementing login endpoint");
    expect(lastOutput.telemetry.raw).toBe(false);

    // Cleanup
    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("includes telemetry snapshot in build-agent-output events for Codex agent", async () => {
    const events = [];
    const proc = createFakeProcess(2002);
    installMockSpawn(proc);

    await startBuild("proj-telem-2", {
      workspacePath: "/tmp/test-ws",
      agentType: "codex",
      timeoutMs: 0,
    }, {
      onAgentEvent: (e) => events.push(e),
    });

    await tick();

    const codexLine = JSON.stringify({
      type: "result",
      usage: { prompt_tokens: 2000, completion_tokens: 800 },
      cost_usd: 0.028,
    });
    proc.stdout.push(codexLine + "\n");
    await tick();

    const outputEvents = events.filter((e) => e.type === "build-agent-output");
    expect(outputEvents.length).toBeGreaterThanOrEqual(1);

    const lastOutput = outputEvents[outputEvents.length - 1];
    expect(lastOutput.telemetry).toBeDefined();
    expect(lastOutput.telemetry.tokens).toEqual({ input: 2000, output: 800 });
    expect(lastOutput.telemetry.costUsd).toBe(0.028);
    expect(lastOutput.telemetry.progress).toBe("completed");
    expect(lastOutput.telemetry.raw).toBe(false);

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("telemetry stays raw: true for non-JSON agent output", async () => {
    const events = [];
    const proc = createFakeProcess(2003);
    installMockSpawn(proc);

    await startBuild("proj-telem-3", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    }, {
      onAgentEvent: (e) => events.push(e),
    });

    await tick();

    // Send plain text (not JSON)
    proc.stdout.push("Building project...\n");
    proc.stdout.push("npm install complete\n");
    await tick();

    const outputEvents = events.filter((e) => e.type === "build-agent-output");
    expect(outputEvents.length).toBe(2);

    // Both events should have raw telemetry
    for (const evt of outputEvents) {
      expect(evt.telemetry.raw).toBe(true);
      expect(evt.telemetry.tokens).toEqual({ input: 0, output: 0 });
    }

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("telemetry accumulates across multiple JSON lines", async () => {
    const events = [];
    const proc = createFakeProcess(2004);
    installMockSpawn(proc);

    await startBuild("proj-telem-4", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    }, {
      onAgentEvent: (e) => events.push(e),
    });

    await tick();

    // Send init
    proc.stdout.push(JSON.stringify({ type: "system", subtype: "init" }) + "\n");
    await tick();

    // Send assistant with tokens
    proc.stdout.push(JSON.stringify({
      type: "assistant",
      usage: { input_tokens: 500, output_tokens: 100 },
    }) + "\n");
    await tick();

    // Send result with final cost
    proc.stdout.push(JSON.stringify({
      type: "result",
      subtype: "success",
      cost_usd: 0.012,
      usage: { input_tokens: 1500, output_tokens: 400 },
    }) + "\n");
    await tick();

    const outputEvents = events.filter((e) => e.type === "build-agent-output");
    expect(outputEvents.length).toBe(3);

    // First event: init
    expect(outputEvents[0].telemetry.progress).toBe("initializing");

    // Second event: assistant with tokens
    expect(outputEvents[1].telemetry.tokens).toEqual({ input: 500, output: 100 });
    expect(outputEvents[1].telemetry.progress).toBe("working");

    // Third event: result with final tokens and cost
    expect(outputEvents[2].telemetry.tokens).toEqual({ input: 1500, output: 400 });
    expect(outputEvents[2].telemetry.costUsd).toBe(0.012);
    expect(outputEvents[2].telemetry.progress).toBe("completed");
    expect(outputEvents[2].telemetry.raw).toBe(false);

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("telemetry is exposed in getStatus agent snapshot", async () => {
    const proc = createFakeProcess(2005);
    installMockSpawn(proc);

    await startBuild("proj-telem-5", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    });

    await tick();

    proc.stdout.push(JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Working on feature" }],
        usage: { input_tokens: 900, output_tokens: 250 },
      },
    }) + "\n");
    await tick();

    const status = getStatus("proj-telem-5");
    expect(status.agents[0].telemetry).toBeDefined();
    expect(status.agents[0].telemetry.tokens).toEqual({ input: 900, output: 250 });
    expect(status.agents[0].telemetry.raw).toBe(false);
    expect(status.agents[0].telemetry.lastOutputSummary).toBe("Working on feature");

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("telemetry resets on agent retry", async () => {
    const events = [];
    const proc1 = createFakeProcess(3001);
    const proc2 = createFakeProcess(3002);
    let spawnCount = 0;
    installMockSpawn(() => {
      spawnCount++;
      return spawnCount === 1 ? proc1 : proc2;
    });

    await startBuild("proj-telem-retry", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    }, {
      onAgentEvent: (e) => events.push(e),
    });

    await tick();

    // Send telemetry before failure
    proc1.stdout.push(JSON.stringify({
      type: "assistant",
      usage: { input_tokens: 500, output_tokens: 100 },
    }) + "\n");
    await tick();

    // Verify telemetry was recorded
    let status = getStatus("proj-telem-retry");
    expect(status.agents[0].telemetry.tokens.input).toBe(500);

    // Agent fails → auto-retry
    proc1.stdout.push(null);
    proc1.stderr.push(null);
    proc1.emit("close", 1, null);
    await tick(50);

    // After retry, telemetry should be reset to defaults
    status = getStatus("proj-telem-retry");
    expect(status.agents[0].telemetry.tokens).toEqual({ input: 0, output: 0 });
    expect(status.agents[0].telemetry.raw).toBe(true);

    // New telemetry on retry
    proc2.stdout.push(JSON.stringify({
      type: "assistant",
      usage: { input_tokens: 800, output_tokens: 200 },
    }) + "\n");
    await tick();

    status = getStatus("proj-telem-retry");
    expect(status.agents[0].telemetry.tokens).toEqual({ input: 800, output: 200 });
    expect(status.agents[0].telemetry.raw).toBe(false);

    proc2.stdout.push(null);
    proc2.stderr.push(null);
    proc2.emit("close", 0, null);
  });
});

// ===================================================================
// Spawn config: output format flags already in execArgs
// ===================================================================

describe("spawn config includes output format flags", () => {
  it("Claude agent includes --output-format stream-json in exec args", async () => {
    let capturedArgs;
    const proc = createFakeProcess(4001);
    _setSpawn((cmd, args, opts) => {
      if (args.includes("--version")) {
        const vp = createFakeProcess(9999);
        process.nextTick(() => {
          vp.stdout.push("claude version 1.0.0\n");
          vp.stdout.push(null);
          setTimeout(() => vp.emit("close", 0, null), 5);
        });
        return vp;
      }
      capturedArgs = args;
      return proc;
    });

    await startBuild("proj-args-1", {
      workspacePath: "/tmp/test-ws",
      agentType: "claude",
      timeoutMs: 0,
    });

    await tick();

    expect(capturedArgs).toContain("--output-format");
    expect(capturedArgs).toContain("stream-json");

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });

  it("Codex agent includes --json in exec args", async () => {
    let capturedArgs;
    const proc = createFakeProcess(4002);
    _setSpawn((cmd, args, opts) => {
      if (args.includes("--version")) {
        const vp = createFakeProcess(9999);
        process.nextTick(() => {
          vp.stdout.push("codex version 1.0.0\n");
          vp.stdout.push(null);
          setTimeout(() => vp.emit("close", 0, null), 5);
        });
        return vp;
      }
      capturedArgs = args;
      return proc;
    });

    await startBuild("proj-args-2", {
      workspacePath: "/tmp/test-ws",
      agentType: "codex",
      timeoutMs: 0,
    });

    await tick();

    expect(capturedArgs).toContain("--json");

    proc.stdout.push(null);
    proc.stderr.push(null);
    proc.emit("close", 0, null);
  });
});

// ===================================================================
// Field extraction accuracy: end-to-end Claude Code session
// ===================================================================

describe("end-to-end Claude Code telemetry session", () => {
  it("processes a realistic session with init, work, and result", () => {
    const t = createDefaultTelemetry();
    const parser = getParserForAgent("claude");

    const session = [
      { type: "system", subtype: "init", session_id: "sess-123", tools: ["Read", "Write"] },
      { type: "assistant", message: { content: [{ type: "text", text: "Reading the codebase structure" }], usage: { input_tokens: 500, output_tokens: 80 } } },
      { type: "assistant", message: { content: [{ type: "text", text: "Creating the login endpoint with bcrypt hashing" }], usage: { input_tokens: 1200, output_tokens: 350 } } },
      { type: "assistant", message: { content: [{ type: "text", text: "Writing unit tests for auth module" }], usage: { input_tokens: 2000, output_tokens: 600 } } },
      { type: "result", subtype: "success", cost_usd: 0.048, usage: { input_tokens: 3500, output_tokens: 1100 } },
    ];

    for (const event of session) {
      const delta = parser(JSON.stringify(event));
      if (delta) applyTelemetryDelta(t, delta);
    }

    expect(t.tokens).toEqual({ input: 3500, output: 1100 });
    expect(t.costUsd).toBe(0.048);
    expect(t.progress).toBe("completed");
    expect(t.lastOutputSummary).toBe("Writing unit tests for auth module");
    expect(t.raw).toBe(false);
  });
});

describe("end-to-end Codex CLI telemetry session", () => {
  it("processes a realistic session with status, messages, and result", () => {
    const t = createDefaultTelemetry();
    const parser = getParserForAgent("codex");

    const session = [
      { type: "status", status: "running" },
      { type: "message", content: "Analyzing project structure" },
      { type: "message", content: "Installing missing dependencies" },
      { type: "result", usage: { prompt_tokens: 4000, completion_tokens: 1500 }, cost_usd: 0.065 },
    ];

    for (const event of session) {
      const delta = parser(JSON.stringify(event));
      if (delta) applyTelemetryDelta(t, delta);
    }

    expect(t.tokens).toEqual({ input: 4000, output: 1500 });
    expect(t.costUsd).toBe(0.065);
    expect(t.progress).toBe("completed");
    expect(t.lastOutputSummary).toBe("Installing missing dependencies");
    expect(t.raw).toBe(false);
  });
});
