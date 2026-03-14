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

export function createProject(input = {}) {
  if (!input.id) {
    throw new Error("Project requires an id");
  }

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
    waves: {
      current: waveCurrent,
      total: waveTotal,
    },
    agents,
    execution: createExecutionEngine(executionInput),
    meta: copyMeta(input.meta),
  };
}

export function createLumonState(input = {}) {
  const projects = (input.projects ?? []).map((project) => createProject(project));
  const defaultProjectId = projects[0]?.id ?? null;
  const selectedProjectId =
    projects.some((project) => project.id === input.selection?.projectId)
      ? input.selection.projectId
      : defaultProjectId;

  return {
    projects,
    selection: {
      projectId: selectedProjectId,
      agentId: input.selection?.agentId ?? null,
      stageId: input.selection?.stageId ?? null,
    },
    meta: copyMeta(input.meta),
  };
}
