/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
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

  // Ref for state access inside memoized callbacks (avoids stale closure)
  const stateRef = useRef(state);
  stateRef.current = state;

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
      updateProvisioning: (projectId, changes) =>
        dispatch(lumonActions.updateProvisioning(projectId, changes)),
      previewProvisioning: async (projectId) => {
        dispatch(lumonActions.updateProvisioning(projectId, { status: "previewing", error: null }));
        try {
          const res = await fetch("/api/provisioning/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const data = await res.json();
          if (!res.ok) {
            dispatch(lumonActions.updateProvisioning(projectId, {
              status: "failed",
              error: data.error || `HTTP ${res.status}`,
            }));
            return { error: data.error || `HTTP ${res.status}` };
          }
          dispatch(lumonActions.updateProvisioning(projectId, {
            status: "confirming",
            previewPlan: data,
          }));
          return data;
        } catch (err) {
          dispatch(lumonActions.updateProvisioning(projectId, {
            status: "failed",
            error: err.message,
          }));
          return { error: err.message };
        }
      },
      executeProvisioning: async (projectId, options = {}) => {
        dispatch(lumonActions.updateProvisioning(projectId, { status: "provisioning", error: null }));
        try {
          const res = await fetch("/api/provisioning/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, ...options }),
          });
          const data = await res.json();
          if (!res.ok) {
            dispatch(lumonActions.updateProvisioning(projectId, {
              status: "failed",
              error: data.error || `HTTP ${res.status}`,
            }));
            return { error: data.error || `HTTP ${res.status}` };
          }
          // Status updates arrive via SSE — don't set complete here
          return data;
        } catch (err) {
          dispatch(lumonActions.updateProvisioning(projectId, {
            status: "failed",
            error: err.message,
          }));
          return { error: err.message };
        }
      },
      triggerPipeline: sync.triggerPipeline,
      approvePipeline: sync.approvePipeline,
      startBuild: async (projectId) => {
        // Optimistic update — set build to running immediately
        dispatch(lumonActions.startBuild(projectId));
        try {
          const currentState = stateRef.current;
          const project = currentState?.projects?.find((p) => p.id === projectId);
          const res = await fetch("/api/execution/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              workspacePath: project?.provisioning?.workspacePath,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            dispatch(lumonActions.failBuild(projectId, data.error || `HTTP ${res.status}`));
            return { error: data.error || `HTTP ${res.status}` };
          }
          // Real status updates arrive via SSE — 201 just confirms start
          return data;
        } catch (err) {
          dispatch(lumonActions.failBuild(projectId, err.message));
          return { error: err.message };
        }
      },
      retryBuildAgent: async (projectId, agentId) => {
        try {
          const res = await fetch("/api/execution/retry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, agentId }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // Real retry status arrives via SSE build-retry-started
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
      acknowledgeEscalation: async (projectId, decision) => {
        try {
          const res = await fetch("/api/execution/escalation/acknowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, decision }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // Real acknowledgment status arrives via SSE build-escalation-acknowledged
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
      requestExternalAction: async (projectId, type, params) => {
        try {
          const res = await fetch("/api/external-actions/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, type, params }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // State updates arrive via SSE external-action-requested
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
      confirmExternalAction: async (projectId, actionId) => {
        try {
          const res = await fetch(`/api/external-actions/confirm/${encodeURIComponent(actionId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // State updates arrive via SSE external-action-confirmed
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
      cancelExternalAction: async (projectId, actionId) => {
        try {
          const res = await fetch(`/api/external-actions/cancel/${encodeURIComponent(actionId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // State updates arrive via SSE external-action-cancelled
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
      executeExternalAction: async (projectId, actionId) => {
        try {
          const res = await fetch(`/api/external-actions/execute/${encodeURIComponent(actionId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
          }
          // State updates arrive via SSE external-action-completed/failed
          return data;
        } catch (err) {
          return { error: "Network error", reason: err.message };
        }
      },
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
