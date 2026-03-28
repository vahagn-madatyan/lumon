import { createLumonState, createProject, createProjectId, reconcileSelection, normalizeBuildExecutionState, normalizeEscalationState, normalizeExternalActionsState } from "./model";

export const lumonActionTypes = {
  hydrate: "lumon/hydrate",
  addProject: "lumon/add-project",
  updateProject: "lumon/update-project",
  removeProject: "lumon/remove-project",
  selectProject: "lumon/select-project",
  selectAgent: "lumon/select-agent",
  selectStage: "lumon/select-stage",
  updateAgent: "lumon/update-agent",
  updateStage: "lumon/update-stage",
  appendArtifact: "lumon/append-artifact",
  updateProvisioning: "lumon/update-provisioning",
  startBuild: "lumon/start-build",
  updateBuildAgent: "lumon/update-build-agent",
  completeBuild: "lumon/complete-build",
  failBuild: "lumon/fail-build",
  retryBuildAgent: "lumon/retry-build-agent",
  escalateBuild: "lumon/escalate-build",
  acknowledgeEscalation: "lumon/acknowledge-escalation",
  updateBuildTelemetry: "lumon/update-build-telemetry",
  requestExternalAction: "lumon/request-external-action",
  confirmExternalAction: "lumon/confirm-external-action",
  completeExternalAction: "lumon/complete-external-action",
  failExternalAction: "lumon/fail-external-action",
  cancelExternalAction: "lumon/cancel-external-action",
};

export const lumonActions = {
  hydrate: (payload) => ({ type: lumonActionTypes.hydrate, payload }),
  addProject: (project, options = {}) => ({
    type: lumonActionTypes.addProject,
    payload: { project, ...options },
  }),
  updateProject: (projectId, changes, options = {}) => ({
    type: lumonActionTypes.updateProject,
    payload: { projectId, changes, ...options },
  }),
  removeProject: (projectId) => ({ type: lumonActionTypes.removeProject, payload: { projectId } }),
  selectProject: (projectId) => ({ type: lumonActionTypes.selectProject, payload: { projectId } }),
  selectAgent: (agentId) => ({ type: lumonActionTypes.selectAgent, payload: { agentId } }),
  selectStage: (stageId) => ({ type: lumonActionTypes.selectStage, payload: { stageId } }),
  updateAgent: (agentId, changes, options = {}) => ({
    type: lumonActionTypes.updateAgent,
    payload: { agentId, changes, ...options },
  }),
  updateStage: (stageId, changes, options = {}) => ({
    type: lumonActionTypes.updateStage,
    payload: { stageId, changes, ...options },
  }),
  appendArtifact: (stageId, artifact) => ({
    type: lumonActionTypes.appendArtifact,
    payload: { stageId, artifact },
  }),
  updateProvisioning: (projectId, changes) => ({
    type: lumonActionTypes.updateProvisioning,
    payload: { projectId, changes },
  }),
  startBuild: (projectId) => ({
    type: lumonActionTypes.startBuild,
    payload: { projectId },
  }),
  updateBuildAgent: (projectId, agentId, changes) => ({
    type: lumonActionTypes.updateBuildAgent,
    payload: { projectId, agentId, changes },
  }),
  completeBuild: (projectId, data = {}) => ({
    type: lumonActionTypes.completeBuild,
    payload: { projectId, ...data },
  }),
  failBuild: (projectId, error) => ({
    type: lumonActionTypes.failBuild,
    payload: { projectId, error },
  }),
  retryBuildAgent: (projectId, agentId) => ({
    type: lumonActionTypes.retryBuildAgent,
    payload: { projectId, agentId },
  }),
  escalateBuild: (projectId, reason) => ({
    type: lumonActionTypes.escalateBuild,
    payload: { projectId, reason },
  }),
  acknowledgeEscalation: (projectId, decision) => ({
    type: lumonActionTypes.acknowledgeEscalation,
    payload: { projectId, decision },
  }),
  updateBuildTelemetry: (projectId, agentId, telemetry) => ({
    type: lumonActionTypes.updateBuildTelemetry,
    payload: { projectId, agentId, telemetry },
  }),
  requestExternalAction: (projectId, action) => ({
    type: lumonActionTypes.requestExternalAction,
    payload: { projectId, action },
  }),
  confirmExternalAction: (projectId, actionId, confirmedAt) => ({
    type: lumonActionTypes.confirmExternalAction,
    payload: { projectId, actionId, confirmedAt },
  }),
  completeExternalAction: (projectId, actionId, result, completedAt) => ({
    type: lumonActionTypes.completeExternalAction,
    payload: { projectId, actionId, result, completedAt },
  }),
  failExternalAction: (projectId, actionId, error) => ({
    type: lumonActionTypes.failExternalAction,
    payload: { projectId, actionId, error },
  }),
  cancelExternalAction: (projectId, actionId) => ({
    type: lumonActionTypes.cancelExternalAction,
    payload: { projectId, actionId },
  }),
};

const createActionTimestamp = (value) => {
  const fallback = new Date().toISOString();
  if (!value) {
    return fallback;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
};

const buildState = (state, projects, selection = state.selection) =>
  createLumonState({
    projects,
    selection,
    meta: state.meta,
  });

const touchProject = (project, changes = {}, now) =>
  createProject(
    {
      ...project,
      ...changes,
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: now,
      waves: changes.waves ? { ...project.waves, ...changes.waves } : project.waves,
      execution: changes.execution ? { ...project.execution, ...changes.execution } : project.execution,
      meta: changes.meta ? { ...project.meta, ...changes.meta } : project.meta,
    },
    { now },
  );

const resolveProjectId = (projectInput, existingIds) =>
  createProjectId(projectInput?.id ?? projectInput?.name ?? "project", existingIds);

const updateProjectAgent = (project, agentId, changes, now) => {
  let changed = false;
  const agents = project.agents.map((agent) => {
    if (agent.id !== agentId) {
      return agent;
    }

    changed = true;
    return {
      ...agent,
      ...changes,
      meta: changes?.meta ? { ...agent.meta, ...changes.meta } : agent.meta,
    };
  });

  return changed ? touchProject(project, { agents }, now) : project;
};

const mergeStageChanges = (stage, changes = {}) => ({
  ...stage,
  ...changes,
  approval: "approval" in changes ? { ...stage.approval, ...changes.approval } : stage.approval,
  agentIds: changes.agentIds ? [...changes.agentIds] : [...stage.agentIds],
  meta: changes.meta ? { ...stage.meta, ...changes.meta } : stage.meta,
});

const updateProjectStage = (project, stageId, changes, now) => {
  let changed = false;
  const stages = project.execution.stages.map((stage) => {
    if (stage.id !== stageId && !stage.meta?.aliasIds?.includes(stageId)) {
      return stage;
    }

    changed = true;
    return mergeStageChanges(stage, changes);
  });

  if (!changed) {
    return project;
  }

  return touchProject(
    project,
    {
      execution: {
        ...project.execution,
        stages,
      },
    },
    now,
  );
};

export function lumonReducer(state, action) {
  switch (action.type) {
    case lumonActionTypes.hydrate:
      return createLumonState(action.payload);

    case lumonActionTypes.addProject: {
      const projectInput = action.payload?.project;
      if (!projectInput) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      const existingIds = state.projects.map((project) => project.id);
      const project = createProject(
        {
          ...projectInput,
          id: resolveProjectId(projectInput, existingIds),
          createdAt: projectInput.createdAt ?? now,
          updatedAt: projectInput.updatedAt ?? now,
        },
        { now },
      );
      const projects = [...state.projects, project];
      const selection = action.payload?.select === false
        ? reconcileSelection(projects, state.selection)
        : reconcileSelection(projects, { projectId: project.id });

      return buildState(state, projects, selection);
    }

    case lumonActionTypes.updateProject: {
      const projectId = action.payload?.projectId;
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(project, action.payload?.changes ?? {}, now);
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.removeProject: {
      const projectId = action.payload?.projectId;
      if (!projectId) {
        return state;
      }

      const projects = state.projects.filter((project) => project.id !== projectId);
      if (projects.length === state.projects.length) {
        return state;
      }

      return buildState(state, projects, reconcileSelection(projects, state.selection));
    }

    case lumonActionTypes.selectProject: {
      const projectId = action.payload?.projectId;
      if (!projectId || !state.projects.some((project) => project.id === projectId)) {
        return state;
      }

      return buildState(
        state,
        state.projects,
        reconcileSelection(state.projects, {
          projectId,
          agentId: state.selection.agentId,
          stageId: state.selection.stageId,
        }),
      );
    }

    case lumonActionTypes.selectAgent: {
      const agentId = action.payload?.agentId;
      if (!agentId) {
        return buildState(state, state.projects, {
          ...state.selection,
          agentId: null,
        });
      }

      const project = state.projects.find((candidate) => candidate.agents.some((agent) => agent.id === agentId));
      if (!project) {
        return state;
      }

      return buildState(
        state,
        state.projects,
        reconcileSelection(state.projects, {
          projectId: project.id,
          agentId,
          stageId: state.selection.stageId,
        }),
      );
    }

    case lumonActionTypes.selectStage: {
      const stageId = action.payload?.stageId;
      if (!stageId) {
        return buildState(state, state.projects, {
          ...state.selection,
          stageId: null,
        });
      }

      const project = state.projects.find((candidate) =>
        candidate.execution.stages.some(
          (stage) => stage.id === stageId || stage.meta?.aliasIds?.includes(stageId),
        ),
      );
      if (!project) {
        return state;
      }

      return buildState(
        state,
        state.projects,
        reconcileSelection(state.projects, {
          projectId: project.id,
          agentId: state.selection.agentId,
          stageId,
        }),
      );
    }

    case lumonActionTypes.updateAgent: {
      const agentId = action.payload?.agentId;
      if (!agentId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        const nextProject = updateProjectAgent(project, agentId, action.payload?.changes ?? {}, now);
        if (nextProject !== project) {
          changed = true;
        }
        return nextProject;
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.updateStage: {
      const stageId = action.payload?.stageId;
      if (!stageId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        const nextProject = updateProjectStage(project, stageId, action.payload?.changes ?? {}, now);
        if (nextProject !== project) {
          changed = true;
        }
        return nextProject;
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.appendArtifact: {
      const stageId = action.payload?.stageId;
      const artifact = action.payload?.artifact;
      if (!stageId || !artifact?.artifactId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        const stageIndex = project.execution.stages.findIndex(
          (stage) => stage.id === stageId || stage.meta?.aliasIds?.includes(stageId),
        );
        if (stageIndex === -1) return project;

        const stage = project.execution.stages[stageIndex];
        const existingOutput = stage.output;

        // Build accumulated artifactIds array
        const existingIds =
          existingOutput != null && typeof existingOutput === "object" && Array.isArray(existingOutput.artifactIds)
            ? existingOutput.artifactIds
            : existingOutput != null && typeof existingOutput === "object" && typeof existingOutput.artifactId === "string" && existingOutput.artifactId
              ? [existingOutput.artifactId]
              : [];

        // Deduplicate — don't add the same artifactId twice
        const artifactIds = existingIds.includes(artifact.artifactId)
          ? [...existingIds]
          : [...existingIds, artifact.artifactId];

        const mergedOutput = {
          artifactId: artifact.artifactId, // latest is always primary
          summary: artifact.summary,
          type: artifact.type,
          artifactIds,
        };

        changed = true;
        return updateProjectStage(project, stageId, { output: mergedOutput }, now);
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.updateProvisioning: {
      const projectId = action.payload?.projectId;
      const changes = action.payload?.changes;
      if (!projectId || !changes) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(
          project,
          {
            provisioning: { ...project.provisioning, ...changes },
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.startBuild: {
      const projectId = action.payload?.projectId;
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: "running",
              agents: [],
              startedAt: now,
              completedAt: null,
              error: null,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.updateBuildAgent: {
      const projectId = action.payload?.projectId;
      const agentId = action.payload?.agentId;
      const changes = action.payload?.changes;
      if (!projectId || !agentId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        const existingAgents = project.buildExecution?.agents ?? [];
        const agentIndex = existingAgents.findIndex((a) => a.agentId === agentId);
        let nextAgents;
        if (agentIndex >= 0) {
          nextAgents = existingAgents.map((a, i) =>
            i === agentIndex ? { ...a, ...changes } : a,
          );
        } else {
          nextAgents = [
            ...existingAgents,
            { agentId, status: "running", ...changes },
          ];
        }

        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              agents: nextAgents,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.completeBuild: {
      const projectId = action.payload?.projectId;
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: "completed",
              completedAt: now,
              error: null,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.failBuild: {
      const projectId = action.payload?.projectId;
      const error = action.payload?.error ?? "Unknown build error";
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: "failed",
              completedAt: now,
              error,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.retryBuildAgent: {
      const projectId = action.payload?.projectId;
      const agentId = action.payload?.agentId;
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        const existingAgents = project.buildExecution?.agents ?? [];
        const nextAgents = existingAgents.map((a) =>
          a.agentId === agentId ? { ...a, status: "running", error: null } : a,
        );

        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: "running",
              retryCount: (project.buildExecution?.retryCount ?? 0) + 1,
              agents: nextAgents,
              escalation: { status: "none", reason: null, acknowledgedAt: null, decision: null },
              error: null,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.escalateBuild: {
      const projectId = action.payload?.projectId;
      const reason = action.payload?.reason ?? "Unknown escalation";
      if (!projectId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: "escalated",
              escalation: {
                status: "raised",
                reason,
                acknowledgedAt: null,
                decision: null,
              },
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.acknowledgeEscalation: {
      const projectId = action.payload?.projectId;
      const decision = action.payload?.decision;
      if (!projectId || !decision) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        const nextStatus = decision === "abort" ? "failed" : project.buildExecution?.status;
        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              status: nextStatus,
              escalation: {
                ...normalizeEscalationState(project.buildExecution?.escalation),
                status: "acknowledged",
                acknowledgedAt: now,
                decision,
              },
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.updateBuildTelemetry: {
      const projectId = action.payload?.projectId;
      const agentId = action.payload?.agentId;
      const telemetry = action.payload?.telemetry;
      if (!projectId || !agentId || !telemetry) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const existingAgents = project.buildExecution?.agents ?? [];
        const agentIndex = existingAgents.findIndex((a) => a.agentId === agentId);
        if (agentIndex < 0) {
          return project;
        }

        changed = true;
        const nextAgents = existingAgents.map((a, i) =>
          i === agentIndex
            ? { ...a, telemetry: { ...(a.telemetry ?? {}), ...telemetry } }
            : a,
        );

        return touchProject(
          project,
          {
            buildExecution: normalizeBuildExecutionState({
              ...project.buildExecution,
              agents: nextAgents,
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.requestExternalAction: {
      const projectId = action.payload?.projectId;
      const externalAction = action.payload?.action;
      if (!projectId || !externalAction) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        changed = true;
        const currentActions = project.externalActions?.actions ?? [];
        return touchProject(
          project,
          {
            externalActions: normalizeExternalActionsState({
              actions: [...currentActions, externalAction],
            }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.confirmExternalAction: {
      const projectId = action.payload?.projectId;
      const actionId = action.payload?.actionId;
      if (!projectId || !actionId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const currentActions = project.externalActions?.actions ?? [];
        const actionIndex = currentActions.findIndex((a) => a.id === actionId);
        if (actionIndex < 0) {
          return project;
        }

        changed = true;
        const nextActions = currentActions.map((a, i) =>
          i === actionIndex
            ? { ...a, status: "confirmed", confirmedAt: action.payload.confirmedAt ?? now }
            : a,
        );
        return touchProject(
          project,
          {
            externalActions: normalizeExternalActionsState({ actions: nextActions }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.completeExternalAction: {
      const projectId = action.payload?.projectId;
      const actionId = action.payload?.actionId;
      if (!projectId || !actionId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const currentActions = project.externalActions?.actions ?? [];
        const actionIndex = currentActions.findIndex((a) => a.id === actionId);
        if (actionIndex < 0) {
          return project;
        }

        changed = true;
        const nextActions = currentActions.map((a, i) =>
          i === actionIndex
            ? { ...a, status: "completed", result: action.payload.result ?? null, completedAt: action.payload.completedAt ?? now }
            : a,
        );
        return touchProject(
          project,
          {
            externalActions: normalizeExternalActionsState({ actions: nextActions }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.failExternalAction: {
      const projectId = action.payload?.projectId;
      const actionId = action.payload?.actionId;
      if (!projectId || !actionId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const currentActions = project.externalActions?.actions ?? [];
        const actionIndex = currentActions.findIndex((a) => a.id === actionId);
        if (actionIndex < 0) {
          return project;
        }

        changed = true;
        const nextActions = currentActions.map((a, i) =>
          i === actionIndex
            ? { ...a, status: "failed", error: action.payload.error ?? "Unknown error" }
            : a,
        );
        return touchProject(
          project,
          {
            externalActions: normalizeExternalActionsState({ actions: nextActions }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    case lumonActionTypes.cancelExternalAction: {
      const projectId = action.payload?.projectId;
      const actionId = action.payload?.actionId;
      if (!projectId || !actionId) {
        return state;
      }

      const now = createActionTimestamp(action.payload?.now);
      let changed = false;
      const projects = state.projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const currentActions = project.externalActions?.actions ?? [];
        const actionIndex = currentActions.findIndex((a) => a.id === actionId);
        if (actionIndex < 0) {
          return project;
        }

        changed = true;
        const nextActions = currentActions.map((a, i) =>
          i === actionIndex
            ? { ...a, status: "cancelled" }
            : a,
        );
        return touchProject(
          project,
          {
            externalActions: normalizeExternalActionsState({ actions: nextActions }),
          },
          now,
        );
      });

      return changed ? buildState(state, projects) : state;
    }

    default:
      return state;
  }
}
