# Checkout Branding Analysis

## 1. What Brand Data Reaches Checkout Today

### Logo

**Evidence it is NOT shown in checkout:**
- `checkout-client.tsx` has no logo `<Image>` or `<img>` element rendering the store logo in the page UI.
- The `CheckoutClientProps` interface (lines 67–74) receives only `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, and `onlinePaymentEnabled` — no `logoUrl`.
- `page.tsx` (lines 30–37) passes exactly those five props to `<CheckoutClient>` and does not fetch or forward any logo URL.

**Evidence it appears only inside the Razorpay modal — not in the LetBuyy checkout page itself:**
- `checkout-client.tsx` line 490: `image: '/logo.png'` — this is a static platform-level path, not a per-store logo URL. It appears in the `RazorpayOptions` object passed to the Razorpay SDK overlay, so the Razorpay modal shows the LetBuyy platform logo, not the merchant's logo.

**Evidence of platform logo in sidebar:**
- Line 1146: `src="https://razorpay.com/assets/razorpay-logo.svg"` — the only logo displayed in the checkout page itself is the Razorpay payment partner badge, not the store brand.

### Store Name

**Evidence it IS present — but only in the Razorpay overlay, not in the page header:**
- `CheckoutClientProps` line 71: `storeName: string` prop is declared.
- `checkout-client.tsx` line 488: `name: storeName` passed as the Razorpay modal `name` field — this makes the store name appear inside the Razorpay payment sheet.
- `page.tsx` line 34: `storeName={store.name}` — `store.name` is fetched via `StoreService.getStoreBySubdomain`.

**No visible storeName in the LetBuyy checkout page HTML** — there is no `<h1>` or heading element rendering `storeName` in the component's JSX.

**In page metadata:** `page.tsx` line 14: `title: \`Checkout | ${store.name}\`` — store name appears in the browser tab title via `generateMetadata`.

### Colors (Primary/Accent)

**Evidence of --lb-* / CSS variable usage in checkout:**
- `checkout-client.tsx` line 187: `const primaryColor = 'var(--primary, rgb(99 102 241))'` — all primary-color usage is delegated to the `--primary` CSS variable with an indigo fallback.
- Line 559: `bg-[var(--lb-color-surface)]` — success screen uses `--lb-color-surface`.
- Line 840: `border-[color:var(--lb-color-primary)]` — selected shipping rate border uses `--lb-color-primary`.
- `success/page.tsx` line 31: `style={{ color: 'var(--primary)' }}` — order status link uses `--primary`.

**Evidence of hardcoded colors (not using store theme):**
- Line 530–532: `theme: { color: 'rgb(99 102 241)' }` — the Razorpay modal theme color is **hardcoded** to indigo, not derived from `primaryColor` or any store variable.
- Line 1020: `backgroundColor: paymentMethod === 'cod' ? 'rgb(22 163 74)' : 'rgb(26 26 46)'` — the main payment button colors are hardcoded green (COD) and dark blue (online), not store-branded.
- Line 967: `border-indigo-500 bg-indigo-50` (online payment method selected state) and `accent-indigo-500` — hardcoded indigo for online payment radio/highlight.
- Line 985: `border-green-500 bg-green-50` and `accent-green-500` — hardcoded green for COD method highlight.
- `success/page.tsx` lines 17–38: the page uses only hardcoded Tailwind classes (`bg-slate-100`, `text-slate-500`) — no store color tokens.

**Summary:** `--primary` (which resolves to the store's real primary color when the layout CSS variables are in scope) is used for accent elements. But two of the most visible brand touchpoints — the CTA payment button and the Razorpay modal theme color — are hardcoded and do not reflect the store's configured color.

### Typography

**Evidence that custom fonts DO reach checkout:**
- The subdomain `layout.tsx` (lines 138–139) injects `--font-main` and `--font-heading` as CSS variables into `:root` from `store.templateConfig.themeSettings.fontFamily`. These variables apply to `body` and `h1–h6` via the inline `<style>` block.
- Checkout is a child route under `[subdomain]/layout.tsx`, so it inherits these `:root` CSS variable declarations automatically.

**Evidence of hardcoded fonts:**
- None found in checkout-specific files — fonts are purely inherited via the layout.

### Favicon/Metadata

**Checkout-page-specific metadata (`checkout/page.tsx`):**
- Line 7–18: `generateMetadata` calls `buildStoreMetadata(store, { title: \`Checkout | ${store.name}\`, ... })` — store-branded Open Graph image and title are set.
- No `icons` field is explicitly set in `checkout/page.tsx`'s `generateMetadata`.

**Favicon source:**
- `[subdomain]/layout.tsx` lines 60–62: the store-level `generateMetadata` sets `icons: { icon: store.logoUrl || '/favicon.ico' }` — this is the root layout, which governs the entire `[subdomain]/*` route tree including `/checkout`. The checkout page's own metadata does **not** override `icons`, so the favicon from the store layout persists. The store favicon is effectively the `logoUrl` (if set) or the platform default `/favicon.ico`.

---

## 2. Current Branding Score

| Element | Present | Dynamic (per-store) | Hardcoded | Missing from page |
|---|---|---|---|---|
| Logo | Partial | No — static `/logo.png` in Razorpay SDK only | Yes (platform logo) | Yes — no store logo in checkout page UI |
| Store Name | Partial | Yes — in Razorpay modal + `<title>` | No | Yes — not rendered in the visible page body |
| Primary Color | Partial | Yes — `var(--primary)` for accents/icons/CTAs | Partially — payment button and Razorpay modal hardcoded | — |
| Accent Color | Partial | Yes — `var(--accent)` inherited via layout | — | Not explicitly used in checkout elements |
| Typography | Yes | Yes — inherited from `[subdomain]/layout.tsx` `--font-main`/`--font-heading` | No | — |
| Favicon | Yes | Yes — `store.logoUrl` set in subdomain layout | No | — |
| Background Color | Partial | Yes — `var(--background)` used on outer wrapper | Partially — inner cards use hardcoded `slate-*` | — |
| Button Style | No | No | Yes — payment button `rgb(22 163 74)` / `rgb(26 26 46)` | Store accent color not applied to main CTA |
| Footer | No | — | — | Missing — checkout has no footer |
| Trust Badges | Yes (generic) | No — hardcoded icons (ShieldCheck, Truck, Package) | Yes — platform-generic, not store-customized | Store-specific trust messaging missing |

---

## 3. Theme Token Pipeline — Does It Reach Checkout?

For storefront sections, `--lb-*` CSS variables and `--primary`/`--font-main` etc. are injected by the `[subdomain]/layout.tsx` server component. That layout wraps all routes under `[subdomain]/`, including `/checkout`. The injection is done via an inline `<style>` tag at the `:root` level (layout.tsx lines 130–164) reading from `store.templateConfig.themeSettings`.

**Yes — the theme token pipeline does reach checkout**, but only partially:

- Inherited tokens (`--primary`, `--background`, `--font-main`, `--font-heading`, `--lb-color-surface`, `--lb-color-primary`) are available and used in some places.
- `checkout-client.tsx` correctly reads `var(--primary, rgb(99 102 241))` for accent elements (icons, step indicators, coupon apply button, order total color).
- `--lb-color-surface` is used on the success card (line 559), and `--lb-color-primary` on shipping rate borders (line 840).

**However — critical UI elements bypass the pipeline entirely:**

- The main payment CTA button (line 1020) ignores `primaryColor` and uses hardcoded `rgb(22 163 74)` (COD) and `rgb(26 26 46)` (online pay).
- The Razorpay modal `theme.color` (line 531) is hardcoded to `'rgb(99 102 241)'` instead of using `store.templateConfig.themeSettings.primaryColor` (which is available on the server in `page.tsx` but not passed as a prop to the client).
- The online payment method highlight uses hardcoded `border-indigo-500 bg-indigo-50` (line 967) rather than `--primary`.
- The `success/page.tsx` (the stale-Stripe redirect page) uses only hardcoded `slate-*` Tailwind classes — no theme token consumption at all.

---

## 4. Checkout Success Page Branding

The file at `apps/storefront-runtime/src/app/store/[subdomain]/checkout/success/page.tsx` is a **legacy stub**, not the real success screen.

**What it contains:**
- A generic "Order status" message with a `Package` icon (hardcoded `text-slate-500`, `bg-slate-100`).
- A "View your orders" link using `var(--primary)` (line 31) — the only brand token used.
- No store name, no logo, no brand color beyond `--primary` on a single link.
- Code comment (line 1–3) explains: "This route is kept so old links do not 404. Razorpay orders resolve inline via the checkout client."

**The real success screen** is inline inside `checkout-client.tsx` (lines 553–601), rendered when `isSuccess === true`:
- Uses `var(--lb-color-surface)` for the card background.
- Uses `primaryColor` (`var(--primary, rgb(99 102 241))`) for the "Track Your Order" button.
- No store logo, no store name display, no branded header.
- "Order Confirmed!" heading uses hardcoded `text-slate-950`.
- Green success icon is hardcoded (`bg-green-500`), not store-accent-colored.

---

## 5. Multi-Tenant Branding

**How checkout knows which store's branding to apply:**

1. The Next.js route is `[subdomain]/checkout/` — the subdomain segment identifies the tenant.
2. `[subdomain]/layout.tsx` fetches the store via `StoreService.getStoreBySubdomainAnyStatus(subdomain)` and injects per-store CSS variables into `:root`.
3. `checkout/page.tsx` fetches the store again via `StoreService.getStoreBySubdomain(subdomain)` for its own `generateMetadata` call and to read `store.codEnabled`/`store.onlinePaymentEnabled`.

**What data is passed from `page.tsx` (server) to `checkout-client.tsx` (client):**

- `storeId: store.id`
- `sellerId: store.sellerId`
- `subdomain` (string, from params)
- `storeName: store.name`
- `codEnabled: store.codEnabled !== false`
- `onlinePaymentEnabled: store.onlinePaymentEnabled !== false`

**What is NOT passed:**
- `logoUrl` — not in `CheckoutClientProps`
- `primaryColor` / `accentColor` — not passed; the client relies on inherited CSS vars
- `themeSettings` — not passed at all; theme is inherited implicitly via the layout's `:root` injection

This means checkout branding depends entirely on CSS variable inheritance. If checkout were ever extracted to a separate domain or app (e.g., `checkout.letbuyy.com`), that inheritance would break immediately because the `[subdomain]/layout.tsx` CSS injection would not be present.

---

## 6. Branding Architecture for Centralized Checkout

For a future `apps/checkout` (a centralized checkout app running at, e.g., `checkout.letbuyy.com/{storeId}`), per-store branding would require explicit data passing since the storefront-runtime layout would no longer be an ancestor.

**Token injection method:**
The `[subdomain]/layout.tsx` pattern should be replicated: the centralized checkout's server component reads `store.templateConfig.themeSettings` and generates an inline `<style>` block injecting `--primary`, `--accent`, `--background`, `--font-main`, `--font-heading`, and all derived tokens into `:root`. This must happen server-side to avoid FOUC.

**Logo delivery:**
`store.logoUrl` must be added to the checkout session data or passed as a prop to the checkout client. Currently `logoUrl` is never forwarded to the checkout UI — it only reaches the Razorpay SDK as the static platform path `/logo.png` (incorrect). A `CheckoutBrandingProps` type should carry `logoUrl`, `storeName`, and theme tokens.

**Color system:**
All inline `style={{ backgroundColor: ... }}` usages of hardcoded colors in `checkout-client.tsx` must be replaced with CSS variable references:
- Payment button: replace `rgb(22 163 74)` / `rgb(26 26 46)` with `var(--primary)` or a semantic `--cta-color` token.
- Razorpay `theme.color`: replace `'rgb(99 102 241)'` with the store's `primaryColor` string passed as a prop from the server component.
- Online payment highlight (`border-indigo-500 bg-indigo-50`): replace with `border-[var(--primary)] bg-[var(--primary)]/10`.

**What brand data needs to be in the checkout session:**

| Field | Current source | Required in centralized checkout |
|---|---|---|
| `storeId` | Already passed | Yes |
| `storeName` | Already passed | Yes |
| `logoUrl` | Not passed — missing | Yes |
| `primaryColor` | Inherited via CSS only | Yes — explicit prop for Razorpay `theme.color` and CTA |
| `accentColor` | Inherited via CSS only | Inject into `:root` |
| `fontFamily` / `headingFontFamily` | Inherited via CSS only | Inject into `:root` |
| `isDark` | Inherited via CSS only | Inject into `:root` |
| `borderRadius` | Inherited via CSS only | Inject into `:root` |
| `faviconUrl` | Inherited from layout `icons` | Must be explicit in centralized checkout `generateMetadata` |

---

## 7. Comparison: Theme Stores (Electra, Velvet, Harvest)

The three hypothetical theme brands represent meaningfully different visual identities. Mapping against what the checkout currently supports:

### Electra (electronics — clean, minimal, blue/silver)
- **Primary color:** A cool blue (e.g., `#0ea5e9`). Currently possible — `--primary` would pick this up from `themeSettings.primaryColor` for accent elements. The payment button would remain hardcoded dark/green and would look off-brand.
- **Typography:** Clean sans-serif (Inter, Space Grotesk). Currently possible via `--font-main` inheritance.
- **Missing:** Logo in checkout header. Razorpay modal would still show `rgb(99 102 241)` indigo, not Electra's blue.

### Velvet (fashion — luxe, serif, dark tones)
- **Primary color:** Deep jewel tones (e.g., `#7c3aed` / `#1e1b4b`). The `--primary` inheritance handles accent elements. The CTA button's hardcoded `rgb(26 26 46)` dark blue would accidentally match for dark themes but is not derived from the store color.
- **Typography:** Serif heading font (Playfair Display, Lora). Currently possible for inherited elements. The checkout form labels and body use `--font-main` / `font-family: var(--font-main)` via layout injection.
- **Missing:** The checkout page has no heading or hero element where a display serif would be visible. No store logo. The success card (`text-slate-950` hardcoded) ignores the dark theme.

### Harvest (grocery — fresh, green, warm)
- **Primary color:** A warm green (e.g., `#16a34a`). The COD payment button happens to be hardcoded `rgb(22 163 74)` green, which would look accidentally correct for Harvest but wrong for every other store.
- **Typography:** Friendly rounded sans-serif (Nunito). Inherits correctly via layout.
- **Missing:** The hardcoded COD green `rgb(22 163 74)` is the most obvious collision — it would over-green every non-Harvest store's COD button.

### What is currently possible vs missing

| Branding need | Currently possible | Missing / hardcoded |
|---|---|---|
| Per-store primary color on accent elements | Yes — via `var(--primary)` | Main payment CTA button; Razorpay modal color; online-payment radio highlight |
| Per-store font (body + headings) | Yes — inherited from layout | — |
| Store logo in checkout header | No | `logoUrl` not passed; no `<img>` in checkout UI |
| Store name in checkout body | No | Not rendered in visible HTML (only in Razorpay overlay + `<title>`) |
| Dark/light mode awareness | Partial — `var(--background)` on outer wrapper | Success card uses hardcoded `text-slate-900`/`slate-950` |
| Favicon | Yes — inherited from layout `icons` | Not set in checkout-specific `generateMetadata` |
| Button border-radius per theme | No | Checkout buttons use hardcoded `rounded-xl` not `var(--radius)` |
| Trust badges — store-customized | No | Generic platform icons only |
| Per-store footer | No | No footer in checkout |
