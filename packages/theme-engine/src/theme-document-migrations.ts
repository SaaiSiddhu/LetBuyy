// ============================================================================
// Phase N — Theme Document V2 Migrations
// ----------------------------------------------------------------------------
// Shape-detection + normalization layer that accepts REAL current shapes
// (LiquidThemePackageBundle, already-valid ThemeDocument, editor draftConfig)
// and produces a ThemeDocument V2.
//
// REAL SHAPES ONLY: no invented historical migrations. The three shapes
// correspond to actual data in the system today:
//   SHAPE-1 has document_version + templates array → already ThemeDocument
//   SHAPE-2 has schema_version string + renderer.engine === 'liquid' → bundle
//   SHAPE-3 has templates as a Record + config.settings_schema → draftConfig
//   UNKNOWN → hard error (not UnsupportedThemeDocumentVersionError)
// ============================================================================

import { THEME_LIQUID_BUNDLE_SCHEMA_VERSION, parseLiquidThemePackageBundle } from './theme-bundle';
import {
  parseThemeDocument,
  toThemeDocumentV2,
  type ThemeDocument,
} from './theme-document';

/**
 * Migrates any recognised current-shape to ThemeDocument V2.
 *
 * Detection order (most-specific first):
 *  1. document_version string present → already a ThemeDocument (passthrough via parseThemeDocument)
 *  2. schema_version string + renderer.engine === 'liquid' → LiquidThemePackageBundle
 *  3. templates as non-array object + config.settings_schema present → editor draftConfig
 *  4. Unknown → throw Error (NOT UnsupportedThemeDocumentVersionError)
 */
export function migrateToThemeDocumentV2(raw: unknown): ThemeDocument {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Cannot migrate unknown shape to ThemeDocument V2: input is not an object');
  }

  const r = raw as Record<string, unknown>;

  // ── SHAPE-1: Already a ThemeDocument (has document_version + array templates) ──
  if (typeof r.document_version === 'string' && Array.isArray(r.templates)) {
    return parseThemeDocument(raw);
  }

  // ── SHAPE-2: LiquidThemePackageBundle ────────────────────────────────────────
  // Primary discriminator: schema_version is a string AND renderer.engine === 'liquid'.
  // This is reliable because bundles always stamp schema_version.
  if (
    typeof r.schema_version === 'string'
    && r.renderer !== null
    && typeof r.renderer === 'object'
    && !Array.isArray(r.renderer)
    && (r.renderer as Record<string, unknown>).engine === 'liquid'
  ) {
    return toThemeDocumentV2(parseLiquidThemePackageBundle(raw));
  }

  // ── SHAPE-3: Editor draftConfig ──────────────────────────────────────────────
  // Has templates as a plain (non-array) object AND config.settings_schema.
  // No schema_version at root (the editor strips or never writes it).
  if (
    r.templates !== null
    && typeof r.templates === 'object'
    && !Array.isArray(r.templates)
    && r.config !== null
    && typeof r.config === 'object'
    && !Array.isArray(r.config)
    && (r.config as Record<string, unknown>).settings_schema !== undefined
  ) {
    const config = r.config as Record<string, unknown>;

    // Reconstruct a bundle-compatible object from the draftConfig.
    // Rules:
    //  - Use templates as the authoritative template layer (bundle-compatible Record form).
    //  - Ignore draftConfig.themeSettings (editor-internal flat map).
    //  - For sections: attempt to use r.sections if it looks like a Liquid file dictionary
    //    (values have path + source + schema), otherwise fall back to {}.
    //  - Fall back to minimal defaults for missing required bundle fields.
    const sectionsRaw = r.sections;
    const sectionsIsLiquidFiles =
      sectionsRaw !== null
      && typeof sectionsRaw === 'object'
      && !Array.isArray(sectionsRaw)
      && Object.values(sectionsRaw as Record<string, unknown>).every(
        (v) =>
          v !== null
          && typeof v === 'object'
          && typeof (v as Record<string, unknown>).path === 'string'
          && typeof (v as Record<string, unknown>).source === 'string',
      );

    const bundleLike = {
      schema_version: THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
      package: r.package ?? {
        slug: 'draft',
        name: 'Draft Theme',
        version: '0.0.1',
        compatibility_range: `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`,
      },
      layout: r.layout ?? {
        theme: {
          path: 'layout/theme.liquid',
          source: [
            '<!doctype html>',
            '<html><head>{{ content_for_header | raw }}</head>',
            '<body>{{ content_for_layout | raw }}{{ content_for_footer | raw }}</body>',
            '</html>',
          ].join(''),
        },
      },
      config: {
        settings_schema: config.settings_schema ?? { settings: {} },
        settings_data: config.settings_data ?? { current: {}, presets: {} },
      },
      templates: r.templates,
      sections: sectionsIsLiquidFiles ? sectionsRaw : {},
      blocks: r.blocks ?? {},
      locales: r.locales ?? {},
      renderer: r.renderer ?? {
        engine: 'liquid',
        renderer_version: '0.1.0',
        liquid_ready: true,
        assets: {},
      },
    };

    return toThemeDocumentV2(parseLiquidThemePackageBundle(bundleLike));
  }

  // ── UNKNOWN ──────────────────────────────────────────────────────────────────
  throw new Error(
    'Cannot migrate unknown shape to ThemeDocument V2: '
    + 'expected document_version (ThemeDocument), schema_version + renderer.engine=liquid (bundle), '
    + 'or templates object + config.settings_schema (draftConfig)',
  );
}
