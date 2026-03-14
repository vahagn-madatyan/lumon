# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? |
|---|------|-------|----------|--------|-----------|------------|
| D001 | M001 | scope | Primary operator model | Single owner-operator first | The user wants Lumon optimized for one person managing many projects, not a shared team product yet. | Yes — if multi-operator demand becomes primary |
| D002 | M001 | pattern | Pre-build progression | Explicit stage approvals between major phases | The user wants deliberate approval gates before the project advances toward build. | No |
| D003 | M001 | arch | Build handoff threshold | Full pre-build package required before GSD starts | Viability, business plan, naming, domain/trademark signals, architecture, specs, and prototype all matter before autonomous build begins. | Yes — if the user later defines an intentionally leaner mode |
| D004 | M001 | arch | Workflow orchestrator | n8n is the first-class orchestration layer for discovery and approval | The user explicitly wants n8n to run the staged pre-build workflow and surface it through Lumon. | No |
| D005 | M001 | convention | Irreversible external actions | Prepare and recommend, then require explicit confirmation | Repo creation, domain purchase, and similar side effects must never happen silently. | No |
| D006 | M001 | pattern | Build supervision posture | Observe by default, with one bounded retry before escalation | The user wants Lumon to self-heal once where sensible but stop clearly when human judgment is needed. | Yes — if runtime behavior proves too passive or too noisy |
| D007 | M001 | convention | Dashboard priority | Stage state and agent state outrank economics and terminal immersion | The main screen should answer where every project is and what every agent is doing now. | No |
| D008 | M001 | scope | Project target type | Software-product ventures first | The current vision is specifically about building software ventures, not general business or media operations. | Yes — if later milestones intentionally broaden scope |
