# Checkout Editor Architecture

> Evidence-based design document. No code was modified. All findings cite source files.

---

## 1. What Merchants Can Configure Today

The current checkout settings page lives at `apps/merchant-control-plane/src/app/[store]/settings/checkout/page.tsx` (373 lines). It is a `'use client'` component that reads and writes to `sites.site_settings.checkout` (a nested JSONB sub-key) via `PATCH /api/stores/<store>/settings` → `PATCH /stores/:id` in the gateway → `sites` table `site_settings` column.

| Setting | Current UI | API Storage | Notes |
|---|---|---|---|
| Contact method | `<Select>` — Email / Phone / Email or phone | `sites.site_settings.checkout.contact_method` | Loaded on mount; no live effect in `checkout-client.tsx` — not yet consumed |
| Customer accounts | `<Select>` — Disabled / Optional / Required | `sites.site_settings.checkout.customer_accounts` | Schema present; not consumed by storefront checkout |
| Full name | `<Select>` — Both / Last only / Optional | `sites.site_settings.checkout.full_name` | Not consumed by storefront checkout |
| Company name | `<Select>` — Hidden / Optional / Required | `sites.site_settings.checkout.company_name` | Not consumed by storefront checkout |
| Order notes | `<ToggleRow>` checkbox | `sites.site_settings.checkout.order_notes` | API schema (`notes` field) exists in `StorefrontCreateOrderBody`; UI wiring absent in `checkout-client.tsx` |
| Tipping option | `<ToggleRow>` checkbox | `sites.site_settings.checkout.tip_option` | Not consumed anywhere |

**Critical gap:** All six settings are stored but none of them are consumed by `checkout-client.tsx` or `page.tsx` (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx`). The storefront checkout server component passes only `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled` to the client — `site_settings.checkout` is never read at checkout time (doc 04, section 8).

**What is already wired through `site_settings`:** The Appearance page stores `primary_color`, `font_family`, and `border_radius` into `sites.site_settings` (snake_case). `store-service.ts:576–595` reads these and merges them into `themeSettings` so they reach storefront CSS tokens. The checkout page inherits these via the storefront layout (the `--primary` CSS variable).

---

## 2. Shopify Checkout Editor Model (Reference)

Key capabilities for comparison:

| Capability | Shopify |
|---|---|
| **Sections** | Header (logo, return link), contact, delivery, shipping, payment, footer |
| **Branding** | Color scheme (background, accent, button, error), font, corner radius, logo — all live-previewed |
| **Checkout UI Extensions** | Third-party apps inject React/JS blocks into named targets (`Checkout::Dynamic::Render`, `Checkout::DeliveryAddress::RenderBefore`, etc.) |
| **Protected zones** | Payment input fields, Razorpay/Stripe iframes, amount display — immutable |
| **Custom CSS** | Allowed in Shopify Plus only; sandboxed and scoped to `.checkout-wrapper` |
| **Post-purchase page** | First-party extension target after payment confirmation |
| **Merchant-side config** | Contact method, company field, order notes, tipping — all stored per-store, all consumed |

Key design principle Shopify enforces: **server-authoritative totals always**. The checkout editor only controls presentation; no branding option can change a displayed amount. All price/tax/discount computations happen in the server-side cart/order creation — merchants cannot make the displayed total differ from the ledger total.

---

## 3. LetBuyy Checkout Editor Design

### What Merchants Should Be Able to Customize

| Element | Customization | Risk Level | Storage |
|---|---|---|---|
| Logo in checkout header | Upload via existing `/api/stores/<store>/upload`; resolves from `sites.logo_url` or `sites.site_settings.logo_url` | LOW — branding only | `sites.site_settings.logo_url` (already used by Appearance page) |
| Store name in header | Text override (defaults to `sites.name`) | LOW | `sites.name` (already a prop) |
| Primary color | Color picker (syncs to Appearance page's `primary_color`) | LOW | `sites.site_settings.primary_color` (already consumed by layout) |
| Border radius | Slider (syncs to Appearance page's `border_radius`) | LOW | `sites.site_settings.border_radius` (already consumed) |
| Trust badges | Enable/disable; choose from preset set; custom label (max 40 chars) | LOW | `sites.site_settings.checkout.trust_badges` |
| Coupon field | Show/hide | LOW | `sites.site_settings.checkout.coupon_enabled` (coupon is already fully implemented) |
| Order notes | Enable/disable; placeholder text | LOW | `sites.site_settings.checkout.order_notes` (already stored, not yet consumed) |
| Company name field | Hidden / Optional / Required | LOW | `sites.site_settings.checkout.company_name` (already stored, not yet consumed) |
| Contact method | Email / Phone / Both | LOW | `sites.site_settings.checkout.contact_method` (already stored, not yet consumed) |
| Customer accounts | Disabled / Optional / Required | LOW | `sites.site_settings.checkout.customer_accounts` (already stored, not yet consumed) |
| COD enabled | Toggle (currently a payment-config flag) | MEDIUM — payment method | `sites.cod_enabled` (already a DB column, already a prop) |
| Gift wrap option | Enable/disable + price (INR, minor units) + message max length | MEDIUM — adds to order total, must be server-enforced | `sites.site_settings.checkout.gift_wrap` (new) |
| Payment method order | Drag-and-drop sort (COD vs online) | MEDIUM — UX only, no security impact | `sites.site_settings.checkout.payment_method_order` (new) |
| Tipping option | Enable/disable + preset amounts | MEDIUM — adds to order total, server-enforced | `sites.site_settings.checkout.tip_option` (already stored) + `tip_amounts` (new) |
| GSTIN collection | Enable/disable; required/optional | MEDIUM — B2B invoice | `sites.site_settings.checkout.gstin_collection` (new) |
| Custom CSS | Textarea (max 4000 chars) | HIGH — must be sandboxed to `.lb-checkout-wrapper` CSS scope | `sites.site_settings.checkout.custom_css` (new) |

### What Merchants Must NEVER Customize

| Element | Reason |
|---|---|
| Payment form fields (card number, CVV, expiry) | PCI DSS — these fields render inside Razorpay's hosted iframe (`checkout.razorpay.com`) and are never in LetBuyy's DOM |
| Amount displayed at payment confirmation | Security — totals are server-authoritative, computed inside `create_checkout_order` RPC (doc 04, section with `totalAmount`); the client amount is advisory and recalculated server-side |
| Razorpay / payment gateway scripts | Security — the `<Script src="https://checkout.razorpay.com/v1/checkout.js">` is hardcoded and must not be replaceable |
| HMAC verification flow | Security — `timingSafeEqualHex` payment verification is server-side only |
| Idempotency key generation | Security — `crypto.randomUUID()` keys must not be predictable or merchant-influenced |
| Order ID returned from Razorpay | Security — gateway validates order against `payment_transactions` table |
| RLS policies and tenant isolation | Platform — `site_id` scoping is enforced by Postgres RLS, not editable by merchants |
| Storefront loading of third-party scripts | Security — no arbitrary `<script>` injection; only app extensions from `app_extension_registrations` table |

---

## 4. Checkout Config Data Model

The existing `site_settings` JSONB column on the `sites` table is the correct storage home. It already stores the `checkout` sub-object (read at `siteSettings.checkout` in the settings page). It is already writable via `PATCH /stores/:id` (allowed fields list at `stores.ts:703`). No new column is needed.

The minimal `checkout` sub-object within `sites.site_settings`:

```json
{
  "checkout": {
    "contact_method": "email",
    "customer_accounts": "optional",
    "full_name": "required_last",
    "company_name": "hidden",
    "order_notes": false,
    "order_notes_placeholder": "Special delivery instructions…",
    "tip_option": false,
    "tip_amounts_minor": [2500, 5000, 10000],
    "coupon_enabled": true,
    "gift_wrap": {
      "enabled": false,
      "price_minor": 5000,
      "message_max_length": 200
    },
    "gstin_collection": {
      "enabled": false,
      "required": false
    },
    "payment_method_order": ["online", "cod"],
    "trust_badges": {
      "enabled": true,
      "items": [
        { "icon": "shield", "label": "Secure Checkout" },
        { "icon": "truck", "label": "Fast Delivery" },
        { "icon": "package", "label": "Easy Returns" }
      ]
    },
    "custom_css": null
  }
}
```

The `branding` fields (`primary_color`, `logo_url`, `font_family`, `border_radius`) are intentionally **not** duplicated inside the `checkout` sub-object. They are already stored at the top level of `site_settings` and consumed by `store-service.ts:581–591`. The checkout editor should link to or share the Appearance page's branding settings rather than maintaining a separate copy.

**Constraints from existing schema:**
- `UpdateStoreSchema` (`packages/tenant-core/src/index.ts:212`) allows `site_settings: z.record(z.string(), z.unknown())` — any valid JSONB structure is accepted.
- The gateway's allowed fields list (`stores.ts:703`) already includes `site_settings`.
- The settings page pattern (read full `site_settings`, merge `checkout` sub-key, write back) is already established and correct.

---

## 5. Editor UI Architecture

### How the Theme Editor Preview Works (Reference Model)

The theme editor (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`) uses an iframe pointing to `storefront-runtime/preview?subdomain=<store>&editor=1&theme_preview_token=<token>`. A `postMessage` protocol enables two-way communication. The preview renders the actual storefront with draft config injected.

### Why Checkout Cannot Use the Same Iframe Pattern Directly

The checkout page (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/`) requires an active cart session via `useCart()` context. Previewing checkout in an iframe would require seeding a test cart, which is non-trivial and creates order-creation risk.

### Recommended Preview Strategy: Simulated Preview

For the checkout editor, use a **simulated preview panel** rather than a live iframe:

1. **Left panel** (config controls): section-by-section settings forms — Header, Branding, Form, Payment, Trust, Footer tabs.
2. **Right panel** (simulated preview): A static React component that renders a mock checkout layout using the live config state. The preview is not an iframe; it is a client-side React render of a simplified checkout skeleton that responds to config changes in real time.

This approach:
- Avoids cart/session dependencies.
- Avoids creating real orders.
- Renders instantly (no iframe load latency, no postMessage round-trip).
- Matches what merchants actually care about (layout, colors, which elements are visible).

The simulated preview component would be a new `CheckoutPreview` component inside `merchant-control-plane`, sharing design tokens from `@letbuyy/ui` but not importing any checkout business logic.

### Section Panels

| Tab | Controls |
|---|---|
| **Header** | Logo (upload or use store logo), store name display toggle, return-to-cart link toggle |
| **Branding** | Primary color picker (writes to `site_settings.primary_color`, shared with Appearance), border radius slider |
| **Form** | Contact method, full name requirement, company name, order notes toggle + placeholder |
| **Payment** | COD toggle, payment method order (drag-and-drop: online / COD), tipping toggle + preset amounts |
| **Trust** | Trust badges toggle, badge editor (icon picker + label text, up to 5 badges) |
| **Advanced** | GSTIN collection, custom CSS textarea (gated behind confirmation dialog) |

### Save Model

Unlike the theme editor (which uses draft/publish versioning), the checkout config should use **direct mutation** (no versioning):

- Changes are saved immediately on "Save" button click via `PATCH /api/stores/<store>/settings`.
- The save bar pattern already implemented in the existing checkout settings page (`saveBar` prop on `<SettingsPane>`) is the correct UX.
- **Rationale:** The checkout config controls UI presentation flags (show/hide order notes, trust badge labels). These are not templates with release history; rollback is unnecessary. The theme editor versioning overhead (draft tables, release snapshots, preview sessions, cache purge) is justified for full page templates but not for a JSONB settings object.
- **Exception:** If custom CSS is ever enabled (HIGH risk setting), consider adding a simple "last saved" timestamp display — not a full version history.

---

## 6. DB Schema for Checkout Config

No new table or column is needed. The checkout config lives inside the existing `sites.site_settings` JSONB column as a nested `checkout` key.

**Evidence:**

| DB artifact | Source |
|---|---|
| `sites.site_settings` column | Confirmed writable: `stores.ts:703` includes `site_settings` in the allowed PATCH fields list |
| `UpdateStoreSchema` | `packages/tenant-core/src/index.ts:219`: `site_settings: z.record(z.string(), z.unknown()).optional()` — untyped JSONB, accepts any shape |
| Current `checkout` sub-key usage | `checkout/page.tsx:79–88`: reads `siteSettings.checkout` and parses `contact_method`, `customer_accounts`, `full_name`, `company_name`, `order_notes`, `tip_option` |
| Appearance page precedent | `store-service.ts:579–595`: reads `site_settings.primary_color`, `site_settings.font_family`, `site_settings.border_radius` at storefront bootstrap time |

**How the checkout config reaches the storefront:**

Currently, `checkout-client.tsx` receives only `codEnabled` and `onlinePaymentEnabled` from the server component. To make the new checkout config settings take effect, the storefront checkout server component (`apps/storefront-runtime/src/app/store/[subdomain]/checkout/page.tsx`) must:

1. Call `StoreService.getStoreBySubdomain(subdomain)` — this already happens (line confirmed in doc 04).
2. Read `store.siteSettings?.checkout` (the `site_settings.checkout` sub-object from the DB row).
3. Pass the parsed config as a `checkoutConfig` prop to `CheckoutClient`.
4. `CheckoutClient` reads the config to conditionally render order notes textarea, trust badge overrides, custom CSS injection (inside the checkout `<div>`, scoped to `.lb-checkout-wrapper`), etc.

The server component already has `storeId` — it would add a `checkoutConfig` prop to `CheckoutClientProps` (currently defined at `checkout-client.tsx:67–74`).

---

## 7. Versioning and Publish

### Recommended: Direct Mutation (No Versioning)

The checkout config should **not** be versioned like themes.

| Factor | Theme Config | Checkout Config |
|---|---|---|
| Nature of data | Full JSON template (sections, blocks, per-section settings) — 10–50 KB | Small feature flags + badge labels + color — under 2 KB |
| Impact of a bad save | Storefront renders incorrectly for all customers immediately | One checkbox is in the wrong state |
| Recovery need | High — rollback to prior template is a real user need | Low — merchant re-toggles the setting |
| Preview complexity | Requires live iframe, postMessage, preview sessions, draft tables | Can use simulated preview; no session infrastructure needed |
| Infrastructure cost | `theme_editor_drafts`, `theme_preview_sessions`, `theme_releases` tables | None new — reuses `sites.site_settings` |

**Recommended save flow:**

```
Merchant edits config in checkout editor
  → config changes are tracked in React state (isDirty pattern, same as existing settings page)
  → merchant clicks "Save checkout"
  → PATCH /api/stores/<store>/settings
      body: { site_settings: { ...existingSiteSettings, checkout: updatedCheckout } }
  → gateway: sites.update({ site_settings: ... })
  → success toast "Checkout settings saved"
  → next storefront bootstrap picks up new config from DB
```

No cache purge is required because the checkout page is not statically cached (it is a dynamic client-rendered page behind a user session boundary).

### If Custom CSS Is Enabled

Custom CSS is the one setting that warrants more caution:

- Show a confirmation dialog ("Custom CSS affects all customers. Test carefully before saving.").
- Store with a `last_saved_at` timestamp shown in the editor ("Last saved 2 hours ago").
- Do NOT build a full version history for CSS; this would over-engineer a rarely-used feature.
- CSS must be scoped server-side: before writing to `site_settings`, strip any selectors that target outside `.lb-checkout-wrapper` (a simple regex blocklist: `body`, `html`, `:root`, `*`).

### Extension Registry (Future)

The gateway already has a full extension registry for `checkout.ui` surface extensions via `app_extension_registrations` table (`public-routes.ts:391–422`). The `AppExtensionRegistrationSchema` (`shared-types/src/index.ts:3832`) supports `surface: 'checkout.ui'`, `renderer: 'iframe' | 'web_component' | 'liquid_app_block'`, `target`, `source_url`, `sort_order`, and `settings`. The API endpoint `GET /storefront/:subdomain/checkout/extensions` is live and returns enabled extensions ordered by `sort_order`.

However, `checkout-client.tsx` never calls this endpoint — `extensionFunctions: []` in the order response is always an empty stub. The checkout editor's Extensions tab is therefore future work that builds on an already-correct schema and API, not from scratch.

---

## 8. Integration with the Appearance Page

The checkout editor and the Appearance page share three branding keys in `site_settings`:

| Key | Appearance page | Checkout editor |
|---|---|---|
| `primary_color` | Color picker | "Primary color" control should link: "Edit in Appearance" or be a read-only display |
| `font_family` | Font picker | Not directly controllable in checkout (checkout inherits layout font) |
| `border_radius` | Radius slider | "Corner radius" control should link to Appearance |
| `logo_url` | Logo upload | Checkout editor should show current logo with an "Upload" button that calls the same `/upload` endpoint |

The checkout editor should NOT duplicate the color/font/radius controls — it should either show a read-only preview of the branding values with a deep-link to the Appearance page, or embed a minimal branding section that writes to the same `site_settings` keys. Duplication risks the two pages falling out of sync.

---

## Summary of Gaps and Implementation Order

| Gap | Priority | Effort | Blocks |
|---|---|---|---|
| Wire existing `site_settings.checkout` fields to `checkout-client.tsx` (contact_method, accounts, order_notes, company_name) | P0 | Low — pass `checkoutConfig` prop from server component | Settings page already saves them; they just aren't consumed |
| Build simulated preview panel in checkout editor | P1 | Medium — new React component in merchant-control-plane | Needed for any meaningful editor UX |
| Trust badges — make configurable (currently hardcoded 3 icons) | P1 | Low — read from `checkout.trust_badges` | Merchants most frequently request this |
| Order notes textarea in checkout UI | P1 | Low — render conditionally from `checkout.order_notes` | API already accepts `notes`; UI just needs the textarea |
| Gift wrap — UI + server enforcement | P2 | Medium — new field in `StorefrontCreateOrderBody`, new RPC param | Adds to order total; requires server-side enforcement |
| GSTIN collection field | P2 | Low UI, Medium integration — derive state code from pincode/text | B2B merchants need this; API already has the field |
| Tipping option | P3 | Medium — new field in `StorefrontCreateOrderBody`, server enforcement | Nice-to-have; not India-first critical |
| Custom CSS | P4 | Medium (sandboxing risk) | Gated behind Plus plan; not V1 scope |
| App extensions in checkout UI | P5 | Large — requires calling `/checkout/extensions` endpoint, rendering iframe/web_component targets | Infrastructure exists; no consumer yet |
