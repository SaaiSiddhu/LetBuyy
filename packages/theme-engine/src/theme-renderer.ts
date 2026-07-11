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
  UnsupportedLiquidBundleSchemaVersionError,
  type LiquidThemePackageBundle,
  type ThemeBundleTemplateBlock,
  type ThemeBundleTemplateSection,
} from './theme-bundle';
// Phase W — Dynamic Source Binding: descriptor resolution at render time.
import {
  resolveDynamicSourceDescriptors,
  type SiteDrops,
} from './dynamic-source-binding';
// Phase Y — App-Block Model: settings filtering + crash-isolation placeholder classes.
import {
  filterAppBlockSettings,
  APP_BLOCK_ERROR_PLACEHOLDER_CLASS,
} from './app-block-model';
// Phase AA — SAFE-CSS LAW: single enforcement point for merchant custom CSS.
import { validateAndScopeCustomCss } from './custom-css-sanitizer';
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
  /**
   * Phase W — site-scoped resource drops for dynamic-source binding resolution.
   * Populated by the storefront composition layer with tenant-scoped product/collection/etc
   * drops fetched for this render. Passed into resolveDynamicSourceDescriptors() before
   * section settings reach the Liquid scope so descriptors are transparent to LiquidJS.
   * Optional: absent when no bindings are in use (no-op path is backward-compatible).
   */
  siteDrops?: SiteDrops;
}

export interface LiquidRenderedBlock {
  id: string;
  type: string;
  html: string;
  settings: Record<string, unknown>;
  isAppBlock: boolean;
  /**
   * Phase T — rendered nested child blocks (depth-bounded).
   * Populated when a block's bundle definition carries nested block.blocks entries
   * and the current render depth is below RENDERER_MAX_BLOCK_DEPTH.
   * Accessible in Liquid block templates as {{ block.sub_blocks }}.
   */
  sub_blocks?: LiquidRenderedBlock[];
}

export interface LiquidRenderedSection {
  id: string;
  type: string;
  html: string;
  settings: Record<string, unknown>;
  blocks: LiquidRenderedBlock[];
  // true when this section failed to render and html contains an error-comment placeholder.
  // Callers iterating result.liquid.sections can gate on !section.isError to skip placeholders.
  // contentForLayout always includes all sections (including placeholders) for page assembly.
  isError?: boolean;
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
  // F7-Lane-A: lb-logout island — progressive enhancement wrapper around a no-JS <form method="post">.
  // Must be in ADD_TAGS and tagNameCheck so DOMPurify does not strip the element.
  // LANE-B (liquid-hydration-islands.tsx) registers LbLogoutElement via defineLiquidIsland.
  'lb-logout',
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
    // F7-Lane-A: lb-logout island attribute
    'data-logout-url',
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
    // F7-Lane-A: lb-logout added. Keep in sync with LIQUID_HYDRATION_CUSTOM_ELEMENTS above.
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager|logout)$/,
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
//
// Phase AA — SAFE-CSS LAW single enforcement point:
//   • Accepts the RAW merchant custom CSS from the caller (DB value / gateway input).
//   • Validates and scopes the CSS internally via validateAndScopeCustomCss().
//     Fail-closed: invalid CSS is silently dropped (no injection) and only the base style is returned.
//   • Callers MUST pass the raw stored value; do NOT pre-scope before calling this function
//     (pre-scoping would produce a double-wrapped selector).
//   • Absent / empty rawCustomCss → output is byte-identical to the no-custom-CSS baseline.
//   • LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG is NOT modified (DOMPurify already allows <style>).
export function buildLiquidThemeHeadAssets(
  bundle: LiquidThemePackageBundle,
  rawCustomCss?: string,
): string {
  const baseStyle = `<style data-theme-renderer="liquid">${buildLiquidRootTokenBlock(bundle)}${LIQUID_THEME_BASE_CSS}</style>`;
  if (!rawCustomCss || rawCustomCss.trim() === '') {
    return baseStyle;
  }
  // Validate and scope the raw CSS — this is the SINGLE ENFORCEMENT POINT.
  // Fail-closed: if validation fails for any reason, drop the custom CSS and return only the base.
  // The caller never needs to call validateAndScopeCustomCss separately before this function.
  const result = validateAndScopeCustomCss(rawCustomCss);
  if (!result.ok || !result.safeCss) {
    // Drop invalid CSS. The storefront is protected; the caller should surface violations
    // via the dedicated validate endpoint (validateCustomCss) if user feedback is needed.
    return baseStyle;
  }
  // DOMPurify allows <style> tags (USE_PROFILES.html:true). The CSS text is already validated
  // and scope-wrapped by validateAndScopeCustomCss(); no further sanitisation is needed.
  return baseStyle + `<style data-lb-custom-css="1">${result.safeCss}</style>`;
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
//
// F2 — Parallel Section Rendering: sections are rendered concurrently via Promise.allSettled.
// Re-entrancy is CONFIRMED SAFE for LiquidJS 10.27.0 (verified from node_modules source):
//   (1) Liquid.parse() constructs a new Parser(this) on every call — no shared mutable parser state.
//   (2) Liquid._render() constructs a new Context on every call — all per-render mutable state
//       (scopes, registers, limiters) is fresh per invocation and never shared between concurrent calls.
//   (3) The shared Render instance is stateless; its methods are pure functions over their arguments.
//   (4) Tags/filters are only mutated during construction/registration, never during rendering.
//   (5) LRU cache (F1) is written only during parse(), not during render() — concurrent parse calls
//       for different source strings are independent. ASSUMPTION: LiquidJS >=10.27.0; verify on upgrade.
// DOMPurify.sanitize is re-entrant (documented). Output ORDER is preserved via sectionOrder index mapping.
// Block rendering stays sequential within each section (renderLiquidSectionBlocks) — no change in Phase F.
async function renderLiquidTemplateSections(
    template: LiquidThemePackageBundle['templates'][string],
    engine: Liquid,
    input: ThemeRendererInput,
    bundle: LiquidThemePackageBundle,
    warnings: string[],
): Promise<{ sections: LiquidRenderedSection[]; html: string; sectionErrors: number }> {
    const sectionOrder = orderedKeys(template.sections, template.order);

    // Build a task per enabled section. Skipped sections (missing file / disabled) are filtered
    // out of the task list; their slot is filled with null so index alignment is preserved.
    type SectionTask =
        | { kind: 'skip' }
        | { kind: 'render'; sectionId: string; resolvedType: string; templateSection: ThemeBundleTemplateSection };

    const tasks: SectionTask[] = sectionOrder.map((sectionId) => {
        const templateSection = template.sections[sectionId];
        if (!templateSection || templateSection.disabled) return { kind: 'skip' };

        // C4: resolve the section type via the alias map before looking up the bundle file.
        // This handles bundles persisted outside the compiler whose section.type is 'newsletter'
        // (React/schema name) rather than 'newsletter-signup' (Liquid bundle file name).
        const resolvedType = LIQUID_SECTION_TYPE_ALIASES[templateSection.type] ?? templateSection.type;
        const sectionFile = bundle.sections[resolvedType];
        if (!sectionFile) {
            warnings.push(`Liquid section "${templateSection.type}" was not found and was skipped.`);
            return { kind: 'skip' };
        }

        return { kind: 'render', sectionId, resolvedType, templateSection };
    });

    // Execute all render tasks concurrently. Promise.allSettled never rejects — each task carries
    // its own C1 try/catch so one bad section still produces an error-comment placeholder while
    // others render normally.
    const settled = await Promise.allSettled(
        tasks.map(async (task): Promise<LiquidRenderedSection | null> => {
            if (task.kind === 'skip') return null;
            const { sectionId, resolvedType, templateSection } = task;
            const sectionFile = bundle.sections[resolvedType]!;

            // C1: per-section try/catch — a single bad section must not crash the full page render.
            // On error we push an HTML comment placeholder and continue.
            try {
                // Phase W: resolve any dynamic-source binding descriptors in section settings
                // BEFORE the scope is built. Plain literal values are unchanged (no-op when no
                // descriptors are present). siteDrops is already tenant-scoped by the caller.
                const siteDrops: SiteDrops = (input.liquidContext?.siteDrops as SiteDrops | undefined) ?? {};
                const resolvedSectionSettings = resolveDynamicSourceDescriptors(
                    templateSection.settings,
                    siteDrops,
                );

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
                            settings: resolvedSectionSettings,
                            blocks: renderedBlocks.map((block) => ({
                                id: block.id,
                                type: block.type,
                                settings: block.settings,
                                content: block.html,
                                html: block.html,
                                is_app_block: block.isAppBlock,
                                // Phase T: expose rendered child blocks in the section-level block drop
                                sub_blocks: (block.sub_blocks ?? []).map((child) => ({
                                    id: child.id,
                                    type: child.type,
                                    settings: child.settings,
                                    content: child.html,
                                    html: child.html,
                                    is_app_block: child.isAppBlock,
                                })),
                            })),
                            block_order: renderedBlocks.map((block) => block.id),
                            schema: sectionFile.schema,
                        },
                    }),
                    liquidRenderOptions,
                );

                return {
                    id: sectionId,
                    type: resolvedType,
                    settings: templateSection.settings,
                    html: await sanitizeRenderedHtml(String(sectionHtml)),
                    blocks: renderedBlocks,
                };
            } catch (sectionErr: unknown) {
                const message = sectionErr instanceof Error ? sectionErr.message : String(sectionErr);
                // Placeholder is safe static HTML — no merchant data, no Liquid source.
                return {
                    id: sectionId,
                    type: resolvedType,
                    settings: templateSection.settings,
                    // HTML-comment safe: escapeHtmlAttribute handles ", ', <, >, & and we additionally
                    // strip '--' sequences so a crafted sectionId/type cannot break out of the comment.
                    html: `<!-- lb:section-error sectionId="${escapeHtmlCommentValue(sectionId)}" type="${escapeHtmlCommentValue(resolvedType)}" -->`,
                    blocks: [],
                    _error: message, // ephemeral: extracted below for warnings, not part of LiquidRenderedSection
                } as LiquidRenderedSection & { _error?: string };
            }
        }),
    );

    // Collect results in original order; accumulate warnings and error count.
    const renderedSections: LiquidRenderedSection[] = [];
    let sectionErrors = 0;

    for (let i = 0; i < settled.length; i++) {
        const result = settled[i]!;
        const task = tasks[i]!;

        // Promise.allSettled only rejects if the executor function itself throws synchronously,
        // which cannot happen here since each task's body is fully wrapped in try/catch. The
        // rejection branch is a defensive guard.
        if (result.status === 'rejected') {
            sectionErrors++;
            const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
            if (task.kind === 'render') {
                warnings.push(`Liquid section "${task.sectionId}" (type "${task.resolvedType}") failed to render and was skipped: ${msg.slice(0, 200)}`);
            }
            continue;
        }

        const section = result.value;
        if (section === null) continue; // 'skip' task

        // Check if this section carried an error marker from the inner try/catch.
        const sectionWithError = section as LiquidRenderedSection & { _error?: string };
        if (sectionWithError._error !== undefined) {
            sectionErrors++;
            if (task.kind === 'render') {
                warnings.push(`Liquid section "${section.id}" (type "${section.type}") failed to render and was skipped: ${sectionWithError._error.slice(0, 200)}`);
            }
            // Clean ephemeral _error field and mark isError=true so callers can distinguish
            // placeholder-html entries from successfully-rendered sections. contentForLayout
            // still joins all entries (including placeholders) for page assembly — this only
            // lets downstream consumers filter result.liquid.sections reliably.
            const { _error, ...cleanSection } = sectionWithError;
            void _error;
            renderedSections.push({ ...cleanSection, isError: true } as LiquidRenderedSection);
        } else {
            renderedSections.push(section);
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
    // G4: an unsupported (e.g. future) bundle schema_version must NOT crash the render — it degrades to
    // 'unsupported' so the caller falls back to React, same as a missing/invalid bundle.
    let bundle: LiquidThemePackageBundle;
    try {
      bundle = parseLiquidThemePackageBundle(input.liquidBundle);
    } catch (parseErr: unknown) {
      if (parseErr instanceof UnsupportedLiquidBundleSchemaVersionError) {
        return {
          engine: this.engine,
          status: 'unsupported',
          composition: composeStorefrontTheme(input),
          warnings: [parseErr.message],
        };
      }
      throw parseErr;
    }
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
  // F1 — Template Parse Cache: cache:true enables LiquidJS v10.27.0 built-in LRU keyed on template
  // source strings. Content-addressed by construction → different tenants with different source text
  // get different LRU entries; there is no cross-tenant risk. The LRU is engine-instance-local
  // (createLiquidEngine is called fresh per render inside LiquidRenderer.render), so cache state
  // is per-request, not global across requests. The default LRU limit is 1000 entries (cacheSize
  // option); since the engine is discarded after each render, intra-request LRU growth is bounded
  // by the number of distinct template sources in the bundle (small). Cross-request LRU growth
  // cannot occur with this per-render lifecycle.
  // LIFECYCLE ASSUMPTION: if the engine is ever cached across requests (e.g., to amortize
  // construction cost), verify that cacheSize is set to a per-tenant bound and that the
  // cross-tenant isolation argument is re-evaluated before merging that change.
  // Assumption: LiquidJS >=10.27.0 (version-pinned in packages/theme-engine/package.json).
  // If LiquidJS is upgraded, re-verify LRU keying semantics.
  const engine = new Liquid({
    cache: true,
    dynamicPartials: false,
    strictFilters: true,
    strictVariables: false,
    ownPropertyOnly: true,
    outputEscape: 'escape',
    jsTruthy: false,
    parseLimit: 300_000,
    renderLimit: liquidRenderOptions.renderLimit,
    memoryLimit: liquidRenderOptions.memoryLimit,
    // Defensive copy: the LRU is keyed on the string value passed at construction time.
    // String() forces a primitive copy of each source value so that a caller who holds a
    // reference to the same bundle object and later mutates section.source cannot silently
    // invalidate (or be served stale entries from) the engine's LRU.
    // NOTE: if the engine lifecycle changes from per-render to cross-request, re-evaluate
    // tenant isolation — the LRU is currently per-engine-instance (created fresh each render).
    templates: Object.fromEntries([
      [bundle.layout.theme.path, String(bundle.layout.theme.source)],
      ...Object.values(bundle.sections).map((section) => [section.path, String(stripLiquidSchemaBlocks(section.source))]),
      ...Object.values(bundle.blocks).map((block) => [block.path, String(block.source)]),
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

/**
 * Render all blocks for a section (or, recursively, for a nested parent block).
 *
 * Phase T: the optional `depth` parameter (default 1) drives the nested-block recursion.
 * When depth < RENDERER_MAX_BLOCK_DEPTH and a block carries its own block.blocks children,
 * those children are rendered first (at depth+1) then threaded into the parent block's Liquid
 * drop as sub_blocks.  At depth == RENDERER_MAX_BLOCK_DEPTH the recursion stops silently —
 * no error, no stack growth — matching the parse-time cap in theme-document.ts and theme-bundle.ts.
 */
async function renderLiquidSectionBlocks(
  input: {
    engine: Liquid;
    bundle: LiquidThemePackageBundle;
    input: ThemeRendererInput;
    sectionId: string;
    sectionType: string;
    section: ThemeBundleTemplateSection;
  },
  depth = 1,
): Promise<LiquidRenderedBlock[]> {
  const blocks: LiquidRenderedBlock[] = [];
  const blockIds = orderedKeys(input.section.blocks, input.section.block_order);

  for (const blockId of blockIds) {
    const block = input.section.blocks[blockId];
    if (!block || block.disabled) continue;

    if (isLiquidAppBlockType(block.type)) {
      // Phase Y — App-block crash isolation (RISK: one bad app block must not crash the
      // section/page). Mirrors the per-block try/catch for regular blocks below (Phase C/F).
      // On error: push a safe placeholder div and continue with the next block.
      //
      // Phase Y — Settings filtering: apply filterAppBlockSettings so that BLOCKED_APP_BLOCK_SETTING_KEYS
      // (credential-adjacent keys: api_key, webhook_secret, access_token, etc.) are stripped
      // BEFORE the settings reach the section-level Liquid drop (section.blocks[i].settings).
      // This closes the gap identified in the design audit (theme-renderer.ts lines 415–421).
      let appBlockHtml: string;
      let appBlockSettings: Record<string, unknown>;
      try {
        appBlockHtml = await resolveLiquidAppBlockHtml(input.input, input.sectionId, blockId, block);
        appBlockSettings = filterAppBlockSettings(block.settings);
      } catch (appBlockErr: unknown) {
        const msg = appBlockErr instanceof Error ? appBlockErr.message : String(appBlockErr);
        // Safe static placeholder — block.type and blockId are bundle-schema-validated strings.
        // escapeHtmlAttribute prevents attribute breakout; APP_BLOCK_ERROR_PLACEHOLDER_CLASS is
        // a literal constant. No sanitizeRenderedHtml needed (no untrusted HTML content here).
        appBlockHtml = `<div class="${APP_BLOCK_ERROR_PLACEHOLDER_CLASS}" data-letbuyy-app-block="${escapeHtmlAttribute(blockId)}" data-app-block-type="${escapeHtmlAttribute(block.type)}" aria-hidden="true"></div>`;
        appBlockSettings = filterAppBlockSettings(block.settings);
        void msg; // swallow; no access to input.input.warnings here (same pattern as regular block error)
      }
      blocks.push({
        id: blockId,
        type: block.type,
        settings: appBlockSettings,
        html: appBlockHtml,
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
    // Phase T: render child blocks first (before the parent) so sub_blocks is available in the
    // parent block's Liquid scope.  Depth guard: stop at RENDERER_MAX_BLOCK_DEPTH silently.
    let subBlockResults: LiquidRenderedBlock[] = [];
    try {
      if (depth < RENDERER_MAX_BLOCK_DEPTH && Object.keys(block.blocks ?? {}).length > 0) {
        // Treat the block's nested children as a pseudo-section for the recursive call.
        // Per-child crash isolation is provided by the inner try/catch in the recursive invocation.
        subBlockResults = await renderLiquidSectionBlocks(
          {
            engine: input.engine,
            bundle: input.bundle,
            input: input.input,
            sectionId: blockId,       // parent block id acts as pseudo-section id
            sectionType: block.type,  // parent block type acts as pseudo-section type
            section: {
              type: block.type,
              settings: block.settings,
              blocks: block.blocks ?? {},
              block_order: block.block_order ?? [],
              disabled: false,
            },
          },
          depth + 1,
        );
      }

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
            // Phase T: thread rendered child blocks into the parent block's Liquid drop
            sub_blocks: subBlockResults.map((child) => ({
              id: child.id,
              type: child.type,
              settings: child.settings,
              content: child.html,
              html: child.html,
              is_app_block: child.isAppBlock,
            })),
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
      sub_blocks: subBlockResults.length > 0 ? subBlockResults : undefined,
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
/**
 * Phase T — maximum recursion depth for nested block children.
 * Must stay in sync with MAX_BLOCK_NESTING_DEPTH in theme-document.ts and
 * MAX_BUNDLE_BLOCK_NESTING_DEPTH in theme-bundle.ts (all three = 3).
 */
const RENDERER_MAX_BLOCK_DEPTH = 3;
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

// DOMPurify singleton — one instance shared across all concurrent requests in this worker.
// Re-entrancy safety: DOMPurify.sanitize() is synchronous and Node.js is single-threaded;
// async/await does not interleave synchronous DOM manipulation, so concurrent callers that
// each await sanitizeRenderedHtml() are serialized at the micro-task level with no shared
// mutable state between their sanitize() calls. The uponSanitizeAttribute hook registered
// below is on the shared instance but is itself a pure function over its arguments (no hook
// state is written between calls). Verified against DOMPurify 3.x (JSDOM-backed server usage).
// ASSUMPTION: DOMPurify.sanitize remains synchronous. If a future DOMPurify version introduces
// async hooks, this assumption breaks — create one DOMPurify instance per call at that point.
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

// HTML-comment-safe escape: applies escapeHtmlAttribute AND strips '--' sequences so a
// crafted value cannot close the comment prematurely (e.g. type='foo-->bar').
// Used only for values injected into HTML comments (<!-- ... -->).
function escapeHtmlCommentValue(value: string): string {
  // First apply full attribute escaping (handles <, >, ", ', &).
  const escaped = escapeHtmlAttribute(value);
  // Then strip any '--' that survive (e.g. from a value like '&gt;--&lt;' after escaping,
  // or a literal '--' in the raw input). Replaces with a single '-' to preserve readability.
  return escaped.replace(/--/g, '-');
}
