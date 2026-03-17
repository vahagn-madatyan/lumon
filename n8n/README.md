# n8n Integration — Lumon Pipeline

## Prerequisites

- **n8n** running locally — either via Docker or npm
- **Lumon** dev server running (`npm run dev` from project root)

### Start n8n with Docker (recommended)

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e WEBHOOK_URL=http://localhost:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

If running on macOS with the Lumon bridge server on the host, n8n inside Docker reaches the bridge at `http://host.docker.internal:3001`. The workflow template uses this by default.

### Start n8n with npm

```bash
npx n8n start
```

When running n8n directly on the host, update the callback URL in the workflow to `http://localhost:3001`.

## Import the Workflow

1. Open n8n at [http://localhost:5678](http://localhost:5678)
2. Go to **Workflows → Import from File**
3. Select `n8n/workflows/intake-viability.json`
4. Click **Save**
5. **Activate** the workflow (toggle in the top-right)

After activation, note the webhook URL shown on the Webhook Trigger node — it will look like:

```
http://localhost:5678/webhook/lumon-intake
```

## Configure the Bridge Server

Set the `N8N_WEBHOOK_URL` environment variable before starting the Lumon dev server:

```bash
export N8N_WEBHOOK_URL=http://localhost:5678/webhook/lumon-intake
npm run dev
```

Or create a `.env` file in the project root:

```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/lumon-intake
```

## Configure the Callback URL (n8n → bridge)

The workflow's "Callback to Bridge" node sends results back to the Lumon bridge server. It uses the `LUMON_BRIDGE_URL` environment variable in n8n, defaulting to `http://host.docker.internal:3001` (Docker on macOS).

**If running n8n directly on the host (not Docker):**

1. Open the imported workflow in n8n
2. Click the **Callback to Bridge** node
3. Change the URL from `http://host.docker.internal:3001` to `http://localhost:3001`
4. Save the workflow

**If using Docker:** The default `host.docker.internal:3001` should work on macOS and Windows. On Linux, use `--add-host=host.docker.internal:host-gateway` in the Docker run command.

## Expected Flow

```
┌──────────────┐     POST /webhook/lumon-intake      ┌──────────────┐
│ Lumon Bridge │ ──────────────────────────────────► │     n8n      │
│  (port 3001) │     { projectId, stageKey,          │  (port 5678) │
│              │       executionId }                  │              │
│              │                                      │  1. Receive  │
│              │                                      │  2. Analyze  │
│              │     POST /api/pipeline/callback      │  3. Callback │
│              │ ◄────────────────────────────────── │              │
│              │     { executionId, projectId,        │  4. Wait for │
│              │       stageKey, result, resumeUrl }  │     approval │
│              │                                      │              │
│              │     GET resumeUrl                    │              │
│              │ ──────────────────────────────────► │  5. Resume   │
│              │     (on operator approve)            │              │
└──────────────┘                                      └──────────────┘
        ▲                                                     │
        │              SSE events                             │
        ├─── stage-update (awaiting_approval)                 │
        ├─── artifact-ready (viability result)                │
        └─── pipeline-status (approved/rejected)              │
                                                              │
┌──────────────┐                                              │
│ Lumon Client │  ← SSE stream ← Bridge                      │
│  (browser)   │  Trigger / Approve / Reject buttons          │
└──────────────┘
```

## Verifying the Integration

1. Start n8n, import and activate the workflow
2. Start Lumon: `N8N_WEBHOOK_URL=http://localhost:5678/webhook/lumon-intake npm run dev`
3. Open Lumon dashboard at [http://localhost:5173](http://localhost:5173)
4. Create or select a project
5. Click **Trigger Discovery** — the button appears on the intake stage when status is `queued`
6. n8n executes the viability analysis and calls back to the bridge
7. The artifact appears in the Dossier tab under "Stage outputs"
8. Click **Approve** or **Reject** to complete the loop

## Plan Stage Workflows

The plan stage runs three sequential sub-workflows that produce naming, domain, and trademark artifacts. The bridge server orchestrates them in order: **naming_candidates → domain_signals → trademark_signals**, forwarding context (including the operator-selected name) through the chain.

### Import the Plan Workflows

1. Import all three JSON files from `n8n/workflows/`:
   - `plan-naming-candidates.json` — generates brand name candidates
   - `plan-domain-signals.json` — checks domain availability per TLD
   - `plan-trademark-signals.json` — searches trademark databases
2. **Activate** each workflow after import.

### Webhook Paths

| Workflow | Webhook Path | Env Var |
|----------|-------------|---------|
| Naming Candidates | `lumon-plan-naming` | `N8N_WEBHOOK_URL_PLAN_NAMING` |
| Domain Signals | `lumon-plan-domain` | `N8N_WEBHOOK_URL_PLAN_DOMAIN` |
| Trademark Signals | `lumon-plan-trademark` | `N8N_WEBHOOK_URL_PLAN_TRADEMARK` |

### Environment Variables

Set these in your `.env` or export before starting the bridge server:

```bash
N8N_WEBHOOK_URL_PLAN_NAMING=http://localhost:5678/webhook/lumon-plan-naming
N8N_WEBHOOK_URL_PLAN_DOMAIN=http://localhost:5678/webhook/lumon-plan-domain
N8N_WEBHOOK_URL_PLAN_TRADEMARK=http://localhost:5678/webhook/lumon-plan-trademark
```

### Context Forwarding

The bridge server forwards context through the plan sub-stage chain:

1. **Naming Candidates** — receives the initial trigger. The Code node generates candidates without needing context. The operator selects a name from the results.
2. **Domain Signals** — receives `context.selectedName` in the webhook payload (the operator's chosen name). The Code node reads this to generate per-name domain availability results.
3. **Trademark Signals** — also receives `context.selectedName`. The Code node reads this to generate per-name trademark search results.

If `context.selectedName` is missing (e.g., during testing), both domain and trademark workflows fall back to a default name ("Nexus").

### Plan Sub-Stage Flow

```
┌─────────────┐  trigger   ┌──────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Naming Candidates│ ──────────► │   Bridge    │
│  (plan)     │            │  (n8n workflow)   │             │  records    │
└─────────────┘            └──────────────────┘             │  artifact   │
                                                             └──────┬──────┘
                                                                    │
                                              operator selects name │
                                                                    ▼
┌─────────────┐  trigger   ┌──────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Domain Signals   │ ──────────► │   Bridge    │
│  (context:  │            │  (n8n workflow)   │             │  records    │
│  selected   │            └──────────────────┘             │  artifact   │
│  Name)      │                                             └──────┬──────┘
└─────────────┘                                                    │
                                                                   ▼
┌─────────────┐  trigger   ┌──────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Trademark Signals│ ──────────► │   Bridge    │
│  (context:  │            │  (n8n workflow)   │             │  records    │
│  selected   │            └──────────────────┘             │  artifact   │
│  Name)      │                                             └──────┬──────┘
└─────────────┘                                                    │
                                                                   ▼
                                                          plan gate ready
```

## Verification Stage Workflows

The verification stage runs three sequential sub-workflows that produce architecture, specification, and prototype artifacts. The bridge server orchestrates them in order: **architecture_outline → specification → prototype_scaffold**, forwarding context through the chain. Verification auto-triggers after plan approval (when a webhook is configured).

### Import the Verification Workflows

1. Import all three JSON files from `n8n/workflows/`:
   - `verification-architecture-outline.json` — generates system architecture outline
   - `verification-specification.json` — generates functional/non-functional requirements and API contracts
   - `verification-prototype-scaffold.json` — generates project structure, dependencies, and setup instructions
2. **Activate** each workflow after import.

### Webhook Paths

| Workflow | Webhook Path | Env Var |
|----------|-------------|---------|
| Architecture Outline | `lumon-verification-architecture` | `N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE` |
| Specification | `lumon-verification-specification` | `N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION` |
| Prototype Scaffold | `lumon-verification-prototype` | `N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE` |

### Environment Variables

Set these in your `.env` or export before starting the bridge server:

```bash
N8N_WEBHOOK_URL_VERIFICATION_ARCHITECTURE=http://localhost:5678/webhook/lumon-verification-architecture
N8N_WEBHOOK_URL_VERIFICATION_SPECIFICATION=http://localhost:5678/webhook/lumon-verification-specification
N8N_WEBHOOK_URL_VERIFICATION_PROTOTYPE=http://localhost:5678/webhook/lumon-verification-prototype
```

### Verification Sub-Stage Flow

```
Plan approved → auto-trigger verification
        │
        ▼
┌─────────────┐  trigger   ┌──────────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Architecture Outline  │ ──────────► │   Bridge    │
│(verification│            │  (n8n workflow)       │             │  records    │
│)            │            └──────────────────────┘             │  artifact   │
└─────────────┘                                                 └──────┬──────┘
                                                                       │
                                                      auto-fire next   │
                                                                       ▼
┌─────────────┐  trigger   ┌──────────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Specification        │ ──────────► │   Bridge    │
│(verification│            │  (n8n workflow)       │             │  records    │
│)            │            └──────────────────────┘             │  artifact   │
└─────────────┘                                                 └──────┬──────┘
                                                                       │
                                                      auto-fire next   │
                                                                       ▼
┌─────────────┐  trigger   ┌──────────────────────┐  callback   ┌─────────────┐
│   Bridge    │ ─────────► │ Prototype Scaffold   │ ──────────► │   Bridge    │
│(verification│            │  (n8n workflow)       │             │  records    │
│)            │            └──────────────────────┘             │  artifact   │
└─────────────┘                                                 └──────┬──────┘
                                                                       │
                                                                       ▼
                                                          verification gate ready
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "n8n unreachable" on trigger | n8n not running or wrong URL | Check n8n is running and `N8N_WEBHOOK_URL` is correct |
| "n8n webhook failed" (502) | Workflow not activated | Activate the workflow in n8n |
| Callback never arrives | Wrong callback URL in n8n | Check the Callback node URL matches bridge server |
| resumeUrl errors on approve | n8n execution expired | Re-trigger; n8n Wait nodes have a default timeout |
| SSE not connecting | Vite proxy not configured | Ensure `/api` proxy is set in `vite.config.js` |
