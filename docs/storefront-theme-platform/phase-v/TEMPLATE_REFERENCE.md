# Template Reference — Theme Template System

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase introduced:** V (2026-07-11)
**Source of truth:**
- Registry: `packages/theme-engine/src/template-registry.ts` (canonical, pure, no I/O)
- Bundle schema: `packages/theme-engine/src/theme-bundle.ts`
- Document schema: `packages/theme-engine/src/theme-document.ts`
- Template resolver: `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`

---

## Registry Entry Shape

Every template base key maps to a `TemplateTypeEntry`:

```typescript
interface TemplateTypeEntry {
  allowedDrops:      readonly string[]              // Liquid drop names intended for this template
  alternatesAllowed: boolean                        // named variants (e.g. product.custom) permitted
  sectionGroupRoles: readonly ('header'|'footer')[] // section groups that render on this template
  requiresLayout:    boolean                        // wrapped in layout/theme.liquid
}
```

**Context isolation note:** `allowedDrops` is the **intended** allowlist for future enforcement. Phase V does not gate `buildLiquidScope` against this list — the change is additive and backward-compatible. Use `getAllowedDropsForTemplate(key)` to query.

**Section group enforcement note:** `sectionGroupRoles` is the **intended** model. Enforcement in the render plan is a tracked follow-on after Phase V.

---

## Template Key Syntax

### Base key

A base key identifies a template type. Valid examples: `product`, `page`, `customers/login`, `not_found`, `list-collections`, `gift_card`.

Charset: `[a-z0-9][a-z0-9_\-/.]` — lowercase letters, digits, hyphen, underscore, and slash. Slash is used for the customer template family (`customers/*`) following Shopify bundle conventions.

### Alternate template key (suffix)

An alternate key adds a suffix after the first `.` (dot): `product.custom`, `page.contact`, `collection.seasonal`.

Suffix charset: `[a-z0-9][a-z0-9_\-]` — no slashes, no additional dots. One level of naming only.

### Slash vs. underscore

The **canonical bundle key format** uses slashes for customer routes (`customers/login`, `customers/account`, etc.). `StorefrontRouteType` uses underscores (`customer_account`, etc.). This mismatch is a tracked production bug: all customer Liquid templates currently fall back to `index` at runtime.

---

## Key Constraints (`validateTemplateKey`)

1. Non-empty; max 120 characters.
2. Not a prototype-pollution key: `__proto__`, `constructor`, `prototype`.
3. Must not start with `/`.
4. Must not contain `..`.
5. Must not contain `//` (consecutive slashes).
6. Charset guard (full key): `[a-z0-9_\-/.]` starting with `[a-z0-9]`.
7. Suffix charset guard: `[a-z0-9_\-]` starting with `[a-z0-9]` (if suffix present).

Violation throws `InvalidTemplateKeyError` with `key` and `reason` properties.

---

## All Template Keys

### `index`

**Route:** Home page (`/`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In all fixtures

---

### `product`

**Route:** Product detail page (`/products/:handle`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `product`, `linklists`
**Alternates allowed:** **Yes** — up to 20 variants (e.g. `product.custom`, `product.preorder`)
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In all fixtures

Alternate assignment: the storefront resolves `product.<suffix>` from the product's `template_suffix` field (out of Phase V scope on the DB side; `resolveAlternateTemplate` handles the resolution logic).

---

### `collection`

**Route:** Collection listing page (`/collections/:handle`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `collection`, `linklists`
**Alternates allowed:** **Yes** — up to 20 variants (e.g. `collection.seasonal`, `collection.sale`)
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In all fixtures

---

### `list-collections`

**Route:** All-collections listing (`/collections`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `collections`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** **NOT YET IN BUNDLE** — registry definition for forward compatibility; Liquid source and bundle entry are out of Phase V scope.

Note: the hyphen in `list-collections` is intentional (Shopify parity: `list-collections.json`).

---

### `page`

**Route:** CMS page (`/pages/:handle`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `page`, `linklists`
**Alternates allowed:** **Yes** — up to 20 variants (e.g. `page.contact`, `page.faq`, `page.about`)
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In Urban Kicks and LetBuyy Core fixtures

---

### `policy`

**Route:** Policy pages (privacy, terms, refund, shipping, etc.)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `page`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In fixtures (policy route via `page` drop — Shopify parity)

---

### `blog`

**Route:** Blog listing page (`/blogs/:handle`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `blog`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In fixtures

---

### `article`

**Route:** Blog article / post detail (`/blogs/:blog_handle/articles/:article_handle`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `article`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In fixtures

---

### `cart`

**Route:** Cart summary page (`/cart`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `cart`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In all fixtures

---

### `search`

**Route:** Search results page (`/search`)
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `search`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In fixtures

---

### `not_found`

**Route:** 404 Not Found page
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `linklists`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** In all fixtures

Note: the underscore in `not_found` is intentional — this key matches both the bundle key format and `StorefrontRouteType` (no mismatch for this route).

---

### `password`

**Route:** Password / coming-soon page (store is password-protected)
**Allowed drops:** `shop`, `request`, `settings`, `routes`
**Alternates allowed:** No
**Section groups:** _(none)_ — standalone, no header or footer
**Requires layout:** **No** — rendered without `layout/theme.liquid`
**Bundle status:** In fixtures

Note: `proxy.ts` currently routes password-mode stores to the React `/preview/coming-soon` handler. The Liquid `password` template is production-ready but awaits a proxy routing update.

---

### `gift_card`

**Route:** Gift card display page
**Allowed drops:** `shop`, `request`, `settings`, `routes`
**Alternates allowed:** No
**Section groups:** **header only** — no footer (Shopify parity)
**Requires layout:** **No**
**Bundle status:** **NOT YET IN BUNDLE** — registry definition for forward compatibility.

---

## Customer Templates (slash-key format)

All customer templates use the slash-key bundle format (`customers/login`, etc.). See the known mismatch bug above.

### `customers/login`

**Route:** Customer login form
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/register`

**Route:** Customer registration form
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/account`

**Route:** Customer account dashboard
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/orders`

**Route:** Customer order history listing
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/order`

**Route:** Customer single-order detail page
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`, `order`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

Note: the `order` drop is specific to this template (single order detail); `customers/orders` (list) does not receive it.

---

### `customers/addresses`

**Route:** Customer address management page
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/settings`

**Route:** Customer account settings page
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/wishlist`

**Route:** Customer wishlist page
**Allowed drops:** `shop`, `request`, `settings`, `routes`, `customer`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes

---

### `customers/reset`

**Route:** Customer password reset form
**Allowed drops:** `shop`, `request`, `settings`, `routes`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** **NOT YET IN BUNDLE** — registry definition for forward compatibility.

Note: no `customer` drop pre-auth (user is not authenticated at reset time).

---

### `customers/activate`

**Route:** Customer account activation form
**Allowed drops:** `shop`, `request`, `settings`, `routes`
**Alternates allowed:** No
**Section groups:** header, footer
**Requires layout:** Yes
**Bundle status:** **NOT YET IN BUNDLE** — registry definition for forward compatibility.

Note: no `customer` drop pre-auth.

---

## Universal Drops (all templates)

Every template receives at minimum:
- `shop` — store metadata (name, domain, currency, etc.)
- `request` — current HTTP request context
- `settings` — theme-level global settings from `settings_data.json`
- `routes` — canonical URL helpers (Shopify-parity routes object)

---

## Variant Cap

`MAX_TEMPLATE_VARIANTS_PER_TYPE = 20`

A `ThemeDocument` may not contain more than 20 alternate variants for any single base type (e.g., at most 20 `product.*` keys). Enforced by `ThemeDocumentSchema.superRefine` (check #6, Phase V). The overall `MAX_TEMPLATES_PER_DOCUMENT = 100` hard cap bounds the worst case to 99 variants of one type, but the per-type cap is 20.

---

## Querying the Registry

```typescript
import {
  TEMPLATE_TYPE_REGISTRY,
  parseTemplateKey,
  validateTemplateKey,
  resolveAlternateTemplate,
  getAllowedDropsForTemplate,
  findExcessiveVariantCounts,
  InvalidTemplateKeyError,
} from '@letbuyy/theme-engine';

// Look up a template type
const entry = TEMPLATE_TYPE_REGISTRY['product'];
// { allowedDrops: [...], alternatesAllowed: true, sectionGroupRoles: ['header','footer'], requiresLayout: true }

// Parse a key
parseTemplateKey('product.custom');
// { baseType: 'product', suffix: 'custom' }

// Validate before persisting
try {
  validateTemplateKey(userInput);
} catch (e) {
  if (e instanceof InvalidTemplateKeyError) {
    console.error(e.reason); // human-readable rejection reason
  }
}

// Resolve an alternate
resolveAlternateTemplate(bundle.templates, 'product', 'custom');
// 'product.custom' if exists, 'product' if only base exists, undefined if neither

// Get allowed drops (future enforcement surface)
getAllowedDropsForTemplate('product');
// ['shop', 'request', 'settings', 'routes', 'product', 'linklists']
```
