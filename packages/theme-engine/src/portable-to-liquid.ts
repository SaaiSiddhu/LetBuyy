// L3 — Theme Compiler (Full Liquid V1): portable JSON template_config -> Liquid bundle.
//
// Translator ONLY (no plugin/extension/remote runtime, no second renderer). It maps a store's portable
// section instances onto the canonical first-party (LetBuyy Core) Liquid section/block/layout files and
// emits a LiquidThemePackageBundle that the existing LiquidRenderer renders. Merchant-authored strings
// stay as `{% schema %}` setting values (escaped at render via outputEscape:'escape') and are never
// raw-injected. Output is always re-validated by parseLiquidThemePackageBundle, so the compiler can
// never persist an invalid bundle.
import {
  createUrbanKicksLiquidThemeBundleFixture,
  parseLiquidThemePackageBundle,
  type LiquidThemePackageBundle,
} from './theme-bundle';
import { createLetbuyyCoreLiquidThemeBundleFixture } from './theme-bundle-core';
import { BLOCKED_DROP_KEYS } from './theme-renderer';

export interface PortableSectionInstance {
  id?: string;
  type: string;
  settings?: Record<string, unknown>;
  isVisible?: boolean;
}

export interface PortableThemeTemplateConfig {
  themeId?: string;
  themeSettings?: Record<string, unknown>;
  sections?: {
    header?: PortableSectionInstance;
    template?: PortableSectionInstance[];
    footer?: PortableSectionInstance;
  };
}

export interface CompilePortableToLiquidOptions {
  slug?: string;
  name?: string;
  /**
   * First-party fixture supplying the section/block/layout files the portable config is mapped onto.
   * Whatever the merchant's config does NOT override ships verbatim into the compiled bundle — the
   * layout `<title>`/`<body>` class, and the retained base index template when nothing is mappable —
   * so the default must be the neutral Core fixture, never the Urban Kicks demo branding.
   * 'urban-kicks' is an explicit opt-in for demo/seed callers that want that fixture verbatim.
   */
  baseTheme?: 'letbuyy-core' | 'urban-kicks';
}

export interface CompilePortableToLiquidResult {
  bundle: LiquidThemePackageBundle;
  warnings: string[];
}

// Portable React section types whose kebab form does not equal the Liquid section type.
// NOTE: 'newsletter' -> 'newsletter-signup' must stay in sync with LIQUID_SECTION_TYPE_ALIASES in
// theme-renderer.ts, which covers the render-time alias path for bundles persisted outside the compiler.
// D9: 'contentPage' and 'content-page' -> 'rich-content' must also stay in sync with LIQUID_SECTION_TYPE_ALIASES.
const PORTABLE_TO_LIQUID_TYPE_OVERRIDES: Record<string, string> = {
  hero: 'hero-banner',
  heroBanner: 'hero-banner',
  newsletter: 'newsletter-signup',
  newsletterSignup: 'newsletter-signup',
  announcement: 'announcement-bar',
  announcementBar: 'announcement-bar',
  appBlockSlot: 'app-block-slot',
  richContent: 'rich-content',
  productDetail: 'product-detail',
  // D9: contentPage maps to rich-content (both camelCase and kebab forms)
  contentPage: 'rich-content',
  'content-page': 'rich-content',
};

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function resolveLiquidSectionType(portableType: string, available: ReadonlySet<string>): string | null {
  const override = PORTABLE_TO_LIQUID_TYPE_OVERRIDES[portableType];
  if (override && available.has(override)) return override;
  const kebab = toKebabCase(portableType);
  if (available.has(kebab)) return kebab;
  if (available.has(portableType)) return portableType;
  return null;
}

// Reduce merchant-supplied settings to plain JSON with safe keys. Values are not escaped here — the
// renderer escapes them at output time — but anything non-serializable / unsafe-keyed is dropped.
function plainSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings as Record<string, unknown>)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || BLOCKED_DROP_KEYS.has(key)) continue;
    try {
      const cloned = JSON.parse(JSON.stringify(value ?? null));
      out[key] = cloned;
    } catch {
      // non-serializable value -> drop
    }
  }
  return out;
}

/**
 * Compile a portable store template_config into a schema-valid Liquid theme bundle.
 * Always returns a parsed (valid) bundle; unmappable sections are skipped and reported in `warnings`.
 */
export function compilePortableToLiquidBundle(
  templateConfig: PortableThemeTemplateConfig,
  options: CompilePortableToLiquidOptions = {},
): CompilePortableToLiquidResult {
  // Canonical first-party section/block/layout files. Core is the default so every compiled storefront
  // inherits neutral LetBuyy branding rather than the Urban Kicks demo strings (see baseTheme above).
  const base = options.baseTheme === 'urban-kicks'
    ? createUrbanKicksLiquidThemeBundleFixture()
    : createLetbuyyCoreLiquidThemeBundleFixture();
  const available = new Set(Object.keys(base.sections));
  const warnings: string[] = [];

  const indexSections: Record<string, { type: string; settings: Record<string, unknown> }> = {};
  const order: string[] = [];
  const usedIds = new Set<string>();
  let counter = 0;

  for (const instance of templateConfig.sections?.template ?? []) {
    if (!instance || typeof instance.type !== 'string') continue;
    if (instance.isVisible === false) continue;
    const liquidType = resolveLiquidSectionType(instance.type, available);
    if (!liquidType) {
      warnings.push(`Unmapped portable section type "${instance.type}" skipped`);
      continue;
    }
    let id = typeof instance.id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(instance.id)
      ? instance.id
      : `${liquidType}-${counter}`;
    while (usedIds.has(id)) id = `${liquidType}-${counter}-${usedIds.size}`;
    usedIds.add(id);
    counter += 1;
    indexSections[id] = { type: liquidType, settings: plainSettings(instance.settings) };
    order.push(id);
  }

  if (order.length === 0) {
    warnings.push('No mappable sections in portable template; retaining the base index template');
  }

  const headerType = resolveLiquidSectionType(templateConfig.sections?.header?.type ?? 'header', available) ?? 'header';
  const footerType = resolveLiquidSectionType(templateConfig.sections?.footer?.type ?? 'footer', available) ?? 'footer';

  const themeId = typeof templateConfig.themeId === 'string' ? templateConfig.themeId : '';
  const name = options.name ?? (themeId || base.package.name);
  const slug = options.slug
    ?? (/^[a-z0-9-]+$/.test(themeId) ? `${themeId}-liquid` : base.package.slug);

  const draft = {
    ...base,
    package: { ...base.package, slug, name },
    config: {
      ...base.config,
      settings_data: {
        current: { ...base.config.settings_data?.current, ...plainSettings(templateConfig.themeSettings) },
        presets: base.config.settings_data?.presets ?? {},
      },
    },
    templates: {
      header: {
        name: `${name} header`,
        layout: 'theme',
        sections: { 'header-default': { type: headerType, settings: plainSettings(templateConfig.sections?.header?.settings) } },
        order: ['header-default'],
      },
      footer: {
        name: `${name} footer`,
        layout: 'theme',
        sections: { 'footer-default': { type: footerType, settings: plainSettings(templateConfig.sections?.footer?.settings) } },
        order: ['footer-default'],
      },
      index: order.length > 0
        ? { name: `${name} home`, layout: 'theme', sections: indexSections, order }
        : base.templates.index,
    },
  };

  // Re-validate: the compiler can never emit an invalid Liquid bundle.
  return { bundle: parseLiquidThemePackageBundle(draft), warnings };
}

function configHasLiquidBundle(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).liquidBundle);
}

/**
 * L13 desync guard. Returns true when publishing `next` over `current` would STRIP an existing Liquid
 * bundle (a portable-only publish over a Liquid store) — the editor MUST block this to prevent the
 * renderer.engine / liquidBundle desync described in PHASE_L13. Pass each store's `template_config`.
 */
export function liquidBundlePublishWouldDesync(current: unknown, next: unknown): boolean {
  return configHasLiquidBundle(current) && !configHasLiquidBundle(next);
}

/**
 * L13 editor entry point. Compile a merchant's portable template_config to a Liquid bundle and produce
 * the `template_config` patch the editor publish/draft routes already accept (`liquidBundle` +
 * `rendererEngine:'liquid'`). The MCP editor calls this in buildDraftConfig/handlePublish; the storefront
 * resolver then renders Liquid for a canary store. Always schema-valid (compiler re-validates).
 */
export function compilePortableConfigForPublish(
  templateConfig: PortableThemeTemplateConfig,
  options: CompilePortableToLiquidOptions = {},
): { templateConfigPatch: Record<string, unknown>; warnings: string[] } {
  const { bundle, warnings } = compilePortableToLiquidBundle(templateConfig, options);
  return {
    templateConfigPatch: {
      rendererEngine: 'liquid',
      liquidBundle: bundle,
      layout: bundle.layout,
      schema_version: bundle.schema_version,
    },
    warnings,
  };
}
