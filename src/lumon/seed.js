import { createLumonState } from "./model";

/**
 * Seed state — empty registry. Projects are created through the UI.
 * The floor layout is preserved for the Severance visualization.
 */

export const lumonProjectSeed = [];
export const lumonSeedSource = "empty";

export const lumonFloorLayoutSeed = Object.freeze({
  label: "severance-floor-v1",
  departments: [
    "Macrodata Refinement",
    "Optics & Design",
    "Disposal & Reclamation",
    "Expansion",
    "Integration",
  ],
  departmentAnchors: [
    { x: 80, y: 100 },
    { x: 440, y: 80 },
    { x: 820, y: 130 },
    { x: 180, y: 400 },
    { x: 580, y: 360 },
    { x: 980, y: 320 },
    { x: 60, y: 680 },
    { x: 460, y: 640 },
    { x: 860, y: 700 },
    { x: 300, y: 940 },
    { x: 720, y: 900 },
    { x: 1100, y: 960 },
  ],
  cubiclePositions: [
    { x: 140, y: 200 },
    { x: 420, y: 160 },
    { x: 700, y: 220 },
    { x: 260, y: 460 },
    { x: 560, y: 420 },
    { x: 860, y: 480 },
    { x: 180, y: 720 },
    { x: 480, y: 680 },
    { x: 860, y: 700 },
    { x: 300, y: 940 },
    { x: 720, y: 900 },
    { x: 1100, y: 960 },
    { x: 120, y: 1200 },
    { x: 540, y: 1160 },
    { x: 920, y: 1220 },
    { x: 320, y: 1460 },
    { x: 740, y: 1420 },
    { x: 1140, y: 1480 },
    { x: 180, y: 1700 },
    { x: 600, y: 1660 },
  ],
  departmentBandHeight: 1800,
  amenityRooms: {
    cafeteria: { x: 1220, y: 140, w: 300, h: 160 },
    breakroom: { x: 1240, y: 680, w: 260, h: 150 },
    vending: { x: 1200, y: 440, w: 180, h: 130 },
  },
  bossOrbit: {
    centerX: 0.58,
    centerY: 0.42,
    amplitudeX: 0.31,
    amplitudeY: 0.28,
    horizontalDivisor: 12,
    verticalDivisor: 19,
  },
});

export function createSeedLumonState(overrides = {}) {
  return createLumonState({
    projects: overrides.projects ?? [],
    selection: {
      projectId: overrides.selection?.projectId ?? null,
      agentId: overrides.selection?.agentId ?? null,
      stageId: overrides.selection?.stageId ?? null,
    },
    meta: {
      seedLabel: lumonSeedSource,
      ...overrides.meta,
    },
  });
}
