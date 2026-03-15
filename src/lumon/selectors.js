import { LUMON_APPROVAL_STATES } from "./model";
import { lumonFloorLayoutSeed } from "./seed";

const formatCurrency = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const formatTokenThousands = (value) => `${Math.round(Number(value ?? 0) / 1000)}k`;
const FLOOR_AMENITY_ROOM_IDS = ["cafeteria", "vending"];
const RESOLVED_APPROVAL_STATES = new Set([
  LUMON_APPROVAL_STATES.notRequired,
  LUMON_APPROVAL_STATES.approved,
]);

const APPROVAL_STATE_META = {
  [LUMON_APPROVAL_STATES.notRequired]: {
    label: "Auto advance",
    summary: "No operator approval required",
    tone: "queued",
  },
  [LUMON_APPROVAL_STATES.pending]: {
    label: "Pending approval",
    summary: "Awaiting operator sign-off",
    tone: "waiting",
  },
  [LUMON_APPROVAL_STATES.approved]: {
    label: "Approved",
    summary: "Approval granted",
    tone: "complete",
  },
  [LUMON_APPROVAL_STATES.rejected]: {
    label: "Rejected",
    summary: "Approval rejected",
    tone: "blocked",
  },
  [LUMON_APPROVAL_STATES.needsIteration]: {
    label: "Needs iteration",
    summary: "Changes requested before retry",
    tone: "blocked",
  },
};

const PIPELINE_STATUS_META = {
  idle: { label: "Idle", summary: "No pipeline selected", tone: "queued" },
  queued: { label: "Queued", summary: "Queued for the next stage", tone: "queued" },
  running: { label: "Running", summary: "Stage execution is active", tone: "running" },
  waiting: { label: "Waiting", summary: "Waiting for operator approval", tone: "waiting" },
  blocked: { label: "Blocked", summary: "Blocked until the requested changes land", tone: "blocked" },
  handoff_ready: { label: "Handoff ready", summary: "Ready for final handoff approval", tone: "handoff_ready" },
  complete: { label: "Complete", summary: "Pipeline approved through handoff", tone: "complete" },
};

const resolveEngineLabel = (engineChoice) => (engineChoice === "codex" ? "Codex CLI" : "Claude Code");

const stableHash = (value) => {
  let hash = 2166136261;
  const input = String(value ?? "");

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const toTitleCase = (value) =>
  String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const isApprovalRequired = (approval) => approval?.meta?.required === true;

const buildIndex = (state) => {
  const agentsById = new Map();

  state.projects.forEach((project) => {
    project.agents.forEach((agent) => {
      agentsById.set(agent.id, { ...agent, projectId: project.id, projectName: project.name });
    });
  });

  return { agentsById };
};

const summarizeStatuses = (items, getter = (item) => item.status) =>
  items.reduce(
    (summary, item) => {
      const status = getter(item);
      summary[status] = (summary[status] ?? 0) + 1;
      return summary;
    },
    { running: 0, queued: 0, complete: 0, failed: 0 },
  );

const resolveAmenityRoomId = (agentId) => FLOOR_AMENITY_ROOM_IDS[stableHash(agentId) % FLOOR_AMENITY_ROOM_IDS.length];

const buildFloorRoomSize = (agents) => {
  const deskCount = agents.filter((agent) => agent.status === "running").length;
  const cols = Math.min(Math.max(deskCount, 1), 4);
  const rows = Math.max(1, Math.ceil(deskCount / Math.max(cols, 1)));

  return {
    width: Math.max(cols * 76 + 40, 200),
    height: Math.max(rows * 90 + 60, 140),
  };
};

export const selectAllAgents = (state) =>
  state.projects.flatMap((project) =>
    project.agents.map((agent) => ({
      ...agent,
      projectId: project.id,
      projectName: project.name,
      phaseLabel: project.phaseLabel,
      waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
    })),
  );

export const selectSelectedProject = (state) =>
  state.projects.find((project) => project.id === state.selection.projectId) ?? state.projects[0] ?? null;

export const selectSelectedAgent = (state) => {
  if (!state.selection.agentId) {
    return null;
  }

  return selectAllAgents(state).find((agent) => agent.id === state.selection.agentId) ?? null;
};

export const selectProjectStatus = (project) => {
  if (!project?.agents?.length) return "queued";
  if (project.agents.some((agent) => agent.status === "failed")) return "failed";
  if (project.agents.some((agent) => agent.status === "running")) return "running";
  if (project.agents.every((agent) => agent.status === "complete")) return "complete";
  if (project.agents.some((agent) => agent.status === "complete" || agent.status === "queued")) return "queued";
  return "queued";
};

const deriveStageStatus = (stage, agentsById) => {
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
};

const deriveStageProgress = (stage, agentsById) => {
  if (!stage.agentIds.length) {
    if (stage.status === "complete") return 100;
    if (stage.status === "running") return 50;
    return 0;
  }

  const agents = stage.agentIds.map((agentId) => agentsById.get(agentId)).filter(Boolean);
  if (!agents.length) return 0;
  const total = agents.reduce((sum, agent) => sum + Number(agent.progress ?? 0), 0);
  return Math.round(total / agents.length);
};

const buildAgentViewModel = (agent, selection) => ({
  id: agent.id,
  name: agent.name,
  type: agent.type,
  modelLabel: agent.type === "claude" ? "Claude Code" : "Codex CLI",
  planId: agent.planId,
  task: agent.task,
  wave: agent.wave,
  status: agent.status,
  progress: agent.progress,
  tokens: agent.tokens,
  tokensLabel: agent.tokens > 0 ? `${(agent.tokens / 1000).toFixed(1)}k` : "—",
  costUsd: agent.costUsd,
  costLabel: agent.costUsd > 0 ? formatCurrency(agent.costUsd) : "—",
  elapsedLabel: agent.elapsedLabel,
  projectId: agent.projectId,
  projectName: agent.projectName,
  phaseLabel: agent.phaseLabel,
  waveLabel: agent.waveLabel,
  isSelected: selection.agentId === agent.id,
});

const buildApprovalViewModel = (approval) => {
  const required = isApprovalRequired(approval);
  const state = approval?.state ?? (required ? LUMON_APPROVAL_STATES.pending : LUMON_APPROVAL_STATES.notRequired);
  const meta = APPROVAL_STATE_META[state] ?? APPROVAL_STATE_META[LUMON_APPROVAL_STATES.pending];
  const owner = approval?.meta?.pendingOwner ?? approval?.owner ?? null;
  const ownerLabel = owner ? toTitleCase(owner) : null;
  const note = approval?.note ?? null;

  let summary = meta.summary;
  if (required && state === LUMON_APPROVAL_STATES.pending && ownerLabel) {
    summary = `Awaiting ${ownerLabel} approval`;
  }
  if (required && state === LUMON_APPROVAL_STATES.approved && ownerLabel) {
    summary = `${ownerLabel} approved this gate`;
  }
  if (required && state === LUMON_APPROVAL_STATES.rejected && ownerLabel) {
    summary = `${ownerLabel} rejected this gate`;
  }
  if (required && state === LUMON_APPROVAL_STATES.needsIteration && ownerLabel) {
    summary = `${ownerLabel} requested iteration before retry`;
  }

  return {
    id: approval?.id ?? null,
    label: approval?.label ?? "No approval required",
    state,
    stateLabel: meta.label,
    summary,
    tone: meta.tone,
    required,
    owner,
    ownerLabel,
    note,
    context: approval?.meta?.context ?? null,
    pendingOwner: approval?.meta?.pendingOwner ?? approval?.owner ?? null,
  };
};

const resolveStagePresentationState = ({ stageStatus, isCurrent, pipelineStatus, approvalState }) => {
  if (stageStatus === "failed") return "failed";
  if (!isCurrent) return stageStatus;
  if (pipelineStatus === "blocked") {
    return approvalState === LUMON_APPROVAL_STATES.needsIteration ? "needs_iteration" : "blocked";
  }
  if (pipelineStatus === "waiting") return "waiting";
  if (pipelineStatus === "handoff_ready") return "handoff_ready";
  return stageStatus;
};

const buildPipelineStatusSummary = (pipelineStatus, currentStage, currentGate) => {
  const fallback = PIPELINE_STATUS_META[pipelineStatus]?.summary ?? "Pipeline state unavailable";

  if (!currentStage) {
    return fallback;
  }

  if (pipelineStatus === "waiting") {
    return `${currentStage.label} is waiting on ${currentGate?.label ?? "approval"}`;
  }

  if (pipelineStatus === "blocked") {
    if (currentGate?.state === LUMON_APPROVAL_STATES.needsIteration) {
      return `${currentStage.label} needs another iteration before it can advance`;
    }

    if (currentStage.status === "failed") {
      return `${currentStage.label} failed and needs operator intervention`;
    }

    return `${currentStage.label} is blocked at ${currentGate?.label ?? "its current gate"}`;
  }

  if (pipelineStatus === "handoff_ready") {
    return `${currentStage.label} is ready for final handoff approval`;
  }

  if (pipelineStatus === "running") {
    return `${currentStage.label} is actively executing`;
  }

  if (pipelineStatus === "complete") {
    return `${currentStage.label} cleared the final approval gate`;
  }

  if (pipelineStatus === "queued") {
    return `${currentStage.label} is queued for execution`;
  }

  return fallback;
};

const buildProjectViewModel = (project, selection, agentsById) => {
  const agents = project.agents.map((agent) =>
    buildAgentViewModel(
      {
        ...agent,
        projectId: project.id,
        projectName: project.name,
        phaseLabel: project.phaseLabel,
        waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
      },
      selection,
    ),
  );
  const metrics = summarizeStatuses(project.agents);
  const pipelineStatus = project.execution.pipelineStatus ?? "queued";

  const stages = project.execution.stages.map((stage) => {
    const status = deriveStageStatus(stage, agentsById);
    const progress = deriveStageProgress(stage, agentsById);
    const stageAgents = stage.agentIds
      .map((agentId) => agentsById.get(agentId))
      .filter(Boolean)
      .map((agent) => buildAgentViewModel(agent, selection));
    const approval = buildApprovalViewModel(stage.approval);
    const isCurrent = stage.id === project.execution.currentStageId;
    const presentationState = resolveStagePresentationState({
      stageStatus: status,
      isCurrent,
      pipelineStatus,
      approvalState: approval.state,
    });

    return {
      id: stage.id,
      stageKey: stage.stageKey,
      kind: stage.kind,
      label: stage.label,
      description: stage.description,
      icon: stage.icon,
      durationLabel: stage.durationLabel,
      output: stage.output,
      status,
      progress,
      stateTone: presentationState,
      approval,
      agentIds: [...stage.agentIds],
      agents: stageAgents,
      isCurrent,
      isSelected: selection.stageId === stage.id,
      isResolved: status === "complete" && (!approval.required || RESOLVED_APPROVAL_STATES.has(approval.state)),
    };
  });

  const currentStage =
    stages.find((stage) => stage.id === project.execution.currentStageId) ??
    stages.find((stage) => stage.isCurrent) ??
    stages.find((stage) => stage.status === "failed" || stage.status === "running") ??
    stages.find((stage) => !stage.isResolved) ??
    null;
  const selectedStage = stages.find((stage) => stage.id === selection.stageId) ?? null;
  const currentGate = currentStage?.approval ?? buildApprovalViewModel();
  const pipelineMeta = PIPELINE_STATUS_META[pipelineStatus] ?? PIPELINE_STATUS_META.queued;
  const completedCount = stages.filter((stage) => stage.isResolved).length;
  const totalCount = stages.length;

  const pipeline = {
    status: pipelineStatus,
    label: pipelineMeta.label,
    tone: pipelineMeta.tone,
    summary: buildPipelineStatusSummary(pipelineStatus, currentStage, currentGate),
    progressPercent: project.execution.progressPercent ?? Math.round((completedCount / Math.max(totalCount, 1)) * 100),
    completedCount,
    totalCount,
    handoffReady: project.execution.handoffReady === true,
    currentStageId: currentStage?.id ?? null,
    currentStageLabel: currentStage?.label ?? "—",
    currentGateId: currentGate.id,
    currentGateLabel: currentGate.label,
    currentApprovalState: currentGate.state,
    currentApprovalLabel: currentGate.stateLabel,
    currentApprovalSummary: currentGate.summary,
    waiting: pipelineStatus === "waiting",
    blocked: pipelineStatus === "blocked",
    readyForHandoff: pipelineStatus === "handoff_ready",
    complete: pipelineStatus === "complete",
    timeline: stages,
  };

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    phaseLabel: project.phaseLabel,
    engineChoice: project.engineChoice,
    engineLabel: resolveEngineLabel(project.engineChoice),
    waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
    status: selectProjectStatus(project),
    metrics,
    agentCount: project.agents.length,
    isSelected: selection.projectId === project.id,
    agents,
    executionStatus: project.execution.status,
    pipeline,
    currentStage,
    selectedStage,
    currentGate,
    handoffReady: pipeline.handoffReady,
    pipelineStatus: pipeline.status,
    pipelineStatusLabel: pipeline.label,
    pipelineSummary: pipeline.summary,
    stageTimeline: stages,
  };
};

export const selectFleetMetrics = (state) => {
  const agents = selectAllAgents(state);
  const statusBreakdown = summarizeStatuses(agents);
  const totalCostUsd = Number(agents.reduce((sum, agent) => sum + agent.costUsd, 0).toFixed(2));
  const totalTokens = agents.reduce((sum, agent) => sum + agent.tokens, 0);

  return {
    active: statusBreakdown.running,
    total: agents.length,
    running: statusBreakdown.running,
    queued: statusBreakdown.queued,
    complete: statusBreakdown.complete,
    failed: statusBreakdown.failed,
    totalCostUsd,
    totalTokens,
    totalCostLabel: formatCurrency(totalCostUsd),
    totalTokensLabel: formatTokenThousands(totalTokens),
    statusBreakdown,
  };
};

export const selectDashboardCards = (state) => {
  const metrics = selectFleetMetrics(state);

  return [
    { id: "active", label: "Active", value: String(metrics.active), tone: "success" },
    { id: "total", label: "Total", value: String(metrics.total), tone: "info" },
    { id: "cost", label: "Cost", value: metrics.totalCostLabel, tone: "warning" },
    { id: "tokens", label: "Tokens", value: metrics.totalTokensLabel, tone: "accent" },
  ];
};

export const selectDashboardProjects = (state) => {
  const { agentsById } = buildIndex(state);
  return state.projects.map((project) => buildProjectViewModel(project, state.selection, agentsById));
};

export const selectSelectedProjectDetail = (state) => {
  const project = selectSelectedProject(state);
  if (!project) return null;

  const { agentsById } = buildIndex(state);
  return buildProjectViewModel(project, state.selection, agentsById);
};

export const selectSelectedAgentDetail = (state) => {
  const agent = selectSelectedAgent(state);
  if (!agent) return null;
  return buildAgentViewModel(agent, state.selection);
};

export const selectFloorAgents = (state) => {
  const projectStatusById = new Map(
    state.projects.map((project) => [
      project.id,
      {
        status: selectProjectStatus(project),
        metrics: summarizeStatuses(project.agents),
      },
    ]),
  );

  return selectAllAgents(state).map((agent) => {
    const projectState = projectStatusById.get(agent.projectId);
    const location =
      agent.status === "failed"
        ? "break-room"
        : agent.status === "running"
          ? "department"
          : "amenity";

    return {
      ...buildAgentViewModel(agent, state.selection),
      departmentLabel: agent.projectName,
      location,
      amenityRoomId: location === "amenity" ? resolveAmenityRoomId(agent.id) : null,
      projectStatus: projectState?.status ?? "queued",
      projectMetrics: projectState?.metrics ?? summarizeStatuses([]),
      paletteIndex: stableHash(agent.id) % 8,
    };
  });
};

export const selectFloorViewModel = (state) => {
  const metrics = selectFleetMetrics(state);
  const floorAgents = selectFloorAgents(state);
  const agentsByProjectId = floorAgents.reduce((map, agent) => {
    if (!map.has(agent.projectId)) {
      map.set(agent.projectId, []);
    }
    map.get(agent.projectId).push(agent);
    return map;
  }, new Map());

  let paletteOffset = 0;
  const departments = state.projects.map((project, index) => {
    const agents = agentsByProjectId.get(project.id) ?? [];
    const room = buildFloorRoomSize(agents);
    const anchor = lumonFloorLayoutSeed.departmentAnchors[index % lumonFloorLayoutSeed.departmentAnchors.length];
    const yOffset =
      Math.floor(index / lumonFloorLayoutSeed.departmentAnchors.length) *
      lumonFloorLayoutSeed.departmentBandHeight;
    const department = {
      id: project.id,
      name: project.name,
      description: project.description,
      phaseLabel: project.phaseLabel,
      waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
      status: selectProjectStatus(project),
      metrics: summarizeStatuses(project.agents),
      agentCount: project.agents.length,
      isSelected: state.selection.projectId === project.id,
      paletteOffset,
      room: {
        x: anchor.x,
        y: anchor.y + yOffset,
        w: room.width,
        h: room.height,
      },
      agents,
    };

    paletteOffset += agents.length;
    return department;
  });

  const amenityRooms = {
    cafeteria: { ...lumonFloorLayoutSeed.amenityRooms.cafeteria },
    vending: { ...lumonFloorLayoutSeed.amenityRooms.vending },
    breakroom: {
      ...lumonFloorLayoutSeed.amenityRooms.breakroom,
      w: Math.max(
        lumonFloorLayoutSeed.amenityRooms.breakroom.w,
        floorAgents.filter((agent) => agent.location === "break-room").length * 55 + 60,
      ),
    },
  };

  const selectedProject = departments.find((department) => department.id === state.selection.projectId) ?? null;
  const selectedAgent = floorAgents.find((agent) => agent.id === state.selection.agentId) ?? null;

  return {
    layoutSeedLabel: lumonFloorLayoutSeed.label,
    bossOrbit: { ...lumonFloorLayoutSeed.bossOrbit },
    summary: {
      departmentCount: departments.length,
      agentCount: floorAgents.length,
      runningCount: metrics.running,
      failedCount: metrics.failed,
      awayCount: metrics.queued + metrics.complete,
    },
    agents: floorAgents,
    departments,
    selectedProject,
    selectedAgent,
    failedAgents: floorAgents.filter((agent) => agent.location === "break-room"),
    amenityAgents: floorAgents.filter((agent) => agent.location === "amenity"),
    amenityRooms,
  };
};

export const selectOrchestrationInput = (state) => {
  const projects = selectDashboardProjects(state);
  const selectedProject = projects.find((project) => project.isSelected) ?? projects[0] ?? null;
  const availableProjects = projects.map((project) => ({
    id: project.id,
    label: project.name,
    phaseLabel: project.phaseLabel,
    engineChoice: project.engineChoice,
    engineLabel: project.engineLabel,
    status: project.status,
    pipelineStatus: project.pipeline.status,
    pipelineStatusLabel: project.pipeline.label,
    pipelineSummary: project.pipeline.summary,
    currentStageLabel: project.pipeline.currentStageLabel,
    currentGateLabel: project.pipeline.currentGateLabel,
    handoffReady: project.handoffReady,
    isSelected: project.isSelected,
    hasFailure: project.status === "failed" || project.pipeline.status === "blocked",
    isRunning: project.status === "running" || project.pipeline.status === "running",
  }));

  if (!selectedProject) {
    return {
      availableProjects,
      projectId: null,
      projectName: null,
      phaseLabel: null,
      engineChoice: null,
      engineLabel: null,
      status: "idle",
      pipelineStatus: "idle",
      pipelineStatusLabel: PIPELINE_STATUS_META.idle.label,
      pipelineSummary: PIPELINE_STATUS_META.idle.summary,
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      currentStage: null,
      currentGate: null,
      selectedStage: null,
      stages: [],
      handoffReady: false,
    };
  }

  return {
    availableProjects,
    projectId: selectedProject.id,
    projectName: selectedProject.name,
    phaseLabel: selectedProject.phaseLabel,
    engineChoice: selectedProject.engineChoice,
    engineLabel: selectedProject.engineLabel,
    status: selectedProject.status,
    pipelineStatus: selectedProject.pipeline.status,
    pipelineStatusLabel: selectedProject.pipeline.label,
    pipelineSummary: selectedProject.pipeline.summary,
    progressPercent: selectedProject.pipeline.progressPercent,
    completedCount: selectedProject.pipeline.completedCount,
    totalCount: selectedProject.pipeline.totalCount,
    currentStage: selectedProject.currentStage,
    currentGate: selectedProject.currentGate,
    selectedStage: selectedProject.selectedStage,
    stages: selectedProject.stageTimeline,
    handoffReady: selectedProject.handoffReady,
  };
};
