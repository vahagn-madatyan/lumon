/**
 * Webhook registry — maps stage keys to n8n webhook URLs.
 * Checks stage-specific env vars first (e.g. N8N_WEBHOOK_URL_RESEARCH),
 * falls back to N8N_WEBHOOK_URL as the global default.
 *
 * Logs the lookup result (stageKey + source), never the raw URL.
 */

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
};

/** Sub-stage execution order for the research stage. */
export const RESEARCH_SUB_STAGES = ["business_plan", "tech_stack"];

/** Sub-stage execution order for the plan stage. */
export const PLAN_SUB_STAGES = ["naming_candidates", "domain_signals", "trademark_signals"];

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
