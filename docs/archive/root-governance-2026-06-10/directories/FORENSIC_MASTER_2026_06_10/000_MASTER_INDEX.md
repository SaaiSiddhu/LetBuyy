# LETBUYY FORENSIC MASTER AUDIT — 2026-06-10

> **Scope:** Full-ecosystem forensic engineering audit (14 phases) of the LetBuyy commerce platform, conducted against `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (the frozen constitution) as the source of truth.
> **Method:** Evidence-only. Every finding is anchored to `path:line` in the working tree as it stood on 2026-06-10 (uncommitted changes included). Prior June-09 audits were treated as hypothesis lists and **re-verified** against current code; superseded claims are marked. A final independent pass re-confirmed the seven load-bearing S0/S1 claims directly against code (0 refuted).
> **Corpus:** 357 raw findings → **291 unique issues** after cross-phase merge. **9 S0 · 41 S1 · 130 S2 · 111 S3.**

---

## The Four Questions (mission primary goal)

### 1. What LetBuyy ACTUALLY is today
A **genuinely-built modular monolith** (`api-gateway`, ~83k LOC) over one Supabase Postgres on Cloudflare, with a **real, rigorous P0 money kernel** (migrations 139–161: 8-account append-only double-entry ledger, capture/refund/payout postings, unique `provider_payment_id`, the payment-forgery fix live) and the **single best-finished surface being the Flutter merchant app** (3.1/5, real Turnstile login, secure token storage) — **welded onto an unreconciled 237-table legacy mass** whose tenancy is enforced only in application code because the gateway connects as `service_role` (RLS bypassed), and whose **remediation is built but undeployed** (`main` is ~30 commits behind the branch where the fixes live). Net engineering reality: **~2.4–2.5 / 5**, "DDL-real, wiring-dead" in four load-bearing places (compensation executor, reservation sweeper, ledger reconciliation scheduler, hosted-checkout origin) and "two parallel systems" in four more (legacy vs canonical ledger, React vs Liquid theme renderer, legacy vs V1 auth, dual draft systems).

### 2. What LetBuyy THINKS it is
A **production-ready, enterprise-grade, 9-app platform** — because the **governance gate is green**: `node scripts/validate-governance.mjs` passes **181 validators**, including certifications for provider-failover, partition-recovery, multi-region survivability, and 9 chaos experiments. But those validators enforce the **rejected** constitution (`AGENTS.md`'s 9-app topology + CQRS/saga/multi-region architecture that V1 §4 explicitly **REJECTS**), and **zero validators reference V1**. The result is a platform that **certifies itself ready while 9 S0 vulnerabilities sit live** — governance theater, not governance.

### 3. What LetBuyy SHOULD be (per V1)
One modular monolith + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service`, over one RLS-isolated Postgres, **India-only, 100→1k→10k merchants**, where **merchants are merchant-of-record on their own Razorpay** and a **licensed PA (Razorpay Route / Cashfree) custodies and disburses all money** (LetBuyy never holds funds), **0% transaction fee permanent**, reserved services empty, WhatsApp scoped to order-lifecycle + COD-confirm. Correctness-critical paths (server cart, double-entry ledger, signed checkout handoff, PA-split, RLS isolation, outbox) built to production grade; everything Shopify-end-state deferred or rejected.

### 4. The exact GAP
The **topology and money-engineering largely comply** (~62% architecture compliance). The gap is concentrated and nameable:
- **Security/data:** 6 RLS-to-PUBLIC table leaks + an anon-writable super-admin allowlist + an unauthenticated `/api/auth/switch` account takeover whose fix is **uncommitted and undeployed** + the gateway-as-`service_role` architecture that makes RLS decorative. *(9 S0s.)*
- **Money vs constitution:** a live **3% GMV rake** (V1 ordered 0%), a hardcoded **`razorpayx` self-custody** payout rail (V1: PA-split, never custody), capture/refund/COD flows that **don't post to the canonical ledger**, a **forgeable step-up** on refund/payout, and a GUC-from-param cross-store ledger primitive.
- **Governance:** the **two-constitution conflict** — CI enforces `AGENTS.md` (with the V1-rejected marketplace tier deployed and rejected CQRS/multi-region arch wired and certified) instead of V1.
- **Deployability:** none of the 8 "complete" remediation waves reach production until the deploy pipeline / branch lag is fixed — the **meta-blocker**.

**One-line verdict:** *LetBuyy has built the hard, correct core that V1 asked for — and then hidden it behind a green governance gate that certifies the rejected architecture while the real platform ships with cross-tenant data leaks, an unfixed account takeover, and a money layer that contradicts its own 0%-fee, no-custody constitution. The fixes mostly exist; they are unmerged, unwired, or one default-number away.*

---

## Deliverables (read in this order)

| # | Document | What it answers | Headline |
|---|----------|-----------------|----------|
| — | **`000_MASTER_INDEX.md`** (this file) | The four questions; how to read the set | 291 issues, 9 S0 |
| 1 | `REPO_TOPOLOGY_AUDIT.md` | What deploys / dead / scaffold / reserved / duplicate | 4 Workers + 9 Vercel apps deploy; `main` 30 behind; reserved services clean-empty |
| 2 | `ARCHITECTURE_COMPLIANCE_AUDIT.md` | Module-by-module vs V1 (APPROVED/PARTIAL/VIOLATION/…) | ~62% compliant; 3 prior S0s verified FIXED; two-constitution conflict |
| 3 | `FOUNDATION_AUDIT.md` | Tenant isolation / RLS / RBAC — can data leak? | **YES** — 6 S0 anon table leaks; RLS decorative under `service_role` |
| 7 | `DATABASE_FORENSIC_AUDIT.md` | Migrations, tables, indexes, money-table integrity | 419 tables, max migration 161; ledger append-only enforced; 32-bit money overflow |
| 4 | `PAYMENTS_FORENSIC_AUDIT.md` | Can money disappear/duplicate/double-fire? | Capture/refund/COD un-ledgered; razorpayx self-custody; forgeable step-up |
| 5 | `CHECKOUT_FORENSIC_AUDIT.md` | Forgery / oversell / duplicate orders / coupon bypass | Cart **is** server-authoritative; oversell closed on main path, open via 2 side doors |
| 6 | `AUTH_FORENSIC_AUDIT.md` | Session / token / escalation / cross-tenant | `/api/auth/switch` S0 takeover live on every branch; shared `AUTH_SECRET` HS256 |
| 12 | `SECURITY_FORENSIC_AUDIT.md` | OWASP Top 10 + unified cross-phase S0 ranking | Posture 2.4/5; storefront stored-XSS; webhook SSRF; the 9-S0 rollup |
| 8 | `UI_UX_GOVERNANCE_AUDIT.md` | Every app scored ×9 categories | 2.8/5; 3 design-token sources; shell adoption 2/9; CI ratchet baselines drift |
| 9 | `THEME_FORENSIC_AUDIT.md` | Theme system vs Shopify OS 2.0 | ~62% parity; real editor; Liquid renderer shipped but flagged OFF; 1-theme shelf |
| 10 | `MOBILE_FORENSIC_AUDIT.md` | Flutter architecture & production risk | 3.1/5 (best surface); login **works** on prod; debug-keystore release blocker |
| 11 | `PERFORMANCE_AUDIT.md` | N+1 / indexes / caching at the 100→10k envelope | 3.0/5; storefront caching is the strong point; mobile dashboard ~7 serial round-trips |
| 13 | `TOP_250_PLATFORM_ISSUES.md` | Ranked master register (ISSUE-001…291) | Top 250 + appendix; go-live blocker shortlist |
| 14 | `LETBUYY_MASTER_EXECUTION_PLAN.md` | Dependency graph + Phases A–E + burn-down | All 9 S0s close in Phase A; all 33 go-live blockers by end of Phase B |

---

## Go-Live Blocker Shortlist (must close before any real merchant / live keys)

**Phase A — stop the bleed (all 9 S0s + deploy meta-blocker):**
ISSUE-001 `/api/auth/switch` takeover (commit + deploy the fix) · ISSUE-002 fix deploy pipeline / `main` branch lag · ISSUE-003 super-admin allowlist anon-insert · ISSUE-004…008 the five anon RLS table leaks (sites/orders/products/billing/customer-PII) · ISSUE-009 take the gateway off blanket `service_role` and engage the tenant GUC · plus buyer-facing ISSUE-016/017 stored-XSS pair and ISSUE-020 webhook SSRF.

**Phase B — money-safe for live keys:**
ISSUE-010/011 ledger every capture + credit `pa_clearing` · ISSUE-018/019 ledger refunds + COD · ISSUE-012 real cryptographic step-up · ISSUE-013 stop setting the tenant GUC from a raw param · ISSUE-014 razorpayx → PA-split · ISSUE-015 set commission to 0 (honor the 0% promise) · ISSUE-025 finish the bigint money cutover · outbox atomicity + compensation executor.

---

## Verification note
An independent pass re-read the code for the 7 highest-stakes claims (account-takeover + git state, the PUBLIC RLS policies, razorpayx rail, 3% rake, un-ledgered capture, service_role-bypasses-RLS, forgery-fix-present): **all 7 CONFIRMED, none refuted.** Two were *understated* by the phase docs (the misleadingly-named `confirm_order_payment_with_ledger` posts no ledger; the self-custody rail is real but disbursement is currently gated off → smaller immediate blast radius). Live-only items (the six anon table GRANTs are set by Supabase's managed bootstrap, not the repo SQL) are flagged UNVERIFIED and should be confirmed with an anon-key probe / `\dp public.orders` before final S0 sign-off — though migration 107's own header is strong evidence they are live.
