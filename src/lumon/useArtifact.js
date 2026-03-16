import { useEffect, useState } from "react";

/**
 * Module-level cache for fetched artifacts.
 * Prevents re-fetching the same artifact across renders and component instances.
 */
const artifactCache = new Map();

/**
 * Fetch and cache a single artifact by ID.
 *
 * @param {string|null|undefined} artifactId
 * @returns {{ artifact: object|null, loading: boolean, error: string|null }}
 */
export function useArtifact(artifactId) {
  const [artifact, setArtifact] = useState(() =>
    artifactId ? artifactCache.get(artifactId) ?? null : null,
  );
  const [loading, setLoading] = useState(() =>
    artifactId ? !artifactCache.has(artifactId) : false,
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!artifactId) {
      setArtifact(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Return cached immediately
    if (artifactCache.has(artifactId)) {
      setArtifact(artifactCache.get(artifactId));
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/artifacts/${encodeURIComponent(artifactId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Artifact fetch failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        artifactCache.set(artifactId, data);
        setArtifact(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`[useArtifact] Failed to fetch artifactId=${artifactId}`, err);
        setError(err.message ?? "Unknown error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  return { artifact, loading, error };
}

/**
 * Clear the artifact cache. Primarily for tests.
 */
export function clearArtifactCache() {
  artifactCache.clear();
}
