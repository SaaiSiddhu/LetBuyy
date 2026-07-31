# LCIS Reasoning Engine

> **LCIS V2**  
> Module: `tools/central-intelligence/reasoning/`  
> Entry point: `ReasoningEngine.mjs` (facade)

---

## Purpose

The Reasoning Engine answers the class of questions that neither a graph query nor a file scan can answer in isolation: **Why did this happen? What caused this symptom? What is affected? What should I investigate? What is the highest risk?**

These questions require combining structural knowledge (the dependency graph, the architecture topology, the domain model) with operational context (incidents, deployments, metrics, runbooks) and historical memory (prior incidents, architecture decisions, rejected approaches). The Reasoning Engine does this by routing each question to a specialized reasoner, collecting evidence from multiple sources, and returning a structured result that always distinguishes what is structurally known from what requires live data that is `NOT CONNECTED`.

The Reasoning Engine never fabricates. Every claim in its output is backed by a named source — a graph edge, a code symbol, a known hotspot baseline, a memory entry, or an honest `NOT CONNECTED` marker with the exact signal source that would provide the missing data.

---

## The 6 Reasoners

```
tools/central-intelligence/reasoning/
├── ReasoningEngine.mjs        — facade + question classifier + result merger
├── IncidentReasoner.mjs       — why did this incident happen + what is affected
├── DependencyReasoner.mjs     — what breaks if X changes
├── ArchitectureReasoner.mjs   — layer/service/anti-pattern analysis
├── OperationalReasoner.mjs    — metric correlation + degradation diagnosis
├── DeploymentReasoner.mjs     — deployment risk + GO/NO-GO + impact prediction
└── SecurityReasoner.mjs       — attack surface + control assessment + hardening
```

### Question Classification

`ReasoningEngine.reason(question, context)` classifies the free-form question by regex pattern matching before dispatching:

| Pattern | Reasoner dispatched |
|---------|-------------------|
| `incident\|outage\|down\|failed\|error\|5xx` | `IncidentReasoner` |
| `deploy\|release\|ship\|merge\|push\|rollback` | `DeploymentReasoner` |
| `security\|auth\|rls\|jwt\|attack\|vulnerability\|xss\|injection` | `SecurityReasoner` |
| `depends\|import\|uses\|breaks\|blast\|downstream` | `DependencyReasoner` |
| `architecture\|layer\|pattern\|anti-pattern\|coupling` | `ArchitectureReasoner` |
| `metric\|latency\|throughput\|queue\|worker\|slow` | `OperationalReasoner` |
| (no pattern match) | All reasoners in parallel; results merged |

All six reasoners are **lazy-loaded** — the module is not imported until first use of that reasoner class.

---

## Reasoner Details

### IncidentReasoner

Maps raw incident domains to 8 canonical domain keys:

| Raw input pattern | Canonical domain |
|-------------------|-----------------|
| `payment\|pay\|razorpay` | `payments` |
| `order\|purchase` | `orders` |
| `checkout\|cart` | `checkout` |
| `auth\|login\|session\|jwt` | `identity` |
| `queue\|worker\|job` | `queue-workers` |
| `webhook` | `webhook` |
| `product\|inventory` | `products` |
| `theme\|storefront` | `themes` |

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(incident)` | Full incident analysis: canonical domain → cause ranking → affected systems → investigation steps |
| `rankCauses(incident)` | Returns ordered cause candidates with confidence scores |
| `getMostLikelyAffected(incident)` | Services, domains, and merchant populations most likely affected |
| `suggestInvestigation(incident, domain, runbook)` | Returns ordered 7-step investigation playbook |

**For payment/orders/checkout domains**, the reasoner always flags canonical ledger RPC integrity as an additional investigation axis — checking `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card` in the evidence chain.

**7-step investigation playbook (standard):**
1. Check `graphify-out/runbooks.json` for domain-specific runbook
2. Query LCIS blast radius for the affected component (`/api/blast?q=`)
3. Check `git log` for recent changes to the domain
4. Verify Cloudflare Worker health (`wrangler tail`)
5. Query Supabase for recent RPC errors on canonical money RPCs
6. Cross-reference Razorpay webhook logs for payment domains
7. Check queue dead-letter counts for async domains

---

### DependencyReasoner

The blast-radius reasoning engine. Uses the dependency graph plus hardcoded hotspot baselines for the four most critical symbols.

**Known hotspot baselines (hardcoded; verified from graph):**

| Symbol | Blast (files affected) | Risk level |
|--------|----------------------|-----------|
| `getSupabaseAdmin` | 115 | `CRITICAL` |
| `@letbuyy/shared-types` | 80 (estimated; 27 direct package-level) | `CRITICAL` |
| `@letbuyy/api-client` | 60 (estimated) | `HIGH` |
| `create_checkout_order` | 40 (estimated) | `CRITICAL` |

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(component)` | Full dependency analysis: direct dependents → transitive blast → risk classification |
| `getHighestRiskDependencies()` | Top-N by composite risk score |
| `whatBreaksIf(component)` | Services, domains, and routes that would be impacted by a breaking change |
| `getCriticalPath(from, to)` | Shortest dependency path between two components |
| `assessChangeRisk(component)` | Returns risk level, evidence, and mitigation recommendations |

**Money/tenant proximity weighting:** if a component is in the blast path of a money table or tenant identity function, its blast score is weighted upward regardless of raw dependent count. This reflects the asymmetric impact of money/tenant bugs (regulatory, financial, multi-tenant data isolation).

---

### ArchitectureReasoner

Reasons about layer violations, anti-patterns, and refactoring opportunities. Uses `ArchitectureIntelligenceEngine` (lazy-imported) and consults LCIS V1 endpoints (`/api/production-readiness-v2`, `/api/domains`) for cross-validation.

**Hardcoded known god-modules:**
- `getSupabaseAdmin` — 115 files; should be replaced with scoped service accessors
- `create_checkout_order` — 40-file blast; canonical but structurally over-coupled

**Internal layer order for violation reasoning:**
`data → service → domain → api → app → ui`

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(question)` | Full architecture analysis: layers → violations → anti-patterns → health |
| `assessArchitectureRisk()` | Current risk across layer violations, coupling, blast-radius packages |
| `explainLayering()` | Human-readable explanation of the layering model and current state |
| `detectAntiPatterns()` | God modules, circular dependencies, forbidden layer dependencies |
| `recommendRefactors()` | Prioritized refactoring suggestions with rationale |

---

### OperationalReasoner

Correlates metric signals to probable root causes and recommends operational actions.

**METRIC_CAUSE_MAP (10 entries):**

| Metric pattern | Probable cause domain | Risk score |
|----------------|----------------------|-----------|
| `error_rate\|5xx` | gateway / service error | 0.85 |
| `payment\|razorpay` | payments domain / Razorpay API | 0.90 |
| `queue\|job\|worker` | queue-workers / dead-letters | 0.80 |
| `auth\|jwt\|401\|403` | identity / authentication / RLS | 0.92 |
| `latency\|slow\|timeout` | database / query performance | 0.75 |
| `webhook\|delivery` | webhook-service / retry exhaustion | 0.78 |
| `checkout\|cart` | checkout session / inventory lock | 0.88 |
| `inventory\|stock` | inventory reservations / concurrency | 0.72 |
| `theme\|render` | theme-engine / Liquid renderer | 0.70 |
| `memory\|oom\|cpu` | Worker resource limits | 0.82 |

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(question)` | Operational analysis: metric correlation → probable causes → actions |
| `diagnoseDegradation(signals)` | Given a set of signals, identify the most likely degradation source |
| `correlateMetricsToCause(metrics)` | Map metric names to probable cause domains via METRIC_CAUSE_MAP |
| `recommendActions(situation)` | Ordered action list for the identified situation |
| `assessOperationalRisk()` | Current operational risk from known structural signals |

---

### DeploymentReasoner

GO/NO-GO analysis for deployments. Uses pattern-matching on changed component names against a set of critical-path patterns to block or warn.

**Block-trigger patterns (any match → consider blocking):**

| Pattern | Why it triggers a block |
|---------|------------------------|
| `payment\|checkout\|ledger\|razorpay` | Money mutation path — step-up review required |
| `getSupabaseAdmin` | 115-file blast radius |
| `rls\|policy\|security.?definer` | Row-level security — multi-tenant data isolation risk |
| `jwt\|jwks\|session.*secret` | Auth token issuance — all active sessions potentially invalidated |
| `create_checkout_order\|confirm_order_payment` | Canonical ledger RPCs — financial integrity |

**GO/NO-GO derivation:**
1. Run block-trigger pattern matching over all changed component names
2. Fetch LCIS structural readiness (`/api/production-readiness-v2`) — NO-GO if structural % < 80%
3. Fetch open launch blockers — NO-GO if any P0 blockers open
4. Compute deployment risk score (see `RiskScorer` in Correlation section)
5. Return `GO` / `NO-GO` / `CONDITIONAL-GO` with evidence array

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(deployment)` | Full deployment analysis: risk → impact → GO/NO-GO |
| `assessDeploymentRisk(changedComponents)` | Per-component risk with pattern matching |
| `predictImpact(changedComponents)` | Services, domains, merchants affected by the change |
| `shouldBlock(deployment)` | Returns `{ block: boolean, reasons: string[] }` |
| `correlateToIncidents(deployment)` | Checks historical incidents for similar change patterns |

---

### SecurityReasoner

Assesses the security posture against 11 structural controls and provides hardening recommendations.

**11 Structural Security Controls:**

| Control ID | Description |
|------------|-------------|
| `RLS-001` | Row-level security on all tenant tables |
| `AUTH-001` | Merchant ES256 / Customer HS256 — two issuers, never crossed |
| `PAY-001` | Canonical ledger-only for money mutations (no `.from(table).insert`) |
| `PAY-002` | Server-authoritative totals (never trust client amounts) |
| `PAY-003` | Razorpay HMAC-SHA256 signature verification (`timingSafeEqualHex`) |
| `IDEMPOTENCY-001` | Every money RPC requires `idempotency_key` with `ON CONFLICT` |
| `WEBHOOK-001` | HMAC-signed queue/webhook envelopes (`signQueueTenantEnvelope`) |
| `TENANT-001` | `verifySiteOwnership` gates all service-role access to tenant data |
| `TURNSTILE-001` | Cloudflare Turnstile + rate-limit on registration/login |
| `LIQUID-001` | Liquid renderer sanitizer locked (`FORBID` lists, `outputEscape:'escape'`); canary OFF by default |
| `STEPUP-001` | HMAC step-up challenge gates refunds and payouts |

**8 of 11 controls are classified as critical** (RLS-001, AUTH-001, PAY-001, PAY-002, PAY-003, IDEMPOTENCY-001, TENANT-001, STEPUP-001).

**P0 Hardening rules:**
- Keep the 107-validator governance gate GREEN — never disable validators
- Never bypass the canonical-ledger-only-validator
- Never add `USING (true)` to RLS policies (public access)
- Never cross the two JWT issuers

**Methods:**

| Method | Description |
|--------|-------------|
| `reason(question)` | Security analysis: controls assessment → risk surface → recommendations |
| `assessAttackSurface()` | Entry points, trust boundaries, cross-tenant attack candidates |
| `reasonAboutVulnerability(advisory)` | Maps a CVE or advisory to affected controls and code paths |
| `getHighestRiskControls()` | Controls currently at risk (requires live telemetry for real status) |
| `recommendHardening()` | Ordered hardening actions by risk impact |

---

## ReasoningResult Schema

Every reasoner returns (or the facade assembles) a `ReasoningResult`:

```typescript
interface ReasoningResult {
  // Classification
  question: string;
  reasonerUsed: 'incident' | 'deployment' | 'security' | 'dependency' | 'architecture' | 'operational' | 'general';
  
  // Core answer
  hypothesis: string;          // Plain-language conclusion ("Most likely cause: ...")
  confidence: number;          // 0.0–1.0
  
  // Evidence chain
  evidence: Evidence[];
  reasoningChain: string[];    // Step-by-step reasoning steps
  
  // Structured findings
  findings: Finding[];
  recommendations: string[];
  
  // Honesty markers
  notConnected: string[];      // Live data sources that are NOT CONNECTED
  structuralOnly: boolean;     // true if all evidence is structural (no live data)
}

interface Evidence {
  source: 'graph' | 'code' | 'memory' | 'api' | 'baseline' | 'live';
  claim: string;
  detail?: string;
  connected: boolean;          // false + sourceHint when live data unavailable
  sourceHint?: string;         // "source: wrangler tail / Cloudflare Analytics Engine"
}
```

---

## Evidence-Based Reasoning

Every conclusion in a `ReasoningResult` must be traceable to one of five evidence types:

| Evidence type | Example |
|--------------|---------|
| `graph` | "`@letbuyy/shared-types` has 27 direct dependents (from LCIS_DEPENDENCY_GRAPH.json)" |
| `code` | "`getSupabaseAdmin` is imported by 115 files (RepositoryGraphBuilder symbolic index)" |
| `memory` | "Prior incident 2026-05-14: Razorpay webhook signature failure — root cause: missing env var" |
| `api` | "LCIS `/api/blast?q=create_checkout_order` returns 40 affected files" |
| `baseline` | "Known hotspot baseline: `create_checkout_order` = 40-file blast, CRITICAL" |

### NOT CONNECTED Honesty Contract

When a reasoning step requires live operational data that is not available, the result includes an explicit `NOT CONNECTED` marker:

```json
{
  "claim": "Current payment error rate",
  "connected": false,
  "sourceHint": "source: Cloudflare Analytics Engine / wrangler tail on letbuyy-api"
}
```

This is not a failure mode — it is the correct behavior. A reasoning result that fabricates a metric value is worse than one that says "I cannot determine this without live telemetry; here is where to find it."

**Structural evidence is always available** (the dependency graph, the architecture topology, the code symbols) — even without live telemetry, the reasoner can give confident structural answers. What it cannot do is confirm whether a known vulnerable path is currently being exploited, or whether a metric is currently elevated.

---

## Reasoning Chains

`ReasoningChain` is the ordered sequence of reasoning steps. Each step is a plain-language assertion with its evidence source. Example for "Why is checkout failing?":

```
1. [graph] checkout domain routes: storefront/checkout-payment-routes, storefront/cart-routes
2. [code]  create_checkout_order RPC is the canonical entry point (blast: 40 files)
3. [baseline] Canonical money mutation — requires idempotency_key ON CONFLICT
4. [code]  confirm_order_payment_with_ledger called immediately after — same transaction scope
5. [memory] Prior incident 2026-05-02: checkout failed due to inventory reservation deadlock
6. [NOT CONNECTED] current RPC error rate — source: Supabase logs / wrangler tail
7. [NOT CONNECTED] Razorpay webhook delivery status — source: Razorpay dashboard / payment_webhook_events table
8. [hypothesis] Most likely: inventory reservation lock contention or ledger RPC timeout
   confidence: 0.72
```

---

## Worked Examples

### Example 1 — `getSupabaseAdmin` change risk

**Query:** `reason("what breaks if I change getSupabaseAdmin")`

**Route:** `DependencyReasoner` (matches `breaks\|blast\|downstream`)

**Result:**
```
hypothesis: "getSupabaseAdmin has the highest blast radius in the repository.
             A breaking change affects 115 files across all 8 canonical runtimes
             and all 22 business domains."
confidence: 0.98
evidence:
  - source: baseline, claim: "115-file blast (known hotspot baseline)", connected: true
  - source: graph, claim: "imports span all app/* and services/* roots", connected: true
recommendations:
  - "Do not refactor getSupabaseAdmin without a full dependency audit first"
  - "Use pnpm graph:intel blast 'getSupabaseAdmin' to get the current impact list"
  - "Any change requires ARB review per LETBUYY_CONSTITUTION.md governance rules"
notConnected: []
structuralOnly: true
```

### Example 2 — Payment incident root cause

**Query:** `whyDidThisHappen("payment webhooks failing for site razorpay")`

**Route:** `IncidentReasoner` → canonical domain `payments`

**Reasoning chain:**
1. [graph] payments domain: 11 tables, 18 RPCs, 3 routes
2. [code] `confirm_order_payment_with_ledger` — canonical RPC for payment confirmation
3. [code] `PAY-003` control: Razorpay HMAC-SHA256 via `timingSafeEqualHex` — verification failure → 400
4. [baseline] `payment_webhook_events` table records all webhook receipts
5. [NOT CONNECTED] recent webhook event rows — source: Supabase `payment_webhook_events`
6. [NOT CONNECTED] Razorpay retry count — source: Razorpay merchant dashboard
7. [hypothesis] Most likely: HMAC verification failure (env var `RAZORPAY_WEBHOOK_SECRET` missing or rotated)
   confidence: 0.81

### Example 3 — Deployment GO/NO-GO

**Query:** `reason("should I deploy changes to create_checkout_order and RLS policies")`

**Route:** `DeploymentReasoner` (matches `deploy\|release`)

**Result:**
```
hypothesis: "NO-GO. This deployment touches two critical-path patterns."
confidence: 0.95
findings:
  - "create_checkout_order matches pattern 'create_checkout_order|confirm_order_payment': BLOCK"
  - "RLS policies match pattern 'rls|policy|security.?definer': BLOCK"
recommendations:
  - "Schedule for off-peak (< 100 active sessions)"
  - "Require ARB sign-off per LETBUYY_CONSTITUTION.md"
  - "Stage in single-tenant sandbox first"
  - "Prepare rollback: git revert + migration reversal"
notConnected:
  - "current active session count — source: Supabase auth.sessions"
  - "Razorpay live order volume — source: payment_transactions table"
```

---

## API Endpoints

Reasoning endpoints are prefixed `/intelligence/reason/`:

| Method | Endpoint | Handler |
|--------|----------|---------|
| `POST` | `/intelligence/reason` | `ReasoningEngine.reason(question, context)` |
| `POST` | `/intelligence/reason/explain` | `ReasoningEngine.explain(subject)` |
| `POST` | `/intelligence/reason/why` | `ReasoningEngine.whyDidThisHappen(incident)` |
| `POST` | `/intelligence/reason/caused-by` | `ReasoningEngine.whatCaused(symptom)` |
| `POST` | `/intelligence/reason/affected` | `ReasoningEngine.whatIsAffected(component)` |
| `POST` | `/intelligence/reason/investigate` | `ReasoningEngine.whatToInvestigate(problem)` |
| `GET` | `/intelligence/reason/highest-risk` | `ReasoningEngine.highestRiskDependency()` |
| `POST` | `/intelligence/reason/incident` | `IncidentReasoner.reason(incident)` |
| `POST` | `/intelligence/reason/incident/causes` | `IncidentReasoner.rankCauses(incident)` |
| `POST` | `/intelligence/reason/incident/affected` | `IncidentReasoner.getMostLikelyAffected(incident)` |
| `POST` | `/intelligence/reason/dependency` | `DependencyReasoner.reason(component)` |
| `POST` | `/intelligence/reason/dependency/breaks-if` | `DependencyReasoner.whatBreaksIf(component)` |
| `POST` | `/intelligence/reason/dependency/risk` | `DependencyReasoner.assessChangeRisk(component)` |
| `POST` | `/intelligence/reason/architecture` | `ArchitectureReasoner.reason(question)` |
| `POST` | `/intelligence/reason/architecture/risks` | `ArchitectureReasoner.assessArchitectureRisk()` |
| `POST` | `/intelligence/reason/operational` | `OperationalReasoner.reason(question)` |
| `POST` | `/intelligence/reason/operational/diagnose` | `OperationalReasoner.diagnoseDegradation(signals)` |
| `POST` | `/intelligence/reason/deployment` | `DeploymentReasoner.reason(deployment)` |
| `POST` | `/intelligence/reason/deployment/should-block` | `DeploymentReasoner.shouldBlock(deployment)` |
| `POST` | `/intelligence/reason/deployment/go-no-go` | Full GO/NO-GO result with evidence |
| `POST` | `/intelligence/reason/security` | `SecurityReasoner.reason(question)` |
| `GET` | `/intelligence/reason/security/surface` | `SecurityReasoner.assessAttackSurface()` |
| `GET` | `/intelligence/reason/security/controls` | `SecurityReasoner.getHighestRiskControls()` |

**Request body format:**
```json
{
  "question": "why is checkout failing",
  "context": {
    "domain": "orders",
    "changedComponents": ["create_checkout_order"],
    "signals": { "error_rate": "elevated" }
  }
}
```
