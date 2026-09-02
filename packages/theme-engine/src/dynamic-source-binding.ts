/**
 * Phase W — Dynamic Source Binding
 *
 * A DynamicSourceDescriptor is a typed plain-object (discriminated by __lb_binding: true)
 * that can be stored as a section/block settings VALUE in place of a literal scalar.
 *
 * At RENDER TIME resolveDynamicSourceDescriptors() replaces every descriptor in a settings
 * map with the resolved drop (looked up from already-fetched, site-scoped SiteDrops) or null.
 * Plain scalar values (string / number / boolean / null / array / non-descriptor object) pass
 * through byte-identically — this is the backward-compatibility guarantee.
 *
 * BINDING-SAFETY LAW
 *   Resolution only looks up by id/key in SiteDrops supplied by the caller (already
 *   tenant-scoped). There is NO independent DB query. A foreign or missing id resolves to
 *   null — never to a resource from another site.
 *
 * HONESTY LAW — metafield source
 *   Resolves to fallback (or null). The exact missing piece:
 *   apps/customer_web/src/lib/theme-engine/metafield-service.ts (NOT CONNECTED in Phase W).
 *   Until that hydration service is wired and its output is included in SiteDrops, metafield
 *   descriptors will always return the fallback value so merchants see a graceful placeholder.
 *
 * SANITIZER SAFETY
 *   Resolved drop objects are filtered through BINDING_BLOCKED_KEYS (the same list as
 *   BLOCKED_DROP_KEYS in theme-renderer.ts) before being returned, so credential-adjacent
 *   keys never reach Liquid scope even if they were present on the raw DB row.
 *   The theme-renderer.ts filterBlockedSettingsKeys pass that runs AFTER resolution never
 *   sees a raw descriptor — it only ever sees resolved scalars, drop objects, or null.
 *
 * RISK-DUAL-N01 (inherited from Phase U)
 *   A binding descriptor is stored in the section INSTANCE settings (the value of a field),
 *   never in section_definitions or ThemeBundleSectionDefinitionSchema. The editor onChange
 *   must write only to the instance settings object.
 */

// ---------------------------------------------------------------------------
// Blocked key list — mirrored from BLOCKED_DROP_KEYS in theme-renderer.ts.
// Keeping a local copy avoids a circular-import dependency (theme-renderer imports this module).
// It is EXPORTED so a test can assert it stays a superset of BLOCKED_DROP_KEYS — see
// dynamic-source-binding.test.ts, which fails if theme-renderer's list gains a key this one lacks.
// ---------------------------------------------------------------------------
export const BINDING_BLOCKED_KEYS = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
  'password',
  'password_hash',
  'access_token',
  'refresh_token',
  'signing_secret',
  'client_secret',
  'api_key',
  'secret_key',
  'private_key',
  'webhook_secret',
]);

// ---------------------------------------------------------------------------
// Descriptor types
// ---------------------------------------------------------------------------

/**
 * A resource binding resolves at render time to a product, collection, page, blog post,
 * or navigation menu drop that the current site owns.
 *
 * The `id` is looked up in the corresponding siteDrops map.
 * Foreign/missing id → null (or fallback). Never leaks cross-tenant data.
 */
export interface ResourceBinding {
  readonly __lb_binding: true;
  readonly source: 'resource';
  readonly resourceType: 'product' | 'collection' | 'page' | 'blog' | 'menu';
  readonly id: string;
  /** Optional value returned when the id is not found in siteDrops. Defaults to null. */
  readonly fallback?: unknown;
}

/**
 * A metafield binding.
 *
 * NOT-CONNECTED in Phase W. The metafield API routes and tables exist in the gateway
 * (store_metafield_definitions + store_metafield_values, all tenant-safe), but the
 * customer-web render path has no metafield hydration service.
 *
 * Exact missing piece:
 *   apps/customer_web/src/lib/theme-engine/metafield-service.ts
 *
 * Until that file is created and the fetched values are injected into SiteDrops.metafieldsById,
 * this descriptor resolves to `fallback` (or null). No data is fabricated.
 */
export interface MetafieldBinding {
  readonly __lb_binding: true;
  readonly source: 'metafield';
  readonly namespace: string;
  readonly key: string;
  readonly owner_type: string;
  readonly owner_id: string;
  /** Optional value returned while NOT-CONNECTED (or when the metafield is absent). */
  readonly fallback?: unknown;
}

/**
 * A static binding is a pass-through convenience wrapper.
 * It behaves byte-identically to an unwrapped literal (backward-compat).
 * Useful for round-tripping settings through binding-aware pipelines.
 */
export interface StaticBinding {
  readonly __lb_binding: true;
  readonly source: 'static';
  readonly value: unknown;
}

/** Tagged union of all supported binding descriptor shapes. */
export type DynamicSourceDescriptor = ResourceBinding | MetafieldBinding | StaticBinding;

// ---------------------------------------------------------------------------
// SiteDrops — the tenant-scoped resource maps passed to the resolver
// ---------------------------------------------------------------------------

/**
 * Already-fetched, site-scoped resource drops for the current render.
 *
 * TENANCY GUARANTEE: all maps must contain only resources owned by the store that
 * served the current request. The resolver does NOT re-verify ownership — the
 * caller (typically data-binding-engine.ts or the storefront composition layer)
 * is responsible for populating these maps with tenant-scoped data.
 *
 * Keys are resource UUID strings.
 */
export interface SiteDrops {
  /** Products for this render, keyed by product id (UUID). */
  productsById?: Record<string, unknown>;
  /** Collections for this render, keyed by collection id (UUID). */
  collectionsById?: Record<string, unknown>;
  /** Storefront pages, keyed by page id (UUID). */
  pagesById?: Record<string, unknown>;
  /** Blog posts, keyed by post id (UUID). */
  blogPostsById?: Record<string, unknown>;
  /** Navigation menus, keyed by menu id (UUID). */
  menusById?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Type guard: returns true when `v` is a DynamicSourceDescriptor.
 *
 * Returns false for all scalar types (string, number, boolean, null, undefined)
 * and for arrays, so existing settings values are never misclassified.
 */
export function isDynamicSourceDescriptor(v: unknown): v is DynamicSourceDescriptor {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const rec = v as Record<string, unknown>;
  if (rec['__lb_binding'] !== true) return false;
  const src = rec['source'];
  return src === 'resource' || src === 'metafield' || src === 'static';
}

/**
 * Replace every DynamicSourceDescriptor in `settings` with its resolved value.
 * Plain scalar values pass through byte-identically (backward-compatibility guarantee).
 *
 * This function is PURE — it does not perform any network or DB calls.
 * All resolution comes from the caller-supplied `siteDrops`.
 *
 * @param settings  The section or block instance settings Record.
 *                  May contain DynamicSourceDescriptor values in place of literals.
 * @param siteDrops Already-fetched, site-scoped resource maps. Must contain only
 *                  resources owned by the current store (tenant isolation enforced by caller).
 *
 * @returns A new Record where:
 *   - DynamicSourceDescriptor values are replaced by the resolved drop (or null/fallback on miss).
 *   - All other values are returned unchanged (same reference, same type).
 */
export function resolveDynamicSourceDescriptors(
  settings: Record<string, unknown>,
  siteDrops: SiteDrops,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    out[key] = isDynamicSourceDescriptor(value)
      ? resolveDescriptor(value, siteDrops)
      : value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Filter blocked keys from a resolved drop object (defense-in-depth).
 * Prevents credential-adjacent keys from reaching Liquid scope even if the raw DB row
 * contained them. Same key list as BLOCKED_DROP_KEYS in theme-renderer.ts.
 */
function filterDropKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!BINDING_BLOCKED_KEYS.has(k)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Look up `id` in a drops map and apply filterDropKeys if the result is a plain object.
 * Returns null if the map is absent or the id is not found.
 * Never throws.
 */
function lookupInDropsMap(
  dropsMap: Record<string, unknown> | undefined,
  id: string,
): unknown {
  if (!dropsMap) return null;
  const drop = dropsMap[id];
  if (drop === undefined || drop === null) return null;
  if (typeof drop === 'object' && !Array.isArray(drop)) {
    return filterDropKeys(drop as Record<string, unknown>);
  }
  // Scalar drop (edge case) — return as-is.
  return drop;
}

/**
 * Resolve a single DynamicSourceDescriptor to its value.
 * Never throws. Returns null or fallback on any miss.
 */
function resolveDescriptor(
  descriptor: DynamicSourceDescriptor,
  siteDrops: SiteDrops,
): unknown {
  try {
    switch (descriptor.source) {
      case 'static':
        return descriptor.value;

      case 'metafield':
        // NOT-CONNECTED in Phase W.
        // Exact missing piece: apps/customer_web/src/lib/theme-engine/metafield-service.ts
        // Once the hydration service is built and injects metafield values into SiteDrops,
        // this branch should look up descriptor.owner_id + namespace + key in that map.
        return descriptor.fallback ?? null;

      case 'resource': {
        const { resourceType, id, fallback } = descriptor;
        let dropsMap: Record<string, unknown> | undefined;

        switch (resourceType) {
          case 'product':    dropsMap = siteDrops.productsById;    break;
          case 'collection': dropsMap = siteDrops.collectionsById;  break;
          case 'page':       dropsMap = siteDrops.pagesById;        break;
          case 'blog':       dropsMap = siteDrops.blogPostsById;    break;
          case 'menu':       dropsMap = siteDrops.menusById;        break;
          default:
            // Future resourceType unknown to this version → graceful null.
            return fallback ?? null;
        }

        const resolved = lookupInDropsMap(dropsMap, id);
        return resolved !== null ? resolved : (fallback ?? null);
      }
    }
  } catch {
    // Never let a resolution error propagate to the renderer — return null.
    return null;
  }
}
