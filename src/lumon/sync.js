import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useServerSync — connects to the bridge server SSE stream and dispatches
 * reducer actions from server events. Also exposes trigger/approve API helpers.
 *
 * @param {{ projectId: string|null, dispatch: Function }} options
 * @returns {{ connected: boolean, lastEvent: object|null, error: string|null, triggerPipeline: Function, approvePipeline: Function }}
 */
export function useServerSync({ projectId, dispatch }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    if (!projectId) {
      // No project selected — close any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnected(false);
      setLastEvent(null);
      setError(null);
      return;
    }

    const url = `/api/pipeline/events/${encodeURIComponent(projectId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
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
      setConnected(false);
      setError("SSE connection lost — reconnecting");
      console.log(`[sync] SSE error projectId=${projectId} — EventSource will auto-reconnect`);
    };

    // Cleanup: close EventSource when projectId changes or component unmounts
    return () => {
      es.close();
      esRef.current = null;
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
