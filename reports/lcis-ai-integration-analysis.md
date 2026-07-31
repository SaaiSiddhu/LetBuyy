# LCIS AI Integration Analysis
**LetBuyy Central Intelligence System — How AI Agents Use LCIS**
*Date: 2026-06-19 | Source: CLAUDE.md, AGENTS.md, tools/graph-server/server.mjs, ai-context-intel.mjs*

---

## 1. The AI Integration Problem LCIS Solves

Without LCIS, an AI agent (Claude Code, Codex, Cursor, or similar) attempting to answer "What breaks if payments fail?" would need to:
1. Read `services/api-gateway/src/routes/` (dozens of files)
2. Trace payment flow through `payment_transactions`, `orders`, `ledger_entries`
3. Cross-reference with worker topology in `wrangler.toml`
4. Understand RLS policies from SQL migrations
5. Identify which merchants and revenue streams are affected

This exhausts context windows and produces unreliable answers.

**With LCIS:**
```
GET /api/business-impact?domain=payments
→ structured JSON in <10ms, no context window spent
```

---

## 2. The "LCIS-First" Protocol

LCIS introduces a strict query ordering protocol embedded in `CLAUDE.md`. This protocol appears in every LCIS version and grows stronger with each version:

### V2 Protocol (initial):
> "Query before you change: `pnpm graph:intel blast "<symbol>"` (impact/blast radius)"

### V3 Protocol (LCIS-FIRST):
> "For these questions, get the answer from LCIS first (one command) instead of grepping the whole tree"

### V4 Protocol (7-row execution):
> "Execution order: LCIS → Runtime → Impact → Ownership → Memory → Deployment"

### V5 Protocol (V5-FIRST):
> "Before scanning the repository, query in this order: Runtime → Merchant → Revenue → Security → Incident → Decision"

### OMEGA Protocol (OMEGA-FIRST):
> "Before any repo scan: Unified Brain → Fix Engine → Telemetry → Revenue → Merchant → Customer → Runtime → Domain → DB → Code"

### V6 Protocol (Genesis Control Centers):
> "Fall back to a full repo scan only when LCIS returns nothing or the data layer is stale (`pnpm graph:update && graph:omega`)"

---

## 3. CLAUDE.md Query Table (Complete AI Protocol)

CLAUDE.md contains an explicit table mapping every AI question type to its LCIS query. This table covers 12 question categories:

| Question | LCIS Query |
|----------|-----------|
| Where is X implemented? | `pnpm graph:intel deps "X"` · `/api/search?q=X` |
| What breaks if I change X? | `pnpm graph:intel blast "X"` · `/api/blast?q=X` |
| Who owns X? | `pnpm graph:intel owner "X"` · `/api/owner?q=X` |
| What tables/policies/triggers affect table T? | `pnpm graph:intel table T` · `/api/table?name=T` |
| What does RPC R touch? | `pnpm graph:intel rpc R` · `/api/rpc?name=R` |
| What policies are on table T? | `pnpm graph:intel policy T` · `/api/policy?table=T` |
| Money/refund/payout/tenant flow? | `pnpm graph:intel payment\|refund\|payout\|tenant` |
| Route → RPC → table chain? | `pnpm graph:intel flow "<route>"` |
| Most critical systems? | `pnpm graph:intel critical` |
| Infrastructure (workers/queues/secrets/deploy)? | `pnpm graph:intel infra` · `/api/infra` |
| Live provider federation? | `/api/federation` · `/api/live-graph` |
| Live health/risk for a domain? | `/api/live-health` · `/api/live-health?domain=D` |
| "Why is X failing?" root cause? | `/api/investigate?q=` · `/api/root-cause?domain=` |
| What changed / time-travel? | `/api/time-travel` |
| Founder readiness · merchant ops? | `/api/executive-center` · `/api/merchant-ops` |
| Pre-deploy change impact? | `/api/change-impact-live?domain=` · `/api/release-intel` |
| Observability question? | `/api/observability` · `/api/ops-copilot?q=` |

Additionally, V3+ introduces the domain-intelligence protocol (22 domains):

| Question | LCIS Query |
|----------|-----------|
| What domains exist? | `pnpm graph:domain list` · `/api/domains` |
| What breaks if domain D changes? | `pnpm graph:cross D` · `/api/cross-domain?key=D` |
| Full payment change blast? | `pnpm graph:payment` · `/api/payment` |
| Security/attack surface? | `pnpm graph:security` · `/api/security` |
| What deploys X? | `pnpm graph:deployment` · `/api/deployment` |
| Incident root cause · affected domains? | `pnpm graph:incident <domain>` · `/api/incident?domain=D` |
| What feature/service uses secret S? | `/api/secrets` |
| What's new / unclassified? | `pnpm graph:discover` |

And the LCIS OMEGA protocol adds:
| Question | LCIS Query |
|----------|-----------|
| The whole picture? | `/api/unified-intelligence` |
| What should be fixed (with plans)? | `/api/fix-engine` |
| Merchant health / risk / growth? | `/api/merchant-{health,risk,growth,adoption,churn}` |
| Customer funnel / conversion? | `/api/customer-intelligence-v2` |
| Revenue funnel / gift-card liability? | `/api/revenue-v2` |
| How much does it cost? | `/api/cost-intelligence` |
| Why / who decided? | `/api/memory-v2` |
| What blocks 1k / 10k merchants? | `/api/decision-v2` · `/api/production-readiness-v2` |
| Architecture / security / drift? | `/api/discovery-v2` |

---

## 4. AI Context Packs

LCIS generates self-contained context packs for AI agents that don't have access to the running server. Each pack is < 20,000 tokens.

### Pack Types (`/api/ai-context?pack=`)
- `project` — Project overview, architecture summary, runtimes, domains
- `architecture` — Technical architecture deep dive
- `launch` — Launch readiness, blockers, GO/NO-GO verdict
- `feature` — Feature development context
- `domain` — Domain-specific context (combined with `?node=payments`)

### Multi-Model Packs (`/api/ai-pack?target=`)
Generated by `tools/graph-server/ai-context-intel.mjs`:
- `claude` — Optimized for Claude Code / Claude API
- `gemini` — Optimized for Gemini API
- `codex` — Optimized for OpenAI Codex
- `cursor` — Optimized for Cursor IDE
- `openai` — Optimized for OpenAI ChatGPT

**Pack contents:**
1. Project description (purpose, domain model, commerce rules)
2. Commerce/payment/refund/security/infrastructure flows
3. Launch verdict and blockers
4. Live-data connection status (all NOT CONNECTED in dev)
5. Per-domain summaries (all 22 domains)
6. LCIS query examples for common questions

**Token measurement:** Each pack measures approximate token count (characters ÷ 4) and flags if over 20,000 tokens.

### Paste-Ready AI Context Per Domain (`/api/explain?node=X`)
Every domain's explain node includes an `aiContext` field — a pre-formatted single-string context summary:
```
You are working with the Payments domain in LetBuyy.
Purpose: [domain purpose]
Tables: payment_transactions, ledger_entries, ...
RPCs (SECURITY DEFINER): confirm_order_payment_with_ledger, ...
Critical rules: canonical-ledger-only-validator forbids direct table mutations...
```

---

## 5. Natural Language Routing

LCIS implements natural-language question routing at two levels:

### `/api/copilot?q=` (V6 Explain Copilot)
Routes NL questions to the right explain node:
- "How does checkout work?" → `/domain/orders/explain`
- "What breaks if payments fail?" → `/domain/payments/impact`
- "Who owns the refund flow?" → `/domain/refunds/explain`
- "What's the customer journey?" → `/journey/checkout`

Sample question routing (6/6 verified in V6 certification):
1. "What is LetBuyy?" → system overview
2. "How does checkout work?" → orders domain explain
3. "What breaks if payments fail?" → payments impact
4. "Who owns the refund flow?" → refunds owner
5. "What's the customer journey?" → journey workspace
6. "How do I onboard as a developer?" → developer getting-started

### `/api/ops-copilot?q=` (Operations Copilot)
Routes operations questions by intent classification (regex-based):
- Intent: `time-travel` → `/api/time-travel`
- Intent: `root-cause` → `/api/root-cause?domain=resolved`
- Intent: `impact` → `/api/change-impact-live?domain=resolved`
- Intent: `cost` → `/api/cost-intelligence`
- Intent: `health` → `/api/live-health?domain=resolved`
- Intent: `investigate` → `/api/investigate?q=`

### `resolveDomain(q)` function (server.mjs)
Used by `investigate`, `copilotX`, `rootCause`, `changeImpactLive`, and more:
1. Direct key match (e.g., "orders" → "orders")
2. Keyword hint map (40+ mappings): checkout→orders, pay→payments, refund→refunds, ship→shipping, tax→gst, login→authentication, auth→authentication, theme→themes, store→storefront, email→notifications, gift→gift-cards, discount→discounts, inventory→inventory, product→products, collection→collections, order→orders, merchant→merchant, identity→identity
3. Semantic search via `searchV2(q)` as fallback

---

## 6. The 12 Audit Agents (`.claude/commands/agent-*.md`)

LCIS ships 12 specialized Claude agent slash commands for systematic audits. Each agent:
1. Queries the graph (specific LCIS endpoints)
2. Inspects relevant source code
3. Reports findings with file:line citations

| Agent Command | Domain Covered |
|--------------|---------------|
| `agent-security-audit` | Security posture, JWT, RLS, HMAC |
| `agent-architecture-audit` | Runtime topology, topology drift |
| `agent-payment-audit` | Money tables, RPCs, ledger integrity |
| `agent-tenant-audit` | Tenant isolation, RLS coverage |
| `agent-identity-audit` | Two-issuer model, ES256/HS256 |
| `agent-checkout-audit` | Checkout flow, `create_checkout_order` |
| `agent-marketplace-audit` | Frozen marketplace topology |
| `agent-theme-audit` | Liquid engine, sanitizer, ART-17 |
| `agent-developer-audit` | OAuth/PKCE, developer platform |
| `agent-release-audit` | Release readiness, blockers, gate |
| `agent-infrastructure-audit` | Workers, queues, secrets, Cloudflare |
| `agent-compliance-audit` | GST, GDPR, regulatory compliance |

---

## 7. The 7 Stop-Condition Questions (OMEGA)

LCIS OMEGA guarantees these 7 questions are answerable without a repo scan:

| Question | LCIS Endpoint |
|----------|--------------|
| How does X work? | `/api/explain?node=X` |
| What breaks if X fails? | `/api/cross-domain?key=X` + `/api/impact-score?domain=X` |
| Who owns X? | `/api/owner?q=X` |
| What should I fix next? | `/api/decision-v2` + `/api/fix-engine` |
| What blocks launch? | `/api/launch-command-center` + `/api/launch-status` |
| What is affected? | `/api/business-impact?domain=X` |
| How do I recover? | `/api/runbook?domain=X` + `/api/incident-control?target=X` |

---

## 8. AI Mode Surfaces

LCIS exposes dedicated "AI modes" — structured contexts for different AI agent roles:

| Mode | Endpoint | Audience |
|------|---------|---------|
| Founder Mode | `/api/founder` | Executive AI assistant |
| Operations Mode | `/api/observability` + `/api/ops-copilot` | On-call AI |
| Support Mode | `/api/investigate?q=` | Customer support AI |
| Investor Mode | `/api/investor` | Financial AI assistant |
| Developer Mode | `/api/developer` | New developer AI |

### New Developer Mode ("30-minute onboarding")
Endpoint: `/api/developer`
Produces a structured onboarding guide with 10 steps:
1. What LetBuyy is
2. The 8 canonical runtimes
3. The 22 business domains
4. The database model
5. Money/payment rules
6. Authentication model
7. The development workflow
8. Common debugging approaches
9. Change-control hotspots
10. First contribution recommendations

---

## 9. Atlas V2 Composed Answer (Genesis)

`/api/atlas-v2?node=X` is the highest-level AI query — it composes a complete answer from:
1. Explain node (purpose/criticality/failure impact)
2. Blast radius (what breaks if this domain changes)
3. Incident trace (what to do if this domain fails)
4. Domain detail (routes/RPCs/tables/queues/workers/owners)

All in a single response, formatted for AI consumption.

---

## 10. AI Pack Architecture (ai-context-intel.mjs)

The AI pack generator calls `buildExplainIntel()` fresh at each build (no caching) to produce an always-current pack. Pack structure:

```
[SYSTEM CONTEXT FOR <MODEL>]
=== LetBuyy Commerce Platform ===
Project: Multi-tenant India-first commerce platform
Version: LCIS OMEGA Intelligence Pack

=== ARCHITECTURE ===
[8 runtimes with descriptions]

=== KEY DOMAINS ===
[22 domains with key attributes]

=== COMMERCE RULES ===
Money: canonical double-entry ledger, SECURITY DEFINER RPCs only
Auth: two issuers never crossed (customer HS256, merchant ES256)
RLS: FORCE enabled on all tenant tables
GST: server-side computation, invoices immutable

=== PAYMENT FLOW ===
[create_checkout_order → confirm_order_payment_with_ledger flow]

=== LAUNCH STATUS ===
Verdict: [GO/NO-GO]
Blockers: [list]

=== LIVE DATA STATUS ===
All live values: NOT CONNECTED
Source: Supabase/Cloudflare/Vercel/Razorpay when configured

=== LCIS QUERY EXAMPLES ===
Q: "What breaks if I change X?" → GET localhost:3333/api/blast?q=X
Q: "Who owns X?" → GET localhost:3333/api/owner?q=X
...
```

---

## 11. How LCIS Prevents AI Architecture Drift

LCIS prevents AI agents from creating architecture drift through 5 mechanisms:

1. **Answer before exploration:** The CLAUDE.md "LCIS-FIRST" protocol mandates querying LCIS before any file scan. If LCIS provides the answer, the agent doesn't need to read source files — reducing guesswork.

2. **Explain nodes with AI context blocks:** Every domain's explain node includes an `aiContext` field with paste-ready architectural context. Agents paste this instead of inferring architecture.

3. **Governance memory queryable:** The 180 governance decisions are queryable at `/api/memory?q=` — an agent can ask "why does this rule exist" and get the decision history.

4. **Pre-validated knowledge:** LCIS knowledge is validated against the 107-validator gate before being served. Agents get pre-validated facts, not raw code inference.

5. **NOT CONNECTED honesty:** Agents cannot confuse structural knowledge with live operational data because the separation is explicit and mandatory. An agent seeing "NOT CONNECTED" knows to query a live source, not invent a value.

---

## 12. Limitations of LCIS for AI Agents

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Graphify doesn't index SQL bodies | RPC internal logic not queryable | `db-intel.mjs` provides partial SQL body analysis |
| Live metrics NOT CONNECTED | Cannot answer "what's failing now" | Connect provider adapters with staging credentials |
| Knowledge is static at build time | Changes since last `pnpm graph:omega` are invisible | Run `pnpm graph:omega` to refresh |
| No semantic embeddings | Fuzzy search limited to keyword matching | `/api/search-v2` provides NL routing with keyword matching |
| 20k token pack limit | Large repos may require multiple packs | Use per-domain packs (`/api/explain?node=X`) |
