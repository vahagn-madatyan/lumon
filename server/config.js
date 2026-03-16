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
  naming: "N8N_WEBHOOK_URL_NAMING",
  branding: "N8N_WEBHOOK_URL_BRANDING",
  architecture: "N8N_WEBHOOK_URL_ARCHITECTURE",
};

/** Sub-stage execution order for the research stage. */
export const RESEARCH_SUB_STAGES = ["business_plan", "tech_stack"];

/**
 * Look up the webhook URL for a given pipeline stage.
 * @param {string} stageKey
 * @returns {string|null} The webhook URL, or null if unconfigured.
 */
export function getWebhookUrl(stageKey) {
  const stageEnvVar = STAGE_ENV_MAP[stageKey];
  const stageUrl = stageEnvVar ? process.env[stageEnvVar] : undefined;

  if (stageUrl) {
    console.log(`[bridge] webhook-registry stageKey=${stageKey} source=stage-specific`);
    return stageUrl;
  }

  const globalUrl = process.env.N8N_WEBHOOK_URL;
  if (globalUrl) {
    console.log(`[bridge] webhook-registry stageKey=${stageKey} source=global-fallback`);
    return globalUrl;
  }

  console.log(`[bridge] webhook-registry stageKey=${stageKey} source=none`);
  return null;
}
