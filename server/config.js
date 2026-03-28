/**
 * Webhook registry — maps stage keys to n8n webhook URLs.
 * Checks stage-specific env vars first (e.g. N8N_WEBHOOK_URL_RESEARCH),
 * falls back to N8N_WEBHOOK_URL as the global default.
 *
 * Logs the lookup result (stageKey + source), never the raw URL.
 */

// ---------------------------------------------------------------------------
// Auth config — Tailscale identity gating and rate limiting
// ---------------------------------------------------------------------------

export const AUTH_CONFIG = {
  /** When true, skip Tailscale header checks and use a dev identity */
  devMode: process.env.LUMON_DEV_MODE === "true" || process.env.LUMON_DEV_MODE === "1",

  /** Rate limit settings for sensitive POST endpoints */
  rateLimits: {
    /** Pipeline trigger — 10 requests per 60 seconds */
    pipelineTrigger: { maxRequests: 10, windowMs: 60_000 },
    /** Execution start — 10 requests per 60 seconds */
    executionStart: { maxRequests: 10, windowMs: 60_000 },
    /** External actions execute — 5 requests per 60 seconds */
    externalActionsExecute: { maxRequests: 5, windowMs: 60_000 },
    /** Provisioning execute — 5 requests per 60 seconds */
    provisioningExecute: { maxRequests: 5, windowMs: 60_000 },
  },
};

// ---------------------------------------------------------------------------
// Execution config — agent CLI command templates and build settings
// ---------------------------------------------------------------------------

export const EXECUTION_CONFIG = {
  agents: {
    claude: {
      command: "claude",
      versionArgs: ["--version"],
      execArgs: ["--output-format", "stream-json"],
      versionPattern: /claude[- ](?:code[- ])?(?:v(?:ersion)?[ ]?)?([\d.]+)/i,
    },
    codex: {
      command: "codex",
      versionArgs: ["--version"],
      execArgs: ["exec", "--json"],
      versionPattern: /codex[- ](?:v(?:ersion)?[ ]?)?([\d.]+)/i,
    },
  },
  defaultTimeout: 300,          // seconds
  agentTimeoutMs: parseInt(process.env.EXECUTION_AGENT_TIMEOUT_MS, 10) || 300_000,
  ringBufferSize: 1000,         // max lines retained per agent
  validStatuses: new Set(["idle", "running", "completed", "failed", "escalated", "aborted", "timed-out"]),
};

// ---------------------------------------------------------------------------
// Webhook config
// ---------------------------------------------------------------------------

const STAGE_ENV_MAP = {
  intake: "N8N_WEBHOOK_URL_INTAKE",
  research: "N8N_WEBHOOK_URL_RESEARCH",
  plan: "N8N_WEBHOOK_URL_PLAN",
  plan_naming_candidates: "N8N_WEBHOOK_URL_PLAN_NAMING",
  plan_domain_signals: "N8N_WEBHOOK_URL_PLAN_DOMAIN",
  plan_trademark_signals: "N8N_WEBHOOK_URL_PLAN_TRADEMARK",
  naming: "N8N_WEBHOOK_URL_NAMING",
  branding: "N8N_WEBHOOK_URL_BRANDING",
  architecture: "N8N_WEBHOOK_URL_ARCHITECTURE",
  verification: "N8N_WEBHOOK_URL_VERIFICATION",
  verification_architecture_outline: "N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE",
  verification_specification: "N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION",
  verification_prototype_scaffold: "N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE",
};

/** Sub-stage execution order for the research stage. */
export const RESEARCH_SUB_STAGES = ["business_plan", "tech_stack"];

/** Sub-stage execution order for the plan stage. */
export const PLAN_SUB_STAGES = ["naming_candidates", "domain_signals", "trademark_signals"];

/** Sub-stage execution order for the verification stage. */
export const VERIFICATION_SUB_STAGES = ["architecture_outline", "specification", "prototype_scaffold"];

/**
 * Look up the webhook URL for a given pipeline stage.
 * When subStage is provided, checks compound key (stageKey_subStage) first,
 * then falls back to stageKey-level, then global N8N_WEBHOOK_URL.
 * @param {string} stageKey
 * @param {string} [subStage] — optional sub-stage for compound lookup
 * @returns {string|null} The webhook URL, or null if unconfigured.
 */
export function getWebhookUrl(stageKey, subStage) {
  // 1. Compound key: stageKey_subStage (e.g. plan_naming)
  if (subStage) {
    const compoundKey = `${stageKey}_${subStage}`;
    const compoundEnvVar = STAGE_ENV_MAP[compoundKey];
    const compoundUrl = compoundEnvVar ? process.env[compoundEnvVar] : undefined;

    if (compoundUrl) {
      console.log(`[bridge] webhook-registry stageKey=${stageKey} subStage=${subStage} source=compound`);
      return compoundUrl;
    }
  }

  // 2. Stage-level key
  const stageEnvVar = STAGE_ENV_MAP[stageKey];
  const stageUrl = stageEnvVar ? process.env[stageEnvVar] : undefined;

  if (stageUrl) {
    console.log(`[bridge] webhook-registry stageKey=${stageKey} source=stage-specific`);
    return stageUrl;
  }

  // 3. Global fallback
  const globalUrl = process.env.N8N_WEBHOOK_URL;
  if (globalUrl) {
    console.log(`[bridge] webhook-registry stageKey=${stageKey} source=global-fallback`);
    return globalUrl;
  }

  console.log(`[bridge] webhook-registry stageKey=${stageKey} source=none`);
  return null;
}

// ---------------------------------------------------------------------------
// External API credentials — injected into webhook trigger bodies
// ---------------------------------------------------------------------------

/**
 * Read Porkbun API credentials from process.env.
 * Returns `{ apiKey, apiSecret }` — values are `null` when env vars are unset.
 * NEVER log the returned values.
 * @returns {{ apiKey: string|null, apiSecret: string|null }}
 */
export function getPorkbunCredentials() {
  return {
    apiKey: process.env.PORKBUN_API_KEY || null,
    apiSecret: process.env.PORKBUN_API_SECRET || null,
  };
}
