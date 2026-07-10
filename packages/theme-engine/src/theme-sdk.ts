// H1 — Theme SDK public facade
//
// All six functions documented here delegate to existing internals.
// This module adds ZERO new behaviour and contains ZERO stub logic.
// If an underlying capability does not exist, the corresponding SDK function is omitted here.
//
// HONESTY CONTRACT:
//   compileTheme  → wraps compilePortableToLiquidBundle (portable-to-liquid.ts)
//   validateTheme → wraps collectLiquidThemePackageBundleIssues + parseLiquidThemePackageBundle
//   lintTheme     → wraps lintThemeBundle (theme-linter.ts)
//   renderPreview → wraps LiquidRenderer.render (theme-renderer.ts) — requires JSDOM environment
//   listSectionTypes → merges BUILT_IN_SECTION_TYPES + Liquid parity types, deduplicated
//   getSectionSchema  → looks up BUILT_IN_SECTION_SCHEMAS[type]

import {
  compilePortableToLiquidBundle,
  type CompilePortableToLiquidResult,
  type PortableThemeTemplateConfig,
} from './portable-to-liquid';

import {
  collectLiquidThemePackageBundleIssues,
  parseLiquidThemePackageBundle,
  createLiquidParitySectionFiles,
  UnsupportedLiquidBundleSchemaVersionError,
  type LiquidThemePackageBundle,
} from './theme-bundle';

import { lintThemeBundle } from './theme-linter';
export type { ThemeLintIssue, ThemeLintRule } from './theme-linter';

import { LiquidRenderer, type ThemeRendererResult } from './theme-renderer';
import type { StoreTemplateConfig } from './index';
import { BUILT_IN_SECTION_TYPES, BUILT_IN_SECTION_SCHEMAS } from './built-in-section-schemas';
import type { SectionSchema } from './theme-registry';
import { THEME_LIQUID_PORTABLE_SECTION_PARITY } from './theme-governance';

// ---- validateTheme ----

export interface ValidateThemeResult {
  ok: boolean;
  issues: string[];
  bundle?: LiquidThemePackageBundle;
}

/**
 * Validate a raw (potentially unknown-shape) input against the LiquidThemePackageBundle Zod schema.
 * Also enforces the schema_version compatibility gate (G4).
 *
 * Returns `{ok: true, bundle, issues: []}` on success.
 * Returns `{ok: false, issues}` when validation fails — issues is a non-empty string array.
 */
export function validateTheme(input: unknown): ValidateThemeResult {
  // First: collect Zod issues (safe, no throws)
  const schemaIssues = collectLiquidThemePackageBundleIssues(input);
  if (schemaIssues.length > 0) {
    return { ok: false, issues: schemaIssues };
  }

  // Second: attempt parse (which also runs the schema_version gate — may throw
  // UnsupportedLiquidBundleSchemaVersionError for an explicit unknown version).
  try {
    const bundle = parseLiquidThemePackageBundle(input);
    return { ok: true, bundle, issues: [] };
  } catch (err: unknown) {
    if (err instanceof UnsupportedLiquidBundleSchemaVersionError) {
      return { ok: false, issues: [err.message] };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, issues: [msg] };
  }
}

// ---- compileTheme ----

export interface CompileThemeOptions {
  slug?: string;
  name?: string;
}

export interface CompileThemeResult {
  bundle: LiquidThemePackageBundle;
  warnings: string[];
}

/**
 * Compile a portable JSON template config (StoreTemplateConfig shape) into a validated
 * LiquidThemePackageBundle that the LiquidRenderer can render.
 *
 * Delegates to compilePortableToLiquidBundle from portable-to-liquid.ts.
 */
export function compileTheme(
  config: PortableThemeTemplateConfig,
  options?: CompileThemeOptions,
): CompileThemeResult {
  const result: CompilePortableToLiquidResult = compilePortableToLiquidBundle(config, options);
  return { bundle: result.bundle, warnings: result.warnings };
}

// ---- lintTheme ----

export { lintThemeBundle as lintTheme };

// ---- renderPreview ----

export interface RenderPreviewOptions {
  templateKey?: string;
  drops?: Record<string, unknown>;
  locale?: string;
}

/**
 * Render a preview of a LiquidThemePackageBundle section tree using the LiquidRenderer.
 *
 * ENVIRONMENT NOTE: LiquidRenderer instantiates JSDOM. This function requires a JSDOM-capable
 * Node.js environment (jsdom devDependency must be installed). It cannot run in edge/browser runtimes.
 *
 * Returns a ThemeRendererResult whose .status indicates 'rendered' | 'unsupported' | 'error'.
 * The .liquid.layoutHtml field contains the final rendered HTML (when status === 'rendered').
 */
export function renderPreview(
  bundle: LiquidThemePackageBundle,
  opts?: RenderPreviewOptions,
): Promise<ThemeRendererResult> {
  const storeTemplate: StoreTemplateConfig = {
    themeId: bundle.package.slug,
    liquidBundle: bundle,
    rendererEngine: 'liquid',
    themeSettings: {
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      accentColor: '#000000',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
      borderRadius: 0,
      enableAnimations: false,
      enableShadows: false,
      ...Object.fromEntries(
        Object.entries(bundle.config.settings_data.current).filter(
          ([, v]) => v !== null && v !== undefined,
        ),
      ),
    },
    sections: [],
  };

  const renderer = new LiquidRenderer();
  return renderer.render({
    context: {
      storeId: 'preview',
      subdomain: 'preview',
      path: '/',
      previewMode: true,
      locale: opts?.locale ?? 'en',
    },
    storeTemplate,
    liquidBundle: bundle,
    liquidTemplateKey: opts?.templateKey,
    liquidContext: opts?.drops as Record<string, unknown> | undefined,
  });
}

// ---- listSectionTypes ----

/**
 * Returns the combined set of known section type strings:
 *   - 25 camelCase built-in React section types (e.g. 'heroBanner', 'header')
 *   - kebab-case Liquid parity types from THEME_LIQUID_PORTABLE_SECTION_PARITY (e.g. 'hero-banner')
 *   - kebab-case keys from createLiquidParitySectionFiles() for completeness
 * Deduplicated and sorted alphabetically.
 */
export function listSectionTypes(): readonly string[] {
  const set = new Set<string>();

  // camelCase React built-in types
  for (const t of BUILT_IN_SECTION_TYPES) set.add(t);

  // Liquid parity kebab types
  for (const entry of THEME_LIQUID_PORTABLE_SECTION_PARITY) set.add(entry.liquidSectionType);

  // Liquid parity section file keys
  for (const key of Object.keys(createLiquidParitySectionFiles())) set.add(key);

  return Object.freeze(Array.from(set).sort());
}

// ---- getSectionSchema ----

/**
 * Look up the SectionSchema for a built-in camelCase section type (e.g. 'heroBanner', 'header').
 * Returns null for unknown types (including kebab-case Liquid types — those carry their schema
 * inline in the section file's {% schema %} block).
 */
export function getSectionSchema(type: string): SectionSchema | null {
  return (BUILT_IN_SECTION_SCHEMAS as unknown as Record<string, SectionSchema | undefined>)[type] ?? null;
}
