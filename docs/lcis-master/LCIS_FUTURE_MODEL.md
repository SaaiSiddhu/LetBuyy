# LCIS Future Model

**Phase 6 deliverable — what LCIS should become.** Discovery-grounded; no implementation.

> Evidence base: `LCIS_DOCUMENT_ARCHAEOLOGY.md`, `LCIS_REPOSITORY_ARCHAEOLOGY.md`, `LCIS_CAPABILITY_INVENTORY.md`, `LCIS_DUPLICATION_REPORT.md`, `LCIS_DOMAIN_INTELLIGENCE.md`, the three `_evidence/competitive-*.md` files, and `_evidence/lead-strategic-notes.md`. Where this document makes a claim about the current system, it cites the discovery deliverable that established it.

---

## 0. The one-paragraph thesis

LCIS today is a **structurally impressive, operationally inert, self-certified prototype that has grown by pure accretion** — 12+ named generations (V1→INFINITY/X/Genesis), two runtimes (`tools/graph-server` :3333 and `tools/central-intelligence` :3334), 202 engine files, 388 artifacts, 117 self-issued certifications, and zero deployed presence. Its genuine, rare asset is **deterministic structural truth over the repository** (code graph + 417-table DB schema + infra topology + 22 domains) delivered in <10ms with an honesty contract that never fabricates. Its future is not a 13th layer; it is **subtraction, consolidation, and earning the right to live data**: one deterministic engine (202→32 capabilities) with **two faces** — an agent/CLI/MCP API and a first-class human application `apps/lcis` — that is opinionated, plainly named, India-commerce-deep, and evolves from *explaining the repository* to *operating the business* one wired live adapter at a time. Product-agnosticism (the `@cip/core`/Papaa direction) is **deferred** as premature generalization.

---

## 1. Mission

**LCIS is the intelligence operating system for LetBuyy: the single place where any human or AI agent can ask anything about how LetBuyy is built, how it runs, and what to do next — and get a cited, trustworthy answer without reading the source.**

It exists because of two original, still-valid crises (`LCIS_DOCUMENT_ARCHAEOLOGY.md` §3, citing the 2026-06-10 governance rewrite):
1. **Architecture drift** — auto-generated governance once encoded a rejected topology as law; agents acted on false facts.
2. **Context exhaustion** — no agent could answer "what breaks if payments fail?" without reading dozens of files.

LCIS solves both by making correct architectural answers instantly queryable. That mission is sound and survives. What must change is everything that accreted *around* it.

### 1.1 What LCIS IS
- A **derivation engine**: it re-derives all intelligence from repository truth (source, migrations, infra configs, hand-authored governance) at build time. It owns no separate database of "facts."
- A **catalog**: a navigable graph of domains → services → operations (RPCs) → tables → workers → policies, with typed relationships — the spine every competitor proves is essential (Backstage entities, Datadog Service Catalog, New Relic entities; `_evidence/competitive-*`).
- A **question-answering surface**: blast radius, ownership, lineage, runbooks, launch readiness, "why is X failing," "what to fix next" — for humans (app) and agents (API).
- A **grounding layer for AI coding agents**: the cited, structural context that makes Claude Code / Cursor accurate on LetBuyy (the Sentry Seer "hand off to coding agent" pattern; `_evidence/competitive-ai-commerce.md`).
- An **honesty instrument**: every live value is real-source or `NOT CONNECTED` + the exact env var — never fabricated (`live-adapters.mjs`, code-enforced per `inventory-graph-server.md`).

### 1.2 What LCIS IS NOT (boundaries)
- **Not a mutator.** It never deploys, writes, pays, refunds, or changes production. The read-only `SafetyGuard` (28 banned verbs, 10-action allowlist, hash-chain audit; verified in `inventory-central-intelligence.md`) is the permanent posture. It *proposes and verifies*; humans/agents act.
- **Not the governance authority.** The 108 deterministic validators + the Constitution remain supreme law. LCIS intelligence is always **advisory** (`LCIS_DOCUMENT_ARCHAEOLOGY.md` decision record).
- **Not a telemetry fabricator.** It will not simulate, estimate, or mock a live metric. Absence is labeled, not filled.
- **Not (yet) a product platform.** It is LetBuyy's intelligence OS, not a generic multi-product engine (see §3, Decision 1).
- **Not a replacement for Graphify.** The external Graphify code graph remains the upstream code-graph extractor; LCIS is the reading/serving/reasoning layer over it (`LCIS_DUPLICATION_REPORT.md`).

---

## 2. First principles (the philosophy that prevents relapse)

The discovery proves LCIS's pathology was **the absence of an opinionated constraint** — it could always add a layer, so it always did. The cure is borrowed from the most-admired internal tool of the decade (Linear; `_evidence/competitive-engineering-platforms.md`) and from LCIS's own best instincts:

1. **Repository-as-truth.** Documentation rots; the code, migrations, and infra do not. LCIS reads truth, never maintains a parallel one.
2. **Honesty over completeness.** A partial answer that marks live data `NOT CONNECTED` beats a complete answer that fabricates. This is the credibility moat — competitors confirm the best systems make source/freshness explicit (`_evidence/competitive-ai-commerce.md`).
3. **Determinism over probability.** Structural facts (graph, schema, topology) answer architectural questions with higher accuracy than semantic search — the prior team's *own* future doc argued this (`cip-future-architecture.md:380-389`) while building the opposite runtime. Pre-computed, inspectable, <10ms.
4. **Subtraction over accretion.** The default action is **remove/merge**, not add. 202→32 (`LCIS_DUPLICATION_REPORT.md`). No new "version" names — ever.
5. **Plain naming.** "Don't invent terms" (Linear Method). Retire V1/V2/…/X/OMEGA/INFINITY/Genesis. Capabilities get plain, stable names (Catalog, Blast Radius, Runbook, Launch Readiness).
6. **One way to do a thing.** Opinionated, curated surface — not 117 ad-hoc endpoints and 4 parallel incident engines. "The Linear way."
7. **Query-first, scan-last.** Every question answerable in one call; repo scan is the last resort.
8. **Governance is supreme; intelligence is advisory.** Validators decide; LCIS informs.
9. **Earn live data.** Live signal is the frontier, wired one read-only adapter at a time — never faked to look finished.
10. **Adversarial truth.** No capability is "done" because the team that built it certified it. External/independent verification is required (the corpus is 100% self-certified — `LCIS_DOCUMENT_ARCHAEOLOGY.md` §meta).

---

## 3. The five strategic decisions (resolving the tensions with evidence)

### Decision 1 — LetBuyy-first; defer product-agnosticism (`@cip/core`/Papaa)
**Verdict: Reject near-term CIP extraction. Build LCIS as LetBuyy's embedded intelligence OS.**

Evidence: the justifying second product, "Papaa Escola," **does not exist** — `reports/papaa-intelligence-blueprint.md` is an explicit *"blueprint for recreating LCIS,"* written entirely in future tense, with no `apps/papaa`, no repo, no customer (`LCIS_DOCUMENT_ARCHAEOLOGY.md`; `lead-strategic-notes.md` Tension 1). Building a multi-product abstraction + cross-product hub for a hypothetical customer, while reframing LCIS as *"tooling, not application code"* (`cip-future-architecture.md:369`), is textbook premature generalization, and it directly contradicts this mission's `apps/lcis` goal.

**But preserve the discipline that made CIP attractive** — a clean core/domain separation, the honesty contract, hand-authored governance — as **internal architecture**, so that IF a real second product ever appears, extraction is a refactor, not a rewrite. **Product-agnostic internals; product-specific surface; defer the package until a real second product exists.** The moat is *depth in India-first commerce* (GST/COD/Razorpay/tenant isolation; `_evidence/competitive-ai-commerce.md`), which is the *opposite* of generic configurability.

### Decision 2 — One engine: consolidate the two runtimes
**Verdict: Collapse `:3333` + `:3334` into a single deterministic structural engine. Archive `:3334` as a standalone server; migrate its 5 genuinely-novel capabilities into the core.**

Evidence (`LCIS_DUPLICATION_REPORT.md`, `inventory-central-intelligence.md`): `:3334` is an HTTP *client* of `:3333` (40+ synchronous calls/request, 2–10s timeouts), returns real data for only **32%** of endpoints with zero external services (vs **100%** for `:3333`), has **zero certifications**, and all five external dependencies (Qdrant, OpenAI, GraphRAG, Crawl4AI, Playwright) are **uninstalled**. The prior team's own future philosophy repudiates its RAG basis. **Migrate, then archive:** architecture-intelligence, the read-only execution engine + SafetyGuard, the verification engine, context compression, and browser validation are worth keeping as modules behind the deterministic core. Within `:3333`, execute the documented merges (202→32): fold `merchant-operating-graph`→`merchant-intelligence`, collapse the 4 incident engines to the Genesis one, library-ify superseded `decision`/`memory`/`revenue` variants, wire or cut the 2 "dark" unrouted modules.

### Decision 3 — Earn live data (the real frontier, not a 13th layer)
**Verdict: The next unit of value is wiring the first read-only live adapters and shipping change-event correlation — not another structural "intelligence layer."**

Evidence: every "live" surface today returns `NOT CONNECTED` (0/7 providers); the domain analysis calls "100% implementable" *operationally misleading* (`LCIS_DOMAIN_INTELLIGENCE.md`); the observability survey shows real detectors/predictors *require* live signal (`_evidence/competitive-observability.md`). Sequenced:
- **First adapter: Supabase read-only** — turns order counts, payment success, refund state, gift-card liability from modeled to real.
- **Change-event correlation (pre-telemetry win):** LCIS already knows deploys + migrations from git; correlating "a migration/deploy preceded this risk" is the most credible AIOps move LCIS can make *before* full telemetry (PagerDuty Change Events; `_evidence/competitive-observability.md`).
- **Second adapter: Cloudflare Analytics (worker/gateway health).**
- Re-label the 8 "detectors"/6 "predictors" honestly as **structural risk heuristics** until a live signal backs them.

### Decision 4 — One engine, two faces (what becomes `apps/lcis`)
**Verdict: Keep the engine as a backend/CLI/MCP API for agents; build a NEW first-class human application `apps/lcis` over the same engine.**

Evidence: LCIS is **100% a local dev tool with zero production presence** — `tools/` isn't in `pnpm-workspace.yaml`; neither runtime has `vercel.json`/`wrangler.toml` (`LCIS_REPOSITORY_ARCHAEOLOGY.md`). The 117 ad-hoc endpoints + single `index.html` are a prototype, not a product. The split:

| Layer | Audience | Form | Disposition |
|---|---|---|---|
| **Extraction + deterministic engine** | machines | build-time CLI + artifacts (`graphify-out/`) | keep, consolidate (Decision 2) |
| **Query API (HTTP + MCP)** | AI agents, CI, IDEs | stable, versioned, cited responses | keep, curate (kill ad-hoc endpoints) |
| **`apps/lcis` (NEW)** | humans: founders, operators, engineers, support | Linear-fast, ⌘K-first, catalog-backed app | **build** (Phases 7–8) |
| **Inline intelligence** | merchants/operators in-context | inject into `merchant-control-plane` | later (Shopify Sidekick pattern) |

`apps/lcis` joins the canonical runtime map as a real, access-controlled, multi-tenant-aware surface; the engine stays backend.

### Decision 5 — Quality as the operating doctrine
**Verdict: Adopt Linear's craft doctrine as LCIS's operating rules** (`_evidence/competitive-engineering-platforms.md`): opinionated curation, plain naming, ruthless subtraction (no backlog of dead "layers"), independent verification before any "done," and speed (<50ms) as a first-class feature. Self-certification is banned; an adversarial review gate replaces the certification-quintet ritual.

---

## 4. Capabilities (the consolidated 32, grouped)

From `LCIS_CAPABILITY_INVENTORY.md` / `LCIS_DUPLICATION_REPORT.md`, the true capability set beneath the duplication, grouped for the future engine:

- **Extraction & Catalog** — code graph (Graphify), db-intel (417 tables/164 RPCs/policies/triggers/indexes), infra-intel (workers/queues/secrets/deploys), domain-intel (22 domains), relationships/FK lineage. *The spine.*
- **Architectural Q&A** — blast radius, dependencies/consumers, path, ownership (CODEOWNERS), cross-domain coupling, lineage/trace.
- **Context for agents** — context assembly, compression, AI context packs (<20k tokens), `/copilot` NL routing.
- **Operational** — runbooks, launch readiness (GO/NO-GO), production-readiness (structural), incident model + timeline, detection/prediction (re-labeled structural-risk).
- **Domain intelligence** — payments, security/attack surface, tenant isolation, merchant lifecycle, customer journey, revenue/ledger model, cost model.
- **Decision support** — ranked fix plans (INR-impact-ranked — Amazon Selling Coach pattern), decision engine, recommendations.
- **Execution (read-only)** — SafetyGuard-gated validations/health/diagnostics, hash-chain audit, verification engine.
- **Live & honesty** — live-adapter status (NOT CONNECTED + source), environment registry, change-event correlation (new).
- **Self-model** — how LCIS itself works; the AI-context pack for onboarding.
- **Surfaces** — the Query API (curated), the `apps/lcis` app, the catalog/Atlas explorer.

Capabilities not yet real but worth a roadmap slot (all gated on live data or honestly NOT IMPLEMENTED today): SLO/error-budget framing, append-only live incident timeline, auto-drafted postmortems, LLM-as-Judge eval of LCIS's own AI outputs, Store/Platform Health Score.

---

## 5. Responsibilities (what LCIS owns vs collaborates on)

- **Owns:** the canonical *map* of LetBuyy (catalog), the blast-radius/ownership/lineage answers, the launch GO/NO-GO evidence pack, the agent grounding/context packs, the live-connection honesty ledger.
- **Collaborates (advisory):** to the validator gate (LCIS surfaces candidates; the gate decides), to incident response (LCIS supplies root-cause hypotheses + runbooks; humans act), to coding agents (LCIS grounds; the agent edits under human review).
- **Never owns:** production mutations, money, secrets, deployment, governance authority.

---

## 6. Target architecture (one engine, two faces)

```
                 Repository truth (source · 116 migrations · infra · hand-authored governance)
                                   │  (build-time extraction)
            ┌──────────────────────▼───────────────────────┐
            │   DETERMINISTIC STRUCTURAL ENGINE (one core)   │   ← consolidates :3333 + migrated :3334 modules
            │   Catalog · Blast/Lineage · Domain · Runbook   │     202 files → 32 capabilities, zero npm deps
            │   Launch · Fix(₹-ranked) · Exec(read-only)     │
            │   Self-model · Honesty/Live-adapter ledger     │
            └───────┬───────────────────────────┬───────────┘
                    │ Query API (HTTP + MCP)      │ (same engine, same artifacts)
        ┌───────────▼─────────────┐    ┌──────────▼─────────────────┐
        │  AGENTS / CLI / CI / IDE │    │  apps/lcis  (human app)     │
        │  cited structural context│    │  Linear-fast · ⌘K-first ·   │
        │  (Claude Code, Cursor)   │    │  catalog-backed · cited      │
        └──────────────────────────┘    └──────────────┬─────────────┘
                                                        │ (later) inline into merchant-control-plane
                    ┌───────────────────────────────────▼────────────┐
                    │  LIVE ADAPTER LAYER (read-only, presence-gated) │
                    │  Supabase → Cloudflare → … (NOT CONNECTED until │
                    │  credentials present; never fabricated)         │
                    └─────────────────────────────────────────────────┘
```

Cross-cutting: **catalog is the data model** (entities + typed relations + golden facts per type — New Relic/Backstage pattern); **every answer carries citations** (graph node / source file / NOT CONNECTED label — Deep Research pattern); **governance/validators remain the supreme, separate authority.**

---

## 7. Horizon visions

### MVP (≈ next cycle) — "Consolidate and surface"
- Execute the 202→32 consolidation + the ~155-artifact safe archive (`LCIS_DUPLICATION_REPORT.md`); retire version-names; one engine.
- Stand up `apps/lcis` v1: the catalog home + ⌘K + the top answers humans need (blast radius, ownership, launch readiness, domain explain), all cited, over the existing structural engine. No new intelligence — just a real product surface + a clean API.
- Wire **one** read-only live adapter (Supabase) + ship change-event correlation. Re-label detectors/predictors honestly.
- Replace self-certification with an adversarial verification gate.

### 1-Year — "Operate, don't just explain"
- `apps/lcis` is the daily surface for engineers (change-safety), founders (readiness), and support ("where is my order / why did payment fail"), with live Supabase + Cloudflare signals.
- Store/Platform Health Score (₹-ranked) and an honest live incident timeline.
- LCIS is the grounding layer wired into Claude Code/Cursor for every LetBuyy change.
- Inline intelligence begins (merchant-control-plane).

### 3-Year — "The commerce intelligence moat"
- Deep India-first operational intelligence: GST audit trail, COD RTO by courier/PIN, Razorpay settlement-lag, PIN serviceability, DPDP compliance — as live, cited, alertable surfaces.
- LLM-as-Judge eval pipeline scoring LCIS's own AI outputs for groundedness; SafetyGuard-gated *proposals* (Sentry-Seer-style, human-approved) for fixes/runbook execution.
- Merchant-facing intelligence (the Sidekick analog) where appropriate.

### 5-Year — "Intelligence operating system"
- LCIS is the connective tissue of the LetBuyy ecosystem: any human or agent, any question — architecture, runtime, money, compliance — answered, cited, in one place; the honesty contract intact at scale.
- *Only then*, if a real second product exists, extract the product-agnostic core (the deferred CIP) — as a proven refactor, not a speculative bet.

---

## 8. What we explicitly reject (and why)

| Rejected | Why (evidence) |
|---|---|
| A 13th "intelligence layer" / new version name | Accretion is the disease; "LCIS is itself a discovery problem" (`LCIS_DOMAIN_INTELLIGENCE.md`). Subtract. |
| Near-term `@cip/core` extraction for Papaa | Second product doesn't exist; premature generalization (`LCIS_DOCUMENT_ARCHAEOLOGY.md`). |
| Keeping `:3334` as a standalone RAG runtime | 32% standalone, 0 certs, deps uninstalled, HTTP-client of :3333; team's own doc repudiates RAG (`LCIS_DUPLICATION_REPORT.md`). |
| Fabricated/simulated live metrics to "finish" surfaces | Destroys the one moat (honesty). |
| Self-certification as proof of done | 100% of corpus is self-issued (`LCIS_DOCUMENT_ARCHAEOLOGY.md`). Require adversarial review. |
| Infinitely configurable, flexible surface | "Flexible software… creates chaos as teams scale" (Linear). Be opinionated. |

---
*Next: `LCIS_INFORMATION_ARCHITECTURE.md` (Phase 7) details `apps/lcis` IA, navigation, permissions, multi-tenancy, performance; `LCIS_EXPERIENCE_ARCHITECTURE.md` (Phase 8) resolves the tab model.*
