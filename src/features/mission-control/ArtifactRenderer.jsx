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

// --- NamingCandidatesRenderer ---

const STYLE_TAG_CLASSES = [
  "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "bg-blue-500/15 text-blue-300 border-blue-500/30",
];

export function NamingCandidatesRenderer({ content, onAction }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="naming-candidates-renderer">
      {content.methodology && (
        <CollapsibleSection title="Methodology" testId="naming-methodology">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {content.methodology}
          </div>
        </CollapsibleSection>
      )}
      {Array.isArray(content.candidates) && content.candidates.map((candidate, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"
          data-testid={`naming-candidate-${i}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="font-mono text-[13px] font-bold text-zinc-100">
                {candidate.name}
              </div>
              {candidate.rationale && (
                <div className="font-mono text-[10px] text-zinc-400 leading-relaxed">
                  {candidate.rationale}
                </div>
              )}
              {candidate.domainHint && (
                <div className="font-mono text-[9px] text-zinc-500">
                  {candidate.domainHint}
                </div>
              )}
              {Array.isArray(candidate.styleTags) && candidate.styleTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {candidate.styleTags.map((tag, j) => (
                    <Badge
                      key={j}
                      variant="outline"
                      className={`font-mono text-[8px] uppercase tracking-[0.08em] ${STYLE_TAG_CLASSES[j % STYLE_TAG_CLASSES.length]}`}
                      data-testid={`naming-candidate-${i}-tag-${j}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!onAction}
              onClick={() => onAction?.({ type: "select-name", selectedName: candidate.name })}
              className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid={`naming-candidate-${i}-select`}
            >
              Select
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- DomainSignalsRenderer ---

const DOMAIN_STATUS_CLASSES = {
  available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  taken: "bg-red-500/15 text-red-300 border-red-500/30",
  premium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const DEFAULT_DOMAIN_DISCLAIMER =
  "Domain availability is a point-in-time advisory signal, not a guaranteed reservation.";

export function DomainSignalsRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="domain-signals-renderer">
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[10px] text-amber-200 leading-relaxed"
        data-testid="domain-advisory-disclaimer"
      >
        {content.disclaimer || DEFAULT_DOMAIN_DISCLAIMER}
      </div>
      {content.selectedName && (
        <div className="font-mono text-[12px] font-bold text-zinc-200" data-testid="domain-selected-name">
          {content.selectedName}
        </div>
      )}
      {Array.isArray(content.signals) && content.signals.map((signal, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
          data-testid={`domain-signal-${i}`}
        >
          <div className="font-mono text-[11px] text-zinc-200">{signal.domain}</div>
          <div className="flex items-center gap-2">
            {signal.price && (
              <span className="font-mono text-[9px] text-zinc-400">{signal.price}</span>
            )}
            <Badge
              variant="outline"
              className={`font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${DOMAIN_STATUS_CLASSES[signal.status] ?? DOMAIN_STATUS_CLASSES.taken}`}
              data-testid={`domain-signal-${i}-status`}
            >
              {signal.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- TrademarkSignalsRenderer ---

const TRADEMARK_STATUS_CLASSES = {
  live: "bg-red-500/15 text-red-300 border-red-500/30",
  dead: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const DEFAULT_TRADEMARK_DISCLAIMER =
  "Trademark signals are advisory only and do not constitute legal advice. Consult a trademark attorney before proceeding.";

export function TrademarkSignalsRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="trademark-signals-renderer">
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[10px] text-amber-200 leading-relaxed"
        data-testid="trademark-advisory-disclaimer"
      >
        {content.disclaimer || DEFAULT_TRADEMARK_DISCLAIMER}
      </div>
      {content.selectedName && (
        <div className="font-mono text-[12px] font-bold text-zinc-200" data-testid="trademark-selected-name">
          {content.selectedName}
        </div>
      )}
      {Array.isArray(content.signals) && content.signals.map((signal, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2"
          data-testid={`trademark-signal-${i}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-mono text-[11px] font-semibold text-zinc-200">{signal.mark}</div>
              {signal.class && (
                <div className="font-mono text-[9px] text-zinc-500">Class {signal.class}</div>
              )}
              {signal.owner && (
                <div className="font-mono text-[9px] text-zinc-500">{signal.owner}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {signal.registrationNumber && (
                <span className="font-mono text-[9px] text-zinc-500">#{signal.registrationNumber}</span>
              )}
              <Badge
                variant="outline"
                className={`font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${TRADEMARK_STATUS_CLASSES[signal.status] ?? TRADEMARK_STATUS_CLASSES.dead}`}
                data-testid={`trademark-signal-${i}-status`}
              >
                {signal.status}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- ArchitectureRenderer ---

const TECH_BADGE_CLASS = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";

export function ArchitectureRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="architecture-renderer">
      {content.systemOverview && (
        <CollapsibleSection title="System Overview" defaultOpen testId="architecture-system-overview">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.systemOverview === "string"
              ? content.systemOverview
              : JSON.stringify(content.systemOverview, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {Array.isArray(content.components) && content.components.length > 0 && (
        <CollapsibleSection title="Components" defaultOpen testId="architecture-components">
          <div className="space-y-2">
            {content.components.map((comp, i) => (
              <div
                key={i}
                className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`architecture-component-${i}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold text-zinc-200">
                    {comp.name}
                  </span>
                  {comp.technology && (
                    <Badge
                      variant="outline"
                      className={`font-mono text-[8px] uppercase tracking-[0.08em] ${TECH_BADGE_CLASS}`}
                      data-testid={`architecture-component-${i}-tech`}
                    >
                      {comp.technology}
                    </Badge>
                  )}
                </div>
                {comp.responsibility && (
                  <div className="mt-1 font-mono text-[10px] text-zinc-400 leading-relaxed">
                    {comp.responsibility}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {content.dataFlow && (
        <CollapsibleSection title="Data Flow" defaultOpen testId="architecture-data-flow">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.dataFlow === "string"
              ? content.dataFlow
              : JSON.stringify(content.dataFlow, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.deploymentModel && (
        <CollapsibleSection title="Deployment Model" defaultOpen testId="architecture-deployment-model">
          <div className="font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {typeof content.deploymentModel === "string"
              ? content.deploymentModel
              : JSON.stringify(content.deploymentModel, null, 2)}
          </div>
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="architecture-recommendation">
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

// --- SpecificationRenderer ---

const PRIORITY_CLASSES = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const METHOD_CLASSES = {
  GET: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function SpecificationRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="specification-renderer">
      {Array.isArray(content.functionalRequirements) && content.functionalRequirements.length > 0 && (
        <CollapsibleSection title="Functional Requirements" defaultOpen testId="specification-functional-requirements">
          <div className="space-y-2">
            {content.functionalRequirements.map((req, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`specification-functional-req-${i}`}
              >
                <Badge
                  variant="outline"
                  className="font-mono text-[8px] font-bold uppercase tracking-[0.08em] bg-zinc-800 text-zinc-300 border-zinc-700 shrink-0"
                  data-testid={`specification-functional-req-${i}-id`}
                >
                  {req.id}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold text-zinc-200">{req.title}</span>
                    {req.priority && (
                      <Badge
                        variant="outline"
                        className={`font-mono text-[8px] uppercase tracking-[0.08em] ${PRIORITY_CLASSES[req.priority] ?? PRIORITY_CLASSES.low}`}
                        data-testid={`specification-functional-req-${i}-priority`}
                      >
                        {req.priority}
                      </Badge>
                    )}
                  </div>
                  {req.description && (
                    <div className="mt-1 font-mono text-[10px] text-zinc-400 leading-relaxed">
                      {req.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {Array.isArray(content.nonFunctionalRequirements) && content.nonFunctionalRequirements.length > 0 && (
        <CollapsibleSection title="Non-Functional Requirements" defaultOpen testId="specification-non-functional-requirements">
          <div className="space-y-2">
            {content.nonFunctionalRequirements.map((nfr, i) => (
              <div
                key={i}
                className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`specification-nfr-${i}`}
              >
                <div className="font-mono text-[10px] font-semibold text-zinc-200">{nfr.category}</div>
                <div className="mt-1 font-mono text-[10px] text-zinc-400">{nfr.requirement}</div>
                {nfr.metric && (
                  <div className="mt-1 font-mono text-[9px] text-zinc-500">Metric: {nfr.metric}</div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {Array.isArray(content.apiContracts) && content.apiContracts.length > 0 && (
        <CollapsibleSection title="API Contracts" defaultOpen testId="specification-api-contracts">
          <div className="space-y-2">
            {content.apiContracts.map((api, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`specification-api-contract-${i}`}
              >
                <Badge
                  variant="outline"
                  className={`font-mono text-[8px] font-bold uppercase tracking-[0.08em] shrink-0 ${METHOD_CLASSES[api.method] ?? METHOD_CLASSES.GET}`}
                  data-testid={`specification-api-contract-${i}-method`}
                >
                  {api.method}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] font-semibold text-zinc-200">{api.endpoint}</div>
                  {api.description && (
                    <div className="mt-1 font-mono text-[10px] text-zinc-400 leading-relaxed">
                      {api.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="specification-recommendation">
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

// --- PrototypeRenderer ---

export function PrototypeRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="space-y-2" data-testid="prototype-renderer">
      {content.projectStructure && (
        <CollapsibleSection title="Project Structure" defaultOpen testId="prototype-project-structure">
          <pre className="font-mono text-[10px] text-zinc-300 leading-relaxed whitespace-pre overflow-x-auto">
            {content.projectStructure}
          </pre>
        </CollapsibleSection>
      )}
      {Array.isArray(content.entryPoints) && content.entryPoints.length > 0 && (
        <CollapsibleSection title="Entry Points" defaultOpen testId="prototype-entry-points">
          <div className="space-y-2">
            {content.entryPoints.map((ep, i) => (
              <div
                key={i}
                className="rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`prototype-entry-point-${i}`}
              >
                <div className="font-mono text-[10px] font-bold text-zinc-200">{ep.file}</div>
                {ep.purpose && (
                  <div className="mt-1 font-mono text-[10px] text-zinc-400">{ep.purpose}</div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {Array.isArray(content.dependencies) && content.dependencies.length > 0 && (
        <CollapsibleSection title="Dependencies" defaultOpen testId="prototype-dependencies">
          <div className="space-y-2">
            {content.dependencies.map((dep, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
                data-testid={`prototype-dependency-${i}`}
              >
                <div>
                  <span className="font-mono text-[10px] font-bold text-zinc-200">{dep.name}</span>
                  {dep.purpose && (
                    <span className="ml-2 font-mono text-[10px] text-zinc-400">— {dep.purpose}</span>
                  )}
                </div>
                {dep.version && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[8px] tracking-[0.08em] bg-zinc-800 text-zinc-300 border-zinc-700 shrink-0"
                    data-testid={`prototype-dependency-${i}-version`}
                  >
                    {dep.version}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {content.setupInstructions && (
        <CollapsibleSection title="Setup Instructions" defaultOpen testId="prototype-setup-instructions">
          <pre className="font-mono text-[10px] text-zinc-300 leading-relaxed whitespace-pre overflow-x-auto">
            {content.setupInstructions}
          </pre>
        </CollapsibleSection>
      )}
      {content.recommendation && (
        <CollapsibleSection title="Recommendation" defaultOpen testId="prototype-recommendation">
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
  naming_candidates: NamingCandidatesRenderer,
  domain_signals: DomainSignalsRenderer,
  trademark_signals: TrademarkSignalsRenderer,
  architecture_outline: ArchitectureRenderer,
  specification: SpecificationRenderer,
  prototype_scaffold: PrototypeRenderer,
};

/**
 * Dispatches to the correct sub-renderer based on artifact.type.
 *
 * @param {{ artifact: { type: string, content: any }, onAction?: Function }} props
 */
export default function ArtifactRenderer({ artifact, onAction }) {
  if (!artifact) return null;

  const Renderer = TYPE_RENDERERS[artifact.type];

  if (Renderer) {
    return <Renderer content={artifact.content} onAction={onAction} />;
  }

  return <GenericRenderer content={artifact.content} type={artifact.type} />;
}
