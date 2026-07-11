/**
 * Phase Y — App-Block Model (Lane A / Engine)
 *
 * Formalises the theme-engine's contract with app extensions placed into
 * app-block-slot sections. Provides:
 *   - Typed AppBlockReference: the datum a slot instance holds
 *   - Validation: slug-shaped ids, bounded count, BLOCKED_APP_BLOCK_SETTING_KEYS enforcement
 *   - filterAppBlockSettings: strips credential-adjacent keys BEFORE any Liquid scope exposure
 *   - Honest NOT-CONNECTED constants: the live app runtime does not exist
 *
 * SECURITY CONTRACT (theme-renderer.ts calls filterAppBlockSettings here):
 *   An app block's settings MUST be passed through filterAppBlockSettings before they
 *   enter the section-level Liquid drop (section.blocks[i].settings). This prevents a
 *   Liquid template from echoing {{ block.settings.api_key }} or similar credential keys.
 *   filterBlockedSettingsKeys in theme-renderer.ts applies the same logic to global
 *   settings; this module applies the equivalent logic to per-block app settings.
 *   Defined independently to avoid a circular-import cycle with theme-renderer.ts.
 *
 * SANDBOX CONTRACT:
 *   All app-provided HTML that reaches the renderer flows through sanitizeRenderedHtml
 *   (the SAME locked DOMPurify config) inside resolveLiquidAppBlockHtml in
 *   theme-renderer.ts. This module does NOT modify or bypass that path.
 *
 * ISOLATION CONTRACT:
 *   An app block is scoped to (tenant/site + installed app). It renders only with the
 *   drops the slot exposes. It cannot access secrets, other apps' data, or cross-tenant
 *   data. Per-block crash isolation (one bad app block → placeholder, others render) is
 *   implemented via a try/catch wrapping resolveLiquidAppBlockHtml in theme-renderer.ts.
 *
 * BACKWARD COMPAT:
 *   Sections without app blocks are unaffected; the app-block model is purely additive.
 */
import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of app-block references a single slot section instance may hold.
 * Exceeding this limit causes validateAppBlockReferences to reject the array.
 */
export const MAX_APP_BLOCKS_PER_SLOT = 20;

/**
 * Credential-adjacent setting keys that must NEVER reach the Liquid template scope
 * from app block settings. Mirrors BLOCKED_DROP_KEYS in theme-renderer.ts.
 *
 * Defined independently here to avoid a circular-import cycle:
 *   theme-renderer.ts → app-block-model.ts (one-way, safe)
 *   (app-block-model.ts must NOT import from theme-renderer.ts)
 *
 * When adding a key here, also add it to BLOCKED_DROP_KEYS in theme-renderer.ts
 * and update SEC-7 in qi-security.test.ts.
 */
export const BLOCKED_APP_BLOCK_SETTING_KEYS: ReadonlySet<string> = new Set([
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

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * An AppBlockReference is the datum stored in a section app-block-slot instance.
 * It identifies the installed app + extension and carries merchant-configured settings.
 *
 * The reference is THEME-SIDE only: it points to a live app runtime that is
 * NOT-CONNECTED (see APP_BLOCK_NOT_CONNECTED_REASON). When the runtime is absent the
 * slot renders APP_BLOCK_PLACEHOLDER_CLASS and marks the block honestly empty.
 *
 * RISK-DUAL-N01: mutations to an AppBlockReference change the slot instance (draft),
 * NEVER the section_definitions or block_definitions.
 */
export interface AppBlockReference {
  /** Installed-app identifier. Must match an entry in app_installations.app_id. */
  appId: string;
  /** The extension within the app that supplies block HTML. */
  extensionId: string;
  /**
   * The slot position this reference is mounted into.
   * Convention: '{surface}.{page}.{position}', e.g. 'storefront.home.after-hero'.
   */
  slot: string;
  /**
   * Merchant-configured settings for this block.
   * Filtered through filterAppBlockSettings before any Liquid scope exposure.
   */
  settings: Record<string, unknown>;
  /** When true the block is skipped during render but kept in the draft. */
  disabled?: boolean;
}

export interface AppBlockValidationResult {
  valid: boolean;
  /** Present only when valid=true. */
  ref?: AppBlockReference;
  errors: string[];
}

export interface AppBlockReferencesValidationResult {
  valid: boolean;
  refs: AppBlockReference[];
  errors: string[];
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

/**
 * Slug pattern for appId and extensionId.
 * Accepts alphanumeric with hyphens or underscores as separators.
 * Rejects dots, slashes, angle brackets, and other characters that could be
 * used for path traversal or tag injection.
 */
const APP_BLOCK_SLUG_PATTERN = /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/;

/**
 * Slot pattern: lowercase alphanumeric with dots, dashes, underscores.
 * Convention: 'surface.page.position'.
 */
const APP_BLOCK_SLOT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export const AppBlockReferenceSchema = z.object({
  appId: z
    .string()
    .min(1, 'appId must not be empty')
    .max(120, 'appId must not exceed 120 characters')
    .regex(APP_BLOCK_SLUG_PATTERN, 'appId must be slug-shaped (alphanumeric + hyphens/underscores)'),
  extensionId: z
    .string()
    .min(1, 'extensionId must not be empty')
    .max(120, 'extensionId must not exceed 120 characters')
    .regex(APP_BLOCK_SLUG_PATTERN, 'extensionId must be slug-shaped (alphanumeric + hyphens/underscores)'),
  slot: z
    .string()
    .min(1, 'slot must not be empty')
    .max(200, 'slot must not exceed 200 characters')
    .regex(APP_BLOCK_SLOT_PATTERN, 'slot must only contain alphanumeric, dot, dash, underscore'),
  settings: z.record(z.string(), z.unknown()).default({}),
  disabled: z.boolean().optional(),
});

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a single AppBlockReference.
 *
 * Rejects:
 *   - Non-slug appId / extensionId (path traversal, script injection prevention)
 *   - Settings that contain BLOCKED_APP_BLOCK_SETTING_KEYS
 *   - Invalid slot format
 */
export function validateAppBlockReference(input: unknown): AppBlockValidationResult {
  const result = AppBlockReferenceSchema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      }),
    };
  }

  const parsed = result.data;

  // Detect blocked setting keys — validation rejects them so merchants cannot
  // accidentally store credential-adjacent values that would be filtered silently.
  const blockedKeys = Object.keys(parsed.settings).filter(
    (key) => BLOCKED_APP_BLOCK_SETTING_KEYS.has(key),
  );
  if (blockedKeys.length > 0) {
    return {
      valid: false,
      errors: [`settings contain blocked credential-adjacent keys: ${blockedKeys.sort().join(', ')}`],
    };
  }

  return {
    valid: true,
    ref: parsed as AppBlockReference,
    errors: [],
  };
}

/**
 * Validate an array of AppBlockReferences for a single slot instance.
 *
 * Enforces MAX_APP_BLOCKS_PER_SLOT; accumulates per-reference errors.
 * A partial result (refs) is provided only for entries that passed validation.
 */
export function validateAppBlockReferences(
  inputs: unknown,
  maxCount: number = MAX_APP_BLOCKS_PER_SLOT,
): AppBlockReferencesValidationResult {
  if (!Array.isArray(inputs)) {
    return {
      valid: false,
      refs: [],
      errors: ['app block references must be an array'],
    };
  }
  if (inputs.length > maxCount) {
    return {
      valid: false,
      refs: [],
      errors: [`too many app block references: ${inputs.length} exceeds maximum of ${maxCount}`],
    };
  }

  const refs: AppBlockReference[] = [];
  const errors: string[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const result = validateAppBlockReference(inputs[i]);
    if (result.valid && result.ref) {
      refs.push(result.ref);
    } else {
      errors.push(...result.errors.map((e) => `[${i}] ${e}`));
    }
  }

  return {
    valid: errors.length === 0,
    refs,
    errors,
  };
}

// ─── Settings filtering ───────────────────────────────────────────────────────

/**
 * Filter app block settings before they enter any Liquid scope.
 *
 * SECURITY: applies the same key discipline as filterBlockedSettingsKeys in
 * theme-renderer.ts — identifier-shaped keys only (/^[a-zA-Z][a-zA-Z0-9_]*$/),
 * BLOCKED_APP_BLOCK_SETTING_KEYS never.
 *
 * Called by theme-renderer.ts in renderLiquidSectionBlocks at the app-block push
 * point (isLiquidAppBlockType branch) so that:
 *   - block.settings in the returned LiquidRenderedBlock are already clean
 *   - settings flowing into section.blocks[i].settings in the Liquid scope (lines 415–421
 *     of theme-renderer.ts) cannot contain api_key, webhook_secret, or prototype keys
 *
 * This is independent of filterBlockedSettingsKeys to avoid a circular-import cycle.
 */
export function filterAppBlockSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    // Key must be a valid JS identifier start: letter then letters/digits/underscore.
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) continue;
    if (BLOCKED_APP_BLOCK_SETTING_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

// ─── Placeholder HTML ─────────────────────────────────────────────────────────

/**
 * CSS class applied to the empty placeholder div rendered when the app runtime is absent.
 * The placeholder carries data-app-block-* attributes already in the DOMPurify ADD_ATTR
 * allowlist (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG in theme-renderer.ts).
 */
export const APP_BLOCK_PLACEHOLDER_CLASS = 'lb-app-block-placeholder--not-connected';

/**
 * CSS class applied to the error placeholder div rendered when a single app block
 * crashes during resolution. Crash isolation (one bad block → placeholder, others render)
 * is implemented via the try/catch in renderLiquidSectionBlocks in theme-renderer.ts.
 */
export const APP_BLOCK_ERROR_PLACEHOLDER_CLASS = 'lb-app-block-placeholder--error';

// ─── NOT-CONNECTED honest declaration ────────────────────────────────────────

/**
 * The live app-content runtime is NOT CONNECTED.
 *
 * Missing piece: no live app server produces app-block HTML. apps/app-marketplace and
 * apps/developer-portal are FROZEN (not deploy targets). The buildLiquidAppBlocks
 * function in storefront-runtime/composition-engine.tsx constructs first-party static
 * HTML from metadata stored in app_installations / app_extension_registrations tables
 * (title, content.heading/body/cta, iframe_url). No external app server is called
 * server-side; render_mode='iframe' defers actual app content to the browser loading
 * the iframe_url from the DB registration.
 *
 * When an app block's HTML is absent from the liquidAppBlocks map passed to the
 * renderer, theme-renderer.ts emits the static placeholder div at line 1160 (using
 * escapeHtmlAttribute over bundle-schema-validated blockId/block.type — safe without
 * sanitizeRenderedHtml because the values come from the parsed bundle, not untrusted
 * merchant input at render time).
 *
 * To connect a real app runtime: register the app in app_installations with a live
 * server URL, have the server supply HTML for each (siteId, appId, extensionId) tuple,
 * and populate the liquidAppBlocks map in the composition layer. That HTML MUST then
 * pass through sanitizeRenderedHtml (the same locked DOMPurify) before being stored in
 * the map — this is enforced inside resolveLiquidAppBlockHtml in theme-renderer.ts.
 */
export const APP_BLOCK_NOT_CONNECTED_REASON =
  'NOT-CONNECTED: no live app runtime produces app-block HTML. '
  + 'Missing piece: a live app server registered in app_installations and '
  + 'app_extension_registrations that can supply sanitized block HTML for a given '
  + '(siteId, appId, extensionId) tuple. apps/app-marketplace is FROZEN.';
