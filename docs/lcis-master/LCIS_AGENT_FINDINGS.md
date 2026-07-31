# LCIS Phase 9 — Specialist Panel Synthesis
**Compiled:** 2026-06-20  
**Source corpus:** 11 independent panel reviews in `docs/lcis-master/_evidence/panel-*.md`  
**Status:** ANALYSIS ONLY — no code produced or modified  
**Authority chain:** Constitution → `AGENTS.md` → this document (advisory)

---

## 1. Panel Roster — Sharpest Challenge per Lens

| Lens | Sharpest Challenge | Top Recommendation |
|------|-------------------|-------------------|
| **Architecture** (`panel-architecture.md`) | "Two faces" hides a hidden seam: live-plane queries (Support tenant lookups, incident timelines) and structural queries (<10ms) must coexist in one server process — the architecture diagram does not resolve this coupling. | Resolve live-plane boundary (in-process vs. sidecar) before writing `apps/lcis`; audit each :3334 module's import graph before porting. |
| **Platform/IDP** (`panel-platform.md`) | Adding `apps/lcis` to the canonical runtime map before it has a `vercel.json`, build pipeline, auth integration, or a single wired live adapter repeats the self-certification pathology at the architecture-declaration level. | Keep `apps/lcis` in the **reserved** section of the runtime map with a concrete promotion checklist; gate promotion behind all-green verifiables. |
| **Research** (`panel-research.md`) | Two of the three primary competitive evidence files cited to support "archive :3334" and "defer CIP" — `competitive-engineering-platforms.md` and `competitive-observability.md` — do not exist on disk as completed documents; the archival verdict rests on incomplete evidence. | Surface the 32%/66%/81% range (not only cold-start 32%) in all decision documents; run one live functional test before any destructive archival action. |
| **AI Systems** (`panel-ai.md`) | Killing Qdrant/GraphRAG (correct) is conflated with killing all prose synthesis (wrong). The `ReasoningEngine.mjs`, `InvestigationEngine`, and `ArchitectureIntelligenceEngine` work with V1 alone (zero Qdrant dependency) and answer the "why does this rule exist?" class that the structural graph cannot. | Add a deterministic BM25 prose index over the governance corpus (Constitution, AGENTS.md, migration comments) at extraction time; expose as `/api/governance?q=` + `lcis_governance` MCP tool. |
| **Security** (`panel-security.md`) | LCIS is not a developer-experience tool — it is an **active, queryable map of the entire LetBuyy attack surface**, including RLS policy text, `getSupabaseAdmin` blast radius (115 files, climbing), frozen-product live gateway routes, and per-table vulnerability patterns. `apps/lcis` deployed without SSO/Operator-gating is a high-value unauthenticated attack surface. | Reclassify `apps/lcis` as security-sensitive (same review tier as identity-platform); specify live adapter authorization model (custom `lcis_readonly` role, `WHERE site_id = $verified_site_id` at query layer, not app layer) before writing any adapter code. |
| **DevEx** (`panel-devex.md`) | `⌘K`-first only works if the app is already open — it isn't. Engineers work in VS Code, review PRs on GitHub, and triage Slack incidents. LCIS must meet engineers where they are, not where the app wants them to be. | Wire the GitHub PR blast-radius comment (one day, existing CLI) before shipping the app; make the MCP/IDE integration the engineer-facing MVP; the browser app is the operator/founder face. |
| **Observability** (`panel-observability.md`) | Change-event "correlation" is compelling but dishonest: the PagerDuty model correlates a deploy against a **live alert spike** — LCIS has the deploy but no live alert. What LCIS can actually deliver pre-telemetry is a structural pre-deployment risk score, not correlation in the AIOps sense. | Rename "change-event correlation" → **"deployment risk attribution"** in all surface copy; gate the honesty relabel atomically (same PR as the Operations surface relaunch — do not let "Detectors / Predictors" language survive a single render cycle post-ratification). |
| **Commerce** (`panel-commerce.md`) | "India-first commerce depth" is aspirational, not a current moat. Zero of seven providers are wired; COD RTO by courier/PIN, IGST split validation, IRN status, and Razorpay settlement-lag are all NOT CONNECTED. There is no validator enforcing invoice immutability despite it being a hard rule in `CLAUDE.md`. | Add two deterministic validators to the 107-gate now: (a) invoice immutability (no UPDATE path to issued GST invoice tables), (b) frozen-product gateway auth guard. Wire Supabase read adapter first. Model the COD chain structurally before GST. |
| **Infrastructure** (`panel-infrastructure.md`) | The artifact-as-cache model breaks at Vercel/Cloudflare deploy boundaries: `graphify-out/` is gitignored, the 44MB `graph.json` requires the `graphify` binary (not installable in standard build runners), and synchronous `JSON.parse` of 76MB at cold-start destroys the <50ms target before a single request is served. | Name the deployment runtime before writing `apps/lcis`; define the three-part artifact delivery schema (what is committed, what goes to Vercel Blob/Supabase Storage, what the refresh trigger is). |
| **Product** (`panel-product.md`) | There is no primary user with a felt, daily pain. Eight surfaces + five personas is a supply-side architecture designed from capability inventory, not observed demand. The highest-frequency, highest-pain, currently-zero-tool-solves-it job (engineer asks "what breaks if I change X?" before every PR) is surface #3, not the default home. | MVP = Change Safety only (`/blast` + `pnpm lcis blast`), for the on-PR engineer. Cut "Live & Connections" from MVP nav (0/7 adapters = displaying emptiness). Merge Readiness into Home. Instrument before adding surface #2. |
| **Knowledge** (`panel-knowledge.md`) | The proposal conflates "repository-as-truth" with "knowledge-as-truth." The graph answers *what exists* and *what connects* — it cannot answer *why it was built that way*, *what was rejected*, or *what failed in production and what we learned*. Archiving 167 docs without extracting decisions and confessed gaps buries 11 architectural decisions and 16 explicitly-confessed capability gaps into a flat `docs/archive/` folder. | Promote decisions + gaps to first-class queryable catalog nodes before any doc moves to archive; structure them as `governance/decisions/*.json` queryable via `/api/decision`. |

---

## 2. Consensus — Where ≥3 Lenses Converge

### C1: The MVP is too big (8 lenses)

**Product, DevEx, Commerce, Observability, Platform, Knowledge, AI, Infrastructure** all converge on this point: the 8-surface IA is a 1-year destination, not an MVP.

- **Product:** "MVP = one surface, one persona, one workflow. Not 8 surfaces." (`panel-product.md`)
- **DevEx:** "The app without the PR/IDE integration is a beautiful dashboard nobody opens." (`panel-devex.md`)
- **Commerce:** "The India-first moat claim is 12–18 months ahead of the live wiring that would make it true." (`panel-commerce.md`)
- **Platform:** "Building the IA surface before the engine is consolidated inverts the dependency." (`panel-platform.md`)
- **Infrastructure:** The cold-start problem is unsolved for the full 8-surface app. (`panel-infrastructure.md`)
- **Observability:** "'Live & Connections' is almost entirely empty at MVP (0/7 adapters connected). Surfacing emptiness as a primary nav item trains users to expect nothing." (implied from observability + product panels)
- **Knowledge:** "The catalog is the right spine. Decision/incident/rationale knowledge is the connective tissue." — without it, catalog surfaces are incomplete. (`panel-knowledge.md`)
- **AI:** "Building it on 0 live connections is building on a scaffold." (`panel-ai.md`)

**Consensus direction:** MVP = blast-radius CLI + CI/PR hook (Change Safety as a single surface or pre-app integration). The 8-surface app follows only after at least one live adapter is wired and adoption data exists.

---

### C2: Engine-first sequencing — complete 202→32 before any `apps/lcis` UI (6 lenses)

**Architecture, Platform, Product, AI, Commerce, Infrastructure** all demand consolidation before UI:

- **Architecture:** "Execute in this sequence: (a) migrate the 5 :3334 modules with the import-graph audit... (b) retire Tier-2 duplicate endpoints with a regression check... then add `apps/lcis`." (`panel-architecture.md`)
- **Platform:** "The catalog surface is only as good as the engine beneath it. Building the 8-surface IA on top of 202 contradictory, duplicated engine files produces a catalog of duplicated facts." (`panel-platform.md`)
- **AI:** Migrate the 5 genuine :3334 engines (ReasoningEngine, ArchitectureIntelligenceEngine, ExecutionEngine/SafetyGuard, VerificationEngine, InvestigationEngine) during consolidation, not after. (`panel-ai.md`)
- **Commerce:** 107-gate hardening first, then Supabase adapter, then COD chain model, then UI. (`panel-commerce.md`)
- **Infrastructure:** Artifact delivery schema must be solved before `apps/lcis` is added to `pnpm-workspace.yaml`. (`panel-infrastructure.md`)
- **Product:** "Ship blast-radius CLI + CI hook → Ship `apps/lcis/blast` page → Instrument 30 days → Add Catalog browse based on what engineers actually searched." (`panel-product.md`)

---

### C3: Honesty-relabel must be atomic, not sequential (4 lenses)

**Observability, Commerce, Research, AI** all flag that partial relabeling is as bad as no relabeling:

- **Observability:** "The relabel must ship atomically with the UI label change — not sequentially." (`panel-observability.md`)
- **Commerce:** "Stop calling structural risk maps 'detectors' and 'predictors.' ... let every other live claim remain NOT CONNECTED + exact env var." (`panel-commerce.md`)
- **Research:** The 32% figure alone (without 66%/81%) is motivated framing that misrepresents the actual developer-state operating condition. (`panel-research.md`)
- **AI:** "The no-RAG direction is correct for structural questions. The proposal incorrectly conflates 'kill Qdrant' with 'kill all prose synthesis'." (`panel-ai.md`)

---

### C4: Specify the live-plane/adapter authorization boundary before writing code (5 lenses)

**Architecture, Platform, Security, Commerce, Infrastructure** all identify the live adapter design as an unresolved gap that blocks safe implementation:

- **Architecture:** "Decide explicitly: are live adapter calls made by the engine process or by the `apps/lcis` Next.js route handlers directly?" (`panel-architecture.md`)
- **Platform:** "The Supabase live adapter authorization model is unspecified. 'Equivalent check' to `verifySiteOwnership` is not the same as `verifySiteOwnership`." (`panel-platform.md`)
- **Security:** "The Support role cross-tenant leakage risk is the highest-probability security incident in LCIS's near-term roadmap." The adapter must use a custom `lcis_readonly` Supabase role (NOT service role), with `WHERE site_id = $verified_site_id` enforced at the SQL layer, not the application layer. (`panel-security.md`)
- **Commerce:** "Wire one real adapter — Supabase (order counts, payment status, refund state, gift-card ledger) — and let every other live claim remain NOT CONNECTED + exact env var." (`panel-commerce.md`)
- **Infrastructure:** The Supabase adapter's credential model, Vercel env-var injection, and table allowlist must be documented before any adapter code is written. (`panel-infrastructure.md`)

---

### C5: Meet engineers where they are — PR/CI hook before the app (5 lenses)

**DevEx, Product, Commerce, Observability, AI** all converge on the adoption hook being the prerequisite for the app:

- **DevEx:** "Wire the GitHub PR blast-radius comment (one day, existing CLI) before shipping the app." (`panel-devex.md`)
- **Product:** "Force the adoption hook before the UI. Wire LCIS blast-radius output into the CI PR check BEFORE building the full app." (`panel-product.md`)
- **Commerce:** "107-gate hardening first — adding two validators costs ~1 dev-day and is immediately visible in CI." (`panel-commerce.md`)
- **Observability:** Deploy risk attribution in CI is achievable pre-telemetry. (`panel-observability.md`)
- **AI:** "Ship the MCP server in the MVP cycle, not as a later horizon." (`panel-ai.md`)

---

## 3. Cross-Panel Corrections to the Proposal

The following corrections represent concrete changes the panel demands — not suggestions. Numbered in descending urgency.

**1. MVP is blast-radius CLI + CI/PR hook, not the 8-surface app.**  
The agreed MVP is: `pnpm lcis blast <symbol>` CLI + GitHub PR comment annotation on high-impact symbols (`create_checkout_order`, `getSupabaseAdmin`, `@letbuyy/api-client`). `apps/lcis` at MVP = one surface (`/blast`), not eight. Everything else is Horizon 1-Year after adoption data. *(Product, DevEx, Commerce, AI, Platform, Infrastructure — 6 lenses)*

**2. `apps/lcis` stays RESERVED in the runtime map until a concrete promotion checklist is all-green.**  
The checklist (per `panel-platform.md`): `vercel.json` present, `pnpm-workspace.yaml` declared, 202→32 consolidation complete, Supabase read-only adapter wired, auth via existing ES256 JWKS with platform roles, `validate-governance.mjs` covers `apps/lcis`. Only on all-green does it move to the active runtime map. Declaring it active before these criteria are met repeats the self-certification pathology at the architecture-declaration level. *(Platform, Security, Architecture — 3 lenses)*

**3. "No RAG" → "deterministic structural graph + BM25 prose index + decisions JSON."**  
Archiving Qdrant/GraphRAG/Crawl4AI is correct. Replacing them with nothing for prose queries is wrong. The replacement is: (a) BM25 index over the governance corpus (Constitution, AGENTS.md, migration comments, `docs/`) at extraction time, zero external deps, exposed as `/api/governance?q=`; (b) `governance/decisions/*.json` queryable via `/api/decision` — 11 decisions already recovered by archaeology, extracted before any archival sweep; (c) 16 confessed gaps become `capability-gap` catalog nodes with owner + TTL. *(AI, Knowledge — 2 lenses; implied by Research, Commerce)*

**4. Rename "change-event correlation" → "deployment risk attribution" in all surface copy.**  
The PagerDuty/Datadog correlation model requires a live alert signal. LCIS has the deploy event but not the alert. What LCIS can honestly deliver is a structural pre/post-deployment risk diff. The name must change atomically — same PR as the Operations surface, before any render cycle exposes the "Detectors / Predictors" language to a user. *(Observability — 1 lens, but logically required by the honesty contract which all lenses uphold)*

**5. Present the 32%/66%/81% range; never lead with 32% alone.**  
The cold-start 32% is the worst-case floor. The realistic developer-state figure is 66% (V1 running + `graphify-out` populated). All decision documents — the Duplication Report verdict table in particular — must surface all three figures. No irreversible archival action should proceed on a code-read estimate using only the cold-start floor. *(Research — 1 lens, but corrects a representation error in the primary decision document)*

**6. `apps/lcis` is a security-sensitive application — require SSO/Operator-gating and ARB review before deployment.**  
LCIS exposes the complete LetBuyy attack surface: RLS policy text, `getSupabaseAdmin` blast radius, frozen-product gateway routes, runbooks for every security incident. An authenticated Viewer can reconstruct a full exploit map using only permitted GET operations. Before any route goes live: network ingress restricted to authenticated internal users (not public internet); security/attack-surface endpoints (`/api/security-intelligence`, `/api/audit`, `/api/policy`, `/api/blast`) require Operator role minimum; all Query API calls emit an audit log entry; CORS allowlist is explicit (not `*`). Auth uses an employee identity principal, not the merchant ES256 JWKS (merchants are the wrong issuer for an internal platform tool). *(Security — 1 lens, but the risk is structural and cross-cutting)*

**7. Promote decisions + gaps to queryable catalog nodes before the archival sweep.**  
Before any doc moves to `docs/archive/`: extract the 11 architectural decisions from the archaeology into `governance/decisions/*.json`; tag the 16 confessed gaps as `capability-gap` nodes with owner, evidence, and TTL. Archive the prose; keep the structured signal. Sequence: extract → archive → catalog. Not: archive → hope someone re-derives. *(Knowledge — 1 lens)*

**8. Resolve the deployment runtime and artifact delivery schema before writing any `apps/lcis` code.**  
`graphify-out/graph.json` (44MB, gitignored, requires the `graphify` binary) cannot be loaded synchronously at Vercel cold start without blowing the <50ms target (~800–1400ms for JSON.parse on 44MB). Decision required: Vercel Serverless + Vercel Blob (with `maxDuration=60` for first cold parse) OR long-lived process (Fly.io/Railway, ~$5-7/month, matches the current `pnpm graph:ui` model). Both are viable; neither is specified. *(Infrastructure — 1 lens)*

**9. Add two deterministic validators to the 107-gate before any destructive consolidation.**  
(a) Invoice immutability: assert no UPDATE path exists to issued GST invoice tables — this is a hard `CLAUDE.md` rule with no automated gate. (b) Frozen-product gateway auth guard: assert `routes/app-store`, `routes/app-api`, `routes/operations/developers` are behind an explicit auth check or 403 handler — these are live unguarded attack surfaces right now. Both are deterministic, ~1 dev-day, and close real compliance and security blind spots. The 107-gate is authoritative; LCIS intelligence is advisory. Fix the gate first. *(Commerce, Security — 2 lenses)*

**10. COD before GST as the first India-first operational model.**  
COD is India's dominant payment mode and highest-operational-cost path (cash reconciliation, RTO fraud, courier handoffs). The COD chain (`order → fulfillment → cod_reconciliation_entries → settlement`) is the highest-operational-cost India-specific flow with zero LCIS coverage. A failed COD RTO produces immediate unrecoverable revenue loss; a bad GST calc produces a bad invoice with a credit-note remedy. Model the COD chain structurally first, then wire live signal. GST is second priority. *(Commerce — 1 lens)*

---

## 4. Disagreements and Tensions Between Lenses

### Tension 1: Product wants 1 surface; the 8-surface IA proposes a full experience

**Product** (`panel-product.md`) is the most aggressive: "MVP = Change Safety only (`/blast`), for the on-PR engineer. Not 8 surfaces." This is a direct challenge to the 8-surface IA in `LCIS_EXPERIENCE_ARCHITECTURE.md`.

**DevEx** (`panel-devex.md`) partially agrees on sequencing but does not advocate discarding the 8-surface IA — it advocates building the PR/IDE integration *before* or *concurrent with* the app, not instead of it.

**Architecture, Platform, Knowledge** do not object to the 8-surface IA as a design target; they object to building it before the engine is consolidated.

**Reconciliation:** The 8-surface IA is a valid 1-year design target. The MVP is not the IA — it is a single surface (`/blast`) plus the CI/PR hook. The IA surfaces are released sequentially as adoption data, live adapters, and engine consolidation justify each one. The "Live & Connections" surface should not appear in primary nav until 2+ adapters are live. The sequence from `panel-product.md` (blast → catalog browse → Supabase adapter → Home/Readiness → Security) is the panel's recommended release order.

---

### Tension 2: AI panel preserves 5 :3334 engines; Architecture panel warns about hidden dependencies

**AI** (`panel-ai.md`) argues that `ReasoningEngine.mjs`, `ArchitectureIntelligenceEngine`, `ExecutionEngine`/`SafetyGuard`, `VerificationEngine`, and `InvestigationEngine` all work with V1 alone (zero Qdrant dependency) and must be preserved and migrated.

**Architecture** (`panel-architecture.md`) warns that `context-assembly` may embed Qdrant collection schema assumptions that break when Qdrant is gone; calls for an import-graph audit before porting.

**Reconciliation:** Both are correct. Migrate the 5 engines; but audit each module's import graph first (`grep -r "qdrant\|openai\|graphrag\|crawl4ai" <module>/`) and classify as: zero-dep (port immediately), optional-dep (port with graceful-degradation wrapper), hard-dep (defer). The audit costs one afternoon and eliminates silent capability degradation. The `context-assembly` module is the highest-risk candidate for hidden Qdrant assumptions.

---

### Tension 3: Research panel requires evidence before archival; other panels accept the archival verdict

**Research** (`panel-research.md`) is the sole panel that formally objects to proceeding with any irreversible archival action before (a) the two missing competitive evidence files are produced, (b) the 32%/66% framing is corrected, and (c) one live functional test is run.

All other panels accept the "archive :3334, consolidate 202→32" verdict as structurally sound.

**Reconciliation:** The archival verdict is likely correct on balance, but the Research panel's objection is procedurally sound — the evidence trail for the specific "archive :3334" conclusion is incomplete. Resolution: (a) add the 66%/81% figures to all decision documents immediately (correction 5 above); (b) run the one-afternoon live functional test before any file deletion; (c) treat the two missing competitive evidence files as marked "evidence incomplete" rather than withdrawing the conclusions they support. The structural evidence (40+ synchronous HTTP calls, 0 installed deps, 32%/66% floor/realistic) is sufficient to support the verdict; the competitive framing is corroborating context, not load-bearing proof.

---

### Tension 4: Security demands a separate employee identity principal; Platform specifies ES256 JWKS

**Security** (`panel-security.md`) argues that `apps/lcis` should authenticate via an employee identity principal, not the merchant ES256 JWKS stack — merchants are the wrong issuer for an internal platform tool that exposes the attack surface.

**Platform** (`panel-platform.md`) specifies the existing identity-platform ES256 JWKS as the auth mechanism for `apps/lcis`, with roles conferred via the `platform-console` or seeded migration.

**Reconciliation:** Both agree on ES256/JWKS as the JWT format. The tension is on issuer. The identity-platform already issues tokens for merchant users; it must be extended to issue tokens for internal team members via a separate principal/client, or a parallel employee SSO integration is required. The Platform panel's recommendation is implementable by extending the existing issuer with a new `lcis_team` audience claim. Security's requirement (Operator-gating, audit log, CORS allowlist) applies regardless of which issuer is chosen. Resolution: extend the identity-platform to issue `lcis_team` tokens with `aud: lcis` before any `apps/lcis` auth code is written.

---

## 5. Prioritized Recommendation Backlog

Grouped by the panel's agreed release gate. Each recommendation is cited to its originating panel(s).

---

### Tier A: Ship Now — Deterministic (No Live Data Required)

These require only the existing code graph and the structural engine. All are achievable without any external service credential.

**A1. GitHub PR blast-radius comment.**  
Wire `pnpm graph:intel blast` output as a CI step that annotates PRs touching `create_checkout_order`, `getSupabaseAdmin`, `@letbuyy/api-client`, `@letbuyy/shared-types`. One day implementation over the existing CLI. Evidence: `panel-devex.md` R1, `panel-product.md` R2.

**A2. Add two deterministic validators to the 107-gate.**  
(a) Invoice immutability validator. (b) Frozen-product gateway auth guard validator. Both are deterministic, ~1 dev-day total. Evidence: `panel-commerce.md` Rec 2, `panel-security.md` Rec 4.

**A3. Honesty relabel — atomic.**  
Rename "Detectors/Predictors" → "Structural Risk Heuristics"; rename "change-event correlation" → "deployment risk attribution." Ship in a single PR with any Operations surface render change. Evidence: `panel-observability.md` R1-R2.

**A4. Correct the 32%/66%/81% representation in all decision documents.**  
Update the Duplication Report verdict table to surface all three operating-condition figures, not only the cold-start floor. Evidence: `panel-research.md` R1.

**A5. Extract 11 decisions + 16 gaps into structured JSON before any archival sweep.**  
Create `governance/decisions/*.json`, each with context, alternatives, rejection rationale, evidence, last-confirmed-valid date. Tag the 16 confessed gaps as `capability-gap` catalog nodes with owner + TTL. Evidence: `panel-knowledge.md` R1-R2.

**A6. Add a `getSupabaseAdmin` call-site growth validator.**  
Deterministic CI gate: diff against a committed allowlist; fail CI if a new call site appears outside the allowlist. 115 files and climbing is an uncontrolled tenant isolation bypass growth pattern. Evidence: `panel-security.md` Rec 2.

**A7. BM25 governance prose index.**  
At extraction time, BM25-index the governance corpus (Constitution, AGENTS.md, local AGENTS.md, migration comments, decision records). Expose via `/api/governance?q=` + `lcis_governance` MCP tool. Zero external dependencies. Evidence: `panel-ai.md` R1.

**A8. Define the MCP interface concretely (5–7 tools).**  
Before the 202→32 consolidation, name which capabilities become MCP tools: `lcis_blast`, `lcis_explain`, `lcis_runbook`, `lcis_launch_check`, `lcis_governance`, `lcis_cite`. Each returns cited structured JSON. Ship with the MVP cycle. Evidence: `panel-ai.md` R2.

---

### Tier B: Before Any Destructive Action (Pre-Archival Gates)

These must be true before any `:3334` file is deleted or moved to `docs/archive/`.

**B1. Run the live functional test.**  
Start `:3334` with `:3333` running and `graphify-out/` populated. Count which of the 68 endpoints return real data. Confirm or refute the 66% operating-condition figure. Time: <1 hour. Evidence: `panel-research.md` R3.

**B2. Audit each :3334 module's import graph.**  
`grep -r "qdrant\|openai\|graphrag\|crawl4ai"` across the 5 engines to be migrated. Classify: zero-dep (port immediately), optional-dep (port with graceful-degradation wrapper), hard-dep (defer). Evidence: `panel-architecture.md` Rec 2.

**B3. Regression-verify composed answers after Tier-2 endpoint retirement.**  
Before retiring any endpoint that is composed into another (e.g., `incident-control-intel.mjs` composing V3/V4/V5 libraries), assert the composed answers do not silently degrade. Build a minimal test harness for these composed outputs. Evidence: `panel-architecture.md` Missing section.

**B4. Migrate the 5 genuine :3334 engines during consolidation.**  
`ReasoningEngine.mjs`, `ArchitectureIntelligenceEngine`, `ExecutionEngine`/`SafetyGuard`, `VerificationEngine`, `InvestigationEngine` are all V1-only (no Qdrant dependency). Migrate them into `:3333` as modules before archiving `:3334`. Do not archive them with the Qdrant/GraphRAG/Crawl4AI stack. Evidence: `panel-ai.md` R3.

**B5. Audit the `:3335` operator dashboard for hardcoded credentials before archival.**  
The `dashboard.html` is flagged as having unaudited content. Before archiving, check for hardcoded credentials, API keys, or internal infrastructure details. Evidence: `panel-security.md` §5.2.

**B6. Cross-check slash-command → endpoint dependency.**  
All 14 agent slash commands (`.claude/commands/agent-*.md`) query LCIS endpoints. Before retiring any endpoint, audit which slash commands depend on it and update or stub accordingly. Evidence: `panel-research.md` Missing Research point 4.

---

### Tier C: Before `apps/lcis` Code is Written

These are prerequisites before any `apps/lcis` file is created.

**C1. Name the deployment runtime.**  
Choose: Vercel Serverless + Vercel Blob (with `maxDuration=60`) OR long-lived process (Fly.io/Railway, ~$5-7/month). Document the choice in the deployment spec. Evidence: `panel-infrastructure.md` Rec 1.

**C2. Define the artifact delivery schema.**  
(a) What is committed to git (regenerable-without-Graphify subset: db-intel, infra-intel, domain-intel, ~32MB); (b) what goes to Vercel Blob/Supabase Storage (graph.json, 44MB); (c) the refresh trigger (CI → Blob write → Next.js revalidation). Evidence: `panel-infrastructure.md` Rec 2.

**C3. Resolve the live-plane boundary.**  
Document whether live adapter calls are made by the engine process (same port, async sidecar thread) or by the `apps/lcis` Next.js route handlers directly. This decision determines the server architecture before any route is coded. Evidence: `panel-architecture.md` Rec 1.

**C4. Specify the Supabase live adapter authorization model (1-page doc).**  
Before writing adapter code: (a) exact Supabase role (custom `lcis_readonly`, NOT service role); (b) `WHERE site_id = $verified_site_id` at the SQL layer, not application layer; (c) how Support role `site_id` claim is validated and who issues it; (d) explicit table allowlist reviewed by ARB; (e) audit log requirements per query. Evidence: `panel-security.md` Rec 3, `panel-platform.md` Rec 3.

**C5. Define the auth integration design.**  
`apps/lcis` must authenticate via the existing identity-platform ES256 JWKS extended with a `lcis_team` audience for internal team members. Specify: which JWT claims carry the LCIS role, how roles are conferred, how the Support role's `site_id` scope is enforced at the query layer. Produce this design before any auth code is written. Evidence: `panel-platform.md` Rec 3, `panel-security.md` Rec 1.

**C6. Add a cold-start budget test to CI.**  
`node -e "const s=Date.now(); require('./graphify-out/graph.json'); console.log(Date.now()-s,'ms')"` — if parse time exceeds 1500ms, the artifact delivery strategy must change. Gate before `apps/lcis` ships any route. Evidence: `panel-infrastructure.md` Rec 3.

**C7. Add a RAG re-evaluation decision gate to the architecture doc.**  
State explicitly: "If a live adapter is wired AND a canonical question class cannot be answered deterministically, then and only then evaluate a targeted semantic retrieval layer over that adapter's data." Converts a potential religion into a reviewable decision contract. Evidence: `panel-architecture.md` Rec 3.

**C8. Define the governance synchronization protocol.**  
When LCIS's catalog says "22 domains" and the validator says differently, who wins and how is the conflict surfaced? Proposed: (a) validator gate is always authoritative on what is legal/real; (b) LCIS catalog rebuild is triggered by the same CI event as the validator; (c) LCIS catalog includes a "validator agreement" flag per entity — unknowns are discovery candidates, not truth claims. Evidence: `panel-platform.md` Rec 4.

**C9. Reclassify `apps/lcis` as security-sensitive before any production deployment.**  
Pre-deploy hardening checklist: network ingress controls; SSO/Operator-gating for security/attack-surface endpoints; explicit CORS allowlist (not `*`); audit log for all Query API calls (not just SafetyGuard-gated); rate limiting per role/session; dependency allowlist for migrated :3334 modules. Evidence: `panel-security.md` Rec 1.

**C10. Adversarially test the 30-minute onboarding claim.**  
One real new engineer (not a team member), timed, think-aloud protocol. Fix what breaks. Only then use the 30-minute claim as a selling point. Evidence: `panel-devex.md` R5.

---

### Tier D: Roadmap (Post-MVP)

Recommendations that require a live adapter or adoption data before they are actionable.

**D1. Instrument before adding surface #2.**  
After MVP blast-radius CLI + `/blast` page ships: measure queries/day, which blast-radius symbols are queried, which answers are cited in PRs. Build surface #2 from that signal, not from the capability inventory. Evidence: `panel-product.md` R5.

**D2. Wire Supabase read adapter as the first live connection.**  
Order/payment/refund state, gift-card ledger. This unlocks the Support persona and makes the honesty UI show at least one `CONNECTED` label. Evidence: `panel-commerce.md` Rec 1, `panel-ai.md` R5.

**D3. Model the COD chain structurally first.**  
`order → fulfillment → cod_reconciliation_entries → settlement`: chain health view, stuck-order detection. Then wire live signal from the Supabase adapter. Evidence: `panel-commerce.md` Rec 3.

**D4. INR-impact-ranked fix-engine.**  
Reweight the current fix-engine ranking to include revenue-at-risk in INR. A missing GSTIN capture and a broken coupon UI should not appear at parity. Evidence: `panel-commerce.md` Missing point 4.

**D5. Add per-source freshness timestamps to every answer mixing structural + live data.**  
Structural (graph snapshot): last build time. Live (Supabase): query time. Display both independently in the UX. Evidence: `panel-observability.md` R4.

**D6. Minimal hypothesis-feedback loop for deployment risk attribution.**  
"Was this risk real? Yes / No" thumbs-up on the Operations surface, stored in a local append-only log. This closes the learning loop and gives the system ground truth to improve on. Evidence: `panel-observability.md` R5.

**D7. Bind AI-context pack freshness to migration count + schema hash.**  
Every AI-context pack carries `built_at_migration: N, schema_hash: <hash>`. Pack is flagged STALE in `apps/lcis` when the repo has moved forward. Evidence: `panel-knowledge.md` R3.

**D8. Pull merchant-control-plane inline intelligence forward to Horizon 1-Year.**  
A LCIS sidebar in the merchant control plane (blast radius + ownership for whatever route/RPC/table the operator is looking at) gets daily use without habit change. DevEx rates this as the highest-leverage surface per user-hour. Evidence: `panel-devex.md` R4.

**D9. LLM-as-Judge citation verifier at 1-year, not 3-year.**  
A deterministic citation verifier: for any NL output that cites a graph node, assert the node actually contains the claimed fact. No LLM required for the first pass — string-match assertion. Closes the self-certification gap for LCIS's own outputs. Evidence: `panel-ai.md` R4.

**D10. Add a `Decisions & History` tab to every catalog entity page.**  
Show: decisions that reference this entity, incidents that affected it, alternatives explicitly rejected. Render the decision JSON (Tier A5) and gap nodes in context. This is not a new engine — it is the structured data from A5 surfaced per entity. Evidence: `panel-knowledge.md` R4.

**D11. Draw the OTel/APM boundary explicitly in the master architecture doc.**  
One sentence: "LCIS consumes pre-aggregated metrics from live adapters; it does not ingest raw traces or spans, and does not own SLO/error-budget arithmetic." Prevents the Datadog-poorly-reimplemented failure mode. Evidence: `panel-observability.md` R3.

**D12. Promote the Liquid sanitizer configuration drift check to a deterministic validator.**  
SHA-256 hash of the locked sanitizer config; CI fails if it changes without an explicit governance override + ARB approval comment. Currently the only security invariant with platform-wide blast radius and zero automated enforcement. Evidence: `panel-security.md` Rec 5.

---

## Appendix: Panel-to-Finding Reference Index

| Finding ID | Source Panel(s) |
|------------|----------------|
| C1 (runtime name) | `panel-infrastructure.md` Rec 1 |
| C2 (artifact schema) | `panel-infrastructure.md` Rec 2 |
| C3 (live-plane boundary) | `panel-architecture.md` Rec 1 |
| C4 (adapter auth model) | `panel-security.md` Rec 3, `panel-platform.md` Rec 3 |
| C5 (auth integration design) | `panel-platform.md` Rec 3, `panel-security.md` Rec 1 |
| A1 (PR blast-radius hook) | `panel-devex.md` R1, `panel-product.md` R2 |
| A2 (two new validators) | `panel-commerce.md` Rec 2, `panel-security.md` Rec 4 |
| A3 (atomic relabel) | `panel-observability.md` R1-R2 |
| A4 (32/66/81% correction) | `panel-research.md` R1 |
| A5 (decisions + gaps JSON) | `panel-knowledge.md` R1-R2 |
| A6 (getSupabaseAdmin validator) | `panel-security.md` Rec 2 |
| A7 (BM25 prose index) | `panel-ai.md` R1 |
| A8 (MCP interface spec) | `panel-ai.md` R2 |
| B1 (live functional test) | `panel-research.md` R3 |
| B2 (import graph audit) | `panel-architecture.md` Rec 2 |
| B3 (composed-answer regression) | `panel-architecture.md` Missing section |
| B4 (migrate 5 engines) | `panel-ai.md` R3 |
| Tension 1 (1 surface vs 8-surface IA) | `panel-product.md`, `panel-devex.md` |
| Tension 2 (5 engines migration vs hidden deps) | `panel-ai.md`, `panel-architecture.md` |
| Tension 3 (archival before evidence complete) | `panel-research.md` vs all other panels |
| Tension 4 (employee vs merchant identity issuer) | `panel-security.md` vs `panel-platform.md` |

---

*Phase 9 synthesis complete. All findings are advisory. The 108 deterministic validators and the Constitution remain authoritative. No code was produced or modified in this review.*
