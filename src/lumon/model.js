const VALID_ENGINE_CHOICES = new Set(["claude", "codex"]);

export const LUMON_APPROVAL_STATES = Object.freeze({
  notRequired: "not_required",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  needsIteration: "needs_iteration",
});

const APPROVAL_STATE_SET = new Set(Object.values(LUMON_APPROVAL_STATES));
const BLOCKING_APPROVAL_STATES = new Set([
  LUMON_APPROVAL_STATES.rejected,
  LUMON_APPROVAL_STATES.needsIteration,
]);
const RESOLVED_APPROVAL_STATES = new Set([
  LUMON_APPROVAL_STATES.notRequired,
  LUMON_APPROVAL_STATES.approved,
]);

export const LUMON_PREBUILD_STAGE_KEYS = Object.freeze({
  intake: "intake",
  research: "research",
  plan: "plan",
  verification: "verification",
  handoff: "handoff",
});

export const LUMON_DETAIL_STATES = Object.freeze({
  ready: "ready",
  waiting: "waiting",
  blocked: "blocked",
  missing: "missing",
});

export const LUMON_DOSSIER_SECTION_DEFINITIONS = Object.freeze({
  brief: Object.freeze({
    id: "dossier:brief",
    kind: "brief",
    label: "Working brief",
    description: "Thin working brief derived from canonical project metadata and current pipeline truth.",
  }),
  currentApproval: Object.freeze({
    id: "dossier:current-approval",
    kind: "current_approval",
    label: "Current approval",
    description: "Current gate truth for the selected project without implied approval history.",
  }),
  stage: Object.freeze({
    idPrefix: "dossier:stage:",
    kind: "stage_output",
    label: "Stage output",
    description: "Per-stage output and approval truth from the canonical pipeline.",
  }),
});

export const LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS = Object.freeze({
  architecture: Object.freeze({
    id: "handoff:architecture",
    kind: "artifact",
    label: "Architecture",
    description: "Architecture handoff section backed by canonical research and planning truth once a real artifact exists.",
  }),
  specification: Object.freeze({
    id: "handoff:specification",
    kind: "artifact",
    label: "Specs",
    description: "Build specs handoff section backed by the canonical plan once a real artifact exists.",
  }),
  prototype: Object.freeze({
    id: "handoff:prototype",
    kind: "artifact",
    label: "Prototype",
    description: "Prototype handoff section backed by execution and verification truth once a real artifact exists.",
  }),
  approval: Object.freeze({
    id: "handoff:approval",
    kind: "approval",
    label: "Approval state",
    description: "Current approval truth for the final handoff gate.",
  }),
});

export const buildLumonDossierStageSectionId = (stageKey) =>
  `${LUMON_DOSSIER_SECTION_DEFINITIONS.stage.idPrefix}${stageKey ?? "unknown"}`;

const PREBUILD_STAGE_BLUEPRINTS = Object.freeze({
  [LUMON_PREBUILD_STAGE_KEYS.intake]: Object.freeze({
    kind: "intake",
    label: "Intake",
    description: "Capture the operator brief and admit the mission into the canonical registry.",
    icon: "Inbox",
    gate: Object.freeze({
      id: "gate:intake-review",
      label: "Intake approval",
      owner: "operator",
      context: "operator-intake",
      required: true,
    }),
  }),
  [LUMON_PREBUILD_STAGE_KEYS.research]: Object.freeze({
    kind: "research",
    label: "Research",
    description: "Audit the opportunity, constraints, and surrounding code or market context.",
    icon: "Search",
    gate: Object.freeze({
      id: "gate:research-pass-through",
      label: "No approval required",
      owner: null,
      context: "research-pass-through",
      required: false,
    }),
  }),
  [LUMON_PREBUILD_STAGE_KEYS.plan]: Object.freeze({
    kind: "plan",
    label: "Plan",
    description: "Define the build approach, wave sequence, and delivery contract before execution.",
    icon: "FileText",
    gate: Object.freeze({
      id: "gate:plan-review",
      label: "Plan approval",
      owner: "operator",
      context: "plan-review",
      required: true,
    }),
  }),
  [LUMON_PREBUILD_STAGE_KEYS.verification]: Object.freeze({
    kind: "verification",
    label: "Verification",
    description: "Run the contract checks and confirm the project is ready for handoff.",
    icon: "CheckCircle2",
    gate: Object.freeze({
      id: "gate:verification-review",
      label: "Verification approval",
      owner: "operator",
      context: "verification-review",
      required: true,
    }),
  }),
  [LUMON_PREBUILD_STAGE_KEYS.handoff]: Object.freeze({
    kind: "handoff",
    label: "Handoff",
    description: "Approve the pre-build package and hand it to downstream build execution.",
    icon: "GitBranch",
    gate: Object.freeze({
      id: "gate:handoff-approval",
      label: "Handoff approval",
      owner: "operator",
      context: "handoff-approval",
      required: true,
    }),
  }),
});

const DEFAULT_PROJECT_PHASE_LABEL = "Phase 1 — Operator Intake";
const DEFAULT_PROJECT_DESCRIPTION = "Operator-created project awaiting mission assignment.";
const ENGINE_LABELS = {
  claude: "Claude Code",
  codex: "Codex CLI",
};

const clampProgress = (value) => {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const toInteger = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
};

const copyMeta = (meta) => (meta ? { ...meta } : {});

const uniqueStrings = (values = []) => [...new Set(values.filter((value) => typeof value === "string" && value))];

const createIsoTimestamp = (value, fallback) => {
  const source = typeof value === "string" && value ? value : fallback;
  const timestamp = Date.parse(source);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
};

const normalizeEngineChoice = (value) => (VALID_ENGINE_CHOICES.has(value) ? value : "claude");

const inferWaveTotal = (agents, explicitTotal) => {
  if (Number.isFinite(explicitTotal)) {
    return Math.max(1, Math.trunc(explicitTotal));
  }

  const maxWave = agents.reduce((highest, agent) => Math.max(highest, toInteger(agent.wave, 1)), 1);
  return Math.max(1, maxWave);
};

const inferWaveCurrentFromAgents = (agents, explicitCurrent, total) => {
  if (Number.isFinite(explicitCurrent)) {
    return Math.min(Math.max(1, Math.trunc(explicitCurrent)), total);
  }

  const activeWave = agents.reduce((highest, agent) => {
    if (["running", "failed", "complete"].includes(agent.status)) {
      return Math.max(highest, toInteger(agent.wave, 1));
    }

    return highest;
  }, 1);

  return Math.min(Math.max(1, activeWave), total);
};

const buildStageId = (projectId, stageKey) => (projectId && stageKey ? `${projectId}:${stageKey}` : stageKey ?? null);

/**
 * Returns true when output is a structured artifact reference
 * (an object with at least an `artifactId` string).
 */
export const isStructuredOutput = (output) =>
  output != null &&
  typeof output === "object" &&
  typeof output.artifactId === "string" &&
  output.artifactId.length > 0;

/**
 * Returns a display-ready string from either output format:
 * - string → returned as-is
 * - { artifactId, summary, type } → returns `summary` (falls back to artifactId)
 */
export const getOutputSummary = (output) => {
  if (isStructuredOutput(output)) {
    return output.summary || output.artifactId;
  }
  return typeof output === "string" ? output : "Pending";
};

const parseWaveNumber = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/wave[-:](\d+)/i) ?? value.match(/^wave-(\d+)$/i);
  return match ? Math.max(1, Number.parseInt(match[1], 10)) : null;
};

const isWaveStageKey = (stageKey) => typeof stageKey === "string" && /^wave-\d+$/.test(stageKey);

const getStageBlueprint = (stageKey) => {
  if (isWaveStageKey(stageKey)) {
    const waveNumber = parseWaveNumber(stageKey) ?? 1;

    return {
      kind: "wave",
      label: `Wave ${waveNumber}`,
      description: `Execute the scoped work for wave ${waveNumber}.`,
      icon: "Layers",
      gate: {
        id: "gate:wave-auto-advance",
        label: "Auto advance",
        owner: null,
        context: "wave-auto-advance",
        required: false,
      },
    };
  }

  return PREBUILD_STAGE_BLUEPRINTS[stageKey] ?? {
    kind: "stage",
    label: stageKey ?? "Stage",
    description: "Canonical pipeline stage",
    icon: "Workflow",
    gate: {
      id: "gate:not-required",
      label: "No approval required",
      owner: null,
      context: "generic-stage",
      required: false,
    },
  };
};

const resolveCanonicalStageKey = (input = {}) => {
  if (isWaveStageKey(input.stageKey)) {
    return input.stageKey;
  }

  const explicitStageKey = String(input.stageKey ?? "").trim().toLowerCase();
  if (PREBUILD_STAGE_BLUEPRINTS[explicitStageKey]) {
    return explicitStageKey;
  }

  const explicitKind = String(input.kind ?? "").trim().toLowerCase();
  if (explicitKind === "test") return LUMON_PREBUILD_STAGE_KEYS.verification;
  if (explicitKind === "merge") return LUMON_PREBUILD_STAGE_KEYS.handoff;
  if (explicitKind === "init") return LUMON_PREBUILD_STAGE_KEYS.intake;
  if (PREBUILD_STAGE_BLUEPRINTS[explicitKind]) return explicitKind;
  if (explicitKind === "wave") {
    const waveNumber = parseWaveNumber(input.id) ?? parseWaveNumber(input.label) ?? 1;
    return `wave-${waveNumber}`;
  }

  const candidates = [input.id, input.label].filter(Boolean).map((value) => String(value).toLowerCase());
  const waveCandidate = candidates.map(parseWaveNumber).find((value) => Number.isFinite(value));
  if (waveCandidate) {
    return `wave-${waveCandidate}`;
  }

  if (candidates.some((value) => value.includes("handoff") || value.includes("merge"))) {
    return LUMON_PREBUILD_STAGE_KEYS.handoff;
  }
  if (candidates.some((value) => value.includes("verification") || value.includes("test"))) {
    return LUMON_PREBUILD_STAGE_KEYS.verification;
  }
  if (candidates.some((value) => value.includes("plan"))) {
    return LUMON_PREBUILD_STAGE_KEYS.plan;
  }
  if (candidates.some((value) => value.includes("research"))) {
    return LUMON_PREBUILD_STAGE_KEYS.research;
  }
  if (candidates.some((value) => value.includes("intake") || value.includes("init"))) {
    return LUMON_PREBUILD_STAGE_KEYS.intake;
  }

  return explicitStageKey || input.id || null;
};

const summarizeStatuses = (items) =>
  items.reduce(
    (summary, item) => {
      const status = item?.status ?? "queued";
      summary[status] = (summary[status] ?? 0) + 1;
      return summary;
    },
    { running: 0, queued: 0, complete: 0, failed: 0 },
  );

const isApprovalRequired = (approval) => approval?.meta?.required === true;

export function normalizeApprovalState(value, options = {}) {
  const requiresApproval = options.requiresApproval ?? false;
  const stageStatus = options.stageStatus ?? "queued";
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/-/g, "_") : null;

  if (!requiresApproval) {
    return LUMON_APPROVAL_STATES.notRequired;
  }

  if (APPROVAL_STATE_SET.has(normalized)) {
    return normalized;
  }

  if (["waiting", "awaiting", "queued"].includes(normalized)) {
    return LUMON_APPROVAL_STATES.pending;
  }

  if (["ready", "approved", "complete", "completed"].includes(normalized)) {
    return LUMON_APPROVAL_STATES.approved;
  }

  if (["blocked", "rejected", "deny", "denied"].includes(normalized)) {
    return LUMON_APPROVAL_STATES.rejected;
  }

  if (["needs_iteration", "iteration_required", "rework", "changes_requested"].includes(normalized)) {
    return LUMON_APPROVAL_STATES.needsIteration;
  }

  return stageStatus === "complete"
    ? LUMON_APPROVAL_STATES.approved
    : LUMON_APPROVAL_STATES.pending;
}

export function createApprovalState(input = {}, options = {}) {
  const stageKey = options.stageKey ?? resolveCanonicalStageKey(options.stage ?? input);
  const stageBlueprint = getStageBlueprint(stageKey);
  const gate = options.gate ?? stageBlueprint.gate;
  const requiresApproval = gate.required === true;
  const state = normalizeApprovalState(input.state, {
    requiresApproval,
    stageStatus: options.stageStatus ?? "queued",
  });

  return {
    id: gate.id ?? input.id ?? "gate:not-required",
    label: input.label ?? gate.label ?? "No approval required",
    state,
    owner: input.owner ?? gate.owner ?? null,
    note: input.note ?? null,
    updatedAt: input.updatedAt ?? null,
    meta: {
      ...copyMeta(gate.meta),
      ...copyMeta(input.meta),
      required: requiresApproval,
      stageKey,
      context: input.meta?.context ?? gate.context ?? null,
      pendingOwner: input.meta?.pendingOwner ?? input.owner ?? gate.owner ?? null,
      legacyId: input.id && input.id !== gate.id ? input.id : null,
    },
  };
}

export function createAgentSummary(input = {}) {
  if (!input.id) {
    throw new Error("AgentSummary requires an id");
  }

  return {
    id: input.id,
    name: input.name ?? input.id,
    type: input.type ?? "claude",
    planId: input.planId ?? input.plan ?? "unassigned",
    task: input.task ?? "Unassigned task",
    wave: Math.max(1, toInteger(input.wave, 1)),
    status: input.status ?? "queued",
    tokens: Math.max(0, toInteger(input.tokens, 0)),
    costUsd: Number(input.costUsd ?? input.cost ?? 0),
    elapsedLabel: input.elapsedLabel ?? input.elapsed ?? "—",
    progress: clampProgress(input.progress),
    meta: copyMeta(input.meta),
  };
}

export function derivePipelineStageStatus(stage, agentsById = new Map()) {
  if (!stage.agentIds.length) {
    return stage.status;
  }

  const agents = stage.agentIds.map((agentId) => agentsById.get(agentId)).filter(Boolean);
  if (!agents.length) {
    return stage.status;
  }

  const counts = summarizeStatuses(agents);
  if (counts.failed > 0) return "failed";
  if (counts.running > 0) return "running";
  if (counts.queued > 0 && counts.complete > 0) return "running";
  if (counts.complete === agents.length) return "complete";
  if (counts.queued > 0) return "queued";
  return stage.status;
}

const createStageAliasIds = (inputId, canonicalId, meta = {}) =>
  uniqueStrings([
    ...uniqueStrings(meta.aliasIds),
    inputId && inputId !== canonicalId ? inputId : null,
  ]);

export function createPipelineStage(input = {}, options = {}) {
  const stageKey = resolveCanonicalStageKey(input);
  const stageBlueprint = getStageBlueprint(stageKey);
  const canonicalId = buildStageId(options.projectId, stageKey) ?? input.id;
  const status = input.status ?? "queued";
  const meta = copyMeta(input.meta);
  const aliasIds = createStageAliasIds(input.id, canonicalId, meta);

  return {
    id: canonicalId,
    stageKey,
    kind: input.kind ?? stageBlueprint.kind,
    label: input.label ?? stageBlueprint.label ?? canonicalId,
    description: input.description ?? input.desc ?? stageBlueprint.description ?? "",
    icon: input.icon ?? stageBlueprint.icon ?? "Workflow",
    status,
    durationLabel: input.durationLabel ?? input.duration ?? "—",
    output: isStructuredOutput(input.output) ? { ...input.output } : (input.output ?? "Pending"),
    agentIds: [...(input.agentIds ?? [])],
    approval: createApprovalState(input.approval, {
      stageKey,
      stageStatus: status,
      gate: stageBlueprint.gate,
    }),
    meta: {
      ...meta,
      aliasIds,
    },
  };
}

const isStageResolved = (stage) => {
  if (stage.status !== "complete") {
    return false;
  }

  if (!isApprovalRequired(stage.approval)) {
    return true;
  }

  return RESOLVED_APPROVAL_STATES.has(stage.approval.state);
};

const resolveCurrentStage = (stages) => {
  for (const stage of stages) {
    if (stage.status === "failed" || stage.status === "running") {
      return stage;
    }

    if (isApprovalRequired(stage.approval) && !RESOLVED_APPROVAL_STATES.has(stage.approval.state)) {
      return stage;
    }

    if (stage.status !== "complete") {
      return stage;
    }
  }

  return stages.at(-1) ?? null;
};

const derivePipelineStatus = (stages, currentStage) => {
  if (!stages.length) {
    return "queued";
  }

  if (stages.every(isStageResolved)) {
    return "complete";
  }

  if (!currentStage) {
    return "queued";
  }

  if (currentStage.status === "failed" || BLOCKING_APPROVAL_STATES.has(currentStage.approval.state)) {
    return "blocked";
  }

  if (
    currentStage.stageKey === LUMON_PREBUILD_STAGE_KEYS.handoff &&
    currentStage.status === "queued" &&
    currentStage.approval.state === LUMON_APPROVAL_STATES.pending
  ) {
    return "handoff_ready";
  }

  if (
    isApprovalRequired(currentStage.approval) &&
    currentStage.approval.state === LUMON_APPROVAL_STATES.pending
  ) {
    return "waiting";
  }

  if (currentStage.status === "running") {
    return "running";
  }

  return "queued";
};

const inferEngineStatus = (stages, currentStage, pipelineStatus) => {
  if (!stages.length) return "idle";
  if (pipelineStatus === "blocked") return currentStage?.status === "failed" ? "failed" : "queued";
  if (pipelineStatus === "running") return "running";
  if (pipelineStatus === "complete") return "complete";
  return currentStage?.status === "failed"
    ? "failed"
    : currentStage?.status === "running"
      ? "running"
      : "queued";
};

const deriveWaveCurrent = (stages, agents, explicitCurrent, total) => {
  const currentStage = resolveCurrentStage(stages);
  const activeWave = parseWaveNumber(currentStage?.stageKey);
  if (Number.isFinite(activeWave)) {
    return Math.min(Math.max(1, activeWave), total);
  }

  const completedWaves = stages
    .filter((stage) => isWaveStageKey(stage.stageKey) && stage.status === "complete")
    .map((stage) => parseWaveNumber(stage.stageKey))
    .filter(Number.isFinite);

  if (
    currentStage &&
    [LUMON_PREBUILD_STAGE_KEYS.verification, LUMON_PREBUILD_STAGE_KEYS.handoff].includes(currentStage.stageKey) &&
    completedWaves.length > 0
  ) {
    return Math.min(Math.max(...completedWaves), total);
  }

  return inferWaveCurrentFromAgents(agents, explicitCurrent, total);
};

export function createExecutionEngine(input = {}, options = {}) {
  const agentsById = new Map((options.agents ?? []).map((agent) => [agent.id, agent]));
  const stages = (input.stages ?? []).map((stage) => createPipelineStage(stage, { projectId: options.projectId }));
  const reconciledStages = stages.map((stage) => {
    const status = derivePipelineStageStatus(stage, agentsById);
    return status === stage.status
      ? stage
      : {
          ...stage,
          status,
          approval: createApprovalState(stage.approval, {
            stageKey: stage.stageKey,
            stageStatus: status,
          }),
        };
  });
  const currentStage = resolveCurrentStage(reconciledStages);
  const pipelineStatus = derivePipelineStatus(reconciledStages, currentStage);

  return {
    id: input.id ?? `engine:${options.projectId ?? "default"}`,
    label: input.label ?? "Mission Control Pipeline",
    status: inferEngineStatus(reconciledStages, currentStage, pipelineStatus),
    pipelineStatus,
    currentStageId: currentStage?.id ?? null,
    currentStageKey: currentStage?.stageKey ?? null,
    currentGateId: currentStage?.approval?.id ?? null,
    currentApprovalState: currentStage?.approval?.state ?? null,
    handoffReady: pipelineStatus === "handoff_ready",
    progressPercent: Math.round(
      (reconciledStages.filter((stage) => isStageResolved(stage)).length / Math.max(reconciledStages.length, 1)) * 100,
    ),
    stages: reconciledStages,
    meta: copyMeta(input.meta),
  };
}

export function createCanonicalProjectAgents(projectId, name, engineChoice, agentCount) {
  return Array.from({ length: agentCount }, (_, index) => {
    const ordinal = String(index + 1).padStart(2, "0");

    return {
      id: `${projectId}:agent-${ordinal}`,
      name: `${name} Agent ${ordinal}`,
      type: engineChoice,
      planId: `${projectId}-${ordinal}`,
      task: "Awaiting operator dispatch",
      wave: 1,
      status: "queued",
      progress: 0,
      tokens: 0,
      costUsd: 0,
      elapsedLabel: "—",
    };
  });
}

const resolveWaveCount = (agents, explicitWaveCount) =>
  Math.max(
    1,
    Number.isFinite(explicitWaveCount)
      ? Math.trunc(explicitWaveCount)
      : agents.reduce((highest, agent) => Math.max(highest, toInteger(agent.wave, 1)), 1),
  );

const buildWaveDescription = (waveNumber, waveAgents, engineLabel) => {
  if (!waveAgents.length) {
    return `Wave ${waveNumber} reserved for downstream planning.`;
  }

  if (waveAgents.length === 1) {
    return `${waveAgents[0].name} executes the scoped ${engineLabel} work for wave ${waveNumber}.`;
  }

  return `${waveAgents.length} ${engineLabel} agents execute the scoped work for wave ${waveNumber}.`;
};

const createStageInput = (projectId, stageKey, defaults, override = {}) => ({
  id: buildStageId(projectId, stageKey),
  stageKey,
  kind: defaults.kind,
  label: defaults.label,
  description: defaults.description,
  icon: defaults.icon,
  status: defaults.status,
  durationLabel: defaults.durationLabel,
  output: defaults.output,
  agentIds: defaults.agentIds,
  ...override,
  approval: {
    ...(defaults.approval ?? {}),
    ...(override.approval ?? {}),
  },
  meta: {
    ...copyMeta(defaults.meta),
    ...copyMeta(override.meta),
    aliasIds: uniqueStrings([
      ...uniqueStrings(defaults.meta?.aliasIds),
      ...uniqueStrings(override.meta?.aliasIds),
      ...uniqueStrings(override.aliasIds),
    ]),
  },
});

export function createCanonicalPrebuildStages({
  projectId,
  projectName,
  engineChoice = "claude",
  agents = [],
  waveCount,
  stageOverrides = {},
} = {}) {
  const engineLabel = ENGINE_LABELS[normalizeEngineChoice(engineChoice)] ?? ENGINE_LABELS.claude;
  const totalWaves = resolveWaveCount(agents, waveCount);

  const stages = [
    createStageInput(projectId, LUMON_PREBUILD_STAGE_KEYS.intake, {
      kind: "intake",
      label: "Intake",
      description: `Admit ${projectName ?? "this project"} into the canonical registry and confirm the operator brief.`,
      icon: "Inbox",
      status: "queued",
      durationLabel: "—",
      output: "Awaiting operator intake approval",
    }, stageOverrides[LUMON_PREBUILD_STAGE_KEYS.intake]),
    createStageInput(projectId, LUMON_PREBUILD_STAGE_KEYS.research, {
      kind: "research",
      label: "Research",
      description: `${engineLabel} intake staged for canonical registry review.`,
      icon: "Search",
      status: "queued",
      durationLabel: "—",
      output: "Pending research kickoff",
    }, stageOverrides[LUMON_PREBUILD_STAGE_KEYS.research]),
    createStageInput(projectId, LUMON_PREBUILD_STAGE_KEYS.plan, {
      kind: "plan",
      label: "Plan",
      description: `Define the first execution wave for ${totalWaves} wave${totalWaves === 1 ? "" : "s"}.`,
      icon: "FileText",
      status: "queued",
      durationLabel: "—",
      output: "Pending stage design",
    }, stageOverrides[LUMON_PREBUILD_STAGE_KEYS.plan]),
  ];

  for (let waveNumber = 1; waveNumber <= totalWaves; waveNumber += 1) {
    const stageKey = `wave-${waveNumber}`;
    const waveAgents = agents.filter((agent) => agent.wave === waveNumber);
    stages.push(
      createStageInput(projectId, stageKey, {
        kind: "wave",
        label: `Wave ${waveNumber}`,
        description: buildWaveDescription(waveNumber, waveAgents, engineLabel),
        icon: "Layers",
        status: "queued",
        durationLabel: waveAgents[0]?.elapsedLabel ?? waveAgents[0]?.elapsed ?? "—",
        output: waveAgents.length > 0 ? "Awaiting operator dispatch" : "Wave reserved for downstream planning",
        agentIds: waveAgents.map((agent) => agent.id),
      }, stageOverrides[stageKey]),
    );
  }

  stages.push(
    createStageInput(projectId, LUMON_PREBUILD_STAGE_KEYS.verification, {
      kind: "verification",
      label: "Verification",
      description: "Run verification before operator handoff.",
      icon: "CheckCircle2",
      status: "queued",
      durationLabel: "—",
      output: "Pending verification",
    }, stageOverrides[LUMON_PREBUILD_STAGE_KEYS.verification]),
    createStageInput(projectId, LUMON_PREBUILD_STAGE_KEYS.handoff, {
      kind: "handoff",
      label: "Handoff",
      description: "Operator approval and release handoff.",
      icon: "GitBranch",
      status: "queued",
      durationLabel: "—",
      output: "Pending handoff",
    }, stageOverrides[LUMON_PREBUILD_STAGE_KEYS.handoff]),
  );

  return stages;
}

const deriveFallbackExecutionInput = (projectInput, agents, waveTotal) => ({
  id: `engine:${projectInput.id}`,
  label: `${projectInput.name ?? projectInput.id} pipeline`,
  stages: createCanonicalPrebuildStages({
    projectId: projectInput.id,
    projectName: projectInput.name ?? projectInput.id,
    engineChoice: projectInput.engineChoice,
    agents,
    waveCount: waveTotal,
  }),
});

export function createProjectSpawnInput(draft, existingProjects = []) {
  const projectId = createProjectId(
    draft?.name,
    existingProjects.map((project) => project.id),
  );
  const engineChoice = normalizeEngineChoice(draft?.engineChoice);
  const agents = createCanonicalProjectAgents(
    projectId,
    draft?.name ?? projectId,
    engineChoice,
    Math.max(1, toInteger(draft?.agentCount, 2)),
  );

  return {
    id: projectId,
    name: draft?.name ?? projectId,
    description:
      draft?.description || `${ENGINE_LABELS[engineChoice] ?? ENGINE_LABELS.claude} project registry entry created from Mission Control.`,
    phaseLabel: DEFAULT_PROJECT_PHASE_LABEL,
    engineChoice,
    waves: {
      current: 1,
      total: 1,
    },
    agents,
    execution: {
      id: `engine:${projectId}`,
      label: `${draft?.name ?? projectId} pipeline`,
      stages: createCanonicalPrebuildStages({
        projectId,
        projectName: draft?.name ?? projectId,
        engineChoice,
        agents,
        waveCount: 1,
      }),
    },
    meta: {
      source: "mission-control-shell",
      createdFrom: "new-project-modal",
      defaultDescription: draft?.description ? null : DEFAULT_PROJECT_DESCRIPTION,
    },
  };
}

export function createProject(input = {}, options = {}) {
  if (!input.id) {
    throw new Error("Project requires an id");
  }

  const now = createIsoTimestamp(options.now ?? new Date().toISOString(), new Date().toISOString());
  const createdAt = createIsoTimestamp(input.createdAt, now);
  const updatedAt = createIsoTimestamp(input.updatedAt, createdAt);
  const agents = (input.agents ?? []).map((agent) => createAgentSummary(agent));
  const waveTotal = inferWaveTotal(agents, input.waves?.total);
  const executionInput = input.execution?.stages?.length
    ? {
        id: input.execution.id ?? `engine:${input.id}`,
        label: input.execution.label ?? `${input.name ?? input.id} pipeline`,
        ...input.execution,
      }
    : deriveFallbackExecutionInput(input, agents, waveTotal);
  const execution = createExecutionEngine(executionInput, {
    projectId: input.id,
    agents,
  });

  return {
    id: input.id,
    name: input.name ?? input.id,
    description: input.description ?? input.desc ?? "",
    phaseLabel: input.phaseLabel ?? input.phase ?? DEFAULT_PROJECT_PHASE_LABEL,
    engineChoice: normalizeEngineChoice(input.engineChoice),
    createdAt,
    updatedAt,
    waves: {
      current: deriveWaveCurrent(execution.stages, agents, input.waves?.current, waveTotal),
      total: waveTotal,
    },
    agents,
    execution,
    meta: copyMeta(input.meta),
  };
}

const buildSelectionIndex = (projects) => {
  const projectsById = new Map();
  const projectIdByAgentId = new Map();
  const stageSelectionIndex = new Map();

  projects.forEach((project) => {
    projectsById.set(project.id, project);
    project.agents.forEach((agent) => {
      projectIdByAgentId.set(agent.id, project.id);
    });
    project.execution.stages.forEach((stage) => {
      [stage.id, ...(stage.meta?.aliasIds ?? [])].forEach((selectionId) => {
        if (!selectionId) {
          return;
        }

        stageSelectionIndex.set(selectionId, {
          projectId: project.id,
          stageId: stage.id,
        });
      });
    });
  });

  return {
    projectsById,
    projectIdByAgentId,
    stageSelectionIndex,
  };
};

const slugifyProjectId = (value) => {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
};

export function createProjectId(value, existingIds = []) {
  const baseId = slugifyProjectId(value);
  const usedIds = new Set(existingIds.filter(Boolean));

  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

export function reconcileSelection(projects, selection = {}, options = {}) {
  const defaultProjectId = options.defaultProjectId ?? projects[0]?.id ?? null;
  const { projectsById, projectIdByAgentId, stageSelectionIndex } = buildSelectionIndex(projects);

  const requestedProjectId = selection?.projectId ?? null;
  const requestedAgentId = selection?.agentId ?? null;
  const requestedStageId = selection?.stageId ?? null;
  const stageMatch = requestedStageId ? stageSelectionIndex.get(requestedStageId) ?? null : null;

  const selectedProjectId =
    (requestedProjectId && projectsById.has(requestedProjectId) ? requestedProjectId : null) ??
    projectIdByAgentId.get(requestedAgentId) ??
    stageMatch?.projectId ??
    defaultProjectId;

  const project = selectedProjectId ? projectsById.get(selectedProjectId) ?? null : null;
  const agentProjectId = requestedAgentId ? projectIdByAgentId.get(requestedAgentId) ?? null : null;

  return {
    projectId: project?.id ?? null,
    agentId: project && agentProjectId === project.id ? requestedAgentId : null,
    stageId: project && stageMatch?.projectId === project.id ? stageMatch.stageId : null,
  };
}

export function createLumonState(input = {}, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const projects = (input.projects ?? []).map((project) => createProject(project, { now }));

  return {
    projects,
    selection: reconcileSelection(projects, input.selection, {
      defaultProjectId: options.defaultProjectId,
    }),
    meta: copyMeta(input.meta),
  };
}
