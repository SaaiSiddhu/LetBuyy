# AGENT H — GST, Invoices, Sales/Output Tax, Purchase/Input Tax, Reporting

**Run:** `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182`
**Branch/commit:** `stepup/main` @ `ee371182`
**Scope:** India GST data + execution model, invoices, credit notes, e-invoice/IRP, refund tax
consequences, reports/exports, tests.
**Method:** read-only static inspection of migrations, gateway routes, `@letbuyy/checkout-core`,
merchant + storefront UIs, validators and tests. **No runtime was executed. Nothing is
`VERIFIED_E2E`.**

> **I am not a tax professional and this file contains NO legal or tax advice.** Every statement is
> labelled `CODE_IMPLEMENTED` / `ACCOUNTING_POLICY_DEFINED` / `LEGALLY_VALIDATED` /
> `INFERRED-FROM-PRACTICE-NOT-REPO`. Section 13 lists the items that must go to a CA / tax counsel.

---

## 0. HEADLINE (read this first)

**`LEGALLY_VALIDATED`: NONE. I found no CA sign-off, no tax-counsel review artifact, no
professional-review record anywhere in the repository for any part of the GST model.** The only
"approval" artifacts are self-graded internal audits (§12).

**`CODE_IMPLEMENTED`: the GST engine is a correct-looking pure function that, on the live storefront
path, can never produce a non-zero result and can never produce an invoice.** Three independent
structural breaks each individually reduce GST to zero:

| # | Break | Evidence |
|---|-------|----------|
| 1 | `tax_registrations` (the supplier-side source for checkout GST) has **zero writers** in the entire repo — no UI, no gateway route, no RPC. It can only ever be empty. | reader: `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:301`; no `.insert(`/`upsert` anywhere (grep across `services/`, `apps/`, `packages/`) |
| 2 | The storefront checkout **never sends `stateCode` and never collects a customer GSTIN**, so the recipient state code is always null. | `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:338-363` (payload has `{address, city, state, pincode}` only) |
| 3 | Invoice generation **returns `null` and silently skips** when supplier state code or (recipient GSTIN AND recipient state code) are missing. | `services/api-gateway/src/execution/order-execution.adapter.ts:259`, `:268` |

Consequently: `computedTaxAmount` is `null` → `create_checkout_order` receives `p_tax_amount = NULL`
→ `v_tax_amount := 0` (`database/supabase/migrations/170_v1_shipping_rates_gst.sql:159`) → **every
storefront order books ₹0 GST and no GST invoice is created.**

**The canonical immutable invoice table `gst_invoices` has ZERO writers in production code.** Its
migration header claims a writer that does not write: *"Single writer:
services/api-gateway/src/routes/tax.ts -> gst_invoices"*
(`database/supabase/migrations/144_executable_tax_gst_invoices.sql:2`) — but `tax.ts` only ever
`SELECT`s (`services/api-gateway/src/routes/tax.ts:144`). The only `INSERT INTO public.gst_invoices`
in the repository is inside a test (`tests/executable/tax-postgres.test.mjs:113`).

**There is no credit note or debit note anywhere** — no table, no column, no route, no type. The
public marketing legal page asserts the opposite (§7.4).

---

## 1. Merchant tax profile

### 1.1 What exists

| Item | Where | Status | Evidence |
|------|-------|--------|----------|
| Merchant GSTIN | `sites.gstin text` | `CODE_IMPLEMENTED` | `database/supabase/migrations/000_baseline.sql:12017` |
| GSTIN format CHECK (15-char) | `sites_gstin_format_check` | `CODE_IMPLEMENTED` | `000_baseline.sql:12023` — `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` |
| Merchant state code | `sites.gst_state_code text` + CHECK `^(0[1-9]\|[12][0-9]\|3[0-8]\|97)$` | `CODE_IMPLEMENTED` | `000_baseline.sql:12018`, `:12022` |
| Legal name | `sites.legal_name text` | `CODE_IMPLEMENTED` | `000_baseline.sql:12016` |
| Invoice prefix | `sites.invoice_prefix text DEFAULT 'LBY'` | `CODE_IMPLEMENTED` | `000_baseline.sql:12019` |
| Trade name / entity type / PAN last-4 | `sites.business_profile jsonb` (free-form) | `CODE_IMPLEMENTED` (unvalidated) | `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:289-292` |
| Registered/invoice address | `sites.invoice_address jsonb` | `CODE_IMPLEMENTED` (never used by the invoice) | `database/supabase/migrations/122_mobile_business_profile.sql:7` |
| Second registry: `tax_registrations` (legal_name, gstin, state_code, registration_type, effective window) | migration 144 | `NOT_IMPLEMENTED` (no writer) | `144_executable_tax_gst_invoices.sql:6-30` |
| Composition scheme flag | `tax_registrations.registration_type IN ('regular','composition','unregistered')` | `NOT_IMPLEMENTED` (never read) | `144:12-13`; no reader selects `registration_type` |
| Full PAN | — | `NOT_IMPLEMENTED` — only `pan_last4` in a jsonb blob | `settings/business/page.tsx:292` |
| Multiple GSTIN / multiple place of business | schema allows N rows per site (`UNIQUE (site_id, gstin)`), product picks exactly one | `PARTIAL` / unusable | `144:28-30`; reader `checkout-payment-routes.ts:300-307` |

### 1.2 State-code derivation

`CODE_IMPLEMENTED`. Two implementations:

- Client-side (web merchant UI): `deriveGstStateCode(gstin)` = first 2 chars, validated against a
  38-entry lookup — `apps/merchant-control-plane/src/lib/india/gst-states.ts:58-62`.
- Server-side: `extractGstStateCode()` = `gstin.slice(0,2)` with no lookup validation —
  `packages/checkout-core/src/index.ts:722-725`.

The UI's `GST_STATES` list correctly omits merged codes 25 and 28
(`gst-states.ts:10-48`) but `IndianStateCodeSchema` still accepts them
(`packages/shared-types/src/index.ts:71-74` — `^(0[1-9]|[12][0-9]|3[0-8]|97)$`). **Code `99` (Other
Country / export) is accepted by neither** → exports and SEZ supplies have no representable place of
supply (§4.4).

### 1.3 Two competing merchant GSTIN capture surfaces (`CONTRADICTORY_EVIDENCE`)

| Surface | Writes | Purpose |
|---------|--------|---------|
| `settings/business` | `sites.gstin`, `sites.gst_state_code` via `PATCH /stores/:id` | the merchant's **own sales** GSTIN |
| `settings/billing/profile` | a different `profile.gstin` on the billing payload | GSTIN LetBuyy should put on **its** invoice to the merchant |

`apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:294-303` vs
`apps/merchant-control-plane/src/app/[store]/settings/billing/profile/page.tsx:110-126`. The
gateway `PATCH /stores/:id` allow-list accepts both `gstin` and `gst_state_code`
(`services/api-gateway/src/routes/stores.ts:726`). Whether the billing-profile GSTIN lands anywhere
that LetBuyy's own invoice reads is **NOT the case** — see §11.2, `merchant_billing_invoices` has no
GSTIN column at all.

---

## 2. Customer / billing side

| Item | Status | Evidence |
|------|--------|----------|
| Shipping address captured | `CODE_IMPLEMENTED` — free-text `state`, no state code | `apps/storefront-runtime/src/.../checkout-client.tsx:793-801` (plain `<input>` labelled "State *"), `:320` (`if (!formData.state.trim())`) |
| Shipping **state code** captured | **`NOT_IMPLEMENTED`** on every storefront surface | payload `checkout-client.tsx:346-353` contains no `stateCode`; grep for `stateCode` across `apps/storefront-runtime` + `packages/theme-engine` returns **zero** hits |
| **Billing address** captured | **`NOT_IMPLEMENTED`** — `orders.billing_address jsonb` exists (`000_baseline.sql:10129`) but the storefront checkout never populates it | `checkout-payment-routes.ts:280-290` builds only `shippingAddress` |
| Customer GSTIN (B2B) | `PARTIAL` — column + CHECK + gateway field exist; **no storefront UI field** | column `orders.customer_gstin` + `orders_customer_gstin_format_check` (`000_baseline.sql:10163`, `:10167`); gateway accepts `body.customer.gstin` (`checkout-payment-routes.ts:379`); storefront never sends it |
| B2B vs B2C distinction | **`NOT_IMPLEMENTED`** | no `is_b2b`, no B2B/B2C branch anywhere; the invoice generator treats recipient GSTIN as optional metadata only (`checkout-core/src/index.ts:780-791`) |
| "Bill-to / Ship-to" different-address handling | **`NOT_IMPLEMENTED`** | `order-execution.adapter.ts:261` reads `order.shipping_address` only |

Other paths *do* have a buyer-GSTIN field that the storefront lacks: hosted checkout sessions
(`checkout_sessions.buyer_gstin`, `database/supabase/migrations/146_executable_checkout_state_machine.sql:14`;
gateway `services/api-gateway/src/routes/checkout.ts:498`) and draft orders
(`database/supabase/migrations/116_mobile_draft_orders.sql:10`).

---

## 3. HSN / SAC and tax category ownership

| Question | Answer | Evidence |
|----------|--------|----------|
| Per product? | Column exists: `products.hsn_code text` + CHECK `^\d{4,8}$` | `000_baseline.sql:10626-10627` |
| Per variant? | **No** — no variant-level HSN | grep `hsn` over `000_baseline.sql` returns only `order_items`, `products`, `tax_rates`, `hsn_rates` |
| Per category / collection? | **No**. `tax_overrides.scope_type` allows `'collection'` but nothing reads `tax_overrides` | `144:57`; zero readers (grep) |
| Per order line? | Copied: `order_items.hsn_code` + CHECK `^\d{4,8}$` | `000_baseline.sql:10037`, `:10044` |
| Set from the **web** merchant UI? | **NO.** No HSN input on the product form or the tax-rate form | grep `hsn` over `apps/merchant-control-plane/src` → only a search keyword in `components/settings/settings-navigation.ts:127` |
| Set from the **mobile** merchant app? | Yes, but only on a **tax rate**, not on a product | `apps/mobile/merchant-app/lib/screens/settings/taxes_screen.dart:126,184,281` |
| Required? | **No.** Nullable everywhere, no enforcement, no default fallback, invoice generation proceeds with `hsn_code: null` | `checkout-core/src/index.ts:618` (`.optional().nullable()`), `:816` |
| `hsn_rates` table used for rate resolution? | **NO — zero readers and zero writers.** Dead table. | defined `144:32-52`; grep `hsn_rates` over `services/`, `apps/`, `packages/` → only the tenant registry and a source-text test |

**HSN validation is inconsistent across four layers** (`CONTRADICTORY_EVIDENCE`):

| Layer | Pattern |
|-------|---------|
| `packages/shared-types/src/index.ts:76-79` (`HsnCodeSchema`) | `^\d{4,8}$` |
| `products` / `order_items` CHECK | `^\d{4,8}$` |
| `hsn_rates.hsn_code` CHECK (`144:35`) | `^[0-9A-Za-z.-]{2,20}$` |
| `tax_rates.hsn_code` CHECK (`123_mobile_tax_rate_parity.sql`) | length ≤ 20, any characters |

A value accepted by `hsn_rates`/`tax_rates` (e.g. `"6403.99"`) would be rejected by the
`order_items` CHECK when `generateAndPersistGstInvoice` writes it back
(`order-execution.adapter.ts:357`), raising `GST order item persistence failed` and — because the
whole call is fire-and-forget (§5.6) — silently losing the invoice.

**Actual rate resolution in production code ignores HSN entirely.** Both computation paths take a
single store-wide default:

```
services/api-gateway/src/execution/order-execution.adapter.ts:282-294
  .from('tax_rates').eq('store_id', siteId).eq('is_active', true)
  .eq('is_shipping', false).order('priority', {ascending:false}).limit(1)
```
and identically at `checkout-payment-routes.ts:309-318`. Per-line rate is
`taxRateBps(item.gst_rate) || defaultGstRateBps` (`order-execution.adapter.ts:308`) — where
`order_items.gst_rate` is itself only ever written *by this same function*, so on first computation
it is always the store default.

---

## 4. Place of supply and intra vs inter-state determination

### 4.1 The deciding function (read it, do not trust the name)

`packages/checkout-core/src/index.ts:830-879` — `generateGstInvoice`:

```ts
836  const placeOfSupplyStateCode = normalizeIndianStateCode(input.place_of_supply_state_code)
837    || recipient.state_code;
838  const supplyType = supplier.state_code === placeOfSupplyStateCode ? 'intra_state' : 'inter_state';
```

`CODE_IMPLEMENTED`. The comparison is **supplier state vs place of supply** — structurally the right
comparison. `supplier.state_code` comes from `buildGstInvoiceParty` which prefers an explicit
`state_code` and falls back to the first two digits of the supplier GSTIN
(`checkout-core/src/index.ts:733-741`, `:782`).

The split itself (`checkout-core/src/index.ts:806-808`):
```ts
cgst = supplyType === 'intra_state' ? Math.floor(tax / 2) : 0;
sgst = supplyType === 'intra_state' ? tax - cgst : 0;
igst = supplyType === 'inter_state' ? tax : 0;
```

### 4.2 What the caller actually feeds it

`services/api-gateway/src/execution/order-execution.adapter.ts:258-268, 320-334`:

- supplier state ← `sites.gst_state_code` (**not** `tax_registrations`)
- recipient state ← `shipping_address.state_code` ‖ `shipping_address.stateCode` ‖
  `orders.place_of_supply_state` — **ship-to**, which is the right input for goods
- `place_of_supply_state_code: recipientStateCode` — explicit, ship-to

The *checkout-time* path uses a **different supplier source**
(`checkout-payment-routes.ts:300-323`: `tax_registrations.state_code ‖ GSTIN prefix`) and a
**different recipient source** (`body.customer.address.stateCode` only, no `place_of_supply_state`
fallback). See gap **G-H-09**.

### 4.3 Fallback ordering hazard (B2B)

When `place_of_supply_state_code` is absent, POS falls back to `recipient.state_code`
(`checkout-core:836-837`), and `recipient.state_code` itself falls back to the **recipient's GSTIN
prefix** (`checkout-core:738`). For a B2B order shipped to a state other than the buyer's
registration state, this silently sets POS = buyer's registration state rather than ship-to.
Whether that is correct depends on the supply type and Section 10 rules —
`INFERRED-FROM-PRACTICE-NOT-REPO`, **route to CA** (§13, CA-04).

### 4.4 Special cases the function does NOT handle (`NOT_IMPLEMENTED`, all of them)

- Export / zero-rated supply / SEZ (state code `99` is not even representable — §1.2)
- Bill-to / ship-to three-party supplies
- Services vs goods (a single rule for both; no SAC-specific POS)
- Reverse charge (RCM) — no column, no flag, no code
- Unregistered recipient with no address (Section 10 default rules)
- Deemed exports
- OIDAR / e-commerce operator special provisions
- `97` (Other Territory) is accepted but has no special handling

---

## 5. Computation

### 5.1 Per-line arithmetic — `packages/checkout-core/src/index.ts:793-828`

```
797  lineAmountMinor  = max(0, unit*qty - discount)
799  taxable          = tax_inclusive ? round(line*10000/(10000+rate_bps)) : line
802  tax              = tax_inclusive ? line - taxable : round(taxable*rate_bps/10000)
805  total            = taxable + tax
806  cgst = floor(tax/2); sgst = tax - cgst; igst = (inter) ? tax : 0
```

`CODE_IMPLEMENTED`, in **integer minor units inside the function**. Rounding is `Math.round`
(half-up for positives), **per line**, with **no invoice-level rounding and no round-off line**.

### 5.2 Inclusive vs exclusive — **the store setting is ignored** (`BROKEN`)

`sites.tax_inclusive boolean DEFAULT true` (`000_baseline.sql:12001`) is settable from the web
merchant app (`apps/merchant-control-plane/src/app/[store]/settings/taxes/page.tsx:207`) and the
mobile app (`apps/mobile/merchant-app/lib/screens/settings/taxes_screen.dart:78`), and the gateway
persists it (`services/api-gateway/src/routes/stores.ts:725`).

**No GST computation path reads it.** Both callers hard-code exclusive:

- `services/api-gateway/src/execution/order-execution.adapter.ts:309` — `tax_inclusive: false`
- `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:358` — `tax_inclusive: false`

The DB **default is `true`**, so an untouched store is configured tax-inclusive while the engine
computes tax-exclusive. → gap **G-H-07**.

### 5.3 Discount ordering — **discounts are excluded from the taxable value** (`BROKEN`)

- `order-execution.adapter.ts:307` — `discount_amount_minor: 0` **hard-coded** for every line.
- `checkout-payment-routes.ts:356` — `discount_amount_minor: 0` **hard-coded**.
- `create_checkout_order` applies the coupon **after** tax:
  `170_v1_shipping_rates_gst.sql:198` — `v_grand_total := subtotal + shipping + tax - discount`.

So the tax base is the **undiscounted** subtotal. `INFERRED-FROM-PRACTICE-NOT-REPO`: a discount
known at the time of supply and shown on the invoice ordinarily reduces the taxable value, so this
overstates output GST — but that is a CA determination, not mine (§13, CA-02). Independently and
regardless of tax law: **the generated invoice shows no discount at all, so
`invoice.total_amount_minor` ≠ `orders.total`** — a pure arithmetic inconsistency
(gap **G-H-06**, `[HIGH-STAKES]`).

### 5.4 Shipping tax — never applied (`NOT_IMPLEMENTED`)

Both rate lookups filter `.eq('is_shipping', false)`
(`order-execution.adapter.ts:287`, `checkout-payment-routes.ts:314`). No shipping line is ever added
to `invoice.lines` (lines are built solely from `order_items`,
`order-execution.adapter.ts:295-311`). `order_shipping_lines` rows are created by the RPC
(`170:344-359`) with no tax columns. The pricing catalogue nevertheless markets **"GST on
shipping — Apply GST to shipping charges"** as a Launch-plan feature
(`database/supabase/migrations/183_v1_pricing_recompete.sql:174`). → gap **G-H-08**.

### 5.5 Gift cards, COD, cess, TCS

| Item | Finding | Evidence |
|------|---------|----------|
| Gift card **issue** | Merchant-issued via `issue_gift_card` RPC; **no tax computed, no invoice, no voucher-supply handling** | `services/api-gateway/src/routes/gift-cards.ts:88-93`; grep `gst\|tax` over `173_v1_gift_card_issuance_lifecycle.sql` → zero hits |
| Gift card **redemption** | Applied **after** the grand total: `v_payment_due := grand_total - gift_card_amount`, and `orders.total = v_payment_due` | `170:288`, `:295` |
| → consequence | The invoice value (`grand_total`, tax-inclusive of the full supply) and `orders.total` (net of the voucher) **diverge by design**. Treating the voucher as a tender rather than a discount is `INFERRED-FROM-PRACTICE-NOT-REPO` plausible, but the code never records the distinction on the invoice. **CA item** (§13, CA-05) | — |
| COD | No tax difference; COD and prepaid share the identical path | `170` has no COD branch in the tax block |
| **Cess** | **Absent entirely.** No `cess` column on `gst_invoices`, no cess field in `GeneratedGstInvoiceLine`, no cess rate anywhere | grep `cess` → zero relevant hits |
| **TCS (Sec. 52)** | Column + field exist (`gst_invoices.marketplace_tcs_bps`, `tcs_amount_minor`; `checkout-core:859-860`) but the only caller passes **`marketplace_tcs_bps: 0`** | `order-execution.adapter.ts:333` |

### 5.6 Money representation — **R-8 / PAY-R5 violated on the whole tax path** (`[HIGH-STAKES]`)

Constitutional rule: *"`bigint` minor units (paise) on every money path. MUST NOT introduce … numeric-rupee … or float for money"* (`AGENTS.md:249`, PAY-R5).

Reality on the tax path:

| Location | Representation |
|----------|----------------|
| `orders.tax` | `numeric(12,2)` rupees (`000_baseline.sql:10133`, widened by `109_orders_money_width.sql`) |
| `order_items.taxable_amount`, `cgst_amount`, `sgst_amount`, `igst_amount` | `numeric(10,2)` rupees | `000_baseline.sql:10039-10042` |
| `create_checkout_order` `p_tax_amount`, `v_tax_amount`, `v_grand_total` | `NUMERIC(12,2)` rupees | `170:47`, `:61`, `:65` |
| `checkout_sessions.tax_total` | numeric rupees | `170:312`, `:331` |
| `tax_rates.rate` | `numeric(5,4)` fraction | `000_baseline.sql:12487` |
| Conversions | `invoice.tax_amount_minor / 100` (float), `line.cgst_amount_minor / 100`, `majorToMinor()` = `round(value*100)` | `order-execution.adapter.ts:344`, `:358-362`, `:110-112`; `checkout-payment-routes.ts:364` |

Only `gst_invoices` (dead) and `merchant_billing_invoices` use `bigint` minor units. → gap **G-H-10**.

### 5.7 CGST/SGST asymmetry and rounding gaps

- `cgst = floor(tax/2)`, `sgst = tax - cgst` (`checkout-core:806-807`): for an odd paise tax, SGST
  exceeds CGST by 1 paise. `INFERRED-FROM-PRACTICE-NOT-REPO` — CGST and SGST are normally equal;
  CA item (§13, CA-03).
- No invoice-level rounding to the nearest rupee and no round-off line item.
- Rounding is per-line; per-line-sum vs per-invoice-computation differences are not reconciled.

---

## 6. OUTPUT GST from sales/orders — where computed, where stored

### 6.1 The two computation sites

| # | Site | When | Reads | Writes |
|---|------|------|-------|--------|
| A | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:298-369` | before `create_checkout_order` | `tax_registrations` (supplier) + `tax_rates` + **`products.price`** | passes `tax_amount` (rupees float) into the RPC → `orders.tax`, `checkout_sessions.tax_total` |
| B | `services/api-gateway/src/execution/order-execution.adapter.ts:233-372` | post-commit | `sites.gstin/gst_state_code` (supplier) + `tax_rates` + **`order_items.unit_price`** | `orders.gst_invoice_number`, `orders.gst_invoice`, `orders.place_of_supply_state`, `orders.customer_gstin`, `orders.tax`; per-line `order_items.hsn_code/gst_rate/taxable_amount/cgst_amount/sgst_amount/igst_amount` |

**These two disagree by construction.** Different supplier source, different price source (A ignores
`variantId` entirely — `checkout-payment-routes.ts:338-348` selects `products.price` and never joins
variants), different recipient-state fallbacks. B then **overwrites `orders.tax`
(`order-execution.adapter.ts:344`) without recomputing `orders.total`** — so if the two ever differ,
the amount charged (`orders.total`, set at `170:295`) permanently mismatches the tax on the invoice
and on the line items. → gaps **G-H-09**, **G-H-28**.

### 6.2 The RPC does not re-derive tax

`170:158-159` — `-- (b) GST: when the gateway has computed tax server-side, accept it; otherwise 0.`
followed by `v_tax_amount := COALESCE(p_tax_amount, 0);`. The SECURITY DEFINER money RPC performs
**no validation** of the tax it is handed. It is server-authoritative in the sense that the value
comes from the gateway rather than the browser, but it is not DB-authoritative.

### 6.3 Failure handling — silent, both sides

- Path A: `try { … } catch { computedTaxAmount = null; }` with the comment
  *"GST computation is best-effort; fall through to 0 if it fails."*
  (`checkout-payment-routes.ts:366-369`). **A thrown error becomes ₹0 GST on a real order.**
- Path B: fire-and-forget —
  `c.executionCtx.waitUntil(service.completeOrderPostCommitWork(...).catch(err => console.error(...)))`
  (`checkout-payment-routes.ts:396-409`). A failure logs `storefront.checkout.post_commit_failed`
  and the order is left permanently invoice-less. **No retry, no dead-letter, no queue job, no
  merchant-visible alert.** → gap **G-H-29**.

### 6.4 Storage summary

| Store | Table/column | Mutable? |
|-------|--------------|----------|
| Canonical (intended) | `gst_invoices` | immutable via trigger — **but never written** |
| Actual | `orders.gst_invoice jsonb`, `orders.gst_invoice_number text` | **fully mutable**, plain `.update()` from TypeScript |
| Line detail | `order_items.{hsn_code,gst_rate,taxable_amount,cgst_amount,sgst_amount,igst_amount}` | mutable numeric rupees |
| Session snapshot | `checkout_sessions.tax_total` | mutable |

`orders` and `order_items` are **not** in the canonical-ledger-only validator's money-table list
(`scripts/validators/canonical-ledger-only-validator.mjs:12-26`), so direct TypeScript `.update()`
of tax amounts is not caught by any governance gate.

---

## 7. INVOICES

### 7.1 Creation trigger

`CODE_IMPLEMENTED`, one path only: `completeOrderPostCommitWork` → `generateAndPersistGstInvoice`
(`order-execution.adapter.ts:196-231`, `:233`). Invoked only from
`checkout-payment-routes.ts:395-409`, and only when
`isCheckoutPostCommitDeferralEnabled(c.env)` — otherwise inline at `:193`. No invoice is created on
payment confirmation, on fulfilment, or on demand. There is **no merchant "generate invoice"
action** anywhere.

### 7.2 Numbering scheme — **not a GST-shaped serial** (`PARTIAL`)

Two competing schemes:

| Scheme | Value | Where |
|--------|-------|-------|
| Adapter (live path) | `${sites.invoice_prefix ?? 'LBY'}-${orders.order_number}` | `order-execution.adapter.ts:313`, `:317` |
| `checkout-core` default (used by `/tax/calculate` and the unit test) | `LBY-${YYYYMMDD}-${orderNumber}` | `checkout-core/src/index.ts:749-753` |

`orders.order_number` is **random**, not sequential:
- `LB-YYYYMMDD-<8 hex of a uuid>` — `166_d6_checkout_handoff_inventory.sql:68-69`
- legacy trigger: `ORD-YYYYMMDD-<random 4 digits>` — `000_baseline.sql:4228-4234`

`sites.invoice_number_next integer DEFAULT 1` exists
(`122_mobile_business_profile.sql:9`), is settable through the gateway allow-list
(`stores.ts:727`), and is **never read or incremented by anything**.

**Per-financial-year uniqueness: NOT enforced anywhere.**

| Index | Definition | FY component? |
|-------|------------|---------------|
| `gst_invoices_site_number_idx` | `UNIQUE (site_id, invoice_number) WHERE deleted_at IS NULL` (`144:118-120`) | **No** |
| `idx_orders_store_gst_invoice_number` | `UNIQUE (store_id, gst_invoice_number) WHERE gst_invoice_number IS NOT NULL` (`000_baseline.sql:17745`) | **No** |

Cross-site collision is prevented (both are site-scoped). FY rollover is not modelled at all — there
is no financial-year column, no FY reset, and no consecutive series. `INFERRED-FROM-PRACTICE-NOT-REPO`:
Rule 46(b) requires a consecutive serial number unique for a financial year — CA item (§13, CA-06).
→ gap **G-H-05**.

### 7.3 Immutability — real trigger on a table nothing writes; **application-convention only where it matters**

`CODE_IMPLEMENTED` and genuinely enforced *on `gst_invoices`*:

```sql
144:126-143
CREATE FUNCTION public.reject_gst_invoice_mutation() … RAISE EXCEPTION 'gst_invoices are immutable…'
CREATE TRIGGER gst_invoices_reject_update BEFORE UPDATE … FOR EACH ROW …
CREATE TRIGGER gst_invoices_reject_delete BEFORE DELETE … FOR EACH ROW …
```
Proven by real-Postgres assertions at `tests/executable/tax-postgres.test.mjs:172-173`.

But **the invoice the shopper and the merchant actually get lives in `orders.gst_invoice jsonb`**,
which has **no trigger, no REVOKE, no immutability of any kind**, and is written with a plain
service-role `.update()` (`order-execution.adapter.ts:337-348`). Anything holding the service-role
key can rewrite a issued invoice with no trace.

**Side effect of the trigger being `BEFORE UPDATE` on every row:** the `status = 'voided'` value
allowed by `gst_invoices_status_check` (`144:102`) and the `deleted_at` soft-delete column are both
**unreachable** — setting either requires an `UPDATE`, which always raises. Therefore:
- there is **no cancellation/void path** for a GST invoice;
- the two partial unique indexes `WHERE deleted_at IS NULL` are vacuous (`deleted_at` can never
  become non-null);
- the `update_updated_at()` trigger pattern applied to sibling tables is deliberately not applied
  here, so `updated_at` is frozen — consistent, but confirms nothing can ever change.

The test asserts this as *correct*: `assert.match(psqlError("UPDATE public.gst_invoices SET status = 'voided';"), /immutable/)` (`tax-postgres.test.mjs:172`). → gap **G-H-04**.

### 7.4 Credit note / debit note — **absent** (`NOT_IMPLEMENTED`, `[HIGH-STAKES]`)

Repo-wide grep for `credit_note|creditNote|credit note|debit_note|debit note` over
`*.ts *.tsx *.sql *.mjs *.dart` (excluding `node_modules`, `graphify-out`, `docs/archive`,
`.claude/worktrees`) returns exactly **two** hits, both prose:

- `docs/lcis-master/_evidence/panel-commerce.md:48` — an analyst note.
- `apps/marketing-site/src/lib/legal/content/money.ts:65` — **a live public legal page** stating
  *"A correction is made by a credit note against the original, never by editing it — this is both a
  legal requirement and how the ledger is built."*

There is no credit-note table, column, route, type, or code path. The same legal page also asserts
the platform *"issues an invoice against each order"*
(`apps/marketing-site/src/lib/legal/content/money.ts:64`) — contradicted by §0. → gap **G-H-03**.

`gst_invoices.taxable_amount_minor >= 0` and the sibling CHECKs (`144:90-95`) also forbid a negative
document, so a credit note could not even be represented in the existing table without schema
change.

### 7.5 Amendment handling

`NOT_IMPLEMENTED`. No amendment table, no revision number, no supersede pointer, no
`original_invoice_id`.

### 7.6 IRN / QR / e-invoice — a local hash presented as an acknowledgement

`packages/checkout-core/src/index.ts:755-772`:

```ts
function stableTaxHash(input) { /* FNV-1a over the string */ }
function buildSandboxIrpAcknowledgement(invoiceNumber, orderId, invoiceDate) {
  const irn = `SANDBOX-IRN-${stableTaxHash(...).toUpperCase()}`;
  return { mode: 'sandbox', irn, qr_payload: `letbuyy://gst-invoice/${encodeURIComponent(irn)}`,
           acknowledged_at: invoiceDate };
}
```

`CODE_IMPLEMENTED`. **No network call to any IRP.** The value is a 32-bit hash of
`invoiceNumber:orderId:invoiceDate`. The `qr_payload` is a `letbuyy://` custom-scheme string, not a
GST QR payload.

**Can the mock read as success? Partly yes — three ways:**

1. **The live-mode gate is not applied to the generating path.** `assertSandboxIrpMode(c.env)` is
   called only in `POST /tax/calculate` (`services/api-gateway/src/routes/tax.ts:89`). The path that
   actually persists invoices — `generateAndPersistGstInvoice` — never checks
   `LETBUYY_GST_IRP_MODE`. Setting the env var to `live` would block the unused endpoint while the
   real path keeps minting fake IRNs.
2. **The env var is undeclared.** `LETBUYY_GST_IRP_MODE` appears in the Env type
   (`services/api-gateway/src/index.ts:116`) but in **no** wrangler config and **not** in
   `config/env/schemas/worker.schema.json` (grep → zero hits). It is always `undefined` → always
   `'sandbox'`.
3. **The persisted record carries an `irp_mode` default of `'sandbox'`** (`144:98`) — honest — but
   `orders.gst_invoice` (the record actually used) has **no mode column**; the mode lives only
   inside the jsonb under `irp.mode`, and the merchant order page never renders it.

The one thing that *is* honest: the string is labelled `SANDBOX-IRN-`, and a validator enforces the
label — but only the label:

```
scripts/validators/provider-mode-badge-validator.mjs
  reporter.assert(checkoutCore.includes("SANDBOX-IRN-"), …)
  reporter.assert(!checkoutCore.includes("MOCK-IRN-"), …)
  reporter.assert(taxRoute.includes("irp_mode: 'sandbox'"), …)
  reporter.assert(!taxRoute.includes("irp_mode: 'mock'"), …)
```
This is a **string-substitution ratchet**: it forbids the word "mock" and mandates the word
"sandbox" in two files. It does not check that any IRP is called, does not cover
`order-execution.adapter.ts`, and does not cover `billing.ts` (§11.2), which writes
`irn: 'sandbox-irn-…'` into a persisted invoice unconditionally in every environment.
→ gap **G-H-14** (`[HIGH-STAKES]`, ANTI-R9 exposure).

---

## 8. Refund / return tax consequences

`NOT_IMPLEMENTED` (`[HIGH-STAKES]`).

- `complete_order_refund` (`database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:314`)
  contains **zero** occurrences of `gst`, `tax`, or `invoice` (grep over the whole migration).
- `refunds` has `amount numeric(12,2)` and **no tax columns at all**
  (`000_baseline.sql:11134-11159`).
- `order_items.returned_quantity` / `refunded_quantity` exist (`000_baseline.sql:10034-10035`) but
  no reversal of `cgst_amount` / `sgst_amount` / `igst_amount` / `taxable_amount` is performed
  anywhere.
- No credit note is produced (§7.4).
- `orders.gst_invoice` is never touched by a refund.

**Result:** after a full or partial refund, the recorded output GST for the order remains at 100% of
the original. The merchant's books overstate output tax by the refunded tax with no reversing
document. This is deterministic, not probabilistic. → gap **G-H-03** (combined credit-note + refund
reversal).

---

## 9. Reports / exports / period locking / reconciliation

| Capability | Status | Evidence |
|------------|--------|----------|
| GST report in the merchant UI | **`NOT_IMPLEMENTED`** | no route under `apps/merchant-control-plane/src/app/[store]/` matching invoice/gst/tax-report; the only tax page is `settings/taxes` (rate CRUD) |
| Invoice list / invoice view / PDF / print | **`NOT_IMPLEMENTED`** | order detail shows a single text row `<DetailRow label="GST invoice number" …>` (`apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx:276-277`) and one aggregate `Tax (GST)` amount (`:531`). No CGST/SGST/IGST breakdown, no HSN, no place of supply. |
| CSV/JSON export of invoices | **`NOT_IMPLEMENTED`** | `services/api-gateway/src/routes/export.ts` exposes only `/products`, `/orders`, `/customers` (`:686`, `:706`, `:727`); grep `gst\|tax\|invoice` over the file → zero hits |
| GSTR-1 / GSTR-3B / HSN summary / B2B-B2C split | **`NOT_IMPLEMENTED`** | repo-wide grep `gstr\|gstr1\|gstr-1\|gstr3b\|anx-1` → zero product hits |
| e-way bill | **`NOT_IMPLEMENTED`** | grep `e-way\|eway` → zero hits |
| Tax figures in analytics | **`NOT_IMPLEMENTED`** | grep `gst\|tax` over `services/api-gateway/src/routes/analytics.ts` + `commerce-analytics.ts` → zero hits |
| **Period locking** (close a tax period) | **`NOT_IMPLEMENTED`** | no period/lock table, no `locked_at`, no filing-period concept anywhere |
| Reconciliation orders ↔ invoices ↔ ledger | **`NOT_IMPLEMENTED`** | no reconciliation RPC, view, job, or report that joins `orders.tax` to invoice totals or to `ledger_entries` |
| Customer-facing invoice | **`NOT_IMPLEMENTED`** | no GST line in the storefront checkout summary (`checkout-client.tsx:1053-1090` shows Subtotal / Delivery / Discount / Total only); nothing on the success page or the customer orders page; **no tax line in the order confirmation email** (grep `tax\|gst\|cgst` over `services/api-gateway/src/lib/order-confirmation-email.ts` → zero hits); no invoice attachment |
| `/v1/tax/*` reachable from any app | **`NOT_IMPLEMENTED`** | `api.route('/tax', taxRouter)` exists (`services/api-gateway/src/index.ts:803`) but there is **no** app proxy (`apps/merchant-control-plane/src/app/api/stores/[store]/` has no `tax`/`invoices` dir) and **no** api-client method (`packages/typescript/api-client/src/index.ts` exposes only `/shipping-tax/*`, `:5201-5209`) |

Latent UI defect: the storefront checkout total is computed client-side as
`cartTotal + delivery − discount` with **no tax line**, while the server adds `v_tax_amount` into
`v_grand_total` (`170:198`). Today tax is always 0 so the numbers agree; **the moment GST is wired,
the shopper will be charged more than the displayed total with no explanatory line item.**

---

## 10. INPUT GST from purchases

**`NOT_IMPLEMENTED` in full.** (Coordinated conceptually with Agent D's purchasing scope; verified
independently here from the GST side.)

| Item | Finding | Evidence |
|------|---------|----------|
| Supplier GSTIN | **absent** — `suppliers` has `name, contact_name, email, phone, address jsonb, status, metadata` and no GSTIN column | `000_baseline.sql:12460-12476` |
| PO tax columns | **absent** — `purchase_orders` has no tax/GST/HSN columns | `000_baseline.sql:5128-5139` |
| PO line tax | **absent** — `purchase_order_lines` has `unit_cost`, `total_cost` only | `000_baseline.sql:5100-5120` |
| Purchase invoice / bill document | **absent** | no table |
| ITC (input tax credit) tracking | **absent** | grep `input_tax\|itc\|input credit` → zero hits |
| GSTR-2A/2B reconciliation | **absent** | — |

**What the GST layer can consume from purchase data today: nothing.** There is no input-tax value
anywhere for the GST layer to read. A merchant cannot compute net GST payable inside LetBuyy.

---

## 11. Parallel GST implementations (WIN-R4 / ANTI-R1 exposure)

I found **four** independent GST implementations. The Constitution forbids parallel second systems
for a domain that has a canonical winner (`AGENTS.md:146`, WIN-R4).

### 11.1 Canonical merchant sales GST
`packages/checkout-core/src/index.ts:793-879` — analysed above.

### 11.2 LetBuyy's own subscription invoices (`merchant_billing_invoices`) — **worst of the four**

`services/api-gateway/src/routes/billing.ts:115-160`:
```ts
133  .from('merchant_billing_invoices')
134  .upsert({ …
144      cgst_minor: 0,
145      sgst_minor: 0,
146      igst_minor: input.taxMinor,          // ALWAYS IGST
     …
     irn: `sandbox-irn-${input.invoiceNumber}`,
     qr_payload: `sandbox-qr:${input.invoiceNumber}`,
   }, { onConflict: 'site_id,invoice_number' })
```
and `:274` — `const taxMinor = Math.round(amount.amountMinor * 0.18);`

Findings (`[HIGH-STAKES]`, this is **the merchant's input tax** — the document a merchant would use
to claim ITC on LetBuyy's fees):

1. **Rate hard-coded 18%** in TypeScript.
2. **Always booked as IGST**, never CGST/SGST — **no place-of-supply computation at all**. LetBuyy's
   own supplier state is never determined; the merchant's state is never read.
3. **No GSTIN columns on the table whatsoever** — `merchant_billing_invoices` has
   `subtotal_minor, cgst_minor, sgst_minor, igst_minor, total_minor, irn, qr_payload, metadata` and
   no supplier GSTIN, no recipient GSTIN, no place of supply, no HSN/SAC
   (`152_executable_billing_autopay.sql:124-158`). The GSTIN the merchant enters in
   `settings/billing/profile` cannot reach this document.
4. **Invoice number is random and only site-unique**: `MBI-${crypto.randomUUID().slice(0,8).toUpperCase()}`
   (`billing.ts:273`) with `UNIQUE (site_id, invoice_number)` (`152:157`). LetBuyy is a single
   supplier issuing one series; **two different merchants can legitimately receive LetBuyy invoices
   bearing the same number.**
5. **`.upsert()` — mutable.** No immutability trigger, no reject-mutation function. A `status =
   'void'` value exists (`152:148`) and, unlike `gst_invoices`, is actually reachable — but there is
   no credit note either.
6. **Fake IRN/QR persisted unconditionally in every environment** with no mode column and no
   validator coverage.

### 11.3 Theme marketplace (FROZEN app, still wired into the gateway)

`services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts`:
- `:55` `const THEME_MARKETPLACE_GST_RATE = 18;` — hard-coded
- `:56` `const THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5';` — a **placeholder GSTIN literal in
  source**, used whenever the runtime is not production-like (`:83`)
- `:91-93` inclusive back-calculation `amount * 18 / 118` in **floating-point rupees**
  (`Number(...toFixed(2))`)
- storage: `theme_purchase_receipts.gst_rate numeric(5,2)`, `gst_amount_inr numeric(10,2)`,
  `buyer_gstin`, `seller_gstin` (`091_theme_marketplace_stepup.sql:129-132`) — a **fifth** money
  representation
- production is fail-closed on the GSTIN (`:80-87`, `THEME_MARKETPLACE_GSTIN_REQUIRED`), tracked as
  `SKIP-THEME-MARKETPLACE-LIVE-GSTIN` in `SKIPPED_HUMAN_DECISIONS.md:58` — this part is honest.

### 11.4 Partner payouts (queue-workers)

`services/queue-workers/src/platform-queue-consumer.ts:1330-1340` —
`clampBps(payload.partner_gst_bps, 1800)` and
`partnerGstMinor = round(partnerAmountMinor * partnerGstBps / 10000)`. A fourth hard-coded 18%,
computed in a worker, with no place of supply.

→ gap **G-H-12** (billing), **G-H-27** (parallel systems).

---

## 12. Contradictions between documentation and code

| Doc claim | Where | Reality |
|-----------|-------|---------|
| *"**GST** place-of-supply (CGST/SGST vs IGST + HSN + inclusive/exclusive) + **immutable GST invoice** (IRN/QR via mock IRP) + TCS are **built**"* | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:240` (ART-15) | HSN is never used for rate resolution (§3); inclusive/exclusive is ignored (§5.2); the immutable table has no writer (§0); TCS is hard-coded 0 (§5.5) |
| *"Forbids … Invoicing without correct place-of-supply GST"* | `LETBUYY_CONSTITUTION.md:242` | the live path invoices with **no GST at all** (§0) |
| *"GST breakdown shown at checkout"* | `docs/ui-standards/india-localization.md:7` | no GST line in the storefront checkout summary (`checkout-client.tsx:1053-1090`) |
| *"GSTIN capture (B2B)"* | `docs/ui-standards/india-localization.md:7` | no GSTIN field on the storefront checkout (§2) |
| *"issues an invoice against each order"* + *"A correction is made by a credit note"* | `apps/marketing-site/src/lib/legal/content/money.ts:64-65` (**public legal page**) | invoices are silently skipped (§0); credit notes do not exist (§7.4) |
| Pricing catalogue: *"GST tax invoices — Issue GST-compliant invoices automatically"*, *"GST on shipping"*, *"Tax-inclusive pricing"*, *"GST state code — Place-of-supply handling"* — all marked available on the Launch plan | `database/supabase/migrations/183_v1_pricing_recompete.sql:143,174,179-183` | shipping GST never applied (§5.4); tax-inclusive ignored (§5.2); state code never captured (§2) |
| *"GST \| PASS \| server-side CGST/SGST/IGST; immutable `gst_invoices` table"* | `docs/final-v1-certification/MERCHANT_JOURNEY_AUDIT.md:13` | graded PASS despite §0 |
| *"GST — SOUND compute, mutable persistence (−) … **Deduction: Med**"* | `docs/final-v1-certification/MONEY_SYSTEM_AUDIT.md:19-20,31` | correctly spots the mutable-column issue but grades it **Med** and misses that the path never fires, that there are no credit notes, no refund reversal, and no reports |
| *"Tax/GST … **APPROVED**"* | `docs/archive/root-governance-2026-06-10/directories/FORENSIC_MASTER_2026_06_10/ARCHITECTURE_COMPLIANCE_AUDIT.md:117` (archive — cited only to show the claim is stale) | same |
| *"Engine is a complete pure function (checkout-core:793–879) that **nothing calls at confirm** — invoke it in order creation"* | `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md:124` | **the most accurate doc.** It has since been wired, but into a path that cannot fire |

---

## 13. CA / TAX-COUNSEL REVIEW ITEMS

**`LEGALLY_VALIDATED`: NONE of the following has any professional sign-off in this repository.**
I am not qualified to answer any of them; they are listed as questions, not conclusions.

| ID | Question for the CA / tax counsel | Repo anchor |
|----|-----------------------------------|-------------|
| CA-01 | Is LetBuyy an e-commerce operator under s.52 (TCS) given the never-custody / merchant-of-record model, and if so what must be collected and filed? `marketplace_tcs_bps` is hard-coded 0. | `order-execution.adapter.ts:333` |
| CA-02 | Must a coupon/promotion discount reduce the taxable value on the invoice? Today the tax base is the pre-discount subtotal and the invoice shows no discount. | `170:198`; `order-execution.adapter.ts:307` |
| CA-03 | Is a 1-paise CGST/SGST asymmetry acceptable, and what is the required per-invoice rounding (including a round-off line)? | `checkout-core:806-807` |
| CA-04 | For a B2B order shipped to a state other than the buyer's registration state, what is the correct place of supply, and is the current fallback (POS ← recipient GSTIN prefix) wrong? | `checkout-core:836-838`, `:738` |
| CA-05 | Correct treatment of gift-card issue and redemption (voucher rules), and how it must appear on the invoice. Today issue is untaxed and redemption reduces `orders.total` below the invoice value. | `170:288-295`; `gift-cards.ts:88` |
| CA-06 | Required invoice serial format: consecutive, FY-scoped, and reset. Current numbers are random and FY-agnostic. | `166:68`; `144:118-120` |
| CA-07 | Composition-scheme merchants must issue a *bill of supply*, not a tax invoice. The flag is captured but never read. | `144:12-13` |
| CA-08 | Whether shipping/delivery charges are a taxable supply at the goods rate or separately, and how they must appear. Today they are untaxed. | `order-execution.adapter.ts:287` |
| CA-09 | Whether any of the merchant's catalogue attracts **cess**. Cess is unrepresentable in the schema. | `144:78-112` |
| CA-10 | Multi-GSTIN / multiple place-of-business merchants: which registration applies to which order, and can the platform support them at all today? | `144:28-30`; `checkout-payment-routes.ts:300-307` |
| CA-11 | Exports, SEZ, zero-rated supplies, and RCM — none representable (state code 99 unsupported, no RCM flag). Must these be blocked before launch? | `shared-types/src/index.ts:71-74` |
| CA-12 | Retention, immutability and audit requirements for issued invoices — is a mutable jsonb column acceptable? | `order-execution.adapter.ts:337-348` |
| CA-13 | LetBuyy's **own** subscription invoices to merchants: correct CGST/SGST vs IGST determination, mandatory fields (both GSTINs, POS, SAC), a single consecutive series across all merchants, and whether the current always-IGST + random-number + upsert-mutable model is acceptable. | `billing.ts:143-146`, `:273-274`; `152:124-158` |
| CA-14 | Sign-off on the public legal-page claims about invoices and credit notes before they remain live. | `apps/marketing-site/src/lib/legal/content/money.ts:64-65` |
| CA-15 | e-invoicing (IRP) applicability thresholds, and confirmation that a locally hashed `SANDBOX-IRN-…` value must never be presented to a merchant or shopper as an IRN. | `checkout-core:764-772`; `billing.ts:143-144` |

### MUST NOT SHIP WITHOUT PROFESSIONAL REVIEW
1. Any invoice presented to a shopper or a merchant as a **tax invoice**.
2. Any IRN/QR value (all current values are locally generated, not IRP-issued).
3. LetBuyy's **own** subscription invoices (`merchant_billing_invoices`) — always-IGST, no GSTINs,
   non-unique series across merchants.
4. The public legal-page GST claims (`money.ts:53-68`).
5. Any GST figure surfaced in reporting (there is none today — do not add one from `orders.tax`,
   which is unreliable per §6.1).

---

## 14. TESTS — what they actually assert

| File | What it is | Real coverage |
|------|------------|---------------|
| `tests/gst/gst-invoice.test.mjs` (181 lines) | The **only behavioural GST test**. Two cases: same-state → CGST/SGST; different-state → IGST. Single line, ₹1000, 18%, exclusive, no discount. | intra vs inter split; default invoice number `LBY-20260601-LBY-1001` (`:152`) |
| `services/api-gateway/src/__tests__/tax.test.ts` (49 lines) | **Source-text regex assertions only.** e.g. `assert.doesNotMatch(checkoutCoreSource, /MOCK-IRN-/)` (`:34`) | nothing behavioural |
| `tests/executable/tax-postgres.test.mjs` (178 lines) | Real Postgres. Applies mig 144, inserts one `gst_invoices` row **by hand**, asserts RLS isolation by site GUC and that UPDATE/DELETE raise `immutable` (`:160-173`), then rolls back | tenant isolation + immutability of a table nothing writes |
| `tests/launch/lb7-shipping-gst.test.mjs` (28 tests) | **All source-text greps** — "migration declares p_tax_amount", "route imports calculateGstLine", etc. | nothing behavioural |

**Not covered by any test:** state-code combinations beyond 2, rounding edges, odd-paise CGST/SGST
split, tax-inclusive pricing, discounts, shipping tax, partial/full refunds, credit notes, invoice
numbering uniqueness or FY rollover, concurrency, the end-to-end order→invoice path, the
`generateAndPersistGstInvoice` early-return branches, `merchant_billing_invoices` tax split, or any
GST report. → gap **G-H-24**.

---

## 15. END-TO-END TRACE

### 15.1 Storefront order → output GST → invoice (the live path)

| Link | Status | Evidence |
|------|--------|----------|
| Shopper enters address (state = free text) | present | `checkout-client.tsx:793-801` |
| **Shopper state CODE captured** | **MISSING** | no `stateCode` field or input anywhere |
| **Shopper GSTIN captured** | **MISSING** | no input; `buildOrderPayload` omits it (`checkout-client.tsx:346-353`) |
| Storefront proxy `/api/orders` → gateway | present | `apps/storefront-runtime/src/app/api/orders/route.ts` |
| Typed api-client method | **MISSING** — the storefront posts raw JSON; api-client has no checkout method for this path | `packages/typescript/api-client/src/index.ts` (no `/storefront/checkout` method) |
| Gateway `/v1/storefront/.../orders` | present | `checkout-payment-routes.ts` |
| Auth issuer + `verifySiteOwnership` | N/A — public storefront checkout, store resolved by host | `checkout-payment-routes.ts` |
| Supplier tax registration lookup | present but **reads a table with no writer** | `:300-307` |
| Server-authoritative tax computation | present, but **always yields `null`** (supplier state null) | `:334`, `:364-369` |
| `create_checkout_order` RPC (SECURITY DEFINER) | present; `v_tax_amount := COALESCE(p_tax_amount, 0)` → **0** | `170:159` |
| `orders.tax`, `checkout_sessions.tax_total` written | present, value 0 | `170:293`, `:331` |
| Post-commit invoice generation | present, fire-and-forget | `checkout-payment-routes.ts:396-409` |
| Supplier state from `sites.gst_state_code` | present; **returns null → no invoice** if unset | `order-execution.adapter.ts:258-259` |
| Recipient state / GSTIN | **MISSING from the payload → `return null`** | `:262-268` |
| HSN per line from `hsn_rates` | **MISSING** — table never read | §3 |
| Rate per line | store-wide default only | `:282-294` |
| Discount into the tax base | **MISSING** — hard-coded 0 | `:307` |
| Shipping line on the invoice | **MISSING** | §5.4 |
| Tax-inclusive flag honoured | **MISSING** — hard-coded false | `:309` |
| IRP call | **MISSING** — local hash | `checkout-core:764-772` |
| Persist to `gst_invoices` | **MISSING** — writes `orders.gst_invoice` jsonb instead | `:337-348` |
| Recompute `orders.total` after tax overwrite | **MISSING** | `:344` (tax updated, total untouched) |
| Shopper sees GST at checkout | **MISSING** | `checkout-client.tsx:1053-1090` |
| Shopper receives an invoice (page or email) | **MISSING** | §9 |
| Merchant sees a GST breakdown / invoice document | **MISSING** — one number + one string | `orders/[orderId]/page.tsx:276-277`, `:531` |
| Merchant can export GST data | **MISSING** | §9 |
| Refund reverses output GST / raises a credit note | **MISSING** | §8 |
| Behavioural test of this chain | **MISSING** | §14 |
| Runtime observation | **MISSING** — none performed | — |

### 15.2 Merchant subscription (LetBuyy → merchant; the merchant's input tax)

| Link | Status | Evidence |
|------|--------|----------|
| Merchant enters GSTIN + billing state at checkout | present in the UI | `apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:125`, `:131`, `:542-545` |
| UI promises *"GST invoice included"* / *"Used for payment and your GST invoice"* | present | `:383`, `:512` |
| **GSTIN/state sent to the server** | **MISSING** — the POST body is `{store_id, plan_slug, billing_period, site_type, coupon_code}` only | `:262-272` |
| Gateway computes tax | present, hard-coded 18% | `billing.ts:274` |
| Place-of-supply determination | **MISSING** — always IGST | `billing.ts:143-146` |
| Supplier/recipient GSTIN on the invoice | **MISSING** — no such column | `152:124-158` |
| Consecutive series across merchants | **MISSING** — random, site-unique | `billing.ts:273`; `152:157` |
| Immutability | **MISSING** — `.upsert()` | `billing.ts:133-156` |
| IRN honesty | **MISSING** — `sandbox-irn-…` persisted in all environments | `billing.ts:143-144` |
| Merchant can download the invoice | reads exist (`select('*, merchant_billing_invoices(*)')`, `billing.ts:431`); no PDF/export surface found | — |

---

## 16. GAPS

Severity/likelihood are my engineering assessment. Every money/tax/auth/tenancy item is tagged
`[HIGH-STAKES]`. **No remediation below proposes a direct money-table write.**

---

### G-H-01 — GST is structurally unreachable end-to-end; every storefront order books ₹0 GST and gets no invoice
- **Domain:** GST / checkout · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** Merchants who are GST-registered collect **no** GST on any order placed through the
  live storefront, and no tax invoice is ever created. Under-collection is unrecoverable from the
  shopper after the fact.
- **Evidence:**
  - `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:300-307` reads
    `tax_registrations`; that table has **zero writers** (no `.insert(`/`.upsert(` in `services/`,
    `apps/`, `packages/`) → `supplierStateCode` is always null.
  - `:334` gates the whole computation on
    `supplierStateCode && recipientStateCode && defaultRateBps > 0`.
  - `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:346-353` — the
    payload has no `stateCode` and no `gstin`.
  - `services/api-gateway/src/execution/order-execution.adapter.ts:268` —
    `if (!recipientGstin && !recipientStateCode) return null;`
  - `database/supabase/migrations/170_v1_shipping_rates_gst.sql:159` —
    `v_tax_amount := COALESCE(p_tax_amount, 0);`
- **Expected:** GST computed and an invoice issued for every taxable order of a GST-registered
  merchant.
- **Missing link / root cause:** three simultaneous breaks — (a) no write path for
  `tax_registrations`, (b) no state-code/GSTIN capture in the storefront, (c) a silent `return null`
  instead of a hard failure or an operator alert.
- **Blast radius:** every order of every GST-registered merchant; all downstream reporting.
- **Severity:** P0 · **Likelihood:** HIGH (deterministic)
- **Dependencies:** G-H-02, G-H-09, G-H-15
- **Remediation approach:** decide the single supplier-profile source of truth (`sites` vs
  `tax_registrations`) and give it a write path; capture a validated Indian state code (and optional
  buyer GSTIN) in the storefront address step; convert the silent `return null` into an explicit,
  observable, retryable failure with a merchant-visible signal; add a startup/config check that a
  GST-registered store cannot transact without a resolvable supplier state.
- **Acceptance:** a GST-registered store completes a real order and the persisted invoice shows a
  non-zero, correctly split tax matching the amount charged; a store missing tax configuration is
  blocked or loudly flagged, never silently zero-rated.
- **Tests:** integration test order→invoice for intra-state, inter-state, missing-state-code,
  missing-registration; a negative test asserting zero-tax cannot occur silently.
- **Owner:** founder + lead engineer + CA (rate/POS confirmation)
- **Reversibility:** reversible (no data destroyed) — but already-created orders cannot be corrected
  without a CA-approved procedure. · **Confidence:** HIGH

---

### G-H-02 — The immutable `gst_invoices` table has zero writers; the real invoice lives in a mutable jsonb column
- **Domain:** GST invoices · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** Every guarantee the immutability design provides (reject-UPDATE/DELETE trigger,
  CGST+SGST+IGST sum CHECK, per-site number uniqueness, RLS FORCE) applies to a table that never
  receives a row. The document actually issued is `orders.gst_invoice jsonb`, rewritable by any
  service-role caller with no audit trail.
- **Evidence:**
  - `database/supabase/migrations/144_executable_tax_gst_invoices.sql:2` — *"Single writer:
    services/api-gateway/src/routes/tax.ts -> gst_invoices"*.
  - `services/api-gateway/src/routes/tax.ts:144` — the only production reference is a `SELECT`.
  - Repo-wide: the only `INSERT INTO public.gst_invoices` is
    `tests/executable/tax-postgres.test.mjs:113`.
  - `services/api-gateway/src/execution/order-execution.adapter.ts:337-348` — plain `.update()` on
    `orders` writing `gst_invoice_number`, `gst_invoice`, `place_of_supply_state`, `customer_gstin`,
    `tax`.
  - `orders` / `order_items` are absent from
    `scripts/validators/canonical-ledger-only-validator.mjs:12-26`, so no gate catches this.
- **Expected:** issued invoices persisted to the immutable, constraint-enforced table.
- **Missing link:** the writer was never built; the migration header documents a writer that reads.
- **Blast radius:** every invoice; audit and dispute defensibility.
- **Severity:** P0 · **Likelihood:** HIGH · **Dependencies:** G-H-01, G-H-04
- **Remediation approach:** route invoice issuance through a SECURITY DEFINER RPC that inserts into
  `gst_invoices` (idempotent on `(site_id, order_id)`), keep `orders.gst_invoice` as a derived
  read-model at most, and add a validator that treats invoice/tax columns as protected the way money
  tables are.
- **Acceptance:** creating an order produces exactly one `gst_invoices` row; a second attempt is a
  no-op; a direct TypeScript write to invoice/tax columns fails the governance gate.
- **Tests:** RPC idempotency, immutability, tenant isolation; validator regression test.
- **Owner:** lead engineer + ARB · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-H-03 — No credit note / debit note, and refunds never reverse output GST
- **Domain:** GST / refunds · **Status:** `NOT_IMPLEMENTED` · **Invariant:** `[HIGH-STAKES]` `[IRREVERSIBLE]` (books state)
- **Impact:** After a refund or return the recorded output GST stays at 100% of the original with no
  reversing document, so the merchant's output tax is overstated by the refunded tax. A public legal
  page tells merchants the opposite.
- **Evidence:**
  - Repo-wide grep `credit_note|creditNote|credit note|debit_note|debit note` → only prose:
    `apps/marketing-site/src/lib/legal/content/money.ts:65` and
    `docs/lcis-master/_evidence/panel-commerce.md:48`.
  - `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql:314`
    (`complete_order_refund`) contains no `gst`/`tax`/`invoice` reference.
  - `refunds` has no tax columns — `database/supabase/migrations/000_baseline.sql:11134-11159`.
  - `gst_invoices.taxable_amount_minor >= 0` etc. forbid a negative document —
    `144:90-95`.
- **Expected:** a refund/return raises a credit note against the original invoice reversing the
  proportional CGST/SGST/IGST.
- **Missing link:** the entire credit-note model.
- **Blast radius:** every refunded or returned order; the merchant's filings.
- **Severity:** P0 · **Likelihood:** HIGH · **Dependencies:** G-H-02
- **Remediation approach:** design a credit-note document type (its own numbering series, its own
  immutability, a pointer to the original invoice) issued through a SECURITY DEFINER RPC as part of
  the existing refund flow; make the amount and split derived from the original invoice lines, never
  recomputed from current rates. Correct the marketing legal copy in the same change.
- **Acceptance:** a full refund produces a credit note whose tax exactly reverses the original; a
  partial refund reverses proportionally; the pair reconciles to zero net tax.
- **Tests:** full refund, partial refund, multi-line partial, refund-after-rate-change, idempotency,
  tenant isolation.
- **Owner:** CA-tax + lead engineer + ARB · **Reversibility:** reversible in code; historical books
  need a CA-approved correction · **Confidence:** HIGH

---

### G-H-04 — The immutability trigger makes voiding and soft-deleting a GST invoice impossible
- **Domain:** GST invoices · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** No cancellation path exists for an issued invoice. The `status='voided'` value and the
  `deleted_at` column are unreachable, and the two partial unique indexes keyed on
  `WHERE deleted_at IS NULL` are therefore vacuous.
- **Evidence:** `144:126-143` (BEFORE UPDATE **and** BEFORE DELETE, every row, unconditional raise);
  `144:102` (`status IN ('generated','voided')`); `144:107` (`deleted_at`); `144:114-120` (partial
  unique indexes); the behaviour is asserted as correct at
  `tests/executable/tax-postgres.test.mjs:172-173`.
- **Expected:** a controlled void/reversal path (the exception message itself says *"create a
  void/reversal record instead"* — but no such record type exists).
- **Missing link:** the reversal record type the trigger message assumes.
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-02, G-H-03
- **Remediation approach:** keep the invoice row immutable and model cancellation as a separate
  append-only reversal/credit-note document; drop the unreachable `voided` status and the
  `deleted_at` predicate, or make status transitions happen only through an explicit RPC path the
  trigger allows.
- **Acceptance:** cancelling an invoice produces an auditable reversal document; the original row is
  byte-identical afterwards.
- **Owner:** lead engineer + CA-tax · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-H-05 — Invoice numbers are random, not consecutive, and have no financial-year scoping
- **Domain:** GST invoices · **Status:** `PARTIAL` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** The invoice series is not a consecutive serial and has no FY component or reset. A
  `sites.invoice_number_next` counter exists and is never used.
- **Evidence:**
  - number = `${invoice_prefix}-${order_number}` — `order-execution.adapter.ts:313,317`
  - `order_number` = `LB-YYYYMMDD-<8 random hex>` — `166_d6_checkout_handoff_inventory.sql:68-69`;
    legacy `ORD-YYYYMMDD-<random 4 digits>` — `000_baseline.sql:4228-4234`
  - unique indexes carry no FY: `144:118-120`; `000_baseline.sql:17745`
  - `sites.invoice_number_next` defined `122_mobile_business_profile.sql:9`, allowed through the
    gateway `stores.ts:727`, **read by nothing**
  - a second numbering scheme exists in `checkout-core/src/index.ts:749-753`
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-02
- **Remediation approach:** allocate the invoice number inside the issuing RPC from a per-site,
  per-financial-year sequence with a gap-free guarantee and a `(site_id, financial_year, seq)`
  unique constraint; retire the second scheme in `checkout-core`; confirm the required format with
  the CA (CA-06) before implementing.
- **Acceptance:** concurrent order creation yields a strictly consecutive gap-free series per site
  per FY; the series resets at FY boundary; no duplicate can be inserted.
- **Tests:** concurrency (N parallel orders), FY-boundary rollover, gap detection, per-tenant
  isolation.
- **Owner:** CA-tax + lead engineer · **Reversibility:** reversible before any real invoice is
  issued; **irreversible afterwards** · **Confidence:** HIGH

---

### G-H-06 — Discounts are excluded from the taxable value and absent from the invoice
- **Domain:** GST computation · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** Output GST is computed on the pre-discount subtotal while the discount reduces the
  amount charged. `invoice.total_amount_minor` cannot equal `orders.total` on any discounted order.
- **Evidence:** `order-execution.adapter.ts:307` (`discount_amount_minor: 0`);
  `checkout-payment-routes.ts:356` (same); `170:198`
  (`grand_total := subtotal + shipping + tax - discount`); the engine *does* support discounts
  (`checkout-core:797`).
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-01, CA-02
- **Remediation approach:** allocate order-level discounts to lines and pass them as
  `discount_amount_minor` so the taxable value and the charged total derive from the same figures;
  order of operations to be confirmed by the CA.
- **Acceptance:** for a discounted order, invoice total == charged total to the paise, and the
  invoice shows the discount per line.
- **Owner:** CA-tax + lead engineer · **Confidence:** HIGH

---

### G-H-07 — `sites.tax_inclusive` (DB default `true`) is ignored; the engine always computes exclusive
- **Domain:** GST computation · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** A store configured for inclusive pricing has tax added *on top* of prices that already
  include it — the shopper is over-charged and the invoice misstates the taxable value.
- **Evidence:** `000_baseline.sql:12001` (`tax_inclusive boolean DEFAULT true`);
  settable at `apps/merchant-control-plane/src/app/[store]/settings/taxes/page.tsx:207` and
  `apps/mobile/merchant-app/lib/screens/settings/taxes_screen.dart:78`; persisted at
  `services/api-gateway/src/routes/stores.ts:725`; **ignored** at
  `order-execution.adapter.ts:309` and `checkout-payment-routes.ts:358`
  (both hard-code `tax_inclusive: false`); engine supports it at `checkout-core:799-804`.
- **Severity:** P1 · **Likelihood:** HIGH (the default is `true`) · **Dependencies:** G-H-01
- **Remediation approach:** read the store setting (and the per-override `tax_overrides.tax_inclusive`)
  into the line input; until then, either disable the toggle in both UIs or make the engine fail
  loudly when the setting and the computation disagree.
- **Acceptance:** an inclusive-priced store's invoice back-computes the taxable value and the
  shopper's total equals the displayed price.
- **Owner:** lead engineer + CA-tax · **Confidence:** HIGH

---

### G-H-08 — Shipping charges are never taxed, while the pricing page markets "GST on shipping"
- **Domain:** GST computation · **Status:** `NOT_IMPLEMENTED`
- **Impact:** Shipping revenue carries no GST on any order; the invoice omits the shipping line
  entirely, so invoice total ≠ order total on every order with shipping.
- **Evidence:** `.eq('is_shipping', false)` at `order-execution.adapter.ts:287` and
  `checkout-payment-routes.ts:314`; invoice lines built only from `order_items`
  (`order-execution.adapter.ts:295-311`); `order_shipping_lines` created with no tax columns
  (`170:344-359`); marketed at `183_v1_pricing_recompete.sql:174`.
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-01, CA-08
- **Remediation approach:** add a shipping line to the invoice using the `is_shipping` rate (or the
  goods rate, per CA-08) so that invoice total reconciles to the charged total.
- **Owner:** CA-tax + lead engineer · **Confidence:** HIGH

---

### G-H-09 — Two divergent supplier/price sources; the adapter overwrites `orders.tax` without recomputing `orders.total`
- **Domain:** GST computation · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** The tax charged and the tax on the invoice come from different inputs. When they
  differ, the shopper is charged one figure and invoiced another, permanently.
- **Evidence:**
  - checkout-time supplier ← `tax_registrations` (`checkout-payment-routes.ts:300-307`);
    invoice-time supplier ← `sites.gstin/gst_state_code` (`order-execution.adapter.ts:248-259`)
  - checkout-time price ← `products.price`, **`variantId` ignored**
    (`checkout-payment-routes.ts:338-348`); invoice-time price ← `order_items.unit_price`
    (`order-execution.adapter.ts:306`)
  - `order-execution.adapter.ts:344` writes `tax: invoice.tax_amount_minor / 100`;
    `orders.total` was fixed at `170:295` and is never recomputed
- **Severity:** P1 · **Likelihood:** HIGH once G-H-01 is fixed · **Dependencies:** G-H-01
- **Remediation approach:** compute tax exactly once, from one supplier source and one line-price
  source, inside the same transaction that fixes the total; if a post-commit recomputation is
  retained, make a divergence a hard error, not a silent overwrite.
- **Acceptance:** `orders.total` always equals `subtotal + shipping + tax − discount` using the same
  tax figure that appears on the invoice.
- **Owner:** lead engineer + ARB · **Confidence:** HIGH

---

### G-H-10 — The GST money path is numeric-rupees and float, violating PAY-R5 / R-8
- **Domain:** GST / money representation · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** Rounding drift and representation mismatch between the engine (integer paise), the
  database (numeric rupees) and the conversions (`/100` floats).
- **Evidence:** rule `AGENTS.md:249`; `orders.tax numeric(12,2)`
  (`000_baseline.sql:10133` + `109_orders_money_width.sql`);
  `order_items.{taxable,cgst,sgst,igst}_amount numeric(10,2)` (`000_baseline.sql:10039-10042`);
  `170:47,61,65`; conversions `order-execution.adapter.ts:344,358-362` and
  `checkout-payment-routes.ts:364`; `majorToMinor` at `order-execution.adapter.ts:110-112`;
  `tax_rates.rate numeric(5,4)` (`000_baseline.sql:12487`); a fifth representation in
  `theme_purchase_receipts` (`091_theme_marketplace_stepup.sql:129-130`).
- **Severity:** P1 · **Likelihood:** MEDIUM · **Dependencies:** the Wave-5 bigint cutover
  (`AGENTS.md:159`, MIG-R5)
- **Remediation approach:** fold the GST columns into the planned expand/contract bigint-minor
  cutover; until then, forbid float arithmetic on tax values in TypeScript and keep integer paise as
  the single computation representation.
- **Owner:** lead engineer + ARB · **Confidence:** HIGH

---

### G-H-11 — `hsn_rates` and `tax_overrides` are dead; there is no per-HSN or per-scope rate resolution
- **Domain:** GST rates · **Status:** `NOT_IMPLEMENTED`
- **Impact:** Every line on every invoice gets the same store-wide default rate. A catalogue with
  mixed GST slabs (0/5/12/18/28) cannot be invoiced correctly.
- **Evidence:** `hsn_rates` defined `144:32-52`, `tax_overrides` defined `144:54-76`; **zero readers
  and zero writers** (grep over `services/`, `apps/`, `packages/` returns only the tenant registry
  and source-text tests); the actual resolution is a single `limit(1)` default at
  `order-execution.adapter.ts:282-294` and `checkout-payment-routes.ts:309-318`.
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-01, G-H-21
- **Remediation approach:** decide one rate-resolution authority (`hsn_rates` with effective-date
  windows, or `tax_rates` extended), implement per-line resolution product → HSN → rate with an
  explicit fallback, and delete or document the losing table rather than leaving both.
- **Acceptance:** a two-slab cart produces two different rates on one invoice; an effective-dated
  rate change applies from its date and not before.
- **Owner:** CA-tax (slab mapping) + lead engineer · **Confidence:** HIGH

---

### G-H-12 — LetBuyy's own subscription invoice: always-IGST, no GSTINs, non-unique series, mutable, fake IRN
- **Domain:** Billing / LetBuyy output tax = merchant input tax · **Status:** `BROKEN` · **Invariant:** `[HIGH-STAKES]`
- **Impact:** This is the document a merchant would rely on to claim input tax credit on LetBuyy's
  fees. As built it can be wrong on the tax split, carries no GSTINs or place of supply, can share
  an invoice number with another merchant's invoice, can be silently rewritten, and carries a
  fabricated IRN.
- **Evidence:** `services/api-gateway/src/routes/billing.ts:143-146` (`cgst 0 / sgst 0 / igst =
  taxMinor`), `:143-144` (`irn: 'sandbox-irn-…'`, `qr_payload: 'sandbox-qr:…'`), `:133`
  (`.upsert(...)`), `:273` (`MBI-${crypto.randomUUID().slice(0,8)}`), `:274`
  (`Math.round(amountMinor * 0.18)`); schema `152_executable_billing_autopay.sql:124-158` (no GSTIN,
  no state, no POS; `UNIQUE (site_id, invoice_number)` at `:157`).
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** CA-13, G-H-13
- **Remediation approach:** treat LetBuyy's invoicing as a first-class GST document: one platform
  supplier profile, a single consecutive FY-scoped series across all merchants, POS computed from
  LetBuyy's registered state vs the merchant's, both GSTINs and the SAC persisted, immutability
  equivalent to `gst_invoices`, and no IRN field populated until a real IRP is integrated.
- **Acceptance:** an intra-state merchant receives CGST+SGST; an inter-state merchant receives IGST;
  no two invoices share a number platform-wide; an issued invoice cannot be updated.
- **Owner:** CA-tax + founder + lead engineer · **Reversibility:** reversible in code; issued
  documents need a CA-approved correction · **Confidence:** HIGH

---

### G-H-13 — Merchant subscription checkout collects GSTIN and billing state, then discards them, while promising a GST invoice
- **Domain:** Billing UX · **Status:** `UI_ONLY` · **Invariant:** `[HIGH-STAKES]`
- **Evidence:** fields at
  `apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:125`,
  `:131`, `:542-545`; promises at `:383` (*"GST invoice included"*) and `:512` (*"Used for payment
  and your GST invoice."*); the POST body at `:262-272` contains only
  `store_id, plan_slug, billing_period, site_type, coupon_code`.
- **Impact:** The merchant reasonably believes their GSTIN is on LetBuyy's invoice. It is not, and
  cannot be (§11.2 — the table has no column for it).
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-12
- **Remediation approach:** either transmit and persist the fields end-to-end, or remove the inputs
  and the claim until the billing invoice supports them.
- **Owner:** founder + lead engineer · **Confidence:** HIGH

---

### G-H-14 — Fabricated IRN/QR is generated locally and persisted; the live-mode gate does not cover the generating path
- **Domain:** e-invoice / IRP · **Status:** `STUB_OR_MOCK` · **Invariant:** `[HIGH-STAKES]` (ANTI-R9)
- **Evidence:** `packages/checkout-core/src/index.ts:755-772` (FNV hash → `SANDBOX-IRN-…`,
  `letbuyy://gst-invoice/…` QR); the gate `assertSandboxIrpMode` exists only in
  `services/api-gateway/src/routes/tax.ts:64-70,89` and is **not** called by
  `order-execution.adapter.ts`; `LETBUYY_GST_IRP_MODE` is declared at
  `services/api-gateway/src/index.ts:116` but is absent from every wrangler config and from
  `config/env/schemas/worker.schema.json`; `billing.ts:143-144` persists `sandbox-irn-…`
  unconditionally with no mode column on `merchant_billing_invoices`; the only governance coverage
  is a string ratchet at `scripts/validators/provider-mode-badge-validator.mjs` (asserts the literal
  `SANDBOX-IRN-` is present and `MOCK-IRN-` is absent).
- **Impact:** A value shaped and named like an IRP acknowledgement, with an `acknowledged_at`
  timestamp, is stored on invoice records. If any surface ever renders it as an IRN it becomes a
  fabricated compliance artifact.
- **Severity:** P1 · **Likelihood:** MEDIUM (no surface renders it today) · **Dependencies:** CA-15
- **Remediation approach:** stop populating IRN/QR fields at all until a real IRP integration
  exists — leave them null and make the column nullable — rather than filling them with a
  locally-derived placeholder; extend the provider-mode validator to cover
  `order-execution.adapter.ts` and `billing.ts`; declare `LETBUYY_GST_IRP_MODE` in the env schema and
  apply the gate to the persisting path, not only to the unused endpoint.
- **Acceptance:** no invoice row carries a non-null IRN unless an IRP returned it; the validator
  fails if any file writes a synthetic IRN.
- **Owner:** ARB + security + CA-tax · **Confidence:** HIGH

---

### G-H-15 — Neither the shopper nor the merchant ever receives a GST invoice document
- **Domain:** GST invoices / UX · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** no GST line in the storefront checkout summary
  (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx:1053-1090`);
  nothing on the success page or the customer orders page (grep → zero hits); no tax content in
  `services/api-gateway/src/lib/order-confirmation-email.ts`; merchant order detail shows one string
  and one number (`apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx:276-277`,
  `:531`); no invoice view/PDF/print route anywhere.
- **Impact:** Even when an invoice is created, it exists only inside a jsonb column that no human
  surface renders.
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-01, G-H-02, G-H-22
- **Remediation approach:** build one canonical invoice-rendering surface fed by the immutable
  invoice record, expose it to the merchant (view + PDF/print) and to the shopper (order page +
  email), and gate its content on the CA-approved mandatory-field list.
- **Owner:** founder + lead engineer + CA-tax · **Confidence:** HIGH

---

### G-H-16 — No GST reporting, no export, no period locking, no reconciliation
- **Domain:** GST reporting · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `services/api-gateway/src/routes/export.ts:686,706,727` (products/orders/customers
  only; no tax content); no GSTR/e-way references repo-wide; no tax fields in `analytics.ts` or
  `commerce-analytics.ts`; no period/lock table or column; no reconciliation RPC/view joining
  `orders`, invoices and the ledger.
- **Impact:** A merchant cannot produce a GST return, cannot export invoice data, cannot close a
  period, and cannot prove that orders, invoices and the ledger agree.
- **Severity:** P1 · **Likelihood:** HIGH · **Dependencies:** G-H-01, G-H-02, G-H-03
- **Remediation approach:** once invoices are real and immutable, build a read-only,
  period-parameterised export from the invoice table (never from `orders.tax`), plus a
  reconciliation report (orders ↔ invoices ↔ credit notes ↔ ledger) and a period-lock concept, with
  the exact report shape confirmed by the CA.
- **Owner:** CA-tax + lead engineer · **Confidence:** HIGH

---

### G-H-17 — Input GST from purchases does not exist
- **Domain:** Input tax / ITC · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `suppliers` has no GSTIN (`000_baseline.sql:12460-12476`); `purchase_orders`
  (`:5128-5139`) and `purchase_order_lines` (`:5100-5120`) have no tax/HSN columns; no purchase
  invoice/bill entity; no ITC or GSTR-2A/2B concept repo-wide.
- **Impact:** The GST layer has no input-tax data to consume; net GST payable cannot be computed
  inside LetBuyy.
- **Severity:** P1 (for any "GST-complete" claim) / P2 (for V1 sell-side scope) · **Likelihood:** HIGH
- **Dependencies:** Agent D (purchasing domain)
- **Remediation approach:** if input GST is in scope, add supplier GSTIN + per-line HSN/rate/tax to
  purchasing and a purchase-invoice document; if it is out of scope, say so explicitly in the
  product and marketing copy so no merchant expects net-GST computation.
- **Owner:** founder (scope) + CA-tax · **Confidence:** HIGH

---

### G-H-18 — Composition-scheme flag captured but never read
- **Domain:** Merchant tax profile · **Status:** `PARTIAL`
- **Evidence:** `144:12-13` defines `registration_type IN ('regular','composition','unregistered')`;
  no reader selects `registration_type` (the only `tax_registrations` reader selects
  `gstin, state_code` — `checkout-payment-routes.ts:302`).
- **Impact:** `INFERRED-FROM-PRACTICE-NOT-REPO` — a composition dealer would be issued a document
  labelled a tax invoice with a CGST/SGST split. CA item CA-07.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Remediation approach:** branch document type and
  tax computation on the registration type, per CA guidance; block or warn until then.
- **Owner:** CA-tax · **Confidence:** HIGH

---

### G-H-19 — Multi-GSTIN / multiple place of business unusable, and the registration reader ignores effective dates
- **Domain:** Merchant tax profile · **Status:** `PARTIAL`
- **Evidence:** `144:28-30` permits N registrations per site; the reader takes
  `.order('effective_from', {ascending:false}).limit(1)` with **no
  `effective_from <= today` filter and no `effective_to` check**
  (`checkout-payment-routes.ts:300-307`) — a future-dated registration would be selected;
  `sites.gstin` is a single scalar (`000_baseline.sql:12017`).
- **Severity:** P2 · **Likelihood:** MEDIUM · **Dependencies:** G-H-01, CA-10
- **Remediation approach:** either declare single-GSTIN-per-store a product constraint and enforce
  it, or implement place-of-business selection; in both cases filter registrations by the effective
  window against the order date, not `now()`.
- **Owner:** CA-tax + lead engineer · **Confidence:** HIGH

---

### G-H-20 — Rounding: asymmetric CGST/SGST split, no invoice-level rounding, no cess
- **Domain:** GST computation · **Status:** `PARTIAL`
- **Evidence:** `checkout-core:806-807` (`cgst = floor(tax/2)`, `sgst = tax - cgst`);
  `:799-805` per-line `Math.round` with no invoice-level round-off; no cess column on `gst_invoices`
  (`144:78-112`) and no cess field on `GeneratedGstInvoiceLine` (`checkout-core:656-673`).
- **Severity:** P2 · **Likelihood:** MEDIUM · **Dependencies:** CA-03, CA-09
- **Remediation approach:** implement the CA-specified rounding rule (including a round-off line if
  required) and an equal CGST/SGST split; add cess only if the CA confirms the merchant catalogue
  needs it.
- **Owner:** CA-tax · **Confidence:** HIGH

---

### G-H-21 — HSN validation is inconsistent across four layers and HSN is never required or settable in the web merchant UI
- **Domain:** HSN/SAC · **Status:** `PARTIAL`
- **Evidence:** patterns `^\d{4,8}$` (`packages/shared-types/src/index.ts:76-79`,
  `000_baseline.sql:10044`, `:10627`) vs `^[0-9A-Za-z.-]{2,20}$` (`144:35`) vs length ≤ 20
  (`123_mobile_tax_rate_parity.sql`); HSN is `.optional().nullable()` at
  `checkout-core/src/index.ts:618`; no HSN input in `apps/merchant-control-plane/src` (grep → only
  the search keyword at `components/settings/settings-navigation.ts:127`); mobile has an HSN field
  on **tax rates** only (`apps/mobile/merchant-app/lib/screens/settings/taxes_screen.dart:184`).
- **Impact:** a value valid in `hsn_rates`/`tax_rates` will be rejected by the `order_items` CHECK
  when written back at `order-execution.adapter.ts:357`, which — under the fire-and-forget wrapper —
  silently destroys the invoice.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Dependencies:** G-H-11, G-H-29
- **Remediation approach:** pick one HSN/SAC format authority and apply it in the schema, all
  CHECKs and both UIs; add an HSN field to the web product form; decide with the CA whether HSN is
  mandatory per line.
- **Owner:** CA-tax + lead engineer · **Confidence:** HIGH

---

### G-H-22 — `/v1/tax/calculate` and `/v1/tax/invoice/:orderId` are unreachable from any product surface
- **Domain:** GST API · **Status:** `BACKEND_ONLY`
- **Evidence:** mounted at `services/api-gateway/src/index.ts:803`; no app proxy under
  `apps/merchant-control-plane/src/app/api/stores/[store]/` (no `tax` or `invoices` directory); no
  api-client method (`packages/typescript/api-client/src/index.ts` exposes only `/shipping-tax/*` at
  `:5201-5209`); the mobile BFF allow-lists `/v1/shipping-tax` only
  (`services/mobile-bff/src/index.ts:58`).
- **Severity:** P2 · **Likelihood:** HIGH · **Dependencies:** G-H-15
- **Remediation approach:** either wire the routes to the merchant invoice surface through a proxy
  and a typed api-client method, or remove them so the surface area matches reality.
- **Owner:** lead engineer · **Confidence:** HIGH

---

### G-H-23 — `tax_rates` has ENABLE but not FORCE row-level security
- **Domain:** Tenancy (GST-adjacent) · **Status:** `PARTIAL` · **Invariant:** `[HIGH-STAKES]`
- **Evidence:** `000_baseline.sql:27521` (`ENABLE ROW LEVEL SECURITY`) with no `FORCE`; policies
  `service_all_tax_rates … TO service_role USING (true) WITH CHECK (true)` (`:26589`) and
  `store_owners_manage_tax` (`:27285`); registered as a tenant table with `tenantColumn: store_id`
  (`services/api-gateway/src/tenant/tenant-tables.registry.ts:2707-2717`). The migration-144 GST
  tables *do* have `ENABLE` + `FORCE` (`144:166-173`), so this is an inconsistency, not a pattern.
- **Impact:** the table owner bypasses RLS; constitutional R-1..R-4 require ENABLE + FORCE on tenant
  tables. (Agent on tenancy owns the systemic view; recorded here as GST-domain evidence.)
- **Severity:** P2 · **Likelihood:** MEDIUM
- **Remediation approach:** add `FORCE ROW LEVEL SECURITY` and a GUC-scoped policy consistent with
  the migration-144 tables.
- **Owner:** security + ARB · **Confidence:** HIGH

---

### G-H-24 — GST test coverage is two trivial cases plus source-text greps
- **Domain:** Testing · **Status:** `PARTIAL`
- **Evidence:** see §14. `tests/gst/gst-invoice.test.mjs` has exactly two behavioural cases
  (`:142`, `:164`); `services/api-gateway/src/__tests__/tax.test.ts` is entirely regex-on-source
  (e.g. `:34`); `tests/launch/lb7-shipping-gst.test.mjs` is 28 source-text greps.
- **Impact:** none of the defects G-H-01, 06, 07, 08, 09, 11 would be caught by the suite; several
  are *encoded as correct* by it (e.g. `tax-postgres.test.mjs:172`).
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** replace source-text greps with behavioural tests over the real engine and
  a real Postgres, using a CA-reviewed fixture matrix (state pairs, slabs, inclusive/exclusive,
  discounts, shipping, partial refunds, FY rollover, concurrency, tenant isolation).
- **Owner:** lead engineer · **Confidence:** HIGH

---

### G-H-25 — Exports/SEZ/RCM unrepresentable; B2B vs B2C never distinguished; billing address never captured
- **Domain:** GST model completeness · **Status:** `NOT_IMPLEMENTED`
- **Evidence:** `IndianStateCodeSchema` `^(0[1-9]|[12][0-9]|3[0-8]|97)$` — no `99`
  (`packages/shared-types/src/index.ts:71-74`); `orders.place_of_supply_state` CHECK likewise
  (`000_baseline.sql:10169`); no `is_b2b`/RCM flag anywhere; `orders.billing_address` exists
  (`:10129`) and is never written by the storefront checkout
  (`checkout-payment-routes.ts:280-290`).
- **Severity:** P2 · **Likelihood:** MEDIUM · **Dependencies:** CA-11
- **Remediation approach:** confirm with the CA whether these are in scope; if out of scope, block
  the transactions that would require them rather than silently mis-invoicing.
- **Owner:** CA-tax + founder · **Confidence:** HIGH

---

### G-H-26 — Governance, certification and public legal documents overstate GST capability
- **Domain:** Documentation / claims · **Status:** `CONTRADICTORY_EVIDENCE`
- **Evidence:** the full table in §12 — Constitution ART-15 (`LETBUYY_CONSTITUTION.md:240,242`),
  `docs/ui-standards/india-localization.md:7`,
  `apps/marketing-site/src/lib/legal/content/money.ts:64-65`,
  `183_v1_pricing_recompete.sql:143,174,179-183`,
  `docs/final-v1-certification/MERCHANT_JOURNEY_AUDIT.md:13`,
  `docs/final-v1-certification/MONEY_SYSTEM_AUDIT.md:19-20`.
- **Impact:** decisions are being made against a stated capability the code does not have; the
  marketing legal page is a live public claim.
- **Severity:** P2 (P1 for the public legal page) · **Likelihood:** HIGH
- **Remediation approach:** correct the public legal copy and the pricing feature matrix first, then
  re-grade the certification documents against this evidence.
- **Owner:** founder + ARB (+ legal for the public page) · **Confidence:** HIGH

---

### G-H-27 — Four parallel GST implementations (WIN-R4 / ANTI-R1)
- **Domain:** Architecture · **Status:** `CONTRADICTORY_EVIDENCE` (vs the single-winner rule)
- **Evidence:** (1) `packages/checkout-core/src/index.ts:793-879`; (2)
  `services/api-gateway/src/routes/billing.ts:143-146,274`; (3)
  `services/api-gateway/src/lib/theme-marketplace-auxiliary-routes.ts:55-56,91-93` (hard-coded 18%
  and a placeholder GSTIN literal `27ABCDE1234F1Z5`); (4)
  `services/queue-workers/src/platform-queue-consumer.ts:1330-1333`
  (`clampBps(partner_gst_bps, 1800)`). Rule: `AGENTS.md:146`.
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** make `checkout-core` the single GST computation authority and have
  billing, theme marketplace and partner payouts call it with their own supplier/recipient profiles;
  no hard-coded rates or GSTIN literals in source.
- **Owner:** ARB + lead engineer · **Confidence:** HIGH

---

### G-H-28 — The money RPC accepts a caller-supplied tax amount without revalidation, computed from a different price source
- **Domain:** GST / money invariants · **Status:** `PARTIAL` · **Invariant:** `[HIGH-STAKES]`
- **Evidence:** `170:47` (`p_tax_amount numeric(12,2) DEFAULT NULL`), `:158-159`
  (`v_tax_amount := COALESCE(p_tax_amount, 0);` — no validation), `:198` (folded into the total);
  the caller computes it from `products.price` ignoring `variantId`
  (`checkout-payment-routes.ts:338-348`) while the order lines are priced elsewhere.
- **Impact:** the tax folded into the charged total is derived from a price basis that can differ
  from the actual order lines (variants, sale prices, quantity pricing).
- **Severity:** P1 · **Likelihood:** MEDIUM (masked today because tax is always 0) ·
  **Dependencies:** G-H-01, G-H-09
- **Remediation approach:** compute tax inside the same authority that prices the lines (the RPC or
  a single server-side pricing pass), or have the RPC recompute and reject a mismatched
  `p_tax_amount`.
- **Owner:** lead engineer + ARB · **Confidence:** HIGH

---

### G-H-29 — Invoice generation is fire-and-forget; failures are logged and lost with no retry
- **Domain:** GST invoices / reliability · **Status:** `PARTIAL`
- **Evidence:** `checkout-payment-routes.ts:396-409` —
  `c.executionCtx.waitUntil(service.completeOrderPostCommitWork(...).catch(err => console.error({event: 'storefront.checkout.post_commit_failed', ...})))`;
  the inner function throws on several DB errors (`order-execution.adapter.ts:242`, `:254`, `:277`,
  `:292`, `:350`, `:368`) and returns `null` on several business conditions (`:243`, `:255`, `:259`,
  `:268`, `:280`).
- **Impact:** an order can be paid and fulfilled with no invoice and no operational signal beyond a
  log line; no queue job, dead letter, retry or merchant alert exists.
- **Severity:** P1 · **Likelihood:** MEDIUM · **Dependencies:** G-H-01, G-H-02
- **Remediation approach:** move invoice issuance onto the durable queue with retry and a dead-letter
  path (or into the order transaction), and surface "invoice missing" as a merchant-visible order
  state.
- **Owner:** lead engineer · **Confidence:** HIGH

---

## 17. UNKNOWNS (honest)

1. **Runtime behaviour is entirely unverified.** No server was started, no order placed, no
   migration applied. Everything above is static reading. Nothing may be graded above
   `IMPLEMENTED_NOT_RUNTIME_VERIFIED`, and the `BROKEN` gradings are structural deductions from code,
   not observed failures.
2. **Whether migrations 139–195 are actually applied to any environment** — unknown; `graphify-out`
   was not treated as truth.
3. **Whether any production/staging store has a non-null `sites.gst_state_code`** — cannot be
   determined from the repo, and I did not connect to any database.
4. **Whether `tax_registrations` is populated by an out-of-band operator script or manual SQL** — no
   such script found under `scripts/`, but I cannot exclude manual DB access.
5. **Whether `isCheckoutPostCommitDeferralEnabled` is on in any environment** — the flag's source
   was not traced; it changes only whether invoice generation is inline or deferred, not whether it
   succeeds.
6. **Whether the mobile merchant app has an invoice surface** — I found tax-rate CRUD
   (`taxes_screen.dart`) and store GST details (`store_details_screen.dart`) but did not exhaustively
   audit the Flutter app for an invoice view; Agent covering mobile should confirm.
7. **Whether `orders.tax` is ever written by any path other than the two identified** — I found no
   third writer, but `orders` is written from many places and I did not read every one.
8. **Correct GST treatment of every item in §13** — outside my competence; that is exactly why they
   are routed to a CA.

## 18. BLOCKERS

- **BLOCKED_EXTERNAL — CA / tax-counsel review.** Fifteen questions (§13) cannot be answered inside
  this repository. Several remediations (G-H-03, G-H-05, G-H-06, G-H-20, G-H-25) cannot be specified
  until they are.
- **BLOCKED_EXTERNAL — runtime verification.** Confirming the zero-GST conclusion end-to-end needs a
  non-production environment with migrations applied and a test order; out of scope for a
  discovery-only, read-only phase.
- **BLOCKED_EXTERNAL — IRP provider decision.** `SKIP-THEME-MARKETPLACE-LIVE-GSTIN`
  (`SKIPPED_HUMAN_DECISIONS.md:58`) covers the theme marketplace GSTIN only; there is no equivalent
  seam recorded for merchant sales e-invoicing.
