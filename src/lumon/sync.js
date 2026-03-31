import { useCallback, useEffect, useRef, useState } from "react";

/** Backoff range: 2s → 4s → 8s → 16s → 30s cap */
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

/**
 * useServerSync — connects to the bridge server SSE stream and dispatches
 * reducer actions from server events. Also exposes trigger/approve API helpers.
 *
 * Uses manual reconnection with exponential backoff to prevent the infinite
 * re-render loop caused by EventSource's native auto-reconnect firing onerror
 * repeatedly when the server is unreachable.
 *
 * @param {{ projectId: string|null, dispatch: Function }} options
 * @returns {{ connected: boolean, lastEvent: object|null, error: string|null, triggerPipeline: Function, approvePipeline: Function }}
 */
export function useServerSync({ projectId, dispatch }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);

  useEffect(() => {
    if (!projectId) {
      // No project selected — close any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      backoffRef.current = INITIAL_BACKOFF_MS;
      setConnected(false);
      setLastEvent(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const url = `/api/pipeline/events/${encodeURIComponent(projectId)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("connected", () => {
        if (cancelled) return;
        backoffRef.current = INITIAL_BACKOFF_MS; // reset on success
        setConnected(true);
        setError(null);
        console.log(`[sync] SSE connected projectId=${projectId}`);
      });

    es.addEventListener("stage-update", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "stage-update", ...payload });

        // Dispatch updateStage with the stageKey and received data
        if (dispatch && payload.stageKey) {
          const stageId = `${payload.projectId}:${payload.stageKey}`;
          const changes = {};
          if (payload.data?.status) changes.status = payload.data.status;
          if (payload.data?.output) changes.output = payload.data.output;
          dispatch({ type: "lumon/update-stage", payload: { stageId, changes } });
        }
      } catch (err) {
        console.error("[sync] Failed to parse stage-update event", err);
      }
    });

    es.addEventListener("artifact-ready", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "artifact-ready", ...payload });

        // Dispatch appendArtifact to accumulate multiple artifacts per stage
        if (dispatch && payload.stageKey && payload.data?.artifactId) {
          const stageId = `${payload.projectId}:${payload.stageKey}`;
          console.log(`[sync] artifact-ready stageId=${stageId} artifactId=${payload.data.artifactId} type=${payload.data.type || "stage-result"}`);
          dispatch({
            type: "lumon/append-artifact",
            payload: {
              stageId,
              artifact: {
                artifactId: payload.data.artifactId,
                summary: payload.data.summary || "Artifact ready",
                type: payload.data.type || "stage-result",
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse artifact-ready event", err);
      }
    });

    es.addEventListener("provisioning-progress", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "provisioning-progress", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] provisioning-progress projectId=${payload.projectId} step=${payload.data?.step}`);
          dispatch({
            type: "lumon/update-provisioning",
            payload: {
              projectId: payload.projectId,
              changes: {
                status: "provisioning",
                ...(payload.data?.steps ? { steps: payload.data.steps } : {}),
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse provisioning-progress event", err);
      }
    });

    es.addEventListener("provisioning-complete", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "provisioning-complete", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] provisioning-complete projectId=${payload.projectId}`);
          dispatch({
            type: "lumon/update-provisioning",
            payload: {
              projectId: payload.projectId,
              changes: {
                status: "complete",
                repoUrl: payload.data?.repoUrl ?? null,
                workspacePath: payload.data?.workspacePath ?? null,
                error: null,
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse provisioning-complete event", err);
      }
    });

    es.addEventListener("provisioning-error", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "provisioning-error", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] provisioning-error projectId=${payload.projectId} error=${payload.data?.error}`);
          dispatch({
            type: "lumon/update-provisioning",
            payload: {
              projectId: payload.projectId,
              changes: {
                status: "failed",
                error: payload.data?.error ?? "Unknown provisioning error",
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse provisioning-error event", err);
      }
    });

    // ----- Build execution SSE listeners -----

    es.addEventListener("build-agent-spawned", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-agent-spawned", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-agent-spawned projectId=${payload.projectId} agentId=${payload.agentId}`);
          dispatch({
            type: "lumon/update-build-agent",
            payload: {
              projectId: payload.projectId,
              agentId: payload.agentId,
              changes: {
                agentType: payload.agentType,
                status: "running",
                pid: payload.pid,
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-agent-spawned event", err);
      }
    });

    es.addEventListener("build-agent-output", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-agent-output", ...payload });

        if (dispatch && payload.projectId && payload.agentId) {
          dispatch({
            type: "lumon/update-build-agent",
            payload: {
              projectId: payload.projectId,
              agentId: payload.agentId,
              changes: {
                lastOutput: payload.line,
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-agent-output event", err);
      }
    });

    es.addEventListener("build-agent-completed", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-agent-completed", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-agent-completed projectId=${payload.projectId} agentId=${payload.agentId}`);
          if (payload.agentId) {
            dispatch({
              type: "lumon/update-build-agent",
              payload: {
                projectId: payload.projectId,
                agentId: payload.agentId,
                changes: {
                  status: "completed",
                  exitCode: payload.exitCode,
                  elapsed: payload.elapsed,
                },
              },
            });
          }
          dispatch({
            type: "lumon/complete-build",
            payload: { projectId: payload.projectId },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-agent-completed event", err);
      }
    });

    es.addEventListener("build-agent-failed", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-agent-failed", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-agent-failed projectId=${payload.projectId} agentId=${payload.agentId} error=${payload.error}`);
          if (payload.agentId) {
            dispatch({
              type: "lumon/update-build-agent",
              payload: {
                projectId: payload.projectId,
                agentId: payload.agentId,
                changes: {
                  status: "failed",
                  error: payload.error,
                  elapsed: payload.elapsed,
                },
              },
            });
          }
          dispatch({
            type: "lumon/fail-build",
            payload: {
              projectId: payload.projectId,
              error: payload.error ?? "Agent build failed",
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-agent-failed event", err);
      }
    });

    es.addEventListener("build-status", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-status", ...payload });

        // build-status is an aggregate event — status transitions are already
        // handled by the granular events above. Log for diagnostics.
        if (payload.projectId) {
          console.log(`[sync] build-status projectId=${payload.projectId} status=${payload.status}`);
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-status event", err);
      }
    });

    // ----- Retry / escalation SSE listeners -----

    es.addEventListener("build-retry-started", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-retry-started", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-retry-started projectId=${payload.projectId} agentId=${payload.agentId} retryCount=${payload.retryCount}`);
          dispatch({
            type: "lumon/retry-build-agent",
            payload: {
              projectId: payload.projectId,
              agentId: payload.agentId,
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-retry-started event", err);
      }
    });

    es.addEventListener("build-escalation-raised", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-escalation-raised", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-escalation-raised projectId=${payload.projectId} reason=${payload.reason}`);
          dispatch({
            type: "lumon/escalate-build",
            payload: {
              projectId: payload.projectId,
              reason: payload.reason ?? "Agent failure after retry exhausted",
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-escalation-raised event", err);
      }
    });

    es.addEventListener("build-escalation-acknowledged", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "build-escalation-acknowledged", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] build-escalation-acknowledged projectId=${payload.projectId} decision=${payload.decision}`);
          dispatch({
            type: "lumon/acknowledge-escalation",
            payload: {
              projectId: payload.projectId,
              decision: payload.decision,
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse build-escalation-acknowledged event", err);
      }
    });

    // ----- External action SSE listeners -----

    es.addEventListener("external-action-requested", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "external-action-requested", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] external-action-requested projectId=${payload.projectId} actionId=${payload.actionId}`);
          dispatch({
            type: "lumon/request-external-action",
            payload: {
              projectId: payload.projectId,
              action: {
                id: payload.actionId,
                type: payload.type,
                params: payload.params ?? {},
                status: "pending",
                requestedAt: payload.requestedAt ?? new Date().toISOString(),
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse external-action-requested event", err);
      }
    });

    es.addEventListener("external-action-confirmed", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "external-action-confirmed", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] external-action-confirmed projectId=${payload.projectId} actionId=${payload.actionId}`);
          dispatch({
            type: "lumon/confirm-external-action",
            payload: {
              projectId: payload.projectId,
              actionId: payload.actionId,
              confirmedAt: payload.confirmedAt ?? new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse external-action-confirmed event", err);
      }
    });

    es.addEventListener("external-action-completed", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "external-action-completed", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] external-action-completed projectId=${payload.projectId} actionId=${payload.actionId}`);
          dispatch({
            type: "lumon/complete-external-action",
            payload: {
              projectId: payload.projectId,
              actionId: payload.actionId,
              result: payload.result ?? null,
              completedAt: payload.completedAt ?? new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse external-action-completed event", err);
      }
    });

    es.addEventListener("external-action-failed", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "external-action-failed", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] external-action-failed projectId=${payload.projectId} actionId=${payload.actionId}`);
          dispatch({
            type: "lumon/fail-external-action",
            payload: {
              projectId: payload.projectId,
              actionId: payload.actionId,
              error: payload.error ?? "Unknown error",
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse external-action-failed event", err);
      }
    });

    es.addEventListener("external-action-cancelled", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "external-action-cancelled", ...payload });

        if (dispatch && payload.projectId) {
          console.log(`[sync] external-action-cancelled projectId=${payload.projectId} actionId=${payload.actionId}`);
          dispatch({
            type: "lumon/cancel-external-action",
            payload: {
              projectId: payload.projectId,
              actionId: payload.actionId,
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse external-action-cancelled event", err);
      }
    });

    es.addEventListener("pipeline-status", (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLastEvent({ type: "pipeline-status", ...payload });

        // Dispatch updateProject if overall pipeline status changed
        if (dispatch && payload.projectId && payload.data?.status) {
          dispatch({
            type: "lumon/update-project",
            payload: {
              projectId: payload.projectId,
              changes: {
                meta: { lastPipelineStatus: payload.data.status },
              },
            },
          });
        }
      } catch (err) {
        console.error("[sync] Failed to parse pipeline-status event", err);
      }
    });

    es.onerror = () => {
      if (cancelled) return;
      setConnected(false);

      // Close the current EventSource to prevent its native auto-reconnect
      es.close();
      esRef.current = null;

      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      setError(`SSE disconnected — retrying in ${Math.round(delay / 1000)}s`);
      console.log(`[sync] SSE error projectId=${projectId} — reconnecting in ${delay}ms`);

      reconnectTimerRef.current = setTimeout(connect, delay);
    };
    }; // end connect()

    connect();

    // Cleanup: close EventSource when projectId changes or component unmounts
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      backoffRef.current = INITIAL_BACKOFF_MS;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnected(false);
      console.log(`[sync] SSE closed projectId=${projectId}`);
    };
  }, [projectId, dispatch]);

  /**
   * Trigger a pipeline run via REST API.
   * @param {string} triggerProjectId
   * @param {string} stageKey
   * @returns {Promise<{ executionId: string, status: string } | { error: string }>}
   */
  const triggerPipeline = useCallback(async (triggerProjectId, stageKey, extra = {}) => {
    try {
      const res = await fetch("/api/pipeline/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: triggerProjectId, stageKey, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
      }
      return data;
    } catch (err) {
      return { error: "Network error", reason: err.message };
    }
  }, []);

  /**
   * Approve or reject a pipeline stage via REST API.
   * @param {string} approveProjectId
   * @param {string} stageKey
   * @param {string} decision — "approved" or "rejected"
   * @returns {Promise<{ ok: boolean, decision: string } | { error: string }>}
   */
  const approvePipeline = useCallback(async (approveProjectId, stageKey, decision) => {
    try {
      const res = await fetch("/api/pipeline/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: approveProjectId, stageKey, decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || `HTTP ${res.status}`, reason: data.reason };
      }
      return data;
    } catch (err) {
      return { error: "Network error", reason: err.message };
    }
  }, []);

  return { connected, lastEvent, error, triggerPipeline, approvePipeline };
}
