# LCIS Information Architecture

**Phase 7 deliverable — the IA for `apps/lcis`.** Discovery-grounded; no implementation.

> Anchors: `LCIS_FUTURE_MODEL.md` (one engine, two faces), `_evidence/competitive-engineering-platforms.md` (Linear/Backstage IA), `_evidence/competitive-observability.md` (catalog/entity model), `LCIS_DOMAIN_INTELLIGENCE.md` (demand side), `LCIS_REPOSITORY_ARCHAEOLOGY.md` (LCIS has zero current product surface — this is greenfield IA over an existing engine).

---

## 1. Design constraints (what the IA must honor)

1. **One engine, two faces.** The app is a *view over the same deterministic engine* that serves agents. No app-only data; everything the app shows, the API can return (and cite).
2. **Catalog is the spine.** Every competitor proves a service/entity catalog is the backbone (Backstage entities, Datadog Service Catalog, New Relic entities). LCIS's catalog = **Domain → Service/Runtime → Operation (RPC/route) → Table → Worker/Queue → Policy**, with typed relationships.
3. **Opinionated, not configurable.** Reject the V11 "modes" sprawl (Founder/Ops/Support/Investor/Developer modes). One curated IA that serves all personas through *filtering and saved views*, not five parallel apps.
4. **Cited or NOT CONNECTED.** Every value carries provenance: a graph node, a source file path, or the `NOT CONNECTED + env var` label.
5. **Fast enough to feel instant** (<50ms interactions; Linear standard). The pre-computed artifact model already enables this.
6. **Plain names.** Sections are named for what they answer, not for version lineage.

---

## 2. Personas (who uses it) — and the anti-pattern they replace

LCIS serves **five human personas + one machine persona**. Crucially, these are *lenses over one catalog*, not separate apps (the V11 mistake).

| Persona | Core question | Primary surfaces |
|---|---|---|
| **Engineer / on PR** | "What breaks if I change X? Who owns it? Is it safe?" | Catalog, Blast Radius, Ownership, Change Safety |
| **Operator / SRE** | "What's failing, who's affected, how do I recover?" | Runtime, Incident timeline, Runbooks, Detection (structural) |
| **Founder / exec** | "Are we ready to launch/scale? What's the top risk?" | Readiness (GO/NO-GO), Health Score, Top-fixes (₹-ranked) |
| **Support** | "Where is order X for store Y? Why did its payment fail?" | Tenant-scoped lookup (live, access-gated) + Investigate |
| **New engineer** | "How does LetBuyy work? Onboard me." | Explain / Self-model / AI-context pack |
| **AI agent (machine)** | grounding context for a change/investigation | Query API + MCP (cited) — *not the app* |

The persona is expressed as a **default saved view + a home dashboard preset**, selectable, not a hard-walled mode.

---

## 3. Navigation model

### 3.1 Primary entry: the command palette (`⌘K`)
The centerpiece, per Linear (`_evidence/competitive-engineering-platforms.md`): context-sensitive, dual-mode, recency-ranked.
- **Navigate mode:** type a domain/service/table/route/RPC name → jump to its catalog page. Type an identifier (`create_checkout_order`, `orders`, `api-gateway`) → go.
- **Ask mode:** type a natural-language question ("what breaks if payments fail", "who owns refunds", "is checkout ready to launch") → routed to the right engine answer (the `/copilot` router), rendered inline with citations.
- **Act mode (read-only):** run a SafetyGuard-allowed diagnostic ("validate tenant isolation", "check launch readiness") → result inline, audited.

`⌘K` is the fastest path to every answer; the sidebar is for browsing, the palette is for doing.

### 3.2 Left sidebar (browse) — Linear-shaped
```
[⌘K search]
★ Favorites            (pinned domains, saved views, watched entities)
⌂ Home                 (persona dashboard: readiness · top risks · recent changes)
◆ Catalog              (the spine — Domains, Services, Tables, Operations, Workers)
   ├ Domains (22)
   ├ Services / Runtimes
   ├ Data (tables · RPCs · policies)
   └ Infrastructure (workers · queues · secrets · deploys)
⚑ Change Safety        (blast radius · ownership · what-breaks-if)
▶ Runtime & Ops        (health · incidents · runbooks · detection[structural])
🛡 Security & Tenancy   (attack surface · RLS · tenant isolation · coverage gaps)
✓ Readiness            (launch GO/NO-GO · production readiness · top fixes ₹-ranked)
◍ Live & Connections   (adapter status: CONNECTED / NOT CONNECTED + source)
≡ Self & Agents        (how LCIS works · AI-context packs · agent API · audit log)
```
(Section-to-tab consolidation is finalized in `LCIS_EXPERIENCE_ARCHITECTURE.md`; this is the navigable IA.)

### 3.3 Detail pattern: split-panel, never lose context
Click any catalog entity → right-side detail panel (Linear pattern) with tabs: **Overview · Explain · Dependencies · Blast radius · Lineage/Trace · Ownership · Runbook · Live**. Deep-linkable (`/domain/payments`, `/table/orders`, `/rpc/create_checkout_order`) and refresh-safe (the V10 deep-link work is the one accretion worth keeping). `F` opens full-screen; `Esc` closes.

### 3.4 The entity page (the unit of navigation)
Every catalog entity (domain/service/table/RPC/worker) has a consistent page: title + type + criticality flags (money/tenant/security) → golden facts (per-type, New-Relic-style) → typed relationships (calls/contains/serves/measures) → blast radius → ownership → runbook → live status. One template, parameterized by type — *zero new config per new domain* (Grafonnet lesson, `_evidence/competitive-observability.md`).

---

## 4. Search

Two complementary modes, both in `⌘K`:
- **Structural search** — exact + fuzzy over catalog entities (domains/services/tables/RPCs/routes/workers/secrets). Deterministic, instant (pre-indexed).
- **Semantic / NL question** — routed by the copilot to the right engine (blast/owner/runbook/readiness/explain), answer rendered with citations. Falls back to repo scan only as last resort.

Search results carry provenance and a one-click jump to the entity page. No result is ever an un-cited assertion.

---

## 5. Roles & permissions

LCIS is an **internal tool** exposing architecture, security posture, and (later) tenant-scoped operational data — so it needs real RBAC, not the current "anyone on localhost" model (`LCIS_REPOSITORY_ARCHAEOLOGY.md`).

| Role | Can see | Can do |
|---|---|---|
| **Viewer** (default internal) | Catalog, architecture Q&A, readiness, runbooks, NOT-CONNECTED live status | Read; run no diagnostics |
| **Operator** | + live signals (once adapters wired), incident timeline | Run **read-only** SafetyGuard diagnostics (validations/health) — audited |
| **Support** | + **tenant-scoped** operational lookups (order/payment status for a specific `site_id`) | Tenant lookups gated by a `verifySiteOwnership`-equivalent authorization check |
| **Admin** | + audit log, adapter credentials presence, role management | Manage roles, configure adapters (presence only; never views secret values) |
| **Agent (service)** | Query API + MCP, scoped by token | Read cited intelligence; SafetyGuard-gated read-only actions |

Hard rules: no role can mutate production, view secret *values*, or bypass SafetyGuard. Security/attack-surface views are Operator+ (sensitive). The agent API authenticates as a service principal with its own scope.

---

## 6. Multi-tenant strategy

LetBuyy is single-Postgres, `site_id`-scoped multi-tenancy (`CLAUDE.md`, `LCIS_DOMAIN_INTELLIGENCE.md`). LCIS's relationship to tenancy has **two distinct planes** — conflating them is a trap:

1. **Platform intelligence (shared, structural).** The catalog, architecture, blast radius, domain model, readiness — these describe *the platform*, identical across all tenants. This is the bulk of LCIS and is **tenant-agnostic**. Do **not** build per-tenant LCIS instances.
2. **Tenant-scoped operational lookups (live, access-gated).** Support/ops questions ("where is order X for site Y", "why did this store's payment fail") require per-tenant *live* data, served through the read-only Supabase adapter under a strict `site_id` authorization check (mirroring the gateway's `verifySiteOwnership`). This plane is **off** until the live adapter is wired, and every record is access-controlled and audited.

LCIS itself is **one deployment** serving the whole platform; tenancy is an *authorization filter on the operational plane*, not an architectural multiplication. (This also means the deferred CIP "multi-product" idea is a *third* axis — products, not tenants — and remains deferred per `LCIS_FUTURE_MODEL.md` Decision 1.)

---

## 7. Data flows

```
Build time:  repo truth ──(Graphify + db/infra/domain extractors)──▶ pre-computed artifacts (graphify-out/*.json)
Serve time:  artifacts ──(load once, in-memory)──▶ deterministic engine ──▶ Query API (HTTP+MCP) ──▶ apps/lcis + agents
Live plane:  Query API ──(read-only adapter, presence-gated)──▶ Supabase/Cloudflare ──▶ live values OR "NOT CONNECTED + source"
Refresh:     CI (graph-intelligence.yml) regenerates artifacts on merge; app reflects the committed HEAD state
```
- **Structural answers** never hit a live service — they read pre-computed artifacts (deterministic, <10ms).
- **Live answers** go through the adapter layer, which checks credential *presence* and returns real values or the honest absence label. No fabrication path exists (`live-adapters.mjs`, verified).
- **Provenance** is attached at the engine layer, so both faces (app + agent) get cited answers identically.

## 8. Caching & performance

- **Pre-computed artifacts** = the primary cache (the existing, correct model). Startup loads them once; queries are in-memory.
- **Client-side local-first cache** in `apps/lcis` (Linear pattern): the catalog + recent entities cached locally for instant navigation; deltas synced. Target **<50ms** for any navigation, **<10ms** for a structural query.
- **Live values** are fetched on demand with a short TTL and *always* show their freshness/timestamp (or NOT CONNECTED). Never block a structural view on a live call (the `:3334` anti-pattern of synchronous cross-calls — `inventory-central-intelligence.md` — is explicitly rejected).
- **Refresh cadence**: artifacts regenerate in CI on merge; the app shows "as of commit <sha>" so staleness is visible, never silent (the domain analysis flagged silent staleness as a real risk).

## 9. IA anti-patterns to retire (from the current system)

| Retire | Replace with |
|---|---|
| 5 parallel "modes" (Founder/Ops/Support/Investor/Developer) | One catalog + persona-default saved views |
| 117 ad-hoc, partly-dark endpoints | A curated, versioned Query API; every surface routable |
| Version-named sections (V10/V11/OMEGA/INFINITY) | Plain, answer-named sections |
| Two dashboards (:3333 SPA + :3335 operator platform) | One `apps/lcis` |
| "100% implementable" framing on inert live surfaces | Explicit CONNECTED / NOT CONNECTED on every live value |

---
*Next: `LCIS_EXPERIENCE_ARCHITECTURE.md` (Phase 8) — challenges the proposed 9-tab model and finalizes the experience.*
