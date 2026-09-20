# 17 — Open Decisions & ARB Gates

> **Audience: the Architecture Review Board.** This is the escalation document for the theme /
> storefront / checkout engagement of **2026-08-04**. Every item below is **decision-ready**: one
> row, one vote.
>
> **This document is not law.** It is subordinate to
> `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md`
> (`AUTH-R1`, `PRIME-R1`). Where this summary and the source disagree, **the source wins**.
>
> **Nothing on this docket was changed by this engagement.** Section 4 states exactly what *was*
> authorized and confirms the rest was left untouched.

| Companion | What it owns (do not restate it here) |
|---|---|
| [01-governance-and-invariants.md](01-governance-and-invariants.md) | Which law binds theme work, and the rule→"you may / you may not" translation |
| [03-theme-data-model.md](03-theme-data-model.md) | Tables, columns, indexes, RLS posture of the 32 theme tables |
| [04-theme-installation-lifecycle.md](04-theme-installation-lifecycle.md) | `installTheme` / publish / rollback call graphs |
| [05-rendering-pipeline.md](05-rendering-pipeline.md) | React-vs-Liquid decision chain, sanitizer, fallback layers |
| [06-react-liquid-parity-matrix.md](06-react-liquid-parity-matrix.md) | The 42-section parity matrix and the 22 the React fallback cannot render |
| [09-settings-schema-and-editor.md](09-settings-schema-and-editor.md) | Three settings schemas, the `experienceId` P0, the merchant editor route map |
| [10-shopper-auth-and-account-flows.md](10-shopper-auth-and-account-flows.md) | Shopper routes, both customer-session issuers, Turnstile/rate-limit placement |
| [11-cart-and-checkout-boundary.md](11-cart-and-checkout-boundary.md) | Server cart, the signed handoff implementation, the live order-create door |
| [12-payments-cod-razorpay-gst.md](12-payments-cod-razorpay-gst.md) | `create_checkout_order` signature, ledger posting, Razorpay verification, GST |
| [13-security-and-tenant-isolation.md](13-security-and-tenant-isolation.md) | The cross-tenant handle leak, RLS/FORCE posture, `SET ROLE anon` probes |
| [14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) | The 22/24 governance-failure baseline and how it was measured |

---

## 1. The decision-class framework

### 1.1 Classes (`LETBUYY_CONSTITUTION.md` §11.1, lines 335–339)

| Class | Definition (verbatim scope) | Who may decide |
|---|---|---|
| **A — Constitutional** | Alters an Article (§9), the authority hierarchy (P.3), the scale envelope (§6), the Never-Build List (§10), a Constitutional Rule (§13), **or the canonical winner of a domain** | Constitutional amendment under §14 **+ ARB ratification** (§12). *"No agent, and no engineer acting alone, may decide a Class-A matter."* |
| **B — Operative** | Governed by `AGENTS.md` / the canonical-systems registry, does **not** alter §9/§10/§13 — how a canonical system is implemented, a validator's internal logic, roadmap sequencing, **an `UNVERIFIED` item's resolution** | **ARB review** where it touches a canonical system's contract or a go-live gate; otherwise normal review |
| **C — Implementation** | Routine engineering inside an already-canonical system that conforms to the Constitution and the manual | An agent or engineer alone, provided (a) it conforms to every Article and Rule, (b) builds nothing on the Never-Build List, (c) does not design past the scale envelope, (d) passes the retargeted validator suite |

§11.3 (line 354): *"When in doubt about the class, **treat it as the higher class and escalate.**"*

### 1.2 What an agent MUST escalate (`LETBUYY_CONSTITUTION.md` §11.2, lines 341–350)

| # | Trigger | Fires on this docket |
|---|---|---|
| 1 | Build/activate/design for a Never-Build item (§10) or past the scale envelope (§6) | — |
| 2 | Introduce a **second canonical system** for any domain (ledger, renderer, auth issuer, tenant key, token signer, storefront runtime, token source, ops console) | **D-06**, **D-07** |
| 3 | Change a permanent decision (§9) or a Constitutional Rule (§13) | **D-01**, **D-02**, **D-05** |
| 4 | Promote a generated document to operative authority (ART-21; §12.3) | — |
| 5 | Reopen a frozen capability (ART-22/23) or fill a reserved service (ART-19) | **D-10** |
| 6 | Resolve an `UNVERIFIED` item (§14.4) by silently upgrading it to "fact" | **§3** (whole register) |
| 7 | Deploy, delete a load-bearing system, or **relax a go-live gate** in violation of ART-03/ART-24 | **D-03**, **D-09** |

### 1.3 `AGENT-R15` — the seven agent escalation triggers (`AGENTS.md:372-379`)

| # | Trigger (rule ID) | Fires on this docket |
|---|---|---|
| 1 | Two implementations of one domain exist and DOC 03 does not name the winner (`WIN-R2`) | **D-06** (three active-theme stores), **D-07** (two token shapes) |
| 2 | A change would add a runtime, fill a reserved service, or wire a rejected package (`ARCH-R2/R7`) | **D-10** |
| 3 | A change would expand past the 10k envelope or touch a `NEVER`-list capability (`ENV`, `NEVER`) | — |
| 4 | A rule here appears to conflict with the Constitution (DOC 01) — the Constitution wins; surface the defect (`PRIME-R1`) | **D-08**, **D-09**, **D-11** |
| 5 | A deletion's validation gate cannot be made green, or a "dead" table has unknown live writers (`DEL-R5`) | **D-06** (`store_themes`), **D-12** |
| 6 | Any item still flagged **UNVERIFIED** must be resolved as a *decision* or a genuine live/vendor probe, not assumed (`ARCH-R10`) | **§3** |
| 7 | A money/identity/tenancy change would weaken a fail-closed default or an S0 fix (`SEC-S0`, `PAY`, `IDN`) | **D-01**, **D-02**, **D-03**, **D-04**, **D-05**, **D-07** |

### 1.4 Docket index and class assignment

| ID | Decision | Class | Article / Rule at stake | Severity in discovery |
|---|---|---|---|---|
| **D-01** | Gate the public order-create behind the built ART-14 signed handoff, or ratify the unsigned door | **A** to retain · **B** to gate | ART-14; R-11; `CHK-R3` | P0 |
| **D-02** | Stop pre-payment inventory hard-decrement; release on payment failure | **B** (compliance) · **A** to retain | ART-14 "Forbids"; ART-15; R-11 | P1, `highStakes` |
| **D-03** | Fix GST-to-zero and start issuing GST invoices | **B** (touches a go-live gate) | ART-15; India-first legal exposure | P0 ×2 |
| **D-04** | Post a COD origination entry at confirm | **B** (money path; ARB-gated) | `PAY-R2`; R-5 | P1 |
| **D-05** | Per-merchant Razorpay credentials: wire them, or remove the UI | **A** (changes Merchant-of-Record) | ART-11; `PAY-R4` | P1 |
| **D-06** | Theme-lifecycle mutation contract + which of three active-theme stores is canonical | **A** (names a canonical winner) | ART-17; R-15; `WIN-R2/R4`; ART-08/09 | P0 ×3 |
| **D-07** | Shopper auth: no-JS Turnstile, brute-force throttle, one customer-session token shape | **B** · **A** for the issuer ruling | ART-05; R-14; `IDN-R1/R2`; `SEC-R7` | P0 ×2, P1 |
| **D-08** | `FEATURE_LIQUID`: real kill switch, or formally dormant | **B** | ART-02 (governance-theater); ART-17 | P0 |
| **D-09** | The Liquid canary gate itself — parity harness unwired **and** the React rollback does not work | **B** · **A** to relax the gate | ART-17; `THEME-R6`; `TEST-R6`; R-18 | P1 + P0 (doc 06 §4.2) |
| **D-10** | `services/lcis-api` + 19 `packages/lcis-*` outside ARCH-R2 governance | **A** | ARCH-R1/R2; ART-04; R-16 | P1 |
| **D-11** | The gate driver deletes developer `node_modules` | **B** | ART-02; R-18; `DOC-R5` | P1/P2 |
| **D-12** | Migration 188's fresh-DB no-op: new migration vs seed reordering | **B** | `MIG-R3`; R-23 | P1 |

---

## 2. The ARB docket

### D-01 — The unsigned public order-create vs the built-but-orphaned ART-14 signed handoff

> **Decision required.** *Shall the public `POST /v1/storefront/:subdomain/orders` route be gated
> behind the existing `verifyCheckoutHandoff` cart-bound signature (breaking the current public API
> contract), or shall the unsigned door be ratified as a documented headless/mobile API under an
> ART-14 amendment?*

**Class A** if the unsigned door is retained (it amends ART-14's explicit *Forbids*).
**Class B** if it is gated (implementation of an existing Article, touching a canonical system's
contract and a go-live gate). §11.3 default: escalate as A.

**Rule at stake — verbatim**

`LETBUYY_CONSTITUTION.md:233-237`, ART-14:
> *Forbids.* An unsigned public order-create path. A checkout handoff that does not bind the cart.
> Decrementing stock before payment for pre-pay/COD. Treating the client cart as the pricing authority.

`LETBUYY_CONSTITUTION.md:406`, R-11 (MUST): orders created only behind a cart-bound signed handoff.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| The signed handoff is **fully implemented on both sides** | signer `services/api-gateway/src/routes/storefront/cart-routes.ts:540-574` (HMAC over `canonicalCheckoutHandoffPayload` + SHA-256 cart digest, 10-min expiry); verifier `services/api-gateway/src/routes/checkout.ts:221-300` (`:232-234` required params, `:236-239` expiry, `:249-256` cart bound on id+store_id+session_id, `:272`/`:286` `timingSafeEqualHex`) |
| It gates the **hosted** checkout only | `services/api-gateway/src/routes/checkout.ts:487,513,567,598-601` |
| It has **zero first-party consumers** | `grep 'payment-intent'` across `apps/` → 0 matches |
| The **live** shopper path goes through the unsigned door | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:414` → `apps/storefront-runtime/src/app/api/orders/route.ts:48` → `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:251` → `services/api-gateway/src/execution/order-execution.adapter.ts:158` `db.rpc('create_checkout_order', …)` |
| That route performs **no** cart binding | `rg 'cart_token\|cartToken\|handoff\|cart_digest\|verifyCheckoutHandoff'` in `checkout-payment-routes.ts` → 0 matches |
| The request schema has **no** cart or signature field | `packages/checkout-core/src/index.ts:45-70` `StorefrontCreateOrderSchema` — customer/items/paymentMethod/deliveryOption/notes/couponCode/giftCardCode/idempotencyKey only |
| The RPC has **no** cart/token/digest parameter | live `pg_get_function_arguments` for `create_checkout_order` → 16 params, none cart-related |
| The route is mounted **before** `authMiddleware` | `services/api-gateway/src/index.ts:723` `api.route('/storefront', storefrontRouter)` vs `:750` `api.use('/*', authMiddleware)`; only gate is `authRateLimit` at `services/api-gateway/src/routes/storefront/public-routes.ts:737-740` |

*(Verifier verdict: **PARTIAL**, confidence high — the handoff exists and is correct; the live path bypasses it.)*

**Fairness caveat the ARB must weigh — this is an authorization gap, not a price-forgery gap**

Server-authoritative pricing **does hold on the live path**. `create_checkout_order` re-prices from
the database; `v_tax_amount := COALESCE(p_tax_amount, 0)` (prosrc line 107) and every line total is
recomputed server-side; the Razorpay order-create rejects a client-supplied amount that disagrees
with the server order (`checkout-payment-routes.ts:482-489` `AMOUNT_MISMATCH`). What is missing is
**binding an order to a server-held cart** and **authorizing the caller**, not price integrity.
The realistic exposure is order-spam / inventory abuse (see **D-02**, which compounds it) and an
un-rate-limited write path into tenant order tables — not a discounted checkout.

**Risk of acting** — gating changes a **public, unauthenticated API contract**. Any headless,
mobile, or WhatsApp-commerce client that posts orders directly breaks on the day of the flip. The
React checkout must first be pointed at `GET /:subdomain/cart/:cartToken/checkout-url`. The two
sides of the cart digest are separately maintained (`cart-routes.ts:149-163` `normalizeCartItems`
vs raw JSONB in `checkout.ts:132-136`) with **no shared helper and no round-trip test** — a cart
line-shape change would break the handoff silently.

**Risk of not acting** — a standing, ratified violation of an Article's explicit *Forbids* clause
and of Constitutional Rule R-11. Under R-18 a green validator suite would then be certifying a
forbidden capability.

**Recommended option** — **Gate it.** Do not modify the money RPCs. Add `verifyCheckoutHandoff` in
front of the public order-create (the function already returns a `VerifiedHandoff` carrying the DB
cart row), point the React checkout at the signed `checkout-url` first, and keep the unsigned route
only behind an explicit legacy flag with a **removal date**. Consolidate the digest derivation
behind one shared helper and add a round-trip test before the flip.

**Blast radius**

| Dimension | Scope |
|---|---|
| Files | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`, `.../cart-routes.ts`, `services/api-gateway/src/routes/checkout.ts`, `packages/checkout-core/src/index.ts`, `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`, `apps/storefront-runtime/src/app/api/orders/route.ts` |
| Runtimes | `services/api-gateway`, `apps/storefront-runtime` |
| Merchants | **All** — this is the only live order-creation door |

---

### D-02 — Pre-payment inventory hard-decrement, never released on payment failure

> **Decision required.** *Shall the online-payment order path leave the inventory reservation
> ACTIVE (committing only at capture), with the existing sweeper reclaiming expired reservations —
> or shall the current immediate hard-decrement be ratified?*

**Class B** to bring the code into compliance; **Class A** to retain the current behaviour (it
amends ART-14's *Forbids* and ART-15's reserve→commit decision).

**Rule at stake** — `LETBUYY_CONSTITUTION.md:236` (ART-14 *Forbids*: "Decrementing stock before
payment for pre-pay/COD"); `:240` (ART-15: "One **reserve→commit** inventory lifecycle … with the
stale-reservation sweeper **wired** in `queue-workers`"); `:406` R-11.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| Inventory **is** reserved with a TTL under `FOR UPDATE` (default 1200s, clamped 60..86400) | live `reserve_inventory` prosrc lines 42-58 |
| …and then **immediately committed in the same transaction** | live `create_order_with_inventory_reservations` prosrc lines 197-205 (`PERFORM public.commit_inventory_reservation …`); `commit_inventory_reservation` prosrc lines 27-30 (`SET available = GREATEST(available - v_reservation.quantity, 0)`) |
| On `payment.failed` inventory is **explicitly not released** | `services/webhook-service/src/index.ts:400-412` `recordGatewayOrderPaymentFailure(… releaseInventory: false)` (`:409`) |
| A dismissed Razorpay modal issues **no** server-side cancel | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:534-537` (`modal.ondismiss`), `:540-543` |
| The sweeper exists but **cannot help** — there are no active reservations left to expire | `services/queue-workers/src/inventory-reservations.ts:26` `db.rpc('expire_inventory_reservations')`; cron at `services/queue-workers/src/index.ts:625-635`; RPC at `database/supabase/migrations/141_executable_inventory_reservations.sql:304` |

**Risk of acting** — a money-adjacent RPC change. The commit point moves from order-create to
capture, so COD (which is `confirmed` at creation — `create_order_with_inventory_reservations`
prosrc line 175) must keep the immediate commit while online payment must not. Requires a
reconciliation harness proving no double-decrement and no oversell across the two paths.

**Risk of not acting** — a **denial-of-inventory** vector reachable from the unsigned public
order-create of **D-01**: an unauthenticated caller can drain a merchant's stock to zero by
creating orders it never pays for. D-01 and D-02 compound; either fix alone leaves the attack
degraded but live.

**Recommended option** — leave the reservation **ACTIVE** for online-payment orders, commit at
capture, keep the immediate commit for COD. The sweeper then does real work. ARB-gated; ship with
the reconciliation harness.

**Blast radius** — DB RPCs `create_order_with_inventory_reservations`, `commit_inventory_reservation`,
`expire_inventory_reservations`; `services/webhook-service/src/index.ts`;
`services/queue-workers/src/inventory-reservations.ts`. Runtimes: `api-gateway`,
`webhook-service`, `queue-workers`. **All merchants selling stock-tracked products.**

---

### D-03 — GST computed to zero on every live order, and GST invoices never issued

> **Decision required.** *Shall the ARB authorize (a) a server-side state-name → GST state-code
> resolver in the gateway checkout route, and (b) an invoice-issuance step on order confirm, before
> the platform accepts its first real Indian order?*

**Class B**, escalating under §11.2 trigger 7 (relaxing a go-live gate) and `AGENT-R15.7`.

**Rule at stake** — `LETBUYY_CONSTITUTION.md:240` (ART-15: *"**GST place-of-supply** (CGST/SGST vs
IGST + HSN + inclusive/exclusive) + **immutable GST invoice** (IRN/QR via mock IRP) + TCS are
built"*). India-first legal exposure sits outside engineering discretion entirely.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| GST computation is **skipped** unless `address.stateCode` resolves to a valid Indian state code — no fallback from the state **name** | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:318-320` (`normalizeIndianStateCode(body.customer.address.stateCode ?? null)`); `packages/checkout-core/src/index.ts:727-731` |
| The React checkout **never sends** `stateCode` | `checkout-client.tsx:346-352` sends address/city/state/pincode only; `grep -rn stateCode apps/storefront-runtime/src` → no output |
| So tax lands as zero in the RPC | live `create_checkout_order` prosrc line 107 `v_tax_amount := COALESCE(p_tax_amount, 0)` |
| `gst_invoices` has **never been written** by any code path | `grep 'insert into'` across `database/supabase/migrations/*.sql` for `gst_invoices` → none; the only code reference is `services/api-gateway/src/routes/tax.ts:144` (a `.select`); `psql count(*) on gst_invoices` = **0** |
| The table, its immutability triggers, and the read API all **exist** | `psql`: `gst_invoices` RLS `ENABLE`+`FORCE`; read route `tax.ts:144` |
| No GSTIN is collected at checkout although the RPC supports it | `checkout-client.tsx:338-363` omits `gstin`; RPC support at `create_checkout_order` prosrc lines 152-233; the proxy already forwards it (`apps/storefront-runtime/src/app/api/orders/route.ts:53-54`) |

**Risk of acting** — touching the tax computation on the live money path. The state resolver must be
**server-side authoritative** (a client-supplied code must never be trusted), and invoice issuance
should be an RPC so it is covered by the canonical-ledger-only rule and the existing immutability
triggers. Reusing `generateGstInvoice` from `@letbuyy/checkout-core` keeps one implementation.

**Risk of not acting** — an India-first commerce platform that charges no GST and issues no tax
invoice. This is regulatory, not architectural: it does not degrade, it accrues.

**Recommended option** — **Do both, before merchant #1 transacts.** (a) Server-side
name→code resolver in the gateway route, plus capture of the code at the address step, plus tax
surfaced on the checkout summary so a zero is visible rather than silent. (b) Invoice issuance as an
RPC invoked on order confirm.

**Blast radius** — `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`,
`packages/checkout-core/src/index.ts`, `apps/storefront-runtime/.../checkout-client.tsx`, a new
migration + paired rollback for the issuance RPC. Runtimes: `api-gateway`, `storefront-runtime`.
**Every merchant, every order.** Detail in [12-payments-cod-razorpay-gst.md](12-payments-cod-razorpay-gst.md).

---

### D-04 — COD is never ledgered at confirm

> **Decision required.** *Shall a COD origination transaction (debit `cod_receivable` / credit
> `merchant_payable`) be posted inside the order RPC at confirm, and the remittance posting
> inverted to relieve it?*

**Class B** — a money-path change, ARB-gated under `AGENT-R15.7`.

**Rule at stake** — `AGENTS.md:246` (`PAY-R2`): *"Every capture / refund / **COD** / tender posting
MUST go through the ledger, idempotently (… COD → `cod_receivable` at confirm, relieved at
remittance with **signed** breaks)."* Constitution `:398` R-5 (MUST): every capture/refund/COD/tender
posts to the canonical ledger idempotently.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| COD orders are created `confirmed` immediately | live `create_order_with_inventory_reservations` prosrc line 175 `CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'pending' END` |
| `create_checkout_order` posts **zero** COD ledger entries | `grep -c 'cod_receivable\|post_settlement_ledger'` over the live `create_checkout_order` prosrc = **0** |
| The only `cod_receivable` posting is at remittance — and it **debits** the account | `database/supabase/migrations/165_d5_canonical_money_paths.sql:353-395` (`reconcile_cod_remittance_with_ledger`) |
| The Razorpay capture path **does** post double-entry (three repo docs saying otherwise are stale) | live `confirm_order_payment_with_ledger` prosrc — `post_settlement_ledger_transaction(… debit pa_clearing … credit merchant_payable …)`, introduced by `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql` (commit `c428dcf2`) |

**Note the direction problem, which is a finance question, not an engineering one.** `PAY-R2`
specifies `cod_receivable` **at confirm**, relieved at remittance. The live remittance function
**debits** `cod_receivable`, so no origination entry ever credits the account it later relieves.
Whether the remittance posting is modelling something else, or the origination entry is simply
missing and the sign is wrong, needs a finance/ARB read.

**Risk of acting** — an incorrect sign convention institutionalises a reconciliation break across
every COD order. Ship only with a reconciliation harness that proves reconcile-to-zero on the COD
path.

**Risk of not acting** — COD revenue is invisible to the canonical ledger, so the ledger is not the
single money source of truth (`PAY-R1`, R-5) for the payment method most likely to dominate an
India-first launch.

**Recommended option** — **Post the origination entry, after a finance ruling on direction.** Do
not guess the sign.

**Blast radius** — a new migration + paired rollback amending `create_checkout_order` and
`reconcile_cod_remittance_with_ledger`; `services/api-gateway` (no route change expected).
**All COD merchants.**

*Related, separable, and cheaper:* `cod_enabled` / `online_payment_enabled` are **UI-only** —
`loadPublishedStore` selects only `id` (`services/api-gateway/src/routes/storefront.ts:643-647`,
`:736-748`) and `create_checkout_order` validates only the method name (prosrc lines 29-31), so a
client can order COD from a store that disabled COD. That fix is route-level and needs no money-RPC
edit; it is **Class C** and does not require this docket item to land first.

---

### D-05 — Per-merchant Razorpay credentials are collected and encrypted but never used

> **Decision required.** *Shall per-merchant Razorpay credentials be resolved and used at capture
> (restoring merchant-as-Merchant-of-Record), or shall the merchant credential UI be removed and
> platform-account capture be formally ratified?*

**Class A.** ART-11 is a permanent decision about **who is Merchant of Record**; continuing to
capture on the single platform account is a de-facto deviation only the ARB can ratify.

**Rule at stake** — `LETBUYY_CONSTITUTION.md:213-217`, ART-11: *"Money-in flows to the **merchant's
own** Razorpay (merchant = merchant-of-record)."* `AGENTS.md:248` (`PAY-R4`) repeats it. R-7
(`:400`) forbids custody.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| Merchant credentials **are** written, encrypted | `services/api-gateway/src/routes/stores.ts:432` writes `key_secret_ciphertext`; `services/api-gateway/src/lib/store-payment-config.ts:37` `encryptPaymentSecret` |
| There is **no decrypt function anywhere** | `rg 'decryptPaymentSecret'` over `services/` `packages/` → **no matches** |
| Every capture uses the **platform** env credentials | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:463-468` (env check), `:505-508`; `services/api-gateway/src/index.ts:109` (`c.env.RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) |
| Secrets are correctly deploy-time only | `services/api-gateway/wrangler.toml` carries no literal; `.github/workflows/production-deploy.yml:320` `wrangler secret put` |

**Risk of acting** — changing who receives funds is the highest-consequence change on this docket.
It affects settlement, refunds, payouts, reconciliation, and PA licensing posture. If merchants have
already connected accounts, their ciphertext is **currently unreadable by any code path** — the key
management story must be settled before decrypt is written.

**Risk of not acting** — the settings UI implies something untrue (merchant-is-MoR) while the
platform is the actual MoR. That is an ART-11 deviation **and** a `PAY-R10`/`UI-R6` honesty problem:
a surface that reads as one thing while the money moves another way.

**Recommended option** — **Decide explicitly and record it.** If merchant-as-MoR stands, schedule
the decrypt + per-store resolution (falling back to platform keys) as a gated workstream. If
platform-as-MoR is the interim reality, **remove the merchant credential UI now** so the product
stops asserting a false model, and record the ART-11 deviation with an expiry trigger.

**Blast radius** — `services/api-gateway/src/routes/stores.ts`,
`services/api-gateway/src/lib/store-payment-config.ts`,
`services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`,
`packages/infrastructure/razorpay-adapter/`, the merchant payments settings screen. **Every
merchant that has entered credentials.**

---

### D-06 — The theme-lifecycle mutation contract, and which active-theme store is canonical

Three linked decisions. **(a)** and **(b)** are Class B; **(c)** is **Class A** because §11.1
reserves *"the canonical winner of a domain"* to a constitutional amendment.

> **Decision (a).** *Shall `GET /v1/themes/:slug/editor` be made non-mutating by splitting
> `ensureThemeInstance` into an existence-only variant for reads, keeping the activating variant for
> install/publish/rollback only?*
>
> **Decision (b).** *Shall `GET /v1/themes/:slug/schema` be placed behind `authMiddleware` +
> `store_id` + `verifyStoreOwner`, and `resolveThemeRuntime` made read-only by default with an
> explicit `ensure=true` flag on write paths only?*
>
> **Decision (c).** *Which of `sites.theme_id` (+ `theme_releases.is_current`),
> `theme_instances.instance_status`, or `store_themes.is_active` is the **one** canonical active-theme
> store — and what becomes of the other two?*

**Rules at stake** — Constitution `:414` R-15 (MUST: exactly one canonical system per domain);
`:193`/`:199` ART-08/ART-09 (RLS ENABLE+FORCE; no `USING(true)` to PUBLIC); `AGENTS.md:137` `WIN-R2`
(consult the winner registry; **if silent, escalate — do not pick by completeness**); `AGENTS.md:146`
`WIN-R4`; `AGENTS.md:277` `THEME-R3`.

**Current state (proven)**

| # | Fact | Evidence |
|---|---|---|
| a | A **GET mutates tenant state**: `loadEditor` calls `ensureThemeInstance` with `activate = (store.theme_id === slug)`, which UPDATEs `instance_status='inactive'` on every other `theme_instances` row for the site and inserts/activates the requested one | `services/api-gateway/src/execution/theme-execution.adapter.ts:1152-1159` and `:378-389`; route at `services/api-gateway/src/routes/themes.ts:609,630`. Chain confirmed end-to-end: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:825` (fetch, `cache:'no-store'`) → `:892-894` (`useEffect`) → `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts:49` → `packages/typescript/api-client/src/index.ts:5289-5290` (no `method` ⇒ GET) |
| b | `GET /v1/themes/:slug/schema` is **completely unauthenticated** (no `authMiddleware`, no `store_id`, no `verifyStoreOwner`) yet performs **registry writes** via `ensureThemePackageRuntime`, upserting `theme_packages` `status='active'` and `theme_package_versions` `release_status='published'` — both immediately anon-readable through `*_public_read` policies | `services/api-gateway/src/routes/themes.ts:67-101` (middleware list omits `/:slug/schema`) and `:601-607`; `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:487-600`; `psql pg_policies` `theme_packages_public_read` / `theme_package_versions_public_read` |
| — | `installTheme` is **non-transactional and flips `store_themes` before validating anything**: the blanket `update({is_active:false})` + `upsert({is_active:true})` run first; `validateTemplateConfig`, `ensureThemeInstance`, `publishReleaseSnapshot`, `finalizeInstanceRelease` all run afterwards | `services/api-gateway/src/execution/theme-execution.adapter.ts:889-942` |
| — | `publishReleaseSnapshotFallback` ignores the `theme_releases` insert error, then updates `sites` with a `current_theme_release_id` that does not exist, then silently retries with a payload that drops `storefront_release_version` and `current_theme_release_id` | `services/api-gateway/src/execution/theme-execution.adapter.ts:779-855` |
| c | **Three parallel notions of "active" exist and only one is authoritative for rendering** | `installTheme` writes `store_themes` first (`theme-execution.adapter.ts:889-908`); `GET /v1/themes` derives the installed/active badge from `store_themes` (`services/api-gateway/src/routes/themes.ts:518-530`); the storefront render path reads **neither** — it reads `theme_releases` + `sites.theme_id`/`sites.template_config` (`services/api-gateway/src/routes/storefront.ts:832-860`; `apps/storefront-runtime/src/lib/store-service.ts:557`) |
| c | `store_themes` has **no** single-active constraint, unlike its siblings | `psql pg_index` on `store_themes` → only pkey, `UNIQUE(store_id,theme_id)`, non-unique `(store_id,is_active)`; versus `idx_theme_instances_one_active` and `idx_theme_releases_one_current` |
| c | The live DB is already in the self-inconsistent state this predicts | `psql theme_releases` → `af47e35c \| superseded \| is_current=t`; `psql sites` → `theme_id=urban-kicks`, `current_theme_release_id NULL`, `storefront_release_version=2`, `template_config->>'themeId'=letbuyy-core`; `store_themes` still marks `letbuyy-core` active. `loadCurrentThemeRelease` requires **both** `is_current` and `'published'` (`services/api-gateway/src/routes/storefront.ts:838-846`), so it returns nothing and the storefront silently falls back to `sites.template_config` |
| — | The mitigating control that **does** hold: every store-scoped adapter method calls `verifyStoreOwner` first | `theme-execution.adapter.ts:290-312` plus call sites `870,1124,1215,1322,1376,1534,1567,1689,1729,1852,1936,2027,2157,2229,2292`. `getEditableSchema` is the sole exception — it takes no `storeId`, which is exactly why (b) is exposed |

*(Verifier verdict on (a): **PARTIAL**, confidence high — the GET→write chain is proven; the observed
`letbuyy-core` activation at 13:27:24 also involved an explicit install call.)*

**Risk of acting** — (a) and (b) change gateway route semantics that the merchant editor depends on;
the editor currently *relies* on the GET to materialise an instance. (c) is the expensive one: if
`store_themes` is demoted, the themes-catalog badge query must be rewritten; if it is retained as a
mirror, a unique partial index must be added **after reconciling existing rows** (`AGENT-R15.5`:
a "dead" table with unknown live writers must be escalated, not assumed).

**Risk of not acting** — (a) a merchant opening a theme preview silently demotes their live theme.
(b) an unauthenticated internet caller writes rows into the theme registry that anon can then read —
an ART-09 surface. (c) `WIN-R4` names "two parallel systems" the program's #1 anti-pattern; there
are **three** here, and the live DB has already diverged.

**Recommended option**

- **(a) Split it.** `ensureThemeInstanceExists` (no activation, no cross-instance deactivation) for
  `loadEditor`; keep the activating variant for install/publish/rollback.
- **(b) Authenticate it.** `router.use('/:slug/schema', authMiddleware)` + require `store_id` +
  `verifyStoreOwner`; make `resolveThemeRuntime` read-only by default.
- **(c) Name `theme_releases.is_current` + `sites.current_theme_release_id` the canonical pair**
  (it is what actually renders), demote `theme_instances` to editor state, and demote `store_themes`
  to a mirror written **after** a successful release — or remove it from the install path entirely.
  Add the consistency invariants as a validator: `is_current=true ⇒ release_status='published'`, and
  `sites.theme_id = current release theme_id = template_config.themeId`.
  **Do not repair the live rows before the ARB rules on (c)** — the repair encodes the ruling.
- Independently: move the install sequence into a `SECURITY DEFINER` RPC (`install_theme_for_site`)
  with an `idempotency_key` so `store_themes` + `theme_instances` + release publication are one
  transaction, and make `publishReleaseSnapshotFallback` throw on the insert error before touching
  `sites`.

**Blast radius** — `services/api-gateway/src/execution/theme-execution.adapter.ts` (the whole
lifecycle), `services/api-gateway/src/routes/themes.ts`,
`services/api-gateway/src/execution/schema-registry-execution.adapter.ts`,
`apps/merchant-control-plane` theme editor + library, `apps/storefront-runtime` store-service, plus
migrations for the index and the RPC. Runtimes: `api-gateway`, `merchant-control-plane`,
`storefront-runtime`. **Every merchant with a theme.** Structural detail in
[03-theme-data-model.md](03-theme-data-model.md) and
[04-theme-installation-lifecycle.md](04-theme-installation-lifecycle.md).

---

### D-07 — Shopper auth: no-JS forms that can never succeed, an unthrottled brute-force door, and two token shapes

Three linked items. **(a)** and **(b)** are Class B security fixes; **(c)** is the issuer ruling and
escalates under §11.2 trigger 2 (*a second … token signer*) and `AGENT-R15.1`.

> **Decision (a).** *Shall the Liquid `customer-login` / `customer-register` sections render a
> Turnstile widget (managed mode), or shall a no-JS challenge fallback be specified — accepting that
> today the no-JS path can never succeed?*
>
> **Decision (b).** *Shall `POST /customer/order-credential/login` receive
> `enforceCustomerAuthRateLimit` + `requireValidTurnstile`, or be collapsed into `/customer/login`
> and deleted?*
>
> **Decision (c).** *Which customer-session claim set and TTL is canonical — the gateway's
> `{store_id, customer_id}` / 30 min, or the storefront's `{sub, storeId, email, name}` / 7 days —
> and by what date does the other stop being issued?*

**Rules at stake** — Constitution `:411` R-14 (sole issuer, no shared symmetric signing secret);
`AGENTS.md:262` `IDN-R1` (sole issuer; *"MUST NOT mint sessions/tokens anywhere else"*);
`AGENTS.md:263` `IDN-R2`; `AGENTS.md:233` `SEC-R7`; `AGENTS.md:146` `WIN-R4`.

**Current state (proven)**

| # | Fact | Evidence |
|---|---|---|
| a | The Liquid login/register sections ship **no Turnstile widget and no `turnstileToken` field** | `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/customer-login.liquid:3-8`; `customer-register.liquid:3-9` |
| a | `verifyTurnstileToken` returns **false on a missing token** | `services/api-gateway/src/middleware/security.ts:220` `if (!token) return false;` |
| a | Both handlers call `requireValidTurnstile` **unconditionally** ⇒ the no-JS form always answers **403 `TURNSTILE_REQUIRED`** | `services/api-gateway/src/routes/storefront/customer-registration.ts:48-49`; `.../customer-engagement-routes.ts:712-713` |
| a | The extractor already accepts the managed-mode field | `security.ts:213-214` (`cf-turnstile-response`) |
| b | `POST /api/orders/login` → gateway `/customer/order-credential/login` runs the **same bcrypt check** as `/customer/login` with **no Turnstile and no `enforceCustomerAuthRateLimit`**, and returns the customer's **full order history** on success | `apps/storefront-runtime/src/app/api/orders/login/route.ts:4-25`; `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts:866-901`; only the generic `queryCostRateLimit` applies (`services/api-gateway/src/index.ts:681-685`) |
| b | The protected sibling shows the intended shape | `customer-engagement-routes.ts:705-713` |
| c | **Two HS256 shapes under one cookie.** Gateway: `{store_id, customer_id, iat, exp}`, TTL **1800s**, `lb_customer_session` httpOnly + `letbuyy_csrf` + `X-CSRF-Token` | `packages/auth-core/src/customer-session.ts:4` (TTL), `:46-53` (payload, alg HS256), `:143-152`; `services/api-gateway/src/routes/storefront/customer-registration.ts:141-155` |
| c | Storefront: `{sub, storeId, email, name, iat, exp}`, TTL **7 days**, httpOnly + `sameSite=lax` + `path=/`, `secure` only in production | `packages/auth-core/src/index.ts:129` (cookie name), `:131` (TTL), `:751-770`, `:841-862`; `apps/storefront-runtime/src/lib/session.ts:33-39,58-65` |
| c | The divergence is **acknowledged in code** | `apps/storefront-runtime/src/app/api/customer/register/route.ts:1-3` — *"re-mints the HS256 customer session locally (gateway IDs-only token fails `isCustomerSessionPayload`)"* |
| c | It does **not** break auth at runtime — the gateway dual-accepts | `services/api-gateway/src/middleware/customer-session.ts:56-68` |
| — | Realm separation **does** hold: merchant `authMiddleware` never consults `CUSTOMER_SESSION_SECRET`, and customer verification pins `alg === 'HS256'` | `services/api-gateway/src/middleware/auth.ts:189-205,215-279`; `packages/auth-core/src/customer-session.ts:52,83-88` |

**Risk of acting** — (a) adds a third-party widget to a server-rendered Liquid section, which the
sanitizer must be proven not to strip; (b) may break any consumer of the guest order-lookup surface;
(c) whichever token survives, the collapse must **not** silently widen a 30-minute TTL to 7 days,
and must keep store scoping.

**Risk of not acting** — (a) the entire no-JS shopper auth surface is dead on arrival while the
bundle ships the templates, i.e. capability that reads as shipped but returns 403; (b) an
unthrottled password oracle that discloses order history on success; (c) a standing `IDN-R1`/R-14
violation and a `WIN-R4` parallel system in the identity domain.

**Recommended option** — (a) render the managed-mode widget in both sections and add a behavioural
test that POSTs the form body and asserts a non-403; (b) add the rate limit + Turnstile, and put a
removal date on the route unless the ARB affirms it as a product surface; (c) pick **one** issuer,
make `issueCustomerSession` the single minter, and keep `verifyCustomerSessionToken` only as a
time-boxed read-side migration path with a removal date.

**Blast radius** — `packages/theme-engine/examples/*/files/sections/customer-{login,register}.liquid`,
`packages/auth-core/src/{index.ts,customer-session.ts}`,
`services/api-gateway/src/routes/storefront/{customer-registration.ts,customer-engagement-routes.ts}`,
`services/api-gateway/src/middleware/customer-session.ts`, `apps/storefront-runtime/src/lib/session.ts`
and its API routes. Runtimes: `api-gateway`, `storefront-runtime`, `theme-engine` bundle.
**Every shopper account on every store.** Detail in
[10-shopper-auth-and-account-flows.md](10-shopper-auth-and-account-flows.md).

---

### D-08 — `FEATURE_LIQUID`: wire it as a real kill switch, or formally document it as dormant

> **Decision required.** *Shall `featureGate('FEATURE_LIQUID', …)` be mounted on the theme
> publish / bundle-upload routes so the production `false` actually blocks new Liquid bundle
> publication — or shall the ARB record that the flag is intentionally dormant and correct
> `docs/governance/feature-flag-governance.md:20` and every runbook that names it as a rollback lever?*

**Class B.** Escalation trigger: `AGENT-R15.4` (a governance document conflicts with source) and
ART-02 (governance theater).

**Rule at stake** — `LETBUYY_CONSTITUTION.md:151`, ART-02 (*"One validator suite that enforces the
Constitution; governance-theater ends"*); `:419` R-18.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| The flag is declared | `services/api-gateway/src/middleware/featureFlags.ts:4`; `services/api-gateway/src/index.ts:259` |
| `featureGate` is instantiated **only** for `FEATURE_GRAPHQL` and `FEATURE_EXTENSIONS` | `services/api-gateway/src/index.ts:689-698` |
| `/themes` is mounted **ungated** | `services/api-gateway/src/index.ts:726` |
| Renderer selection is entirely **storefront-side, per-theme** — the gateway flag cannot reach it | `packages/theme-engine/src/theme-governance.ts:144-182`; `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:235-308` |
| The governance doc nevertheless presents it as a live control surface | `docs/governance/feature-flag-governance.md:20` — *"Liquid theme bundle upload/rendering and Liquid-backed storefront composition"*, with an "Enable path" that says to set the worker secret and deploy |
| No committed governance document records an ARB decision on it — only repeated "ARB decision required" entries in the phase-j and phase-ad packages | *(status: **unresolved** — see §3)* |

**Risk of acting** — gating publish/upload on a flag that production has set to `false` would
**block Liquid theme publication in production the moment it lands**. That is the point of a kill
switch, but it must be sequenced against the canary plan (**D-09**), not merged casually.

**Risk of not acting** — an operator following a runbook during an incident toggles a variable with
**zero runtime effect** and believes Liquid has been disabled while it keeps rendering. This is the
exact failure mode ART-02 exists to end.

**Recommended option** — **Wire it on the publish/bundle-upload routes** (not on render, which it
architecturally cannot control), and simultaneously correct
`docs/governance/feature-flag-governance.md:20` to state precisely what it gates. If the ARB prefers
dormancy, the doc correction is **mandatory either way** — the current text is the defect.

**Blast radius** — `services/api-gateway/src/index.ts`, `services/api-gateway/src/middleware/featureFlags.ts`,
`docs/governance/feature-flag-governance.md`, every runbook naming the flag. Runtime: `api-gateway`.
**No merchant-visible change if dormancy is chosen; blocks new Liquid publishes if wired.**

---

### D-09 — The Liquid canary gate itself: an unenforceable parity harness and a rollback that does not work

> **Decision required (i).** *Shall `scripts/liquid-parity/run-parity-matrix.mjs` be given a
> `package.json` script and a CI job (staging-gated; blocking before any canary stage advance), so
> that "parity harness green" becomes machine-verifiable evidence rather than an assertion?*
>
> **Decision required (ii).** *Given that the React fallback cannot render 22 of the 42 Liquid
> section types, does the ARB accept that **Liquid currently has no working rollback**, and does it
> (a) halt canary advancement until the fallback is repaired, or (b) formally amend `THEME-R6` to
> name a different rollback mechanism?*

**Class B** for (i); **Class A-adjacent** for (ii) — §11.2 trigger 7 forbids relaxing a go-live gate,
and `THEME-R6` names `renderer.engine` as *the* rollback.

**Rules at stake** — `LETBUYY_CONSTITUTION.md:253-257`, ART-17 (Liquid default-flip is per-theme +
canary gated on sanitizer + section ports + **parity/security/perf harness**);
`AGENTS.md:207` `TEST-R6` (*"Liquid MUST NOT reach a real buyer until this is green"*);
`AGENTS.md:200` `TEST-R2` (Theme-Liquid sits in the FULL 9-class rigor tier alongside
Money/Tenancy/Auth/Checkout); `AGENTS.md:280` `THEME-R6` (*the per-theme `renderer.engine` switch IS
the rollback*).

**Current state (proven)**

| # | Fact | Evidence |
|---|---|---|
| i | The harness **exists** — 20 frozen sections × 2 viewports | `scripts/liquid-parity/{run-parity-matrix,capture-snapshot,compare-snapshots,harness-lib}.mjs`; `run-parity-matrix.mjs:1-24` (requires `STAGING_STOREFRONT_BASE_URL` / `STAGING_TEST_SUBDOMAIN`) |
| i | It is wired into **no** workflow and **no** package script | `rg 'liquid-parity\|run-parity-matrix\|STAGING_LIQUID_SUBDOMAIN' .github/ package.json` → **0 hits** |
| ii | `coerceLiquidTemplateSections` stamps every coerced section `rendererKey: 'liquid.section.<type>'` | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:156-193` (stamp at `:173`) |
| ii | On fallback, `resolveSectionRendererKey` tries the configured key (`liquid.section.*` — **never** a registry match), then `COMPATIBILITY_RENDERER_KEYS[section.type]` | `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:243-251` |
| ii | For **22 of the 42** bundle section types that lookup returns `undefined` and the page emits a placeholder | `renderer-registry.tsx:271` — *"Renderer `<type>` is not available in this storefront runtime."*; the 22-member set was computed programmatically from `bundle.json` against the registry's `sectionTypes` arrays — see [06-react-liquid-parity-matrix.md](06-react-liquid-parity-matrix.md) §4.2 |
| ii | Concretely: a Liquid failure on `/cart`, `/customers/login`, `/account/*`, `/blog`, `/[slug]`, `/privacy`, or any page using `spotlight` / `search-box` / `collection-*` renders **dashed placeholder boxes, not a working React page** | same |
| — | The live store is **already on Liquid** | `psql sites` → subdomain `saai`, `template_config->>'rendererEngine' = 'liquid'`; the one `theme_releases` row has `release_manifest->>'renderer_engine' = 'liquid'` |
| — | An explicit `'liquid'` engine **short-circuits every canary flag**, so the default-off constant is not a brake | `packages/theme-engine/src/theme-governance.ts:154-160` `if (explicitEngine.includes('liquid')) return true;` |
| — | The canary's own observability signal is wrong: `X-Lb-Render-Engine` is stamped from a global env var, not the per-store decision, so it reports `react` for Liquid stores | `apps/storefront-runtime/src/proxy.ts:175` vs `theme-governance.ts:154-161`; the env var is declared **nowhere** in `config/`, `.github/`, `infrastructure/` |
| — | The theme-engine suite is **red** on the canonical ART-17 renderer: 4 Liquid tests fail with empty commerce loops | `cd packages/theme-engine && npx tsx --test test/*.test.ts` → EXIT=1, `tests 1726 / pass 1722 / fail 4`; `test/liquid-l3-compiler.test.ts:61`, `liquid-l5-product.test.ts:45`, `liquid-l6-collection.test.ts:46`, `liquid-l7-search.test.ts` |
| — | The theme-specific validators are nevertheless **green**, pinning Liquid default OFF and the flip decision `deferred` | `node scripts/validators/theme-governance-validator.mjs` → EXIT=0; `scripts/validators/theme-governance-validator.mjs:57-99`; `no-new-react-sections-validator.mjs` → EXIT=0 |
| — | The authoritative ARB gate list is `docs/storefront-theme-platform/phase-ad/CANARY_READINESS_ARB_PACKAGE.md` (commit `9b4ad6fb`, 2026-07-11) — §5 Stage 7 = platform-wide flip **under ARB authority only** | `git log -1 --date=short -- docs/storefront-theme-platform/phase-ad/CANARY_READINESS_ARB_PACKAGE.md` |

**State this plainly for the record: Liquid currently has no working rollback.** `THEME-R6` names the
per-theme `renderer.engine` switch as *the* rollback. Flipping it back to React on a store using any
of the 22 Liquid-only or unmapped section types does not restore a working page — it produces a page
of placeholders. The rollback lever exists; the thing it falls back to does not render.

**Risk of acting** — (i) a staging-gated CI job needs staging credentials and a stable canary
subdomain; if it is made blocking on PRs it will red-line unrelated work. Recommend
non-blocking on PR, **blocking before any canary stage advance**. (ii) repairing the fallback means
either mapping the coerced `liquid.section.*` keys into `COMPATIBILITY_RENDERER_KEYS`, or building
React renderers for section types that ART-17 deliberately froze — the latter collides with
`THEME-R2` ("no new React sections").

**Risk of not acting** — `TEST-R6` is a **hard** gate whose evidence cannot be produced, on the
renderer the Constitution named canonical, while a live store is already serving Liquid. Under R-18,
a green gate would be certifying a capability whose stated rollback does not function.

**Recommended option** — **(i) wire the harness now** (cheap, purely additive, produces the missing
evidence). **(ii) Halt canary advancement** until either the coerced-key mapping is fixed or
`THEME-R6` is amended to name a rollback that actually works — for example, downgrading the whole
**route** to the React page when the required Liquid template or renderer is absent, rather than
coercing sections. Separately, derive `X-Lb-Render-Engine` from the resolved per-store decision (or
drop the header) so incident triage during the canary is not misdirected.

**Blast radius** — `.github/workflows/*`, root `package.json`,
`apps/storefront-runtime/src/lib/theme-engine/{template-resolver.ts,renderer-registry.tsx,composition-engine.tsx}`,
`apps/storefront-runtime/src/proxy.ts`, `packages/theme-engine/src/theme-governance.ts`,
`AGENTS.md` if `THEME-R6` is amended (Class A path). Runtimes: `storefront-runtime`, CI.
**Every store on Liquid — today, `saai`; on flip, all of them.**

---

### D-10 — `services/lcis-api` and 19 `packages/lcis-*` workspaces escape ARCH-R2 entirely

> **Decision required.** *Shall the LCIS tree be (a) classified as a governed, non-deployed **tooling
> tier** — given a roots list, `AGENTS.md` files, manifests, and an assertion that it is absent from
> every deploy matrix — or (b) moved under `tools/` outside the pnpm `services/*` and `packages/*`
> globs?*

**Class A.** `AGENTS.md:81` (`ARCH-R2`): *"MUST NOT add, deploy, or wire any runtime not in
`ARCH-R1`. Adding a new runtime root requires a **Constitution amendment + ARB approval** + DOC 03/04
updates **before** source is created."* Escalation trigger `AGENT-R15.2`.

**Rule at stake** — `AGENTS.md:64-81` `ARCH-R1`/`ARCH-R2`; Constitution `:415` R-16; `:168` ART-04
(*Forbids* microservice-by-domain extraction without a measured trigger + ARB sign-off).

**Current state (proven)**

| Fact | Evidence |
|---|---|
| `services/lcis-api` is a **real Hono service root** with `src/`, `test/`, `tsconfig.json`, `dist/` | `ls services/lcis-api`; `services/lcis-api/package.json` name `@letbuyy/lcis-api` |
| It has **no** `runtime.manifest.json`, **no** `AGENTS.md`, and appears in **neither** `canonicalServiceRoots` nor `reservedServiceRoots` nor any validator list | `rg 'lcis-api' scripts/validators/ config/runtime/` → **no hits**; `runtime-manifest-validator` counts only **10** manifests |
| **19** `packages/lcis-*` workspaces are declared in `pnpm-workspace.yaml` but absent from `governance-common.mjs` `workspacePackageRoots` / `domainPackageRoots` | `ls packages \| grep -c lcis` → **19**; `scripts/validators/governance-common.mjs:118-160` |
| The tree is **already producing gate failures** — 4 of the 22 clean-HEAD failures name it | `package-ownership-validator` (`packages/lcis-adapters`, `packages/lcis-business` lack `AGENTS.md`); `provider-isolation-validator` (`packages/lcis-adapters/**` call provider URLs directly); `typescript-governance-validator` (`packages/lcis-adapters/tsconfig.json`) — see [14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §3.1 rows 3, 6, 7 |
| The reserved-service discipline **does** hold elsewhere, which is what makes this an outlier | all 6 reserved services and both reserved mobile roots contain exactly `AGENTS.md` + `runtime.manifest.json`; `no-reserved-service-activation-validator.mjs` → EXIT=0 |

**Risk of acting** — (b) moving 20 workspaces changes every import path and every lockfile entry;
(a) is cheaper but means the governance net formally acknowledges a 21st root, which is precisely the
kind of quiet topology expansion `ARCH-R2` exists to prevent unless the ARB says so out loud.

**Risk of not acting** — a service root with real source sits outside every import, ownership,
dependency, and provider-isolation validator. `ARCH-R2` is unenforced for the one tree most likely to
grow, and four permanent gate failures make the baseline noisier for everyone.

**Recommended option** — **(b) move it under `tools/`.** The LCIS stack is developer intelligence
tooling, not product topology; `tools/central-intelligence` already sets the precedent
(`CLAUDE.md` describes LCIS V2 as living at `tools/central-intelligence`). Moving it out of the
`services/*` and `packages/*` globs resolves `ARCH-R2` without expanding the canonical topology and
clears 4 of the 22 baseline failures.

**Blast radius** — `pnpm-workspace.yaml`, `scripts/validators/governance-common.mjs`,
`services/lcis-api/**`, `packages/lcis-*/**` (20 workspaces), every importer. **No merchant impact
— this tree is not a deploy target.**

---

### D-11 — The governance gate deletes developer `node_modules`

> **Decision required.** *Shall `removeGeneratedArtifactDirectories()` be placed behind an explicit
> `--clean` flag (or `CI === true`), making the default local `node scripts/validate-governance.mjs`
> read-only?*

**Class B** — §11.1 names *"a validator's internal logic"* as Class B territory.

**Rule at stake** — `CLAUDE.md` / `DOC-R5` mandate running this exact command after topology,
import, package, environment, generated-artifact, or governance-memory changes. Constitution `:419`
R-18 requires the suite to be the enforcement mechanism — a mechanism engineers are afraid to run is
not one.

**Current state (proven)**

| Fact | Evidence |
|---|---|
| The script `rmSync(recursive, force)`s every `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods` under `apps/`, `packages/`, `services/` | `scripts/validate-governance.mjs:169-192` (`generatedDirectoryNames` set; `fs.rmSync` at `:179`; invocation at `:190-192`) |
| It runs immediately before `stale-artifact-validator.mjs`, which **is** a default gate-lane member | `scripts/validate-governance.mjs:86` |
| It is masked **today only** because the gate dies at validator index 1 | `tenant-isolation-validator` is index 1 and EXIT=1; `stale-artifact-validator` is index 70; the driver `process.exit`s on the first non-zero result (`:199-201`) |
| That same fail-fast is why failure counts in handoffs are systematically wrong | the gate reports **1** failure name; individually, **107** non-destructive validators produce **22** failures at clean HEAD |
| Only 6 of the 108 gate validators contain any write/exec API at all; only this driver and `validate-design-system --update` actually write | programmatic scan of all gate validator files; `scripts/validators/validate-design-system.mjs:213-214` |

**Risk of acting** — none material. Making `stale-artifact-validator` a pure detector that reports
offending directories and exits non-zero preserves the signal and removes the destruction.

**Risk of not acting** — the moment the tenant-registry drift (baseline failure #1) is fixed, the
gate will run past index 1 and **delete every developer's install**. The defect is currently hidden
by another defect.

**Recommended option** — **Gate the deletion behind `--clean` / `CI`.** Additionally, collect all
validator results and exit non-zero at the end with a full failure list (keep fail-fast behind
`--fail-fast`), so the gate baseline is one reproducible number instead of one name.

**Blast radius** — `scripts/validate-governance.mjs`,
`scripts/validators/stale-artifact-validator.mjs`, CI workflows invoking the gate. **No runtime, no
merchant impact.** Baseline measurement method in
[14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §2.

---

### D-12 — Migration 188's fresh-DB no-op: fix forward with a new migration, or reorder seeds?

> **Decision required.** *Shall the missing `letbuyy-core` row on a fresh database be fixed by a
> **new additive migration** (recommended), or by changing seed ordering so `urban-kicks` exists
> before migration 188 runs?*

**Class B** — `MIG-R3` / Constitution `:424` R-23 (every migration ships a paired rollback).

**Current state (proven)**

| Fact | Evidence |
|---|---|
| Migration 188 is `INSERT … SELECT … FROM public.themes WHERE slug = 'urban-kicks' … ON CONFLICT (slug) DO NOTHING` | `database/supabase/migrations/188_letbuyy_core_theme_row.sql:19-32` |
| **The migration's own header admits the no-op** | `188_letbuyy_core_theme_row.sql:13-15` — *"If urban-kicks does not exist yet (fresh DB before its seed), the SELECT yields 0 rows and nothing is inserted — no error. Re-running after the seed lands then creates the row."* |
| The seed that creates `urban-kicks` runs **after** migrations, so a fresh DB contains only `urban-kicks` and **`letbuyy-core` does not exist** | proven by full replay: all **124** migrations applied from zero with **0** failures (438 tables), then seeds |
| Even where 188 *does* fire, the clone is incomplete: it omits `section_schemas`, `block_schemas`, `renderer_manifest`, `schema_version`, `renderer_version` | `psql themes` → `letbuyy-core \| 0 rm_keys \| 0 sec_keys`; `psql theme_renderer_manifests` → `letbuyy-core \| {}` |
| A store on `letbuyy-core` therefore renders with no renderer manifest and no approved renderer keys beyond the `[slug,'default']` legacy fallback | `packages/theme-engine/src/theme-registry.ts:497-499`; `services/api-gateway/src/execution/schema-registry-execution.adapter.ts:111-141` |
| Migration 188 has **no paired rollback file** | `ls database/supabase/rollback/` → 172,173,174,176,177,178,185,192,193,195 only; **180, 186, 187, 188, 189, 190, 191, 194 have none**, while `rollback-integrity-validator` reports *"passed (3 rollback manifests checked)"* |

**Risk of acting** — a new migration is additive and reversible; changing seed ordering silently
alters the meaning of every past replay and cannot be rolled back. Note that 188 also produces a
row branded *Urban Kicks* under the *LetBuyy Core* name (the two committed example bundles are
61/73 byte-identical), so the ARB should decide at the same time whether `letbuyy-core` is an
**alias row** or a genuinely neutral-branded theme.

**Risk of not acting** — every fresh environment (new developer, new CI job, a disaster-recovery
restore) is missing the canonical theme slug, and any DB lookup by `letbuyy-core` dead-ends —
exactly the failure 188 was written to fix.

**Recommended option** — **A new additive migration**, which (a) inserts `letbuyy-core` if absent,
(b) copies `section_schemas`, `block_schemas`, `renderer_manifest`, `schema_version`,
`renderer_version` from `urban-kicks`, (c) refreshes the `letbuyy-core`
`theme_renderer_manifests` / `theme_schema_manifests` rows, and (d) **ships with a paired rollback**.
Backfill the missing rollback files for 180, 186–191 and 194 in the same workstream, and widen
`rollback-integrity-validator` so its pass message reflects real coverage rather than 3 manifests.

**Blast radius** — `database/supabase/migrations/`, `database/supabase/rollback/`,
`scripts/validators/rollback-integrity-validator.mjs`. **Every fresh environment; no live merchant
impact if `letbuyy-core` already exists there** — but see the UNVERIFIED entry in §3 about whether
188 has been applied to production at all. Detail in
[07-letbuyy-core-current-state.md](07-letbuyy-core-current-state.md).

---

## 3. The UNVERIFIED register

**Nothing in this table may be treated as settled fact.** Constitution §11.2 item 6 and §14.4
(line 453) forbid silently upgrading an `UNVERIFIED` item; `AGENT-R15.6` repeats it. Each must be
resolved by the ARB **with verification evidence**, or recorded as a genuine live/vendor probe.

### 3.1 Carried from Constitution §14.4 (lines 455–459)

| # | UNVERIFIED item (verbatim scope) | What would resolve it | Status after this engagement |
|---|---|---|---|
| U-1 | *"The six anon RLS-to-PUBLIC table GRANTs are set by Supabase's managed bootstrap, not repo SQL"* — confirm with an anon-key probe / `\dp public.orders` before final S0 sign-off | An anon-key probe against each of the six tables in **each deployed environment**, plus `\dp` output committed as evidence | **Still UNVERIFIED for production.** Locally, `SET ROLE anon` probes were run for the theme surface only ([13-security-and-tenant-isolation.md](13-security-and-tenant-isolation.md)); the six-table set was not probed in staging or production |
| U-2 | *"The final ARB signature for the ops-console survivor"* is a human seam (`SKIP-GATE-OPS-SURVIVOR-ARB`) | An ARB minute naming `apps/platform-console` KEEP and `apps/platform-operations-portal` MIGRATE-then-DELETE | **Untouched** — out of scope for this engagement |
| U-3 | *"Full RLS/FORCE coverage per tenant table"* and the live writers of the product-dead tables need live introspection before any DROP | `pg_class.relforcerowsecurity` for every tenant table in every environment + a writer audit | **Partially resolved for the theme surface, and it is bad news:** **24 of 32** theme tables have RLS `ENABLE` but **not** `FORCE` (`psql pg_class.relforcerowsecurity = f`), including `themes`, `theme_packages`, `theme_package_versions`, `theme_schema_manifests`, `theme_renderer_manifests`, `theme_purchases`, `theme_reviews`. The checkout/money tables are clean (`carts`, `checkout_sessions`, `orders`, `order_items`, `payment_transactions`, `payment_attempts`, `inventory_reservations`, `ledger_entries`, `ledger_transactions`, `gst_invoices` → all `t \| t`) |
| U-4 | *"Live deployment state of every 'complete' wave is ~0% until the deploy meta-blocker clears"* — completion-% measures the working tree, not production | Deploy-API evidence per runtime, per environment | **Untouched.** No production probe was performed in this engagement |

### 3.2 `unresolved` and `inferred` facts carried from the discovery sweep

The discovery corpus is 531 facts: **525 proven**, **4 inferred**, **1 unresolved**, **1 stale-doc**.
The non-proven ones are reproduced here in full, because a downstream reader would otherwise be
unable to tell them apart from the proven mass.

| # | Status | Claim | Evidence held | What would resolve it |
|---|---|---|---|---|
| V-1 | **unresolved** | Whether the two customer-session TTLs (30 min gateway vs 7 days storefront) are an intentional split or drift is **not resolvable from source** — no ADR or governance doc states the intended TTL | `packages/auth-core/src/customer-session.ts:4` vs `packages/auth-core/src/index.ts:131`; no decision record located | **D-07(c)** — an ARB ruling naming the canonical claim set and TTL. This is a decision, not a probe |
| V-2 | **inferred** | The 13:30:32 theme-state reversal was **out-of-band SQL, not application code**: it hard-deleted release `f8d47ebe` and instance `bdaef445`, set `sites.theme_id` back to `urban-kicks` and `af47.is_current` back to `true` | No hard-delete path exists in any gateway route; `sites.updated_at=13:30:32.463069` and `theme_instances.updated_at=13:30:32.459926` are DB `now()` values from `update_updated_at` BEFORE-UPDATE triggers, and no release row was created at that time | Find the repair script. If one exists outside `services/` and `database/`, it must be **versioned or deleted** — it left `store_themes` and `sites.template_config` inconsistent (see **D-06**) |
| V-3 | **inferred** | The DOMPurify instance is a **shared module-level singleton across concurrent requests**; the code asserts re-entrancy safety on the grounds that `sanitize()` is synchronous and the `uponSanitizeAttribute` hook is stateless | `packages/theme-engine/src/theme-renderer.ts:1305-1320` (the comment) and `:1318` `let domPurifyPromise` | A concurrency test that interleaves two sanitize calls with different hook-relevant inputs and asserts no cross-contamination |
| V-4 | **inferred** | All 4 theme-engine Liquid failures share one symptom: the renderer emits the document shell and static sections, but **every product/collection iteration renders empty** — commerce data binding into Liquid loops is broken | Comparison of the 4 `AssertionError` `actual` bodies: `lb-category-grid__items`, `lb-featured-products__items` and the collection product loop all render as empty divs | Root-cause whether the loop data is absent from the render context or stripped by the sanitizer. The related contract failure expecting `sanitizeRenderedHtml(String(layoutHtml), { wholeDocument: true })` plus stripped `<meta>` attributes point at the sanitizer/`wholeDocument` path as first suspect |
| V-5 | **inferred** | The residual `letbuyy-core`/`urban-kicks` leak is **branding/metadata** (slug, title suffix, body class, default `storeName`), not another tenant's stored data — the fixture is a code constant, not a DB read of site B | `packages/theme-engine/src/portable-to-liquid.ts:103` (in-code fixture); no DB query in that function selects another `store_id` | Confirmed by inspection; retained as inferred because it is a negative claim about all call sites |
| V-6 | **stale-doc** | `AGENTS.md` `TEST-R4` names a **non-existent path** — `tests/security/cross-tenant-redteam-postgres.test.mjs` — as the mandated RT-1..RT-9 location | `AGENTS.md:205` vs `ls tests/security/` (only `environment-honesty.test.mjs`, `execution-mode.test.mjs`); the real suite is `tests/executable/tenant-redteam-postgres.test.mjs` | Either move/alias the suite to the constitutionally named path or amend `AGENTS.md:205`, **and** add a validator assertion that the named path exists so the two cannot drift again |

### 3.3 Open questions the ARB must route to an owner

These are not defects; they are questions no read-only agent could answer from source, each of which
gates a decision above.

| # | Question | Gates | What would resolve it |
|---|---|---|---|
| Q-1 | Has the ARB **ever formally recorded** the `FEATURE_LIQUID` decision? No committed governance document does — only repeated "ARB decision required" entries in the phase-j and phase-ad packages | **D-08** | An ARB minute, committed |
| Q-2 | Is `docs/storefront-theme-platform/phase-af` (AF_00…AF_13, **entirely uncommitted**) an accepted artifact or abandoned WIP? Its `AF_1_STOP` verdict is the newest theme-governance statement in the tree but has **no commit and no ARB signature** | **D-09** | An ownership ruling. Note AF_12's "clean clone cannot compile `@letbuyy/theme-engine`" blocker is **CLOSED at HEAD** — `git cat-file -e HEAD:packages/theme-engine/src/{industry-experience-map,theme-bundle-core,experience-fonts}.ts` all succeed at `bf35062e` — so the package is stale on that point while its gate-red finding still reproduces |
| Q-3 | Has migration **188** actually been applied to the **production** Supabase instance? Confirmed applied locally; no repo artifact records production apply state, and `CANARY_READINESS_ARB_PACKAGE` §5 Stage 0 makes this a hard prerequisite | **D-12**, **D-09** | A production `psql` probe. There is **no** `supabase_migrations.schema_migrations` table locally, so applied state is inferable only from data shape — the migration ledger mechanism itself needs identifying |
| Q-4 | Is `apps/storefront-runtime` actually reachable at a `*.vercel.app` hostname in production, or fronted exclusively by Cloudflare with the origin locked down? | The severity of the access-gate bypass (**§4**, authorized) hinges **entirely** on this | A DNS/edge configuration probe |
| Q-5 | Which database role does `HYPERDRIVE` / `DATABASE_URL` resolve to at runtime, and does it carry `BYPASSRLS`? If it is the `postgres` superuser, the pooled-SQL storefront readers are **outside RLS entirely** and rest solely on their `store_id = $1` predicates | **U-3**, and the whole RLS-as-backstop premise (`SEC-R9`) | A `SELECT current_user, rolbypassrls` probe from the deployed worker |
| Q-6 | Is the unsigned public `POST /:subdomain/orders` intended to survive as a documented API (mobile / headless / WhatsApp commerce), or is it purely the legacy React door? **Nothing in the code states the intent** | **D-01** — it decides whether the fix is "gate it" or "give it its own authenticated contract" | A product ruling |
| Q-7 | The COD ledger **direction**: `reconcile_cod_remittance_with_ledger` DEBITS `cod_receivable` and CREDITS `merchant_payable` at remittance (`165_d5_canonical_money_paths.sql:353-395`), while `PAY-R2` specifies `cod_receivable` at confirm, relieved at remittance | **D-04** | A finance/ARB read, **not** an engineering guess |
| Q-8 | Are merchant Razorpay credentials' decrypt side **intentionally deferred**, or was it removed? If merchants have already connected accounts, their ciphertext is currently unreadable by any code path | **D-05** | Key-management and product ruling |
| Q-9 | Which payment providers are actually in V1 scope? The React checkout ships a `paypal-return` route and the gateway has Cashfree/Stripe/PayPal storefront routes, but `create_checkout_order` accepts only `('razorpay','stripe','paypal','cod')` — `cashfree` would raise *unsupported payment method* — while the success page comment says *"V1 ships Razorpay+COD; Stripe deferred (LB-2)"* | **D-03**, **D-05** | A product ruling |
| Q-10 | Is `themes` intentionally excluded from the tenant table registry (treated as a shared marketplace catalog) now that migration 190 made it **dual-purpose**? If it should be registered, the schema-derived generator must be taught to recognise `owned_by_site_id` as a tenant column — otherwise regenerating the registry **will not add it** | **D-06**, and the tenant-registry fix authorized in §4 | An ARB ruling on the catalog/tenant classification of `themes` |
| Q-11 | Which environment is **authoritative** for the persisted Liquid bundle? The local `theme_releases` row is stale (12 templates / 33 sections) **and** `superseded`. Whether staging/production carry a current, published Liquid release could not be determined without querying remote Supabase | **D-06**, **D-09** | A staging/production `psql` probe |
| Q-12 | Was the live store's **12-template** Liquid bundle published deliberately as a partial canary, or is it a stale artifact? This decides whether the "missing template ⇒ render `index`" fallback is a bug or accepted canary behaviour under ART-17 | **D-09** | A publishing-history ruling |
| Q-13 | Which host mode is production truth for shoppers — `{store}.letbuyy.com` (host-only cookie; root-relative Liquid hrefs work) or path-based `/store/<subdomain>` (shared `localStorage` **and** shared session cookie across stores on one origin)? Several Liquid sections and the no-JS auth redirect only work in the former | **D-07** | A deployment/product ruling |
| Q-14 | Is the dual credential store (`store_customers.password_hash` **and** `customer_credentials.password_hash`) an in-flight migration with a target, or permanent duplication? Login reads only `customer_credentials`; register/reset write both | **D-07** | A migration-plan ruling (`WIN-R4` applies) |
| Q-15 | Are `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` in V1 scope? They occupy 4 of the 25 `BUILT_IN_SECTION_TYPES` and 4 of the schema/validator counts but have **no renderer in either engine** | **D-09** | A scope ruling |
| Q-16 | Which commit or environment produced the *"gate 107/107 PASS"* claim, given `validate-design-system.mjs` fails on the current tree **and** at clean HEAD? | **D-11**, and the credibility of every inherited status claim | Identify the commit; see the correction recorded in [14-test-build-governance-baseline.md](14-test-build-governance-baseline.md) §3.3 |
| Q-17 | Are there additional theme-mutation surfaces **outside** `services/api-gateway/src/routes/themes*` — for example in the frozen `theme-marketplace` or `developer-portal` apps — that write site-scoped theme tables without an ownership check? | **D-06** | A dedicated sweep of the frozen apps |

---

## 4. What this engagement was authorized to change — and what it did not touch

### 4.1 Authorized scope: tenant-isolation P0s only

The user authorized fixes to **five tenant-isolation P0s and nothing else**:

| # | Authorized item | Anchor evidence |
|---|---|---|
| A-1 | The **cross-tenant storefront handle leak** | `services/api-gateway/src/routes/storefront.ts:800-806` (`loadSiteByHandle`: `.or('subdomain.eq.X,store_name.eq.X').limit(1).single()` — no `ORDER BY`, no post-check that `store.subdomain === handle`); `:654-662` and `:644-651` (pooled-SQL siblings, `limit 1`, **fails open**); `:743-753` (the Supabase sibling omits `.limit(1)` and therefore **fails closed** — the asymmetry proof). Collision-creating write: `packages/tenant-core/src/index.ts:267-270` (free-text `store_name`) → `services/api-gateway/src/routes/onboarding.ts:343` and `:405` (inserted with **no collision check**), versus the guarded counter-examples at `services/api-gateway/src/routes/stores.ts:651` and `services/api-gateway/src/routes/auth.ts:722`. *(Verifier verdict: **CONFIRMED**, confidence high.)* |
| A-2 | The **`public.themes` `USING(true)` policy** | `psql pg_policies` → `themes \| Themes are viewable by everyone \| SELECT \| {public} \| true`; baseline at `database/supabase/migrations/000_baseline.sql:24152`; migration `190_theme_library_q.sql:34-48` added `owned_by_site_id` / `is_site_private` **but no policy to honour them** |
| A-3 | **RLS `FORCE` coverage** | `psql pg_class.relforcerowsecurity = f` for **24 of 32** theme tables |
| A-4 | The **`vercel.app` access-gate bypass** | `apps/storefront-runtime/src/proxy.ts:259` `if (!host \|\| host.includes('vercel.app')) return NextResponse.next();` combined with `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:88` (status-only gate) |
| A-5 | The **fail-open proxy** | `apps/storefront-runtime/src/proxy.ts:100` (`return { status: 'unavailable' }` on missing config), `:109-117` (fetch/HTTP error), `:267-273` (`return NextResponse.next()`) — a missing `INTERNAL_API_SECRET` / `LETBUYY_API_BASE_URL` or any gateway blip disables the password / offline / preview_only gate for **every** store for the duration |

Analysis of all five lives in
[13-security-and-tenant-isolation.md](13-security-and-tenant-isolation.md). Two of them carry open
questions that must be answered before or alongside the fix: **Q-4** (is `*.vercel.app` actually
reachable in production?) and **Q-10** (should `themes` be registered as a tenant table at all?).

### 4.2 Explicitly NOT authorized — documented only, escalated here

Every item in §2 was **read, evidenced, and left untouched**. No file listed in any "Blast radius"
row above was modified by this engagement for the purpose of that finding.

| Group | Docket items | Disposition |
|---|---|---|
| Theme lifecycle P0s | **D-06** (GET mutating `theme_instances`; unauthenticated GET `/themes/:slug/schema` performing registry writes; non-transactional `installTheme`; the three disagreeing active-theme stores) | Documented only → ARB |
| Shopper auth P0s | **D-07** (Liquid no-JS login/register always 403; unthrottled brute-force on `POST /api/orders/login`; two incompatible HS256 token shapes under one cookie) | Documented only → ARB |
| Checkout / payment / GST P0s | **D-01** (unsigned public order-create bypassing the built-but-unused ART-14 signed handoff), **D-02** (pre-payment inventory hard-decrement never released), **D-03** (GST computed to zero; GST invoices never issued), **D-04** (COD never ledgered at confirm) | Documented only → ARB |
| Merchant-of-Record | **D-05** (per-merchant Razorpay credentials collected, encrypted, never used) | Documented only → ARB |
| Governance / tooling | **D-08**, **D-09**, **D-10**, **D-11**, **D-12** | Documented only → ARB |

### 4.3 Two standing facts that bound every claim above

**The working tree is USER-OWNED.** 6 784 modified files (6 063 of them mode-only `100644`→`100755`),
**721** real content changes, **11** untracked. None of it was created by this engagement; none of it
was reverted, stashed, cleaned, or committed (`AGENT-R16`: *"MUST treat a dirty worktree as
user-owned and never revert changes you did not make"*). Two untracked/modified files are
theme-relevant — `apps/storefront-runtime/src/lib/webpack/node-crypto-client-stub.ts` and
`apps/merchant-control-plane/next.config.ts` — and are treated as **user-owned inputs**, never as
this engagement's output.

**The governance baseline is 22, not 2.** The inherited handoff claimed *"two pre-existing governance
failures."* Measured at clean `HEAD` (`bf35062e`) in a detached worktree with no user edits, the true
count is **22 of 107** validators failing; the working tree shows **24**, and the 2 extra are
user-owned artifacts (untracked `supabase/config.toml` → `migration-safety-validator`;
`scripts/.DS_Store` → `tooling-governance-validator`). `node scripts/validate-governance.mjs` was
**not** run as documented, because reading it first proved it deletes `node_modules`/`.next`/`dist`/
`.turbo`/`build` under `apps`, `packages`, `services` (`scripts/validate-governance.mjs:169-192`;
`stale-artifact-validator.mjs` is a gate-lane member at `:86`) — that defect is **D-11**. Full method
and the 22-row table: [14-test-build-governance-baseline.md](14-test-build-governance-baseline.md)
§2–§3.

Also proven during this engagement, and relevant to **D-12**: the local database was reset **with the
user's explicit authorization** and all **124** migrations replayed from zero with **0** failures
(438 tables), followed by seeds. A fresh database contains only `urban-kicks`; **`letbuyy-core` does
not exist**, because migration 188 does `INSERT … SELECT FROM themes WHERE slug='urban-kicks'` and
the seed that creates that row runs **after** migrations.

---

*Document 17 of the theme-system current-state series. Compiled 2026-08-04 against branch
`stepup/main` @ `bf35062e`. Every claim carries a `path:line`, a table/RPC/migration name, a `psql`
result, or a command + exit code. Nothing on this docket was changed by this engagement.*
