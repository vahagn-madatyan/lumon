/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer } from "react";
import { lumonActions, lumonReducer } from "./reducer";
import { createSeedLumonState } from "./seed";

const LumonStateContext = createContext(null);
const LumonActionsContext = createContext(null);

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

export function LumonProvider({ children, initialState }) {
  const [state, dispatch] = useReducer(
    lumonReducer,
    initialState ?? null,
    (seededState) => seededState ?? createSeedLumonState(),
  );

  const actions = useMemo(
    () => ({
      dispatch,
      hydrate: (payload) => dispatch(lumonActions.hydrate(payload)),
      selectProject: (projectId) => dispatch(lumonActions.selectProject(projectId)),
      selectAgent: (agentId) => dispatch(lumonActions.selectAgent(agentId)),
      selectStage: (stageId) => dispatch(lumonActions.selectStage(stageId)),
      updateAgent: (agentId, changes) => dispatch(lumonActions.updateAgent(agentId, changes)),
      updateStage: (stageId, changes) => dispatch(lumonActions.updateStage(stageId, changes)),
      setAgentStatus: (agent, status, changes = {}) => {
        if (!agent?.id) {
          return;
        }

        dispatch(lumonActions.updateAgent(agent.id, createStatusPatch(agent, status, changes)));
      },
    }),
    [dispatch],
  );

  return (
    <LumonStateContext.Provider value={state}>
      <LumonActionsContext.Provider value={actions}>{children}</LumonActionsContext.Provider>
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

export function useLumon() {
  return {
    state: useLumonState(),
    actions: useLumonActions(),
  };
}
