# 32 — Glossary

**Run ID:** `2026-08-04T225330+0530-bf35062e` · **Branch:** `stepup/main` · **Commit:** `bf35062e` · **Date:** 2026-08-04

Canonical terms used across this dossier. Where a term has a LetBuyy-specific meaning that differs from industry usage, the LetBuyy meaning governs and the difference is called out.

> **No secrets or PII appear in this document.**

---

## 1. Governance and authority

| Term | Meaning |
|---|---|
| **Constitution / DOC 01** | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`. Supreme law. Nothing overrides it. Changes only by ARB amendment. |
| **AGENTS.md / DOC 02 / `LETBUYY_AGENTS_V2`** | The hand-authored operating rulebook every agent and engineer follows. Subordinate to the Constitution. Rules are citable as `PREFIX-Rn` (e.g. `PAY-R2`, `SEC-R9`). |
| **DOC 03 / Canonical systems** | `LETBUYY_CANONICAL_SYSTEMS.md` — the winner registry naming the one true system per domain. |
| **ART-nn** | A Constitutional **Article** (ART-01 … ART-24). A permanent decision, reversible only by amendment at a named trigger. |
| **R-nn** | A Constitutional **Rule** — a numbered, testable MUST/MUST-NOT invariant (R-1 … R-23). |
| **ARB** | Architecture Review Board. The only body that may amend the Constitution, declare a canonical winner, freeze or reopen a capability, or authorise filling a reserved service. |
| **Class A / B / C decision** | A = constitutional (ARB only). B = operative (ARB review where it touches a canonical contract or go-live gate). C = routine implementation inside an already-canonical system (an engineer or agent may decide alone). |
| **Scale envelope** | A constitutional constant: design for **100 → 1,000 → 10,000 India merchants**, never 100k+/1M+. Designing past it is out of scope by rule, not opinion. |
| **Never-Build List** | Constitution §10 — capabilities forbidden within the envelope (service fleet, CQRS/event-sourcing/saga, multi-region, sharding-now, service mesh, self-custody payout rail, cross-merchant wallet, third-party app marketplace + Wasm runtime, headless tier, fraud ML, full in-WhatsApp commerce, any GMV/transaction fee, filling the six reserved services). |
| **Governance theater** | Constitutionally prohibited: certifying an architecture the platform does not have, or passing a green gate while known S0s ship. |
| **Two-lane merge rule** | The ownership split that lets two workstreams land without colliding; one lane merges at a time. See `28-COMPLETION-ROADMAP-AND-WORK-PACKAGES.md`. |
| **Validator gate** | The deterministic CI suite (`scripts/validate-governance.mjs`, 108 gate-lane validators at HEAD). The **authoritative** signal; AI/heuristic findings are candidates until a validator or a human confirms them. |

---

## 2. Topology and runtimes

| Term | Meaning |
|---|---|
| **The canonical 8** | The entire deployable topology: `services/api-gateway`, `services/queue-workers`, `services/mobile-bff`, `apps/identity-platform`, `services/webhook-service`, `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/marketing-site` — plus `apps/mobile/merchant-app` and **one** ops console `apps/platform-console`. |
| **Modular monolith** | `api-gateway` — all commerce capability lives inside it as enforced-boundary modules. Extraction to a service requires a measured trigger + ARB sign-off. |
| **Satellite** | `queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`. |
| **Reserved service** | `checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service` — must stay **manifest-only / empty**. Also the reserved mobile roots `apps/mobile/shopper-app` and `apps/mobile/operator-app`. |
| **Frozen app** | `app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal` — de-deployed, excluded from build/lint/typecheck, reconsidered only at ≈5,000 merchants + real developer demand. |
| **Deprecated alias** | `apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`. Must not be recreated or referenced as active topology. |
| **Same-origin proxy** | An app-local `/api/*` route in a Next.js app that forwards to the gateway. Browser apps must **not** call the gateway directly, and apps must **not** write the database. |
| **Merchant control plane** | `apps/merchant-control-plane` — the merchant web OS (77 page routes, 130 API proxies at HEAD). |
| **Storefront runtime** | `apps/storefront-runtime` — the single buyer runtime. Host→tenant routing lives in `src/proxy.ts` (renamed from `middleware.ts` in Next 16 — a prior "storefronts unreachable" S0 was a false positive caused by that rename). |
| **LCIS** | LetBuyy Central Intelligence System — the repository's own code/DB/domain intelligence layer (`tools/graph-server`, `tools/central-intelligence`, `packages/lcis-*`). A **query and analysis tool**, not product runtime and not governance authority. |

---

## 3. Tenancy and identity

| Term | Meaning |
|---|---|
| **site** | The tenant. The database owns `sites`; "store" is a UI/URL term only. `CODE-R9` forbids adding a `stores` table. |
| **`site_id`** | The tenant key present on tenant tables. Must be derived from the **authenticated principal**, never accepted from the client. |
| **RLS `ENABLE` + `FORCE`** | Row-Level Security switched on *and* forced so even the table owner is subject to policy. Required on every tenant table. |
| **Tenant GUC** | A per-transaction PostgreSQL setting carrying the tenant identity, set only from a **validated** claim. Unset or wrong GUC must yield **zero rows** (fail-closed). |
| **`verifySiteOwnership`** | The gateway-side ownership check that must precede elevated data access. |
| **`app_tenant` role** | The non-`BYPASSRLS` database role tenant queries are meant to run under, so RLS is load-bearing. |
| **`service_role`** | The privileged, RLS-bypassing database role. Constitutionally a **narrow, audited break-glass hatch only** — never the blanket connection for tenant data. |
| **Realm** | One of the three identity domains: merchant/staff, buyer/customer, platform-operator. Realms must never cross privileges. |
| **Sole issuer** | `identity-platform` — constitutionally the only minter of tokens for all three realms, using **asymmetric** sole-signing (EdDSA/Ed25519, ES256 fallback); every other runtime is **verify-only**. |
| **Step-up** | A second factor required on privileged money actions (refund, payout). Must be **real cryptography** (HMAC / stored challenge), never a string-length or boolean check. |
| **`jti`** | The unique token identifier. A step-up token whose `jti` is never consumed is **replayable** within its validity window. |
| **DPDP** | India's Digital Personal Data Protection regime. Requires an append-only consent ledger and DSR (export/erasure); the consent gate must **fail closed**. |

---

## 4. Money

| Term | Meaning |
|---|---|
| **Canonical ledger** | The append-only, double-entry, 8-account ledger (migrations ~139–161, extended by 168). The **single** money source of truth. |
| **Derived balance** | Balance computed from ledger entries (e.g. `ledger_account_balance_minor`), never stored in a mutable column. A mutable balance treated as truth is anti-pattern `ANTI-R4`. |
| **Ledger projection** | A read-only balance derived from ledger entries — the correct pattern (e.g. gift-card balance). |
| **Minor units / paise** | Money as `bigint` integers in paise. `R-8` forbids int32 paise (overflows at ₹2.14 crore), rupee `numeric`, and floats. Columns suffixed `*_minor` follow this convention. |
| **`pa_clearing` / `merchant_payable`** | Two of the canonical ledger accounts. A capture debits `pa_clearing` and credits `merchant_payable`; a payout release debits `merchant_payable`. |
| **PA** | Payment Aggregator — a licensed entity that moves funds. LetBuyy **rents** the rail and never custodies. |
| **Merchant-of-record** | The party legally receiving the buyer's payment. Constitutionally the **merchant**, into the merchant's own Razorpay account. |
| **BYOG** | "Bring Your Own Gateway" — the merchant-owned PSP architecture where each site connects its own Razorpay credentials. |
| **Razorpay Route** | Razorpay's split-settlement product using **linked accounts**. The sanctioned money-out mechanism: a split **instruction** plus a statement mirror plus reconciliation — not custody. |
| **Never-custody** | `ART-11` / `R-7`. LetBuyy must never hold buyer or merchant funds. A self-custody disbursement rail (`razorpayx`) is DEAD. |
| **`commission_bps`** | Platform commission in basis points. Must be **0**, permanently (`R-9`). Monetisation is subscription + adjacencies, never the sale. |
| **Idempotency key** | The caller-supplied key that makes a money mutation safe to retry exactly once. Mandatory on every money RPC, paired with `ON CONFLICT` and row locking (`FOR UPDATE`). |
| **Reconciliation to zero-break-or-explained-suspense** | Reconciliation must resolve to zero variance or an explicitly recorded break; **auto-plugging a difference is forbidden** (`PAY-R9`). |
| **`recon_breaks`** | The signed record of reconciliation differences that must be surfaced rather than silently corrected. |
| **COD** | Cash on Delivery. No online capture, but it still carries order, inventory, receivable (`cod_receivable`) and reconciliation consequences. |
| **Reversing entry** | The only lawful correction to a posted ledger entry. `UPDATE`/`DELETE` of a posted entry is forbidden. |

---

## 5. Commerce

| Term | Meaning |
|---|---|
| **Server-authoritative** | Price, discount, inventory, tax, shipping and order creation are decided on the **server** from database state. The client cart is a view, never an authority. |
| **Cart-bound signed handoff** | The HMAC that binds checkout to specific cart contents (hash of sorted line items + coupons + subtotal). Prevents replay against a mutated cart. `ART-14` forbids an unsigned public order-create path. |
| **Reserve-with-TTL** | The mandated inventory model: reserve stock with an expiry, commit on payment. `ART-14` forbids **pre-payment hard decrement**. |
| **Stale-reservation sweeper** | The `queue-workers` job that releases expired reservations. A sweeper that exists but is never scheduled is **dormant** and strands inventory. |
| **Reserve → commit** | The single mandated inventory lifecycle. Multiple independent "stock mutators" reopen oversell and violate `ART-15`. |
| **`combines_with` engine** | The typed 3-class discount engine that governance crowns as canonical, demoting the scalar single-code RPC. |
| **Outbox** | The transactional outbox: a domain write and its event row commit in the **same** transaction; a worker relays. Deliberately **not** an event bus. |
| **Place of supply** | The GST concept determining whether a supply is intra-state (CGST+SGST) or inter-state (IGST). |
| **HSN / SAC** | Harmonised System Nomenclature (goods) / Services Accounting Code — the GST classification carried per line. |
| **GSTIN** | The 15-character GST identification number of a registered taxpayer. |
| **Output GST** | Tax on sales the merchant collects and owes. |
| **Input GST / ITC** | Tax paid on purchases that a registered merchant may claim as Input Tax Credit — requires supplier GSTIN, invoice details, HSN/SAC, and the tax split to be captured. |
| **Credit note / debit note** | The GST instruments that adjust a previously issued tax invoice — required for refunds and returns to reverse output tax correctly. |
| **IRN / IRP / e-invoice** | Invoice Reference Number issued by the Invoice Registration Portal. A **mock IRP** must never report success as if it were live (`ANTI-R9`). |
| **Channel** | First-class dimension on cart/checkout/order: `web`, `whatsapp`, `instagram`, `pos`, `api`. |

---

## 6. Theme and storefront

| Term | Meaning |
|---|---|
| **Liquid / OS-2.0** | The Shopify-shaped portable theme model. Constitutionally the **canonical renderer** (`ART-17`) because it is the only architecture supporting third-party authors and portable themes. |
| **React renderer** | The first-party compatibility fast-path. Currently the **live default**. Frozen — no new React-per-section capability after the freeze. To be deleted-or-frozen by data at the hardening wave, **not** deleted now. |
| **Canary / `renderer.engine`** | The per-theme switch that both enables a Liquid canary and serves as the rollback. A platform-wide flip requires parity + security + perf gates and ARB sign-off. |
| **Section / app-block** | Units of a theme. Third-party app-blocks are a frozen seam, not a build. |
| **Data-only sandbox** | The theme render contract: merchant/theme settings are **data, never executable code**. Enforced by `ownPropertyOnly`, drop scrub, and upload-time `{% render %}` forbidding. |
| **Sanitizer** | The allowlist/DOMPurify output sanitizer (`outputEscape: 'escape'`, FORBID lists). Must never be loosened to a regex. |

---

## 7. Delivery, seams, and process

| Term | Meaning |
|---|---|
| **Deploy meta-blocker** | `ART-03` / `DEPLOY-R1`: `production-deploy.yml` triggers on `main`, so if `main` lags the integration branch, nothing ships. The guard requires `git rev-list --count main..stepup/main` = **0**. |
| **Branch-lag guard** | The CI check enforcing the above. |
| **H-seam (H1…H9)** | A named **human/business/regulatory** gate that cannot be closed from the engineering environment. H1 push+branch protection · H2 ~41 production secrets · H3 DNS wildcard + SSL · H4 production Supabase + migrations · H5 internal-secret rotation cutover · H6 Resend live keys + SPF/DKIM/DMARC · H7 Turnstile live keys · **H8 Razorpay Route PA onboarding (regulatory, weeks — the dominant launch gate)** · H9 legal ToS/Privacy/DPDP. |
| **CAP-C01…CAP-C04** | The four **live money certifications**, each a procedure requiring real Razorpay credentials, staging Supabase, and a real store: C01 live capture-ledger · C02 live refund-ledger · C03 live payout provider (blocked by H8) · C04 live money reconciliation. All **NOT STARTED**. |
| **`HR-*`** | Rows in `EXECUTABLE_HUMAN_REQUIRED.md` — the executable human-required registry naming the exact human action, files, and what it unblocks. |
| **`SKIP-*`** | Rows in `SKIPPED_HUMAN_DECISIONS.md` — decisions deliberately deferred to a human. |
| **`[HIGH-STAKES]`** | This dossier's tag for any finding touching money, payments, refunds, gift cards, payouts, settlements, GST, auth, tenancy, or RLS. Requires human/ARB review; never remediated by an agent alone. |
| **`[IRREVERSIBLE]`** | Work involving data migration or a public-contract change that cannot be cleanly rolled back. |
| **`MCP-DISC-NNN`** | The stable gap identifier used by this dossier. Cite these IDs in future work packages, PRs, and tickets. |
| **`S0`/`S1`/`S2`/`S3`** | Severity language used by the **prior** certification corpus. This dossier uses `P0`–`P3`; where a prior S-level is quoted it is attributed to that source. |
| **`P0`–`P3`** | This dossier's severity. P0 = launch-stopping or actively unsafe · P1 = must fix before pilot · P2 = must fix before scaled beta · P3 = hardening. |
| **Expand → backfill → verify → contract** | The mandated data-cutover discipline. The old shape is never dropped before parity is proven. |
| **`SAFE_DELETE` / `DELETE_AFTER_MIGRATION`** | The two deletion classes. The first needs zero importers + build/test/governance green; the second additionally needs the canonical winner live and serving, plus a zero-drift proof for money paths and per-section parity for renderers. |
| **Provider-mode honesty badge** | The mandatory `mock` / `sandbox` / `live` indicator on every money and fulfillment surface. **A stub must never read as `success`** (`R-22`, `ANTI-R9`). |
| **NOT CONNECTED** | The honest label for a live value whose data source is not wired. Never replaced by a fabricated metric. |

---

## 8. Status and evidence vocabulary of this dossier

Defined normatively in `02-DISCOVERY-METHOD-AND-EVIDENCE.md` §7 and summarised in `00-READ-ME-FIRST.md`.

**Statuses:** `VERIFIED_E2E` · `IMPLEMENTED_NOT_RUNTIME_VERIFIED` · `BACKEND_ONLY` · `UI_ONLY` · `PARTIAL` · `STUB_OR_MOCK` · `BROKEN` · `NOT_IMPLEMENTED` · `DORMANT_FLAGGED` · `BLOCKED_EXTERNAL` · `UNVERIFIED_RUNTIME` · `OUT_OF_SCOPE_OR_DEFERRED` · `CONTRADICTORY_EVIDENCE`

**Evidence types:** `DOC_CLAIM` · `UI_CODE` · `PROXY_CODE` · `API_CLIENT_CODE` · `GATEWAY_CODE` · `SERVICE_CODE` · `DB_SCHEMA` · `RLS_POLICY` · `RPC_FUNCTION` · `WEBHOOK_OR_JOB` · `UNIT_TEST` · `INTEGRATION_TEST` · `E2E_TEST` · `BUILD_RESULT` · `RUNTIME_OBSERVATION` · `PROVIDER_OR_CONFIG_EVIDENCE` · `LCIS_GRAPH`

**GST-specific labels:** `CODE_IMPLEMENTED` · `ACCOUNTING_POLICY_DEFINED` · `LEGALLY_VALIDATED` · `INFERRED-FROM-PRACTICE-NOT-REPO`
