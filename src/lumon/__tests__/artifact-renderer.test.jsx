import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ArtifactRenderer, {
  ViabilityRenderer,
  BusinessPlanRenderer,
  TechResearchRenderer,
  GenericRenderer,
  NamingCandidatesRenderer,
  DomainSignalsRenderer,
  TrademarkSignalsRenderer,
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

// --- NamingCandidatesRenderer ---

describe("NamingCandidatesRenderer", () => {
  const content = {
    methodology: "Linguistic analysis with cultural screening",
    candidates: [
      {
        name: "Nexus",
        rationale: "Connotes connection and centrality",
        domainHint: "nexus.io likely available",
        styleTags: ["tech", "modern"],
      },
      {
        name: "Arcline",
        rationale: "Geometric elegance meets utility",
        domainHint: "arcline.com available",
        styleTags: ["minimal", "clean"],
      },
    ],
  };

  it("renders candidate list with names and rationale", () => {
    render(<NamingCandidatesRenderer content={content} />);
    expect(screen.getByTestId("naming-candidates-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("naming-candidate-0")).toBeInTheDocument();
    expect(screen.getByTestId("naming-candidate-1")).toBeInTheDocument();
    expect(screen.getByText("Nexus")).toBeInTheDocument();
    expect(screen.getByText("Connotes connection and centrality")).toBeInTheDocument();
    expect(screen.getByText("Arcline")).toBeInTheDocument();
  });

  it("renders style tags as badges", () => {
    render(<NamingCandidatesRenderer content={content} />);
    expect(screen.getByTestId("naming-candidate-0-tag-0")).toBeInTheDocument();
    expect(screen.getByText("tech")).toBeInTheDocument();
    expect(screen.getByText("modern")).toBeInTheDocument();
  });

  it("Select button calls onAction with correct payload", () => {
    const onAction = vi.fn();
    render(<NamingCandidatesRenderer content={content} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("naming-candidate-0-select"));
    expect(onAction).toHaveBeenCalledWith({ type: "select-name", selectedName: "Nexus" });
  });

  it("renders nothing when content is null", () => {
    const { container } = render(<NamingCandidatesRenderer content={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders methodology section when present", () => {
    render(<NamingCandidatesRenderer content={content} />);
    expect(screen.getByTestId("naming-methodology")).toBeInTheDocument();
  });

  it("disables Select buttons when onAction is not provided", () => {
    render(<NamingCandidatesRenderer content={content} />);
    expect(screen.getByTestId("naming-candidate-0-select")).toBeDisabled();
  });
});

// --- DomainSignalsRenderer ---

describe("DomainSignalsRenderer", () => {
  const content = {
    disclaimer: "Custom domain disclaimer text.",
    selectedName: "Nexus",
    signals: [
      { domain: "nexus.com", status: "taken" },
      { domain: "nexus.io", status: "available", price: "$29/yr" },
      { domain: "nexus.ai", status: "premium", price: "$2,500" },
    ],
  };

  it("renders domain signals with status badges", () => {
    render(<DomainSignalsRenderer content={content} />);
    expect(screen.getByTestId("domain-signals-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("domain-signal-0")).toBeInTheDocument();
    expect(screen.getByText("nexus.com")).toBeInTheDocument();
    expect(screen.getByText("nexus.io")).toBeInTheDocument();
  });

  it("advisory disclaimer banner is present with correct text", () => {
    render(<DomainSignalsRenderer content={content} />);
    const disclaimer = screen.getByTestId("domain-advisory-disclaimer");
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer.textContent).toBe("Custom domain disclaimer text.");
  });

  it("uses default disclaimer when content.disclaimer is missing", () => {
    render(<DomainSignalsRenderer content={{ signals: [] }} />);
    const disclaimer = screen.getByTestId("domain-advisory-disclaimer");
    expect(disclaimer.textContent).toContain("point-in-time advisory signal");
  });

  it("status badges use correct color treatment", () => {
    render(<DomainSignalsRenderer content={content} />);
    const takenBadge = screen.getByTestId("domain-signal-0-status");
    expect(takenBadge.textContent).toBe("taken");
    expect(takenBadge.className).toContain("text-red-300");

    const availableBadge = screen.getByTestId("domain-signal-1-status");
    expect(availableBadge.textContent).toBe("available");
    expect(availableBadge.className).toContain("text-emerald-300");

    const premiumBadge = screen.getByTestId("domain-signal-2-status");
    expect(premiumBadge.textContent).toBe("premium");
    expect(premiumBadge.className).toContain("text-amber-300");
  });

  it("renders selected name header", () => {
    render(<DomainSignalsRenderer content={content} />);
    expect(screen.getByTestId("domain-selected-name").textContent).toBe("Nexus");
  });
});

// --- TrademarkSignalsRenderer ---

describe("TrademarkSignalsRenderer", () => {
  const content = {
    disclaimer: "Custom trademark disclaimer.",
    selectedName: "Nexus",
    signals: [
      { mark: "NEXUS", status: "live", class: "009", registrationNumber: "1234567", owner: "Acme Corp" },
      { mark: "NEXUS LABS", status: "dead", class: "042" },
      { mark: "NEXUS AI", status: "pending", class: "009" },
    ],
  };

  it("renders trademark signals with status and class", () => {
    render(<TrademarkSignalsRenderer content={content} />);
    expect(screen.getByTestId("trademark-signals-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("trademark-signal-0")).toBeInTheDocument();
    expect(screen.getByText("NEXUS")).toBeInTheDocument();
    const classLabels = screen.getAllByText(/^Class \d+/);
    expect(classLabels.length).toBe(3);
  });

  it("advisory disclaimer banner is present with correct text", () => {
    render(<TrademarkSignalsRenderer content={content} />);
    const disclaimer = screen.getByTestId("trademark-advisory-disclaimer");
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer.textContent).toBe("Custom trademark disclaimer.");
  });

  it("uses default disclaimer when content.disclaimer is missing", () => {
    render(<TrademarkSignalsRenderer content={{ signals: [] }} />);
    const disclaimer = screen.getByTestId("trademark-advisory-disclaimer");
    expect(disclaimer.textContent).toContain("do not constitute legal advice");
  });

  it("renders selected name header", () => {
    render(<TrademarkSignalsRenderer content={content} />);
    expect(screen.getByTestId("trademark-selected-name").textContent).toBe("Nexus");
  });

  it("renders registration number and owner when present", () => {
    render(<TrademarkSignalsRenderer content={content} />);
    expect(screen.getByText("#1234567")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("status badges use correct color treatment", () => {
    render(<TrademarkSignalsRenderer content={content} />);
    const liveBadge = screen.getByTestId("trademark-signal-0-status");
    expect(liveBadge.textContent).toBe("live");
    expect(liveBadge.className).toContain("text-red-300");

    const deadBadge = screen.getByTestId("trademark-signal-1-status");
    expect(deadBadge.textContent).toBe("dead");
    expect(deadBadge.className).toContain("text-zinc-400");

    const pendingBadge = screen.getByTestId("trademark-signal-2-status");
    expect(pendingBadge.textContent).toBe("pending");
    expect(pendingBadge.className).toContain("text-amber-300");
  });
});

// --- ArtifactRenderer dispatch for new types ---

describe("ArtifactRenderer — new type dispatch", () => {
  it("dispatches to NamingCandidatesRenderer for naming_candidates type", () => {
    const artifact = {
      type: "naming_candidates",
      content: { candidates: [{ name: "Foo", rationale: "A name" }] },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("naming-candidates-renderer")).toBeInTheDocument();
  });

  it("dispatches to DomainSignalsRenderer for domain_signals type", () => {
    const artifact = {
      type: "domain_signals",
      content: { signals: [{ domain: "foo.com", status: "available" }] },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("domain-signals-renderer")).toBeInTheDocument();
  });

  it("dispatches to TrademarkSignalsRenderer for trademark_signals type", () => {
    const artifact = {
      type: "trademark_signals",
      content: { signals: [{ mark: "FOO", status: "dead", class: "009" }] },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("trademark-signals-renderer")).toBeInTheDocument();
  });

  it("forwards onAction prop to sub-renderer", () => {
    const onAction = vi.fn();
    const artifact = {
      type: "naming_candidates",
      content: { candidates: [{ name: "TestName", rationale: "Reason" }] },
    };
    render(<ArtifactRenderer artifact={artifact} onAction={onAction} />);
    fireEvent.click(screen.getByTestId("naming-candidate-0-select"));
    expect(onAction).toHaveBeenCalledWith({ type: "select-name", selectedName: "TestName" });
  });
});
