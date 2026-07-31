# Lead Architect — Strategic Working Notes (anchors the synthesis capstones)

> Durable notes captured during the discovery wave so the key architectural theses survive context compaction. Each is a **hypothesis with evidence**, to be confirmed/refuted by the incoming agent evidence before it hardens into the Master Architecture.

## TENSION 1 — `@cip/core` product-agnostic platform (prior direction) vs. `apps/lcis` LetBuyy-embedded OS (this mission)

**Prior direction (to challenge):** `reports/cip-future-architecture.md` + `reports/papaa-intelligence-blueprint.md` propose extracting LCIS into a reusable `@cip/core` package configured per product, to serve LetBuyy **and "Papaa Escola"** (an education platform) **and future products**. It explicitly frames LCIS as *"tooling, not application code"* (`cip-future-architecture.md:369`).

**Evidence it is premature generalization (YAGNI):**
- Papaa Escola is **speculative, not real**. `papaa-intelligence-blueprint.md:1-11` = *"the definitive blueprint for **recreating** LCIS inside Papaa Escola"*, written in expected/future tense (`:41` "the following entities are **expected**"). No `apps/papaa`, no external repo, no funded product referenced anywhere. It is a portability *proof*, not a roadmap with a customer.
- Building a multi-product abstraction (`@cip/core` + per-product `cip.config.mjs` + cross-product portfolio hub, `cip-future-architecture.md:309-336`) for a second product that does not exist trades **inspectable, direct code** for **config-driven indirection** with zero realized benefit.
- It directly contradicts this mission's premise: LCIS should become *"The Intelligence Operating System for the entire LetBuyy ecosystem"* and a first-class **`apps/lcis`** — i.e. a product *surface*, not extracted tooling.

**Preliminary resolution (LetBuyy-first):** Reject near-term CIP extraction. Make LCIS genuinely excellent as **LetBuyy's** intelligence OS. BUT preserve the *discipline* that made CIP attractive — clean core/domain separation, the honesty contract, hand-authored governance — as **internal architecture**, so a future second product is a refactor, not a rewrite. Slogan: **"product-agnostic internals, product-specific surface; defer the package until a real second product exists."**

## TENSION 2 — Two runtimes embody OPPOSITE technical philosophies (the core consolidation question)

| | `tools/graph-server` (:3333, 81 .mjs) | `tools/central-intelligence` (:3334, 121 .mjs) |
|---|---|---|
| Philosophy | Zero-deps, Node built-ins only | External services (Qdrant, OpenAI, OTel/SigNoz, Crawl4AI, Playwright) |
| Knowledge | Pre-computed JSON artifacts, deterministic | Vector DB + embeddings + RAG, probabilistic |
| Retrieval | Structural (code graph + SQL + infra) | Semantic ("have we seen this before") |
| Latency/cost | <10ms, no embedding cost | Embedding + LLM cost; DEGRADED/DOWN without services |
| Honesty | NOT CONNECTED contract | Same contract, but most live values unconnected |

**Key finding:** the prior team's **own** future doc picks the :3333 side and argues *against* the :3334 side — `cip-future-architecture.md:380-389` "Why Pre-Computed JSON (Not Vector DB)?" and **"Why No RAG?"** ("structural knowledge … higher accuracy than semantic search … the repository IS ground truth"). So the canonical future philosophy **implicitly deprecates the entire :3334 runtime.**

**Hypothesis to confirm via INVENTORY-B:** with zero external services connected (the actual repo state — 0/7 providers), how much of :3334 returns real answers vs empty/NOT CONNECTED? If most of :3334 is non-functional without Qdrant/OpenAI/OTel, that is strong evidence to **archive/fold** :3334 and consolidate on the :3333 structural core, selectively re-homing any genuinely-working engine (e.g. a real reasoning/synthesis layer) behind the deterministic core.

## TENSION 3 — Structural-truth vs. live-data (can an "intelligence OS" exist while everything live is NOT CONNECTED?)

LCIS's honesty contract (0/7 providers connected, every live value labelled NOT CONNECTED + exact source) is genuinely admirable and rare. BUT every competitor in the observability/ops space (Datadog/Grafana/Sentry/New Relic) is built on **live telemetry** — their detectors, predictors, and incident timelines are *defined* by live signal. LCIS ships "8 autonomous detectors / 6 predictors / incident timelines" that are **structural-only**. Question for the COMPETITIVE-OBS evidence: are structural-only detectors/predictors credible, or are they theater until ≥1 live adapter (Supabase, then Cloudflare Analytics) is wired? **Preliminary:** the honesty contract is a feature; the structural detectors are *latent scaffolding* whose value is ~0 until the first live adapter lands. Wiring **one** live source (Supabase read-only) is likely higher-leverage than any new structural layer.

## TENSION 4 — Backend-only tool vs. product surface (what becomes `apps/lcis`?)

LCIS lives in `tools/` — it is **not** in CLAUDE.md's "Canonical Runtime Map" (confirm via REPO-ARCH). Today it is a build-time CLI + local HTTP server (:3333/:3334) with **zero presence in the deployed product** and no human users beyond AI agents + the operator running `pnpm graph:ui`. The mission asks what should become `apps/lcis`. **Preliminary split:**
- **Backend/CLI/agent-facing (stays tooling):** the extractors (code graph, db-intel, infra-intel, domain-intel), the deterministic query engines, the AI context packs, the MCP/HTTP API. This is the *engine*. AI agents are its primary consumers and that should remain a clean API/CLI.
- **`apps/lcis` (new human surface):** a first-class, navigable, multi-tenant-aware intelligence application for **humans** — founders/operators/engineers/support — composed over the same engine API. The 117+ ad-hoc endpoints + the single `index.html` SPA are NOT a product; they are a prototype. The mission's "9-tab model" is the candidate IA for this surface.

## Cross-cutting theses (to validate, then carry into Master Architecture)
1. **Consolidate, don't extend.** The V1→INFINITY pattern was pure accretion (confirm via DOC-ARCH: was anything ever removed?). The single most valuable architectural act is *subtraction* — collapse 202 engine files + ~12 generations into one coherent core.
2. **One engine, two faces.** A single deterministic structural-intelligence engine (the :3333 lineage, consolidated) exposed as (a) an **agent/CLI/MCP API** and (b) a **human app** (`apps/lcis`). Kill the :3333/:3334 split.
3. **Earn live data.** The honesty contract is the credibility moat; the next real frontier is wiring the first 1–2 read-only live adapters (Supabase, Cloudflare Analytics) — not a 13th "intelligence layer."
4. **Governance stays hand-authored and supreme.** The validator gate (107) and Constitution remain the authority; intelligence stays advisory. This is sound and must be preserved.
5. **India-first commerce is the moat, not product-agnosticism.** LCIS's value is deep INR/GST/COD/Razorpay/tenant-isolation commerce intelligence — the opposite of a generic config-driven platform. Lean in.

## Competitive lessons (distilled from Phase-4 research — anchors Phases 4, 7, 8)

> Captured durably in case a parent research agent's compile is disrupted by the session `WebSearch` routing error. Full per-tool detail lives in the three `_evidence/competitive-*.md` files (where the parents wrote them) and in the child-agent transcripts.

**From engineering/developer platforms (Backstage · Cursor · Linear · Copilot Workspace · Vercel/Cloudflare):**
- **Catalog as backbone (Backstage).** A software *catalog* of entities + typed relations is the spine; everything else is a view over it. → LCIS's spine is the **domain/runtime/data catalog** it already extracts. Make the catalog the home, not a side feature.
- **⌘K command palette is the product (Linear).** Context-sensitive, dual-mode (navigate **and** act), recency-ranked, keyboard-first (G-prefix nav, single-key actions, J/K traversal). LCIS V10 already ships a ⌘K palette → make it **the** primary entry point of `apps/lcis`.
- **Local-first sub-50ms (Linear): "200ms feels broken."** LCIS's pre-computed JSON + <10ms structural queries is *already* this philosophy — a point FOR the deterministic core and AGAINST the RAG/round-trip `:3334` path.
- **Split-panel detail, saved Views, dense lists.** Click an entity → right-side detail without losing context; saved filters become named Views.
- **Repo made queryable via indexing (Cursor) + spec→plan→implement loop (Copilot Workspace).** LCIS's agent/MCP API is its "@-context"; the copilot should expose a plan→query→synthesize→**cite** loop.

**From observability/ops (Datadog · Grafana · Sentry · New Relic · SigNoz · PagerDuty · Incident.io · Elastic):**
- **Service/entity catalog is universal** (PagerDuty Services, SigNoz auto-discovered services, NR entities, Elastic APM). Reinforces: catalog-first.
- **Change-event correlation is the most LCIS-credible AIOps move** (PagerDuty: "deploy 3 min before alerts"). LCIS knows deploys/migrations from git → **structural+temporal correlation works pre-telemetry.** Highest-leverage near-term ops feature.
- **Real ML anomaly detection requires LIVE signal** (Elastic ML jobs, PagerDuty IAG, SigNoz seasonal). → LCIS's "8 detectors / 6 predictors" are **structural risk heuristics, not anomaly detection** — label honestly; their value is ~0 until ≥1 live adapter lands.
- **SLO/error-budget framing + append-only incident timelines + auto-drafted postmortems** (Incident.io/Elastic) — patterns LCIS lacks; viable once live data exists. OTel is the standard ingestion path if/when telemetry is wired.

**From AI-native & commerce (Shopify Sidekick · Amazon Seller · OpenAI Deep Research · Claude Projects · LangSmith/LangFuse):**
- **Inline AND app, not just a portal** (Sidekick lives inside the admin). LCIS intelligence should also inject into `merchant-control-plane`, not only `:3333`.
- **Show the trace, cite every claim** (Deep Research Plan→Browse→Synthesize→Cite). The natural evolution of the NOT-CONNECTED contract → every answer carries its graph-node/source citations.
- **Composite health score + fix-engine ranked by ₹ impact** (Amazon AHR + Selling Coach). LCIS needs a **Store/Platform Health Score** and INR-revenue-ranked fixes.
- **LLM-as-Judge eval pipeline** (LangSmith/LangFuse/Arize) for LCIS's own AI outputs (groundedness/correctness), with alerting.
- **India-first commerce is the moat** (zero generic coverage): GST audit (CGST/SGST/IGST, IRN), COD RTO by courier/PIN, Razorpay settlement lag, PIN serviceability, DPDP Act 2023, INR/en-IN correctness.

**Net shape emerging for `apps/lcis`:** a Linear-fast, ⌘K-first, catalog-backed, split-panel app over the deterministic engine; every answer cited; honesty contract enforced; ops credibility earned via change-event correlation first, then live adapters; India-commerce depth as the moat.

_Status: preliminary. Confirm/refute against DOC-ARCH, REPO-ARCH, INVENTORY-A/B, DOMAIN, DUPLICATION, and the 3 competitive evidence files as they finalize._
