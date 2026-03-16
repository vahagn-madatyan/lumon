import { describe, it, expect } from "vitest";
import {
  createPipelineStage,
  createProject,
  isStructuredOutput,
  getOutputSummary,
  createLumonState,
} from "../model";
import { selectSelectedProjectDetail, selectDashboardProjects } from "../selectors";
import { lumonReducer } from "../reducer";

// --- Helpers ---

const STRUCTURED_OUTPUT = Object.freeze({
  artifactId: "art-viability-001",
  summary: "Viability analysis complete — 3 risks identified",
  type: "viability-report",
});

const STRING_OUTPUT = "Research complete";

const makeProjectWithStageOutput = (stageKey, output) =>
  createLumonState({
    projects: [
      {
        id: "proj-test",
        name: "Test Project",
        execution: {
          stages: [
            { stageKey: "intake", status: "complete", output: "Intake done" },
            { stageKey, status: "complete", output },
          ],
        },
      },
    ],
    selection: { projectId: "proj-test" },
  });

// --- isStructuredOutput ---

describe("isStructuredOutput", () => {
  it("returns true for a valid artifact reference object", () => {
    expect(isStructuredOutput(STRUCTURED_OUTPUT)).toBe(true);
  });

  it("returns true with minimal artifactId-only object", () => {
    expect(isStructuredOutput({ artifactId: "abc" })).toBe(true);
  });

  it("returns false for a string", () => {
    expect(isStructuredOutput(STRING_OUTPUT)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isStructuredOutput(null)).toBe(false);
    expect(isStructuredOutput(undefined)).toBe(false);
  });

  it("returns false for an object without artifactId", () => {
    expect(isStructuredOutput({ summary: "hi" })).toBe(false);
  });

  it("returns false for an object with empty artifactId", () => {
    expect(isStructuredOutput({ artifactId: "" })).toBe(false);
  });
});

// --- getOutputSummary ---

describe("getOutputSummary", () => {
  it("returns the string as-is for string output", () => {
    expect(getOutputSummary(STRING_OUTPUT)).toBe("Research complete");
  });

  it("returns summary from a structured output", () => {
    expect(getOutputSummary(STRUCTURED_OUTPUT)).toBe(
      "Viability analysis complete — 3 risks identified",
    );
  });

  it("falls back to artifactId when summary is missing", () => {
    expect(getOutputSummary({ artifactId: "art-123" })).toBe("art-123");
  });

  it('returns "Pending" for null/undefined', () => {
    expect(getOutputSummary(null)).toBe("Pending");
    expect(getOutputSummary(undefined)).toBe("Pending");
  });

  it('returns "Pending" for non-string, non-object values', () => {
    expect(getOutputSummary(42)).toBe("Pending");
  });
});

// --- createPipelineStage ---

describe("createPipelineStage output normalization", () => {
  it("preserves string output unchanged", () => {
    const stage = createPipelineStage({ stageKey: "intake", output: STRING_OUTPUT });
    expect(stage.output).toBe(STRING_OUTPUT);
  });

  it("preserves structured artifact reference object", () => {
    const stage = createPipelineStage({
      stageKey: "research",
      output: STRUCTURED_OUTPUT,
    });
    expect(stage.output).toEqual(STRUCTURED_OUTPUT);
    expect(stage.output.artifactId).toBe("art-viability-001");
    expect(stage.output.summary).toBe("Viability analysis complete — 3 risks identified");
    expect(stage.output.type).toBe("viability-report");
  });

  it("copies the structured object (no shared reference)", () => {
    const mutable = { ...STRUCTURED_OUTPUT };
    const stage = createPipelineStage({ stageKey: "research", output: mutable });
    mutable.summary = "mutated";
    expect(stage.output.summary).toBe(STRUCTURED_OUTPUT.summary);
  });

  it('defaults to "Pending" when output is omitted', () => {
    const stage = createPipelineStage({ stageKey: "plan" });
    expect(stage.output).toBe("Pending");
  });
});

// --- Selector view models ---

describe("selector view models with artifact references", () => {
  it("projects outputSummary, artifactId, and hasArtifact for structured output", () => {
    const state = makeProjectWithStageOutput("research", STRUCTURED_OUTPUT);
    const projects = selectDashboardProjects(state);
    const researchStage = projects[0].stageTimeline.find((s) => s.stageKey === "research");

    expect(researchStage.output).toEqual(STRUCTURED_OUTPUT);
    expect(researchStage.outputSummary).toBe("Viability analysis complete — 3 risks identified");
    expect(researchStage.artifactId).toBe("art-viability-001");
    expect(researchStage.hasArtifact).toBe(true);
  });

  it("projects outputSummary as the string and null artifactId for string output", () => {
    const state = makeProjectWithStageOutput("research", STRING_OUTPUT);
    const projects = selectDashboardProjects(state);
    const researchStage = projects[0].stageTimeline.find((s) => s.stageKey === "research");

    expect(researchStage.output).toBe(STRING_OUTPUT);
    expect(researchStage.outputSummary).toBe(STRING_OUTPUT);
    expect(researchStage.artifactId).toBeNull();
    expect(researchStage.hasArtifact).toBe(false);
  });

  it("exposes artifact fields in dossier stage sections", () => {
    const state = makeProjectWithStageOutput("research", STRUCTURED_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const researchSection = detail.dossier.stageOutputs.find((s) => s.stageKey === "research");

    expect(researchSection.outputSummary).toBe("Viability analysis complete — 3 risks identified");
    expect(researchSection.artifactId).toBe("art-viability-001");
    expect(researchSection.hasArtifact).toBe(true);
    // summary (the display text) should use the summary string, not the raw object
    expect(researchSection.summary).toBe("Viability analysis complete — 3 risks identified");
  });

  it("exposes null artifact fields in dossier stage sections for string output", () => {
    const state = makeProjectWithStageOutput("research", STRING_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const researchSection = detail.dossier.stageOutputs.find((s) => s.stageKey === "research");

    expect(researchSection.outputSummary).toBe(STRING_OUTPUT);
    expect(researchSection.artifactId).toBeNull();
    expect(researchSection.hasArtifact).toBe(false);
    expect(researchSection.summary).toBe(STRING_OUTPUT);
  });

  it("passes artifactId through handoff packet evidence", () => {
    const state = makeProjectWithStageOutput("research", STRUCTURED_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const archSection = detail.handoffPacket.sections.find((s) => s.id === "handoff:architecture");
    const researchEvidence = archSection.evidence.find((e) => e.stageKey === "research");

    expect(researchEvidence.artifactId).toBe("art-viability-001");
    expect(researchEvidence.hasArtifact).toBe(true);
    expect(researchEvidence.outputSummary).toBe("Viability analysis complete — 3 risks identified");
  });
});

// --- Multi-artifact projection ---

const MULTI_ARTIFACT_OUTPUT = Object.freeze({
  artifactId: "art-tech-002",
  summary: "Tech research complete",
  type: "tech_research",
  artifactIds: ["art-biz-001", "art-tech-002"],
});

describe("multi-artifact artifactIds projection", () => {
  it("projects artifactIds array in dossier stage section", () => {
    const state = makeProjectWithStageOutput("research", MULTI_ARTIFACT_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const researchSection = detail.dossier.stageOutputs.find((s) => s.stageKey === "research");

    expect(researchSection.artifactIds).toEqual(["art-biz-001", "art-tech-002"]);
    expect(researchSection.artifactId).toBe("art-tech-002");
    expect(researchSection.hasArtifact).toBe(true);
  });

  it("projects artifactIds in stage timeline view model", () => {
    const state = makeProjectWithStageOutput("research", MULTI_ARTIFACT_OUTPUT);
    const projects = selectDashboardProjects(state);
    const researchStage = projects[0].stageTimeline.find((s) => s.stageKey === "research");

    expect(researchStage.artifactIds).toEqual(["art-biz-001", "art-tech-002"]);
    expect(researchStage.artifactId).toBe("art-tech-002");
  });

  it("projects artifactIds in handoff packet evidence", () => {
    const state = makeProjectWithStageOutput("research", MULTI_ARTIFACT_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const archSection = detail.handoffPacket.sections.find((s) => s.id === "handoff:architecture");
    const researchEvidence = archSection.evidence.find((e) => e.stageKey === "research");

    expect(researchEvidence.artifactIds).toEqual(["art-biz-001", "art-tech-002"]);
    expect(researchEvidence.hasArtifact).toBe(true);
  });

  it("preserves single-artifact backward compatibility (null artifactIds)", () => {
    const state = makeProjectWithStageOutput("research", STRUCTURED_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const researchSection = detail.dossier.stageOutputs.find((s) => s.stageKey === "research");

    // Single-artifact output doesn't have artifactIds array
    expect(researchSection.artifactIds).toBeNull();
    expect(researchSection.artifactId).toBe("art-viability-001");
    expect(researchSection.hasArtifact).toBe(true);
  });

  it("preserves string output backward compatibility", () => {
    const state = makeProjectWithStageOutput("research", STRING_OUTPUT);
    const detail = selectSelectedProjectDetail(state);
    const researchSection = detail.dossier.stageOutputs.find((s) => s.stageKey === "research");

    expect(researchSection.artifactIds).toBeNull();
    expect(researchSection.artifactId).toBeNull();
    expect(researchSection.hasArtifact).toBe(false);
  });
});

// --- Reducer append-artifact action ---

describe("lumon/append-artifact reducer action", () => {
  it("creates initial artifact reference from string output", () => {
    const state = makeProjectWithStageOutput("research", "Pending research kickoff");
    

    const nextState = lumonReducer(state, {
      type: "lumon/append-artifact",
      payload: {
        stageId: "proj-test:research",
        artifact: {
          artifactId: "art-biz-001",
          summary: "Business plan ready",
          type: "business_plan",
        },
      },
    });

    const stage = nextState.projects[0].execution.stages.find((s) => s.stageKey === "research");
    expect(stage.output.artifactId).toBe("art-biz-001");
    expect(stage.output.artifactIds).toEqual(["art-biz-001"]);
    expect(stage.output.summary).toBe("Business plan ready");
    expect(stage.output.type).toBe("business_plan");
  });

  it("accumulates second artifact without clobbering first", () => {
    const state = makeProjectWithStageOutput("research", {
      artifactId: "art-biz-001",
      summary: "Business plan ready",
      type: "business_plan",
      artifactIds: ["art-biz-001"],
    });
    

    const nextState = lumonReducer(state, {
      type: "lumon/append-artifact",
      payload: {
        stageId: "proj-test:research",
        artifact: {
          artifactId: "art-tech-002",
          summary: "Tech research complete",
          type: "tech_research",
        },
      },
    });

    const stage = nextState.projects[0].execution.stages.find((s) => s.stageKey === "research");
    expect(stage.output.artifactId).toBe("art-tech-002"); // latest is primary
    expect(stage.output.artifactIds).toEqual(["art-biz-001", "art-tech-002"]);
    expect(stage.output.summary).toBe("Tech research complete");
  });

  it("deduplicates when same artifactId is appended twice", () => {
    const state = makeProjectWithStageOutput("research", {
      artifactId: "art-biz-001",
      summary: "Business plan ready",
      type: "business_plan",
      artifactIds: ["art-biz-001"],
    });
    

    const nextState = lumonReducer(state, {
      type: "lumon/append-artifact",
      payload: {
        stageId: "proj-test:research",
        artifact: {
          artifactId: "art-biz-001",
          summary: "Updated business plan",
          type: "business_plan",
        },
      },
    });

    const stage = nextState.projects[0].execution.stages.find((s) => s.stageKey === "research");
    expect(stage.output.artifactIds).toEqual(["art-biz-001"]); // no duplicates
    expect(stage.output.summary).toBe("Updated business plan"); // summary updated
  });

  it("ignores action with missing stageId", () => {
    const state = makeProjectWithStageOutput("research", "Pending");
    

    const nextState = lumonReducer(state, {
      type: "lumon/append-artifact",
      payload: { artifact: { artifactId: "art-001", summary: "x", type: "y" } },
    });

    expect(nextState).toBe(state);
  });
});
