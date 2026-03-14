import { lumonFloorLayoutSeed } from "./seed";

const formatCurrency = (value) => `$${Number(value ?? 0).toFixed(2)}`;
const formatTokenThousands = (value) => `${Math.round(Number(value ?? 0) / 1000)}k`;
const FLOOR_AMENITY_ROOM_IDS = ["cafeteria", "vending"];

const stableHash = (value) => {
  let hash = 2166136261;
  const input = String(value ?? "");

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const buildIndex = (state) => {
  const projectsById = new Map();
  const agentsById = new Map();
  const projectIdByAgentId = new Map();

  state.projects.forEach((project) => {
    projectsById.set(project.id, project);
    project.agents.forEach((agent) => {
      agentsById.set(agent.id, { ...agent, projectId: project.id, projectName: project.name });
      projectIdByAgentId.set(agent.id, project.id);
    });
  });

  return { projectsById, agentsById, projectIdByAgentId };
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

export const selectDashboardProjects = (state) =>
  state.projects.map((project) => {
    const projectAgents = project.agents.map((agent) =>
      buildAgentViewModel(
        {
          ...agent,
          projectId: project.id,
          projectName: project.name,
          phaseLabel: project.phaseLabel,
          waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
        },
        state.selection,
      ),
    );
    const metrics = summarizeStatuses(project.agents);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      phaseLabel: project.phaseLabel,
      waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
      status: selectProjectStatus(project),
      metrics,
      agentCount: project.agents.length,
      isSelected: state.selection.projectId === project.id,
      agents: projectAgents,
    };
  });

export const selectSelectedProjectDetail = (state) => {
  const project = selectSelectedProject(state);
  if (!project) return null;

  const agents = project.agents.map((agent) =>
    buildAgentViewModel(
      {
        ...agent,
        projectId: project.id,
        projectName: project.name,
        phaseLabel: project.phaseLabel,
        waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
      },
      state.selection,
    ),
  );
  const metrics = summarizeStatuses(project.agents);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    phaseLabel: project.phaseLabel,
    waveLabel: `Wave ${project.waves.current}/${project.waves.total}`,
    status: selectProjectStatus(project),
    metrics,
    agentCount: agents.length,
    selectedAgentId: state.selection.agentId,
    agents,
    executionStatus: project.execution.status,
  };
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
  const selectedProject = selectSelectedProject(state);
  const { agentsById } = buildIndex(state);
  const availableProjects = state.projects.map((project) => {
    const stages = project.execution.stages.map((stage) => deriveStageStatus(stage, agentsById));
    const hasFailure = stages.includes("failed") || project.agents.some((agent) => agent.status === "failed");
    const isRunning = stages.includes("running") || project.agents.some((agent) => agent.status === "running");

    return {
      id: project.id,
      label: project.name,
      phaseLabel: project.phaseLabel,
      status: hasFailure ? "failed" : isRunning ? "running" : selectProjectStatus(project),
      isSelected: project.id === selectedProject?.id,
      hasFailure,
      isRunning,
    };
  });

  if (!selectedProject) {
    return {
      availableProjects,
      projectId: null,
      projectName: null,
      phaseLabel: null,
      status: "idle",
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      currentStage: null,
      selectedStage: null,
      stages: [],
    };
  }

  const stages = selectedProject.execution.stages.map((stage) => {
    const status = deriveStageStatus(stage, agentsById);
    const progress = deriveStageProgress(stage, agentsById);
    const agents = stage.agentIds
      .map((agentId) => agentsById.get(agentId))
      .filter(Boolean)
      .map((agent) => buildAgentViewModel(agent, state.selection));

    return {
      id: stage.id,
      kind: stage.kind,
      label: stage.label,
      description: stage.description,
      icon: stage.icon,
      durationLabel: stage.durationLabel,
      output: stage.output,
      status,
      progress,
      agentIds: [...stage.agentIds],
      agents,
      approval: stage.approval,
      isSelected: state.selection.stageId === stage.id,
    };
  });

  const completedCount = stages.filter((stage) => stage.status === "complete").length;
  const totalCount = stages.length;
  const progressPercent = Math.round((completedCount / Math.max(totalCount, 1)) * 100);
  const status =
    stages.some((stage) => stage.status === "failed")
      ? "failed"
      : stages.some((stage) => stage.status === "running")
        ? "running"
        : stages.every((stage) => stage.status === "complete")
          ? "complete"
          : "queued";
  const currentStage =
    stages.find((stage) => stage.id === selectedProject.execution.currentStageId) ??
    stages.find((stage) => stage.status === "failed" || stage.status === "running") ??
    stages.find((stage) => stage.status !== "complete") ??
    null;
  const selectedStage = stages.find((stage) => stage.id === state.selection.stageId) ?? null;

  return {
    availableProjects,
    projectId: selectedProject.id,
    projectName: selectedProject.name,
    phaseLabel: selectedProject.phaseLabel,
    status,
    progressPercent,
    completedCount,
    totalCount,
    currentStage,
    selectedStage,
    stages,
  };
};
