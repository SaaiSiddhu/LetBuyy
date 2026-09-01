# LETBUYY STRATEGIC WINNERS MASTER PLAN

> **Document type:** Strategic-winner synthesis across all 32 platform domains — the canonical "what survives at 10,000 merchants" verdict for the LetBuyy ecosystem (Architecture Review Board, capstone deliverable of the Strategic Canonicalization program).
> **Date:** 2026-06-10
> **Author role:** Architecture Review Board (ABR) chair, synthesizing the nine domain deliverables into one strategic-winner ledger.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` (working tree, evidence pinned at `stepup/main` @ `5cf9e64e`, dirty, 2026-06-10).
> **Companion:** `CANONICAL_ARCHITECTURE_MATRIX.md` (same directory) — the denser component-level reference matrix + target diagram + classification totals. This plan is the narrative; that matrix is the table.

---

## 0. Title · Date · Methodology

### 0.1 What this document is

This is an **aggregation**, not a fresh derivation. The Strategic Canonicalization program produced an anchor spine (`_ANCHOR_DECISIONS_SPINE.md`, A0–A9) and nine domain deliverables. Each fixed the **Strategic Winner** for its slice with code-anchored evidence, a classification (CANONICAL/TRANSITIONAL/LEGACY/DEAD/FROZEN), a wave, and per-decision IDs. This master plan reads all of them and produces the **single strategic-winner ledger for all 32 domains**, resolving each to: **Current Winner** (what is de-facto live today), **Strategic Winner** (the canonical target that survives at 10k India merchants), **Migration Target** (the path), **Legacy Systems** (superseded — delete-after-migration), and **Dead Systems** (no value — SAFE_DELETE).

Where a domain was owned by a dedicated sibling deliverable (Identity, Auth, Authorization, Sessions, Consent, Tenant Isolation, Payments, Ledger, Settlement, Reconciliation, Theme Runtime/Engine/Editor, Storefront, Merchant OS, Mobile, UI/UX, Billing-subscriptions, Infrastructure, Deployments), the winner is **pulled verbatim** from that doc and its decision IDs are cited. Where a domain was *not* deeply covered by a sibling (Orders, Checkout, Cart, Inventory, Discounts, **Shipping, GST, Customers, Analytics, Notifications, WhatsApp**), the winner is **derived** from `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (§3 module list, §7 ledger/single-writer, §8 money-in/out, §11 WhatsApp, §15 risk register, §16 roadmap) + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` + the forensic master + the anchor spine — **kept consistent with the sibling calls**, never invented.

### 0.2 Authoritative inputs (precedence order)

1. `_ANCHOR_DECISIONS_SPINE.md` — **A0–A9**, the load-bearing winner calls. This is the skeleton; every verdict below traces to it.
2. The nine sibling deliverables in `STRATEGIC_CANONICALIZATION_2026_06_10/`:
   - `SHOPIFY_ALIGNMENT_REPORT.md` (SHOP-001…021; ALIGN/DIVERGE/LEAPFROG verdicts + parity scorecard)
   - `IDENTITY_MIGRATION_MASTER_PLAN.md` (IDN-001…029; D-01…D-13; the four-impl collapse + token re-key)
   - `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` (MNY via PAY-001…032 / DB-002…034; the SSOT-ledger + adapter map)
   - `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` (TEN via FND-001…027 / DB-004…030; the three-layer fail-closed stack)
   - `THEME_MIGRATION_MASTER_PLAN.md` (THEME-C / DEC-1…10; React→Liquid, gated)
   - `UI_UX_UNIFICATION_MASTER_PLAN.md` (UIUX-001…033 / MOB-001…022; one token source + one shell)
   - `LEGACY_ERADICATION_REGISTER.md` (LEG-001…078; the loser ledger)
   - `SAFE_DELETION_PLAN.md` (DEL-0…078; gated removal)
   - `PLATFORM_SIMPLIFICATION_PLAN.md` (PLT-001…018 / TOPO-001…041; the four-realities collapse + governance retarget)
3. `FORENSIC_MASTER_2026_06_10/` — `000_MASTER_INDEX.md` (the four questions; 291 issues / 9 S0) + `TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291).
4. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` — the constitution (the destination).

### 0.3 The decision rule (inherited, applied literally)

> The Strategic Winner is the implementation that should **still exist at 10,000 India merchants** — not the oldest, the most complete, or the easiest. LetBuyy has **zero production merchants and zero legacy burden**, so we move directly to the intended architecture and preserve nothing for its own sake.

This is the rule that makes the hard calls clean: it crowns the **canonical double-entry ledger** over the busier legacy capture path, **Liquid** over the more-complete React renderer, **identity-platform** over the more-load-bearing gateway auth, and **RLS+GUC** over the app-only tenant guard — in every case the *less complete* thing wins because it is the one that scales and supports the ecosystem.

### 0.4 Classification legend (verbatim from the spine)

| Class | Meaning |
|---|---|
| **CANONICAL** | The winner — build/finish it. It is what exists at 10k merchants. |
| **TRANSITIONAL** | Real today, kept only until the winner lands. A managed bridge. |
| **LEGACY** | Superseded; freeze, then delete after migration proves zero drift. |
| **DEAD** | No value or actively dangerous; SAFE_DELETE / remove now. |
| **FROZEN** | Rejected-for-envelope but keep an empty seam; reconsider at a named trigger (≈5k merchants + developer/theme-author demand). |

### 0.5 Wave model (the cross-cutting sequencing law, A0)

| Wave | Theme | What ships |
|---|---|---|
| **0** | Deploy meta-blocker + S0 security | Merge `stepup/main`→`main` (30-behind); commit/deploy the `/api/auth/switch` fix; drop the 6 PUBLIC RLS leaks + anon-writable super-admin allowlist. Nothing else matters if data leaks or nothing deploys. |
| **1** | Money-correctness for live keys | Ledger every capture/refund/COD; `commission_bps=0`; razorpayx→PA-split; real crypto step-up; GUC-from-param fix; service_role→RLS-subject connection (tenancy backbone). |
| **2** | Tenancy + architecture true-up + governance retarget | FORCE+GUC on all 261 tenant tables; collapse the four identity impls; token re-key to asymmetric; SAFE_DELETE the dead packages; retarget the 181 validators to V1; regenerate AGENTS.md; de-deploy app-marketplace/developer-portal; domain → letbuyy.com. |
| **3** | Product-completeness for beta | Hosted `checkout.letbuyy.com`; Shipping (Shiprocket); GST place-of-supply + immutable invoice; Notifications router; WhatsApp order-lifecycle + COD-confirm; consolidate ops consoles; mobile-bff composites; mobile release signing. |
| **4** | Theme-Liquid + perf hardening | Liquid becomes the default renderer (per-theme + canary); dynamic sources + theme-blocks; consent ledger (DPDP); MFA. |
| **5–6** | Differentiate + schema canonicalization | Seed 5–10 first-party themes; bigint money cutover; `store_id`/`site_id` + `users`/`users_custom` normalization; long-tail dead-table drops. |
| **7–8** | Ecosystem readiness (gated) | OIDC provider; WebAuthn passkeys; 3rd-party theme/app authoring — all demand-gated at ≈5k merchants. |

---

## 1. Executive Verdict — the canonical LetBuyy in 6 sentences

**LetBuyy's canonical end-state is a single modular-monolith (`api-gateway`) plus four satellites (`queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`) over one RLS-isolated Postgres on Cloudflare + Vercel, governed by one constitution (V1 + Freeze) and one validator suite that enforces it — not the 9-app/CQRS/multi-region end-state the platform drifted into and still certifies.** Money is one append-only double-entry ledger as the sole source of truth with balance always *derived*, every capture/refund/COD/tender posting through it in `bigint` paise, money-out via a licensed PA-split (Razorpay Route / Cashfree — LetBuyy never custodies), 0% transaction fee permanent, and reconciliation to zero-break-or-suspense. Identity is `identity-platform` as the **sole asymmetric token issuer** for all three realms (merchant/staff, buyer/customer, platform-operator) — passwordless buyer OTP, OAuth2/PKCE, a DPDP consent ledger, and a deferred-but-honest OIDC provider — with every other service verify-only, collapsing the four parallel auth implementations into one. Tenancy is fail-closed and layered — RLS `ENABLE`+`FORCE` + a per-transaction tenant GUC set from validated JWT claims as the **load-bearing DB backstop**, the app-layer query-lint guard + ownership checks kept permanently as the outer defense-in-depth, and the gateway demoted off blanket `service_role`. Commerce is server-authoritative throughout — one `create_checkout_order` RPC, server cart, reserve→commit inventory, the typed 3-class discount engine, GST place-of-supply with immutable invoices, Shiprocket-real shipping behind a carrier adapter, a WhatsApp-first notifications router — fronted by a Liquid-first Online-Store-2.0 theme platform (the ecosystem-capable winner over the more-complete React renderer) and a hosted `checkout.letbuyy.com` origin, with the merchant OS (control-plane + Flutter app) operator-first and the design system collapsed onto one token source and one app shell. Everything Shopify-end-state — the Wasm checkout-functions runtime, the 3rd-party app marketplace, CQRS/saga/multi-region governance, headless Hydrogen, the reserved services — is **rejected-for-envelope and kept only as an empty seam**, deleted now where it is pure dead weight (the ~13.3k-LOC CQRS package cluster, the ~15.3k-LOC abandoned Firebase backend, ~37 product-dead tables, ~36 fiction validators); the entire program is therefore **deletion and completion, not imitation** — the hard core V1 asked for is largely built, hidden behind a green governance gate, one merge / one default-number / one connection-role / one feature-flip away from being real.

---

## 2. The Master Strategic-Winner Table (all 32 domains)

> Columns: Domain · Current Winner (de-facto live) · Strategic Winner (canonical target) · Migration Target (the path) · Legacy (delete-after-migration) · Dead (SAFE_DELETE / remove now) · Classification (of the strategic winner) · Wave · Source-doc IDs.
> Reading note: "Classification" is the class of the **strategic winner**; the legacy/dead columns carry their own classes. Reserved services and the rejected-end-state machinery are **FROZEN** (empty seam) unless they are pure dead weight, which is **DEAD**.

### 2.1 Identity cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Identity** | 4 parallel impls: identity-platform lib + gateway `routes/auth.ts` + identity-foundation shadow + Supabase `/auth/*` | **`identity-platform` = sole issuer for all 3 realms** | Collapse 4→1; add default-deny `middleware.ts` | gateway auth-mint; Supabase `/auth/*` | identity-foundation shadow stack | **CANONICAL** | 0→7 | A1; IDN-005; LEG-024…030; SHOP-001 |
| 2 | **Authentication** | bcrypt-12 merchant pw + CSPRNG OTP + Turnstile, smeared across 4 impls | **identity-platform login (merchant pw + passwordless buyer OTP) + Turnstile fail-closed** | Route all sign-in/up/OTP/reset through identity-platform | second password-reset pipeline (Supabase) | `/api/auth/switch` takeover path (S0) | **CANONICAL** | 0→3 | A1; IDN-002; D-01; LEG-026/028; ISSUE-001 |
| 3 | **Authorization (RBAC)** | DB-backed `employee_permissions` scopes + dual-control (ops); coarse merchant role; `user_metadata.role` client-writable | **Default-deny RBAC; role only from `app_metadata`/DB; claims→GUC validated** | Drop `user_metadata` fallback + `['owner']` default; lint-enforce | client-writable role channel (Supabase) | anon-writable `super_admin_allowlist` policy (S0) | **CANONICAL** | 2→4 | A1/A2; IDN-014; AUTH-003/004; FND-005; ISSUE-003 |
| 4 | **Sessions** | 5 live impls + 1 dead v2 across 3 realms; gateway `sessions` table authoritative for merchant (rotating/reuse-detecting) | **One `identity-platform` session service, single revocation authority over all 3 realms** | Consolidate; opaque DB token (merchant), signed (buyer/ops); per-app hi-trust scoping | per-app hand-rolled session libs (×4); `routes/auth.ts` mint authority | `sessions_v2` / `session-services.ts` v2 / `session-core` ifaces | **CANONICAL** | 3 | A1; IDN-006/IDN-023; LEG-030/053; SESSION_FORENSICS |
| 5 | **MFA** | TOTP plumbing exists (`enforceMerchantMfaIfEnrolled`); ops MFA real; merchant enrollment absent | **Step-up TOTP for all realms; first-class merchant enrollment + recovery codes; `TOTP_ENCRYPTION_KEY` boot-required** | Build merchant TOTP UI; monitor `MFA_UNAVAILABLE` | — | — | **CANONICAL (extend)** | 4(/6) | A1; IDN-022; D-11; AUTH-023 |
| 6 | **Passkeys** | `FEATURE_PASSKEY` flag with **zero consumers** | **identity-platform WebAuthn (passkeys), on the asymmetric kernel — DEFERRED, demand-gated** | Build after issuer+session+MFA land; flip flag per cohort | — | (the dormant flag stays a seam) | **CANONICAL but DEFERRED** | 8 | A1; IDN-027; D-12; SHOP §5 |
| 7 | **Consent (DPDP)** | **Nobody** — OIDC consent route 501s; no consent ledger | **identity-platform append-only DPDP consent ledger + gateway DSR export/erasure; fail-closed; reused by WhatsApp** | Build the ledger (P1); gate WhatsApp/marketing/analytics on it | — | — | **ABSENT → CANONICAL** | 4(/5–6) | A1; IDN-021; D-10; V1 §3; R8 |

### 2.2 Tenancy cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 8 | **Tenant Isolation** | App-layer query-lint guard ONLY; gateway connects as blanket `service_role` (RLS bypassed); GUC never set; ~41/261 FORCE | **3-layer fail-closed: app-guard + ownership + RLS `ENABLE`+`FORCE`+per-tx GUC on all 261 tables; gateway off blanket service_role** | service_role→`app_tenant` RLS-subject pooled connection w/ `SET LOCAL app.site_id`; FORCE+GUC backfill | `store_id`≡`site_id` dual key; `users`/`users_custom` dual; `post_settlement_ledger_transaction` GUC-from-param | 6 `USING(true)`→PUBLIC policies; anon-writable `super_admin_allowlist` (S0) | **CANONICAL** | 0→2(→4) | A2; TEN §1; FND-001…009; DB-004; ISSUE-004…009 |

### 2.3 Money cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 9 | **Payments** | Legacy `confirm_order_payment_with_ledger` capture (posts NO ledger); money-in on merchant's own Razorpay (real) | **Single capture adapter → posts canonical ledger; money-in MoR-on-own-Razorpay; one `payments` row** | Ledger the capture (debit `pa_clearing`/credit `merchant_payable`); harden verify (capture+amount+replay) | `payment_transactions` dual row; legacy capture RPC (→adapter) | forgeable step-up (string-length check) | **CANONICAL** | 1 | A3; MNY §2/§3; PAY-001/018/022; LEG-031/040/054; ISSUE-010/012 |
| 10 | **Ledger** | Canonical 8-account append-only double-entry kernel (139/151/160) — built, partly un-fed; 4 compat "ledger" tables + mutable balances also live | **The canonical double-entry ledger = the SINGLE money source of truth; balance always derived; bigint paise; trigger AND `REVOKE`** | Make every path post to it; compat tables → projections/adapters; add REVOKE + RESTRICT FKs + in-RPC tenant | `wallet_ledger_entries` + gift-card/store-credit/partner-payout compat ledgers; mutable balances; int32/numeric money cols | `gift_cards.balance` duplicate; GUC-from-param behavior | **CANONICAL** | 1(→5) | A3; MNY §2; PAY-003/009/027; DB-002/003/010; LEG-034…038/043 |
| 11 | **Settlement** | Settlement ingest posts canonical when balanced; money-out hardcoded `razorpayx` self-custody (R-6 breach) | **PA-split mirror (Route/Cashfree) — LetBuyy never custodies; settlement = the single writer; gated `claim_payout_statement_release`** | Switch rail to split-instruction; assert split product; derive `no_custody` from rail | — | `razorpayx` self-custody rail; double commission/payout fee duplication | **CANONICAL** | 1 | A3; MNY §2/§3; PAY-013/014; LEG-039; ISSUE-014 |
| 12 | **Reconciliation** | `money_ledger_site_reconciliations` + `recon_breaks` with **no auto-plug** (the honesty gate — real) | **Reconcile to zero-break-or-explained-suspense; reconciliation harness ties book to provider reality; maker-checker+step-up to resolve** | Fund `pa_clearing` via ledgered capture so variance→0; signed `recon_breaks`; add post-transfer recon | — | — | **CANONICAL** | 1(→3) | A3; MNY §2/§4; PAY-005/016/017; settlements.ts |
| 13 | **Billing** | Merchant subscriptions/AutoPay-mock/dunning/plan-gating built (152) — correct Shopify-analog; **3% GMV rake live** | **Subscription billing = the monetization spine; 0% transaction fee permanent; no apps-Billing-API** | Set `commission_bps=0`; standardize usage to bigint; keep subscription billing | `usage_meter_entries` numeric(16,4) representation | 3% GMV rake default + 18% GST-on-fee | **CANONICAL** | 1 | A3; SHOP-004; MNY §2; LEG-042; ISSUE-015 |

### 2.4 Commerce / Checkout cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 14 | **Orders** | Orders created ONLY via `create_checkout_order`/`create_order_with_inventory_reservations` RPC (already canonical); `orders.items` JSONB + relational dual | **The one server-side order RPC; `order_items` relational authoritative; `*_minor bigint` amounts** | Keep RPC; converge JSONB→relational; add bigint amount cols | `orders.items` JSONB; `orders.store_id`; `orders.{subtotal,total}` numeric | — | **CANONICAL** | 3(→5) | A4; SHOP §4; CHK §1; LEG-051/055; DB-003 |
| 15 | **Checkout** | Public `POST /:subdomain/orders` (server-authoritative core, oversell-safe, idempotent); hosted origin MISSING; Wasm extensions in live route | **Hosted `checkout.letbuyy.com` origin + server-authoritative checkout-session state machine in the monolith; cart-bound signed handoff** | Build+deploy the origin; bind signature to cart; gate public order-create behind it | client React cart (→ thin view) | checkout-extensions/app-functions in the payment route (R-11) | **CANONICAL (to-build)** | 3 | A4; SHOP-003; CHK-001/012/015; LEG-011; ISSUE side-doors |
| 16 | **Cart** | Server-authoritative cart on the live path (wins); client React cart (`cart-context.tsx`, `stock:999`) coexists | **Server cart canonical; client cart demoted to a thin view** | Bind cart to the signed checkout URL; demote client cart | client-only React cart | — | **CANONICAL** | 3 | A4; CHK §1; SHOP §4 |
| 17 | **Inventory** | One reserve→commit RPC with `version` optimistic concurrency; sweeper exists as DDL but **never scheduled**; direct-decrement side doors | **Single reserve→commit lifecycle + scheduled stale-reservation sweeper; one path** | Wire the sweeper (queue-workers); unify side doors onto the one path | direct-`available`-decrement side doors; order-edit add-item-without-reservation | — | **CANONICAL** | 3 | A4; CHK-002/003/004/005 |
| 18 | **Discounts** | Scalar single-code RPC live (TRANSITIONAL); typed 3-class `combines_with` engine dormant | **The typed 3-class `combines_with` discount engine** | Activate the typed engine; demote the scalar RPC | scalar single-code RPC | — | **CANONICAL (activate)** | 3 | A4; SHOP §4; CHK §; V1 §3 |
| 19 | **Shipping** | Scaffold labels; pincode/COD serviceability partial; no real carrier wired | **Zones/profiles/rates + pincode+COD serviceability + one real carrier (Shiprocket) for AWB/label/tracking, others mocked behind the adapter** | Wire Shiprocket adapter; tracking ingest; serviceability | scaffold/mock label generators (→ adapter mocks) | — | **CANONICAL (build, P1)** | 3 | V1 §3/§16 (P0 Shiprocket, P1 zones); Freeze; PLT (monolith module) |
| 20 | **GST** | Partial; immutable invoice intent | **Place-of-supply CGST/SGST vs IGST + HSN rates + inclusive/exclusive + immutable GST invoice (IRN/QR via mock IRP) + marketplace TCS** | Build place-of-supply engine + HSN-rate table + immutable invoice | — | — | **CANONICAL (build, P1)** | 3 | V1 §3/§16 (P1 GST); R9; A4 (GST CANONICAL P1) |
| 21 | **Customers** | `store_customers` PII (an anon-leak target today); CRM light | **Tenant-isolated customer records (behind RLS+GUC) + CRM LTV/RFM + dynamic segments (light)** | Close the anon leak (Wave 0); build light CRM segments (P1) | — | `store_customers` `USING(true)` PUBLIC policy (S0, the PII leak) | **CANONICAL** | 0(leak)→3 | A2/A4; FND (PII leak); V1 §3/§16; ISSUE-008 |

### 2.5 Theme cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 22 | **Theme Runtime (renderer)** | React section-registry renderer (live, ~24 sections, ~62% parity); Liquid renderer **shipped but flag-OFF** | **Liquid / portable-theme renderer (OS-2.0-shaped) — the ecosystem winner; React kept as first-party fast-path until Wave 6** | Freeze duplication (W1)→unify foundations (W2)→flip Liquid default per-theme+canary (W4)→React end-state (W6) | React renderer-registry + storefront compose/schema forks (frozen, then delete at parity) | regex output-sanitizer (→ DOMPurify at flip) | **CANONICAL (Liquid)** | 1→4(→6) | A5; THEME DEC-1; SHOP-015; LEG-044…046; THEME-001/002/003 |
| 23 | **Theme Engine** | `@letbuyy/theme-engine` load-bearing for contracts/schema/validation/bundle (60+ importers); its renderer classes orphaned | **theme-engine = CANONICAL contract/schema/validator/bundle source of truth; its renderer un-orphaned to become the live Liquid renderer (W4)** | Route compose+render through the engine; one `ThemeRenderer` interface; 3 schema sources→1 | storefront `RUNTIME_SECTION_SCHEMAS` re-declaration; storefront compose fork; `theme_editor_drafts` legacy draft | — | **CANONICAL (contracts)** | 2→4 | A5; THEME DEC-3/5/9; LEG-045/046/047/048; THEME-005 |
| 24 | **Theme Editor (web + Flutter)** | Dense web editor (no drag-reorder) + at-or-above Flutter editor; **the differentiator** | **Both editors CANONICAL and renderer-agnostic — survive the renderer swap untouched; gain web drag-reorder + lint panel** | Rename "AI hooks"→"Smart defaults" (W1); align mobile slug (W2); add drag-reorder + Issues panel (W4) | — | mislabeled "AI hooks" (deterministic stubs, R-15 — rename not delete) | **CANONICAL (protect)** | 1→4 | A5; THEME DEC-7; SHOP-007; THEME-006/011/016/021 |

### 2.6 Storefront cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 25 | **Storefront Runtime** | `storefront-runtime` (Next.js/Vercel) SSR/RSC via the React registry; 3-tier KV-versioned cache (strong); `runtime-composition` wired in | **ONE runtime = `storefront-runtime` SSR/ISR + Worker Cache hosting the Liquid renderer (W4); no headless Hydrogen/Oxygen split** | Unwire+delete `runtime-composition` (W2); host Liquid in the one runtime (W4); keep the cache | — | `runtime-composition` (DELETE_AFTER unwire); headless tier (FROZEN — not built) | **CANONICAL** | 2→4 | A6; SHOP §3/ID-6; LEG-008; TOPO-005 |

### 2.7 Merchant OS / Mobile cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 26 | **Merchant OS (control plane)** | `merchant-control-plane` web app; operator-first IA partial; honesty badge not systemic; no first-class Money node | **`merchant-control-plane` operator-first (Orders/Money/Customers primary) on one `@letbuyy/ui` + `AppNavigation` shell + systemic provider-mode honesty badge** | Finish IA; adopt `AppNavigation`; add Money node; ship honesty badge | `AdminShell`/`Sidebar`/`HeaderBar` fork; per-app `--lb-*` redefs | — | **CANONICAL** | 3(→4) | A7/A8; SHOP-007; UIUX-009; PLT |
| 27 | **Mobile** | `apps/mobile/merchant-app` (Flutter, best-finished surface, 3.1/5, strong theme editor); de-facto separate design system; debug-keystore release blocker | **`apps/mobile/merchant-app` canonical; ThemeData re-pointed at the generated token bridge; release signing fixed; provider-mode badge** | Fix release signing; re-point ThemeData; delete TD-5 parity catalog; reconcile color classes | TD-5 parity catalog (`merchant_feature_*`, 974 LOC, routed); duplicate `LetbuyyColorTokens`; 4 mobile color classes | debug-keystore release config (→fix); `packages/dart/services` phantom (SAFE_DELETE) | **CANONICAL** | 2→4 | A7/A8; MOB-001…022; LEG-072/073; UIUX-004/005 |

### 2.8 Platform / Deploy cluster

| # | Domain | Current Winner | Strategic Winner | Migration Target | Legacy (→delete after) | Dead (SAFE_DELETE/now) | Class | Wave | Source IDs |
|---|---|---|---|---|---|---|---|---|---|
| 28 | **Analytics** | Read-path analytics in the monolith + rollups; mobile dashboard ~7 serial round-trips (N+1); `analytics-pipeline` service reserved-empty | **Analytics-read module in `api-gateway` + rollup jobs in `queue-workers` + `mobile-bff` composite `/v1/dashboard`; `analytics-pipeline` stays empty** | Build BFF composites (W2-3); interim `Future.wait` the 5 mobile calls (W1); funnel analytics P2 | — | `analytics-pipeline` "production" topology.json fabrication (the service stays FROZEN-empty) | **CANONICAL (in monolith)** | 1→3 | A9; PLT-009/014; PERF-001/002; V1 §10/R-2 |
| 29 | **Notifications** | `notification_logs`; partial; `notification-service` reserved-empty | **WhatsApp-first notifications router in the monolith (→ SMS → email → push) + send jobs in `queue-workers`; multi-ESP failover; preferences/suppression/consent; `notification-service` stays empty** | Build router (P1); transactional email + multi-ESP; abandoned-checkout recovery | — | `notification-service` "production" topology.json fabrication (service stays FROZEN-empty) | **CANONICAL (in monolith)** | 3 | A9; V1 §3/§16 (P1 router); R-2; Freeze |
| 30 | **WhatsApp** | `132_mobile_whatsapp_commerce.sql` foundation; flag-gated; scoped intent | **A scoped `channel=whatsapp` commerce module: order-lifecycle utility messages + COD-confirm (reply-to-confirm) + opt-in consent ledger; BSP/Meta adapter mocked; broadcasts/inbox/in-thread DEFERRED** | Build order-lifecycle + COD-confirm + consent gate (P1); reuse notification router + order events | — | full in-WhatsApp commerce stack as P0/P1 (R-7 — FROZEN, not built) | **CANONICAL (scoped)** | 3 | A1(consent)/A9; V1 §11; R-7; ISSUE COD/RTO |
| 31 | **Infrastructure** | One Supabase Postgres + Cloudflare Workers + Vercel; Hyperdrive bound but used only on storefront read; `letbuyy.store`↔`letbuyy.com` split-brain; k8s/Helm fantasy; 6 reserved services falsely "production" | **One RLS Postgres (ap-south) + Cloudflare (Workers) + Vercel (Next read/admin); Hyperdrive widened as tenancy lands; `letbuyy.com` canonical; reserved services manifest-only** | Migrate domain→letbuyy.com; regenerate `production-topology.json` from the deploy matrix; widen Hyperdrive | `letbuyy.store` literals (143 files); `production-topology.json` fabrication | k8s/Helm fantasy infra; `legacy/firebase` backend (~15.3k LOC) | **CANONICAL** | 0→2 | A0; PLT four-realities; TOPO-006/013/015/019; LEG-065/066/071/077 |
| 32 | **Deployments** | `main` 30 commits behind the fix branch (nothing ships); 9-app Vercel matrix; 3 staging workflows; 181 validators enforcing the rejected end-state | **A pipeline that deploys the integration branch to the V1 8-runtime topology (4 apps + 4 workers + 6 reserved-empty), one staging workflow, a validator suite that enforces V1, one generated AGENTS.md** | Merge `stepup/main`→`main` (W0); collapse staging→1; retarget/delete validators; regenerate AGENTS.md; de-deploy marketplace/dev-portal | duplicate staging workflow; AGENTS.md (regenerate); `app-marketplace`+`developer-portal` deploy entries (FROZEN) | ~36 rejected-architecture validators; `deploy-staging.yml` duplicate | **CANONICAL** | 0→2 | A0; PLT Wave-0/governance-retarget; TOPO-001/002/016/024; LEG-063/067/076; ISSUE-002 |

---

## 3. Per-domain-CLUSTER narrative (the 13 ABR fields at cluster level)

> Fields per cluster: **Current · Strategic · Reasoning · Migration · Validation · Deletion · Rollback · Risk · Complexity · Timeline · Owner · Dependencies · Success Criteria.** Complexity ∈ {S/M/L}; Risk ∈ {Low/Med/High/Critical}. Owners are squads, not people.

### 3.1 Identity cluster (Identity · Authentication · Authorization · Sessions · MFA · Passkeys · Consent)

- **Current State:** A competent but *fragmented* auth surface — bcrypt-12 passwords, CSPRNG single-use OTP, rotating reuse-detecting server sessions, real app-OAuth2-S256-PKCE, fail-closed Turnstile — smeared across **four parallel implementations** (identity-platform lib + gateway `routes/auth.ts` 1,441 LOC + gateway "identity-foundation" shadow stack + legacy Supabase `/auth/*`), all under a **single shared HS256 `AUTH_SECRET`** that makes the verification key the forgery key across seven trust domains, behind an OIDC provider that is a **501 skeleton serving a literal-string JWKS**. Two live holes: the `/api/auth/switch` account-takeover (fix uncommitted on every deployable branch) and the anon-writable `super_admin_allowlist`. (AUTH-001…025; IDN-001…029.)
- **Strategic State:** **`identity-platform` is the SOLE asymmetric token issuer** for all three realms (merchant/staff, buyer/customer, platform-operator) — owning OTP, login, sessions, cookies, refresh rotation, the DPDP consent ledger, MFA, passkeys, and the OIDC provider — with every other service **verify-only** with the published public key, per-audience claims. Buyer realm is passwordless OTP with host-only cookies (a leapfrog: no password/Multipass legacy). OIDC and passkeys are **canonical-but-deferred**.
- **Reasoning:** A1 + SHOP §5. The hard parts are built; the defect is *count* (four impls) and *signing* (shared symmetric). One issuer + asymmetric keys means a leaked verification key is harmless and unblocks the real OIDC provider. The decision rule crowns the *consolidated* design over the more-load-bearing gateway path.
- **Migration Plan:** W0 fix the switch S0 + allowlist S0. W1 start the `AUTH_SECRET` per-domain split (mandatory/fail-closed). W2 dual-verify cutover to EdDSA/Ed25519 (ES256 fallback) — D0 key-provision → D1 dual-issue → D2 drain (cap `lb_accounts` TTL to ≤90d first) → D3 drop HS256 → D4 rotation proof; deprecate Supabase `/auth/*`. W3 consolidate sessions/cookies/logout under identity-platform; delete the shadow stack; reduce gateway to verify-only; default-deny middleware. W4 consent ledger + MFA. W7-8 OIDC provider + passkeys.
- **Validation Plan:** Security suite (no unauthenticated takeover; allowlist anon-write blocked; SSTI/forgery negative); dual-verify telemetry shows zero legacy-HS256 verifications before D3; cross-realm cookie-bleed test stays green; realm `aud`-pinning test; MFA enroll→login→recovery; OIDC conformance (deferred).
- **Deletion Plan:** `DELETE_AFTER_MIGRATION` for gateway auth-mint, Supabase `/auth/*`, second reset pipeline, per-app session libs, the 6 identity micro-packages (fold into `auth-core`); **SAFE_DELETE** the identity-foundation shadow stack once gateway is verify-only; remove `MOCK_JWKS` (serve 404) in D0. Gated on identity-platform serving live (V-SMOKE).
- **Rollback Plan:** Token cutover is dual-verify — D0/D1/D2 revert is a config change with no token invalidation; **D3 rollback = re-widen the verifier to accept HS256 (revert the pin), never revert the issuer** (verifier-pin and issuer-alg deploy as independently-revertible changes; rollback drill mandatory before D3). Key compromise → rotate `kid` (better than the symmetric world).
- **Risk Level:** Critical (two live S0s; a cross-service contract change) — managed to Low by gating + dual-verify.
- **Complexity:** L (token re-key + four-impl collapse) with S items (the two S0 fixes).
- **Timeline:** Waves 0→8 (S0s W0; token+collapse W2-3; consent+MFA W4; OIDC W7; passkeys W8).
- **Owner:** Identity squad (lead) + Platform (gateway verify-only) + Security.
- **Dependencies:** Deploy meta-blocker (W0); KMS/key service (W2) — also serves MFA + OIDC; feeds A2 tenancy (claims→GUC).
- **Success Criteria:** One issuer; no HS256-accept path; zero unauthenticated account access; consent ledger live and WhatsApp gated on it; OIDC/passkeys deferred-honest (no placeholder JWKS).

### 3.2 Money cluster (Payments · Ledger · Settlement · Reconciliation · Billing)

- **Current State:** A genuinely Stripe-grade double-entry kernel (139/151/160: `ledger_transactions`/`ledger_entries`, balanced+idempotent+append-only-by-trigger `post_ledger_transaction`, ledger-gated `claim_payout_statement_release`, `recon_breaks` with no auto-plug) — but **un-fed**: the legacy capture path every buyer hits posts **zero** ledger entries despite its name, refunds and COD are likewise un-ledgered, money lives in **four representations** (bigint-paise/int32-paise/numeric-rupee/numeric(16,4)), money-out is hardcoded to the **self-custody `razorpayx` rail** (R-6 breach) while metadata falsely stamps `no_custody:true`, the payout second-factor is a **forgeable string-length check**, and a live **3% GMV rake** contradicts the 0%-fee promise. (PAY-001…032; DB-002…034.)
- **Strategic State:** **The canonical append-only double-entry ledger is the single money source of truth**, balance always *derived*, every capture/refund/COD/tender posting through it in **bigint paise**, **one writer** (settlement module), money-out via **PA-split (Route/Cashfree) — never custody**, **0% transaction fee permanent**, reconciliation to **zero-break-or-explained-suspense**, append-only enforced by **trigger AND `REVOKE`**, and a second factor that is **real cryptography**.
- **Reasoning:** A3. The legacy paths are complete and live — exactly the trap the decision rule warns against. Only the ledger models COD cash-in-transit, reserves, reversing entries, and a balanced settlement, and only it reconciles to zero-break at 10k merchants. Make the volume paths *feed* the survivor; do not crown the busy path. Money monetizes via subscription, not the sale.
- **Migration Plan:** W1 — ledger the capture (debit `pa_clearing`/credit `merchant_payable`) idempotently; ledger refunds + COD; `commission_bps=0`; razorpayx→PA-split (assert split product); replace step-up with HMAC/stored-challenge; stop GUC-from-param (derive tenant in-RPC); make the outbox a same-transaction write; build the compensation executor. W5 — bigint money cutover (expand/contract + zero-loss backfill); compat ledgers → projections/adapters; mutable balances → derived.
- **Validation Plan:** **The reconciliation harness is the gate** — replay PSP + COD fixtures and assert the book ties to provider reality (zero break or aged-and-explained suspense). Per-transaction Σdebit=Σcredit; idempotent replay; no numeric/int32 on any money path post-cutover; payout double-release blocked under `FOR UPDATE`; step-up rejects forged strings. **No money system is deleted until the harness proves zero drift on the path it replaces.**
- **Deletion Plan:** `DELETE_AFTER_MIGRATION` for the legacy un-ledgered RPCs (→adapters), the 4 compat ledger tables, mutable balances, int32/numeric money columns, `payment_transactions` dual row — each gated on the canonical winner serving + zero-drift proof. **DEAD-now:** the razorpayx branch, the forgeable step-up, the 3% rake default, the GST-on-fee, the `gift_cards.balance` duplicate, the GUC-from-param behavior, the double fee duplication, the `AUTH_SECRET` internal-secret fallback.
- **Rollback Plan:** Money changes ship behind the deploy fix on a branch; expand/contract migrations are reversible (DOWN restores the old column); the ledger postings are additive (a wrong adapter is corrected by a reversing entry, never a mutation — append-only). razorpayx→PA-split is feature-gated until live keys are present (`[HUMAN-REQUIRED]`).
- **Risk Level:** Critical (real money) — but *latent* today because live PSP/Route keys are human-gated; a hard go-live blocker.
- **Complexity:** L (ledger wiring + bigint cutover) with S items (commission=0, rail switch).
- **Timeline:** Waves 1 (correctness) → 5 (representation cutover). Money-correctness is the highest non-security priority.
- **Owner:** Payments/Money squad (lead) + Platform (RPC/migrations) + Security (step-up).
- **Dependencies:** Deploy meta-blocker (W0); the in-RPC tenant derivation couples to A2 tenancy (W1); KMS for the step-up secret.
- **Success Criteria:** One ledger; one representation (bigint paise); one writer; one rail (PA-split, never custody); `commission_bps=0`; reconciliation zero-break; step-up is real crypto; `recon_breaks` resolved only via maker-checker+step-up.

### 3.3 Tenancy cluster (Tenant Isolation)

- **Current State:** Production runs **single-layer** — the app-layer query-lint guard (`createTenantGuardedSupabaseClient`) is the de-facto sole control; the gateway connects as blanket Supabase `service_role` which **bypasses RLS** (migration 107 header), the tenant GUC is **never set** on any live path (the data path is stateless PostgREST over HTTP), so `FORCE`-RLS + `current_site_id()` policies are **decorative**; only ~41/261 tenant tables carry FORCE+GUC; and **6 baseline policies are `USING(true)` to PUBLIC** plus an anon-writable `super_admin_allowlist` (continuously-exploitable S0 data+privilege leak). (FND-001…027; DB-004/009/011/014/030.)
- **Strategic State:** **Three-layer fail-closed** — L1 app-layer query-lint guard (catches "forgot to scope") + L2 ownership resolution (proves the `site_id` *value*) + **L3 Postgres RLS `ENABLE`+`FORCE` + per-transaction tenant GUC** set via `SET LOCAL app.site_id` from validated JWT claims on **every** one of the 261 tenant tables (unset/wrong GUC ⇒ zero rows). The decisive change: the gateway **stops connecting as blanket `service_role`** — tenant data runs over a pooled transactional connection under an RLS-subject `app_tenant` role; `service_role` is demoted to a narrow, audited, break-glass escape hatch.
- **Reasoning:** A2 + V1 §2.6. Each layer fails differently, so the union is robust; L3 is the only one that is an *unconditional* DB-level deny. Today L3 is decorative — flipping the load-bearing layer to L3 (while keeping L1+L2 permanently as belt-and-suspenders) makes the constitution's words true for the first time.
- **Migration Plan:** W0 — drop/replace the 6 PUBLIC policies + the anon allowlist (before merchant #1). W1 — introduce the `app_tenant` RLS-subject pooled connection that sets the GUC per request; wire `current_site_id()`/`tenantGucSetLocalStatement` to the live path; stop trusting `post_settlement_ledger_transaction`'s param. W2 — FORCE+GUC backfill across all 261 tables (template migration); guard the workers (per-job GUC + payload-vs-FK assertion); AST-based isolation validator scanning all services; REVOKE+RESTRICT on ledger/audit. W3 — default-deny middleware. W4-5 — `store_id`/`site_id` + `users`/`users_custom` normalization.
- **Validation Plan:** The fail-closed proof under a **non-bypass role** (`security-rls-hardening-postgres.test.mjs` / `money-ledger-postgres.test.mjs`: unset GUC ⇒ zero rows); an **anon-key probe** confirms the PUBLIC policies are gone (`\dp public.orders`); a cross-tenant read/write attempt returns zero rows at the DB; the isolation validator fails a test PR adding an unscoped query.
- **Deletion Plan:** **DEAD-now** the 6 PUBLIC policies + anon allowlist. `DELETE_AFTER_MIGRATION` for `store_id`≡`site_id`, `users`/`users_custom`, and the GUC-from-param behavior — gated on the normalization migrations + the RLS-subject connection serving.
- **Rollback Plan:** The service_role→GUC cutover is staged with a per-route fallback (a route can be reverted to the old client during the window); FORCE is added table-by-table behind the connection (a misconfigured table fails *closed*, surfacing immediately, not silently leaking). DOWN migrations restore dropped objects.
- **Risk Level:** Critical (the live data leak; the most consequential migration in the program) — managed by sequencing the leak fix to W0 and staging the connection cutover.
- **Complexity:** L (the connection-role change + 220-table backfill).
- **Timeline:** Waves 0 (leak) → 2 (backbone + breadth) → 4-5 (normalization).
- **Owner:** Security/Database squad (lead) + Platform (gateway connection) + Identity (claims integrity).
- **Dependencies:** Deploy meta-blocker (W0); A1 claims→GUC (the GUC value comes from a validated asymmetric claim); couples to A3 (in-RPC tenant derivation).
- **Success Criteria:** RLS is load-bearing (proven by the non-bypass fail-closed test); zero PUBLIC tenant policies; FORCE+GUC on all 261 tables; gateway off blanket service_role; workers guarded + in CI.

### 3.4 Commerce / Checkout cluster (Orders · Checkout · Cart · Inventory · Discounts · Shipping · GST · Customers)

- **Current State:** The money-core is materially stronger than the governance suggests — cart **is** server-authoritative, orders are created **only** via the `create_checkout_order` RPC (server-priced, oversell-safe under `FOR UPDATE`, idempotent at three layers), and branding is data-only (no SSTI). But the **hosted `checkout.letbuyy.com` origin does not exist** (signed URLs are dead links; the live path is a public `POST /:subdomain/orders`), the signed URL **does not bind cart contents**, the public order-create **decrements stock before payment**, refunds/COD are un-ledgered, a **Wasm checkout-functions runtime executes in the live payment route** (R-11), the typed discount engine is dormant, **shipping has no real carrier**, **GST place-of-supply is partial**, and `store_customers` PII is one of the **anon-leak** targets. (CHK-001…024; V1 §3/§16.)
- **Strategic State:** **Server-authoritative end-to-end** — the one order RPC, server cart (client cart demoted to a thin view), single reserve→commit inventory with a scheduled sweeper, the typed 3-class `combines_with` discount engine, **GST place-of-supply + HSN + immutable invoice + TCS**, **zones/rates + pincode+COD serviceability + Shiprocket-real shipping** (others mocked behind the adapter), tenant-isolated customers + light CRM — all fronted by a **hosted `checkout.letbuyy.com` origin** consuming a **cart-bound signed handoff**, with **no checkout extensibility** (seam only).
- **Reasoning:** A4 + SHOP §4. The hard part (server authority) is done right; the remaining work is *completion* (hosted origin, cart-bind) + *deletion* (the Wasm runtime, the side doors). Shipping/GST/Customers are derived from V1 §3 as monolith modules built to P1, consistent with "rent rails, build commerce." `checkout.liquid`-free is the cleanest leapfrog in the platform.
- **Migration Plan:** W0 close the `store_customers` PII leak (tenancy track). W3 — build+deploy `checkout.letbuyy.com`; bind the signature to the cart (hash of sorted line items + coupons + subtotal in the HMAC) and gate public order-create behind it (reserve-with-TTL, not hard-decrement); wire the stale-reservation sweeper; activate the typed discount engine; build the GST place-of-supply engine + HSN-rate table + immutable invoice; wire Shiprocket (AWB/label/tracking) + serviceability; build light CRM segments; ledger refunds/COD (money track). W5 — converge `orders.items` JSONB→relational, add bigint amount columns.
- **Validation Plan:** Order forgery blocked (no price field; RPC reads DB price); oversell closed under `FOR UPDATE`; the signed URL rejects a mutated cart; public order-create rejects an unsigned request; reservation sweeper releases stale holds; discount `combines_with` matrix correct; GST place-of-supply (CGST/SGST vs IGST) + immutable invoice (no post-issue mutation); Shiprocket AWB/tracking round-trip; customer queries return zero cross-tenant rows.
- **Deletion Plan:** **DEAD-now** the checkout-extensions/app-functions runtime in the payment route (→ documented seam) and the `store_customers` PUBLIC policy. `DELETE_AFTER_MIGRATION` for the client React cart (→thin view), the direct-decrement side doors, the scalar discount RPC, the scaffold label generators, `orders.items` JSONB / `orders.store_id` — each gated on its winner serving.
- **Rollback Plan:** The hosted origin is greenfield (no rollback of a migration — just deploy/undeploy); the cart-bind is additive (the old unsigned path stays during the window then is gated off); the sweeper is a job that can be paused; GST/Shipping land behind feature flags with the mock adapter as the fallback.
- **Risk Level:** High (the live side doors + the missing origin) — managed by completion + the deletion of the Wasm path.
- **Complexity:** L (hosted origin + GST + Shipping are each M-L).
- **Timeline:** Wave 0 (PII leak) → Wave 3 (the product-completeness bulk) → Wave 5 (representation converge).
- **Owner:** Commerce/Checkout squad (lead) + Payments (refund/COD ledgering) + Security (signed handoff) + Platform (RPC/migrations).
- **Dependencies:** Deploy meta-blocker (W0); RLS+GUC (W1, for customers); the canonical ledger (W1, for refund/COD); the consent ledger (for CRM/marketing).
- **Success Criteria:** One hosted server-authoritative checkout origin; cart-bound signature; no public pre-payment order door; one inventory path with a live sweeper; typed discount engine live; GST place-of-supply + immutable invoice; Shiprocket-real shipping; customers tenant-isolated; zero third-party code in the live checkout.

### 3.5 Theme cluster (Theme Runtime · Theme Engine · Theme Editor)

- **Current State:** TWO renderer families — **live = React-component-per-section** (~24 sections, ~62% OS-2.0 parity, the only renderer that runs), **dormant = sandboxed Liquid** (a genuine data-only sandbox, but `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) — with **three schema sources**, **two draft systems written in the same call**, two compose paths, a near-orphaned `theme-engine` renderer, a marketplace with real machinery over a **one-theme shelf**, and a dense web editor (no drag-reorder) + an at-or-above Flutter editor (the differentiator). (THEME-001…022; DEC-1…10.)
- **Strategic State:** **Liquid / portable-theme (OS-2.0-shaped) is the canonical renderer** — the only architecture that supports a theme marketplace, third-party authors, portable themes, and app-blocks; **React is kept as a first-party compatibility fast-path** through Wave 5 and deleted-or-frozen at Wave 6 by data. `theme-engine` is CANONICAL for contracts/schema/validation/bundle with its renderer un-orphaned to become the live Liquid renderer. **Both editors are CANONICAL and renderer-agnostic** — protected, and they survive the renderer swap untouched.
- **Reasoning:** A5 — the explicit test of the decision rule. Completeness is *not* the tiebreaker; React-per-section is a first-party-only dead-end no matter how complete it looks. With ~0 merchants and one theme there is no legacy theme corpus to migrate — the migration is cheap, and the absence of `checkout.liquid`/sections-v1 baggage is a leapfrog past the transition Shopify spent 2023–2026 on.
- **Migration Plan:** W1 — **freeze the duplication** (designate ONE seam; CI-ban new React sections and new Liquid capability; rename "AI hooks"→"Smart defaults"). W2 — unify foundations (3 schema sources→1 generated; 2 drafts→1 instance/patch spine; 2 compose→1 engine `composeStorefrontTheme`; fix/remove the 4 placeholder sections + announcementBar; unwire+delete `runtime-composition`). W4 — **flip Liquid default per-theme + canary** behind a `renderer.engine` switch (entry-gate: DOMPurify sanitizer + ~20 Liquid section ports + Security suite green + a screenshot/DOM-diff harness); add dynamic sources + theme-blocks + web drag-reorder + the Issues panel. W5 — author 5–10 first-party themes, seed the catalog. W6 (gated ≈5k merchants + author demand) — open 3rd-party authoring; React end-state decided by perf data.
- **Validation Plan:** Render-parity (screenshot/DOM-diff Liquid≡React per section); **Security suite as a HARD gate** (SSTI/XSS/sandbox-escape — Liquid does not reach a real buyer until green); E2E-editor runs identically on `renderer.engine=react|liquid`; Performance (Liquid p50/p95 within budget — the data that decides the W6 fork); schema parity CI gate.
- **Deletion Plan:** **The React renderer is FROZEN, not deleted, in early waves** (it is the live read path — the directive's explicit "do NOT pick React for completeness" test). `DELETE_AFTER_MIGRATION` at Wave 6 only with the full suite green per-section, else frozen as a documented first-party fast-path. Storefront schema/compose forks and `theme_editor_drafts` delete at W4 once the engine serves; `runtime-composition` SAFE_DELETE at W2 after unwire.
- **Rollback Plan:** The **per-theme `renderer.engine` switch IS the rollback** — flip any theme back to React instantly; the canary contains blast radius to one internal store first (this is why the flip is per-theme + canaried, not a global flag flip).
- **Risk Level:** High (parity drift, sandbox escape at flip) — managed to Low by the per-theme canary, the parity harness, and the Security hard gate.
- **Complexity:** L (the renderer flip + ~20 section ports + dynamic sources + theme-blocks).
- **Timeline:** Theme work is **Wave 1+** (sequenced behind S0/money/tenancy); the flip is a **Wave-4 event**; ecosystem is Wave 6 (gated).
- **Owner:** Theme-Platform squad (lead) + Storefront + Security + Merchant-OS (editors).
- **Dependencies:** Deploy meta-blocker (W0); the tenancy/RLS kernel (W2, theme persistence must be tenant-safe before it is restructured); DOMPurify (W4).
- **Success Criteria:** Liquid is the default renderer; parity+security+perf green; exactly one author-facing renderer; the editor never broke; the catalog is stocked with first-party themes.

### 3.6 Storefront cluster (Storefront Runtime)

- **Current State:** The live storefront is server-rendered RSC reading themes via the React registry; the **3-tier KV-versioned cache is the audited strong point** (keep it); there is **no headless tier** (correct); `runtime-composition` (a rejected/dormant package) is **wired into the storefront page**. (TOPO-005; A6.)
- **Strategic State:** **ONE runtime = `storefront-runtime` (Next.js/Vercel) SSR/ISR + Worker Cache**, hosting the Liquid renderer at target state. **Intentional divergence from Shopify:** no Hydrogen/Oxygen React-storefront split (the envelope has no headless-developer population). Storefront caching stays CANONICAL.
- **Reasoning:** A6 + SHOP §3. Shopify runs two runtimes for two populations LetBuyy does not have; a headless tier is the same class of error as activating the 22 reserved services. One runtime, and it hosts the Liquid winner.
- **Migration Plan:** W2 — unwire then delete `runtime-composition` (it is on the production read path; unwire FIRST). W4 — host the Liquid renderer in the one runtime (couples to the theme flip). Keep the cache untouched.
- **Validation Plan:** Zero importers of `runtime-composition` after unwire (V-IMPORT); store-route smoke (`/`, `/shop`, `/product/[id]`, `/store/[subdomain]`) stays 200; cache-key versioning honored after the renderer swap.
- **Deletion Plan:** `runtime-composition` = DELETE_AFTER_MIGRATION (unwire first, then SAFE_DELETE). The headless tier is **FROZEN** (a written-down deferred seam — not built).
- **Rollback Plan:** Unwiring `runtime-composition` is a revertible code change; the Liquid hosting rides the per-theme renderer switch (instant revert to React).
- **Risk Level:** Low (the cache — the hard part — is already right).
- **Complexity:** S (unwire) + M (host Liquid, shared with the theme flip).
- **Timeline:** Wave 2 (unwire) → Wave 4 (host Liquid).
- **Owner:** Storefront squad + Theme-Platform.
- **Dependencies:** Theme flip (W4); the `runtime-composition` unwire couples to A9 package deletion.
- **Success Criteria:** One storefront render authority; `runtime-composition` gone; cache intact; no headless tier built.

### 3.7 Merchant OS / Mobile cluster (Merchant OS · Mobile · UI/UX)

- **Current State:** `merchant-control-plane` (web, deepest `@letbuyy/ui` adoption, genuinely operator-first IA but **no first-class Money node** and **not yet on `AppNavigation`**) + `apps/mobile/merchant-app` (Flutter, the **best-finished surface**, strong theme editor, but a **de-facto separate design system** — `ThemeData` bypasses the generated token bridge — and a **debug-keystore release blocker**). The design system is fractured into **three token sources, eight hand-rolled navigations (2/9 on the canonical shell), four mobile color classes**, and the provider-mode **honesty badge does not exist** as a component. The mobile **TD-5 parity catalog** (974 LOC, routed) is dead weight. (UIUX-001…033; MOB-001…022; A7/A8.)
- **Strategic State:** `merchant-control-plane` + `apps/mobile/merchant-app` are the canonical merchant surfaces, **operator-first** (Orders/Money/Customers primary), on **one token source** (`@letbuyy/ui`/`tokens.ts` DTCG; the Dart `ui_kit` consumes a *generated bridge* from it) and **one app shell** (`AppNavigation`, rolled 2/9→9/9), with a **systemic provider-mode honesty badge** on every money/fulfillment surface. `mobile-bff` becomes a **real composite/fan-in BFF** (today a 305-line pass-through). The honesty governance ratchet **blocks** new drift (today it baselines it).
- **Reasoning:** A7/A8. Operator-first IA + a Polaris-grade token core are load-bearing UX patterns worth copying; LetBuyy has the token core (the hard part) but not the governance + adoption (the part that unifies surfaces). The honesty badge is a V1-specific trust control (a stub must never read as `success`) with no Shopify analog — and it is missing.
- **Migration Plan:** W1 — interim `Future.wait` the 5 mobile analytics calls. W2-3 — fix mobile release signing; re-point `ThemeData` at the generated bridge (extend it to carry type+density); delete the TD-5 parity catalog + `packages/dart/services` phantom; build the `mobile-bff` composites (`/v1/dashboard`). W2-3 — ship the honesty badge component (web + Flutter). W4-5 (Phase E debt) — roll `AppNavigation` 9/9 (merchant first); collapse the schema/draft/color forks; install stylelint into CI; ratchet drift down 10%/release.
- **Validation Plan:** CI ratchet **fails** a new-drift PR (not baselines it); shell-adoption count → 9/9; one token source feeds web + the mobile bridge (CI parity gate); honesty badge renders `mock/sandbox/live` truthfully on every money surface; `flutter analyze` green after TD-5 deletion; the BFF composite kills the N+1 (PERF-001/002). **Floor: no migration may regress accessibility.**
- **Deletion Plan:** **DEAD-now** (SAFE_DELETE) the `packages/dart/services` phantom. `DELETE_AFTER_MIGRATION` for the TD-5 parity catalog (remove route then files), the `AdminShell`/`Sidebar` fork, the duplicate `LetbuyyColorTokens`, the 8 hand-rolled navs, the per-app `--lb-*` redefs — each after its replacement adopts.
- **Rollback Plan:** Shell adoption is per-app (revert one app's layout); the token-bridge re-point is reversible (ThemeData reverts to `AppColors`); the honesty badge is additive.
- **Risk Level:** Low–Med (mostly debt-paydown; the honesty badge is the one go-live-relevant item).
- **Complexity:** M (shell roll + bridge + badge) with L for the full CSS burn-down.
- **Timeline:** Honesty badge + signing + BFF + TD-5 in Waves 2-3 (go-live-relevant); the design-unification bulk is **Phase E / Waves 4-5 — explicitly NOT a go-live blocker**.
- **Owner:** Merchant-OS squad (lead) + Mobile + Design-Systems + Platform (BFF).
- **Dependencies:** Deploy meta-blocker (W0); the honesty badge reads the backend `provider_mode` (couples to A3 money-surface truth); the BFF composite couples to A9 (analytics-in-monolith).
- **Success Criteria:** One token source; one shell 9/9; honesty badge systemic; mobile releases signed; `mobile-bff` is a real composite; the ratchet blocks new drift; TD-5 gone.

### 3.8 Platform / Deploy cluster (Infrastructure · Deployments)

- **Current State:** **Four mutually-contradictory definitions of the platform**, and the only machine-enforced one is the rejected architecture: reality (a) ships a **13-runtime estate** (4 Workers + 9 Vercel apps including app-marketplace + developer-portal + two redundant ops consoles); reality (b) is a **181-validator gate + AGENTS.md** that *requires* the 9 apps and CQRS/saga/multi-region certification and **fabricates** the empty reserved services as `environment:"production"` with a Helm chart no pipeline applies; reality (c)/(d) specify the **8-runtime** V1 target. The **meta-blocker dwarfs all of it: `main` is 30 commits behind the fix branch**, so nothing — including the S0 fixes — can ship; the live estate runs pre-wave code. Plus domain split-brain (`letbuyy.store`↔`letbuyy.com`), 3 staging workflows, k8s/Helm fantasy, and `legacy/firebase` (~15.3k LOC). (TOPO-001…041; PLT-001…018.)
- **Strategic State:** **One V1 topology** — `api-gateway` (modular monolith) + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one RLS Postgres on Cloudflare (ap-south) + Vercel (Next read/admin apps) + `marketing-site`; **6 reserved services manifest-only**; **one staging workflow**; a **validator suite that enforces V1**; **one generated AGENTS.md** that is the *map of V1*, not a competing authority; `letbuyy.com` canonical; Hyperdrive widened as tenancy lands.
- **Reasoning:** A0/A9. The branch lag is the universal precondition — every other simplification is a no-op until the pipeline can deploy the integration branch. The 181 validators enforce the rejected end-state while 9 S0s ship — governance theater that must be repointed at V1. Reserved services and the rejected machinery are FROZEN (empty seam) where they are seams, DEAD where they are pure weight.
- **Migration Plan:** **W0 META** — commit the S0 fix + test; serialize the working tree (per-agent worktrees + clean-tree gate); execute `MERGE_RUNBOOK.md` (`stepup/main`→`develop`→`main`); collapse staging to one; add a branch-lag guard. W1-2 — **governance retarget** (delete the ~36 fiction validators *with/just-before* the dead packages they assert; retarget the topology validators to V1; KEEP the real-invariant validators; ADD the gaps — migration rollback pairing, deploy↔V1 contract, `letbuyy.store` ban, `commission_bps=0` ratchet); **regenerate AGENTS.md from V1 §6**; re-rank CLAUDE.md (V1 first); de-deploy app-marketplace + developer-portal; demote theme-marketplace; fold one ops console; regenerate `production-topology.json` from the deploy matrix; migrate domain→letbuyy.com; archive k8s/Helm + `legacy/firebase`. W2-3 — `mobile-bff` composites.
- **Validation Plan:** `git rev-list --count main..stepup/main` = 0; `node scripts/validate-governance.mjs` passes the **retargeted** suite (V-GOV after the validator edit, never before — the validator-liveness loop); the deploy matrix equals the V1 §6 production list; a `letbuyy.store` literal in deploy config fails CI; the reserved services are marked `reserved` not `production`; V-SMOKE confirms waves 0–7 code is live.
- **Deletion Plan:** **SAFE_DELETE-now** the ~36 fiction validators (with the dead packages), the duplicate staging workflow, the k8s/Helm fantasy (→archive), `legacy/firebase` (→archive). `DELETE_AFTER_MIGRATION` for AGENTS.md (regenerate), the `letbuyy.store` literals (canonicalize), the runtime-manifest authority prose. **FROZEN:** app-marketplace + developer-portal (de-deploy, keep the OAuth2/PKCE seam); the 6 reserved services (manifest-only).
- **Rollback Plan:** Standard deploy rollback (Cloudflare/Vercel previous deployment); the governance retarget is additive-then-subtractive (retarget validators *before* deleting the code they assert); the domain migration is a single PR with `.store` 301s as the fallback.
- **Risk Level:** High (the meta-blocker gates the entire program) — but the fix is cheap (S) and is the single highest-leverage action.
- **Complexity:** S (the merge) + M (governance retarget) + M (domain migration).
- **Timeline:** Wave 0 (merge — the keystone) → Wave 2 (governance + topology + domain).
- **Owner:** Platform/Infrastructure squad (lead) + every squad (their wave items must reach prod through this pipeline).
- **Dependencies:** None for W0 (it is the prerequisite for everything else). The governance retarget must precede the topology de-deploys (today deleting the apps/packages *fails CI*).
- **Success Criteria:** `main` caught up; one staging pipeline; the validator suite enforces V1 (not the 9-app/CQRS canon); AGENTS.md is the generated map of V1; the deploy matrix = the V1 8-runtime list; `letbuyy.com` canonical; reserved services empty; the meta-blocker can never silently re-accumulate.

### 3.9 Growth cluster (WhatsApp · Notifications · Analytics · Billing)

> Billing's *money* aspect (the 3% rake → 0%) lives in the Money cluster (§3.2); here Billing means the **subscription/monetization spine**. WhatsApp/Notifications/Analytics are derived from V1 §3/§10/§11 + Freeze as **monolith modules + queue-workers jobs**, with their reserved services staying empty.

- **Current State:** **Analytics** read-path lives in the monolith with rollups, but the mobile dashboard makes ~7 serial round-trips (N+1, PERF-001/002) and `mobile-bff` is a 305-line pass-through; the `analytics-pipeline` service is reserved-empty but **falsely declared `production`** in topology.json. **Notifications** is partial (`notification_logs`); the `notification-service` is reserved-empty but falsely `production`. **WhatsApp** has a `132_mobile_whatsapp_commerce.sql` foundation, flag-gated. **Billing** subscriptions/AutoPay-mock/dunning/plan-gating are built and correct — but a **3% GMV rake** is live (handled in the money track).
- **Strategic State:** **All three capabilities live in `api-gateway` (modules) + `queue-workers` (jobs); the reserved services stay manifest-only.** Analytics-read module + rollup jobs + a real `mobile-bff` composite (`/v1/dashboard`). A **WhatsApp-first notifications router** (→ SMS → email → push) with preferences/suppression/consent + multi-ESP failover + abandoned-checkout recovery. A **scoped `channel=whatsapp` commerce module** — order-lifecycle utility messages + COD-confirm (reply-to-confirm) + an opt-in DPDP consent ledger; BSP/Meta adapter mocked; broadcasts/inbox/in-thread checkout **deferred**. **Subscription billing = the monetization spine, 0% transaction fee permanent.**
- **Reasoning:** A9 + V1 §3/§10/§11. Activating the reserved services invents topology no beta merchant would notice (R-2); the capabilities belong in the monolith + workers. WhatsApp is a *commerce channel*, not a notifier, but **scoped** — the durable wedge is order-lifecycle + COD-confirm (two S-sized features), not the full in-WhatsApp stack (R-7, years premature). Billing monetizes via subscription + adjacencies (WhatsApp/AI credits, shipping spread), never the sale.
- **Migration Plan:** W1 — interim `Future.wait` the 5 mobile analytics calls; `commission_bps=0` (money track). W2-3 — build the `mobile-bff` composites; mark the reserved services `reserved` (regenerate topology.json). W3 (P1) — build the notifications router + transactional email + multi-ESP failover + abandoned-checkout recovery; build the WhatsApp order-lifecycle + COD-confirm gated on the consent ledger; COD/RTO heuristic gate + RTO reconciliation. W4 — consent ledger (identity track) is the gate WhatsApp/marketing/analytics consent writes to.
- **Validation Plan:** The BFF composite returns one payload and kills the N+1 (PERF-001/002 closed); the notification router selects WhatsApp→SMS→email→push and respects suppression/consent; **WhatsApp sends are fail-closed on the consent ledger** (ledger off ⇒ hard-stop, never open — DPDP); COD-confirm reply flips the order state; the reserved services are `reserved` not `production` in topology.json.
- **Deletion Plan:** The reserved services (`analytics-pipeline`, `notification-service`, plus `event-bus`, `media-service`, `search-service`, `checkout-runtime`) are **FROZEN-empty** (manifest-only) — their fabricated `production` topology.json entries are SAFE_DELETE (regenerate). The full in-WhatsApp commerce stack is **FROZEN** (R-7 — not built). No code deletion in this cluster beyond the topology fabrication.
- **Rollback Plan:** WhatsApp/Notifications land behind flags with the mock BSP/ESP adapter as the fallback; the consent gate is fail-closed by design (a rollback that disables it must hard-stop sends, never open them); the BFF composite can fall back to the per-call path.
- **Risk Level:** Med (DPDP legal exposure on WhatsApp consent; cold-start on COD/RTO) — managed by the fail-closed consent gate and the heuristic (not ML) RTO lever (R-10).
- **Complexity:** M (router + WhatsApp scoped) with S items (the `Future.wait`, the topology.json regen).
- **Timeline:** Analytics composites W2-3; Notifications + WhatsApp scoped W3 (P1); broadcasts/inbox/in-thread are P2-P3 (deferred).
- **Owner:** Growth squad (lead) + Platform (BFF, topology.json) + Identity (consent ledger) + Payments (COD reconciliation).
- **Dependencies:** Deploy meta-blocker (W0); the consent ledger (A1, W4) gates WhatsApp; the canonical ledger (A3) for COD reconciliation; the BFF composite couples to A7 mobile.
- **Success Criteria:** Capabilities in the monolith + workers; reserved services empty (and honestly `reserved`); a real BFF composite; the notifications router live; WhatsApp scoped to order-lifecycle + COD-confirm + consent (fail-closed); subscription billing the spine at 0% transaction fee.

---

## 4. What Becomes Canonical / What Dies (the summary)

### 4.1 What becomes canonical (the winners — build/finish them)

| Layer | The canonical winner |
|---|---|
| **Topology** | `api-gateway` monolith + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` over one RLS Postgres (Cloudflare ap-south + Vercel). |
| **Identity** | `identity-platform` = sole asymmetric token issuer for all 3 realms; passwordless buyer OTP; OAuth2/PKCE; DPDP consent ledger; OIDC + passkeys deferred-honest. |
| **Tenancy** | RLS `ENABLE`+`FORCE` + per-tx GUC on all 261 tables (load-bearing) + app-guard + ownership (permanent outer); gateway off blanket service_role. |
| **Money** | One append-only double-entry ledger (SSOT), balance derived, bigint paise, one writer (settlement), PA-split (never custody), 0% fee, reconcile to zero-break, real-crypto step-up. |
| **Commerce** | One `create_checkout_order` RPC; server cart; reserve→commit inventory + sweeper; typed 3-class discount engine; GST place-of-supply + immutable invoice + TCS; Shiprocket-real shipping; tenant-isolated customers + light CRM. |
| **Checkout** | Hosted `checkout.letbuyy.com` origin + server-authoritative checkout-session state machine + cart-bound signed handoff; no extensibility. |
| **Theme** | Liquid / portable-theme (OS-2.0) renderer; `theme-engine` for contracts/schema/validation/bundle; both editors (the differentiator). |
| **Storefront** | One `storefront-runtime` SSR/ISR + Worker Cache hosting Liquid; no headless tier. |
| **Merchant OS** | `merchant-control-plane` + Flutter app, operator-first; one token source; one app shell; systemic honesty badge; real `mobile-bff` composites. |
| **Growth** | Analytics-read + rollups in monolith/workers; WhatsApp-first notifications router; scoped WhatsApp commerce (order-lifecycle + COD-confirm + consent); subscription billing the monetization spine. |
| **Platform** | One V1-enforcing validator suite; one generated AGENTS.md (the map of V1); `letbuyy.com` canonical; one staging pipeline; transactional outbox (not an event bus). |

### 4.2 What dies now (DEAD — SAFE_DELETE / remove immediately, no winner required)

- **Security:** the `/api/auth/switch` takeover path (commit the fix); the 6 `USING(true)`→PUBLIC RLS policies; the anon-writable `super_admin_allowlist`.
- **Money:** the `razorpayx` self-custody rail; the forgeable step-up; the 3% GMV rake default + GST-on-fee; the `gift_cards.balance` duplicate; the GUC-from-param ledger behavior; the double commission/payout fee duplication; the `AUTH_SECRET` internal-secret fallback.
- **Checkout:** the Wasm checkout-extensions/app-functions runtime in the live payment route (→ seam).
- **Packages:** the ~13.3k-LOC CQRS/saga/extension cluster (`app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`, `distributed-runtime`); `packages/dart/services` phantom.
- **Governance/infra:** the ~36 rejected-architecture validators; the duplicate staging workflow; the k8s/Helm fantasy (→archive); `legacy/firebase` (~15.3k LOC, →archive); the 6 reserved services' fabricated `production` topology.json entries; ~37 product-dead Postgres tables + 6 superseded theme tables + the duplicate `provider_payment_id` index.
- **Theme:** the regex output-sanitizer (→ DOMPurify at flip); the mislabeled "AI hooks" (rename, R-15).
- **Mobile:** the debug-keystore release config (→ fix).

### 4.3 What dies after migration (LEGACY — delete once the winner serves + zero-drift proof)

- **Identity:** gateway `routes/auth.ts` session-mint; legacy Supabase `/auth/*` + second reset pipeline; per-app session libs (×4); the 6 identity micro-packages; the identity-foundation shadow stack.
- **Money:** the legacy un-ledgered capture/refund/COD RPCs (→adapters); the 4 compat ledger tables; mutable balances (`gift_card_accounts`, `store_credit`, `ai_credits`); int32/numeric money columns; `payment_transactions` dual row.
- **Tenancy:** `store_id`≡`site_id` dual key; `users`/`users_custom` dual; `sessions`/`sessions_v2` dual.
- **Commerce:** the client React cart (→thin view); the direct-decrement inventory side doors; the scalar discount RPC; scaffold label generators; `orders.items` JSONB / `orders.store_id`.
- **Theme:** the storefront schema/compose forks; `theme_editor_drafts`; the React renderer (FROZEN first, deleted at parity W6); `runtime-composition` (unwire then SAFE_DELETE).
- **Mobile/UI:** the TD-5 parity catalog; the `AdminShell`/`Sidebar` fork; the duplicate mobile color classes; the 8 hand-rolled navs; per-app `--lb-*` redefs.
- **Platform:** AGENTS.md (regenerate); the `letbuyy.store` literals (canonicalize); the runtime-manifest authority prose; the non-surviving ops console.

### 4.4 What is frozen (FROZEN — rejected-for-envelope, empty seam, reconsider at a named trigger)

- `app-marketplace` + `developer-portal` (de-deploy; keep the OAuth2/PKCE seam; reconsider at ≈5k merchants + developer demand).
- The 6 reserved services (`checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`) — manifest-only.
- `apps/mobile/shopper-app`, `apps/mobile/operator-app` — reserved.
- The theme app-block / extension seam (kept empty of 3rd-party authors per R-11; 1st-party at W5, 3rd-party gated to W6).
- The headless Hydrogen/Oxygen tier (written-down deferred seam, not built).
- Theme-marketplace catalog (dormant; machinery is CANONICAL); reseller payout + AI-credits-as-tender (P2 capabilities); the partition-shadow seam (kept, mirror disabled).

---

## 5. Cross-domain reconciliation (conflicts found and resolved toward the anchor spine)

The nine sibling deliverables are mutually consistent at the level of every load-bearing call. The items below are **boundary clarifications and one terminology delta**, each resolved toward the anchor spine — not substantive disagreements.

1. **`theme-engine` classification (CANONICAL vs "dormant").** V1 §6 lists `theme-engine` among packages that "stay only as far as the existing theme editor needs," and the Platform doc tags it **"CANONICAL (contracts)"**, while the Theme doc treats its *renderer classes* as currently orphaned/dead-behind-the-flag. **Resolution (toward A5):** the package is **CANONICAL for contracts/schema/validation/bundle** (the editor needs it — 60+ importers), and its **renderer classes are LEGACY-dormant that become the live Liquid renderer at W4** (un-orphaned, not deleted). No conflict — two aspects of one package; the matrix lists it CANONICAL with the renderer-class caveat.

2. **The React renderer: "delete" vs "freeze".** The Legacy Register lists the React renderer-registry as **KEEP_TEMPORARILY (freeze)**; a naive reading of "Liquid wins" might suggest deleting it now. **Resolution (toward A5, the directive's explicit test):** it is **FROZEN, not deleted** in early waves (it is the live read path; "do NOT pick React for completeness" cuts *both* ways — Liquid is the strategic winner, but React is not deleted for completeness either), and the delete-or-freeze fork is a **Wave-6, data-driven** decision. The matrix marks the React renderer LEGACY/TRANSITIONAL-frozen, deleted-or-frozen at W6.

3. **`razorpayx` blast radius (understated by the phase docs).** The forensic master notes the self-custody rail's disbursement is **currently gated off**, so the *immediate* blast radius is smaller than "self-custody live." **Resolution (toward A3):** the *classification* is unchanged — `razorpayx` is **DEAD** (R-6 violation; the rail must be PA-split) — but it is correctly an *architecture* fix, not an active-incident S0, and is sequenced W1 alongside the other money-correctness items (which are latent because live keys are `[HUMAN-REQUIRED]`-gated). The matrix keeps it DEAD.

4. **The two ops consoles (which survives is an ARB decision, not a code fact).** A9 says "consolidate `platform-operations-portal` + `platform-console` into one thin sliver"; the Legacy Register lists **both** as DELETE_AFTER_MIGRATION pending an ARB pick of the survivor. **Resolution (toward A9):** one survives as **CANONICAL (consolidated thin sliver)**, the other is **LEGACY**; the Platform doc tentatively picks `platform-console` as the survivor (it already adopts `AppNavigation`), but the matrix marks this **UNVERIFIED — ARB decision** and does not hard-code which.

5. **Reserved-service status: "production" (governance) vs "reserved-empty" (V1).** The four realities disagree by construction — `production-topology.json` declares the 6 reserved services `environment:"production"`; V1 says manifest-only. **Resolution (toward A0/A9):** they are **FROZEN-empty**, and the topology.json fabrication is **SAFE_DELETE** (regenerate from the deploy matrix). This is the *intended* drift the program exists to collapse, not a doc conflict.

6. **`legacy/` git-tracked count (UNVERIFIED from the workspace mount).** The Legacy Register flags that `git ls-files legacy/` returned empty from the Linux mount (which may not be the git root) while the topology forensic reports 37 git-tracked files. **Resolution:** on-disk content (~15.3k LOC) is confirmed; the classification (SAFE_DELETE → archive) is unchanged; the git-tracked count is marked **UNVERIFIED** (proof: `git ls-files legacy/` from the macOS repo root).

No reconciliation changed a Strategic Winner. Every winner in §2 traces to its sibling doc + the anchor spine.

---

## 6. Cross-reference to the domain deliverables

| Cluster (this doc §3) | Domains | Owning sibling deliverable(s) | Anchor |
|---|---|---|---|
| 3.1 Identity | Identity, Authentication, Authorization, Sessions, MFA, Passkeys, Consent | `IDENTITY_MIGRATION_MASTER_PLAN.md` (+ `SHOPIFY_ALIGNMENT_REPORT.md` §5) | A1 |
| 3.2 Money | Payments, Ledger, Settlement, Reconciliation, Billing | `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` (+ SHOP §8) | A3 |
| 3.3 Tenancy | Tenant Isolation | `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` | A2 |
| 3.4 Commerce/Checkout | Orders, Checkout, Cart, Inventory, Discounts, Shipping, GST, Customers | `SHOPIFY_ALIGNMENT_REPORT.md` §4 (+ V1 §3/§16 for Shipping/GST/Customers, derived) | A4 |
| 3.5 Theme | Theme Runtime, Theme Engine, Theme Editor | `THEME_MIGRATION_MASTER_PLAN.md` (+ SHOP §2) | A5 |
| 3.6 Storefront | Storefront Runtime | `THEME_MIGRATION_MASTER_PLAN.md` §3.11 (+ SHOP §3) | A6 |
| 3.7 Merchant OS/Mobile | Merchant OS, Mobile, (UI/UX) | `UI_UX_UNIFICATION_MASTER_PLAN.md` (+ SHOP §7) | A7/A8 |
| 3.8 Platform/Deploy | Infrastructure, Deployments | `PLATFORM_SIMPLIFICATION_PLAN.md` | A0/A9 |
| 3.9 Growth | WhatsApp, Notifications, Analytics, Billing | V1 §3/§10/§11 + Freeze (derived; consistent with A9), Billing-money via Money doc | A9/A1/A3 |
| (all) Losers | every LEGACY/DEAD/FROZEN row | `LEGACY_ERADICATION_REGISTER.md` + `SAFE_DELETION_PLAN.md` | A0–A9 |

**Traceability:** every winner call in §2 carries its source-doc ID. Forensic anchoring runs through `FORENSIC_MASTER_2026_06_10/TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291) and the per-phase audit IDs (AUTH/PAY/DB/FND/CHK/THEME/TOPO/UIUX/MOB). The denser component-level view, the target diagram, and the platform-wide classification totals are in the companion `CANONICAL_ARCHITECTURE_MATRIX.md`.

*End of Strategic Winners Master Plan. Aggregated from the nine domain deliverables + the anchor spine; evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty, 2026-06-10.*
