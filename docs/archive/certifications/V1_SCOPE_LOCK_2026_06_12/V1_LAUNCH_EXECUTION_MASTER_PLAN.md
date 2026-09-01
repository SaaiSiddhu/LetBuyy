# LETBUYY V1 — LAUNCH EXECUTION MASTER PLAN

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · **Mode:** plan (no code written). Synthesizes `LB7_CERTIFICATION.md` + `LB8…LB12_IMPLEMENTATION_STRATEGY.md`. **Repository-truth only.**

## 0. Gating reality

- **C0 — commit seam:** `.git/index.lock` is un-removable in this sandbox → no commit is possible here. Every step below is "implement + validate, then **commit in a real checkout**." The program's "commit per LB block" runs there, not here.
- **Gate today:** 123 validators, green **except** the untracked-migration guard on mig 170 (LB-7). Committing LB-7 clears it → 123/123.

## 1. Dependency graph

```
            ┌────────────────────────── C0 (clear index.lock / commit ability) ──────────────────────────┐
            │ blocks ALL commits                                                                          │
            ▼                                                                                             ▼
        LB-7 commit  ──(mig 170 tracked; gate green)──►  prerequisite for clean validation of every later batch
            │
            ├── sequential-migration numbering ──►  LB-9 (mig 171 must follow 170)
            │
   independent ├── LB-11 (no migration, no ratchet)
              ├── LB-8  (no migration, no ratchet; governance-legal Option B)
              ├── LB-10 (no migration; build now) ───────────────► H6 (Resend) gates LIVE delivery
              ├── LB-9  (mig 171 → bridge; custom_css sanitization)
              └── LB-12 (auth) ──► bumps app-route ratchet 127→128 (lockstep) ; H7 (Turnstile) gates LIVE signup
```

Independent batches (no inter-dependency): LB-8, LB-10, LB-11. Ordered constraints: **LB-7 before all** (gate), **mig 171 after mig 170** (sequential validator), **LB-12 owns the only route-count bump**.

## 2. Implementation order (lowest-risk-first, dependency-respecting)

| # | Batch | Why here | Effort |
|---|---|---|---|
| 1 | **LB-7 commit** | clears the one red validator; prerequisite for green validation of everything else | commit only |
| 2 | **LB-11** hide dead surfaces | smallest, zero-migration, zero-ratchet, fast confidence | ~0.5d |
| 3 | **LB-8** announcement bar | low-risk Option B; fixes a live broken box; no migration/ratchet | ~0.5–1d |
| 4 | **LB-10** lifecycle emails | proven Mechanism-A path; build now, live after H6 | ~2d |
| 5 | **LB-9** appearance bridge | needs mig 171 + custom_css sanitization (sharp edge) | ~2–3d |
| 6 | **LB-12** registration | highest-risk (auth) + the one route-ratchet bump → do last | ~1–2d |

**Total remaining code ≈ 6.5–9 dev-days** (+ LB-7 commit). Sequence is also fine to parallelize across 2 engineers: Eng A = LB-11→LB-8→LB-10; Eng B = LB-9 (mig)→LB-12, merging LB-12's ratchet bump last.

## 3. Commit order (one commit per LB — never batch)

`v1-launch-b5` (LB-7) → `v1-launch-b6` (LB-11) → `v1-launch-b7` (LB-8) → `v1-launch-b8` (LB-10) → `v1-launch-b9a` (mig 171) + `v1-launch-b9b` (LB-9 bridge) → `v1-launch-b10` (LB-12 incl. ratchet bump). Each commit: code + tests + ledger row in the same commit.

## 4. Test order (per batch, before its commit)

Every batch, in order: **(a)** its targeted unit/contract test → **(b)** `npx tsc --noEmit` on the touched runtime → **(c)** `node scripts/validate-governance.mjs --lane=gate` → **(d)** the launch + federation suites. Batch-specific:

| Batch | Targeted tests |
|---|---|
| LB-11 | gate only (no new test needed); confirm `domain-boundary` still 127, design-system green |
| LB-8 | `tests/contracts/theme-section-registry.test.ts` (extended); theme-engine test stays green |
| LB-10 | mirror `services/api-gateway/src/__tests__/order-confirmation-email.test.ts` (×3 stages); allowlist source-assertion |
| LB-9 | new `tests/contracts/appearance-bridge.test.ts`; `tests/localization/theme-localization.test.mjs` (extended); migration test for 171 |
| LB-12 | `customer-engagement.security.test.ts`; `storefront-customer-engagement-routes.test.ts` (add route); `storefront-login-abuse-controls.test.ts` |

## 5. Validator order / impact

| Batch | Validators most relevant | Lockstep update? |
|---|---|---|
| LB-7 | `sequential-migration` (mig 170) | commit clears it |
| LB-11 | `domain-boundary` (127), `legacy-site-type`, `shell-single`, `validate-design-system` | none (keep `gift-cards/route.ts`) |
| LB-8 | `no-new-react-sections`, `theme-governance` | none (Option B avoids `components/sections/`) |
| LB-10 | none new | none |
| LB-9 | `sequential-migration` (mig 171), `migration-safety` | mig 171 must be tracked |
| LB-12 | `domain-boundary` (127→**128**), federation route-ownership | **YES** — bump count + federation test + ownership doc |

## 6. Risk matrix

| Batch | Effort | Risk | Blast radius | Migration | Ratchet | Human-seam (live) | Rollback |
|---|---|---|---|---|---|---|---|
| LB-7 | commit | low | — | 170 (exists) | — | H6 (rates are data) | revert commit |
| LB-11 | 0.5d | **low** | nav/links/1 page | no | no (keep route) | — | revert PR |
| LB-8 | 0.5–1d | **low** | 1 renderer entry | no | no | — | delete 1 entry |
| LB-10 | 2d | low | 3 files | no | no | **H6 Resend** (live only) | revert PR |
| LB-9 | 2–3d | **med** | select+merge+layout | **171** | no | — | revert PR (+drop col) |
| LB-12 | 1–2d | **med** | new auth route + UI | no | **127→128** | **H7 Turnstile** (live only) | revert PR (+count→127) |

Sharpest edges: **LB-9 custom_css sanitization** (XSS — route through the existing theme CSS sanitizer, never raw), and **LB-12 token-less first password** (safe only via the not-exists precondition + Turnstile + rate-limit — all three must be present).

## 7. Rollback plan (global)

Each LB is a single revertible commit. No batch shares state with another except: LB-9's mig 171 (drop column on rollback only if no data written) and LB-12's ratchet count (revert to 127 in the same revert). No batch flips a governance flag, so there is no `validate-governance` state to reset. LB-7/LB-9 migrations are forward-only schema adds with `IF [NOT] EXISTS` guards → safe re-apply.

## 8. Cross-cutting human seams (do NOT mark complete)

- **C0** (commit) — clears outside sandbox; gates every commit above.
- **H6 Resend** — gates LB-10 live delivery (build/test works without).
- **H7 Turnstile** — gates LB-12 live signup (build/test works with dev-bypass).
- H1–H5, H8, H9 (push, secrets, DNS, prod Supabase, rotation, Razorpay Route, legal) — unchanged; see `LETBUYY_V1_BLOCKER_REPORT.md §C`.

## 9. Definition of done → certification

Only after LB-7…LB-12 are each committed with gate-green + tsc-0 + tests-green, no new architecture, and no foundation winner regressed (re-run the Phase-7 journey audits) is a `LETBUYY_V1_CERTIFICATION.md` honest. Until then the live status remains the `LETBUYY_V1_BLOCKER_REPORT.md` (NO-GO), and go-live stays gated on the 9 human seams.

---

*This is a plan. No code, migration, or commit was produced. Effort numbers are verifier-sized from the per-LB strategies; every cited file:line was confirmed by the Phase-0 + per-blocker code audits.*
