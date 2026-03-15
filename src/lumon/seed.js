import {
  LUMON_PREBUILD_STAGE_KEYS,
  createCanonicalPrebuildStages,
  createLumonState,
} from "./model";

const RAW_PROJECTS = [
  {
    id: "wheely",
    name: "Wheely",
    desc: "Stock screening & portfolio analytics platform",
    phase: "Phase 2 — Booking Engine",
    agents: [
      {
        id: "a1",
        name: "Agent-01",
        type: "claude",
        plan: "03-01",
        task: "Filter functions & HV computation",
        wave: 1,
        status: "running",
        tokens: 147832,
        cost: 2.41,
        elapsed: "24m",
        progress: 68
      },
      {
        id: "a2",
        name: "Agent-02",
        type: "claude",
        plan: "03-02",
        task: "Scoring engine + pipeline orchestrator",
        wave: 1,
        status: "running",
        tokens: 89214,
        cost: 1.55,
        elapsed: "18m",
        progress: 42
      },
      {
        id: "a3",
        name: "Agent-03",
        type: "codex",
        plan: "03-03",
        task: "API routes & validation layer",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 2
    }
  },
  {
    id: "tattoo-bot",
    name: "Tattoo Bot",
    desc: "AI tattoo design assistant with style transfer",
    phase: "Phase 2 — Authentication",
    agents: [
      {
        id: "a4",
        name: "Agent-04",
        type: "claude",
        plan: "auth-01",
        task: "Login/signup screens + magic link",
        wave: 1,
        status: "running",
        tokens: 52100,
        cost: 0.88,
        elapsed: "11m",
        progress: 35
      },
      {
        id: "a5",
        name: "Agent-05",
        type: "claude",
        plan: "auth-02",
        task: "Session persistence & auth store",
        wave: 1,
        status: "complete",
        tokens: 186420,
        cost: 3.12,
        elapsed: "42m",
        progress: 100
      }
    ],
    waves: {
      current: 1,
      total: 3
    }
  },
  {
    id: "policy-gsd",
    name: "Policy Engine",
    desc: "VPC flow log parser & normalization pipeline",
    phase: "Phase 1 — Log Ingestion",
    agents: [
      {
        id: "a6",
        name: "Agent-06",
        type: "codex",
        plan: "log-01",
        task: "S3 discovery pattern + VPC Flow Log versions",
        wave: 1,
        status: "failed",
        tokens: 34210,
        cost: 0.21,
        elapsed: "8m",
        progress: 23
      }
    ],
    waves: {
      current: 1,
      total: 1
    }
  },
  {
    id: "crm-ai",
    name: "CRM AI",
    desc: "Intelligent CRM with deal scoring & forecasting",
    phase: "Phase 3 — Pipeline Analytics",
    agents: [
      {
        id: "a7",
        name: "Agent-07",
        type: "claude",
        plan: "crm-01",
        task: "Deal scoring ML model integration",
        wave: 1,
        status: "running",
        tokens: 201440,
        cost: 3.45,
        elapsed: "32m",
        progress: 78
      },
      {
        id: "a8",
        name: "Agent-08",
        type: "claude",
        plan: "crm-02",
        task: "Revenue forecast dashboard",
        wave: 1,
        status: "running",
        tokens: 112300,
        cost: 1.92,
        elapsed: "21m",
        progress: 55
      },
      {
        id: "a9",
        name: "Agent-09",
        type: "codex",
        plan: "crm-03",
        task: "Email sync & thread parsing",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 3
    }
  },
  {
    id: "mesh-net",
    name: "MeshNet",
    desc: "Decentralized mesh networking protocol",
    phase: "Phase 1 — Core Protocol",
    agents: [
      {
        id: "a10",
        name: "Agent-10",
        type: "claude",
        plan: "mesh-01",
        task: "Peer discovery & NAT traversal",
        wave: 1,
        status: "running",
        tokens: 178200,
        cost: 2.88,
        elapsed: "28m",
        progress: 61
      },
      {
        id: "a11",
        name: "Agent-11",
        type: "codex",
        plan: "mesh-02",
        task: "Gossip protocol implementation",
        wave: 1,
        status: "complete",
        tokens: 245000,
        cost: 4.1,
        elapsed: "51m",
        progress: 100
      }
    ],
    waves: {
      current: 1,
      total: 2
    }
  },
  {
    id: "doc-mind",
    name: "DocMind",
    desc: "AI document understanding & extraction pipeline",
    phase: "Phase 2 — Table Extraction",
    agents: [
      {
        id: "a12",
        name: "Agent-12",
        type: "claude",
        plan: "doc-01",
        task: "PDF table detection with vision model",
        wave: 1,
        status: "running",
        tokens: 94500,
        cost: 1.62,
        elapsed: "15m",
        progress: 38
      },
      {
        id: "a13",
        name: "Agent-13",
        type: "claude",
        plan: "doc-02",
        task: "OCR fallback for scanned docs",
        wave: 1,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      },
      {
        id: "a14",
        name: "Agent-14",
        type: "codex",
        plan: "doc-03",
        task: "Schema inference from headers",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 2
    }
  },
  {
    id: "fleet-ops",
    name: "FleetOps",
    desc: "Vehicle fleet management & route optimization",
    phase: "Phase 1 — GPS Ingestion",
    agents: [
      {
        id: "a15",
        name: "Agent-15",
        type: "claude",
        plan: "fleet-01",
        task: "Real-time GPS stream processor",
        wave: 1,
        status: "complete",
        tokens: 310000,
        cost: 5.3,
        elapsed: "1h 12m",
        progress: 100
      },
      {
        id: "a16",
        name: "Agent-16",
        type: "codex",
        plan: "fleet-02",
        task: "Geofence alerting engine",
        wave: 1,
        status: "complete",
        tokens: 198000,
        cost: 3.4,
        elapsed: "48m",
        progress: 100
      }
    ],
    waves: {
      current: 2,
      total: 2
    }
  },
  {
    id: "sonic-id",
    name: "SonicID",
    desc: "Audio fingerprinting & music recognition",
    phase: "Phase 1 — Feature Extraction",
    agents: [
      {
        id: "a17",
        name: "Agent-17",
        type: "claude",
        plan: "sonic-01",
        task: "Spectrogram generator & chromaprint",
        wave: 1,
        status: "running",
        tokens: 67200,
        cost: 1.15,
        elapsed: "9m",
        progress: 22
      }
    ],
    waves: {
      current: 1,
      total: 3
    }
  },
  {
    id: "pixel-forge",
    name: "PixelForge",
    desc: "AI image generation pipeline with LoRA training",
    phase: "Phase 2 — Training Pipeline",
    agents: [
      {
        id: "a18",
        name: "Agent-18",
        type: "claude",
        plan: "pf-01",
        task: "Dataset curator & augmentation",
        wave: 1,
        status: "running",
        tokens: 156000,
        cost: 2.67,
        elapsed: "26m",
        progress: 72
      },
      {
        id: "a19",
        name: "Agent-19",
        type: "codex",
        plan: "pf-02",
        task: "LoRA training loop & checkpoints",
        wave: 1,
        status: "failed",
        tokens: 88400,
        cost: 0.52,
        elapsed: "12m",
        progress: 31
      },
      {
        id: "a20",
        name: "Agent-20",
        type: "claude",
        plan: "pf-03",
        task: "Inference API with batching",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      },
      {
        id: "a21",
        name: "Agent-21",
        type: "codex",
        plan: "pf-04",
        task: "Image quality scoring model",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 2
    }
  },
  {
    id: "lingua",
    name: "Lingua",
    desc: "Real-time translation & localization engine",
    phase: "Phase 1 — Core Translation",
    agents: [
      {
        id: "a22",
        name: "Agent-22",
        type: "claude",
        plan: "lng-01",
        task: "Transformer model fine-tuning pipeline",
        wave: 1,
        status: "complete",
        tokens: 402000,
        cost: 6.88,
        elapsed: "1h 34m",
        progress: 100
      },
      {
        id: "a23",
        name: "Agent-23",
        type: "claude",
        plan: "lng-02",
        task: "Context-aware glossary system",
        wave: 1,
        status: "complete",
        tokens: 287000,
        cost: 4.91,
        elapsed: "58m",
        progress: 100
      },
      {
        id: "a24",
        name: "Agent-24",
        type: "codex",
        plan: "lng-03",
        task: "Streaming translation WebSocket API",
        wave: 2,
        status: "running",
        tokens: 134000,
        cost: 2.29,
        elapsed: "22m",
        progress: 48
      }
    ],
    waves: {
      current: 2,
      total: 3
    }
  },
  {
    id: "vault-guard",
    name: "VaultGuard",
    desc: "Secret rotation & compliance automation",
    phase: "Phase 2 — Auto-Rotation",
    agents: [
      {
        id: "a25",
        name: "Agent-25",
        type: "claude",
        plan: "vg-01",
        task: "Credential scanner & inventory",
        wave: 1,
        status: "complete",
        tokens: 178000,
        cost: 3.05,
        elapsed: "35m",
        progress: 100
      },
      {
        id: "a26",
        name: "Agent-26",
        type: "claude",
        plan: "vg-02",
        task: "Rotation scheduler with rollback",
        wave: 2,
        status: "running",
        tokens: 92300,
        cost: 1.58,
        elapsed: "14m",
        progress: 44
      }
    ],
    waves: {
      current: 2,
      total: 3
    }
  },
  {
    id: "event-hive",
    name: "EventHive",
    desc: "Event-driven microservice orchestration",
    phase: "Phase 1 — Message Bus",
    agents: [
      {
        id: "a27",
        name: "Agent-27",
        type: "codex",
        plan: "eh-01",
        task: "NATS JetStream wrapper & retry logic",
        wave: 1,
        status: "running",
        tokens: 143000,
        cost: 0.88,
        elapsed: "19m",
        progress: 56
      },
      {
        id: "a28",
        name: "Agent-28",
        type: "claude",
        plan: "eh-02",
        task: "Dead letter queue & monitoring",
        wave: 1,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      },
      {
        id: "a29",
        name: "Agent-29",
        type: "codex",
        plan: "eh-03",
        task: "Schema registry & versioning",
        wave: 1,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 2
    }
  },
  {
    id: "holo-meet",
    name: "HoloMeet",
    desc: "Spatial video conferencing with 3D avatars",
    phase: "Phase 3 — Avatar System",
    agents: [
      {
        id: "a30",
        name: "Agent-30",
        type: "claude",
        plan: "hm-01",
        task: "Face mesh tracking & rigging",
        wave: 1,
        status: "running",
        tokens: 221000,
        cost: 3.78,
        elapsed: "37m",
        progress: 82
      },
      {
        id: "a31",
        name: "Agent-31",
        type: "claude",
        plan: "hm-02",
        task: "Lip-sync audio alignment",
        wave: 1,
        status: "running",
        tokens: 167000,
        cost: 2.86,
        elapsed: "29m",
        progress: 63
      },
      {
        id: "a32",
        name: "Agent-32",
        type: "codex",
        plan: "hm-03",
        task: "WebRTC spatial audio mixing",
        wave: 2,
        status: "queued",
        tokens: 0,
        cost: 0,
        elapsed: "—",
        progress: 0
      }
    ],
    waves: {
      current: 1,
      total: 3
    }
  },
  {
    id: "carbon-track",
    name: "CarbonTrack",
    desc: "Supply chain carbon footprint calculator",
    phase: "Phase 1 — Data Collection",
    agents: [
      {
        id: "a33",
        name: "Agent-33",
        type: "claude",
        plan: "ct-01",
        task: "Emission factor database & API",
        wave: 1,
        status: "complete",
        tokens: 195000,
        cost: 3.34,
        elapsed: "41m",
        progress: 100
      }
    ],
    waves: {
      current: 2,
      total: 2
    }
  }
];

const RAW_PIPELINES = [
  {
    id: "wheely",
    project: "Wheely",
    phase: "Phase 2 — Booking Engine",
    steps: [
      {
        id: "gsd-init",
        label: "GSD Init",
        desc: "Initialize .planning/ structure",
        icon: "GitBranch",
        status: "complete",
        duration: "4s",
        output: "PROJECT.md created"
      },
      {
        id: "research",
        label: "Research",
        desc: "Codebase analysis & dependency scan",
        icon: "Search",
        status: "complete",
        duration: "1m 12s",
        output: "14 files scanned, 3 deps found"
      },
      {
        id: "plan",
        label: "Plan",
        desc: "Generate phases, waves, task breakdown",
        icon: "FileText",
        status: "complete",
        duration: "38s",
        output: "2 phases, 4 waves, 9 tasks"
      },
      {
        id: "wave-1",
        label: "Wave 1",
        desc: "Parallel: Agent-01 + Agent-02",
        icon: "Layers",
        status: "running",
        duration: "24m",
        output: "2/2 agents active",
        agents: [
          {
            id: "a01",
            label: "Agent-01",
            desc: "Filter functions & HV computation",
            status: "running",
            progress: 68,
            type: "claude"
          },
          {
            id: "a02",
            label: "Agent-02",
            desc: "Scoring engine + pipeline orchestrator",
            status: "running",
            progress: 42,
            type: "claude"
          }
        ]
      },
      {
        id: "wave-2",
        label: "Wave 2",
        desc: "Sequential: Agent-03",
        icon: "Layers",
        status: "queued",
        duration: "—",
        output: "Blocked on Wave 1",
        agents: [
          {
            id: "a03",
            label: "Agent-03",
            desc: "API routes & validation layer",
            status: "queued",
            progress: 0,
            type: "codex"
          }
        ]
      },
      {
        id: "test",
        label: "Test Suite",
        desc: "Run full test matrix",
        icon: "CheckCircle2",
        status: "queued",
        duration: "—",
        output: "Pending"
      },
      {
        id: "merge",
        label: "Merge & Deploy",
        desc: "PR creation, CI/CD pipeline",
        icon: "GitBranch",
        status: "queued",
        duration: "—",
        output: "Pending"
      }
    ]
  },
  {
    id: "tattoo-bot",
    project: "Tattoo Bot",
    phase: "Phase 2 — Authentication",
    steps: [
      {
        id: "tb-init",
        label: "GSD Init",
        desc: "Initialize .planning/ structure",
        icon: "GitBranch",
        status: "complete",
        duration: "3s",
        output: "PROJECT.md created"
      },
      {
        id: "tb-research",
        label: "Research",
        desc: "Auth patterns & existing code audit",
        icon: "Search",
        status: "complete",
        duration: "52s",
        output: "Supabase auth detected"
      },
      {
        id: "tb-plan",
        label: "Plan",
        desc: "Generate auth implementation plan",
        icon: "FileText",
        status: "complete",
        duration: "28s",
        output: "1 phase, 3 waves, 5 tasks"
      },
      {
        id: "tb-wave-1",
        label: "Wave 1",
        desc: "Parallel: Agent-04 + Agent-05",
        icon: "Layers",
        status: "running",
        duration: "42m",
        output: "1/2 complete",
        agents: [
          {
            id: "a04",
            label: "Agent-04",
            desc: "Login/signup screens + magic link",
            status: "running",
            progress: 35,
            type: "claude"
          },
          {
            id: "a05",
            label: "Agent-05",
            desc: "Session persistence & auth store",
            status: "complete",
            progress: 100,
            type: "claude"
          }
        ]
      },
      {
        id: "tb-wave-2",
        label: "Wave 2",
        desc: "Protected routes + middleware",
        icon: "Layers",
        status: "queued",
        duration: "—",
        output: "Blocked on Wave 1"
      },
      {
        id: "tb-wave-3",
        label: "Wave 3",
        desc: "E2E auth tests",
        icon: "Layers",
        status: "queued",
        duration: "—",
        output: "Blocked on Wave 2"
      },
      {
        id: "tb-merge",
        label: "Merge & Deploy",
        desc: "PR creation, CI/CD pipeline",
        icon: "GitBranch",
        status: "queued",
        duration: "—",
        output: "Pending"
      }
    ]
  },
  {
    id: "policy-gsd",
    project: "Policy Engine",
    phase: "Phase 1 — Log Ingestion",
    steps: [
      {
        id: "pe-init",
        label: "GSD Init",
        desc: "Initialize .planning/ structure",
        icon: "GitBranch",
        status: "complete",
        duration: "3s",
        output: "PROJECT.md created"
      },
      {
        id: "pe-research",
        label: "Research",
        desc: "VPC flow log format analysis",
        icon: "Search",
        status: "complete",
        duration: "1m 04s",
        output: "v2, v3, v5 formats identified"
      },
      {
        id: "pe-plan",
        label: "Plan",
        desc: "Ingestion pipeline design",
        icon: "FileText",
        status: "complete",
        duration: "22s",
        output: "1 phase, 1 wave, 3 tasks"
      },
      {
        id: "pe-wave-1",
        label: "Wave 1",
        desc: "Agent-06: S3 discovery",
        icon: "Layers",
        status: "failed",
        duration: "8m",
        output: "Agent-06 crashed — retry pending",
        agents: [
          {
            id: "a06",
            label: "Agent-06",
            desc: "S3 discovery pattern + VPC Flow Log versions",
            status: "failed",
            progress: 23,
            type: "codex"
          }
        ]
      },
      {
        id: "pe-test",
        label: "Test Suite",
        desc: "Validate parsed output",
        icon: "CheckCircle2",
        status: "queued",
        duration: "—",
        output: "Blocked"
      },
      {
        id: "pe-merge",
        label: "Merge & Deploy",
        desc: "PR creation",
        icon: "GitBranch",
        status: "queued",
        duration: "—",
        output: "Blocked"
      }
    ]
  }
];

const inferStageKey = (step) => {
  const id = String(step.id ?? "").toLowerCase();

  if (id.includes("wave")) {
    const match = id.match(/wave-(\d+)/);
    return `wave-${match ? Number.parseInt(match[1], 10) : 1}`;
  }
  if (id.includes("init")) return LUMON_PREBUILD_STAGE_KEYS.intake;
  if (id.includes("research")) return LUMON_PREBUILD_STAGE_KEYS.research;
  if (id.includes("plan")) return LUMON_PREBUILD_STAGE_KEYS.plan;
  if (id.includes("test")) return LUMON_PREBUILD_STAGE_KEYS.verification;
  if (id.includes("merge") || id.includes("handoff")) return LUMON_PREBUILD_STAGE_KEYS.handoff;
  return null;
};

const deriveWaveStatus = (agents) => {
  if (!agents.length) return "queued";
  if (agents.some((agent) => agent.status === "failed")) return "failed";
  if (agents.some((agent) => agent.status === "running")) return "running";
  if (agents.some((agent) => agent.status === "queued") && agents.some((agent) => agent.status === "complete")) return "running";
  if (agents.every((agent) => agent.status === "complete")) return "complete";
  return "queued";
};

const summarizeWaveOutput = (agents) => {
  if (!agents.length) return "Awaiting wave planning";
  const counts = agents.reduce((summary, agent) => {
    summary[agent.status] = (summary[agent.status] ?? 0) + 1;
    return summary;
  }, {});
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(" · ");
};

const buildGeneratedStageOverrides = (project) => {
  const stageOverrides = {
    [LUMON_PREBUILD_STAGE_KEYS.intake]: {
      description: "Initialize .planning/ structure",
      status: "complete",
      output: "Seed contract initialized",
      approval: { state: "approved" },
      meta: { aliasIds: [`${project.id}:gsd-init`] },
    },
    [LUMON_PREBUILD_STAGE_KEYS.research]: {
      description: `Analysis seeded from ${project.phase}`,
      status: "complete",
      output: `${project.agents.length} seeded agent${project.agents.length === 1 ? "" : "s"}`,
      approval: { state: "approved" },
    },
    [LUMON_PREBUILD_STAGE_KEYS.plan]: {
      description: "Canonical pipeline shell projected from demo state",
      status: "complete",
      output: `${project.waves.total} wave${project.waves.total === 1 ? "" : "s"} defined`,
      approval: { state: "approved" },
    },
    [LUMON_PREBUILD_STAGE_KEYS.verification]: {
      description: "Contract verification gate",
      output: "Pending verification",
    },
    [LUMON_PREBUILD_STAGE_KEYS.handoff]: {
      description: "Operator approval and release handoff",
      output: "Pending handoff",
    },
  };

  for (let waveNumber = 1; waveNumber <= project.waves.total; waveNumber += 1) {
    const stageKey = `wave-${waveNumber}`;
    const waveAgents = project.agents.filter((agent) => agent.wave === waveNumber);
    stageOverrides[stageKey] = {
      status: deriveWaveStatus(waveAgents),
      durationLabel: waveAgents[0]?.elapsed ?? "—",
      output: summarizeWaveOutput(waveAgents),
      agentIds: waveAgents.map((agent) => agent.id),
    };
  }

  return stageOverrides;
};

const buildDetailedStageOverrides = (project, pipeline) => {
  const agentIdsByName = new Map(project.agents.map((agent) => [agent.name, agent.id]));

  return pipeline.steps.reduce((overrides, step) => {
    const stageKey = inferStageKey(step);
    if (!stageKey) {
      return overrides;
    }

    overrides[stageKey] = {
      description: step.desc,
      icon: step.icon,
      status: step.status,
      durationLabel: step.duration,
      output: step.output,
      agentIds: (step.agents ?? [])
        .map((agent) => agentIdsByName.get(agent.label))
        .filter(Boolean),
      approval:
        step.status === "complete" &&
        [
          LUMON_PREBUILD_STAGE_KEYS.intake,
          LUMON_PREBUILD_STAGE_KEYS.plan,
          LUMON_PREBUILD_STAGE_KEYS.verification,
          LUMON_PREBUILD_STAGE_KEYS.handoff,
        ].includes(stageKey)
          ? { state: "approved" }
          : undefined,
      meta: {
        aliasIds: [step.id],
      },
    };

    return overrides;
  }, {});
};

const buildProjectExecution = (project) => {
  const pipeline = RAW_PIPELINES.find((candidate) => candidate.id === project.id);
  const stageOverrides = pipeline ? buildDetailedStageOverrides(project, pipeline) : buildGeneratedStageOverrides(project);

  return {
    id: `engine:${project.id}`,
    label: `${project.name} pipeline`,
    stages: createCanonicalPrebuildStages({
      projectId: project.id,
      projectName: project.name,
      engineChoice: inferSeedEngineChoice(project),
      agents: project.agents,
      waveCount: project.waves.total,
      stageOverrides,
    }),
  };
};

const createSeedTimestamp = (projectIndex, minuteOffset = 0) =>
  new Date(Date.UTC(2026, 0, 13, 16 + projectIndex, minuteOffset, 0)).toISOString();

const inferSeedEngineChoice = (project) => project.agents[0]?.type ?? "claude";

const buildProject = (project, projectIndex) => ({
  id: project.id,
  name: project.name,
  description: project.desc,
  phaseLabel: project.phase,
  phase: project.phase,
  engineChoice: inferSeedEngineChoice(project),
  createdAt: createSeedTimestamp(projectIndex),
  updatedAt: createSeedTimestamp(projectIndex, 15),
  waves: project.waves,
  agents: project.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    type: agent.type,
    planId: agent.plan,
    task: agent.task,
    wave: agent.wave,
    status: agent.status,
    tokens: agent.tokens,
    costUsd: agent.cost,
    elapsedLabel: agent.elapsed,
    elapsed: agent.elapsed,
    progress: agent.progress,
  })),
  execution: buildProjectExecution(project),
  meta: {
    seedSource: "mission-control-demo",
  },
});

export const lumonProjectSeed = RAW_PROJECTS.map((project, projectIndex) => buildProject(project, projectIndex));
export const lumonSeedSource = "mission-control-demo";
export const lumonFloorLayoutSeed = Object.freeze({
  label: "severance-floor-v1",
  departmentAnchors: [
    { x: 80, y: 100 },
    { x: 440, y: 80 },
    { x: 820, y: 130 },
    { x: 180, y: 400 },
    { x: 580, y: 360 },
    { x: 980, y: 320 },
    { x: 60, y: 680 },
    { x: 460, y: 640 },
    { x: 860, y: 700 },
    { x: 300, y: 940 },
    { x: 720, y: 900 },
    { x: 1100, y: 960 },
    { x: 120, y: 1200 },
    { x: 540, y: 1160 },
    { x: 920, y: 1220 },
    { x: 320, y: 1460 },
    { x: 740, y: 1420 },
    { x: 1140, y: 1480 },
    { x: 180, y: 1700 },
    { x: 600, y: 1660 },
  ],
  departmentBandHeight: 1800,
  amenityRooms: {
    cafeteria: { x: 1220, y: 140, w: 300, h: 160 },
    breakroom: { x: 1240, y: 680, w: 260, h: 150 },
    vending: { x: 1200, y: 440, w: 180, h: 130 },
  },
  bossOrbit: {
    centerX: 0.58,
    centerY: 0.42,
    amplitudeX: 0.31,
    amplitudeY: 0.28,
    horizontalDivisor: 12,
    verticalDivisor: 19,
  },
});

export function createSeedLumonState(overrides = {}) {
  return createLumonState({
    projects: overrides.projects ?? lumonProjectSeed,
    selection: {
      projectId: overrides.selection?.projectId ?? lumonProjectSeed[0]?.id ?? null,
      agentId: overrides.selection?.agentId ?? null,
      stageId: overrides.selection?.stageId ?? null,
    },
    meta: {
      seedLabel: lumonSeedSource,
      ...overrides.meta,
    },
  });
}