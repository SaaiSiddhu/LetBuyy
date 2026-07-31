# Checkout Branding Platform Design

_Generated: 2026-06-18. Sources: `05-checkout-branding-analysis.md`, `docs/theme-research/08-adaptive-theme-system.md`, `docs/theme-research/09-target-theme-architecture.md`, `packages/theme-engine/src/theme-bundle.ts`, `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx`, `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx`._

---

## 1. Current Branding Token System

### Global Design Tokens in `theme-bundle.ts`

The `[subdomain]/layout.tsx` server component reads `store.templateConfig.themeSettings` (`ts`) and emits an inline `<style>` block at `:root` level. These are the full tokens currently injected:

| CSS Variable | Source Field | Fallback / Derivation |
|---|---|---|
| `--primary` | `ts.primaryColor` | Direct hex value |
| `--secondary` | `ts.secondaryColor` | Direct hex value |
| `--accent` | `ts.accentColor \|\| ts.primaryColor` | Falls back to primary |
| `--background` | `ts.backgroundColor \|\| isDark ? ts.primaryColor : rgb(255 255 255)` | Computed |
| `--text` | `ts.textColor \|\| isDark ? rgb(255 255 255) : rgb(26 26 46)` | Computed |
| `--radius` | `ts.borderRadius` + `px` | Direct value |
| `--font-main` | `FONT_MAP[ts.fontFamily]` | Falls back to Inter |
| `--font-heading` | `FONT_MAP[ts.headingFontFamily]` | Falls back to `--font-main` |
| `--enable-animations` | `ts.enableAnimations` | Boolean as int |
| `--enable-shadows` | `ts.enableShadows` | Boolean as int |
| `--is-dark` | `ts.isDark` | Boolean as int |
| `--text-secondary` | Computed from `isDark` | rgba |
| `--text-muted` | Computed from `isDark` | rgba |
| `--text-hint` | Computed from `isDark` | rgba |
| `--text-inverse` | Computed from `isDark` | rgb |
| `--border-color` | Computed from `isDark` | rgba |
| `--surface` | Computed from `isDark` | rgba |
| `--surface-hover` | Computed from `isDark` | rgba |
| `--card-bg` | Computed from `isDark` + `surfaceColor` | rgb |
| `--card-bg-secondary` | Computed from `isDark` + `surfaceColor` | rgb |
| `--card-text` | Computed from `isDark` | rgb |
| `--card-text-muted` | Computed from `isDark` | rgb |
| `--card-border` | Computed from `isDark` | rgb |
| `--header-bg-scrolled` | Computed from `isDark` + `surfaceColor` | rgb |
| `--header-shadow` | Computed from `isDark` | rgba |
| `--footer-bg` | Computed from `isDark` + `backgroundColor` | rgb |
| `--footer-text` | Computed from `isDark` | rgb |
| `--footer-text-muted` | Computed | rgba |
| `--input-bg` | Computed from `isDark` | rgb |
| `--input-border` | Computed from `isDark` | rgb |
| `--input-text` | `textColor` | rgb |
| `--input-placeholder` | Computed from `isDark` | rgba |

The Urban Kicks Liquid theme (`createUrbanKicksLiquidThemeBundleFixture`) adds a parallel token set via `LIQUID_THEME_TOKEN_MAP` in the renderer:

| Setting Key | CSS Variable | Urban Kicks Default |
|---|---|---|
| `primaryColor` | `--primary` | `#8B5CF6` (violet) |
| `secondaryColor` | `--secondary` | `#374151` (fallback only) |
| `accentColor` | `--accent` | `#F59E0B` (amber) |
| `surfaceColor` | `--surface` | `#F8FAFC` |
| `backgroundColor` | `--background` | `#ffffff` (fallback only) |
| `textColor` | `--foreground` | `#1a1a2e` (fallback only) |
| `headingFontFamily` | `--font-display` | `Inter` |
| `bodyFontFamily` | `--font-body` | `Inter` |

Urban Kicks populates 3 of the 8 token slots (`primaryColor`, `accentColor`, `surfaceColor`). The remaining 5 (`secondaryColor`, `backgroundColor`, `textColor`, `borderColor`, `--foreground`) fall through to hardcoded fallbacks in `buildLiquidRootTokenBlock`.

### How Tokens Reach Storefront Pages Today

1. `StoreService.getStoreBySubdomainAnyStatus(subdomain)` fetches the store record including `templateConfig.themeSettings`.
2. `[subdomain]/layout.tsx` server component reads `themeSettings` and emits `<style>:root { --primary: ...; --accent: ...; ... }</style>` as an inline style block.
3. All child routes under `[subdomain]/` — including checkout — inherit these CSS variables via the cascade.
4. The FONT_MAP maps font name strings to Next.js font CSS variables (`var(--font-inter)`, `var(--font-playfair)`, etc.).
5. For the Liquid engine, `buildLiquidThemeHeadAssets()` in the renderer additionally injects a `<style data-theme-renderer="liquid">` block into `content_for_header`, mapping the same settings through `LIQUID_THEME_TOKEN_MAP`.

---

## 2. Brand Token Payload

The minimal brand token payload a centralized checkout would need to receive explicitly (since it cannot rely on layout inheritance):

```json
{
  "store_id": "550e8400-e29b-41d4-a716-446655440000",
  "store_name": "Electra Store",
  "logo_url": "https://assets.letbuyy.com/stores/electra/logo.png",
  "favicon_url": "https://assets.letbuyy.com/stores/electra/favicon.ico",
  "tokens": {
    "--primary": "#1d4ed8",
    "--secondary": "#1e40af",
    "--accent": "#0ea5e9",
    "--background": "#f8fafc",
    "--surface": "#ffffff",
    "--foreground": "#0f172a",
    "--border-color": "rgba(0,0,0,0.1)",
    "--font-main": "Inter, system-ui, sans-serif",
    "--font-heading": "Inter, system-ui, sans-serif",
    "--radius": "6px",
    "--is-dark": "0",
    "--input-bg": "rgb(249 250 251)",
    "--input-border": "rgb(229 231 235)",
    "--input-text": "rgb(15 23 42)",
    "--card-bg": "rgb(255 255 255)",
    "--card-border": "rgb(229 231 235)"
  },
  "razorpay_theme_color": "#1d4ed8",
  "primary_color_raw": "#1d4ed8",
  "is_dark": false
}
```

**Why `razorpay_theme_color` and `primary_color_raw` are separate fields:** The Razorpay SDK `options.theme.color` requires a raw hex string, not a CSS variable reference. CSS variables cannot be read from JavaScript at the time the SDK options object is constructed (before the DOM resolves them). These two fields must be explicit string values passed from the server component to the React client component as props.

**Full token set explanation:**

| Token | Purpose | Type |
|---|---|---|
| `--primary` | CTA button color, focus rings, step indicators | Hex |
| `--secondary` | Secondary buttons, muted accents | Hex |
| `--accent` | Highlighted states, badges | Hex |
| `--background` | Page background | Hex or rgb |
| `--surface` | Card backgrounds, form panels | Hex or rgb |
| `--foreground` | Primary text | Hex or rgb |
| `--border-color` | Form borders, dividers | rgba |
| `--font-main` | Body text, form labels | Font stack string |
| `--font-heading` | Section headings, store name | Font stack string |
| `--radius` | Button/card border radius | px value string |
| `--is-dark` | Dark mode flag for computed tokens | `"0"` or `"1"` |
| `--input-bg` | Form input background | rgb |
| `--input-border` | Form input border | rgb |
| `--input-text` | Form input text | rgb |
| `--card-bg` | Order summary card | rgb |
| `--card-border` | Order summary card border | rgb |
| `razorpay_theme_color` | Razorpay SDK `options.theme.color` | Raw hex string |
| `primary_color_raw` | CTA button inline style (avoid CSS var resolution timing) | Raw hex string |
| `is_dark` | Boolean for dark surface decisions | Boolean |

---

## 3. Token Injection Architecture

### For Current Embedded Checkout (Storefront-Runtime)

Tokens reach the current `checkout-client.tsx` via CSS variable inheritance from `[subdomain]/layout.tsx`. This works because checkout is a child route under `[subdomain]/`:

```
[subdomain]/layout.tsx
  → emits <style>:root { --primary: ...; --accent: ...; ... }</style>
    → [subdomain]/checkout/page.tsx (server component)
      → <CheckoutClient ...> (client component)
        → all CSS var references (var(--primary, ...), etc.) resolve via the cascade
```

**What fails even in the embedded model:**

- `options.theme.color` in the Razorpay SDK options object (line 530–532 of checkout-client.tsx) is hardcoded to `'rgb(99 102 241)'` because the component never receives `primaryColor` as a prop from the server — it cannot read the CSS variable value at RazorpayOptions construction time.
- The main payment CTA button (line 1020) uses hardcoded `rgb(22 163 74)` (COD) and `rgb(26 26 46)` (online) inline styles.
- `logoUrl` is never forwarded to the checkout client props; no store logo appears in the page.

### For Centralized Checkout App (e.g., `checkout.letbuyy.com`)

The CSS variable cascade from `[subdomain]/layout.tsx` would not exist. Three injection strategies are available:

#### A. API Response on Checkout Session Creation (Inline in HTML) — Recommended

The checkout session creation endpoint (`POST /v1/checkout/sessions`) returns the full `CheckoutBrandPayload` alongside the session. The centralized checkout's server component (`page.tsx`) reads this payload and emits an inline `<style>:root { ... }</style>` block server-side before streaming HTML to the client.

```
POST /v1/checkout/sessions
  → response.brand: CheckoutBrandPayload
    → Server component emits:
      <style>:root { --primary: #1d4ed8; --font-main: Inter; ... }</style>
    → CheckoutClient receives:
      <CheckoutClient
        primaryColorRaw="#1d4ed8"
        razorpayThemeColor="#1d4ed8"
        logoUrl="https://..."
        storeName="Electra Store"
        ...
      />
```

This approach is zero-FOUC (style emitted before body), server-authoritative (client cannot override), and does not require a separate HTTP round-trip.

#### B. Separate Brand API Call on Checkout App Load

The checkout app makes a client-side fetch to `GET /v1/checkout/brand?site={subdomain}` on mount, receives the payload, and applies tokens via `document.documentElement.style.setProperty('--primary', ...)`.

**Downside:** Causes FOUC — the page renders with fallback/default tokens until the fetch completes. This approach is only acceptable if the checkout app is fully lazy-loaded after a spinner, which degrades UX. Not recommended for the primary injection path.

#### C. CSS Custom Properties via Session Handoff URL

Brand tokens encoded as URL search parameters or a short hash in the checkout handoff URL: `checkout.letbuyy.com/c/{session_id}?brand={base64_encoded_tokens}`.

**Downside:** URL becomes very long (20+ tokens × average 20 chars), leaks brand config into access logs, and is fragile against URL length limits. Acceptable only for the minimal set (primary color + logo URL), not the full token payload. Not recommended as the primary mechanism.

**Recommended architecture for centralized checkout:** Strategy A (inline in HTML via server component) for all CSS variables; explicit props for `primaryColorRaw`, `razorpayThemeColor`, `logoUrl`, `storeName`, `faviconUrl`.

---

## 4. Three Theme Brands: Electra, Velvet, Harvest

### Electra (Electronics — clean, technical, blue/silver)

**Brand palette:**
```
--primary:        #1d4ed8   (electric blue)
--secondary:      #1e40af   (deeper blue)
--accent:         #0ea5e9   (sky blue)
--background:     #f8fafc   (cool near-white)
--surface:        #ffffff
--foreground:     #0f172a   (slate 900)
--font-main:      Inter, system-ui, sans-serif
--font-heading:   Inter, system-ui, sans-serif
--radius:         6px        (0.375rem — subtle, technical)
--is-dark:        0
razorpay_theme_color: "#1d4ed8"
```

**What the Electra checkout looks like under this brand:**
- Header: store logo (tech product imagery), store name in Inter, clean horizontal layout.
- Form fields: `--input-bg: #f8fafc`, `--input-border: #cbd5e1` (slate 200), blue focus ring (`--primary`).
- CTA buttons: `#1d4ed8` background, white text, `border-radius: 6px`.
- Order summary: white surface card, thin slate border.
- Trust section: "Secure Checkout" badge in slate tones, no exaggerated iconography.
- Razorpay modal: electric blue theme (`#1d4ed8`).
- Overall feel: SaaS-clean, technical, information-dense without visual noise.

### Velvet (Fashion — luxe, premium, dark tones)

**Brand palette:**
```
--primary:        #1a1a1a   (near-black)
--secondary:      #292524   (warm dark)
--accent:         #b45309   (amber/gold)
--background:     #fafaf9   (warm off-white)
--surface:        #ffffff
--foreground:     #1c1917   (warm stone 900)
--font-main:      'Cormorant Garamond', Georgia, serif
--font-heading:   'Playfair Display', Georgia, serif
--radius:         0px        (sharp — luxury editorial)
--is-dark:        0
razorpay_theme_color: "#1a1a1a"
```

**What the Velvet checkout looks like under this brand:**
- Header: brand logo (fashion editorial), store name in Playfair Display, refined minimal layout.
- Form fields: white input with warm stone border, black focus ring.
- CTA buttons: near-black fill, white text, sharp corners (`border-radius: 0`).
- Order summary: warm off-white surface, stone border.
- Trust section: "Secured Checkout" in understated serif typography; no bold iconography.
- Razorpay modal: near-black (`#1a1a1a`) — matches brand.
- Overall feel: editorial luxury, quiet confidence, no gradients or drop-shadows.

**Note:** The `--font-main: 'Cormorant Garamond'` and `--font-heading: 'Playfair Display'` require these fonts to be preloaded in the checkout app's `<head>`. The centralized checkout must support a `google_fonts_required: string[]` field in `CheckoutBrandPayload` to preload brand fonts server-side. Without this, FOUT (flash of unstyled text) will occur.

### Harvest (Grocery — fresh, green, warm)

**Brand palette:**
```
--primary:        #16a34a   (green-600)
--secondary:      #15803d   (green-700)
--accent:         #f59e0b   (amber-400)
--background:     #f0fdf4   (green-50 — very light green tint)
--surface:        #ffffff
--foreground:     #052e16   (green-950)
--font-main:      'Plus Jakarta Sans', system-ui, sans-serif
--font-heading:   'Plus Jakarta Sans', system-ui, sans-serif
--radius:         12px       (0.75rem — friendly, approachable)
--is-dark:        0
razorpay_theme_color: "#16a34a"
```

**What the Harvest checkout looks like under this brand:**
- Header: bright logo (fresh produce photography), store name in Plus Jakarta Sans, friendly layout.
- Form fields: white inputs on green-tinted background, green focus ring.
- CTA buttons: `#16a34a` fill, white text, `border-radius: 12px` (friendly rounded).
- Order summary: white card on green-50 background.
- Trust section: "Freshness Guaranteed" badge in green tones; delivery promise prominent.
- Razorpay modal: green theme (`#16a34a`).
- Overall feel: energetic, fresh, approachable — high contrast on green scale.

**Note:** The current hardcoded COD payment button color `rgb(22 163 74)` in checkout-client.tsx is `#16a34a` — it accidentally matches Harvest perfectly. Every other store, however, gets this wrong green regardless of their brand. This must be replaced with `var(--primary)` or `primary_color_raw` as a prop.

### What Checkout Elements Change Per Brand

| Checkout Element | Electra Change | Velvet Change | Harvest Change |
|---|---|---|---|
| Header background | Cool white `#f8fafc` | Warm off-white `#fafaf9` | Green-tinted `#f0fdf4` |
| Logo treatment | Tech product icon | Editorial fashion mark | Fresh food imagery |
| Store name font | Inter (clean) | Playfair Display (serif) | Plus Jakarta Sans (rounded) |
| Form field focus | Blue ring | Black ring | Green ring |
| Primary CTA button color | `#1d4ed8` | `#1a1a1a` | `#16a34a` |
| Button border-radius | 6px | 0px | 12px |
| Order summary surface | White | White | White |
| Page background | Cool slate-50 | Warm stone-50 | Light green-50 |
| Razorpay modal color | Electric blue | Near-black | Green |
| Trust badge tone | Technical slate | Understated serif | Energetic green |
| Success screen accent | Blue checkmark | Gold/black checkmark | Green checkmark |

---

## 5. Checkout Branding Components

| Component | Branded Element | Token(s) Used | Current Status |
|---|---|---|---|
| **Header** | Store logo | `logo_url` (from payload) | Missing — not in `CheckoutClientProps` |
| **Header** | Store name | `store_name` (from payload) | Partial — in `<title>` and Razorpay modal only; not rendered in page body |
| **Header** | Background color | `--background` | Inherited via CSS |
| **CTA Buttons (Pay Now, Place Order)** | Fill color | `--primary` / `primary_color_raw` | Hardcoded `rgb(22 163 74)` / `rgb(26 26 46)` |
| **CTA Buttons** | Border radius | `--radius` | Hardcoded `rounded-xl` (not `var(--radius)`) |
| **Form Fields** | Focus ring | `--primary` | Partial — some use `var(--primary)`, some hardcoded indigo |
| **Form Fields** | Input background | `--input-bg` | Hardcoded `slate` classes |
| **Form Fields** | Input border | `--input-border` | Hardcoded `slate` classes |
| **Online Payment Selection Highlight** | Selected border | `--primary` | Hardcoded `border-indigo-500 bg-indigo-50` |
| **COD Selection Highlight** | Selected border | `--primary` | Hardcoded `border-green-500 bg-green-50` |
| **Order Summary Panel** | Panel background | `--surface` / `--card-bg` | Partial — `var(--lb-color-surface)` in some places |
| **Order Summary Panel** | Panel border | `--card-border` / `--border-color` | Hardcoded slate classes |
| **Shipping Rate Cards** | Selected border | `--primary` | Uses `border-[color:var(--lb-color-primary)]` — close but uses old `lb-color-primary` name |
| **Step Indicators** | Active step color | `--primary` | Uses `var(--primary, ...)` — correct |
| **Coupon Apply Button** | Color | `--primary` | Uses `var(--primary)` — correct |
| **Razorpay Payment Modal** | Modal theme color | `razorpay_theme_color` (raw hex) | Hardcoded `rgb(99 102 241)` — wrong |
| **Trust Section** | Icon color | `--primary` (accent) | Hardcoded slate icons, no store color |
| **Trust Section** | Content | Store-specific (e.g., freshness, tech warranty) | Generic platform copy only |
| **Footer** | Brand mark | `logo_url`, `store_name` | No footer exists in checkout |
| **Success Page (inline)** | Card background | `--surface` | Uses `var(--lb-color-surface)` — correct |
| **Success Page (inline)** | "Track Order" button | `--primary` | Uses `var(--primary)` — correct |
| **Success Page (inline)** | Success icon color | `--accent` | Hardcoded `bg-green-500` |
| **Success Page (inline)** | Heading text | `--foreground` | Hardcoded `text-slate-950` |
| **Browser `<title>`** | Store name in tab | `store_name` | Present via `generateMetadata` |
| **Favicon** | Store favicon | `favicon_url` | Inherited from subdomain layout `icons`; must be explicit in centralized checkout |

---

## 6. Invariants (What Never Changes)

The following checkout elements must never be merchant-customizable. These invariants apply regardless of the brand payload received:

### Payment Fields — PCI Compliance

The Razorpay SDK payment form fields (card number, expiry, CVV) are rendered inside the Razorpay iframe/modal and are never in the LetBuyy DOM. No CSS injection from the brand payload can or should reach inside the Razorpay frame. The only Razorpay-branding touchpoint that merchants control is `options.theme.color` (the modal header color) — and this must be the store's primary color, not a completely arbitrary value.

**Invariant:** No custom HTML or CSS may be injected into the Razorpay payment form. The `options.image` field must remain the LetBuyy platform logo (or be the store's own uploaded logo URL from `sites.logo_url`) — it must never accept a data URI or an arbitrary external URL that bypasses the CDN allowlist.

### Security Indicators

The following elements must be visible in all checkout sessions regardless of brand:

- HTTPS lock indicator (browser-level, uncontrollable)
- "Secured by LetBuyy" or "Powered by LetBuyy" trust mark — present in the checkout footer
- Razorpay payment partner badge (`razorpay.com/assets/razorpay-logo.svg`) — shown on the payments panel
- SSL/secure checkout indicator in the header trust bar

These elements may adopt `--foreground` for text color and may be positioned per the brand layout, but they cannot be hidden or made invisible via low-contrast token choices. A minimum contrast ratio of 3:1 against the background should be enforced on the "Powered by LetBuyy" mark server-side when validating `CheckoutBrandPayload`.

### LetBuyy Branding

- "Powered by LetBuyy" attribution must appear in the checkout footer on all plans. On paid plans (Pro/Scale), it may be styled to match the brand palette rather than the default LetBuyy purple. The attribute cannot be removed.
- The LetBuyy checkout URL structure (`{store}.letbuyy.com/checkout` or `checkout.letbuyy.com/c/{session}`) must not be replaced with a merchant-owned domain — this protects customers from phishing. Custom domains apply to the storefront, not the checkout payment form.

### GST Invoice Fields

The GST invoice — generated server-side via the `SECURITY DEFINER` RPC — must include the correct GSTIN, invoice number, and tax amounts. These are computed server-side from the canonical ledger and are never merchant-editable through branding. The invoice PDF layout may adopt the store's `logo_url` for the header mark.

---

## 7. Brand Configuration API

### Endpoint Design

```
GET /v1/checkout/brand?site={subdomain}
Authorization: not required (public brand data only — no PII, no secrets)
Cache-Control: max-age=300, stale-while-revalidate=60
```

**Response: `CheckoutBrandPayload`**

```typescript
interface CheckoutBrandPayload {
  store_id: string;            // uuid — sites.id
  store_name: string;          // sites.name
  logo_url: string | null;     // sites.logo_url
  favicon_url: string | null;  // sites.logo_url (reused as favicon per current layout.tsx pattern)
  google_fonts_required: string[];  // e.g. ["Playfair Display", "Plus Jakarta Sans"]
  tokens: {
    // Color tokens
    '--primary': string;        // hex
    '--secondary': string;      // hex
    '--accent': string;         // hex
    '--background': string;     // hex or rgb
    '--surface': string;        // hex or rgb
    '--foreground': string;     // hex or rgb
    '--border-color': string;   // rgba
    // Typography tokens
    '--font-main': string;      // CSS font stack
    '--font-heading': string;   // CSS font stack
    // Layout tokens
    '--radius': string;         // e.g. "6px"
    // State tokens
    '--is-dark': string;        // "0" or "1"
    // Input tokens
    '--input-bg': string;       // rgb
    '--input-border': string;   // rgb
    '--input-text': string;     // rgb
    '--input-placeholder': string; // rgba
    // Card tokens
    '--card-bg': string;        // rgb
    '--card-bg-secondary': string; // rgb
    '--card-border': string;    // rgb
  };
  // Explicit values needed by JS (cannot read CSS vars at construction time)
  razorpay_theme_color: string;   // raw hex — used in RazorpayOptions.theme.color
  primary_color_raw: string;      // raw hex — used in CTA button inline style
  is_dark: boolean;               // boolean for conditional rendering decisions
}
```

### DB Source

This query touches only the `sites` table and `templateConfig` JSONB column:

```sql
SELECT
  id,
  name,
  logo_url,
  template_config -> 'themeSettings' AS theme_settings
FROM sites
WHERE
  subdomain = $1
  AND status = 'published';
```

The computed tokens (all the derived rgba/rgb values for `--border-color`, `--input-bg`, `--card-bg`, etc.) are derived server-side by the same logic already present in `[subdomain]/layout.tsx` (lines 120–164 of the current layout). This derivation logic should be extracted into a shared utility `buildCheckoutBrandTokens(themeSettings: ThemeSettings): CheckoutBrandPayload['tokens']` in `packages/shared-types` or `services/api-gateway/src/utils/brand-tokens.ts`.

### Font Preloading

The `google_fonts_required` array enables the centralized checkout server component to emit `<link rel="preconnect" href="https://fonts.googleapis.com">` and the font `<link rel="stylesheet">` before the checkout HTML, preventing FOUT. Only fonts outside the `FONT_MAP` Next.js preloaded set need to be in this array. For standard fonts (Inter, Outfit, Poppins) already bundled by Next.js, this array is empty.

### Caching Strategy

Brand data changes only when a merchant publishes a new theme or updates store settings. A `Cache-Control: max-age=300` (5 minutes) with `stale-while-revalidate=60` is appropriate. The existing `purgeThemeStorefrontCache()` call in the theme publish pipeline should also bust the brand endpoint cache via a Cloudflare KV key: `checkout-brand:{site_id}`.

### Gateway Route Ownership

This endpoint belongs to the `api-gateway` under a new route group `checkout-brand`. Following the route-ownership lockstep rule: the endpoint must be registered in `services/api-gateway/src/routes/` (e.g., `checkout-brand.ts`) and proxied through `merchant-control-plane` and/or `storefront-runtime` via a `/api/checkout/brand` proxy route. The gateway is the only service that queries the DB directly for this data.

---

## 8. Brand Token Payload — Electra, Velvet, Harvest Examples

### Electra

```json
{
  "store_id": "...",
  "store_name": "Electra Store",
  "logo_url": "https://assets.letbuyy.com/stores/electra/logo.png",
  "favicon_url": "https://assets.letbuyy.com/stores/electra/logo.png",
  "google_fonts_required": [],
  "tokens": {
    "--primary": "#1d4ed8",
    "--secondary": "#1e40af",
    "--accent": "#0ea5e9",
    "--background": "#f8fafc",
    "--surface": "#ffffff",
    "--foreground": "#0f172a",
    "--border-color": "rgba(0,0,0,0.1)",
    "--font-main": "var(--font-inter), system-ui, sans-serif",
    "--font-heading": "var(--font-inter), system-ui, sans-serif",
    "--radius": "6px",
    "--is-dark": "0",
    "--input-bg": "rgb(249 250 251)",
    "--input-border": "rgb(203 213 225)",
    "--input-text": "rgb(15 23 42)",
    "--input-placeholder": "rgba(0,0,0,0.4)",
    "--card-bg": "rgb(255 255 255)",
    "--card-bg-secondary": "rgb(248 250 252)",
    "--card-border": "rgb(226 232 240)"
  },
  "razorpay_theme_color": "#1d4ed8",
  "primary_color_raw": "#1d4ed8",
  "is_dark": false
}
```

### Velvet

```json
{
  "store_id": "...",
  "store_name": "Velvet",
  "logo_url": "https://assets.letbuyy.com/stores/velvet/logo.png",
  "favicon_url": "https://assets.letbuyy.com/stores/velvet/logo.png",
  "google_fonts_required": ["Playfair Display", "Cormorant Garamond"],
  "tokens": {
    "--primary": "#1a1a1a",
    "--secondary": "#292524",
    "--accent": "#b45309",
    "--background": "#fafaf9",
    "--surface": "#ffffff",
    "--foreground": "#1c1917",
    "--border-color": "rgba(0,0,0,0.1)",
    "--font-main": "'Cormorant Garamond', Georgia, serif",
    "--font-heading": "'Playfair Display', Georgia, serif",
    "--radius": "0px",
    "--is-dark": "0",
    "--input-bg": "rgb(255 255 255)",
    "--input-border": "rgb(214 211 209)",
    "--input-text": "rgb(28 25 23)",
    "--input-placeholder": "rgba(0,0,0,0.4)",
    "--card-bg": "rgb(255 255 255)",
    "--card-bg-secondary": "rgb(250 250 249)",
    "--card-border": "rgb(214 211 209)"
  },
  "razorpay_theme_color": "#1a1a1a",
  "primary_color_raw": "#1a1a1a",
  "is_dark": false
}
```

### Harvest

```json
{
  "store_id": "...",
  "store_name": "Harvest Fresh",
  "logo_url": "https://assets.letbuyy.com/stores/harvest/logo.png",
  "favicon_url": "https://assets.letbuyy.com/stores/harvest/logo.png",
  "google_fonts_required": ["Plus Jakarta Sans"],
  "tokens": {
    "--primary": "#16a34a",
    "--secondary": "#15803d",
    "--accent": "#f59e0b",
    "--background": "#f0fdf4",
    "--surface": "#ffffff",
    "--foreground": "#052e16",
    "--border-color": "rgba(0,0,0,0.08)",
    "--font-main": "'Plus Jakarta Sans', system-ui, sans-serif",
    "--font-heading": "'Plus Jakarta Sans', system-ui, sans-serif",
    "--radius": "12px",
    "--is-dark": "0",
    "--input-bg": "rgb(240 253 244)",
    "--input-border": "rgb(187 247 208)",
    "--input-text": "rgb(5 46 22)",
    "--input-placeholder": "rgba(5,46,22,0.4)",
    "--card-bg": "rgb(255 255 255)",
    "--card-bg-secondary": "rgb(240 253 244)",
    "--card-border": "rgb(187 247 208)"
  },
  "razorpay_theme_color": "#16a34a",
  "primary_color_raw": "#16a34a",
  "is_dark": false
}
```

---

## 9. Migration Path for the Current Checkout

Before a centralized checkout app is built, the current embedded checkout (`checkout-client.tsx`) can be improved by:

1. **Add `logoUrl` and `primaryColorRaw` to `CheckoutClientProps`** — pass `store.logoUrl` and `store.templateConfig.themeSettings.primaryColor` as props from `checkout/page.tsx`.

2. **Replace hardcoded Razorpay theme color** — change line 530–532 from `theme: { color: 'rgb(99 102 241)' }` to `theme: { color: primaryColorRaw }` using the new prop.

3. **Replace hardcoded CTA button colors** — change line 1020 from `backgroundColor: paymentMethod === 'cod' ? 'rgb(22 163 74)' : 'rgb(26 26 46)'` to `backgroundColor: primaryColorRaw` (or use CSS variable with inline fallback).

4. **Replace hardcoded payment method highlight** — change `border-indigo-500 bg-indigo-50` to `border-[color:var(--primary)] bg-[var(--primary)]/10`.

5. **Add store logo to checkout header** — render `<Image src={logoUrl} ... />` or `<span>{storeName}</span>` at the top of the checkout form.

6. **Extract `buildCheckoutBrandTokens()` utility** — shared derivation logic for the CSS token computation, reusable by the embedded checkout's parent layout and a future centralized checkout API.

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/checkout-research/13-checkout-branding-platform.md`*
*Sources: `docs/checkout-research/05-checkout-branding-analysis.md`, `docs/theme-research/08-adaptive-theme-system.md`, `docs/theme-research/09-target-theme-architecture.md`, `packages/theme-engine/src/theme-bundle.ts` (lines 1880–1930, 730–793, LIQUID_THEME_TOKEN_MAP), `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` (lines 107–164), `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` (lines 67–74, 187, 530–532, 553–601, 967, 985, 1020, 1146)*
