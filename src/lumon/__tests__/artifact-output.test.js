import { describe, it, expect } from "vitest";
import {
  createPipelineStage,
  createProject,
  isStructuredOutput,
  getOutputSummary,
} from "../model";
import { selectSelectedProjectDetail, selectDashboardProjects } from "../selectors";
import { createLumonState } from "../model";

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
