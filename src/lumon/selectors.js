import {
  LUMON_APPROVAL_STATES,
  LUMON_DETAIL_STATES,
  LUMON_DOSSIER_SECTION_DEFINITIONS,
  LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS,
  LUMON_PREBUILD_STAGE_KEYS,
  buildLumonDossierStageSectionId,
  isStructuredOutput,
  getOutputSummary,
} from "./model";
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

const FLOOR_PIPELINE_INSPECTABLE_STATUSES = new Set(["waiting", "blocked", "handoff_ready"]);

const resolveAmenityRoomId = (agentId) => FLOOR_AMENITY_ROOM_IDS[stableHash(agentId) % FLOOR_AMENITY_ROOM_IDS.length];

const buildDeskClusterFootprint = (deskCount) => {
  if (deskCount <= 0) {
    return { width: 0, height: 0 };
  }

  let rows;
  let cols;
  if (deskCount <= 2) {
    rows = 1;
    cols = 2;
  } else if (deskCount <= 4) {
    rows = 2;
    cols = 2;
  } else if (deskCount <= 6) {
    rows = 2;
    cols = 3;
  } else {
    rows = 2;
    cols = Math.min(4, Math.ceil(deskCount / 2));
  }

  return {
    width: cols * 76,
    height: rows * 84 + 8,
  };
};

const buildEmptyDeskFootprint = (awayCount) => {
  if (awayCount <= 0) {
    return { width: 0, height: 0 };
  }

  const cols = Math.min(Math.max(awayCount, 1), 4);
  const rows = Math.max(1, Math.ceil(awayCount / cols));

  return {
    width: cols * 56 + Math.max(0, cols - 1) * 4,
    height: rows * 50 + Math.max(0, rows - 1) * 4,
  };
};

const buildFloorPresence = (project, agents) => {
  const deskAgents = agents.filter((agent) => agent.location === "department");
  const amenityAgents = agents.filter((agent) => agent.location === "amenity");
  const breakRoomAgents = agents.filter((agent) => agent.location === "break-room");
  const inspectable = FLOOR_PIPELINE_INSPECTABLE_STATUSES.has(project.pipeline.status);
  const persistentShell = inspectable && deskAgents.length === 0;

  return {
    visible: deskAgents.length > 0 || amenityAgents.length > 0 || breakRoomAgents.length > 0 || inspectable,
    inspectable,
    persistentShell,
    deskAgentCount: deskAgents.length,
    awayAgentCount: amenityAgents.length,
    breakRoomAgentCount: breakRoomAgents.length,
    visibleAgentCount: deskAgents.length + amenityAgents.length,
    activeAgentCount: deskAgents.length + breakRoomAgents.length,
    roomFootprintCount: Math.max(deskAgents.length, amenityAgents.length, persistentShell ? 1 : 0),
    reason: inspectable
      ? project.pipeline.summary
      : deskAgents.length > 0
        ? "Agents currently occupy the department floor shell."
        : amenityAgents.length > 0
          ? "Agents are away from their desks but still mapped to this department."
          : breakRoomAgents.length > 0
            ? "Failed agents remain inspectable through break room presence."
            : "No live floor presence recorded.",
  };
};

const buildFloorRoomSize = (presence) => {
  const deskFootprint = buildDeskClusterFootprint(presence.deskAgentCount);
  const awayFootprint = buildEmptyDeskFootprint(presence.awayAgentCount);
  const contentWidth = Math.max(deskFootprint.width, awayFootprint.width, presence.persistentShell ? 160 : 0);
  const contentHeight =
    (presence.deskAgentCount > 0 ? deskFootprint.height : 0) +
    (presence.deskAgentCount > 0 && presence.awayAgentCount > 0 ? 8 : 0) +
    (presence.awayAgentCount > 0 ? awayFootprint.height : 0);

  return {
    width: Math.max(contentWidth + 28, presence.inspectable ? 220 : 200),
    height: Math.max(contentHeight + 44, presence.inspectable ? 156 : 140),
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

const BLOCKING_APPROVAL_STATES = new Set([
  LUMON_APPROVAL_STATES.rejected,
  LUMON_APPROVAL_STATES.needsIteration,
]);

const hasRecordedValue = (value) => (typeof value === "string" ? value.trim().length > 0 : value != null);

const formatCount = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const buildBriefField = (id, label, value, missingReason) => ({
  id,
  label,
  value: hasRecordedValue(value) ? value : null,
  missing: !hasRecordedValue(value),
  reason: !hasRecordedValue(value) ? missingReason : null,
});

const buildBriefSection = ({ project, pipeline, currentGate, engineLabel }) => {
  const fields = [
    buildBriefField("project-name", "Project", project.name, "Project name is missing from the canonical registry."),
    buildBriefField(
      "description",
      "Current description",
      project.description,
      "No project description is recorded yet.",
    ),
    buildBriefField("phase", "Phase", project.phaseLabel, "No phase label is recorded yet."),
    buildBriefField("engine", "Engine", engineLabel, "No engine choice is recorded yet."),
    buildBriefField("current-stage", "Current stage", pipeline.currentStageLabel, "No current stage is recorded yet."),
    buildBriefField("current-gate", "Current gate", currentGate?.label, "No current gate is recorded yet."),
  ];
  const missingCount = fields.filter((field) => field.missing).length;

  return {
    ...LUMON_DOSSIER_SECTION_DEFINITIONS.brief,
    state: missingCount > 0 ? LUMON_DETAIL_STATES.missing : LUMON_DETAIL_STATES.ready,
    reason:
      missingCount > 0
        ? `${formatCount(missingCount, "brief field")} missing from canonical project metadata.`
        : "Brief derived from the current project metadata and pipeline truth.",
    summary: hasRecordedValue(project.description) ? project.description : "No project description recorded yet.",
    fields,
  };
};

const buildCurrentApprovalSummary = ({ currentStage, currentGate }) => {
  if (!currentStage || !currentGate) {
    return {
      ...LUMON_DOSSIER_SECTION_DEFINITIONS.currentApproval,
      state: LUMON_DETAIL_STATES.missing,
      reason: "No current stage is selected, so there is no active approval summary.",
      stageId: null,
      stageKey: null,
      stageLabel: null,
      gateId: null,
      gateLabel: null,
      approval: null,
      summary: "No current approval state recorded.",
    };
  }

  let state = LUMON_DETAIL_STATES.ready;
  let reason = currentGate.required
    ? `${currentGate.label} currently reports ${currentGate.stateLabel.toLowerCase()}.`
    : `${currentStage.label} auto-advances without operator approval.`;

  if (currentStage.status === "failed" || BLOCKING_APPROVAL_STATES.has(currentGate.state)) {
    state = LUMON_DETAIL_STATES.blocked;
    reason = currentStage.status === "failed"
      ? `${currentStage.label} failed before its current gate could clear.`
      : `${currentStage.label} is blocked at ${currentGate.label}.`;
  } else if (currentGate.required && currentGate.state === LUMON_APPROVAL_STATES.pending) {
    state = LUMON_DETAIL_STATES.waiting;
    reason = `${currentStage.label} is waiting on ${currentGate.label}.`;
  }

  return {
    ...LUMON_DOSSIER_SECTION_DEFINITIONS.currentApproval,
    state,
    reason,
    stageId: currentStage.id,
    stageKey: currentStage.stageKey,
    stageLabel: currentStage.label,
    gateId: currentGate.id,
    gateLabel: currentGate.label,
    approval: currentGate,
    summary: currentGate.summary,
  };
};

const resolveBlockedStageSectionReason = (stage) => {
  if (stage.status === "failed") {
    return `${stage.label} failed before it produced a stable dossier output.`;
  }

  if (stage.approval.state === LUMON_APPROVAL_STATES.needsIteration) {
    return `${stage.label} is blocked at ${stage.approval.label} until another iteration lands.`;
  }

  return `${stage.label} is blocked at ${stage.approval.label}.`;
};

const resolveWaitingStageSectionReason = (stage) => {
  if (stage.status === "running") {
    return `${stage.label} is still executing.`;
  }

  if (stage.approval.required && stage.approval.state === LUMON_APPROVAL_STATES.pending) {
    return `${stage.label} is waiting on ${stage.approval.label}.`;
  }

  if (stage.status === "queued") {
    return `${stage.label} has not started yet.`;
  }

  return `${stage.label} is still in progress.`;
};

const buildDossierStageSection = (stage) => {
  const outputAvailable = hasRecordedValue(stage.output);
  const needsOutputNow = stage.isCurrent || stage.status === "running" || stage.status === "complete";
  const structured = isStructuredOutput(stage.output);
  const outputSummary = getOutputSummary(stage.output);

  let state = LUMON_DETAIL_STATES.waiting;
  let reason = resolveWaitingStageSectionReason(stage);

  if (stage.status === "failed" || BLOCKING_APPROVAL_STATES.has(stage.approval.state)) {
    state = LUMON_DETAIL_STATES.blocked;
    reason = resolveBlockedStageSectionReason(stage);
  } else if (!outputAvailable && needsOutputNow) {
    state = LUMON_DETAIL_STATES.missing;
    reason = `${stage.label} has no stage output recorded yet.`;
  } else if (stage.isResolved) {
    state = LUMON_DETAIL_STATES.ready;
    reason = `${stage.label} is resolved and its current stage output is available.`;
  }

  // Multi-artifact support: project artifactIds array when present
  const artifactIds = structured && Array.isArray(stage.output.artifactIds) ? stage.output.artifactIds : null;

  return {
    id: buildLumonDossierStageSectionId(stage.stageKey),
    kind: LUMON_DOSSIER_SECTION_DEFINITIONS.stage.kind,
    label: stage.label,
    description: stage.description,
    state,
    reason,
    summary: outputAvailable ? outputSummary : reason,
    stageId: stage.id,
    stageKey: stage.stageKey,
    status: stage.status,
    stateTone: stage.stateTone,
    durationLabel: stage.durationLabel,
    output: outputAvailable ? stage.output : null,
    outputSummary: outputAvailable ? outputSummary : null,
    outputMissing: !outputAvailable,
    artifactId: structured ? stage.output.artifactId : null,
    artifactIds,
    hasArtifact: structured,
    approval: stage.approval,
    isCurrent: stage.isCurrent,
    isSelected: stage.isSelected,
    isResolved: stage.isResolved,
  };
};

const buildDossierContract = ({ project, pipeline, currentStage, currentGate, stages, engineLabel }) => {
  const brief = buildBriefSection({ project, pipeline, currentGate, engineLabel });
  const currentApprovalSummary = buildCurrentApprovalSummary({ currentStage, currentGate });
  const stageOutputs = stages.map((stage) => buildDossierStageSection(stage));

  return {
    brief,
    currentApprovalSummary,
    stageOutputs,
    sections: [brief, currentApprovalSummary, ...stageOutputs],
  };
};

const buildPacketEvidence = (stageSections) =>
  stageSections.filter(Boolean).map((stageSection) => ({
    sectionId: stageSection.id,
    stageId: stageSection.stageId,
    stageKey: stageSection.stageKey,
    stageLabel: stageSection.label,
    state: stageSection.state,
    reason: stageSection.reason,
    output: stageSection.output,
    outputSummary: stageSection.outputSummary,
    outputMissing: stageSection.outputMissing,
    artifactId: stageSection.artifactId,
    artifactIds: stageSection.artifactIds,
    hasArtifact: stageSection.hasArtifact,
    approval: stageSection.approval,
  }));

const resolvePacketArtifactContract = (definition, stageSections) => {
  const blockedStage = stageSections.find((stageSection) => stageSection.state === LUMON_DETAIL_STATES.blocked);
  if (blockedStage) {
    return {
      state: LUMON_DETAIL_STATES.blocked,
      reason: `${definition.label} is blocked because ${blockedStage.label} is blocked.`,
    };
  }

  const waitingStage = stageSections.find((stageSection) => stageSection.state === LUMON_DETAIL_STATES.waiting);
  if (waitingStage) {
    return {
      state: LUMON_DETAIL_STATES.waiting,
      reason: `${definition.label} is waiting on ${waitingStage.label}.`,
    };
  }

  const missingStage = stageSections.find((stageSection) => stageSection.state === LUMON_DETAIL_STATES.missing);
  if (missingStage) {
    return {
      state: LUMON_DETAIL_STATES.missing,
      reason: `${definition.label} cannot be assembled because ${missingStage.label} has no recorded output.`,
    };
  }

  return {
    state: LUMON_DETAIL_STATES.missing,
    reason: `No ${definition.label.toLowerCase()} artifact is stored in the canonical project yet.`,
  };
};

const buildPacketArtifactSection = ({ definition, stageSections }) => {
  const contract = resolvePacketArtifactContract(definition, stageSections);

  return {
    ...definition,
    ...contract,
    summary: contract.reason,
    content: null,
    sourceStageKeys: stageSections.map((stageSection) => stageSection.stageKey),
    sourceStageIds: stageSections.map((stageSection) => stageSection.stageId),
    evidence: buildPacketEvidence(stageSections),
  };
};

const buildPacketApprovalSection = ({ pipeline, currentStage, stagesByKey }) => {
  const definition = LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.approval;
  const handoffStage = stagesByKey.get(LUMON_PREBUILD_STAGE_KEYS.handoff) ?? null;

  if (!handoffStage) {
    return {
      ...definition,
      state: LUMON_DETAIL_STATES.missing,
      reason: "Canonical handoff stage is missing from this project.",
      summary: "No handoff approval summary available.",
      gateId: null,
      gateLabel: null,
      stageId: null,
      stageKey: LUMON_PREBUILD_STAGE_KEYS.handoff,
      stageLabel: "Handoff",
      approval: null,
      content: null,
      sourceStageKeys: [],
      sourceStageIds: [],
      evidence: [],
    };
  }

  let state = LUMON_DETAIL_STATES.waiting;
  let reason = currentStage
    ? `${handoffStage.label} approval will activate after ${currentStage.label} clears its current gate.`
    : `${handoffStage.label} approval has not activated yet.`;

  if (handoffStage.status === "failed" || BLOCKING_APPROVAL_STATES.has(handoffStage.approval.state)) {
    state = LUMON_DETAIL_STATES.blocked;
    reason = handoffStage.status === "failed"
      ? `${handoffStage.label} failed before final approval.`
      : `${handoffStage.approval.label} is blocked.`;
  } else if (pipeline.readyForHandoff || pipeline.complete || handoffStage.isCurrent) {
    state = LUMON_DETAIL_STATES.ready;
    reason = pipeline.complete
      ? "Final handoff approval has been cleared."
      : "Final handoff approval is active and inspectable.";
  }

  return {
    ...definition,
    state,
    reason,
    summary: handoffStage.approval.summary,
    gateId: handoffStage.approval.id,
    gateLabel: handoffStage.approval.label,
    stageId: handoffStage.stageId,
    stageKey: handoffStage.stageKey,
    stageLabel: handoffStage.label,
    approval: handoffStage.approval,
    content: null,
    sourceStageKeys: [handoffStage.stageKey],
    sourceStageIds: [handoffStage.stageId],
    evidence: buildPacketEvidence([handoffStage]),
  };
};

const summarizeDetailStates = (sections) =>
  sections.reduce(
    (summary, section) => {
      summary[section.state] = (summary[section.state] ?? 0) + 1;
      return summary;
    },
    {
      [LUMON_DETAIL_STATES.ready]: 0,
      [LUMON_DETAIL_STATES.waiting]: 0,
      [LUMON_DETAIL_STATES.blocked]: 0,
      [LUMON_DETAIL_STATES.missing]: 0,
    },
  );

const resolvePacketStatus = (counts) => {
  if (counts[LUMON_DETAIL_STATES.blocked] > 0) {
    return LUMON_DETAIL_STATES.blocked;
  }

  if (counts[LUMON_DETAIL_STATES.waiting] > 0) {
    return LUMON_DETAIL_STATES.waiting;
  }

  if (counts[LUMON_DETAIL_STATES.missing] > 0) {
    return LUMON_DETAIL_STATES.missing;
  }

  return LUMON_DETAIL_STATES.ready;
};

const buildPacketSummary = (status, counts) => {
  if (status === LUMON_DETAIL_STATES.blocked) {
    return `${formatCount(counts[LUMON_DETAIL_STATES.blocked], "packet section")} blocked.`;
  }

  if (status === LUMON_DETAIL_STATES.waiting) {
    return `${formatCount(counts[LUMON_DETAIL_STATES.waiting], "packet section")} waiting on upstream stages.`;
  }

  if (status === LUMON_DETAIL_STATES.missing) {
    return `${formatCount(counts[LUMON_DETAIL_STATES.missing], "packet section")} still missing real handoff content.`;
  }

  return "Packet sections are ready for build handoff.";
};

const buildHandoffPacket = ({ pipeline, currentStage, stageOutputs }) => {
  const stagesByKey = new Map(stageOutputs.map((stageSection) => [stageSection.stageKey, stageSection]));
  const architectureSections = [
    stagesByKey.get(LUMON_PREBUILD_STAGE_KEYS.research),
    stagesByKey.get(LUMON_PREBUILD_STAGE_KEYS.plan),
  ].filter(Boolean);
  const specificationSections = [stagesByKey.get(LUMON_PREBUILD_STAGE_KEYS.plan)].filter(Boolean);
  const prototypeSections = [
    ...stageOutputs.filter((stageSection) => stageSection.stageKey.startsWith("wave-")),
    stagesByKey.get(LUMON_PREBUILD_STAGE_KEYS.verification),
  ].filter(Boolean);

  const sections = [
    buildPacketArtifactSection({
      definition: LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.architecture,
      stageSections: architectureSections,
    }),
    buildPacketArtifactSection({
      definition: LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.specification,
      stageSections: specificationSections,
    }),
    buildPacketArtifactSection({
      definition: LUMON_HANDOFF_PACKET_SECTION_DEFINITIONS.prototype,
      stageSections: prototypeSections,
    }),
    buildPacketApprovalSection({ pipeline, currentStage, stagesByKey }),
  ];
  const counts = summarizeDetailStates(sections);
  const status = resolvePacketStatus(counts);

  return {
    status,
    summary: buildPacketSummary(status, counts),
    readyForBuild: status === LUMON_DETAIL_STATES.ready,
    pipelineReady: pipeline.readyForHandoff || pipeline.complete,
    readyCount: counts[LUMON_DETAIL_STATES.ready],
    waitingCount: counts[LUMON_DETAIL_STATES.waiting],
    blockedCount: counts[LUMON_DETAIL_STATES.blocked],
    missingCount: counts[LUMON_DETAIL_STATES.missing],
    sectionCount: sections.length,
    sections,
  };
};

const buildProjectDetailContract = ({ project, pipeline, currentStage, currentGate, stages, engineLabel }) => {
  const dossier = buildDossierContract({ project, pipeline, currentStage, currentGate, stages, engineLabel });
  const handoffPacket = buildHandoffPacket({
    pipeline,
    currentStage,
    stageOutputs: dossier.stageOutputs,
  });

  return {
    dossier,
    handoffPacket,
    currentApprovalSummary: dossier.currentApprovalSummary,
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

const buildProjectViewModel = (project, selection, agentsById, options = {}) => {
  const engineLabel = resolveEngineLabel(project.engineChoice);
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

    const structured = isStructuredOutput(stage.output);

    return {
      id: stage.id,
      stageKey: stage.stageKey,
      kind: stage.kind,
      label: stage.label,
      description: stage.description,
      icon: stage.icon,
      durationLabel: stage.durationLabel,
      output: stage.output,
      outputSummary: getOutputSummary(stage.output),
      artifactId: structured ? stage.output.artifactId : null,
      artifactIds: structured && Array.isArray(stage.output.artifactIds) ? stage.output.artifactIds : null,
      hasArtifact: structured,
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

  const detailContract = options.includeDetailContract
    ? buildProjectDetailContract({
        project,
        pipeline,
        currentStage,
        currentGate,
        stages,
        engineLabel,
      })
    : null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    phaseLabel: project.phaseLabel,
    engineChoice: project.engineChoice,
    engineLabel,
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
    ...(detailContract ?? {}),
  };
};

const buildProjectListViewModels = (state) => {
  const { agentsById } = buildIndex(state);
  return state.projects.map((project) => buildProjectViewModel(project, state.selection, agentsById));
};

const buildFloorDiagnostics = (project) => {
  const pipelineStatus = project.pipeline.status;
  const currentStage = project.currentStage;
  const currentGate = project.currentGate;

  return {
    pipelineStatus,
    pipelineLabel: project.pipeline.label,
    pipelineSummary: project.pipeline.summary,
    pipelineTone: project.pipeline.tone,
    currentStageKey: currentStage?.stageKey ?? null,
    currentStageLabel: currentStage?.label ?? "—",
    currentStageStatus: currentStage?.status ?? null,
    currentStageTone: currentStage?.stateTone ?? null,
    currentGateId: currentGate?.id ?? null,
    currentGateLabel: currentGate?.label ?? "No approval required",
    currentApprovalState: project.pipeline.currentApprovalState,
    currentApprovalLabel: project.pipeline.currentApprovalLabel,
    currentApprovalSummary: project.pipeline.currentApprovalSummary,
    currentApprovalNote: currentGate?.note ?? null,
    progressPercent: project.pipeline.progressPercent,
    completedCount: project.pipeline.completedCount,
    totalCount: project.pipeline.totalCount,
    handoffReady: project.handoffReady,
    waiting: pipelineStatus === "waiting",
    blocked: pipelineStatus === "blocked",
    running: pipelineStatus === "running",
    complete: pipelineStatus === "complete",
  };
};

const buildFloorProjectViewModel = (project, agents, index, paletteOffset) => {
  const presence = buildFloorPresence(project, agents);
  const roomSize = buildFloorRoomSize(presence);
  const anchor = lumonFloorLayoutSeed.departmentAnchors[index % lumonFloorLayoutSeed.departmentAnchors.length];
  const yOffset =
    Math.floor(index / lumonFloorLayoutSeed.departmentAnchors.length) *
    lumonFloorLayoutSeed.departmentBandHeight;
  const diagnostics = buildFloorDiagnostics(project);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    phaseLabel: project.phaseLabel,
    waveLabel: project.waveLabel,
    engineChoice: project.engineChoice,
    engineLabel: project.engineLabel,
    status: project.status,
    metrics: project.metrics,
    agentCount: project.agentCount,
    isSelected: project.isSelected,
    paletteOffset,
    room: {
      x: anchor.x,
      y: anchor.y + yOffset,
      w: roomSize.width,
      h: roomSize.height,
    },
    agents,
    presence,
    diagnostics,
    pipeline: {
      ...project.pipeline,
      currentStageKey: project.currentStage?.stageKey ?? null,
      currentStageStatus: project.currentStage?.status ?? null,
      currentStageTone: project.currentStage?.stateTone ?? null,
      currentApprovalNote: project.currentGate?.note ?? null,
    },
    currentStage: project.currentStage
      ? {
          id: project.currentStage.id,
          stageKey: project.currentStage.stageKey,
          label: project.currentStage.label,
          status: project.currentStage.status,
          stateTone: project.currentStage.stateTone,
          approval: project.currentStage.approval,
        }
      : null,
    currentGate: project.currentGate ? { ...project.currentGate } : null,
    pipelineStatus: project.pipeline.status,
    pipelineStatusLabel: project.pipeline.label,
    pipelineSummary: project.pipeline.summary,
    currentStageId: project.pipeline.currentStageId,
    currentStageKey: project.currentStage?.stageKey ?? null,
    currentStageLabel: project.pipeline.currentStageLabel,
    currentStageStatus: project.currentStage?.status ?? null,
    currentGateId: project.pipeline.currentGateId,
    currentGateLabel: project.pipeline.currentGateLabel,
    currentApprovalState: project.pipeline.currentApprovalState,
    currentApprovalLabel: project.pipeline.currentApprovalLabel,
    currentApprovalSummary: project.pipeline.currentApprovalSummary,
    currentApprovalNote: project.currentGate?.note ?? null,
    handoffReady: project.handoffReady,
  };
};

const buildFloorAgentViewModels = (state, projectViewModels = buildProjectListViewModels(state)) => {
  const projectViewModelById = new Map(projectViewModels.map((project) => [project.id, project]));

  return selectAllAgents(state).map((agent) => {
    const projectState = projectViewModelById.get(agent.projectId);
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
      projectPipelineStatus: projectState?.pipeline.status ?? "queued",
      projectPipelineStatusLabel: projectState?.pipeline.label ?? PIPELINE_STATUS_META.queued.label,
      projectPipelineSummary: projectState?.pipeline.summary ?? PIPELINE_STATUS_META.queued.summary,
      projectCurrentStageKey: projectState?.currentStage?.stageKey ?? null,
      projectCurrentStageLabel: projectState?.pipeline.currentStageLabel ?? "—",
      projectCurrentGateLabel: projectState?.pipeline.currentGateLabel ?? "No approval required",
      projectCurrentApprovalState: projectState?.pipeline.currentApprovalState ?? LUMON_APPROVAL_STATES.notRequired,
      projectCurrentApprovalSummary:
        projectState?.pipeline.currentApprovalSummary ?? APPROVAL_STATE_META[LUMON_APPROVAL_STATES.notRequired].summary,
      paletteIndex: stableHash(agent.id) % 8,
    };
  });
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

export const selectDashboardProjects = (state) => buildProjectListViewModels(state);

export const selectSelectedProjectDetail = (state) => {
  const project = selectSelectedProject(state);
  if (!project) return null;

  const { agentsById } = buildIndex(state);
  return buildProjectViewModel(project, state.selection, agentsById, { includeDetailContract: true });
};

export const selectSelectedAgentDetail = (state) => {
  const agent = selectSelectedAgent(state);
  if (!agent) return null;
  return buildAgentViewModel(agent, state.selection);
};

export const selectFloorAgents = (state) => buildFloorAgentViewModels(state);

export const selectFloorViewModel = (state) => {
  const metrics = selectFleetMetrics(state);
  const projects = buildProjectListViewModels(state);
  const floorAgents = buildFloorAgentViewModels(state, projects);
  const agentsByProjectId = floorAgents.reduce((map, agent) => {
    if (!map.has(agent.projectId)) {
      map.set(agent.projectId, []);
    }
    map.get(agent.projectId).push(agent);
    return map;
  }, new Map());

  let paletteOffset = 0;
  const departments = projects.map((project, index) => {
    const agents = agentsByProjectId.get(project.id) ?? [];
    const department = buildFloorProjectViewModel(project, agents, index, paletteOffset);

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

  const runningDepartments = departments.filter((department) => department.pipelineStatus === "running");
  const waitingDepartments = departments.filter((department) => department.pipelineStatus === "waiting");
  const blockedDepartments = departments.filter((department) => department.pipelineStatus === "blocked");
  const handoffReadyDepartments = departments.filter((department) => department.pipelineStatus === "handoff_ready");
  const completeDepartments = departments.filter((department) => department.pipelineStatus === "complete");
  const queuedDepartments = departments.filter(
    (department) => department.pipelineStatus === "queued" || department.pipelineStatus === "idle",
  );

  return {
    layoutSeedLabel: lumonFloorLayoutSeed.label,
    bossOrbit: { ...lumonFloorLayoutSeed.bossOrbit },
    summary: {
      departmentCount: departments.length,
      presentDepartmentCount: departments.filter((department) => department.presence.visible).length,
      deskDepartmentCount: departments.filter((department) => department.presence.deskAgentCount > 0).length,
      inspectableDepartmentCount: departments.filter((department) => department.presence.inspectable).length,
      waitingCount: waitingDepartments.length,
      blockedCount: blockedDepartments.length,
      handoffReadyCount: handoffReadyDepartments.length,
      runningPipelineCount: runningDepartments.length,
      completePipelineCount: completeDepartments.length,
      queuedPipelineCount: queuedDepartments.length,
      agentCount: floorAgents.length,
      runningCount: metrics.running,
      failedCount: metrics.failed,
      awayCount: metrics.queued + metrics.complete,
    },
    agents: floorAgents,
    departments,
    selectedProject,
    selectedProjectDiagnostics: selectedProject?.diagnostics ?? null,
    selectedAgent,
    failedAgents: floorAgents.filter((agent) => agent.location === "break-room"),
    amenityAgents: floorAgents.filter((agent) => agent.location === "amenity"),
    amenityRooms,
  };
};

export const selectOrchestrationInput = (state) => {
  const projects = buildProjectListViewModels(state);
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
