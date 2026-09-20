# LIQUID_COMPLETION_RISK_REGISTER.md

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only. Severity/Likelihood: H/M/L.

| ID | Risk | Sev | Lik | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **Parity never reaches green** (0/200 today; harness never run) — blocks L16/L17 | H | M | run the harness early per-template (L14 incremental); real tests not grep; budget 1–2 wk | Theme lead |
| R2 | **L3 compiler underestimated** (net-new, no prior art in repo) | H | M | defer behind one fixed Liquid theme; treat as parallel branch; spike first | Theme lead |
| R3 | **ARB flip stalls** (human gate, not schedulable) | H | M | pre-align in L0; have parity evidence ready before requesting | Founder/ARB |
| R4 | **React deleted too early** (Constitution ART-17 violation) | H | L | hard gate in L17: 5 proofs + hardening-wave decision; React frozen-present until then | Governance |
| R5 | **LB-12 registration slips** (blocks L9) | M | M | sequence LB-12 in the V1 code program first; it's a known pending blocker | Identity |
| R6 | **CSS sanitizer interaction** (`<style>`/`<link>` stripped by WHOLE_DOCUMENT DOMPurify) | M | M | verify ADD_TAGS for head assets without weakening forbid-list; test in L2 | Theme |
| R7 | **Perf regression on Liquid** (render limits, payload) | M | M | perf dimension in L14 mandatory; canary metrics in L15; rollback = canary off | Storefront |
| R8 | **Checkout-handoff drift** (Liquid cart computes/trusts client totals) | H | L | Liquid cart MUST use the signed `/cart/:token/checkout-url`; server re-prices; test in L8/L14 | Money |
| R9 | **Issuer model broken** (register touches identity-platform / adds issuer) | H | L | L9 reuses HS256 `issueCustomerSession`; proxy re-mints; identity-sole-issuer validator | Identity |
| R10 | **Tenancy bleed in rendered output** (cross-store data) | H | L | all render-read tables RLS ENABLE; parity asserts no bleed; reads by subdomain | Tenancy |
| R11 | **Validator lock-web mistakes during deletion** (gate breaks) | M | M | lockstep edits per `REACT_DELETION_EXECUTION_PLAN.md`; staged batches; archive-restore rollback | Governance |
| R12 | **Commit seam (C0)** blocks per-phase commits in this environment | M | H | human commits each phase outside the sandbox; untracked-migration guard for L1/L15 | Eng lead |
| R13 | **Search backend gap** (no product-search endpoint) | L | M | choose client-filter port (cheap) unless real search is in scope | Storefront |
| R14 | **Scope creep into Liquid checkout** (against §234) | M | L | checkout stays the React hosted origin under any renderer — out of scope by Constitution | Architect |
| R15 | **Money/identity/tenancy regression** from render work | H | L | no phase edits `api-gateway` money/auth/tenancy; gate suites green every phase | Governance |

## Top risks by exposure (Sev×Lik)

R1 (parity), R2 (compiler), R3 (ARB) — the schedule risks. R8/R9/R10/R15 — the guarantee risks, all Low-likelihood by construction (the render layer is isolated from money/identity/tenancy) but High-severity, so each has an explicit L14 validation dimension.
