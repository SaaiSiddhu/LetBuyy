# Checkout UI Architecture

> Evidence-based analysis. All line references are to source files as they exist in the repository.
> No code was modified. All findings are from direct file reads and grep output.

---

## 1. Rendering Model

### Is Checkout React or Liquid?

Checkout is **pure React**. `checkout-client.tsx` (1,160 lines) is a `'use client'` component with no Liquid template integration whatsoever.

Evidence:
- Line 1: `'use client';`
- No imports of any Liquid renderer, `renderLiquid`, `StorefrontCompositionEngine`, or `resolveAccountLiquid` — all grep queries returned empty.
- The component renders JSX directly using React hooks (`useState`, `useEffect`, `useRef`).
- The file uses `framer-motion` for animations and `next/image`, `next/script`, `next/link` — all React/Next.js primitives.

### Checkout Page Server Component

`page.tsx` (39 lines) is a Next.js **async server component**. It:

1. Calls `StoreService.getStoreBySubdomain(subdomain)` server-side to look up the store record.
2. Returns `notFound()` if the store does not exist.
3. Passes exactly five props to the client component: `storeId`, `sellerId`, `subdomain`, `storeName`, `codEnabled`, `onlinePaymentEnabled`.
4. Generates `noIndex: true` SEO metadata using `buildStoreMetadata`.

The server component passes **no theme data, no logo URL, and no color tokens** to the client. Only payment capability flags and string identifiers cross the server/client boundary.

### Can Checkout Be Liquid?

No evidence of any Liquid template for checkout anywhere in the checkout directory. The directory contains only:

```
checkout-client.tsx   (React client component)
page.tsx              (React server component)
paypal-return/        (stale Stripe/PayPal return route, not active)
success/              (order status page, also pure React)
```

There is no `checkout.liquid`, no `checkout.json`, and no Liquid renderer call in the checkout route. Per the CLAUDE.md constitution, Liquid canary is OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`), and the theme-engine freeze (ART-17) forbids new React-per-section after freeze. Checkout has no Liquid path whatsoever.

---

## 2. Component Anatomy

### checkout-client.tsx Structure

The 1,160-line file renders three distinct top-level states:

1. **Success screen** (lines 553–601): Shown when `isSuccess === true`. Renders a motion-animated card with order confirmation, order number, COD vs online payment messaging, "Track Your Order" and "Continue Shopping" links.

2. **Empty cart state** (lines 603–617): Shown when `items.length === 0 && !isSuccess`. Delegates to `<StorefrontEmptyState>`.

3. **Main checkout flow** (lines 619–1158): A two-panel grid (`grid-cols-1 lg:grid-cols-3`) containing:
   - Left panel (`lg:col-span-2`): `<AnimatePresence>` wrapping two motion-animated step views:
     - Step 1 (Address): saved-address autofill, full contact/address form, delivery speed selector
     - Step 2 (Payment): address summary, items list, payment method selector, pay button
   - Right panel (`lg:col-span-1`): sticky Order Summary sidebar with coupon input and trust badges

The file also loads the Razorpay script via `<Script src="https://checkout.razorpay.com/v1/checkout.js">` on mount.

### UI Library Usage

The single import block at lines 6–9 pulls these components from `@letbuyy/ui`:

| Component | Usage |
|---|---|
| `Button` | Used with `unstyled` prop throughout (saved address pills, delivery option buttons, nav, pay button, coupon apply) |
| `Input` | Used with `unstyled` prop for all form fields and radio buttons |
| `AlertCircle` | Checkout error banner, no-payment-methods warning |
| `ArrowLeft` | Back-to-cart navigation |
| `CheckCircle` | Step 1 completed indicator; success screen icon |
| `CreditCard` | Payment method label; pay button icon |
| `Loader2` | Processing spinner on pay button |
| `Lock` | Security trust note below pay button |
| `ShieldCheck` | Trust badge in order summary |
| `MapPin` | Delivery address section header; step 2 address summary header |
| `Truck` | Delivery speed header; COD payment method label; COD pay button icon |
| `Clock` | Delivery time estimate label |
| `Package` | Empty cart icon; items section header; success/order-status page icon |
| `User` | Full name field icon |
| `Phone` | Phone field icon |
| `Mail` | Email field icon |
| `Home` | Address textarea icon |

Also imported from `next/image`: `Image` (product thumbnails, Razorpay logo badge).
Also imported: `framer-motion` (`motion`, `AnimatePresence`) — not from `@letbuyy/ui`.

### Design Token Usage

The file uses **both** `--lb-*` CSS variables and raw Tailwind classes, with a mix of semantic theme tokens:

**`--lb-*` variables** (two occurrences):
- `var(--lb-color-surface)` — success screen card background (line 559)
- `var(--lb-color-primary)` — shipping rate selected border (line 840)

**Semantic theme tokens** (Tailwind utility classes wrapping CSS variables defined elsewhere):
- `card-theme`, `card-theme-secondary` — card backgrounds
- `text-theme`, `text-theme-secondary`, `text-theme-muted` — text hierarchy
- `border-card`, `bg-surface`, `bg-surface-hover` — borders/surfaces
- `input-theme` — input field base styling

**Raw `var()` CSS variables** (inline `style` props):
- `var(--background)` — page background
- `var(--primary, rgb(99 102 241))` — `primaryColor` variable set at line 187; used in ~15 inline style props for active states, borders, CTAs

**Raw Tailwind** (no token): success screen uses `border-slate-200`, `bg-slate-50`, `text-slate-950`, `text-slate-600`, `text-slate-700` — these are hardcoded and not token-backed.

**Mixed pattern**: the main checkout form is mostly token-backed; the success screen is largely hardcoded Tailwind slate colors.

---

## 3. Checkout Form Structure

All fields are defined in the `FormData` interface (lines 76–84) and validated in `validateForm()` (lines 313–325).

| Field | Type | Input Component | Validation | Required |
|---|---|---|---|---|
| `name` (Full Name) | `text` | `<Input unstyled>` | Non-empty string | Yes |
| `email` | `email` | `<Input unstyled>` | Regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$` | Yes |
| `phone` | `tel` | `<Input unstyled>` | Stripped digits ≥ 10; max 16 chars | Yes |
| `address` (Street) | `textarea` | native `<textarea>` | Non-empty string | Yes |
| `city` | `text` | `<Input unstyled>` | Non-empty string | Yes |
| `state` | `text` | `<Input unstyled>` | Non-empty string | Yes |
| `pincode` | `text` / `inputMode="numeric"` | `<Input unstyled>` | Exactly 6 digits | Yes |

There is **no address line 2 field** in the form. Address line 2 exists in the `SavedAddress` interface (line 93) and is joined with line 1 via comma when autofilling from a saved address.

There is **no country selector** — India is implicit (pincode is 6-digit, currency is hardcoded INR).

Phone normalization strips all non-digit/plus/hyphen/space characters (line 270).
Pincode normalization strips non-digits, max 6 chars (line 272).

---

## 4. Multi-Step vs Single-Page

Checkout renders as a **2-step wizard** within a single page (no URL navigation between steps).

Evidence:
- `const [step, setStep] = useState(1);` — line 156; comment: `// 1: Address, 2: Review & Pay`
- Step 1 renders at lines 675–896; step 2 renders at lines 899–1042
- `<AnimatePresence mode="wait">` wraps both steps (line 674) with slide-in/out transitions
- A visual progress indicator (lines 647–668) shows two numbered circles connected by a line; the active step is styled with `primaryColor`; the completed step shows `<CheckCircle>`
- Step labels ("Address", "Payment") are hidden on mobile via `hidden sm:inline` (lines 656, 666)
- Navigation: "Continue to Payment" button calls `proceedToPayment()` (validates form, then `setStep(2)`); "Change" link in step 2 calls `setStep(1)`

There is **no URL routing** between steps — no `useRouter().push()`, no route params, no query string update.

---

## 5. Mobile Responsiveness

Checkout uses Tailwind responsive prefixes throughout:

| Pattern | Usage |
|---|---|
| `grid-cols-1 lg:grid-cols-3` | Main layout: single-column on mobile, 3-column grid on desktop (line 671) |
| `lg:col-span-2` / `lg:col-span-1` | Form takes 2/3 width on desktop, sidebar takes 1/3 (lines 673, 1047) |
| `sm:grid-cols-2` | Name + Phone fields side-by-side on tablet+ (line 718) |
| `sm:grid-cols-3` | City + State + Pincode side-by-side on tablet+ (line 780) |
| `sm:grid-cols-2` | Standard/Express fallback delivery options (line 858) |
| `hidden sm:inline` | Step labels hidden on mobile, shown on sm+ (lines 656, 666) |
| `sticky top-24` | Order summary sidebar sticky on desktop; collapses to flow on mobile |

All interactive elements have `min-h-11` (44px minimum touch target) — consistent across buttons and inputs.

The container is `max-w-5xl` (`px-4` padding) — scales from ~360px mobile up.

---

## 6. State Management

All state is local React `useState` in `checkout-client.tsx`. There is no Zustand, Redux, Context API (other than `useCart`), or URL-based state.

| State Item | Hook | Where Defined |
|---|---|---|
| Cart items, total, clearCart | `useCart()` context | `@/context/cart-context` (imported line 3) |
| Current step (1 or 2) | `useState(1)` | line 156 |
| Form field values | `useState<FormData>({...})` | lines 174–182 |
| Form field errors | `useState<Partial<FormData>>({})` | line 184 |
| Payment method selection | `useState<PaymentMethod>` | line 162 |
| Delivery option (standard/express) | `useState<DeliveryOption>('standard')` | line 160 |
| Selected shipping rate ID | `useState<string \| null>(null)` | line 171 |
| Store shipping rates | `useState<StoreShippingRate[] \| null>(null)` | line 170 |
| Applied coupon | `useState<AppliedCoupon \| null>(null)` | line 164 |
| Coupon input text | `useState('')` | line 163 |
| Coupon error | `useState('')` | line 165 |
| Is coupon loading | `useState(false)` | line 166 |
| Checkout-level error message | `useState('')` | line 167 |
| Is processing (loading) | `useState(false)` | line 157 |
| Is success | `useState(false)` | line 158 |
| Order number | `useState('')` | line 159 |
| Razorpay script loaded | `useState(false)` | line 161 |
| Saved addresses list | `useState<SavedAddress[]>([])` | line 168 |
| Idempotency keys | `useRef<Record<string, string>>({})` | line 172 |

Cart state lives in a React context (`cart-context`). All other checkout state is ephemeral — lost on page refresh.

---

## 7. Accessibility & UX

### Error Handling

- **Checkout-level errors**: rendered at the top of the form as a red alert banner (`role="alert"`, `AlertCircle` icon, line 636–644). `showCheckoutError()` also calls `window.scrollTo({ top: 0 })` to bring the error into view.
- **Field-level errors**: each field renders a `<p className="text-red-500 text-xs mt-1">` inline error below the input when `errors[field]` is set. Invalid fields also get `ring-2 ring-red-300` focus ring.
- **Payment errors**: Razorpay's `payment.failed` event calls `showCheckoutError('Payment failed. Please try again.')`.
- **No-payment-methods state**: renders amber warning box (lines 1003–1011) with explanation.
- **Coupon errors**: rendered inline below the coupon input (line 1120).

### Loading States

- Pay button shows `<Loader2 className="animate-spin">` with "Processing..." text when `isProcessing` is true (lines 1022–1025).
- Coupon "Apply" button shows "Checking" text when `isCheckingCoupon` is true (line 1117).
- Razorpay pay button is `disabled` while script is loading (`!razorpayLoaded`, line 1018).

### Success Feedback

Success is rendered **inline** (not a redirect to `/checkout/success`). When `isSuccess` becomes true, the entire checkout UI is replaced by a `framer-motion` animated confirmation card (lines 553–601) showing order number, payment method summary, "Track Your Order", and "Continue Shopping" links.

The `/checkout/success` route (`success/page.tsx`) is a stale redirect handler for an old Stripe flow — it only renders "visit your orders page" and is not used by the current Razorpay/COD flow.

---

## 8. Branding Capabilities

### What Brand Data Reaches Checkout

The server component (`page.tsx`) passes only `storeName` to `CheckoutClient`. This is used in:
- Razorpay modal `name` field (line 488): `name: storeName` — the store name appears in the Razorpay payment popup
- No other usage

| Brand Element | Passed to Client | Used in UI |
|---|---|---|
| Store name | Yes (prop `storeName`) | Razorpay modal title only |
| Store logo | No | Hardcoded `/logo.png` passed to Razorpay `image` field (line 490) |
| Primary color / brand color | No | Hardcoded `var(--primary, rgb(99 102 241))` fallback to indigo |
| Secondary color | No | Not used |
| Font | No | Inherits from storefront layout |
| COD enabled flag | Yes | Controls payment method options |
| Online payment enabled flag | Yes | Controls payment method options |

### What Is Missing

- **Logo**: hardcoded to `/logo.png` (line 490). No dynamic logo URL from store record.
- **Brand colors**: `primaryColor` is set to `var(--primary, rgb(99 102 241))` — a CSS variable with a hardcoded indigo fallback. If the storefront CSS correctly sets `--primary` via the theme system, it will propagate; but no explicit color is passed from the server component.
- **Success screen**: uses hardcoded `border-slate-200`, `bg-slate-50`, `text-slate-950` — not token-backed; will not adapt to store brand colors.
- **Trust badges**: generic "Secure / Fast / Safe" — not configurable per store.
- **Store address/contact**: not shown; no return policy, refund policy, or support link.

---

## 9. Checkout as Standalone App Potential

### Storefront-Runtime Internal Dependencies

`checkout-client.tsx` imports from:

| Import | Source | Nature |
|---|---|---|
| `useCart` | `@/context/cart-context` | storefront-runtime internal React context |
| `StorefrontEmptyState` | `@/components/storefront/storefront-states` | storefront-runtime internal component |
| `readStorefrontApiJson`, `storefrontBrowserApiFetch`, `storefrontApiErrorMessage` | `@/lib/api/browser-client` | storefront-runtime internal API helpers |
| `Button`, `Input`, icons | `@letbuyy/ui` | shared package — portable |
| `next/image`, `next/link`, `next/script` | Next.js | framework-specific |
| `framer-motion` | npm | portable |

### What Would Need to Change

To extract checkout as a standalone React app or micro-frontend:

1. **Cart context**: Replace `useCart()` with a prop-injected cart, a query-string cart token, or a standalone cart state — the context is storefront-runtime-specific.
2. **API client helpers**: `storefrontBrowserApiFetch` is tied to the subdomain-scoped API routing pattern; a standalone app would need a different base URL strategy.
3. **`StorefrontEmptyState`**: Minor — trivially reimplemented or made generic.
4. **Next.js primitives**: `next/image`, `next/link`, `next/script` are Next.js-specific; a standalone micro-frontend would substitute `<img>`, `<a>`, and dynamic `<script>` injection.
5. **CSS token inheritance**: `card-theme`, `input-theme`, `text-theme-*`, `bg-surface` etc. are defined in the storefront-runtime global CSS/Tailwind config. A standalone app would need to bundle or replicate the design token stylesheet.
6. **`/logo.png`**: This static asset reference is root-relative to the storefront; a standalone app needs a dynamic `logoUrl` prop.
7. **`/api/*` proxy routes**: The browser calls `/api/orders`, `/api/shipping/rates`, `/api/coupons/validate`, `/api/customer/addresses`, `/api/customer/auto-create`. These are storefront-runtime Next.js API route proxies. A standalone app would call the gateway directly or maintain its own proxy.

---

## 10. Comparison: Current vs Target

| Capability | Current (storefront-runtime embedded) | Target (Centralized Checkout) |
|---|---|---|
| **Rendering engine** | Pure React (`'use client'`) | React (no Liquid path needed; Liquid freeze applies) |
| **Liquid template** | None — not supported, not planned | None — checkout is exempt from Liquid canary |
| **Brand colors** | CSS variable `var(--primary)` inherited from layout; hardcoded indigo fallback; success screen not token-backed | Explicit `brandColor` prop from store record; all surfaces token-backed |
| **Store logo** | Hardcoded `/logo.png` passed to Razorpay | Dynamic `logoUrl` prop from store record |
| **Store name** | Passed as prop; used only in Razorpay modal | Passed as prop; rendered in checkout header |
| **Cart state** | `useCart()` React context (storefront-runtime-specific) | Prop injection or cart token — portable |
| **API calls** | Via same-origin storefront-runtime Next.js `/api/*` proxies | Via gateway directly or dedicated checkout service |
| **Multi-step** | 2-step wizard (Address → Payment), inline state, no URL routing | Same 2-step pattern; URL-addressable steps desirable for back/forward |
| **Payment methods** | Razorpay + COD; Stripe/PayPal deferred (LB-2) | Same; flag-gated per store |
| **COD support** | Yes — `codEnabled` prop | Yes |
| **Coupon/discount** | Fully implemented in client | Should move validation server-side (currently client calls `/api/coupons/validate`) |
| **Shipping rates** | Real rates fetched from `/api/shipping/rates`; fallback to hardcoded standard/express | Same API; rate pincode should update on address fill (currently uses `000000` placeholder) |
| **Success screen** | Inline (no route navigation); stale `/checkout/success` route exists but not used | Route navigation to `/checkout/success` with server-rendered confirmation |
| **Extensibility** | None — monolithic 1,160-line client component | Composable sections; merchant-configurable trust badges, policies |
| **Accessibility** | `role="alert"` on errors; `aria-label` on icon buttons; `min-h-11` touch targets | Maintained; add `aria-live` on step transitions |
| **Mobile** | `lg:grid-cols-3` layout collapses to single-column; `sm:grid-cols-*` for field rows | Same responsive pattern |
| **Idempotency** | `crypto.randomUUID()` keys per session, stored in `useRef` — not durable across refresh | Persist idempotency keys in sessionStorage or derive from order ID |
| **Standalone portability** | No — depends on storefront-runtime context, API proxies, and CSS tokens | Yes — portable React component with prop-injected dependencies |
