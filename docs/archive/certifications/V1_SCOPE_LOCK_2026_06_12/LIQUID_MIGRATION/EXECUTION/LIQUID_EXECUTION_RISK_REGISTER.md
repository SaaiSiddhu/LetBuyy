# LIQUID_EXECUTION_RISK_REGISTER.md

**Full Liquid V1 · HEAD `140a73db` · plan-only.** Sev/Lik: H/M/L. Owner = accountable role.

| ID | Risk | Phase | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|---|
| X1 | Parity never reaches green (0/200 today) | L14 | H | M | run harness incrementally per template; real tests not grep; mutation-test the parity validator | Theme lead |
| X2 | Compiler scope-creep into a runtime (forbidden) | L3 | H | L | `THEME_COMPILER_CONTRACT.md` freezes scope; `ThemeLiquidSourceSchema` rejects script/render/include; STOP→ARB on any execution capability | Architect |
| X3 | Compiler underestimated (net-new) | L3 | H | M | defer behind one fixed Liquid theme; spike first | Theme lead |
| X4 | ARB flip stalls (human gate) | L16 | H | M | pre-align L0; evidence ready before request | Founder/ARB |
| X5 | React deleted before parity/HW decision (ART-17 violation) | L17 | H | L | L17 hard-gates on 5 proofs + HW decision; React frozen-present | Governance |
| X6 | Checkout rewritten into Liquid (forbidden, §234) | L8 | H | L | `CHECKOUT_BOUNDARY_DECISION.md`; cart uses signed `/cart/:token/checkout-url` only; checkout files KEEP-PERMANENT | Architect |
| X7 | CSS sanitizer strips head `<style>`/`<link>` | L2 | M | M | verify ADD_TAGS for head assets without weakening forbid-list; test | Theme |
| X8 | Perf regression on Liquid render | L5-L14 | M | M | mandatory perf dimension in L14; canary metrics; rollback=canary off | Storefront |
| X9 | Checkout-handoff drift (Liquid cart trusts client totals) | L8 | H | L | server re-pricing (`hydrateCartLines`); HMAC handoff; L14 checkout-handoff cell | Money |
| X10 | Issuer model broken at registration | L9 | H | L | reuse HS256 `issueCustomerSession`; proxy re-mints; identity-sole-issuer validator | Identity |
| X11 | Tenancy bleed in rendered output | L4-L14 | H | L | all render-read tables RLS ENABLE; reads by subdomain; parity asserts no bleed | Tenancy |
| X12 | Validator lock-web mistake during deletion | L17 | M | M | lockstep edits per `REACT_DELETION_EXECUTION_PLAN.md`; staged batches; mutation-test each | Governance |
| X13 | Commit seam (C0) blocks per-phase commits | all | M | H | human commits each phase; untracked-migration guard for L1/L15 migrations | Eng lead |
| X14 | LB-12 registration slips | L9 | M | M | land LB-12 in the V1 code program first | Identity |
| X15 | Search backend gap | L7 | L | M | choose client-filter port unless real search scoped | Storefront |
| X16 | Validator weakened/bypassed to fake completion (FORBIDDEN) | all | H | L | execution prompt forbids it; mutation-test critical validators every phase; honest ledger | Governance |
| X17 | Money/identity/tenancy regression from render work | all | H | L | no phase edits api-gateway money/auth/tenancy; gate suites green every phase | Governance |

## Exposure ranking (Sev×Lik)
**Schedule:** X1 (parity), X3 (compiler), X4 (ARB), X13 (commit), X14 (LB-12).
**Guarantee (High-sev, Low-lik by isolation, each with an explicit L14 validation cell):** X6 checkout, X9 handoff, X10 issuer, X11 tenancy, X16 validator-integrity, X17 foundation.

## Standing controls (apply every phase)
- Mutation-test the phase's critical validator (inject violation → fail; restore → pass; record transcript).
- Honest `EXECUTION_LEDGER` row (no over/under-claim) — the repo's established discipline.
- Foundation suites (money/identity/tenancy) green every phase; any red = STOP.
- React-deletion proof gates (X5) are non-waivable.
