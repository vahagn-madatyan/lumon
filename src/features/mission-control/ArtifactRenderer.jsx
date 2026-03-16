import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

// --- Collapsible Section primitive ---

function CollapsibleSection({ title, defaultOpen = false, children, testId }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-950/50"
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
          {title}
        </span>
        {open ? (
          <ChevronDown size={12} className="text-zinc-500" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-3 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

// --- Score Badge ---

function ScoreBadge({ score, label }) {
  const tone =
    score >= 8
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : score >= 5
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-red-500/15 text-red-300 border-red-500/30";

  return (
    <Badge
      variant="outline"
      className={`font-mono text-[9px] font-bold tracking-[0.08em] ${tone}`}
      data-testid="score-badge"
    >
      {label ?? score}/10
    </Badge>
  );
}

// --- ViabilityRenderer ---

export function ViabilityRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="viability-renderer">
      {content.marketAssessment && (
        <CollapsibleSection title="Market Assessment" defaultOpen testId="viability-market-assessment">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.marketAssessment === "string"
              ? content.marketAssessment
              : JSON.stringify(content.marketAssessment, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.technicalFeasibility && (
        <CollapsibleSection title="Technical Feasibility" defaultOpen testId="viability-technical-feasibility">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.technicalFeasibility === "string"
              ? content.technicalFeasibility
              : JSON.stringify(content.technicalFeasibility, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.riskFactors && (
        <CollapsibleSection title="Risk Factors" defaultOpen testId="viability-risk-factors">
          {Array.isArray(content.riskFactors) ? (
            <ul className="space-y-1">
              {content.riskFactors.map((risk, i) => (
                <li key={i} className="font-mono text-[11px] text-zinc-300 flex items-start gap-2">
                  <span className="text-red-400 shrink-0">•</span>
                  <span>{typeof risk === "string" ? risk : risk.description ?? JSON.stringify(risk)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {typeof content.riskFactors === "string"
                ? content.riskFactors
                : JSON.stringify(content.riskFactors, null, 2)}
            </div>
          )}
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="viability-recommendation">
          <div className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.recommendation === "string"
              ? content.recommendation
              : JSON.stringify(content.recommendation, null, 2)}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// --- BusinessPlanRenderer ---

export function BusinessPlanRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="business-plan-renderer">
      {content.targetAudience && (
        <CollapsibleSection title="Target Audience" defaultOpen testId="business-plan-target-audience">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.targetAudience === "string"
              ? content.targetAudience
              : JSON.stringify(content.targetAudience, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.pricingPosture && (
        <CollapsibleSection title="Pricing Posture" defaultOpen testId="business-plan-pricing-posture">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.pricingPosture === "string"
              ? content.pricingPosture
              : JSON.stringify(content.pricingPosture, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.featurePhases && (
        <CollapsibleSection title="Feature Phases" defaultOpen testId="business-plan-feature-phases">
          {Array.isArray(content.featurePhases) ? (
            <div className="space-y-2">
              {content.featurePhases.map((phase, i) => (
                <div key={i} className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5">
                  <div className="font-mono text-[10px] font-semibold text-zinc-200">
                    {phase.name ?? `Phase ${i + 1}`}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-zinc-400">
                    {phase.description ?? JSON.stringify(phase)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {typeof content.featurePhases === "string"
                ? content.featurePhases
                : JSON.stringify(content.featurePhases, null, 2)}
            </div>
          )}
        </CollapsibleSection>
      )}
      {content.revenueModel && (
        <CollapsibleSection title="Revenue Model" defaultOpen testId="business-plan-revenue-model">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.revenueModel === "string"
              ? content.revenueModel
              : JSON.stringify(content.revenueModel, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="business-plan-recommendation">
          <div className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.recommendation === "string"
              ? content.recommendation
              : JSON.stringify(content.recommendation, null, 2)}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// --- TechResearchRenderer ---

export function TechResearchRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="tech-research-renderer">
      {Array.isArray(content.approaches) && content.approaches.length > 0 && (
        <CollapsibleSection title="Approaches" defaultOpen testId="tech-research-approaches">
          <div className="space-y-2">
            {content.approaches.map((approach, i) => (
              <div
                key={i}
                className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`tech-research-approach-${i}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold text-zinc-200">
                    {approach.name ?? `Approach ${i + 1}`}
                  </span>
                  {approach.score != null && <ScoreBadge score={approach.score} />}
                </div>
                {approach.description && (
                  <div className="mt-1 font-mono text-[10px] text-zinc-400 leading-relaxed">
                    {approach.description}
                  </div>
                )}
                {approach.pros && (
                  <div className="mt-1 font-mono text-[9px] text-emerald-400">
                    + {Array.isArray(approach.pros) ? approach.pros.join(", ") : approach.pros}
                  </div>
                )}
                {approach.cons && (
                  <div className="mt-0.5 font-mono text-[9px] text-red-400">
                    − {Array.isArray(approach.cons) ? approach.cons.join(", ") : approach.cons}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {content.tradeoffs && (
        <CollapsibleSection title="Tradeoffs" defaultOpen testId="tech-research-tradeoffs">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.tradeoffs === "string"
              ? content.tradeoffs
              : JSON.stringify(content.tradeoffs, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="tech-research-recommendation">
          <div className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.recommendation === "string"
              ? content.recommendation
              : JSON.stringify(content.recommendation, null, 2)}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// --- GenericRenderer (fallback) ---

export function GenericRenderer({ content, type }) {
  return (
    <div className="space-y-2" data-testid="generic-renderer">
      {type && (
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">
          Type: {type}
        </div>
      )}
      <pre className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[10px] text-zinc-400 leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto">
        {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

// --- ArtifactRenderer (top-level dispatcher) ---

const TYPE_RENDERERS = {
  viability_analysis: ViabilityRenderer,
  business_plan: BusinessPlanRenderer,
  tech_research: TechResearchRenderer,
};

/**
 * Dispatches to the correct sub-renderer based on artifact.type.
 *
 * @param {{ artifact: { type: string, content: any } }} props
 */
export default function ArtifactRenderer({ artifact }) {
  if (!artifact) return null;

  const Renderer = TYPE_RENDERERS[artifact.type];

  if (Renderer) {
    return <Renderer content={artifact.content} />;
  }

  return <GenericRenderer content={artifact.content} type={artifact.type} />;
}
