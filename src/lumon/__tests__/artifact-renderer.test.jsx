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
  ArchitectureRenderer,
  SpecificationRenderer,
  PrototypeRenderer,
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

// --- ArchitectureRenderer ---

describe("ArchitectureRenderer", () => {
  const content = {
    systemOverview: "Microservices architecture with event-driven communication",
    components: [
      { name: "API Gateway", responsibility: "Route and authenticate requests", technology: "Express" },
      { name: "Worker Service", responsibility: "Process background jobs", technology: "BullMQ" },
    ],
    dataFlow: "Client → API Gateway → Message Queue → Worker → Database",
    deploymentModel: "Docker containers on Railway with PostgreSQL managed instance",
    recommendation: "Start with monolith, extract services as scale demands",
  };

  it("renders system overview and components sections", () => {
    render(<ArchitectureRenderer content={content} />);
    expect(screen.getByTestId("architecture-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-system-overview")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-components")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-data-flow")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-deployment-model")).toBeInTheDocument();
  });

  it("renders component cards with name, responsibility, technology", () => {
    render(<ArchitectureRenderer content={content} />);
    expect(screen.getByTestId("architecture-component-0")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-component-1")).toBeInTheDocument();
    expect(screen.getByText("API Gateway")).toBeInTheDocument();
    expect(screen.getByText("Route and authenticate requests")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-component-0-tech").textContent).toBe("Express");
    expect(screen.getByTestId("architecture-component-1-tech").textContent).toBe("BullMQ");
  });

  it("renders recommendation in emerald text", () => {
    render(<ArchitectureRenderer content={content} />);
    expect(screen.getByTestId("architecture-recommendation")).toBeInTheDocument();
    const recText = screen.getByText("Start with monolith, extract services as scale demands");
    expect(recText.className).toContain("text-emerald-300");
  });
});

// --- SpecificationRenderer ---

describe("SpecificationRenderer", () => {
  const content = {
    functionalRequirements: [
      { id: "FR-001", title: "User Authentication", description: "OAuth2 login with Google and GitHub", priority: "high" },
      { id: "FR-002", title: "Dashboard View", description: "Real-time metrics display", priority: "medium" },
      { id: "FR-003", title: "Export CSV", description: "Download data as CSV file", priority: "low" },
    ],
    nonFunctionalRequirements: [
      { category: "Performance", requirement: "API response under 200ms p95", metric: "<200ms" },
    ],
    apiContracts: [
      { endpoint: "/api/users", method: "GET", description: "List all users" },
      { endpoint: "/api/users", method: "POST", description: "Create a new user" },
      { endpoint: "/api/users/:id", method: "PUT", description: "Update user" },
      { endpoint: "/api/users/:id", method: "DELETE", description: "Delete user" },
    ],
    recommendation: "Prioritize authentication and dashboard for MVP",
  };

  it("renders functional requirements with id and priority", () => {
    render(<SpecificationRenderer content={content} />);
    expect(screen.getByTestId("specification-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("specification-functional-req-0-id").textContent).toBe("FR-001");
    expect(screen.getByTestId("specification-functional-req-1-id").textContent).toBe("FR-002");

    const highBadge = screen.getByTestId("specification-functional-req-0-priority");
    expect(highBadge.textContent).toBe("high");
    expect(highBadge.className).toContain("text-red-300");

    const medBadge = screen.getByTestId("specification-functional-req-1-priority");
    expect(medBadge.textContent).toBe("medium");
    expect(medBadge.className).toContain("text-amber-300");

    const lowBadge = screen.getByTestId("specification-functional-req-2-priority");
    expect(lowBadge.textContent).toBe("low");
    expect(lowBadge.className).toContain("text-zinc-400");
  });

  it("renders API contracts with method badges", () => {
    render(<SpecificationRenderer content={content} />);
    expect(screen.getByTestId("specification-api-contracts")).toBeInTheDocument();

    const getBadge = screen.getByTestId("specification-api-contract-0-method");
    expect(getBadge.textContent).toBe("GET");
    expect(getBadge.className).toContain("text-emerald-300");

    const postBadge = screen.getByTestId("specification-api-contract-1-method");
    expect(postBadge.textContent).toBe("POST");
    expect(postBadge.className).toContain("text-blue-300");

    const putBadge = screen.getByTestId("specification-api-contract-2-method");
    expect(putBadge.textContent).toBe("PUT");
    expect(putBadge.className).toContain("text-amber-300");

    const deleteBadge = screen.getByTestId("specification-api-contract-3-method");
    expect(deleteBadge.textContent).toBe("DELETE");
    expect(deleteBadge.className).toContain("text-red-300");
  });

  it("renders recommendation", () => {
    render(<SpecificationRenderer content={content} />);
    expect(screen.getByTestId("specification-recommendation")).toBeInTheDocument();
    const recText = screen.getByText("Prioritize authentication and dashboard for MVP");
    expect(recText.className).toContain("text-emerald-300");
  });
});

// --- PrototypeRenderer ---

describe("PrototypeRenderer", () => {
  const content = {
    projectStructure: "src/\n  index.ts\n  routes/\n    users.ts\n  models/\n    user.ts",
    entryPoints: [
      { file: "src/index.ts", purpose: "Application bootstrap and server start" },
    ],
    dependencies: [
      { name: "express", version: "^4.18.0", purpose: "HTTP server framework" },
      { name: "prisma", version: "^5.0.0", purpose: "Database ORM" },
    ],
    setupInstructions: "npm install\nnpx prisma generate\nnpm run dev",
    recommendation: "Use TypeScript strict mode from day one",
  };

  it("renders project structure as preformatted text", () => {
    render(<PrototypeRenderer content={content} />);
    expect(screen.getByTestId("prototype-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("prototype-project-structure")).toBeInTheDocument();
    const pre = screen.getByTestId("prototype-project-structure").querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre.textContent).toContain("src/");
    expect(pre.textContent).toContain("index.ts");
  });

  it("renders dependencies with name and version", () => {
    render(<PrototypeRenderer content={content} />);
    expect(screen.getByTestId("prototype-dependencies")).toBeInTheDocument();
    expect(screen.getByTestId("prototype-dependency-0")).toBeInTheDocument();
    expect(screen.getByText("express")).toBeInTheDocument();
    expect(screen.getByTestId("prototype-dependency-0-version").textContent).toBe("^4.18.0");
    expect(screen.getByText("prisma")).toBeInTheDocument();
    expect(screen.getByTestId("prototype-dependency-1-version").textContent).toBe("^5.0.0");
  });

  it("renders recommendation", () => {
    render(<PrototypeRenderer content={content} />);
    expect(screen.getByTestId("prototype-recommendation")).toBeInTheDocument();
    const recText = screen.getByText("Use TypeScript strict mode from day one");
    expect(recText.className).toContain("text-emerald-300");
  });
});

// --- ArtifactRenderer dispatch for verification types ---

describe("ArtifactRenderer — verification type dispatch", () => {
  it("dispatches architecture_outline to ArchitectureRenderer", () => {
    const artifact = {
      type: "architecture_outline",
      content: { systemOverview: "Monolith with REST API" },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("architecture-renderer")).toBeInTheDocument();
  });

  it("dispatches specification to SpecificationRenderer", () => {
    const artifact = {
      type: "specification",
      content: { functionalRequirements: [{ id: "FR-001", title: "Auth", priority: "high" }] },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("specification-renderer")).toBeInTheDocument();
  });

  it("dispatches prototype_scaffold to PrototypeRenderer", () => {
    const artifact = {
      type: "prototype_scaffold",
      content: { projectStructure: "src/\n  main.ts" },
    };
    render(<ArtifactRenderer artifact={artifact} />);
    expect(screen.getByTestId("prototype-renderer")).toBeInTheDocument();
  });
});

// --- DomainSignalsRenderer — real Porkbun data ---

describe("DomainSignalsRenderer — real Porkbun data", () => {
  const realPorkbunContent = {
    selectedName: "acmetools",
    disclaimer: "Domain availability is a point-in-time check. Results may change. Pricing is sourced from Porkbun and subject to change.",
    source: "porkbun-api",
    dataOrigin: "Porkbun Domain Availability API",
    signals: [
      {
        domain: "acmetools.com",
        status: "available",
        price: "$9.73/yr",
        registrar: "Porkbun",
        renewalPrice: "$9.73/yr",
        regularPrice: "$9.73/yr",
        premium: false,
        firstYearPromo: false,
      },
      {
        domain: "acmetools.io",
        status: "available",
        price: "$24.94/yr",
        registrar: "Porkbun",
        renewalPrice: "$32.00/yr",
        regularPrice: "$32.00/yr",
        premium: false,
        firstYearPromo: true,
      },
      {
        domain: "acmetools.dev",
        status: "taken",
        price: null,
        registrar: "Porkbun",
        renewalPrice: null,
        regularPrice: null,
        premium: false,
        firstYearPromo: false,
      },
      {
        domain: "acmetools.ai",
        status: "premium",
        price: "$2,500.00/yr",
        registrar: "Porkbun",
        renewalPrice: "$69.00/yr",
        regularPrice: "$69.00/yr",
        premium: true,
        firstYearPromo: false,
      },
    ],
  };

  it("renders source attribution when dataOrigin is present", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    const attribution = screen.getByTestId("domain-source-attribution");
    expect(attribution).toBeInTheDocument();
    expect(attribution.textContent).toBe("Source: Porkbun Domain Availability API");
  });

  it("renders source attribution using content.source when dataOrigin is absent", () => {
    const { dataOrigin, ...contentWithSource } = realPorkbunContent;
    render(<DomainSignalsRenderer content={contentWithSource} />);
    const attribution = screen.getByTestId("domain-source-attribution");
    expect(attribution.textContent).toBe("Source: porkbun-api");
  });

  it("renders renewal price when present on a signal", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    const renewal0 = screen.getByTestId("domain-signal-0-renewal");
    expect(renewal0).toBeInTheDocument();
    expect(renewal0.textContent).toBe("Renews: $9.73/yr");

    const renewal1 = screen.getByTestId("domain-signal-1-renewal");
    expect(renewal1.textContent).toBe("Renews: $32.00/yr");
  });

  it("does not render renewal price when value is null", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    // Signal at index 2 (acmetools.dev) has renewalPrice: null
    expect(screen.queryByTestId("domain-signal-2-renewal")).not.toBeInTheDocument();
  });

  it("renders PROMO badge when firstYearPromo is truthy", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    // Signal at index 1 (acmetools.io) has firstYearPromo: true
    const promo = screen.getByTestId("domain-signal-1-promo");
    expect(promo).toBeInTheDocument();
    expect(promo.textContent).toBe("PROMO");
  });

  it("does not render PROMO badge when firstYearPromo is falsy", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    expect(screen.queryByTestId("domain-signal-0-promo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("domain-signal-2-promo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("domain-signal-3-promo")).not.toBeInTheDocument();
  });

  it("renders all four signals with correct statuses", () => {
    render(<DomainSignalsRenderer content={realPorkbunContent} />);
    expect(screen.getByTestId("domain-signal-0-status").textContent).toBe("available");
    expect(screen.getByTestId("domain-signal-1-status").textContent).toBe("available");
    expect(screen.getByTestId("domain-signal-2-status").textContent).toBe("taken");
    expect(screen.getByTestId("domain-signal-3-status").textContent).toBe("premium");
  });

  it("backward compatibility: old simulated data shape renders identically (no source attribution)", () => {
    const oldContent = {
      selectedName: "Nexus",
      signals: [
        { domain: "nexus.com", status: "taken" },
        { domain: "nexus.io", status: "available", price: "$29/yr" },
      ],
    };
    render(<DomainSignalsRenderer content={oldContent} />);
    expect(screen.getByTestId("domain-signals-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("domain-source-attribution")).not.toBeInTheDocument();
    expect(screen.queryByTestId("domain-signal-0-promo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("domain-signal-0-renewal")).not.toBeInTheDocument();
    expect(screen.getByTestId("domain-signal-0-status").textContent).toBe("taken");
    expect(screen.getByTestId("domain-signal-1-status").textContent).toBe("available");
  });
});

// --- TrademarkSignalsRenderer — enhanced advisory ---

describe("TrademarkSignalsRenderer — enhanced advisory", () => {
  const enhancedContent = {
    disclaimer: "ADVISORY ONLY — These results are generated from a simulated database for planning purposes and do not constitute legal advice. They do not represent actual USPTO TESS search results. Consult a qualified trademark attorney before making any business decisions based on this information.",
    dataOrigin: "Simulated advisory database (not connected to USPTO TESS)",
    sourceNote: "Trademark signals are illustrative. Real trademark clearance requires professional legal search services.",
    selectedName: "AcmeTools",
    signals: [
      { mark: "ACME TOOLS", status: "live", class: "008", registrationNumber: "5678901", owner: "Acme Industries LLC" },
      { mark: "ACMETOOLS", status: "dead", class: "009" },
    ],
  };

  it("renders source attribution when dataOrigin is present", () => {
    render(<TrademarkSignalsRenderer content={enhancedContent} />);
    const attribution = screen.getByTestId("trademark-source-attribution");
    expect(attribution).toBeInTheDocument();
    expect(attribution.textContent).toBe("Source: Simulated advisory database (not connected to USPTO TESS)");
  });

  it("renders source note when sourceNote is present", () => {
    render(<TrademarkSignalsRenderer content={enhancedContent} />);
    const note = screen.getByTestId("trademark-source-note");
    expect(note).toBeInTheDocument();
    expect(note.textContent).toBe("Trademark signals are illustrative. Real trademark clearance requires professional legal search services.");
  });

  it("renders D026-compliant disclaimer text", () => {
    render(<TrademarkSignalsRenderer content={enhancedContent} />);
    const disclaimer = screen.getByTestId("trademark-advisory-disclaimer");
    expect(disclaimer.textContent).toContain("ADVISORY ONLY");
    expect(disclaimer.textContent).toContain("do not constitute legal advice");
    expect(disclaimer.textContent).toContain("USPTO TESS");
  });

  it("renders signals with enhanced content", () => {
    render(<TrademarkSignalsRenderer content={enhancedContent} />);
    expect(screen.getByText("ACME TOOLS")).toBeInTheDocument();
    expect(screen.getByText("#5678901")).toBeInTheDocument();
    expect(screen.getByText("Acme Industries LLC")).toBeInTheDocument();
    expect(screen.getByTestId("trademark-signal-0-status").textContent).toBe("live");
    expect(screen.getByTestId("trademark-signal-1-status").textContent).toBe("dead");
  });

  it("backward compatibility: old data shape renders without source attribution", () => {
    const oldContent = {
      disclaimer: "Custom trademark disclaimer.",
      selectedName: "Nexus",
      signals: [
        { mark: "NEXUS", status: "live", class: "009", registrationNumber: "1234567", owner: "Acme Corp" },
      ],
    };
    render(<TrademarkSignalsRenderer content={oldContent} />);
    expect(screen.getByTestId("trademark-signals-renderer")).toBeInTheDocument();
    expect(screen.queryByTestId("trademark-source-attribution")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trademark-source-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("trademark-advisory-disclaimer").textContent).toBe("Custom trademark disclaimer.");
    expect(screen.getByText("NEXUS")).toBeInTheDocument();
  });
});
