import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let DATA_DIR = path.join(__dirname, "data");

// Ensure data directory exists on module load
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Override the data directory. Used by tests to isolate artifact storage.
 * @param {string} dir
 */
export function setDataDir(dir) {
  DATA_DIR = dir;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function artifactPath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

/**
 * Create and persist a new artifact.
 * @param {{ projectId: string, stageKey: string, type: string, content: any, metadata?: object }} params
 * @returns {{ id: string, projectId: string, stageKey: string, type: string, content: any, metadata: object, createdAt: string }}
 */
export function create({ projectId, stageKey, type, content, metadata = {} }) {
  const artifact = {
    id: randomUUID(),
    projectId,
    stageKey,
    type,
    content,
    metadata,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(artifactPath(artifact.id), JSON.stringify(artifact, null, 2));
  return artifact;
}

/**
 * Get a single artifact by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function get(id) {
  const filePath = artifactPath(id);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Get all artifacts for a project.
 * @param {string} projectId
 * @returns {object[]}
 */
export function getByProject(projectId) {
  return list().filter((a) => a.projectId === projectId);
}

/**
 * Get all artifacts for a project + stage combination.
 * @param {string} projectId
 * @param {string} stageKey
 * @returns {object[]}
 */
export function getByProjectAndStage(projectId, stageKey) {
  return list().filter((a) => a.projectId === projectId && a.stageKey === stageKey);
}

/**
 * List all stored artifacts.
 * @returns {object[]}
 */
export function list() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")));
}

/**
 * Remove all artifacts from disk. Used for test cleanup.
 */
export function clear() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, f));
    } catch (err) {
      // Tolerate ENOENT — file may have been removed by a parallel test
      if (err.code !== "ENOENT") throw err;
    }
  }
}
