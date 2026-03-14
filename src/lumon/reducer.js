import { createApprovalState, createLumonState, createPipelineStage } from "./model";

export const lumonActionTypes = {
  hydrate: "lumon/hydrate",
  selectProject: "lumon/selectProject",
  selectAgent: "lumon/selectAgent",
  selectStage: "lumon/selectStage",
  updateAgent: "lumon/updateAgent",
  updateStage: "lumon/updateStage",
};

export const lumonActions = {
  hydrate: (payload) => ({ type: lumonActionTypes.hydrate, payload }),
  selectProject: (projectId) => ({ type: lumonActionTypes.selectProject, payload: { projectId } }),
  selectAgent: (agentId) => ({ type: lumonActionTypes.selectAgent, payload: { agentId } }),
  selectStage: (stageId) => ({ type: lumonActionTypes.selectStage, payload: { stageId } }),
  updateAgent: (agentId, changes) => ({
    type: lumonActionTypes.updateAgent,
    payload: { agentId, changes },
  }),
  updateStage: (stageId, changes) => ({
    type: lumonActionTypes.updateStage,
    payload: { stageId, changes },
  }),
};

const findProjectByAgentId = (projects, agentId) =>
  projects.find((project) => project.agents.some((agent) => agent.id === agentId)) ?? null;

const findProjectByStageId = (projects, stageId) =>
  projects.find((project) => project.execution.stages.some((stage) => stage.id === stageId)) ?? null;

const updateProjectAgent = (project, agentId, changes) => {
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

  return changed ? { ...project, agents } : project;
};

const mergeStageChanges = (stage, changes = {}) => {
  const approval =
    "approval" in changes
      ? createApprovalState({ ...stage.approval, ...changes.approval })
      : stage.approval;

  const merged = {
    ...stage,
    ...changes,
    approval,
    agentIds: changes.agentIds ? [...changes.agentIds] : stage.agentIds,
    meta: changes.meta ? { ...stage.meta, ...changes.meta } : stage.meta,
  };

  return createPipelineStage(merged);
};

const updateProjectStage = (project, stageId, changes) => {
  let changed = false;
  const stages = project.execution.stages.map((stage) => {
    if (stage.id !== stageId) {
      return stage;
    }

    changed = true;
    return mergeStageChanges(stage, changes);
  });

  if (!changed) {
    return project;
  }

  return {
    ...project,
    execution: {
      ...project.execution,
      stages,
      currentStageId:
        stageId === project.execution.currentStageId
          ? changes.currentStageId ?? changes.id ?? project.execution.currentStageId
          : project.execution.currentStageId,
    },
  };
};

export function lumonReducer(state, action) {
  switch (action.type) {
    case lumonActionTypes.hydrate:
      return createLumonState(action.payload);

    case lumonActionTypes.selectProject: {
      const projectId = action.payload?.projectId;
      if (!projectId || !state.projects.some((project) => project.id === projectId)) {
        return state;
      }

      const selectedProject = state.projects.find((project) => project.id === projectId);
      const stageId =
        selectedProject.execution.stages.some((stage) => stage.id === state.selection.stageId)
          ? state.selection.stageId
          : null;
      const agentId =
        selectedProject.agents.some((agent) => agent.id === state.selection.agentId)
          ? state.selection.agentId
          : null;

      return {
        ...state,
        selection: {
          ...state.selection,
          projectId,
          agentId,
          stageId,
        },
      };
    }

    case lumonActionTypes.selectAgent: {
      const agentId = action.payload?.agentId;
      if (!agentId) {
        return {
          ...state,
          selection: {
            ...state.selection,
            agentId: null,
          },
        };
      }

      const project = findProjectByAgentId(state.projects, agentId);
      if (!project) {
        return state;
      }

      return {
        ...state,
        selection: {
          ...state.selection,
          projectId: project.id,
          agentId,
          stageId:
            project.execution.stages.some((stage) => stage.id === state.selection.stageId)
              ? state.selection.stageId
              : null,
        },
      };
    }

    case lumonActionTypes.selectStage: {
      const stageId = action.payload?.stageId;
      if (!stageId) {
        return {
          ...state,
          selection: {
            ...state.selection,
            stageId: null,
          },
        };
      }

      const project = findProjectByStageId(state.projects, stageId);
      if (!project) {
        return state;
      }

      return {
        ...state,
        selection: {
          ...state.selection,
          projectId: project.id,
          stageId,
        },
      };
    }

    case lumonActionTypes.updateAgent: {
      const agentId = action.payload?.agentId;
      if (!agentId) {
        return state;
      }

      const projects = state.projects.map((project) =>
        updateProjectAgent(project, agentId, action.payload?.changes ?? {}),
      );

      return { ...state, projects };
    }

    case lumonActionTypes.updateStage: {
      const stageId = action.payload?.stageId;
      if (!stageId) {
        return state;
      }

      const projects = state.projects.map((project) =>
        updateProjectStage(project, stageId, action.payload?.changes ?? {}),
      );

      return { ...state, projects };
    }

    default:
      return state;
  }
}
