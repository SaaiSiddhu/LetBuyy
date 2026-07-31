# Shipping Platform Analysis

> Research date: 2026-06-18  
> Scope: `services/api-gateway/src/routes/shipping.ts`, `shipping-labels.ts`, `shipping-tax.ts`, `lib/shipping-rate-resolver.ts`, `apps/merchant-control-plane/src/app/[store]/settings/shipping/`, `packages/checkout-core/src/index.ts`

---

## 1. Shipping Data Model

### Shipping Zone

A shipping zone groups countries (and optionally states or zip codes) into a named delivery region. Defined in `shipping_zones` table; always scoped to a `store_id`.

Schema (from `CreateShippingZoneSchema` in `packages/checkout-core/src/index.ts`):

| Field | Type | Notes |
|---|---|---|
| `store_id` | UUID | tenant key |
| `name` | string (1–100 chars) | e.g. "Domestic", "International" |
| `countries` | string[] (1–250 items) | required, min 1 country |
| `states` | string[] (max 100) | optional sub-region filter |
| `zip_codes` | string[] (max 500) | optional pincode/zip allowlist |

The UI in merchant-control-plane exposes only `name` and `countries` as a comma-separated string; `states` and `zip_codes` are schema-supported but not surfaced in the current UI.

### Shipping Rate

A rate is attached to a zone and defines what the customer pays. Defined in `shipping_rates` table; linked via `zone_id`.

Schema (from `CreateShippingRateSchema`):

| Field | Type | Notes |
|---|---|---|
| `zone_id` | UUID | parent zone |
| `name` | string (1–100 chars) | displayed in checkout |
| `type` | enum | `flat`, `weight_based`, `price_based`, `free` |
| `price` | decimal | major currency units (₹), default 0 |
| `min_weight_grams` | int | weight-based lower bound |
| `max_weight_grams` | int | weight-based upper bound |
| `min_order_amount` | decimal | price-based lower threshold |
| `max_order_amount` | decimal | price-based upper threshold |
| `estimated_days_min` | int | delivery window floor |
| `estimated_days_max` | int | delivery window ceiling |
| `is_active` | boolean | default true |

In checkout, `price` is stored in major units but surfaced to checkout as `amount_minor` (multiplied ×100).

### Shipping Rule (Serviceability)

A separate data layer governs which pincodes can be served. Defined in `shipping_serviceability_rules` table; always scoped to `site_id` + `pincode`.

| Field | Type | Notes |
|---|---|---|
| `provider` | string | e.g. `shiprocket`, `delhivery`, `pickrr` |
| `pincode` | string (6 digits) | Indian pincode |
| `serviceable` | boolean | can ship here at all |
| `cod_available` | boolean | COD allowed at this pincode |
| `min_cod_amount_minor` | int | minimum order value for COD |
| `max_cod_amount_minor` | int | maximum order value for COD |
| `min_weight_grams` | int | parcel weight lower bound |
| `max_weight_grams` | int | parcel weight upper bound |
| `estimated_days_min` | int | |
| `estimated_days_max` | int | |

When no rule exists for a pincode, a default rule fires: any valid 6-digit Indian pincode (`/^[1-9][0-9]{5}$/`) is serviceable via `shiprocket` with COD allowed between ₹1 and ₹2,00,000, weight 1–50,000g, ETA 3–7 days.

---

## 2. Shipping Configuration API

All routes are served by `services/api-gateway` (Hono, Cloudflare Workers). Auth: all merchant-facing endpoints require a verified merchant session + `verifySiteOwnership` check. Storefront-facing rate lookup uses the same ownership check.

### Shipping Zones (shipping-tax.ts)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/v1/shipping/zones?store_id=` | List all zones for a store | Merchant |
| POST | `/v1/shipping/zones` | Create a zone | Merchant |
| PATCH | `/v1/shipping/zones/:id` | Update zone name/countries | Merchant |
| DELETE | `/v1/shipping/zones/:id` | Delete zone (and its rates cascade) | Merchant |

### Shipping Rates (shipping-tax.ts)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/v1/shipping?store_id=` | List all rates (joined to zones) | Merchant |
| POST | `/v1/shipping` | Create a rate on a zone | Merchant |
| PATCH | `/v1/shipping/:id` | Update a rate | Merchant |
| DELETE | `/v1/shipping/:id` | Delete a rate | Merchant |

### Serviceability & Checkout Rates (shipping.ts)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/v1/shipping/serviceability/:pincode?store_id=&cod=&order_amount_minor=&weight_grams=` | Check pincode serviceability | Merchant |
| POST | `/v1/shipping/rates` | Return available rates for a checkout address | Merchant |
| GET | `/v1/shipping/track/:trackingNumber?provider=` | Live parcel tracking | Merchant |

### Shipping Labels (shipping-labels.ts)

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/v1/shipping/labels/rates` | Estimate carrier label cost for an order | Merchant |
| GET | `/v1/shipping/labels/provider-mode` | Return sandbox/live mode for UI | Merchant |
| POST | `/v1/shipping/labels` | Create a shipping label for an order | Merchant |
| GET | `/v1/shipping/labels/:id/pdf` | Download label PDF from R2 | Merchant |
| POST | `/v1/shipping/labels/:id/void` | Void an existing label | Merchant |

---

## 3. How Shipping Rates Reach Checkout

### Rate Calculation

The checkout in `apps/storefront-runtime` calls the gateway at page load with a placeholder pincode `000000`:

```
POST /api/shipping/rates
{
  store_id, pincode: "000000", cod: false,
  order_amount_minor: 0, weight_grams: 500, subtotal_minor: 0
}
```

The gateway (`shipping.ts` `POST /rates`) runs:
1. `loadRules()` — queries `shipping_serviceability_rules` for pincode. Falls back to `defaultRules()` when no record exists.
2. `planShippingServiceability()` — evaluates weight range, COD eligibility, and order amount bounds against the rule.
3. If serviceable, queries `shipping_rates` for the store (active, not deleted, limit 10).
4. Returns rates with `amount_minor` (price × 100), `estimated_days_min/max`, `provider`, `cod_available`.
5. If no rates are configured, returns a single synthetic `sandbox-standard` rate at ₹60. The storefront filters out `sandbox-standard` rates before displaying them.

When the customer fills in their actual pincode, the store calls the same endpoint again with the real pincode. The checkout client re-fetches and auto-selects the first rate.

### Rate Selection

The customer selects from a radio-button list rendered in the checkout form. Selection state is `selectedRateId` (useState). The checkout summary reads `selectedRate.amount_minor / 100` as `deliveryCharges`. If a free-shipping coupon is applied, `effectiveDeliveryCharges` is overridden to 0 regardless of the selected rate.

The `shippingRateId` is attached to the order creation payload.

### Rate Validation

Server-side validation is performed in `lib/shipping-rate-resolver.ts`, called from both `checkout.ts` (legacy handoff path) and `storefront/checkout-payment-routes.ts` (storefront payment path):

1. Checks whether the store has **any** active `shipping_rates`. If none, returns `null` and the caller falls through to legacy standard/express amounts.
2. If a `shippingRateId` is provided, fetches the row from `shipping_rates` matching `id + site_id + is_active + deleted_at IS NULL`. Throws if not found — client cannot pass a stale or foreign rate ID.
3. Returns `{ id, amount }` where `amount = 0` for `type = 'free'`, else `price` from DB. The gateway **never** uses the client-supplied price.

This is explicitly documented: `SECURITY: callers must NEVER trust a client-supplied price for shipping.`

---

## 4. Shipping Label System

Source: `services/api-gateway/src/routes/shipping-labels.ts` + `@letbuyy/infrastructure/logistics-adapter`.

### Couriers Integrated

Three providers are supported via `LogisticsProviderSchema`:

| Provider | Env var for live credentials | Default |
|---|---|---|
| `shiprocket` | `SHIPROCKET_TOKEN` | Yes (default) |
| `delhivery` | `DELHIVERY_TOKEN` | — |
| `pickrr` | `PICKRR_TOKEN` | — |

Currently `liveLogisticsProviderAvailable()` is hardcoded to return `false`. All label creation and rate estimation runs in sandbox mode unless `LOGISTICS_MODE=live` AND a live provider's credential is present AND `liveLogisticsProviderAvailable()` is changed. This is a `[HUMAN-REQUIRED]` gate — no live label can be generated today.

### Label Generation

1. `POST /v1/shipping/labels` requires `order_id`, `provider`, `package` (weight + optional dimensions), `idempotency_key`.
2. Ownership is verified via `resolveTenantContextForOrder`.
3. Idempotency: the `shipping_labels` table is checked for a matching `idempotency_key`. Returns existing label if found.
4. `buildDestination()` maps `orders.shipping_address` JSON to a `LogisticsAddress` (line1, city, state, postalCode required).
5. `createLogisticsProvider(provider, options).createLabel(...)` is called — in sandbox mode this returns a synthetic result.
6. The label row is inserted into `shipping_labels` (site_id, order_id, provider, carrier, tracking_number, tracking_url, label_url, status, test_mode, package, idempotency_key).
7. A simple PDF is generated in-process via `createSimplePdfBytes` and stored to `R2_BUCKET` at `shipping-labels/{id}.pdf`. The `label_url` in the DB row is updated to `/v1/shipping/labels/{id}/pdf`.

### Tracking Number Flow

- `tracking_number` and `tracking_url` come from the `ShippingLabelResult` returned by the logistics provider.
- In sandbox mode these are provider-generated mock values.
- Tracking lookup: `GET /v1/shipping/track/:trackingNumber?provider=shiprocket` calls `provider.getTracking({ trackingNumber })`.

### Rate Estimation for Labels

`POST /v1/shipping/labels/rates` returns a cost estimate before purchasing a label. In sandbox mode this is computed inline using a weight-based formula:

```
units = ceil(weight_grams / 500)
amount = round((45 + units * 15) * providerFactor[provider])
```

Provider factors: shiprocket=1.0, delhivery=1.08, pickrr=0.96.

---

## 5. Merchant Shipping Configuration UI

Source: `apps/merchant-control-plane/src/app/[store]/settings/shipping/page.tsx`.

### What Merchants Can Configure

- **Multiple zones**: yes — merchants can create, edit, and delete zones. Each zone has a name and a countries list (comma-separated text input). States and zip-code sub-ranges are in the schema but not exposed in the UI.
- **Rate rules per zone**: merchants can add flat rates to each zone with a name and price (₹). Price 0 creates a free rate. The UI hardcodes `type: 'flat'` on rate creation — weight-based and price-based rate types are schema-supported but inaccessible from the UI.
- **Free shipping thresholds**: no — the UI has no concept of "free above ₹X". A merchant can set a rate price to 0 (always free), but conditional free-above-amount is not exposed.
- **Carrier provider mode indicator**: shown as a `ProviderModeBadge` (sandbox/live), fetched from `GET /v1/shipping/labels/provider-mode`.

### Data Load Flow

On mount, the shipping settings page calls `GET /api/stores/{store}/shipping/zones` (merchant-control-plane Next.js route), which in turn calls the api-client in parallel:
- `apiClient.shipping.zones.list({ store_id })`
- `apiClient.shipping.rates.list({ store_id })`
- `apiClient.shippingLabels.providerMode({ store_id })`

The zones route (`shipping/zones/route.ts`) returns all three as a combined payload.

---

## 6. India-Specific Shipping

### Pincode-Based Serviceability

Yes — implemented and enforced. The `ShippingServiceabilityQuerySchema` validates pincodes as `/^[1-9][0-9]{5}$/` (6-digit Indian pincode). The gateway `GET /v1/shipping/serviceability/:pincode` and `POST /v1/shipping/rates` both run `planShippingServiceability()` against per-pincode rules.

Default: any valid Indian pincode is treated as serviceable if no explicit rule exists in `shipping_serviceability_rules`.

### COD Availability by Pincode

Yes — per-pincode COD eligibility is modelled:
- `cod_available` boolean on the rule row.
- `min_cod_amount_minor` and `max_cod_amount_minor` enforce order value bounds for COD.
- `planShippingServiceability` returns `cod_available: false` with `reason: 'cod_unavailable'` or `'amount_out_of_range'` when conditions are not met.
- Default rules allow COD between ₹1 and ₹2,00,000 for any valid pincode.

COD is plumbed through checkout: `cod` query param fed to serviceability; `shippingRateId` carries the selected rate into order creation.

### State-Based GST Considerations

Shipping is connected to GST via the tax system, not within the shipping routes themselves. `shipping-tax.ts` hosts both shipping and tax rate management. `tax_rates` has an `is_shipping` boolean and an `applies_to` field (`all`, `shipping`, `products`), and a `state` column for state-specific tax rules. However, the GST computation in `checkout-payment-routes.ts` queries `tax_rates` filtered on `is_shipping: false`, meaning shipping cost itself is currently not subjected to GST in the checkout path.

### Last-Mile Delivery Partners

Three logistics adapters exist: Shiprocket, Delhivery, Pickrr. All are sandbox-only until `liveLogisticsProviderAvailable()` is enabled. No BlueDart, Ecom Express, India Post, or hyperlocal courier integrations.

---

## 7. Checkout-Shipping Integration Points

| Data from Checkout | How It Feeds Shipping |
|---|---|
| Delivery address pincode | `POST /api/shipping/rates` with `pincode` field; re-fetched when customer fills pincode |
| Cart weight | Defaults to `500g`; no per-product weight summation is visible in the checkout client — `weight_grams` is sent as a fixed default |
| Order subtotal (`subtotal_minor`) | Passed to `POST /api/shipping/rates` and to serviceability check for COD amount range validation |
| COD flag | Passed as `cod: boolean` to serviceability; serviceability result propagates `cod_available` back to checkout |
| Pincode serviceability | If `serviceable: false`, checkout renders empty rates; the storefront uses a 6-digit validation guard (`formData.pincode.length !== 6`) before submission |
| Selected rate ID | `shippingRateId` is sent as part of the order-creation payload; re-resolved server-side via `resolveShippingRate` before write |
| Free-shipping coupon | Overrides `effectiveDeliveryCharges` to 0 client-side; the selected rate ID is still sent but its amount is not used in the total |

---

## 8. Missing Shipping Capabilities

The following shipping features are absent or incomplete, based on evidence in the code:

1. **Live carrier integration is blocked** — `liveLogisticsProviderAvailable()` returns `false` unconditionally in `shipping-labels.ts`. All label creation and tracking is sandbox-only. The `[HUMAN-REQUIRED]` comment in `shipping.ts` acknowledges this: carrier account keys must be installed before any live call.

2. **Weight-based and price-based rate types are schema-complete but UI-inaccessible** — `CreateShippingRateSchema` defines `weight_based` and `price_based` types with full bounds fields, but the merchant UI hardcodes `type: 'flat'` on rate creation. Merchants cannot create conditional rates from the dashboard.

3. **Free-shipping-above-threshold not exposed** — schema supports `min_order_amount` / `max_order_amount` on a rate, but the UI offers only a price field. No "free shipping over ₹X" configuration is accessible.

4. **Cart weight is not computed from products** — the storefront checkout client sends `weight_grams: 500` as a fixed default regardless of cart contents. Product weight fields presumably exist in the products table but are not summed and fed to serviceability or label creation.

5. **Zone-to-checkout matching is not implemented** — shipping zones hold a `countries`/`states`/`zip_codes` allowlist, but `POST /v1/shipping/rates` does not filter returned rates by which zone covers the customer's pincode or country. All active rates for the store are returned up to a limit of 10, regardless of zone assignment. Zone-scoped rate display during checkout is absent.

6. **`shipping_serviceability_rules` table is merchant-unmanageable** — there is no UI or API endpoint for merchants to create or edit serviceability rules. The rules table exists and is queried, but population relies on external data ingestion or direct DB manipulation.

7. **Dimensions are accepted for labels but not used for rate selection** — `PackageSchema` in `shipping-labels.ts` accepts `length_cm`, `width_cm`, `height_cm`, but the checkout rate fetch in the storefront sends no dimensional data. Volumetric weight pricing is not modelled.

8. **No multi-package or split-shipment support** — label creation accepts a single parcel; the `parcels` field is an array but the checkout always sends exactly one.

9. **No returns/reverse logistics workflow** — there is no return label endpoint or reverse-shipment flow.

10. **No estimated delivery date surfaced to customer** — `estimated_days_min/max` are returned with rates and stored on serviceability rules, but the storefront checkout client does not display delivery ETAs to the customer during rate selection.
