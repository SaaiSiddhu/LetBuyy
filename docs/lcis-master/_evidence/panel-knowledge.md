# Panel Review — Knowledge Architecture Lens
**Reviewer:** Principal Knowledge Architect (Phase 9)
**Date:** 2026-06-20
**Status:** REVIEW ONLY — no code written or modified

---

## 1. AGREE

The structural-graph-as-catalog is the right spine. Structural facts (graph, schema, FK, topology) don't rot; prose does. Archiving 167 docs of accretive self-certification and retiring version names is correct housekeeping. Honesty-over-completeness (NOT CONNECTED) is a genuine moat.

---

## 2. CHALLENGE — with evidence

**The sharpest challenge:** The proposal conflates "repository-as-truth" with "knowledge-as-truth." They are not the same. The graph can answer *what exists* and *what connects*. It cannot answer *why it was built that way*, *what was rejected and why*, or *what failed in production and what we learned*. The archaeology surfaces this gap directly:

- `LCIS_DOCUMENT_ARCHAEOLOGY.md §3.1` records 11 architectural decisions — but only 3 are confirmed by code gates. The other 8 live solely in prose: "Zero external npm dependencies," "Pre-computed loadOrBuild pattern," "Repository scan is last resort," "Hand-authored governance only." If those docs are archived into a flat `docs/archive/` folder, the *rationale* for those decisions becomes invisible to future engineers and AI agents. The catalog never models "why."

- 14 versions, zero documented removals (`§4.4`). That accretion pathology happened *because* the decision record was scattered across certification prose — no one could see the cost of adding. The answer is not to archive the decisions; it is to promote them into a durable, queryable first-class structure.

- The 117 self-issued certifications are noise. But inside that noise are approximately 16 explicitly confessed gaps (`§6.1`): no OTel SDK, no integration tests, subscription journey NOT IMPLEMENTED, SQL regex ceiling, etc. These are tribal knowledge. If archived, the next agent or engineer will rediscover them from scratch, costing another cycle.

- "Repository-as-truth" is too narrow for India-first operational knowledge: GST edge-cases, COD RTO by courier, Razorpay settlement-lag behavior, DPDP compliance decisions. None of this is in code or migrations. It lives in docs and people.

---

## 3. MISSING

1. **Decision Log as a first-class catalog entity.** Not a flat archive — a structured, queryable `/api/decision?id=` surface. Each decision: context, alternatives considered, what was rejected, evidence, last-confirmed-valid date. The archaeology already recovered 11 decisions; these should be promoted, not buried.

2. **Incident retrospective corpus.** The Future Model has no retention strategy for the 16 confessed gaps or any incident history. Incident knowledge (what failed, what the blast was, how we recovered) is the most valuable tribal knowledge in any production system and is entirely absent from the proposed catalog.

3. **Knowledge decay tracking.** AI-context packs and onboarding material will rot the moment the codebase drifts from them. There is no proposed mechanism to detect stale AI-context (e.g., a pack last-built against a schema version 30 migrations old).

---

## 4. TOP 3–5 RECOMMENDATIONS

**R1 (Promote decision rationale into the catalog before archiving prose).** Before any doc moves to `archive/`, extract every explicitly-stated architectural decision into a structured `governance/decisions/*.json` store queryable via `/api/decision`. The archaeology already identified 11 decisions (`§3.1`). This costs ≈1 day; the alternative costs a future team weeks rediscovering them.

**R2 (Tag confessed gaps as first-class catalog items with a decay date).** The 16 confessed gaps (`§6.1`) should become `capability-gap` catalog nodes with owner, evidence, and a TTL — not prose in an archive. Surface them in the Readiness section of `apps/lcis`. When a gap is resolved (OTel wired, test suite added), the node is closed, not silently dropped.

**R3 (AI-context pack freshness: bind to migration count + schema hash).** Every AI-context pack should carry `built_at_migration: 116, schema_hash: <hash>`. The pack is flagged STALE in `apps/lcis` when the repo has moved forward. This prevents the onboarding material from becoming the next source of architecture drift — the exact crisis that created LCIS.

**R4 (Narrative preservation layer: incident + decision + rejected-path knowledge).** Add a `Decisions & History` tab to the catalog entity page, showing: decisions that reference this entity, incidents that affected it, alternatives that were explicitly rejected. This is not a new engine — it is the decision JSON (`R1`) and gap nodes (`R2`) rendered in context. The structural graph tells you *what*; this tab tells you *why it is this way* and *what went wrong before*.

---

## 5. PATH

The proposed archive-then-catalog sequence is correct in order but incomplete in scope. The sequence should be:

1. Extract decisions + gaps from prose into structured JSON (R1 + R2) — before the archive sweep.
2. Execute the 167-doc archive + 202→32 consolidation (per FUTURE_MODEL.md §7 MVP).
3. Bind AI-context pack freshness to schema version (R3).
4. Render decisions + gaps in the `apps/lcis` entity page as a "Decisions & History" tab (R4).

The catalog is the right spine. Decision/incident/rationale knowledge is the connective tissue that makes the spine useful when things go wrong. Both must survive.

---
*Panel review — knowledge architecture lens only. No code written.*
