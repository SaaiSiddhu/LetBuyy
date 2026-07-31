# LCIS Experience Architecture

**Phase 8 deliverable — the final `apps/lcis` experience.** The mission asks me to *challenge* the proposed 9-tab model, not accept it. Discovery-grounded; no implementation.

> Anchors: `LCIS_INFORMATION_ARCHITECTURE.md`, `LCIS_FUTURE_MODEL.md`, `_evidence/competitive-engineering-platforms.md` (Linear/Backstage), `_evidence/competitive-observability.md` (Datadog/New Relic catalog + capability nav).

---

## 1. The proposed 9-tab model — critique

Proposed: **Executive · Intelligence · Architecture · Context · Runtime · Security · Operations · Agents · Self.**

It is *directionally right* (capability-led, covers the engineering + ops + exec spread) but, judged against the catalog-first pattern every competitor proves and against LCIS's own pathology (accretion, vagueness, missing honesty surface), it has **three redundancies and three gaps**:

**Redundancies (collapse these):**
1. **"Intelligence" is vacuous.** The entire product is intelligence; a tab named "Intelligence" holds no distinct object. Its real content — *ask a question* — is a cross-cutting action (`⌘K`), not a destination. → **Delete; promote to the omnipresent command palette.**
2. **"Runtime" and "Operations" are the same surface.** Every observability tool unifies them (Datadog/NR put runtime health, incidents, and runbooks under one operational area; `_evidence/competitive-observability.md`). Two tabs = the same `:3333` duplication disease in the UI. → **Merge into one Operations surface.**
3. **"Architecture" + "Context" overlap and mis-level.** "Context" (agent context packs) is an *output consumed by machines*, not a human top-level destination; "Architecture" conflates *browsing the map* with *answering what-breaks-if*. → **Demote Context into System; split Architecture into Catalog (browse) + Change Safety (answer).**

**Gaps (add these):**
1. **No Catalog.** The single most important surface — the browsable Domain→Service→Data→Infra spine — is *absent* from the 9. Every competitor makes the catalog the backbone (Backstage, Datadog Service Catalog, New Relic Entity Explorer). Without it, "LCIS is itself a discovery problem" (`LCIS_DOMAIN_INTELLIGENCE.md`) persists. → **Add Catalog as the spine.**
2. **No Live & Connections.** LCIS's one moat is the honesty contract (0/7 connected, `NOT CONNECTED` + source). The proof of that contract — *what is and isn't wired* — must be a first-class, visible surface, not buried. → **Add Live & Connections.**
3. **No commerce/compliance depth.** The India-first moat (GST/COD/Razorpay/DPDP; `_evidence/competitive-ai-commerce.md`) has no home. → **Fold into Security & Tenancy + the Catalog's domain pages.**

**Verdict:** the 9-tab model is not the final answer. The corrected experience is **8 primary surfaces + 2 cross-cutting elements**, organized around the catalog spine and the questions each persona asks.

---

## 2. The final experience: 8 surfaces + ⌘K + entity detail

### Cross-cutting (present everywhere, not tabs)
- **`⌘K` command palette** — *ask* (NL → routed, cited answer), *navigate* (jump to any entity), *act* (run a read-only SafetyGuard diagnostic). The primary way to *do* anything. (Linear's centerpiece; `_evidence/competitive-engineering-platforms.md`.)
- **Entity detail panel** — split-panel (never lose context); perspective tabs on any entity: Overview · Explain · Dependencies · Blast radius · Lineage/Trace · Ownership · Runbook · Live. Deep-linkable, refresh-safe.

### The 8 primary surfaces (left nav)

| # | Surface | Answers | Primary persona | Replaces in the 9 |
|---|---|---|---|---|
| 1 | **Home** | "What should I care about right now?" — readiness snapshot, top risks (₹-ranked), recent changes, health score | Founder / everyone | Executive (dashboard half) |
| 2 | **Catalog** | "What exists? How is X built?" — Domains · Services/Runtimes · Data (tables/RPCs/policies) · Infrastructure (workers/queues/secrets/deploys) | Engineer / new eng | *(new spine)* + Architecture (browse half) |
| 3 | **Change Safety** | "What breaks if I change X? Who owns it? Is it safe to merge?" — blast radius, deps/consumers, ownership, lineage | Engineer on a PR | Architecture (answer half) |
| 4 | **Operations** | "What's failing, who's affected, how do I recover?" — runtime health, incidents + timeline, runbooks, detection/prediction (structural), change-event correlation | Operator / SRE | Runtime + Operations (merged) |
| 5 | **Security & Tenancy** | "What's our attack surface? Is tenant isolation intact? Are we compliant?" — RLS/policies, tenant isolation, coverage gaps, GST/DPDP compliance | Security / operator | Security (+ tenancy + commerce-compliance) |
| 6 | **Readiness** | "Are we ready to launch/scale? What's the top fix?" — launch GO/NO-GO, production readiness (structural), ₹-ranked fix plan, Health Score | Founder / exec | Executive (decision half) |
| 7 | **Live & Connections** | "What's actually wired vs structural? What's the source?" — adapter status (CONNECTED / NOT CONNECTED + env var), freshness, change-event feed | Operator / everyone (trust) | *(new — the honesty surface)* |
| 8 | **System** | "How does LCIS itself work? How do agents use it?" — Self-model, "understand LetBuyy in 30 min" onboarding, AI-context packs, Agents & MCP API, audit log, roles | New eng / agent owner / admin | Agents + Self + Context (merged) |

**Net:** 9 → 8, but *substantively* corrected: 1 deleted (Intelligence), 1 pair merged (Runtime+Operations), Architecture split into spine+answer, Context demoted, and the two missing essentials (Catalog, Live & Connections) added.

---

## 3. Persona → default experience

Personas are **default home presets + saved views**, not walled modes (rejecting the V11 5-modes sprawl, `LCIS_INFORMATION_ARCHITECTURE.md`):

- **Engineer** → Home shows recent changes + change-safety; default landing is Catalog/Change Safety; `⌘K` "what breaks if…".
- **Operator/SRE** → Home shows live health + open incidents; default Operations + Live & Connections.
- **Founder/exec** → Home shows Readiness + top risks + Health Score; default Readiness.
- **Support** → `⌘K` "where is order X for store Y" → tenant-scoped lookup (access-gated, live plane); default Operations→Investigate.
- **New engineer** → System → "Understand LetBuyy in 30 minutes" + Catalog tour.
- **AI agent** → not the app at all: the **Query API + MCP**, returning the same cited answers (System documents the contract).

---

## 4. The interaction doctrine (how it should feel)

Borrowed from Linear's craft doctrine (`_evidence/competitive-engineering-platforms.md`), because LCIS's disease was the *absence* of an opinionated feel:
1. **`⌘K` first.** Anything reachable in ≤2 keystrokes. Keyboard-navigable end-to-end (G-prefix nav, J/K traversal).
2. **<50ms or it's broken.** Pre-computed artifacts + local-first client cache; structural answers never block on a live call.
3. **Every answer is cited.** A claim shows its graph node / source file, or the `NOT CONNECTED + source` label. No naked assertions. (Deep Research "show the trace"; `_evidence/competitive-ai-commerce.md`.)
4. **Split-panel, never lose place.** Click → detail panel; `Esc` back; deep links everywhere.
5. **Opinionated and plainly named.** One way to reach a thing; sections named for the question they answer, never for a version.
6. **Honest by construction.** Inert live values are visibly inert, never dressed as real.

---

## 5. Why this is better than the 9-tab model (summary)

| Problem with the 9 | Fix in the 8 |
|---|---|
| "Intelligence" names nothing concrete | Deleted → `⌘K` ask, omnipresent |
| Runtime ≠/= Operations duplication | Merged into Operations |
| Architecture conflates browse + answer | Split: Catalog (browse) + Change Safety (answer) |
| Context mis-leveled (machine output as human tab) | Demoted into System |
| **No catalog** (the proven backbone is missing) | **Catalog is surface #2, the spine** |
| **No honesty surface** (the one moat is invisible) | **Live & Connections is surface #7** |
| Commerce/compliance moat homeless | Lives in Security & Tenancy + domain pages |
| Risk of becoming another mode-sprawl | Personas = presets/saved views, not modes |

The result is fewer, clearer surfaces; the catalog and the honesty contract — the two things LCIS uniquely has — are made central; and the structure is anti-fragile against the accretion that produced 202 files and 12 version names.

---
*Next: `LCIS_AGENT_FINDINGS.md` (Phase 9, specialist panel) then `LCIS_MASTER_ARCHITECTURE.md` (Phase 10) ratifies the final model.*
