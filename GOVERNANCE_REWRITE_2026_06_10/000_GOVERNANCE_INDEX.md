# LETBUYY GOVERNANCE — THE AUTHORITATIVE LAYER (2026-06-10)

> **What this is:** the unified, hand-authored governance layer that **replaces the document sprawl** and gives LetBuyy ONE chain of authority. It is the third and final stage of the 2026-06-10 trilogy: the **forensic audit** found the problems (`FORENSIC_MASTER_2026_06_10/`, 291 issues / 9 S0s), the **canonicalization program** chose the strategic winners (`STRATEGIC_CANONICALIZATION_2026_06_10/`, 15 docs), and this **governance rewrite** encodes those winners as enforceable law and stops the governance layer from certifying the architecture the company rejected.
> **The problem it fixes:** the operative `AGENTS.md` was auto-generated from a repo scan, so it promoted drift to law — declaring the rejected 9-app topology canonical, treating CQRS/`distributed-runtime`/`orchestration`/`projection-runtime` (V1-rejected) as governed packages, and running ~181 validators + ~120 `docs/governance/` files that certify multi-region/chaos/failover machinery while 9 S0 vulnerabilities ship. This layer inverts that: **governance now enforces the canonical architecture, not the imagined one.**

---

## The single authority hierarchy (replaces the two/three-constitution ambiguity)
On any conflict, higher wins:
1. **`LETBUYY_CONSTITUTION.md`** — supreme. Nothing overrides it. (Absorbs V1 + Freeze as Articles ART-01…24.)
2. **`LETBUYY_AGENTS_V2.md`** — the operating rulebook every agent follows (150 numbered rules). Replaces the generated `AGENTS.md`.
3. **`LETBUYY_CANONICAL_SYSTEMS.md`** — the winner registry; the answer to "which system do I use?" (one system per domain, no coexistence).
4. **`LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md`** + **`LETBUYY_FOUNDATION_ROADMAP.md`** — how and when to converge (deletion order + Phases P0–P12).
5. **`LETBUYY_UI_UX_GOVERNANCE.md`** + the surviving retargeted `docs/governance/*` — domain governance.
6. Evidence base (forensic + canonicalization) — the "why", not authority.

**Absorbed / retired:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` → folded into the Constitution, archived as history. The 1M-merchant `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` → formally rejected, archived. The generated `AGENTS.md` → replaced by AGENTS_V2; its generator retargeted/retired so it can never again promote drift to law.

---

## The canonical architecture (one sentence, identical across all docs)
One modular monolith (`api-gateway`) + four satellites (`queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`) over one RLS+GUC Postgres on Cloudflare + Vercel, one region — canonical double-entry ledger as the sole money truth (balance derived, bigint paise, PA-split never-custody, 0% fee), `identity-platform` as sole asymmetric token issuer, fail-closed RLS+FORCE+GUC load-bearing, server-authoritative Liquid-first commerce with a hosted `checkout.letbuyy.com` origin — every Shopify-scale capability frozen as an empty seam. **Envelope: 100 → 1,000 → 10,000 India merchants; never 100k+/1M+ (constitutional constant).**

---

## The 7 documents
| Doc | Authority rank | What it is |
|---|---|---|
| `LETBUYY_CONSTITUTION.md` | 1 — supreme | 24 Constitutional Articles + 23 MUST/MUST-NOT rules + the Never-Build list + ARB authority + amendment process |
| `LETBUYY_AGENTS_V2.md` | 2 — operative rulebook | 150 numbered rules across 19 sections; drift-prevention; the prime directive "an agent that reads only this cannot create architecture drift" |
| `LETBUYY_CANONICAL_SYSTEMS.md` | 3 — winner registry | 36 domains → the one canonical winner + reason + migration + deletion; "one system per domain" |
| `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md` | 4 — convergence | 78 systems → KEEP/MIGRATE/ARCHIVE/DELETE + the exact gated deletion order |
| `LETBUYY_FOUNDATION_ROADMAP.md` | 4 — convergence | Phases P0–P12, goals/deps/risks/deliverables/success/exit per phase; critical path; ~80 eng-weeks to beta |
| `LETBUYY_UI_UX_GOVERNANCE.md` | 5 — domain governance | Per-surface ×10-category current→10/10 target; Polaris/Stripe/Linear/Vercel principle adoption; 33 UX rules |
| `LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md` | reference | 13-domain scorecard (≈3.0/10 weighted current → 10) + the five TOP-20 lists + the implementation-readiness verdict |

---

## Ratification path (the constitutional act that makes this live)
These documents govern "by directive" until the ARB executes the ratification act. **GATE 1 — ratify the governance:**
1. ARB accepts the 7 documents; the Constitution becomes apex.
2. **Promote `LETBUYY_AGENTS_V2.md` → the operative `AGENTS.md`** (ARB-only constitutional act); retarget or retire `scripts/generate-repository-intelligence.mjs` so `AGENTS.md` is never again scan-generated into law.
3. **Retarget the validator suite** to enforce the Constitution: delete the ~36 rejected-architecture "theater" validators (convergence/CRDT/distributed-clock/failover/multi-region/chaos), retarget the topology validators to the V1 8-runtime set, keep the real safety lanes (tenant-isolation, session-security, single-source), add the new V1-conformance gates (rollback-pairing, deploy-manifest↔V1, `letbuyy.store` ban, `commission_bps=0`, topology-JSON anti-fabrication).
4. Archive V1 + Freeze + the maximalist plan to `docs/archive/`; collapse the 60+ root governance docs + ~120 `docs/governance/` theater files per the legacy plan.
5. **Lock the canonical-systems registry** (no agent may build a parallel system for a domain that has a named winner).

---

## Is LetBuyy ready to begin implementation?
**No for feature implementation; Yes for the foundation phases under this governance, once ratified.** Precise gate:
- **Codex receives FOUNDATION authority (P0–P2)** the instant GATE 1 closes (7 docs ratified, AGENTS_V2 promoted, validators retargeted, registry locked).
- **FEATURE authority is granted domain-by-domain** only as GATE 2 closes for that domain (its foundation landed, its S0/S1s cleared, its losers deleted).
- **GATE 3 (permanent):** never build a system that already has a named canonical winner.

The blocking truth: 9 live S0s, a money layer contradicting its own 0%/never-custody constitution, and a green governance gate certifying the rejected architecture — all behind a deploy pipeline (`main` 30 commits behind) that currently cannot ship a fix. The fixes mostly exist; they are unmerged, unwired, or one default-value away. Weighted architecture score today ≈**3.0/10**; ~**80 eng-weeks / 4–6 months** to the P11 beta gate with 2–3 squads.

---

## Provenance & caveats
Winners are not re-litigated here — they are the canonicalization program's decisions, themselves built on the independently code-verified forensic audit. Key **UNVERIFIED** items the ARB must close before irreversible reliance: the 6 anon RLS-to-PUBLIC GRANTs are set by Supabase's managed bootstrap, not repo SQL (confirm with an anon-key probe / `\dp public.orders` before final S0 sign-off); which of the two internal consoles survives is an ARB decision, not a code fact; full per-table FORCE coverage and dead-table writers need a live DB before any DROP; all completion-% reflect the working tree (~0% live until the deploy meta-blocker clears).
