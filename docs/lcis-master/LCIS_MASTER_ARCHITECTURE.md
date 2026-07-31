# LCIS Master Architecture

**Phase 10 — the source of truth.** Synthesizes all discovery (Phases 0–5), the proposed model (Phases 6–8), and the 11-lens adversarial panel (Phase 9). Discovery/architecture only — no implementation.

> This document supersedes earlier deliverables where they differ; it explicitly records what the adversarial panel changed (§12). Evidence: every claim traces to a deliverable in `docs/lcis-master/` or an `_evidence/*.md` file.

---

## 1. What is LCIS?

**LCIS is LetBuyy's intelligence operating system: one deterministic engine that turns repository truth (code graph + 417-table schema + infra topology + 22 domains + governance) into cited, trustworthy answers about how LetBuyy is *built*, how it *runs*, and what to *do next* — served to AI agents (API/CLI/MCP) and, once earned, to humans (`apps/lcis`).**

Its irreducible assets, confirmed by discovery, are two: **deterministic structural truth** (100% of `:3333` works at cold start, <10ms, `inventory-graph-server.md`) and an **honesty contract** that never fabricates a live value (code-enforced in `live-adapters.mjs`). Everything else is a face over these.

## 2. What is LCIS NOT?

- **Not a mutator.** Read-only forever (`SafetyGuard`: 28 banned verbs, 10-action allowlist, hash-chain audit — verified). It *proposes and verifies*; humans/agents act.
- **Not the governance authority.** The 108 deterministic validators + the Constitution are supreme; LCIS is **advisory**.
- **Not a telemetry platform.** It **consumes pre-aggregated metrics** from read-only adapters; it does **not** ingest raw traces/spans and does **not** own SLO/error-budget arithmetic (the OTel/APM boundary — `panel-observability.md`). Otherwise it becomes a poorly-reimplemented Datadog.
- **Not a fabricator.** Absent live data is labeled `NOT CONNECTED` + source, never estimated.
- **Not a product platform.** LetBuyy-first; the CIP/`@cip/core` multi-product abstraction is deferred (its justifying product, "Papaa Escola," does not exist — `LCIS_DOCUMENT_ARCHAEOLOGY.md`).
- **Not (yet) canonical.** `apps/lcis` stays **reserved** until it earns promotion (§8).

## 3. Why does LCIS exist?

Two original crises, still valid (`LCIS_DOCUMENT_ARCHAEOLOGY.md`): **architecture drift** (auto-generated governance once encoded a rejected topology as law) and **context exhaustion** (no agent could answer "what breaks if payments fail?" without reading dozens of files). LCIS makes correct architectural answers instantly queryable. That mission survives; the accretion around it does not.

## 4. The verdict on the current system (honest, range-corrected)

- **Accretion, not architecture:** 12+ named generations, **2 runtimes**, **202 engine files / 388 artifacts**, **117 self-issued certifications** (no external reviewer ever), **zero deployed presence** (`tools/` absent from `pnpm-workspace.yaml`; no `vercel.json`/`wrangler.toml`).
- **`:3334` is derivative and unverified:** an HTTP *client* of `:3333` (40+ synchronous cross-calls/request), **zero certifications**, all 5 external deps uninstalled. Its standalone function is a **range, stated honestly**: **~32% at cold start, ~66% with `:3333` running (the normal dev state), ~81% with services** (`inventory-central-intelligence.md`, corrected per `panel-research.md`). The case to consolidate rests on derivativeness + zero-certs + uninstalled deps + the team's own anti-RAG future doc — **not** on the worst-case 32% figure alone.
- **The intelligence system is itself a discovery problem** (`LCIS_DOMAIN_INTELLIGENCE.md`) — 12 version names defeat the purpose.

## 5. The architecture: one engine, two faces (refined by the panel)

```
        repository truth (source · 116 migrations · infra · hand-authored governance)
                         │  build-time extraction (Graphify + db/infra/domain)
        ┌────────────────▼─────────────────────────────────────────────┐
        │   DETERMINISTIC ENGINE (one core; zero embedding-RAG)          │
        │   • Structural graph: catalog · blast · lineage · domain       │
        │   • DETERMINISTIC PROSE INDEX (BM25, zero-dep) over governance/ │  ← panel-ai + panel-knowledge
        │     decision/migration text → answers "WHY", not just "what"    │
        │   • Decisions-as-data: governance/decisions/*.json (queryable)  │  ← panel-knowledge
        │   • Runbook · Launch · Fix(₹-ranked) · Read-only Exec+Verify    │
        │   • Honesty/live-adapter ledger                                 │
        └───────┬───────────────────────────────────────┬───────────────┘
       Query face (machine)                       Human face (earned)
   ┌────────────▼─────────────┐          ┌────────────────▼───────────────┐
   │ MCP: 5–7 named tools      │          │ apps/lcis (RESERVED until §8)   │
   │ lcis_blast · lcis_explain │          │ security-sensitive · SSO-gated  │
   │ lcis_runbook · lcis_cite  │          │ 8 surfaces · ⌘K · <50ms          │
   │ + CLI + CI PR check       │          └────────────────┬───────────────┘
   └───────────────────────────┘                           │ live-plane boundary (explicit)
                          ┌──────────────────────────────────▼───────────────┐
                          │ LIVE ADAPTER LAYER — read-only, presence-gated     │
                          │ NEVER blocks a structural answer (async/separate). │
                          │ Supabase → Cloudflare Analytics. NOT CONNECTED +   │
                          │ source until creds present. Tenant authz per ARB.  │
                          └────────────────────────────────────────────────────┘
```

**Panel-mandated refinements baked in:**
- **Deterministic retrieval, not "no RAG."** Structural graph **+ a zero-dependency BM25 prose index** over governance/decision/migration text **+ decisions-as-JSON**. This answers the "why does this rule exist / what failed last time" class the graph cannot, *without* embeddings/Qdrant (`panel-ai.md`, `panel-knowledge.md`). A **RAG re-evaluation gate** is a documented decision contract for the 5-year horizon, not a forbidden topic (`panel-architecture.md`).
- **Explicit live-plane boundary.** Structural answers (<10ms, in-memory) and live tenant lookups are different latency regimes; live calls are async/separate and **never block** a structural response (`panel-architecture.md`). Decide in-process-async vs route-handler and document it before any `apps/lcis` code.
- **Explicit boundaries, written down:** auth (employee SSO / ES256), OTel/APM, MCP tool set, governance-sync (validator-gate vs catalog divergence: gate wins, divergence surfaced), tenant-authz (ARB doc — "`verifySiteOwnership`-equivalent" is too vague; `panel-security.md`).

## 6. What survives, merges, is removed (the 202→32 consolidation)

Per `LCIS_CAPABILITY_INVENTORY.md` + `LCIS_DUPLICATION_REPORT.md`, gated by **verify-before-destroy** (`panel-research.md`):

- **KEEP (27):** all `:3333`-native capabilities — Extraction/Catalog, Architectural Q&A, Context/AI-packs, Operational, Domain intelligence, Decision support, Honesty/live.
- **MIGRATE into the core (the genuinely-novel `:3334` modules, zero-Qdrant first):** ArchitectureIntelligence, SafetyGuard/Execution, Verification, Context-compression, Browser-validation — **plus Reasoning + Investigation** (they run on `:3333` alone; `panel-ai.md`). Audit each module's import graph (`grep qdrant|openai|graphrag`) and classify port-now / port-degraded / defer **before** porting (`panel-architecture.md`).
- **ARCHIVE:** the `:3334` *standalone server* + its RAG-dependent stack (Qdrant/GraphRAG/Crawl4AI/embeddings) + ~167 docs (67 self-issued certification quintets, aspirational CIP/Papaa). **First** promote the 11 architectural decisions + 16 confessed gaps to queryable data (`governance/decisions/*.json` + `capability-gap` catalog nodes) so rationale survives the sweep (`panel-knowledge.md`).
- **MERGE/REFACTOR/REMOVE:** `merchant-operating-graph`→`merchant-intelligence`; collapse 4 incident engines → Genesis; library-ify superseded `decision`/`memory`/`revenue` variants; wire-or-cut the 2 dark modules; remove unwired `discovery-engine`.
- **Verify-before-destroy gate:** run `:3334` live with `:3333` up (≈1 hr) and regression-test endpoint retirements **before** any archive/delete (`panel-research.md`, `panel-architecture.md`).

## 7. The final experience — 8 surfaces (the destination, not the MVP)

`Home · Catalog (spine) · Change Safety · Operations · Security & Tenancy · Readiness · Live & Connections · System`, with **⌘K** (ask/navigate/act) and split-panel detail (`LCIS_EXPERIENCE_ARCHITECTURE.md`). This corrects the proposed 9 (deleted "Intelligence", merged Runtime+Operations, added Catalog + Live & Connections). **But the panel is decisive that this 8-surface app is the 1-year+ destination, not the MVP** (§8).

## 8. What becomes `apps/lcis` vs stays backend — and the MVP correction

**The engineer-facing MVP is NOT the app** (Product + DevEx convergence, `panel-product.md` + `panel-devex.md`):

> *"⌘K-first only works if the app is already open — LCIS has zero deployed presence. Meet engineers where they are."* — DevEx. *"Eight surfaces across five personas is a supply-side architecture — exactly how the prior accretion happened."* — Product.

**MVP = one workflow, where engineers already are:** **Change Safety / blast radius** delivered as (1) `pnpm lcis blast <symbol>` CLI (rides the existing `graph:intel blast`), (2) a **GitHub PR-comment check** posting blast radius + owners on every PR touching a high-criticality file (the forcing function for organic adoption), (3) the **MCP tool** (`lcis_blast`/`lcis_explain`/`lcis_cite`) grounding Claude Code/Cursor. No dashboard. Instrument 30 days; let real demand justify the `apps/lcis` surface.

**Stays backend (the engine):** extraction, the deterministic core, the prose/decisions index, the Query API + MCP, the CLI, CI integration. AI agents and CI are first-class consumers.

**`apps/lcis` is RESERVED until it earns canonical promotion** (`panel-platform.md`) via a verifiable, validator-enforced checklist: workspace membership + `vercel.json` + turbo pipeline + a named runtime (§9) + ES256/SSO auth + read-plane audit + ≥1 live adapter wired + validator coverage of the new app. Only then does it enter the canonical runtime map. It is classified **security-sensitive** (`panel-security.md`): employee SSO (not merchant tokens), Operator-role minimum for security/blast/audit views, CORS allowlist, full read-plane audit logging.

## 9. How LCIS scales (runtime + artifacts — name them before building)

The build-time-artifact model is correct for a long-lived process but **breaks at serverless deploy boundaries** (`panel-infrastructure.md`): `graphify-out/` is gitignored; `graph.json` is ~44 MB; Cloudflare Workers (128 MB mem / 5 MB bundle) is ruled out; a Vercel cold start parsing 44 MB synchronously is 800–1400 ms (≫ the <50 ms budget). Therefore, **before any `apps/lcis` code**:
- **Name the runtime:** Vercel Fluid Compute (always-warm) **or** a single long-lived process (e.g. Fly.io). The IA/navigation/cold-start strategy flow from this.
- **Define artifact delivery:** commit the Graphify-free subset (~32 MB: db/infra/domain JSON) to git; store `graph.json` (44 MB) in Vercel Blob / Supabase Storage; add one CI step in `graph-intelligence.yml` to publish it.
- **Add a cold-start parse-budget CI test** (fail if >1500 ms).
- **Multi-tenancy = an authorization filter, not architectural multiplication.** One LCIS deployment serves the whole platform; the tenant-scoped *operational* plane (Support) is gated by an ARB-approved `site_id` authz model, audited, and off until the adapter is wired.

## 10. How LCIS evolves (anti-accretion governance)

The disease was unconstrained addition. The constitution of the new LCIS:
1. **No new version names. Ever.** Plain, answer-named capabilities.
2. **Subtraction is the default.** A new capability must justify itself against removal; a "13th layer" is rejected by policy.
3. **Adversarial review replaces self-certification.** Nothing is "done" because its author certified it — independent verification (a panel like this one) is required.
4. **Decisions and gaps are queryable data**, kept fresh, never lost to an archive.
5. **AI-context-pack freshness is bound to schema version** (`built_at_migration: N`; flagged STALE in-app when HEAD moves) so onboarding material never becomes the next drift source (`panel-knowledge.md`).
6. **Defer-CIP is an enforced module-boundary constraint** (core/domain separation in code), not just an intention (`panel-research.md`) — so a real second product is a refactor, not a rewrite.
7. **The validator gate stays supreme;** LCIS surfaces candidates, the gate decides; divergence is surfaced, the gate wins.

## 11. How LCIS supports LetBuyy & becomes a strategic advantage

- **Grounding layer for AI development.** Every LetBuyy change made by Claude Code/Cursor is grounded in cited, deterministic structural facts via MCP — the single highest-leverage, immediately-shippable value (and the MVP).
- **Change safety + launch readiness.** Blast radius before merge; GO/NO-GO with evidence — directly protecting a money-handling, multi-tenant platform.
- **The honesty contract as a trust moat.** In a landscape where every observability tool can fabricate a number, LCIS's "real-source-or-NOT-CONNECTED" is rare and defensible (`LCIS_COMPETITIVE_RESEARCH.md`).
- **India-first commerce depth — the deepest moat, realized by earning live data.** COD-first (a COD RTO spike is unrecoverable revenue; a GST error is correctable — `panel-commerce.md`): model the `cod_reconciliation` chain structurally, then wire Supabase. GST/Razorpay/PIN/DPDP follow. Two deterministic validators ship *now* (invoice immutability; frozen-product gateway auth) — depth no generic tool offers.

## 12. What the adversarial panel changed (the rigor record)

| Pre-panel position (Phases 6–8) | Panel correction (Phase 9) | Lens |
|---|---|---|
| MVP = consolidate + `apps/lcis` v1 (catalog + ⌘K) + one adapter | **MVP = blast-radius CLI + CI-PR-check + MCP; the app is the destination** | Product, DevEx |
| `apps/lcis` joins the canonical runtime map | **Reserved until a validator-enforced all-green checklist** | Platform |
| "No RAG; structural-only" | **Deterministic retrieval = graph + zero-dep BM25 prose index + decisions-JSON; add a RAG re-evaluation gate** | AI, Knowledge, Architecture |
| Migrate 5 `:3334` capabilities | **Migrate 7 (add Reasoning + Investigation); audit import graphs first** | AI, Architecture |
| "Change-event correlation" (near-term win) | **Rename "deployment risk attribution"; honest until live outcomes exist; relabel atomically** | Observability |
| Lead with "32% standalone" | **Present the 32/66/81% range; run `:3334` live before archiving** | Research |
| `apps/lcis` as a DevEx product | **Security-sensitive platform: SSO, Operator-gating, CORS allowlist, ARB for tenant authz** | Security |
| Build-time artifacts as the cache | **Name the runtime + artifact-delivery + cold-start budget test first** | Infrastructure |
| Archive ~167 docs | **First promote 11 decisions + 16 gaps to queryable nodes** | Knowledge |
| India-first moat asserted | **Aspirational until wired; COD before GST; +2 deterministic validators now** | Commerce |

**The single most important conclusion:** LCIS already owns the two hardest assets in this space — a deterministic structural catalog and an honesty contract — but buried them under accretion and self-certification. The work is **subtraction, then earning** — consolidate to one engine, ship the one workflow engineers feel daily (blast radius, where they already are), promote the human app only when it earns it, and earn live data one honest adapter at a time. Not a 13th layer. The first room, proven, before the operating system.

---
*Companion: `LCIS_EXECUTIVE_SUMMARY.md` (Phase 11). Specialist detail: `LCIS_AGENT_FINDINGS.md` + `_evidence/panel-*.md`.*
