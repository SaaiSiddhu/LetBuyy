# Architecture Review Panel — Phase 9
**Reviewer:** Principal Systems Architect (independent, Phase 9)
**Date:** 2026-06-20
**Scope:** LCIS Future Model, IA, Experience Architecture, Duplication Report

---

## 1. AGREE — and why

The structural diagnosis is correct. The accretion pathology (12 named generations, self-certified in isolation, 202 files → 32 real capabilities) is real and the evidence is ironclad: dependency direction is strictly :3334→:3333 with 40+ synchronous HTTP calls per request; cold-start utility is 100% vs 32%; the team's own `cip-future-architecture.md:380-389` repudiates RAG before the RAG runtime was even finished. The "earn live data rather than fake it" thesis is the correct frontier bet. Deferring CIP/Papaa is right — extract after a second real product exists, not before.

---

## 2. CHALLENGE — sharpest structural risks

**The primary risk: the single-engine bet hides a hidden seam.** "One engine, two faces" sounds clean, but the proposed data flow (`artifacts → in-memory engine → HTTP + app`) means `apps/lcis` and the agent API share the same in-memory artifact load at the same process boundary. When the app's UX requires live-plane queries (Support's tenant-scoped lookups, Operations' incident timeline) while structural queries stay <10ms, those two response-time regimes must coexist in one server. The architecture diagram does not address: does the live adapter layer run in-process, as a sidecar, or as a separate fetch at the edge? Without that decision, "two faces" is actually two hidden runtime shapes bolted to one interface — coupling under a clean name.

**Secondary risk: the migration sequence is underspecified for the 5 load-bearing :3334 modules.** The Duplication Report correctly identifies capabilities #28–32 (architecture-intelligence, SafetyGuard/execution-engine, verification-engine, context-assembly, browser-validator) as worth preserving. But "port from :3334 to :3333" is stated without a dependency audit: `architecture-intelligence/` uses pure filesystem; `execution-engine/` + `SafetyGuard.mjs` have no external deps and are the most portable; `context-assembly` may embed assumptions about the V2 Qdrant collection schema that break when Qdrant is gone. A blind port risks either silently losing the semantic-memory fallback (context compression degrades to pure structural context, which may be fine) or carrying dead Qdrant import paths into :3333. Neither is fatal, but both are invisible unless the migration explicitly audits each module's import graph before porting.

**Tertiary risk: the 5-year no-RAG bet.** The determinism-over-probability principle is correct at the current scale (one developer, zero live adapters, 32 capabilities). At 3-year scale with a live Supabase adapter, real incident timelines, and India-commerce-specific signals (COD RTO, Razorpay settlement-lag, PIN serviceability), the structural graph cannot answer "which courier is causing elevated RTO in Maharashtra this week?" — that requires semantic retrieval over live, unstructured operational data. The architecture should name the exact condition under which the no-RAG bet is revisited (e.g., "when a second live adapter is wired AND a question class cannot be answered deterministically"), so the team has a decision gate rather than a religion.

---

## 3. MISSING from this lens

- **No process/deployment topology for `apps/lcis`.** The IA and Experience Architecture are greenfield-correct, but the CLAUDE.md canonical runtime map must be updated before implementation begins — or `apps/lcis` will be built as another `tools/` orphan. Specifically: what is the auth boundary between `apps/lcis` and the existing `identity-platform` ES256 stack? The RBAC model (Viewer/Operator/Support/Admin/Agent) is defined in the IA but the issuer/JWT path is not.
- **No rollback plan for the 202→32 consolidation.** If `incident-control-intel.mjs` is the "keep" module but it internally calls v3/v4/v5 as libraries, removing their standalone endpoints is safe — but there is no test harness specified to confirm the composed answers do not silently degrade when the intermediate endpoints disappear. The Duplication Report prescribes the endpoint retirements but does not prescribe a regression-verification step.
- **Change-event correlation is the only "earn live data" win named before full adapters are wired** — and it is underspecified. The proposal says "LCIS already knows deploys + migrations from git; correlating a migration/deploy to a risk is the most credible AIOps move." What is the schema for that correlation record? Where does it live — in a new `graphify-out/change-events.json`, an append-only file, or in-memory only? This is the one capability that can be shipped without any external credentials, so it deserves a concrete data model now, not in a future phase.

---

## 4. Top 3 Recommendations

1. **Resolve the live-plane boundary before coding `apps/lcis`.** Decide explicitly: are live adapter calls made by the engine process (same port, async sidecar thread) or by the `apps/lcis` Next.js route handlers directly? Document the answer in the engine's contract spec. The current architecture diagram is ambiguous on this point and the ambiguity will cause a rework once the first real Supabase adapter is wired.

2. **Audit each :3334 module's import graph before porting, not after.** Run `grep -r "qdrant\|openai\|graphrag\|crawl4ai" tools/central-intelligence/architecture-intelligence/ tools/central-intelligence/execution-engine/ tools/central-intelligence/verification-engine/ tools/central-intelligence/context-intelligence/` and classify: zero-dep (port immediately), optional-dep (port with graceful-degradation wrapper), hard-dep (defer until that external service is wired). This takes one afternoon and eliminates the risk of silently degrading context-compression after migration.

3. **Add a RAG re-evaluation gate to the 5-year model.** State explicitly: "If a live adapter is wired AND a canonical question class cannot be answered deterministically, then and only then evaluate a targeted semantic retrieval layer over that adapter's data." This converts a potential religion into a decision contract. It also makes the "earn live data first" sequencing defensible to any future engineer who asks why Qdrant was archived.

---

## Path forward

The consolidation is structurally sound. Execute in this sequence: (a) migrate the 5 :3334 modules with the import-graph audit above; (b) retire the Tier-2 duplicate endpoints with a regression check on composed answers; (c) resolve the live-plane boundary decision; (d) add `apps/lcis` to `pnpm-workspace.yaml` and the CLAUDE.md canonical runtime map before any UI code is written; (e) ship change-event correlation with a concrete schema as the first "earned" live signal. The architecture will hold.

*Independent external review — no code produced or modified.*
