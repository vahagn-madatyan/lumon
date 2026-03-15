import { createLumonState, createProject, createProjectId, reconcileSelection } from "./model";

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

    default:
      return state;
  }
}
