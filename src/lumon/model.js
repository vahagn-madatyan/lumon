const VALID_ENGINE_CHOICES = new Set(["claude", "codex"]);

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

const inferWaveCurrent = (agents, explicitCurrent, total) => {
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

const inferEngineStatus = (stages) => {
  if (!stages.length) return "idle";
  if (stages.some((stage) => stage.status === "failed")) return "failed";
  if (stages.some((stage) => stage.status === "running")) return "running";
  if (stages.every((stage) => stage.status === "complete")) return "complete";
  if (stages.some((stage) => stage.status === "queued")) return "queued";
  return "idle";
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

const buildSelectionIndex = (projects) => {
  const projectsById = new Map();
  const projectIdByAgentId = new Map();
  const projectIdByStageId = new Map();

  projects.forEach((project) => {
    projectsById.set(project.id, project);
    project.agents.forEach((agent) => {
      projectIdByAgentId.set(agent.id, project.id);
    });
    project.execution.stages.forEach((stage) => {
      projectIdByStageId.set(stage.id, project.id);
    });
  });

  return {
    projectsById,
    projectIdByAgentId,
    projectIdByStageId,
  };
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
  const { projectsById, projectIdByAgentId, projectIdByStageId } = buildSelectionIndex(projects);

  const requestedProjectId = selection?.projectId ?? null;
  const requestedAgentId = selection?.agentId ?? null;
  const requestedStageId = selection?.stageId ?? null;

  const selectedProjectId =
    (requestedProjectId && projectsById.has(requestedProjectId) ? requestedProjectId : null) ??
    projectIdByAgentId.get(requestedAgentId) ??
    projectIdByStageId.get(requestedStageId) ??
    defaultProjectId;

  const project = selectedProjectId ? projectsById.get(selectedProjectId) ?? null : null;
  const agentProjectId = requestedAgentId ? projectIdByAgentId.get(requestedAgentId) ?? null : null;
  const stageProjectId = requestedStageId ? projectIdByStageId.get(requestedStageId) ?? null : null;

  return {
    projectId: project?.id ?? null,
    agentId: project && agentProjectId === project.id ? requestedAgentId : null,
    stageId: project && stageProjectId === project.id ? requestedStageId : null,
  };
}

export function createApprovalState(input = {}) {
  return {
    id: input.id ?? "approval:not-required",
    label: input.label ?? "No approval required",
    state: input.state ?? "not_required",
    owner: input.owner ?? null,
    note: input.note ?? null,
    updatedAt: input.updatedAt ?? null,
    meta: copyMeta(input.meta),
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

export function createPipelineStage(input = {}) {
  if (!input.id) {
    throw new Error("PipelineStage requires an id");
  }

  return {
    id: input.id,
    kind: input.kind ?? "stage",
    label: input.label ?? input.id,
    description: input.description ?? input.desc ?? "",
    icon: input.icon ?? "Workflow",
    status: input.status ?? "queued",
    durationLabel: input.durationLabel ?? input.duration ?? "—",
    output: input.output ?? "Pending",
    agentIds: [...(input.agentIds ?? [])],
    approval: createApprovalState(input.approval),
    meta: copyMeta(input.meta),
  };
}

export function createExecutionEngine(input = {}) {
  const stages = (input.stages ?? []).map((stage) => createPipelineStage(stage));
  const currentStageId =
    input.currentStageId ??
    stages.find((stage) => stage.status === "failed" || stage.status === "running")?.id ??
    stages.find((stage) => stage.status !== "complete")?.id ??
    stages[0]?.id ??
    null;

  return {
    id: input.id ?? "engine:default",
    label: input.label ?? "Mission Control Pipeline",
    status: input.status ?? inferEngineStatus(stages),
    currentStageId,
    stages,
    meta: copyMeta(input.meta),
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
  const waveCurrent = inferWaveCurrent(agents, input.waves?.current, waveTotal);
  const executionInput = input.execution
    ? {
        id: input.execution.id ?? `engine:${input.id}`,
        label: input.execution.label ?? `${input.name ?? input.id} pipeline`,
        ...input.execution,
      }
    : {
        id: `engine:${input.id}`,
        label: `${input.name ?? input.id} pipeline`,
        stages: [],
      };

  return {
    id: input.id,
    name: input.name ?? input.id,
    description: input.description ?? input.desc ?? "",
    phaseLabel: input.phaseLabel ?? input.phase ?? "",
    engineChoice: normalizeEngineChoice(input.engineChoice),
    createdAt,
    updatedAt,
    waves: {
      current: waveCurrent,
      total: waveTotal,
    },
    agents,
    execution: createExecutionEngine(executionInput),
    meta: copyMeta(input.meta),
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
