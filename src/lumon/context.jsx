/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { lumonActions, lumonReducer } from "./reducer";
import { createSeedLumonState } from "./seed";
import { lumonLocalPersistence } from "./persistence";
import { useServerSync } from "./sync";

const LumonStateContext = createContext(null);
const LumonActionsContext = createContext(null);
const ServerSyncContext = createContext(null);

const createStatusPatch = (agent, status, changes = {}) => {
  const baseChanges = { ...changes, status };

  if (status === "complete" && !("progress" in baseChanges)) {
    baseChanges.progress = 100;
  }

  if (status === "queued") {
    if (!("progress" in baseChanges)) {
      baseChanges.progress = 0;
    }
    if (!("elapsedLabel" in baseChanges)) {
      baseChanges.elapsedLabel = "—";
    }
  }

  if (status === "running" && !("elapsedLabel" in baseChanges)) {
    baseChanges.elapsedLabel = agent?.elapsedLabel && agent.elapsedLabel !== "—" ? agent.elapsedLabel : "1m";
  }

  return baseChanges;
};

export function resolveLumonInitialState(initialState, persistence = lumonLocalPersistence) {
  if (initialState) {
    return initialState;
  }

  return persistence?.loadState?.() ?? createSeedLumonState();
}

export function LumonProvider({ children, initialState, persistence = lumonLocalPersistence }) {
  const [state, dispatch] = useReducer(lumonReducer, initialState ?? null, (seededState) =>
    resolveLumonInitialState(seededState, persistence),
  );

  useEffect(() => {
    if (!state) {
      return;
    }

    persistence?.saveState?.(state);
  }, [persistence, state]);

  // Server sync — connects to bridge server SSE for the selected project
  const selectedProjectId = state?.selection?.projectId ?? null;
  const sync = useServerSync({ projectId: selectedProjectId, dispatch });

  const actions = useMemo(
    () => ({
      dispatch,
      hydrate: (payload) => dispatch(lumonActions.hydrate(payload)),
      addProject: (project, options) => dispatch(lumonActions.addProject(project, options)),
      updateProject: (projectId, changes, options) =>
        dispatch(lumonActions.updateProject(projectId, changes, options)),
      removeProject: (projectId) => dispatch(lumonActions.removeProject(projectId)),
      selectProject: (projectId) => dispatch(lumonActions.selectProject(projectId)),
      selectAgent: (agentId) => dispatch(lumonActions.selectAgent(agentId)),
      selectStage: (stageId) => dispatch(lumonActions.selectStage(stageId)),
      updateAgent: (agentId, changes, options) => dispatch(lumonActions.updateAgent(agentId, changes, options)),
      updateStage: (stageId, changes, options) => dispatch(lumonActions.updateStage(stageId, changes, options)),
      setAgentStatus: (agent, status, changes = {}) => {
        if (!agent?.id) {
          return;
        }

        dispatch(lumonActions.updateAgent(agent.id, createStatusPatch(agent, status, changes)));
      },
      triggerPipeline: sync.triggerPipeline,
      approvePipeline: sync.approvePipeline,
    }),
    [dispatch, sync.triggerPipeline, sync.approvePipeline],
  );

  return (
    <LumonStateContext.Provider value={state}>
      <LumonActionsContext.Provider value={actions}>
        <ServerSyncContext.Provider value={sync}>{children}</ServerSyncContext.Provider>
      </LumonActionsContext.Provider>
    </LumonStateContext.Provider>
  );
}

export function useLumonState() {
  const state = useContext(LumonStateContext);
  if (!state) {
    throw new Error("useLumonState must be used within a LumonProvider");
  }

  return state;
}

export function useLumonActions() {
  const actions = useContext(LumonActionsContext);
  if (!actions) {
    throw new Error("useLumonActions must be used within a LumonProvider");
  }

  return actions;
}

export function useLumonSelector(selector) {
  const state = useLumonState();
  return useMemo(() => selector(state), [selector, state]);
}

export function useServerSyncStatus() {
  const sync = useContext(ServerSyncContext);
  if (!sync) {
    throw new Error("useServerSyncStatus must be used within a LumonProvider");
  }
  return sync;
}

export function useLumon() {
  return {
    state: useLumonState(),
    actions: useLumonActions(),
  };
}
