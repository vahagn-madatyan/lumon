import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Default database path: server/data/lumon.db
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
let dbPath = resolve(__dirname, "data", "lumon.db");

/** @type {Database.Database | null} */
let db = null;

// ---------------------------------------------------------------------------
// Schema DDL — idempotent (CREATE TABLE IF NOT EXISTS)
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS pipeline_executions (
    executionId   TEXT PRIMARY KEY,
    projectId     TEXT NOT NULL,
    stageKey      TEXT NOT NULL,
    subStage      TEXT,
    status        TEXT NOT NULL DEFAULT 'triggered',
    context       TEXT,          -- JSON
    n8nExecutionId TEXT,
    resumeUrl     TEXT,
    triggeredAt   TEXT NOT NULL,
    completedAt   TEXT,
    failureReason TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_pipeline_project_stage
    ON pipeline_executions (projectId, stageKey);

  CREATE TABLE IF NOT EXISTS build_executions (
    projectId   TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'idle',
    startedAt   TEXT,
    completedAt TEXT,
    error       TEXT,
    escalation  TEXT,           -- JSON
    configJson  TEXT            -- JSON (for _config snapshot)
  );

  CREATE TABLE IF NOT EXISTS build_agents (
    agentId       TEXT PRIMARY KEY,
    projectId     TEXT NOT NULL,
    agentType     TEXT NOT NULL,
    pid           INTEGER,
    status        TEXT NOT NULL DEFAULT 'running',
    startedAt     TEXT,
    completedAt   TEXT,
    exitCode      INTEGER,
    error         TEXT,
    lastOutputLine TEXT,
    retryCount    INTEGER NOT NULL DEFAULT 0,
    telemetry     TEXT,          -- JSON
    FOREIGN KEY (projectId) REFERENCES build_executions(projectId)
  );

  CREATE INDEX IF NOT EXISTS idx_build_agents_project
    ON build_agents (projectId);

  CREATE TABLE IF NOT EXISTS external_actions (
    id          TEXT PRIMARY KEY,
    projectId   TEXT NOT NULL,
    type        TEXT NOT NULL,
    params      TEXT,            -- JSON
    status      TEXT NOT NULL DEFAULT 'pending',
    requestedAt TEXT NOT NULL,
    confirmedAt TEXT,
    executedAt  TEXT,
    completedAt TEXT,
    result      TEXT,            -- JSON
    error       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_external_actions_project
    ON external_actions (projectId);

  CREATE TABLE IF NOT EXISTS audit_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId   TEXT NOT NULL,
    eventType   TEXT NOT NULL,
    data        TEXT,
    timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
    actor       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_events_project_time
    ON audit_events (projectId, timestamp);

  CREATE INDEX IF NOT EXISTS idx_audit_events_time
    ON audit_events (timestamp);
`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applySchema(database) {
  database.exec(SCHEMA_SQL);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Override the default database path. Used by tests to redirect to a temp dir.
 * Must be called BEFORE initialize().
 * @param {string} path — absolute or relative path for the database file
 */
export function _setDbPath(path) {
  dbPath = path;
}

/**
 * Initialize the database: open/create the file, enable WAL, create tables.
 * Idempotent — safe to call multiple times.
 */
export function initialize() {
  if (db) return;

  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  applySchema(db);

  console.log(`[db] initialized at ${dbPath} (WAL mode)`);
}

/**
 * Get the active Database instance.
 * @returns {Database.Database}
 * @throws if initialize() hasn't been called
 */
export function getDb() {
  if (!db) {
    throw new Error("[db] Database not initialized — call initialize() first");
  }
  return db;
}

/**
 * Close the database connection. Safe to call even if not open.
 */
export function close() {
  if (db) {
    db.close();
    db = null;
    console.log("[db] closed");
  }
}

/**
 * Create a standalone Database instance for test isolation.
 * Opens the given path (or :memory: if omitted), enables WAL (for file DBs),
 * applies the schema, and returns the raw better-sqlite3 instance.
 *
 * The caller is responsible for closing it.
 *
 * @param {string} [path=":memory:"] — database file path or ":memory:"
 * @returns {Database.Database}
 */
export function getTestDb(path = ":memory:") {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const testDb = new Database(path);

  // WAL only applies to file-backed databases
  if (path !== ":memory:") {
    testDb.pragma("journal_mode = WAL");
  }
  testDb.pragma("foreign_keys = ON");

  applySchema(testDb);

  return testDb;
}
