/// <reference path="./jsdom-runtime.d.ts" />
import { Liquid } from 'liquidjs';
import type { Config as DOMPurifyConfig, DOMPurify, WindowLike } from 'dompurify';
import type {
  StorefrontCompositionInput,
  StorefrontCompositionResult,
  ThemeRuntimeOrchestrator,
  RuntimeSectionInjection,
} from './execution-runtime';
import {
  composeStorefrontTheme,
  hydrateAndComposeStorefrontTheme,
} from './execution-runtime';
import {
  isLiquidAppBlockType,
  parseLiquidThemePackageBundle,
  type LiquidThemePackageBundle,
  type ThemeBundleTemplateBlock,
  type ThemeBundleTemplateSection,
} from './theme-bundle';
import type {
  BlockModel,
  SectionModel,
  StoreTemplateConfig,
  StorefrontTemplateConfig,
} from './index';

export type ThemeRendererEngine = 'json-contract' | 'liquid';
// 'rendered' = success; 'unsupported' = no bundle/template; 'error' = tried Liquid but all sections failed
// or the layout template itself threw. Callers that check `status !== 'rendered'` already handle 'error'
// correctly (they fall back to React) — no caller change required.
export type ThemeRendererStatus = 'rendered' | 'unsupported' | 'error';

export interface LiquidAppBlockRenderSource {
  html: string;
  settings?: Record<string, unknown>;
}

export interface LiquidAppEmbeds {
  header?: Array<string | LiquidAppBlockRenderSource>;
  footer?: Array<string | LiquidAppBlockRenderSource>;
}

export interface LiquidCommerceDrops {
  shop?: Record<string, unknown>;
  request?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  product?: unknown;
  collection?: unknown;
  collections?: unknown;
  cart?: unknown;
  customer?: unknown;
  search?: unknown;
  order?: unknown;
  // D1-A: LANE-B populates this from StoreModel.navigation via navToLinklists() in composition-engine.tsx.
  // Optional so LANE-A gate is green independently of LANE-B landing.
  linklists?: unknown;
  // E1: blog listing drop — populated by LANE-B composition-engine when route.type === 'blog'.
  // Shape: { articles: Array<{id, title, slug, excerpt, featured_image, published_at}>, current_page?, pages_count? }
  blog?: unknown;
  // E2: article drop — populated by LANE-B composition-engine when route.type === 'article'.
  // Shape: { title, body_html, slug, published_at, image }
  article?: unknown;
  // E3: page drop — populated by LANE-B composition-engine when route.type === 'page'.
  // Shape: { title, body_html, slug, page_type }
  page?: unknown;
}

export interface LiquidRenderedBlock {
  id: string;
  type: string;
  html: string;
  settings: Record<string, unknown>;
  isAppBlock: boolean;
}

export interface LiquidRenderedSection {
  id: string;
  type: string;
  html: string;
  settings: Record<string, unknown>;
  blocks: LiquidRenderedBlock[];
}

export interface LiquidRenderedTheme {
  templateKey: string;
  layoutHtml: string;
  contentForLayout: string;
  sections: LiquidRenderedSection[];
  // L4 — Liquid chrome: rendered header/footer template HTML so a Liquid page wears Liquid chrome
  // (not React) when the storefront layout opts into engine=liquid.
  header?: string;
  footer?: string;
}

export interface ThemeRendererInput extends StorefrontCompositionInput {
  orchestrator?: Pick<ThemeRuntimeOrchestrator, 'sectionRegistry' | 'blockRegistry'>;
  injections?: RuntimeSectionInjection[];
  liquidBundle?: LiquidThemePackageBundle;
  liquidTemplateKey?: string;
  liquidContext?: LiquidCommerceDrops;
  liquidAppBlocks?: Record<string, string | LiquidAppBlockRenderSource>;
  liquidAppEmbeds?: LiquidAppEmbeds;
}

export interface ThemeRendererResult {
  engine: ThemeRendererEngine;
  status: ThemeRendererStatus;
  composition: StorefrontCompositionResult;
  warnings: string[];
  liquid?: LiquidRenderedTheme;
}

export interface ThemeRenderer {
  readonly engine: ThemeRendererEngine;
  readonly interfaceVersion: string;
  render(input: ThemeRendererInput): Promise<ThemeRendererResult>;
}

export const THEME_RENDERER_INTERFACE_VERSION = '2026-05-theme-renderer';

const LIQUID_HYDRATION_CUSTOM_ELEMENTS = [
  'lb-add-to-cart',
  'lb-cart-drawer',
  'lb-search',
  'lb-variant-picker',
  'lb-review-form',
  'lb-wishlist-toggle',
  'lb-cart',
  'lb-customer-settings',
  'lb-address-manager',
] as const;

export const LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [
    ...LIQUID_HYDRATION_CUSTOM_ELEMENTS,
    'iframe',
    'meta',
  ],
  ADD_ATTR: [
    'aria-live',
    'aria-pressed',
    'class',
    'content',
    'data-app-block-app-id',
    'data-app-block-extension-id',
    'data-app-block-slot',
    'data-app-block-type',
    'data-block-id',
    'data-columns',
    'data-editor-mode',
    'data-lb-add-to-cart',
    'data-lb-add-to-cart-status',
    'data-authenticated',
    'data-base-path',
    'data-in-wishlist',
    'data-lb-island',
    'data-lb-variant-option',
    'data-store-id',
    'data-letbuyy-app-block',
    'data-product-currency',
    'data-product-id',
    'data-product-name',
    'data-product-price',
    'data-product-url',
    'data-email',
    'data-name',
    'data-phone',
    'data-search-url',
    'data-section-id',
    'data-theme-renderer',
    'data-variant-name',
    'data-variant-value',
    'height',
    'href',
    'loading',
    'name',
    'sandbox',
    'src',
    'title',
    'type',
    'width',
  ],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager)$/,
    attributeNameCheck: /^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|class|id|role|slot|title|type|name|value|href|src)$/i,
    allowCustomizedBuiltInElements: false,
  },
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['base', 'embed', 'object', 'script'],
};

const LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG: DOMPurifyConfig = {
  ...LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG,
  WHOLE_DOCUMENT: true,
};

// L2 — Asset Pipeline. Theme base stylesheet for Liquid `lb-*` sections, extracted from the React
// storefront `globals.css` (the canary-OFF React path keeps its own copy) plus `lb-spotlight`/`lb-badge`.
// Injected inline as a sanitizer-safe `<style>` (DOMPurify allows <style>; no <link>/asset-route, so no
// forbid-list relaxation). Class-based only (DOMPurify forbids inline `style` attrs). A cacheable external
// stylesheet is a deferred perf follow-up.
export const LIQUID_THEME_BASE_CSS = [
  '.lb-theme{min-height:100vh;background:var(--background);color:var(--foreground);font-family:var(--font-body);}',
  '.lb-theme :where(a){color:inherit;text-decoration:none;}',
  '.lb-header,.lb-footer,.lb-announcement-bar,.lb-hero-banner,.lb-category-grid,.lb-featured-products,.lb-product-grid,.lb-product-detail,.lb-newsletter-signup,.lb-first-party-spotlight,.lb-spotlight,.lb-about-section,.lb-banner-carousel,.lb-brand-marquee,.lb-contact-form,.lb-cta-section,.lb-experience-timeline,.lb-marquee,.lb-portfolio-grid,.lb-rich-content,.lb-services-grid,.lb-skills-section,.lb-testimonials,.lb-trust-badges,.lb-app-block-slot{margin-inline:auto;max-width:min(72rem,calc(100vw - 2rem));padding-block:clamp(1.5rem,4vw,4rem);}',
  '.lb-header,.lb-footer,.lb-announcement-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-block:1rem;}',
  '.lb-header nav,.lb-footer nav,.lb-header__actions{display:flex;flex-wrap:wrap;gap:0.75rem;}',
  '.lb-header__brand,.lb-hero-banner h1,.lb-featured-products h2,.lb-product-grid h2,.lb-category-grid h2,.lb-product-detail h1{font-family:var(--font-display);letter-spacing:0;}',
  '.lb-hero-banner{display:grid;gap:1rem;min-height:28rem;align-content:center;}',
  '.lb-hero-banner h1{max-width:14ch;font-size:clamp(2.5rem,7vw,5rem);line-height:0.95;}',
  '.lb-hero-banner a,.lb-featured-products > a,.lb-newsletter-signup button,.lb-contact-form button,.lb-cta-section a{display:inline-flex;width:fit-content;border-radius:0.5rem;background:var(--primary);color:#fff;font-weight:700;padding:0.75rem 1rem;}',
  '.lb-category-grid__items,.lb-featured-products__items,.lb-product-grid__items,.lb-first-party-spotlight__blocks,.lb-spotlight__blocks,.lb-banner-carousel__slides{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));}',
  '.lb-product-grid__items[data-columns="4"]{grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));}',
  '.lb-category-card,.lb-product-card,.lb-trust-badges article,.lb-testimonials blockquote,.lb-services-grid article,.lb-portfolio-grid article{border:1px solid var(--border-color,rgb(226 232 240));border-radius:0.5rem;background:var(--surface,rgb(255 255 255));padding:1rem;}',
  '.lb-product-detail{display:grid;gap:1rem;}',
  '.lb-product-detail__gallery{display:grid;gap:0.75rem;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));}',
  '.lb-product-detail__gallery img,.lb-banner-carousel img{aspect-ratio:1;border-radius:0.5rem;object-fit:cover;width:100%;}',
  '.lb-newsletter-signup form,.lb-contact-form form{display:flex;flex-wrap:wrap;gap:0.75rem;}',
  '.lb-newsletter-signup input,.lb-contact-form input{min-width:min(100%,16rem);border:1px solid var(--border-color,rgb(226 232 240));border-radius:0.5rem;padding:0.75rem 1rem;}',
  '.lb-badge{display:inline-flex;align-items:center;gap:0.375rem;border-radius:999px;background:var(--surface,rgb(241 245 249));padding:0.25rem 0.625rem;font-size:0.8125rem;font-weight:600;}',
].join('');

// Per-store theme tokens (settings_data.current) -> the CSS custom properties the lb-* stylesheet reads.
const LIQUID_THEME_TOKEN_MAP: ReadonlyArray<readonly [string, string, string]> = [
  ['primaryColor', '--primary', '#111827'],
  ['secondaryColor', '--secondary', '#374151'],
  ['accentColor', '--accent', '#2563eb'],
  ['surfaceColor', '--surface', '#f8fafc'],
  ['backgroundColor', '--background', '#ffffff'],
  ['textColor', '--foreground', '#1a1a2e'],
  ['bodyFontFamily', '--font-body', 'Inter, system-ui, sans-serif'],
  ['headingFontFamily', '--font-display', 'Inter, system-ui, sans-serif'],
];

function sanitizeCssTokenValue(value: string): string {
  // Defense-in-depth: token values are theme-controlled, but never let one break out of the declaration.
  return value.replace(/[<>{};@()]/g, '').trim().slice(0, 120);
}

function buildLiquidRootTokenBlock(bundle: LiquidThemePackageBundle): string {
  const current = (bundle.config?.settings_data?.current ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const decls: string[] = [];
  for (const [key, cssVar, fallback] of LIQUID_THEME_TOKEN_MAP) {
    const raw = current[key];
    const value = typeof raw === 'string' && raw.trim().length > 0 ? raw : fallback;
    decls.push(`${cssVar}:${sanitizeCssTokenValue(value)};`);
    seen.add(cssVar);
  }
  if (!seen.has('--border-color')) decls.push('--border-color:rgba(0,0,0,0.1);');
  return `:root{${decls.join('')}}`;
}

// Theme-controlled <head> assets injected into content_for_header (then sanitized by the layout-level
// WHOLE_DOCUMENT DOMPurify pass): the per-store :root tokens + the lb-* base stylesheet, as one <style>.
export function buildLiquidThemeHeadAssets(bundle: LiquidThemePackageBundle): string {
  return `<style data-theme-renderer="liquid">${buildLiquidRootTokenBlock(bundle)}${LIQUID_THEME_BASE_CSS}</style>`;
}

// C4 — Render-time section-type alias map. Resolves bundle section entries whose persisted type differs
// from the canonical first-party Liquid section file name. Extend here when Phase D adds contentPage.
// Only newsletter is wired now — see CERTIFIED_PLATFORM_FACTS C4.
// Note: PORTABLE_TO_LIQUID_TYPE_OVERRIDES in portable-to-liquid.ts handles the compiler path at build
// time; this map covers the render-time path for bundles persisted outside the compiler (manual DB writes)
// whose section.type is 'newsletter' rather than 'newsletter-signup'. Keep both maps in sync for newsletter.
export const LIQUID_SECTION_TYPE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
    // React/schema type -> Liquid bundle section type
    'newsletter': 'newsletter-signup',
    // Reverse: Liquid bundle type -> same (idempotent lookup, makes the map clearly extensible)
    'newsletter-signup': 'newsletter-signup',
    // D9: contentPage -> rich-content (both camelCase and kebab forms)
    'contentPage': 'rich-content',
    'content-page': 'rich-content',
});

export class JsonContractThemeRenderer implements ThemeRenderer {
  readonly engine = 'json-contract' as const;
  readonly interfaceVersion = THEME_RENDERER_INTERFACE_VERSION;

  async render(input: ThemeRendererInput): Promise<ThemeRendererResult> {
    const composition = input.orchestrator
      ? hydrateAndComposeStorefrontTheme(
        input.orchestrator,
        input,
        input.injections || [],
      )
      : composeStorefrontTheme(input);

    return {
      engine: this.engine,
      status: 'rendered',
      composition,
      warnings: [],
    };
  }
}

// Render every section of one Liquid template to sanitized HTML. Shared by the page body and by the
// header/footer chrome templates (L4) so chrome and body go through the identical sanitized pipeline.
// C1: returns sectionErrors count so the caller can determine 'rendered' vs 'error' status.
async function renderLiquidTemplateSections(
    template: LiquidThemePackageBundle['templates'][string],
    engine: Liquid,
    input: ThemeRendererInput,
    bundle: LiquidThemePackageBundle,
    warnings: string[],
): Promise<{ sections: LiquidRenderedSection[]; html: string; sectionErrors: number }> {
    const renderedSections: LiquidRenderedSection[] = [];
    const sectionOrder = orderedKeys(template.sections, template.order);
    let sectionErrors = 0;

    for (const sectionId of sectionOrder) {
        const templateSection = template.sections[sectionId];
        if (!templateSection || templateSection.disabled) continue;

        // C4: resolve the section type via the alias map before looking up the bundle file.
        // This handles bundles persisted outside the compiler whose section.type is 'newsletter'
        // (React/schema name) rather than 'newsletter-signup' (Liquid bundle file name).
        const resolvedType = LIQUID_SECTION_TYPE_ALIASES[templateSection.type] ?? templateSection.type;
        const sectionFile = bundle.sections[resolvedType];
        if (!sectionFile) {
            warnings.push(`Liquid section "${templateSection.type}" was not found and was skipped.`);
            continue;
        }

        // C1: per-section try/catch — a single bad section must not crash the full page render.
        // On error we push an HTML comment placeholder and continue; the caller decides whether to
        // return 'rendered' (partial) or 'error' (all sections failed).
        try {
            const renderedBlocks = await renderLiquidSectionBlocks({
                engine,
                bundle,
                input,
                sectionId,
                sectionType: resolvedType,
                section: templateSection,
            });
            const sectionHtml = await engine.parseAndRender(
                stripLiquidSchemaBlocks(sectionFile.source),
                buildLiquidScope(input, bundle, {
                    section: {
                        id: sectionId,
                        type: resolvedType,
                        settings: templateSection.settings,
                        blocks: renderedBlocks.map((block) => ({
                            id: block.id,
                            type: block.type,
                            settings: block.settings,
                            content: block.html,
                            html: block.html,
                            is_app_block: block.isAppBlock,
                        })),
                        block_order: renderedBlocks.map((block) => block.id),
                        schema: sectionFile.schema,
                    },
                }),
                liquidRenderOptions,
            );

            renderedSections.push({
                id: sectionId,
                type: resolvedType,
                settings: templateSection.settings,
                html: await sanitizeRenderedHtml(String(sectionHtml)),
                blocks: renderedBlocks,
            });
        } catch (sectionErr: unknown) {
            sectionErrors++;
            const message = sectionErr instanceof Error ? sectionErr.message : String(sectionErr);
            warnings.push(`Liquid section "${sectionId}" (type "${templateSection.type}") failed to render and was skipped: ${message.slice(0, 200)}`);
            // Push an HTML comment placeholder so the caller can identify the gap without leaking source.
            renderedSections.push({
                id: sectionId,
                type: resolvedType,
                settings: templateSection.settings,
                // Placeholder is safe static HTML — no merchant data, no Liquid source.
                html: `<!-- lb:section-error sectionId="${sectionId.replace(/"/g, '')}" type="${resolvedType.replace(/"/g, '')}" -->`,
                blocks: [],
            });
        }
    }

    return { sections: renderedSections, html: renderedSections.map((section) => section.html).join('\n'), sectionErrors };
}

export class LiquidRenderer implements ThemeRenderer {
  readonly engine = 'liquid' as const;
  readonly interfaceVersion = THEME_RENDERER_INTERFACE_VERSION;

  async render(input: ThemeRendererInput): Promise<ThemeRendererResult> {
    if (!input.liquidBundle) {
      return {
        engine: this.engine,
        status: 'unsupported',
        composition: composeStorefrontTheme(input),
        warnings: ['Liquid rendering requires a validated portable Liquid theme bundle.'],
      };
    }

    const warnings: string[] = [];
    const bundle = parseLiquidThemePackageBundle(input.liquidBundle);
    const templateKey = resolveLiquidTemplateKey(input, bundle);
    const template = bundle.templates[templateKey];

    if (!template) {
      return {
        engine: this.engine,
        status: 'unsupported',
        composition: composeStorefrontTheme(input),
        warnings: [`Liquid template "${templateKey}" was not found in theme bundle "${bundle.package.slug}".`],
      };
    }

    const themeHeadAssets = buildLiquidThemeHeadAssets(bundle);
    const embedHeader = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.header, { allowHeadMetadata: true });
    const contentForHeader = `${themeHeadAssets}${embedHeader}`;
    const contentForFooter = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.footer);
    const engine = createLiquidEngine(bundle, {
      contentForHeader,
      contentForFooter,
      locale: input.context.locale || 'en',
    });

    // C1: wrap each region's renderLiquidTemplateSections in its own try/catch.
    // A failure in one region (e.g. main body) is not fatal — we degrade to empty string for that region
    // so the page can still be assembled with whatever partial content is available.
    let main: { sections: LiquidRenderedSection[]; html: string; sectionErrors: number };
    try {
      main = await renderLiquidTemplateSections(template, engine, input, bundle, warnings);
    } catch (mainErr: unknown) {
      const msg = mainErr instanceof Error ? mainErr.message : String(mainErr);
      warnings.push(`Liquid main template failed to render: ${msg.slice(0, 200)}`);
      main = { sections: [], html: '', sectionErrors: 1 };
    }
    const renderedSections = main.sections;
    const contentForLayout = main.html;
    // If every section attempted for the main template resulted in an error, the page is unrenderable.
    const totalMainSections = Object.values(template.sections).filter((s) => s && !s.disabled).length;
    const allMainSectionsFailed = totalMainSections > 0 && main.sectionErrors >= totalMainSections;

    // L4 — Liquid chrome: render the header/footer templates (if present) so a Liquid page can wear
    // Liquid header/footer instead of React. Each section is sanitized inside the helper.
    // C1: chrome failures are non-fatal — degrade to empty string so the page body still renders.
    let headerHtml = '';
    if (bundle.templates.header) {
      try {
        headerHtml = (await renderLiquidTemplateSections(bundle.templates.header, engine, input, bundle, warnings)).html;
      } catch (headerErr: unknown) {
        const msg = headerErr instanceof Error ? headerErr.message : String(headerErr);
        warnings.push(`Liquid header template failed to render and was skipped: ${msg.slice(0, 200)}`);
      }
    }

    let footerHtml = '';
    if (bundle.templates.footer) {
      try {
        footerHtml = (await renderLiquidTemplateSections(bundle.templates.footer, engine, input, bundle, warnings)).html;
      } catch (footerErr: unknown) {
        const msg = footerErr instanceof Error ? footerErr.message : String(footerErr);
        warnings.push(`Liquid footer template failed to render and was skipped: ${msg.slice(0, 200)}`);
      }
    }

    // C1: wrap the layout parseAndRender — if the layout template itself is broken the page is unrenderable.
    let layoutHtml: string;
    try {
      const rawLayoutHtml = await engine.parseAndRender(
        bundle.layout.theme.source,
        buildLiquidScope(input, bundle, {
          content_for_layout: contentForLayout,
          content_for_header: contentForHeader,
          content_for_footer: contentForFooter,
        }),
        liquidRenderOptions,
      );
      layoutHtml = await sanitizeRenderedHtml(String(rawLayoutHtml), { wholeDocument: true });
    } catch (layoutErr: unknown) {
      const msg = layoutErr instanceof Error ? layoutErr.message : String(layoutErr);
      warnings.push(`Liquid layout template failed to render: ${msg.slice(0, 200)}`);
      return {
        engine: this.engine,
        status: 'error',
        composition: composeStorefrontTheme(input),
        warnings,
        liquid: undefined,
      };
    }

    // C1: if every section in the main template failed, there is nothing useful to show — signal 'error'
    // so composition-engine falls back to React rather than emitting an empty page body.
    if (allMainSectionsFailed) {
      warnings.push('All Liquid sections failed to render; falling back to React.');
      return {
        engine: this.engine,
        status: 'error',
        composition: composeStorefrontTheme(input),
        warnings,
        liquid: undefined,
      };
    }

    const liquid: LiquidRenderedTheme = {
      templateKey,
      layoutHtml,
      contentForLayout,
      sections: renderedSections,
      header: headerHtml,
      footer: footerHtml,
    };
    const composition = composeLiquidStorefrontTheme(input, bundle, templateKey);

    return {
      engine: this.engine,
      status: 'rendered',
      composition,
      warnings,
      liquid,
    };
  }
}

export const defaultThemeRenderer = new JsonContractThemeRenderer();
export const liquidThemeRenderer = new LiquidRenderer();

export function createThemeRenderer(engine: ThemeRendererEngine = 'json-contract'): ThemeRenderer {
  return engine === 'liquid' ? new LiquidRenderer() : new JsonContractThemeRenderer();
}

export function getDefaultThemeRenderer(): ThemeRenderer {
  return defaultThemeRenderer;
}

const liquidRenderOptions = {
  templateLimit: 20_000,
  renderLimit: 250,
  memoryLimit: 2_000_000,
} as const;

function createLiquidEngine(
  bundle: LiquidThemePackageBundle,
  globals: { contentForHeader?: string; contentForFooter?: string; locale?: string } = {},
): Liquid {
  const contentForHeader = globals.contentForHeader || '';
  const contentForFooter = globals.contentForFooter || '';
  const locale = globals.locale || 'en';
  const engine = new Liquid({
    cache: false,
    dynamicPartials: false,
    strictFilters: true,
    strictVariables: false,
    ownPropertyOnly: true,
    outputEscape: 'escape',
    jsTruthy: false,
    parseLimit: 300_000,
    renderLimit: liquidRenderOptions.renderLimit,
    memoryLimit: liquidRenderOptions.memoryLimit,
    templates: Object.fromEntries([
      [bundle.layout.theme.path, bundle.layout.theme.source],
      ...Object.values(bundle.sections).map((section) => [section.path, stripLiquidSchemaBlocks(section.source)]),
      ...Object.values(bundle.blocks).map((block) => [block.path, block.source]),
    ]),
    globals: {
      content_for_header: contentForHeader,
      content_for_footer: contentForFooter,
    },
  });

  registerLetbuyyLiquidFilters(engine, bundle, locale);
  return engine;
}

function resolveLiquidTemplateKey(input: ThemeRendererInput, bundle: LiquidThemePackageBundle): string {
  if (input.liquidTemplateKey && bundle.templates[input.liquidTemplateKey]) return input.liquidTemplateKey;
  if (input.routeTemplate?.id && bundle.templates[input.routeTemplate.id]) return input.routeTemplate.id;
  if (bundle.templates.index) return 'index';

  return Object.keys(bundle.templates)[0] || 'index';
}

function orderedKeys<T>(records: Record<string, T>, order: string[]): string[] {
  const ordered = order.filter((key) => Object.prototype.hasOwnProperty.call(records, key));
  const remaining = Object.keys(records).filter((key) => !ordered.includes(key));
  return [...ordered, ...remaining];
}

export function stripLiquidSchemaBlocks(source: string): string {
  return source.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/gi, '').trim();
}

async function renderLiquidSectionBlocks(input: {
  engine: Liquid;
  bundle: LiquidThemePackageBundle;
  input: ThemeRendererInput;
  sectionId: string;
  sectionType: string;
  section: ThemeBundleTemplateSection;
}): Promise<LiquidRenderedBlock[]> {
  const blocks: LiquidRenderedBlock[] = [];
  const blockIds = orderedKeys(input.section.blocks, input.section.block_order);

  for (const blockId of blockIds) {
    const block = input.section.blocks[blockId];
    if (!block || block.disabled) continue;

    if (isLiquidAppBlockType(block.type)) {
      blocks.push({
        id: blockId,
        type: block.type,
        settings: block.settings,
        html: await resolveLiquidAppBlockHtml(input.input, input.sectionId, blockId, block),
        isAppBlock: true,
      });
      continue;
    }

    const blockFile = input.bundle.blocks[block.type];
    if (!blockFile) {
      const sectionFile = input.bundle.sections[input.sectionType];
      const inlineBlockAllowed = sectionFile?.schema.blocks.some((candidate) => candidate.type === block.type) === true;
      if (inlineBlockAllowed) {
        blocks.push({
          id: blockId,
          type: block.type,
          settings: block.settings,
          html: '',
          isAppBlock: false,
        });
      }
      continue;
    }

    // C1: block-level try/catch — a broken block source must not crash the enclosing section render.
    // On error the block is included with empty html so the section template can still render its structure.
    let blockHtml = '';
    try {
      const rawBlockHtml = await input.engine.parseAndRender(
        blockFile.source,
        buildLiquidScope(input.input, input.bundle, {
          section: {
            id: input.sectionId,
            type: input.sectionType,
            settings: input.section.settings,
          },
          block: {
            id: blockId,
            type: block.type,
            settings: block.settings,
            schema: blockFile.schema,
          },
        }),
        liquidRenderOptions,
      );
      blockHtml = await sanitizeRenderedHtml(String(rawBlockHtml));
    } catch (blockErr: unknown) {
      const msg = blockErr instanceof Error ? blockErr.message : String(blockErr);
      // Push warning into the input.input context is not available here; we swallow and leave html=''.
      // The section template will render without this block's HTML (it may still use block.settings).
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify({ event: 'lb:liquid:block-error', blockId, blockType: block.type, error: msg.slice(0, 200) }));
    }

    blocks.push({
      id: blockId,
      type: block.type,
      settings: block.settings,
      html: blockHtml,
      isAppBlock: false,
    });
  }

  return blocks;
}

function buildLiquidScope(
  input: ThemeRendererInput,
  bundle: LiquidThemePackageBundle,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const commerceDrops = buildLiquidCommerceDrops(input.liquidContext);

  return {
    shop: {
      id: input.context.storeId,
      name: input.storeTemplate.storeId || input.context.storeId,
      subdomain: input.context.subdomain,
      ...(asRecord(input.liquidContext?.shop)),
    },
    request: {
      path: input.context.path,
      locale: input.context.locale || 'en',
      preview: input.context.previewMode,
      request_id: input.context.requestId,
      ...(asRecord(input.liquidContext?.request)),
    },
    // D2: settings drop resolves both flat and grouped key paths.
    // bundle.config.settings_schema has shape { schema_version, settings: { [groupKey]: { fields: { [fieldKey]: ... } } } }.
    // Templates use flat keys ({{ settings.primaryColor }}) which continue to work.
    // We also build grouped sub-objects ({{ settings.colors.primaryColor }}) for forward parity.
    // Flat keys win the outer spread so grouped sub-objects never shadow a flat value.
    // Only fields that exist in the flat current object are included in grouped objects (no fabricated defaults).
    settings: (() => {
      const flat = filterBlockedSettingsKeys(asRecord(bundle.config.settings_data.current));
      const groups = bundle.config.settings_schema.settings;
      const grouped: Record<string, unknown> = {};
      if (groups && typeof groups === 'object') {
        for (const [groupKey, group] of Object.entries(groups)) {
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(groupKey) || BLOCKED_DROP_KEYS.has(groupKey)) continue;
          const fields = group.fields ?? {};
          const groupObj: Record<string, unknown> = {};
          for (const fieldKey of Object.keys(fields)) {
            if (fieldKey in flat) groupObj[fieldKey] = flat[fieldKey];
          }
          grouped[groupKey] = groupObj;
        }
      }
      return { ...grouped, ...flat, ...filterBlockedSettingsKeys(asRecord(input.liquidContext?.settings)) };
    })(),
    routes: {
      root_url: '/',
      cart_url: '/cart',
      search_url: '/search',
      // E6: Shopify-convention account routes backed by existing storefront-runtime pages/routes.
      // account_url: /store/[subdomain]/account/page.tsx
      // account_login_url: /store/[subdomain]/customers/login/page.tsx (created in E8/LANE-B)
      // account_register_url: /store/[subdomain]/customers/register (existing)
      // account_logout_url: POST /api/customer/logout — NOTE: POST endpoint only; use inside a form,
      //   not a plain anchor href, to avoid CSRF and accidental GET logout.
      // all_products_collection_url: /store/[subdomain]/products/page.tsx (existing)
      account_url: '/account',
      account_login_url: '/customers/login',
      account_register_url: '/customers/register',
      account_logout_url: '/api/customer/logout',
      all_products_collection_url: '/products',
    },
    product: commerceDrops.product,
    collection: commerceDrops.collection,
    collections: commerceDrops.collections,
    cart: commerceDrops.cart,
    customer: commerceDrops.customer,
    search: commerceDrops.search,
    order: commerceDrops.order,
    // D1-A: linklists drop (Shopify convention). Populated by LANE-B (composition-engine.tsx).
    // toLiquidDrop safely sanitizes the nested nav structure; falls back to empty object.
    linklists: toLiquidDrop(input.liquidContext?.linklists) ?? {},
    // E1: blog listing drop. Populated by LANE-B when route.type === 'blog'.
    blog: toLiquidDrop(input.liquidContext?.blog) ?? null,
    // E2: article drop. Populated by LANE-B when route.type === 'article'.
    article: toLiquidDrop(input.liquidContext?.article) ?? null,
    // E3: page drop. Populated by LANE-B when route.type === 'page'.
    page: toLiquidDrop(input.liquidContext?.page) ?? null,
    ...extra,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const MAX_LIQUID_DROP_DEPTH = 4;
const MAX_LIQUID_DROP_KEYS = 80;
const MAX_LIQUID_DROP_ARRAY_ITEMS = 100;
// UC-15: also block credential-adjacent keys that should never reach Liquid template scope.
export const BLOCKED_DROP_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'password', 'password_hash', 'access_token', 'refresh_token', 'signing_secret', 'client_secret', 'api_key', 'secret_key', 'private_key', 'webhook_secret']);

// Merchant settings bypass toLiquidDrop (the settings object must stay a plain spreadable record),
// so the same key discipline applies here: identifier-shaped keys only, credential-named keys never.
function filterBlockedSettingsKeys(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || BLOCKED_DROP_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

function buildLiquidCommerceDrops(context?: LiquidCommerceDrops): {
  product: unknown;
  collection: unknown;
  collections: unknown[];
  cart: Record<string, unknown>;
  customer: unknown;
  search: unknown;
  order: unknown;
} {
  const collections = Array.isArray(context?.collections)
    ? toLiquidDrop(context.collections)
    : [];

  return {
    product: toLiquidDrop(context?.product) || null,
    collection: toLiquidDrop(context?.collection) || null,
    collections: Array.isArray(collections) ? collections : [],
    cart: asDropRecord(context?.cart) || {
      item_count: 0,
      items: [],
      total_price: 0,
      currency: 'INR',
    },
    customer: toLiquidDrop(context?.customer) || null,
    search: toLiquidDrop(context?.search) || null,
    order: toLiquidDrop(context?.order) || null,
  };
}

function asDropRecord(value: unknown): Record<string, unknown> | null {
  const drop = toLiquidDrop(value);
  return drop && typeof drop === 'object' && !Array.isArray(drop)
    ? drop as Record<string, unknown>
    : null;
}

function toLiquidDrop(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_LIQUID_DROP_DEPTH) return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_LIQUID_DROP_ARRAY_ITEMS)
      .map((item) => toLiquidDrop(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value !== 'object') return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_LIQUID_DROP_KEYS)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || BLOCKED_DROP_KEYS.has(key)) continue;
    const next = toLiquidDrop(raw, depth + 1);
    if (next !== undefined) output[key] = next;
  }

  return output;
}

async function renderLiquidEmbedRegion(
  embeds?: Array<string | LiquidAppBlockRenderSource>,
  sanitizerOptions: RenderedHtmlSanitizerOptions = {},
): Promise<string> {
  if (!embeds || embeds.length === 0) return '';

  const sanitizedEmbeds = await Promise.all(embeds
    .map((embed) => typeof embed === 'string' ? embed : embed.html)
    .filter((html): html is string => typeof html === 'string' && html.trim().length > 0)
    .map((html) => sanitizeRenderedHtml(html, sanitizerOptions)));

  return sanitizedEmbeds.join('\n');
}

function registerLetbuyyLiquidFilters(engine: Liquid, bundle: LiquidThemePackageBundle, locale: string): void {
  engine.registerFilter('money', (value: unknown) => formatLiquidMoney(value));
  engine.registerFilter('money_with_currency', (value: unknown, currency?: unknown) => formatLiquidMoney(value, currency));
  engine.registerFilter('json', (value: unknown) => JSON.stringify(toLiquidDrop(value) ?? null).replace(/</g, '\\u003c'));
  engine.registerFilter('asset_url', (value: unknown) => safeLiquidUrl(value));
  engine.registerFilter('image_url', (value: unknown) => safeLiquidUrl(value));
  engine.registerFilter('t', (value: unknown, replacements?: unknown) => translateLiquidKey(bundle, locale, value, replacements));
}

function translateLiquidKey(
  bundle: LiquidThemePackageBundle,
  locale: string,
  value: unknown,
  replacements?: unknown,
): string {
  const key = String(value || '').trim();
  if (!key) return '';

  const dictionary = resolveLiquidLocaleDictionary(bundle, locale);
  const translated = lookupTranslation(dictionary, key);
  const template = typeof translated === 'string' ? translated : key;
  const replacementRecord = asRecord(replacements);

  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, name: string) => {
    const replacement = replacementRecord[name];
    return replacement === undefined || replacement === null ? match : String(replacement);
  });
}

function resolveLiquidLocaleDictionary(
  bundle: LiquidThemePackageBundle,
  locale: string,
): Record<string, unknown> {
  const candidates = [
    locale,
    locale.split('-')[0],
    'en',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exact = bundle.locales[candidate];
    if (exact && typeof exact === 'object') return exact as Record<string, unknown>;

    const matchingKey = Object.keys(bundle.locales).find((key) => key.toLowerCase() === candidate.toLowerCase());
    if (matchingKey) return bundle.locales[matchingKey] as Record<string, unknown>;
  }

  return {};
}

function lookupTranslation(dictionary: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, dictionary);
}

function formatLiquidMoney(value: unknown, currency: unknown = 'INR'): string {
  const numeric = Number(value);
  const amount = Number.isFinite(numeric) ? numeric / 100 : 0;
  const currencyCode = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'INR';
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currencyCode} ${formatted}`;
}

function safeLiquidUrl(value: unknown): string {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(?:https?:)?\/\//i.test(url)) return url;
  if (url.startsWith('/')) return url;
  if (/^[a-z0-9/_.,-]+$/i.test(url)) return `/assets/${url.replace(/^\/+/, '')}`;
  return '';
}

async function resolveLiquidAppBlockHtml(
  input: ThemeRendererInput,
  sectionId: string,
  blockId: string,
  block: ThemeBundleTemplateBlock,
): Promise<string> {
  const candidates = [
    `${sectionId}.${blockId}`,
    blockId,
    block.type,
    typeof block.settings.extension_handle === 'string' ? block.settings.extension_handle : '',
    typeof block.settings.slot === 'string' ? block.settings.slot : '',
  ].filter(Boolean);

  for (const key of candidates) {
    const configured = input.liquidAppBlocks?.[key];
    if (typeof configured === 'string') return sanitizeRenderedHtml(configured);
    if (configured && typeof configured.html === 'string') return sanitizeRenderedHtml(configured.html);
  }

  return `<div data-letbuyy-app-block="${escapeHtmlAttribute(blockId)}" data-app-block-type="${escapeHtmlAttribute(block.type)}"></div>`;
}

function composeLiquidStorefrontTheme(
  input: ThemeRendererInput,
  bundle: LiquidThemePackageBundle,
  templateKey: string,
): StorefrontCompositionResult {
  const template = bundle.templates[templateKey];
  const sections = orderedKeys(template.sections, template.order)
    .map((sectionId, order): SectionModel | null => {
      const section = template.sections[sectionId];
      if (!section || section.disabled) return null;

      return {
        id: sectionId,
        type: section.type,
        order,
        rendererKey: `liquid.section.${section.type}`,
        schemaVersion: bundle.schema_version,
        settings: section.settings,
        blocks: orderedKeys(section.blocks, section.block_order)
          .map((blockId, blockOrder): BlockModel | null => {
            const block = section.blocks[blockId];
            if (!block || block.disabled) return null;

            return {
              id: blockId,
              type: block.type,
              order: blockOrder,
              rendererKey: isLiquidAppBlockType(block.type) ? 'liquid.app-block' : `liquid.block.${block.type}`,
              schemaVersion: bundle.schema_version,
              settings: block.settings,
              isVisible: true,
            };
          })
          .filter((block): block is BlockModel => block !== null),
        isVisible: true,
      };
    })
    .filter((section): section is SectionModel => section !== null);
  const routeTemplate: StorefrontTemplateConfig = {
    id: templateKey,
    type: templateKey,
    layoutKey: template.layout || 'theme',
    sections,
  };
  const storeTemplate: StoreTemplateConfig = {
    ...input.storeTemplate,
    themeId: bundle.package.slug,
    engineVersion: bundle.renderer.renderer_version,
    themeSettings: {
      ...input.storeTemplate.themeSettings,
      ...asRecord(bundle.config.settings_data.current),
    },
    sections,
    templates: {
      ...(input.storeTemplate.templates || {}),
      [templateKey]: routeTemplate,
    },
    releaseManifest: {
      ...(input.storeTemplate.releaseManifest || {}),
      renderer: bundle.renderer,
      bundle: {
        schema_version: bundle.schema_version,
        package: bundle.package,
      },
    },
  };

  if (input.orchestrator) {
    return hydrateAndComposeStorefrontTheme(
      input.orchestrator,
      { ...input, storeTemplate, routeTemplate },
      input.injections || [],
    );
  }

  return composeStorefrontTheme({ ...input, storeTemplate, routeTemplate });
}

export interface RenderedHtmlSanitizerOptions {
  allowHeadMetadata?: boolean;
  wholeDocument?: boolean;
}

interface ThemeDomPurifyRuntime {
  purify: DOMPurify;
  createDocument(html: string): { head: { innerHTML: string } };
}

let domPurifyPromise: Promise<ThemeDomPurifyRuntime> | undefined;

async function getThemeDomPurify(): Promise<ThemeDomPurifyRuntime> {
  domPurifyPromise ||= (async () => {
    const [{ default: createDOMPurify }, { JSDOM }] = await Promise.all([
      import('dompurify'),
      // jsdom is server-only (this runs during SSR sanitization). webpackIgnore keeps it
      // a runtime require so bundlers never pull jsdom's node:* deps into a client build.
      import(/* webpackIgnore: true */ 'jsdom'),
    ]);
    const { window } = new JSDOM('<!doctype html><html><body></body></html>');
    const purify = createDOMPurify(window as unknown as WindowLike);
    purify.addHook('uponSanitizeAttribute', (_node, data) => {
      const attrName = data.attrName.toLowerCase();
      const attrValue = data.attrValue.trim();
      const normalizedValue = attrValue.toLowerCase();
      const isUrlAttribute = attrName === 'href' || attrName === 'src' || attrName.endsWith('url');

      if (attrName.startsWith('data-') && (attrValue.includes('<') || attrValue.includes('>'))) {
        data.keepAttr = false;
      }

      if (isUrlAttribute && (normalizedValue.startsWith('javascript:') || normalizedValue.startsWith('data:text/html'))) {
        data.keepAttr = false;
      }
    });
    return {
      purify,
      createDocument: (html: string) => new JSDOM(html).window.document,
    };
  })();

  return domPurifyPromise;
}

export async function sanitizeRenderedHtml(
  html: string,
  options: RenderedHtmlSanitizerOptions = {},
): Promise<string> {
  const { purify, createDocument } = await getThemeDomPurify();

  if (options.allowHeadMetadata) {
    const sanitizedDocument = purify.sanitize(
      `<!doctype html><html><head>${html}</head><body></body></html>`,
      LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG,
    );
    return createDocument(sanitizedDocument).head.innerHTML.trim();
  }

  return purify.sanitize(
    html,
    options.wholeDocument
      ? LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG
      : LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG,
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
