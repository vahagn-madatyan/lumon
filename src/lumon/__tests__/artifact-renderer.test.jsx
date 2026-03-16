import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ArtifactRenderer, {
  ViabilityRenderer,
  BusinessPlanRenderer,
  TechResearchRenderer,
  GenericRenderer,
} from "@/features/mission-control/ArtifactRenderer";

// --- ArtifactRenderer dispatcher ---

describe("ArtifactRenderer", () => {
  it("dispatches to ViabilityRenderer for viability_analysis type", () => {
    const artifact = {
      type: "viability_analysis",
      content: {
        marketAssessment: "Strong TAM",
        recommendation: "Proceed",
      },
    };

    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("viability-renderer")).toBeInTheDocument();
  });

  it("dispatches to BusinessPlanRenderer for business_plan type", () => {
    const artifact = {
      type: "business_plan",
      content: {
        targetAudience: "Indie devs",
        recommendation: "Build it",
      },
    };

    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("business-plan-renderer")).toBeInTheDocument();
  });

  it("dispatches to TechResearchRenderer for tech_research type", () => {
    const artifact = {
      type: "tech_research",
      content: {
        approaches: [{ name: "React", score: 9 }],
        recommendation: "Use React",
      },
    };

    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("tech-research-renderer")).toBeInTheDocument();
  });

  it("falls back to GenericRenderer for unknown type", () => {
    const artifact = {
      type: "mystery_artifact",
      content: { foo: "bar" },
    };

    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("generic-renderer")).toBeInTheDocument();
  });

  it("renders nothing when artifact is null", () => {
    const { container } = render(<ArtifactRenderer artifact={null} />);
    expect(container.innerHTML).toBe("");
  });
});

// --- BusinessPlanRenderer ---

describe("BusinessPlanRenderer", () => {
  const content = {
    targetAudience: "Solo founders building SaaS",
    pricingPosture: "Freemium with premium tier",
    featurePhases: [
      { name: "MVP", description: "Core auth and dashboard" },
      { name: "Growth", description: "Integrations and analytics" },
    ],
    revenueModel: "Subscription + usage fees",
    recommendation: "Target early adopters with free tier",
  };

  it("renders all expected sections", () => {
    render(<BusinessPlanRenderer content={content} />);

    expect(screen.getByTestId("business-plan-target-audience")).toBeInTheDocument();
    expect(screen.getByTestId("business-plan-pricing-posture")).toBeInTheDocument();
    expect(screen.getByTestId("business-plan-feature-phases")).toBeInTheDocument();
    expect(screen.getByTestId("business-plan-revenue-model")).toBeInTheDocument();
    expect(screen.getByTestId("business-plan-recommendation")).toBeInTheDocument();
  });

  it("renders target audience content", () => {
    render(<BusinessPlanRenderer content={content} />);
    expect(screen.getByText("Solo founders building SaaS")).toBeInTheDocument();
  });

  it("renders feature phase items", () => {
    render(<BusinessPlanRenderer content={content} />);
    expect(screen.getByText("MVP")).toBeInTheDocument();
    expect(screen.getByText("Core auth and dashboard")).toBeInTheDocument();
  });

  it("renders nothing when content is null", () => {
    const { container } = render(<BusinessPlanRenderer content={null} />);
    expect(container.innerHTML).toBe("");
  });
});

// --- TechResearchRenderer ---

describe("TechResearchRenderer", () => {
  const content = {
    approaches: [
      { name: "Next.js", score: 9, description: "Full-stack React", pros: ["SSR", "API routes"], cons: ["Bundle size"] },
      { name: "Remix", score: 7, description: "Nested routes", pros: ["Progressive enhancement"], cons: ["Smaller ecosystem"] },
    ],
    tradeoffs: "Next.js has larger community; Remix has better data loading patterns",
    recommendation: "Use Next.js for broader ecosystem support",
  };

  it("renders scored approaches", () => {
    render(<TechResearchRenderer content={content} />);

    expect(screen.getByTestId("tech-research-approach-0")).toBeInTheDocument();
    expect(screen.getByTestId("tech-research-approach-1")).toBeInTheDocument();
    expect(screen.getByText("Next.js")).toBeInTheDocument();
    expect(screen.getByText("Remix")).toBeInTheDocument();
  });

  it("renders score badges", () => {
    render(<TechResearchRenderer content={content} />);
    const badges = screen.getAllByTestId("score-badge");
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe("9/10");
    expect(badges[1].textContent).toBe("7/10");
  });

  it("renders pros and cons", () => {
    render(<TechResearchRenderer content={content} />);
    expect(screen.getByText(/SSR, API routes/)).toBeInTheDocument();
    expect(screen.getByText(/Bundle size/)).toBeInTheDocument();
  });

  it("renders tradeoffs section", () => {
    render(<TechResearchRenderer content={content} />);
    expect(screen.getByTestId("tech-research-tradeoffs")).toBeInTheDocument();
  });

  it("renders recommendation section", () => {
    render(<TechResearchRenderer content={content} />);
    expect(screen.getByTestId("tech-research-recommendation")).toBeInTheDocument();
  });
});

// --- ViabilityRenderer ---

describe("ViabilityRenderer", () => {
  const content = {
    marketAssessment: "Growing market with $2B TAM",
    technicalFeasibility: "Achievable with current stack",
    riskFactors: ["Market timing", "Competition from incumbents", "Talent acquisition"],
    recommendation: "Proceed with caution — validate PMF first",
  };

  it("renders all sections for S01 format", () => {
    render(<ViabilityRenderer content={content} />);

    expect(screen.getByTestId("viability-market-assessment")).toBeInTheDocument();
    expect(screen.getByTestId("viability-technical-feasibility")).toBeInTheDocument();
    expect(screen.getByTestId("viability-risk-factors")).toBeInTheDocument();
    expect(screen.getByTestId("viability-recommendation")).toBeInTheDocument();
  });

  it("renders risk factors as a list", () => {
    render(<ViabilityRenderer content={content} />);
    expect(screen.getByText("Market timing")).toBeInTheDocument();
    expect(screen.getByText("Competition from incumbents")).toBeInTheDocument();
    expect(screen.getByText("Talent acquisition")).toBeInTheDocument();
  });

  it("renders recommendation text", () => {
    render(<ViabilityRenderer content={content} />);
    expect(screen.getByText("Proceed with caution — validate PMF first")).toBeInTheDocument();
  });
});

// --- GenericRenderer ---

describe("GenericRenderer", () => {
  it("renders content as formatted JSON", () => {
    render(<GenericRenderer content={{ key: "value" }} type="unknown_type" />);
    expect(screen.getByTestId("generic-renderer")).toBeInTheDocument();
    expect(screen.getByText(/unknown_type/)).toBeInTheDocument();
  });

  it("renders string content directly", () => {
    render(<GenericRenderer content="plain text content" />);
    expect(screen.getByText("plain text content")).toBeInTheDocument();
  });
});
