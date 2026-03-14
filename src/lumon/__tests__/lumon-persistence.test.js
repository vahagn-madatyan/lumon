import { StrictMode, createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LumonProvider, useLumonState } from "../context";
import { createLumonState } from "../model";
import {
  LUMON_REGISTRY_ENVELOPE_KIND,
  LUMON_REGISTRY_STORAGE_KEY,
  LUMON_REGISTRY_VERSION,
  createLumonPersistence,
  saveLumonState,
} from "../persistence";

function RegistryProbe() {
  const state = useLumonState();

  return createElement(
    "output",
    { "data-testid": "lumon-registry-probe" },
    JSON.stringify({
      projectIds: state.projects.map((project) => project.id),
      selection: state.selection,
    }),
  );
}

const renderProvider = (props = {}) =>
  render(
    createElement(
      StrictMode,
      null,
      createElement(LumonProvider, props, createElement(RegistryProbe)),
    ),
  );

const readProbe = () => JSON.parse(screen.getByTestId("lumon-registry-probe").textContent ?? "{}");
const readEnvelope = () => JSON.parse(window.localStorage.getItem(LUMON_REGISTRY_STORAGE_KEY) ?? "null");

describe("Lumon persistence", () => {
  it("persists a versioned registry envelope and reloads it through the provider", async () => {
    const initialState = createLumonState({
      projects: [
        {
          id: "persisted-project",
          name: "Persisted Project",
          engineChoice: "codex",
          createdAt: "2026-02-10T00:00:00.000Z",
          updatedAt: "2026-02-10T00:30:00.000Z",
          agents: [{ id: "persisted-agent", name: "Persisted Agent", type: "codex" }],
          execution: {
            stages: [{ id: "persisted-stage", label: "Persisted Stage" }],
          },
        },
      ],
      selection: {
        projectId: "persisted-project",
        agentId: "persisted-agent",
        stageId: "persisted-stage",
      },
    });

    const firstRender = renderProvider({ initialState });

    await waitFor(() => {
      expect(readEnvelope()).toMatchObject({
        kind: LUMON_REGISTRY_ENVELOPE_KIND,
        version: LUMON_REGISTRY_VERSION,
        state: {
          selection: {
            projectId: "persisted-project",
            agentId: "persisted-agent",
            stageId: "persisted-stage",
          },
        },
      });
    });

    firstRender.unmount();
    renderProvider();

    expect(readProbe()).toEqual({
      projectIds: ["persisted-project"],
      selection: {
        projectId: "persisted-project",
        agentId: "persisted-agent",
        stageId: "persisted-stage",
      },
    });
  });

  it("restores intentionally empty registries instead of reseeding demo projects", () => {
    saveLumonState(createLumonState({ projects: [], selection: {} }));

    renderProvider();

    expect(readProbe()).toEqual({
      projectIds: [],
      selection: {
        projectId: null,
        agentId: null,
        stageId: null,
      },
    });
  });

  it("lets explicit initialState take precedence over persisted local registry state", () => {
    saveLumonState(
      createLumonState({
        projects: [{ id: "from-storage", name: "From Storage" }],
        selection: { projectId: "from-storage" },
      }),
    );

    renderProvider({
      initialState: createLumonState({
        projects: [{ id: "from-props", name: "From Props", engineChoice: "codex" }],
        selection: { projectId: "from-props" },
      }),
    });

    expect(readProbe()).toEqual({
      projectIds: ["from-props"],
      selection: {
        projectId: "from-props",
        agentId: null,
        stageId: null,
      },
    });
  });

  it("falls back to seed state when the persisted envelope is corrupt", () => {
    window.localStorage.setItem(LUMON_REGISTRY_STORAGE_KEY, "{not-json");

    renderProvider();

    expect(readProbe().projectIds[0]).toBe("wheely");
    expect(readProbe().projectIds).toHaveLength(14);
  });

  it("treats write-denied storage as unavailable and falls back safely", () => {
    const unavailableStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("storage denied");
      }),
      removeItem: vi.fn(() => {
        throw new Error("storage denied");
      }),
    };
    const persistence = createLumonPersistence({
      storage: unavailableStorage,
      storageKey: "lumon.registry.unavailable",
    });

    renderProvider({ persistence });

    expect(persistence.isAvailable()).toBe(false);
    expect(readProbe().projectIds[0]).toBe("wheely");
    expect(readProbe().projectIds).toHaveLength(14);
    expect(unavailableStorage.setItem).toHaveBeenCalled();
  });
});
