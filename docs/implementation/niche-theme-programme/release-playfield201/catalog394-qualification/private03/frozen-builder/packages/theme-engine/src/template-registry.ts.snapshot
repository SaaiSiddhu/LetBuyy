// ============================================================================
// Phase V — Template Type Registry
// ----------------------------------------------------------------------------
// A first-class registry of all Shopify-parity template base keys,
// along with per-template metadata:
//   - allowedDrops:        Liquid drop names a template may access (allowlist)
//   - alternatesAllowed:   whether named variants (e.g. product.custom) may exist
//   - sectionGroupRoles:   which section group roles render on this template
//   - requiresLayout:      whether the main theme layout wraps this template
//
// Exported API:
//   - TEMPLATE_TYPE_REGISTRY         — the canonical per-type metadata map
//   - MAX_TEMPLATE_VARIANTS_PER_TYPE — cap on alternate variants per base type
//   - parseTemplateKey(key)          — { baseType, suffix | null }
//   - validateTemplateKey(key)       — throws InvalidTemplateKeyError on invalid
//   - resolveAlternateTemplate(...)  — suffix → key lookup with base fallback
//   - getAllowedDropsForTemplate(key) — allowed Liquid drop names for a key
//
// DESIGN RULES (non-negotiable):
//   - Pure + deterministic: no I/O, no side effects, no imports with state.
//   - Backward compat: all existing bundle keys parse + validate cleanly:
//       index, product, collection, cart, search, not_found, password, policy,
//       blog, article, page, customers/login, customers/register, etc.
//   - Context isolation: getAllowedDropsForTemplate is an ALLOWLIST — never
//     broadens a template's data access beyond what is documented here.
//     Phase V must NOT change buildLiquidScope behaviour; this registry is
//     additive documentation + future-enforcement surface.
//   - RISK-DUAL-N01: template KEY changes mutate template INSTANCES only;
//     section_definitions / block_definitions are never touched here.
//
// KNOWN PRODUCTION BUG (tracked, NOT fixed in Phase V):
//   StorefrontRouteType (apps/commerce/web/src/lib/theme-engine/types.ts)
//   uses underscore form for customer routes ('customer_account', 'customer_orders', …)
//   while the canonical bundle keys use slash form ('customers/account', 'customers/orders', …).
//   resolveTemplateKey() in template-resolver.ts returns the route type unchanged,
//   so all customer Liquid templates are currently unreachable in production.
//   Fix is a tracked follow-on; the registry documents the canonical slash keys.
// ============================================================================

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

/** Maximum number of named alternate variants per base template type. */
export const MAX_TEMPLATE_VARIANTS_PER_TYPE = 20;

/** Maximum allowed length of a template key (must match ThemeDocumentTemplateSchema.key.max). */
export const MAX_TEMPLATE_KEY_LENGTH = 120;

/**
 * Prototype-pollution keys that must never be used as template keys.
 * Intentionally duplicated from theme-document.ts to avoid a document/registry
 * circular dependency.
 */
const BLOCKED_TEMPLATE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRY ENTRY TYPE
// ──────────────────────────────────────────────────────────────────────────────

export interface TemplateTypeEntry {
  /**
   * Liquid drop names this template type is permitted to access.
   * This is the intended allowlist; Phase V does NOT enforce it in buildLiquidScope
   * (additive-only to preserve backward compat). Future enforcement can check
   * getAllowedDropsForTemplate before injecting commerce drops.
   */
  readonly allowedDrops: readonly string[];
  /**
   * Whether named alternate variants (e.g. product.custom, page.contact) are
   * permitted for this base type. The cap MAX_TEMPLATE_VARIANTS_PER_TYPE applies
   * when alternatesAllowed is true.
   */
  readonly alternatesAllowed: boolean;
  /**
   * Which section group roles render alongside this template.
   * password: [] (standalone, no header/footer).
   * gift_card: ['header'] (no footer per Shopify parity).
   * All others: ['header', 'footer'].
   * NOTE: enforcement in the render plan is a future follow-up; this field
   * is the authoritative model for Phase V.
   */
  readonly sectionGroupRoles: readonly ('header' | 'footer')[];
  /**
   * Whether this template is rendered inside the main layout (layout/theme.liquid).
   * password and gift_card are standalone (no layout wrapper).
   */
  readonly requiresLayout: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// TEMPLATE TYPE REGISTRY
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Canonical map of every Shopify-parity template base key to its type metadata.
 *
 * Keys in this registry use the BUNDLE key format (slash form for customer routes:
 * 'customers/login', 'customers/account', …) — NOT the StorefrontRouteType format
 * (underscore form: 'customer_account', …). See the known-bug comment at top of file.
 *
 * Template keys marked (NOT YET IN BUNDLE) have registry definitions for forward
 * compatibility; their Liquid section sources and bundle entries are out of Phase V scope.
 */
export const TEMPLATE_TYPE_REGISTRY: Readonly<Record<string, TemplateTypeEntry>> = Object.freeze({
  // ── Core commerce templates ──────────────────────────────────────────────

  /** Home / landing page. */
  index: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * Product detail page.
   * alternatesAllowed: true — merchants can assign product.custom, product.preorder, etc.
   * Shopify parity: product.<suffix>.json selectable per product.
   */
  product: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'product', 'linklists'],
    alternatesAllowed: true,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * Collection listing page.
   * alternatesAllowed: true — collection.seasonal, collection.sale, etc.
   */
  collection: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'collection', 'linklists'],
    alternatesAllowed: true,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * All-collections listing page (list-collections).
   * NOT YET IN BUNDLE — registry definition for forward compatibility.
   * Note: the hyphen in the key is intentional (Shopify parity: list-collections.json).
   */
  'list-collections': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'collections', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  // ── Content templates ────────────────────────────────────────────────────

  /**
   * CMS / custom page.
   * alternatesAllowed: true — page.contact, page.faq, page.about, etc.
   */
  page: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'page', 'linklists'],
    alternatesAllowed: true,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Policy pages (privacy, terms, refund, shipping, etc.). */
  policy: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'page', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Blog listing page — shows article excerpts. */
  blog: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'blog', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Blog article (post) detail page. */
  article: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'article', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  // ── Transactional templates ──────────────────────────────────────────────

  /** Cart summary page. */
  cart: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'cart', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Search results page. */
  search: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'search', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  // ── Special-purpose templates ────────────────────────────────────────────

  /**
   * 404 Not Found page.
   * Key uses underscore ('not_found') to match the existing bundle key and
   * StorefrontRouteType — no mismatch for this route.
   */
  not_found: {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'linklists'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * Password / coming-soon page.
   * Standalone layout: no header, no footer (pre-access gate).
   * NOTE: proxy.ts routes password-mode stores to React (/preview/coming-soon).
   * This Liquid template is production-ready but awaits proxy routing update (Phase F).
   */
  password: {
    allowedDrops: ['shop', 'request', 'settings', 'routes'],
    alternatesAllowed: false,
    sectionGroupRoles: [],
    requiresLayout: false,
  },

  /**
   * Gift card page.
   * NOT YET IN BUNDLE — registry definition for forward compatibility.
   * Standalone header-only layout per Shopify parity (no footer).
   */
  gift_card: {
    allowedDrops: ['shop', 'request', 'settings', 'routes'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header'],
    requiresLayout: false,
  },

  // ── Customer account templates (slash key = canonical bundle key) ─────────
  // KNOWN BUG: StorefrontRouteType uses underscore form (customer_account, …)
  // but resolveTemplateKey returns the route type unchanged, so the bundle's
  // slash-key templates are currently unreachable in production.
  // See: apps/commerce/web/src/lib/theme-engine/template-resolver.ts.

  /** Customer login form. */
  'customers/login': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer registration form. */
  'customers/register': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer account dashboard. */
  'customers/account': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer', 'buyer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer order history listing. */
  'customers/orders': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'buyer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer single-order detail page. */
  'customers/order': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'buyer', 'order'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer address management page. */
  'customers/addresses': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer', 'buyer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer account settings page. */
  'customers/settings': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer', 'buyer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /** Customer wishlist page. */
  'customers/wishlist': {
    allowedDrops: ['shop', 'request', 'settings', 'routes', 'customer'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * Customer password reset form.
   * NOT YET IN BUNDLE — registry definition for forward compatibility.
   * No customer drop pre-auth; only shop/request/settings/routes.
   */
  'customers/reset': {
    allowedDrops: ['shop', 'request', 'settings', 'routes'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },

  /**
   * Customer account activation form.
   * NOT YET IN BUNDLE — registry definition for forward compatibility.
   * No customer drop pre-auth; only shop/request/settings/routes.
   */
  'customers/activate': {
    allowedDrops: ['shop', 'request', 'settings', 'routes'],
    alternatesAllowed: false,
    sectionGroupRoles: ['header', 'footer'],
    requiresLayout: true,
  },
});

/** Total number of base template types in the canonical registry. */
export const REGISTRY_BASE_TYPE_COUNT = Object.keys(TEMPLATE_TYPE_REGISTRY).length;

// ──────────────────────────────────────────────────────────────────────────────
// PARSED TEMPLATE KEY
// ──────────────────────────────────────────────────────────────────────────────

/** Result of splitting a template key on the first '.'. */
export interface ParsedTemplateKey {
  /**
   * The base template type (everything before the first '.').
   * For 'product.custom' → 'product'.
   * For 'customers/login' → 'customers/login' (no suffix).
   * For 'index' → 'index' (no suffix).
   */
  readonly baseType: string;
  /**
   * The alternate-template suffix (everything after the first '.').
   * null when there is no '.' in the key.
   */
  readonly suffix: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Splits a template key on the FIRST '.' to extract the base type and optional suffix.
 *
 * Examples:
 *   'product'           → { baseType: 'product',          suffix: null     }
 *   'product.custom'    → { baseType: 'product',          suffix: 'custom'  }
 *   'page.contact'      → { baseType: 'page',             suffix: 'contact' }
 *   'customers/login'   → { baseType: 'customers/login',  suffix: null     }
 *   'index'             → { baseType: 'index',            suffix: null     }
 *
 * NOTE: this function does NOT validate the key — call validateTemplateKey first.
 */
export function parseTemplateKey(key: string): ParsedTemplateKey {
  const dotIndex = key.indexOf('.');
  if (dotIndex === -1) {
    return { baseType: key, suffix: null };
  }
  const baseType = key.slice(0, dotIndex);
  const suffix = key.slice(dotIndex + 1);
  // Return null for an empty suffix (key ends with '.')
  return { baseType, suffix: suffix.length > 0 ? suffix : null };
}

// ──────────────────────────────────────────────────────────────────────────────
// VALIDATION ERROR
// ──────────────────────────────────────────────────────────────────────────────

/** Thrown by validateTemplateKey when a template key fails any safety constraint. */
export class InvalidTemplateKeyError extends Error {
  readonly key: string;
  readonly reason: string;

  constructor(key: string, reason: string) {
    super(`Invalid template key "${key}": ${reason}`);
    this.name = 'InvalidTemplateKeyError';
    this.key = key;
    this.reason = reason;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CHARSET PATTERNS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Valid charset for a complete template key (before suffix validation):
 *   - lowercase letters, digits, underscore (not_found, gift_card)
 *   - hyphen (list-collections)
 *   - slash (customers/login, customers/account, …)
 *   - dot (suffix separator for alternate templates: product.custom)
 * Must start with a lowercase letter or digit.
 */
const TEMPLATE_KEY_CHARSET_RE = /^[a-z0-9][a-z0-9_\-/.]*$/;

/**
 * Valid charset for the SUFFIX part (after the first '.').
 * Suffixes may NOT contain slashes or additional dots — one level only.
 * Must start with a lowercase letter or digit.
 */
const TEMPLATE_SUFFIX_CHARSET_RE = /^[a-z0-9][a-z0-9_\-]*$/;

// ──────────────────────────────────────────────────────────────────────────────
// VALIDATE
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validates a template key against all safety constraints.
 * Throws {@link InvalidTemplateKeyError} on the FIRST failure encountered.
 *
 * Constraints (in order):
 *   1. Non-empty and max {@link MAX_TEMPLATE_KEY_LENGTH} characters.
 *   2. Not a blocked prototype-pollution key (__proto__, constructor, prototype).
 *   3. Must not start with '/' (absolute path guard).
 *   4. Must not contain '..' (path-traversal guard — reuses artifact-exporter discipline).
 *   4b. Must not contain '//' (consecutive-slash guard — prevents ambiguous slash-routed keys).
 *   5. Charset guard: only [a-z0-9_\-/.] starting with [a-z0-9].
 *   6. Suffix charset guard (if suffix present): only [a-z0-9_\-] starting with [a-z0-9].
 *      (no dots or slashes in suffix — one level of alternate naming only)
 *
 * Backward-compatible: all existing bundle keys pass cleanly
 * (index, product, customers/login, not_found, list-collections, gift_card, etc.).
 */
export function validateTemplateKey(key: string): void {
  // 1. Length
  if (key.length === 0) {
    throw new InvalidTemplateKeyError(key, 'key must not be empty');
  }
  if (key.length > MAX_TEMPLATE_KEY_LENGTH) {
    throw new InvalidTemplateKeyError(
      key,
      `key length ${key.length} exceeds maximum ${MAX_TEMPLATE_KEY_LENGTH} characters`,
    );
  }

  // 2. Prototype-pollution guard
  if (BLOCKED_TEMPLATE_KEYS.has(key)) {
    throw new InvalidTemplateKeyError(key, `"${key}" is a blocked prototype-pollution key`);
  }

  // 3. No absolute path
  if (key.startsWith('/')) {
    throw new InvalidTemplateKeyError(key, 'key must not start with "/" (absolute path)');
  }

  // 4. No path-traversal segments
  if (key.includes('..')) {
    throw new InvalidTemplateKeyError(
      key,
      'key must not contain ".." (path-traversal guard)',
    );
  }

  // 4b. No consecutive slashes (e.g. 'customers//login' must be rejected)
  if (key.includes('//')) {
    throw new InvalidTemplateKeyError(key, 'key must not contain consecutive slashes');
  }

  // 5. Full-key charset
  if (!TEMPLATE_KEY_CHARSET_RE.test(key)) {
    throw new InvalidTemplateKeyError(
      key,
      'key must contain only [a-z0-9_\\-/.] and start with a lowercase letter or digit',
    );
  }

  // 6. Suffix charset (if present)
  const { suffix } = parseTemplateKey(key);
  if (suffix !== null && !TEMPLATE_SUFFIX_CHARSET_RE.test(suffix)) {
    throw new InvalidTemplateKeyError(
      key,
      `suffix "${suffix}" must contain only [a-z0-9_\\-] and start with a lowercase letter or digit (no slashes or dots in suffix)`,
    );
  }
}

/** Editor transport uses the same key authority as the document and bundle. */
export const ThemeEditorTemplateKeySchema = z.string().trim().superRefine((key, context) => {
  try {
    validateTemplateKey(key);
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof InvalidTemplateKeyError ? error.reason : 'Invalid template key' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ALTERNATE TEMPLATE RESOLUTION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Looks up the canonical template key to use, given a base type and an optional
 * alternate suffix. Pure + deterministic: no I/O.
 *
 * Resolution order:
 *   1. If suffix is non-null/non-empty AND `${baseType}.${suffix}` exists in bundleTemplates → return it.
 *   2. If baseType exists in bundleTemplates → return baseType (base-key fallback).
 *   3. Neither exists → return undefined.
 *
 * @param bundleTemplates — the bundle's templates Record (keys are template keys).
 *   Typed as `Record<string, unknown>` so callers need not import LiquidThemePackageBundle.
 * @param baseType — the template base type (e.g. 'product', 'page').
 * @param suffix   — the alternate suffix (e.g. 'custom', 'contact') or null/undefined.
 * @returns the resolved template key, or undefined if not found.
 */
export function resolveAlternateTemplate(
  bundleTemplates: Record<string, unknown>,
  baseType: string,
  suffix: string | null | undefined,
): string | undefined {
  if (suffix) {
    const alternateKey = `${baseType}.${suffix}`;
    if (Object.prototype.hasOwnProperty.call(bundleTemplates, alternateKey)) {
      return alternateKey;
    }
  }
  if (Object.prototype.hasOwnProperty.call(bundleTemplates, baseType)) {
    return baseType;
  }
  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// ALLOWED DROPS LOOKUP
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns the allowed Liquid drop names for a given template key.
 *
 * The key is first parsed to extract its base type (stripping any suffix).
 * The base type is looked up in TEMPLATE_TYPE_REGISTRY.
 * If the base type is not in the registry (unknown template), a minimal safe
 * set of universal drops is returned — never the full commerce drop set.
 *
 * IMPORTANT: Phase V does NOT enforce these drops in buildLiquidScope.
 * This function is the authoritative ALLOWLIST definition; runtime enforcement
 * is a tracked follow-on (after all existing fixtures are verified to comply).
 *
 * @example
 *   getAllowedDropsForTemplate('product')        // ['shop','request','settings','routes','product','linklists']
 *   getAllowedDropsForTemplate('product.custom') // same — uses base type 'product'
 *   getAllowedDropsForTemplate('article')        // includes 'article', excludes 'product'
 */
export function getAllowedDropsForTemplate(key: string): readonly string[] {
  const { baseType } = parseTemplateKey(key);
  const entry = TEMPLATE_TYPE_REGISTRY[baseType];
  if (!entry) {
    // Unknown base type: return the minimal safe universal set.
    return Object.freeze(['shop', 'request', 'settings', 'routes']);
  }
  return entry.allowedDrops;
}

// ──────────────────────────────────────────────────────────────────────────────
// VARIANT CAP HELPER (bundle superRefine support)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Counts how many alternate variants (keys matching '<baseType>.<suffix>') exist
 * for each base type in a bundle templates record, and returns a map of
 * base types that exceed MAX_TEMPLATE_VARIANTS_PER_TYPE.
 *
 * Used by schema superRefines to enforce the variant cap without reimplementing
 * the counting logic.
 *
 * @returns Record<baseType, count> for only the base types that exceed the cap.
 */
export function findExcessiveVariantCounts(
  bundleTemplates: Record<string, unknown>,
): Record<string, number> {
  const countByBase: Record<string, number> = {};
  for (const key of Object.keys(bundleTemplates)) {
    const { baseType, suffix } = parseTemplateKey(key);
    if (suffix !== null) {
      countByBase[baseType] = (countByBase[baseType] ?? 0) + 1;
    }
  }
  const excess: Record<string, number> = {};
  for (const [baseType, count] of Object.entries(countByBase)) {
    if (count > MAX_TEMPLATE_VARIANTS_PER_TYPE) {
      excess[baseType] = count;
    }
  }
  return excess;
}
