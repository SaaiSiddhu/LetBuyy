/// <reference path="./jsdom-runtime.d.ts" />
import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';
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
// SUSTAINED-G3 — the single canonical translation resolver (India-first fallback chain,
// prototype-pollution-guarded). Do not reintroduce a second, duplicate lookup here.
import { tLocale } from './theme-locale';
import { fontFamilyWithFallback } from './experience-fonts';
import type {
  BlockModel,
  SectionModel,
  StoreTemplateConfig,
  StorefrontTemplateConfig,
} from './index';

// S7/W2 — env-gated span profiling used for the cold-path investigation
// (docs/evidence/liquid-load/S7-cold-path-profile.md). Off by default (LB_S7_PROFILE unset):
// zero behavioural or performance change on the hot path — the flag check is the only cost paid
// when disabled. Deliberately kept (not stripped after use): the investigation closed with one
// confirmed, fixed cause and one NOT_ROOT_CAUSED residual finding (see that document) — these spans
// are exactly what a future re-investigation of either would need, and reproducing them from
// scratch cost real effort this phase. Remove only if a future phase judges it dead weight.
const S7_PROFILE_ENABLED = process.env.LB_S7_PROFILE === '1';
let s7ProfileSanitizeCallCount = 0;

function s7ProfileMark(label: string, startedAtMs: number, extra: Record<string, unknown> = {}): void {
  if (!S7_PROFILE_ENABLED) return;
  console.log(JSON.stringify({
    event: 'lb:s7:profile',
    label,
    ms: Number((Date.now() - startedAtMs).toFixed(2)),
    processUptimeMs: Math.round(process.uptime() * 1000),
    ...extra,
  }));
}

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
  /** Validated public product drops keyed by the rendered section id. */
  section_products?: Record<string, unknown[]>;
  collection?: unknown;
  collections?: unknown;
  cart?: unknown;
  customer?: unknown;
  /** Canonical LetBuyy buyer identity, separate from the store-customer principal. */
  buyer?: unknown;
  /** Store-scoped wishlist state resolved through the buyer's verified store relationship. */
  buyer_wishlist?: unknown;
  buyer_unavailable?: boolean;
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
  /** Safe attribute fragment for an inline block root, empty outside editor preview. */
  editorAttributes?: string;
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
  // T2a-fix/W2/CAP-C19 — the per-store :root token block + LIQUID_THEME_BASE_CSS, as plain CSS TEXT
  // (no wrapping <style> tag), already sanitized via sanitizeRenderedHtml's allowHeadMetadata path
  // (the exact same DOMPurify document-config pass layoutHtml's wholeDocument sanitization uses).
  // Composition-engine consumes this to render a real <style> element in the React tree — Next.js
  // hoists it into <head> — instead of the previous fragment concatenation that discarded it.
  headStyleText?: string;
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
  // T1/W2: lb-turnstile island — invisible Cloudflare Turnstile challenge for the no-JS-first
  // customer register/login <form>s; writes its token into a sibling hidden input on solve.
  'lb-turnstile',
  // T2a/W3a: lb-mobile-nav island — hamburger drawer wrapping the header's nav-links panel.
  'lb-mobile-nav',
  // T5/W3: lb-predictive-search island — the header search overlay's debounced predictive results.
  'lb-predictive-search',
  // T6/W3: lb-product-gallery island — the PDP image carousel + thumbnails.
  'lb-product-gallery',
] as const;

export const LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [
    ...LIQUID_HYDRATION_CUSTOM_ELEMENTS,
    'iframe',
    'meta',
    // T5/W1 — USE_PROFILES.html does NOT include SVG (confirmed empirically: an <svg><path>
    // survived nothing before this). This adds only the 7 inert, non-interactive shape primitives
    // needed for a small hand-authored icon set (search/account/cart/hamburger/close/chevron) —
    // deliberately excludes <use> (external xlink:href reference), <foreignObject> and <a>/<script>
    // inside SVG, so this cannot become an XSS or resource-injection vector. Verified against an
    // adversarial `<svg onload=...><use href=...><foreignObject><script>` probe: all four stripped.
    'svg',
    'path',
    'circle',
    'line',
    'polyline',
    'rect',
    'g',
  ],
  ADD_ATTR: [
    'aria-live',
    'aria-pressed',
    // T5/W1 — attributes for the SVG icon primitives above; not reachable on any other allowed tag
    // in a way that changes behavior (no href/src/on* here).
    'viewBox',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'd',
    'points',
    'cx',
    'cy',
    'r',
    'x1',
    'y1',
    'x2',
    'y2',
    'rx',
    'ry',
    'focusable',
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
    // T5/W3: lb-predictive-search added.
    // T6/W3: lb-product-gallery added.
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|review-form|wishlist-toggle|cart|customer-settings|address-manager|logout|turnstile|mobile-nav|predictive-search|product-gallery)$/,
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
// T2a — Design Foundation. Premium-minimal, Shopify-Dawn class: generous whitespace, a fluid type
// scale, restrained colour, large product imagery. Mobile-first from ~360px (UI-R rules): every rule
// below is written for the small screen first, then widened at the 48em/64em breakpoints — there is
// no separate "mobile" stylesheet to keep in sync. Organized top-to-bottom: tokens, reset/base,
// accessibility (focus/motion), container, header (+ hamburger drawer), announcement bar (full-bleed),
// footer, hero, about, category/featured/product grids, product card, misc content sections.
export const LIQUID_THEME_BASE_CSS = [
  // ---- Design tokens --------------------------------------------------------------------------
  // Per-store colour/font tokens (--primary/--accent/--surface/--foreground/--background/
  // --font-display/--border-color) are injected separately by buildLiquidRootTokenBlock — these are
  // the theme-wide constants every store shares regardless of preset: spacing scale, fluid type
  // scale (clamp() so headings/body scale smoothly between the ~360px floor and desktop, no separate
  // breakpoint-jump rules needed for typography), radii, layout, motion.
  ':root{--lb-space-3xs:0.25rem;--lb-space-2xs:0.5rem;--lb-space-xs:0.75rem;--lb-space-sm:1rem;--lb-space-md:1.5rem;--lb-space-lg:2rem;--lb-space-xl:3rem;--lb-space-2xl:4rem;--lb-space-3xl:6rem;--lb-text-xs:clamp(0.75rem,0.72rem + 0.15vw,0.8125rem);--lb-text-sm:clamp(0.875rem,0.84rem + 0.15vw,0.9375rem);--lb-text-base:clamp(1rem,0.97rem + 0.15vw,1.0625rem);--lb-text-lg:clamp(1.125rem,1.06rem + 0.3vw,1.25rem);--lb-text-xl:clamp(1.25rem,1.15rem + 0.5vw,1.5rem);--lb-text-2xl:clamp(1.5rem,1.3rem + 1vw,2rem);--lb-text-3xl:clamp(1.875rem,1.55rem + 1.5vw,2.5rem);--lb-text-4xl:clamp(2.25rem,1.7rem + 2.5vw,3.5rem);--lb-text-5xl:clamp(2.75rem,1.9rem + 4vw,5rem);--lb-radius-sm:0.375rem;--lb-radius-md:0.625rem;--lb-radius-lg:1rem;--lb-radius-pill:999px;--lb-container-max:80rem;--lb-container-gutter:1.25rem;--lb-header-h:4.25rem;--lb-transition:200ms cubic-bezier(.4,0,.2,1);--lb-focus-ring:2px solid var(--accent,#2563eb);}',
  // ---- Reset / base ----------------------------------------------------------------------------
  '.lb-theme{min-height:100vh;background:var(--background);color:var(--foreground);font-family:var(--font-body);font-size:var(--lb-text-base);line-height:1.6;-webkit-font-smoothing:antialiased;}',
  '.lb-theme *{box-sizing:border-box;}',
  '.lb-theme :where(a){color:inherit;text-decoration:none;}',
  '.lb-theme :where(button,input,select,textarea){font:inherit;color:inherit;}',
  '.lb-theme :where(img,svg,video){display:block;max-width:100%;}',
  '.lb-theme h1,.lb-theme h2,.lb-theme h3{font-family:var(--font-display);letter-spacing:-0.01em;line-height:1.1;margin:0;}',
  '.lb-theme h2{font-size:var(--lb-text-2xl);}',
  '.lb-theme h3{font-size:var(--lb-text-lg);}',
  // ---- Accessibility: focus-visible + reduced-motion (WCAG 2.4.7 / 2.3.3) ------------------------
  '.lb-theme :where(a,button,input,select,textarea,summary,details,[tabindex]):focus-visible{outline:var(--lb-focus-ring);outline-offset:2px;border-radius:var(--lb-radius-sm);}',
  '@media (prefers-reduced-motion:reduce){.lb-theme *{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;scroll-behavior:auto!important;}}',
  // ---- Container --------------------------------------------------------------------------------
  '.lb-header__inner,.lb-footer,.lb-announcement-bar__inner,.lb-hero-banner,.lb-category-grid,.lb-featured-products,.lb-product-grid,.lb-product-detail,.lb-newsletter-signup,.lb-first-party-spotlight,.lb-spotlight,.lb-about-section,.lb-banner-carousel,.lb-brand-marquee,.lb-contact-form,.lb-cta-section,.lb-experience-timeline,.lb-marquee,.lb-portfolio-grid,.lb-rich-content,.lb-services-grid,.lb-skills-section,.lb-testimonials,.lb-trust-badges,.lb-app-block-slot{margin-inline:auto;max-width:var(--lb-container-max);padding-inline:var(--lb-container-gutter);}',
  '.lb-hero-banner,.lb-category-grid,.lb-featured-products,.lb-product-grid,.lb-product-detail,.lb-newsletter-signup,.lb-first-party-spotlight,.lb-spotlight,.lb-about-section,.lb-banner-carousel,.lb-brand-marquee,.lb-contact-form,.lb-cta-section,.lb-experience-timeline,.lb-marquee,.lb-portfolio-grid,.lb-rich-content,.lb-services-grid,.lb-skills-section,.lb-testimonials,.lb-trust-badges,.lb-app-block-slot{padding-block:clamp(var(--lb-space-lg),5vw,var(--lb-space-2xl));}',
  // ---- Header (+ mobile hamburger drawer) ------------------------------------------------------
  // Mobile-first: single row, brand + hamburger + cart. The nav panel (desktop: inline row; mobile:
  // off-canvas drawer) lives inside <lb-mobile-nav> — same markup both widths, CSS repositions it,
  // so there is exactly one nav-links list to keep in sync (no server/client duplication).
  // T5/W1 — display:block stated explicitly (not just relied on as <header>'s UA default) so a
  // portable/exported theme stays correct even if the host page later adds its own conflicting rule.
  '.lb-header{display:block;position:relative;z-index:40;background:var(--background);border-bottom:1px solid var(--border-color,rgba(0,0,0,.08));}',
  '.lb-header[data-sticky="true"]{position:sticky;top:0;}',
  '.lb-header__inner{display:flex;align-items:center;justify-content:space-between;gap:var(--lb-space-sm);min-height:var(--lb-header-h);}',
  '.lb-header__brand{font-family:var(--font-display);font-weight:700;font-size:var(--lb-text-lg);letter-spacing:-0.01em;}',
  '.lb-header__actions{display:flex;align-items:center;gap:var(--lb-space-xs);}',
  '.lb-header__cart{display:inline-flex;align-items:center;gap:0.375rem;min-height:44px;padding-inline:0.25rem;font-weight:600;font-size:var(--lb-text-sm);}',
  '.lb-mobile-nav{display:contents;}',
  // T5/W1-W3 — functional parity for the rebuilt header/drawer/search-overlay markup: enough to be
  // usable and accessible on an exported theme with no app sheet, not a full visual match of
  // liquid-theme.css (see docs/theme-deploy-chain.md sibling report note on this being a bounded,
  // disclosed scope decision rather than a silent gap).
  '.lb-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
  '.lb-header__toggle{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;background:none;cursor:pointer;order:-1;}',
  // T5/W1 — broad default (see liquid-theme.css's identical fix for why): an <svg> with only a
  // viewBox and no explicit width/height renders at the browser intrinsic default, confirmed live
  // to blow up to near-full-viewport width for any icon a more specific selector missed.
  '.lb-header svg{width:20px;height:20px;flex-shrink:0;}',
  '.lb-header__toggle svg,.lb-header__nav-close svg,.lb-header__search-toggle svg,.lb-header__account svg,.lb-header__cart svg{width:22px;height:22px;}',
  '.lb-icon-chevron{width:16px;height:16px;}',
  '.lb-header__nav{position:fixed;inset:0 0 0 auto;z-index:50;width:min(100%,25rem);display:flex;flex-direction:column;background:var(--background);box-shadow:-16px 0 40px rgba(15,23,42,.2);transform:translateX(100%);transition:transform var(--lb-transition);overflow-y:auto;}',
  '.lb-mobile-nav[data-open="true"] .lb-header__nav{transform:translateX(0);}',
  '.lb-header__nav-head{display:flex;align-items:center;justify-content:space-between;gap:var(--lb-space-sm);padding:var(--lb-space-sm);border-bottom:1px solid var(--border-color,rgba(0,0,0,.08));}',
  '.lb-header__nav-close{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;background:none;cursor:pointer;}',
  '.lb-header__nav-links{display:flex;flex-direction:column;padding:var(--lb-space-2xs) var(--lb-space-sm);}',
  '.lb-header__nav-links>a,.lb-header__nav-item summary{display:flex;align-items:center;justify-content:space-between;gap:var(--lb-space-2xs);min-height:44px;padding-block:var(--lb-space-2xs);font-size:var(--lb-text-lg);border-bottom:1px solid var(--border-color,rgba(0,0,0,.08));cursor:pointer;list-style:none;}',
  '.lb-header__nav-item[open] .lb-icon-chevron{transform:rotate(180deg);}',
  '.lb-header__nav-submenu{display:flex;flex-direction:column;padding:0 0 var(--lb-space-2xs) var(--lb-space-sm);}',
  '.lb-header__nav-submenu a{display:flex;align-items:center;min-height:44px;padding-block:var(--lb-space-3xs);font-size:var(--lb-text-sm);}',
  '.lb-header__nav-foot{margin-top:auto;padding:var(--lb-space-sm);border-top:1px solid var(--border-color,rgba(0,0,0,.08));}',
  '.lb-header__nav-foot a{display:flex;align-items:center;gap:var(--lb-space-3xs);min-height:44px;font-weight:600;}',
  '.lb-header__scrim{position:fixed;inset:0;z-index:45;background:rgba(10,12,20,.6);opacity:0;pointer-events:none;transition:opacity var(--lb-transition);}',
  '.lb-mobile-nav[data-open="true"] .lb-header__scrim{opacity:1;pointer-events:auto;}',
  '@media (min-width:48em){.lb-header__toggle{display:none;}.lb-header__nav{position:static;inset:auto;width:auto;flex-direction:row;align-items:center;background:none;box-shadow:none;transform:none;overflow:visible;order:0;}.lb-header__nav-head,.lb-header__nav-foot{display:none;}.lb-header__nav-links{flex-direction:row;align-items:center;gap:var(--lb-space-md);padding:0;}.lb-header__nav-links>a,.lb-header__nav-item summary{padding-block:0;min-height:auto;font-size:var(--lb-text-sm);font-weight:600;border-bottom:0;}.lb-header__nav-item{position:relative;}.lb-header__nav-submenu{position:absolute;top:100%;left:0;z-index:70;min-width:12rem;margin-top:var(--lb-space-2xs);padding:var(--lb-space-2xs);background:var(--background);border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:var(--lb-radius-md);box-shadow:0 12px 32px rgba(15,23,42,.16);}.lb-header__scrim{display:none;}}',
  // ---- header search overlay + predictive search (T5/W3) ------------------------------------
  '.lb-header__search-overlay{position:absolute;inset:100% 0 auto 0;z-index:65;background:var(--background);border-bottom:1px solid var(--border-color,rgba(0,0,0,.08));box-shadow:0 16px 40px rgba(15,23,42,.14);}',
  '.lb-header__search-overlay[hidden]{display:none;}',
  '.lb-predictive-search{display:block;padding:var(--lb-space-sm);}',
  '.lb-predictive-search [data-lb-search-form]{display:flex;align-items:center;gap:var(--lb-space-2xs);}',
  '.lb-predictive-search input[type="search"]{flex:1;min-height:44px;padding:0 var(--lb-space-xs);font-size:var(--lb-text-lg);border:1px solid var(--border-color,rgba(0,0,0,.15));border-radius:var(--lb-radius-md);}',
  '.lb-predictive-search button{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;background:none;cursor:pointer;}',
  '.lb-predictive-search__item{display:flex;align-items:center;gap:var(--lb-space-2xs);padding:var(--lb-space-3xs);min-height:44px;}',
  '.lb-predictive-search__item img{width:44px;height:44px;object-fit:cover;border-radius:var(--lb-radius-sm);}',
  '.lb-predictive-search__item-price{margin-left:auto;font-weight:700;}',
  // ---- Announcement bar (full-bleed, positioned above the header by template order — see
  // theme-bundle.ts's `header` template composition, which places announcement-default first) ----
  '.lb-announcement-bar{background:var(--foreground);color:var(--background);}',
  '.lb-announcement-bar__inner{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--lb-space-2xs);padding-block:var(--lb-space-2xs);font-size:var(--lb-text-sm);text-align:center;}',
  '.lb-announcement-bar__inner a{font-weight:700;text-decoration:underline;text-underline-offset:2px;}',
  // ---- Footer: multi-column, LetBuyy watermark -------------------------------------------------
  '.lb-footer{display:block;padding-block:var(--lb-space-xl) var(--lb-space-lg);border-top:1px solid var(--border-color,rgba(0,0,0,.08));}',
  '.lb-footer__grid{display:grid;gap:var(--lb-space-lg);grid-template-columns:1fr;}',
  '.lb-footer__brand h3{font-family:var(--font-display);font-size:var(--lb-text-xl);}',
  '.lb-footer__brand p{margin:var(--lb-space-2xs) 0 0;color:var(--foreground);opacity:.7;max-width:32ch;}',
  '.lb-footer__col h4{margin:0 0 var(--lb-space-2xs);font-size:var(--lb-text-sm);text-transform:uppercase;letter-spacing:.06em;opacity:.6;}',
  '.lb-footer__col nav{display:flex;flex-direction:column;}',
  // T5/W2 — every footer link gets a real >=44px tap target (WCAG 2.5.5) instead of relying on line
  // height; .lb-footer__col > a covers the unconditional "Contact us" link, which sits directly in
  // the column (not inside <nav> or <p>) and previously had no rule of its own here either.
  '.lb-footer__col nav a,.lb-footer__col p a,.lb-footer__col>a{display:inline-flex;align-items:center;min-height:44px;font-size:var(--lb-text-sm);opacity:.85;}',
  '.lb-footer__social{display:flex;gap:var(--lb-space-2xs);margin-top:var(--lb-space-2xs);}',
  '.lb-footer__social a{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:var(--lb-radius-pill);border:1px solid var(--border-color,rgba(0,0,0,.12));}',
  '.lb-footer__social a svg{width:18px;height:18px;}',
  '.lb-footer__bottom{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--lb-space-2xs) var(--lb-space-sm);margin-top:var(--lb-space-lg);padding-top:var(--lb-space-md);border-top:1px solid var(--border-color,rgba(0,0,0,.08));font-size:var(--lb-text-xs);opacity:.7;}',
  '.lb-footer__watermark{display:inline-flex;align-items:center;gap:0.375rem;min-height:44px;font-weight:600;}',
  // T5/W1/W2 — was a fixed 4-track `1.4fr repeat(3,1fr)`, assuming every store has a full quick-links
  // list and all four policy types; a store with only brand+contact left two tracks empty. auto-fit
  // sizes tracks to however many blocks actually rendered (2-4, driven by section.blocks/shop.policies)
  // and collapses the rest to 0 width, so the grid reads deliberate regardless of column count.
  '@media (min-width:48em){.lb-footer__grid{grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));}}',
  // ---- Hero banner ------------------------------------------------------------------------------
  '.lb-hero-banner{position:relative;display:grid;gap:var(--lb-space-sm);min-height:26rem;align-content:center;overflow:hidden;}',
  '.lb-hero-banner h1{max-width:16ch;font-size:var(--lb-text-5xl);line-height:0.98;}',
  '.lb-hero-banner p{max-width:48ch;font-size:var(--lb-text-lg);opacity:.85;}',
  '.lb-hero-banner a,.lb-featured-products > a,.lb-newsletter-signup button,.lb-contact-form button,.lb-cta-section a{display:inline-flex;align-items:center;min-height:44px;width:fit-content;border-radius:var(--lb-radius-md);background:var(--primary);color:#fff;font-weight:700;padding-inline:1.25rem;transition:transform var(--lb-transition),opacity var(--lb-transition);}',
  '.lb-hero-banner a:hover,.lb-featured-products > a:hover,.lb-cta-section a:hover{opacity:.88;}',
  // A1/B1/B2: the hero background image sits behind the text (z-index -1, absolutely filled); the
  // height/align modifier classes are driven by the section's own `height`/`textAlign` settings.
  '.lb-hero-banner__bg-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;}',
  '.lb-hero-banner--height-large{min-height:22rem;}',
  '.lb-hero-banner--height-medium{min-height:18rem;}',
  '.lb-hero-banner--height-small{min-height:14rem;}',
  '.lb-hero-banner--align-left{text-align:left;justify-items:start;}',
  '.lb-hero-banner--align-center{text-align:center;justify-items:center;}',
  '.lb-hero-banner--align-right{text-align:right;justify-items:end;}',
  '@media (min-width:48em){.lb-hero-banner{min-height:34rem;}.lb-hero-banner--height-large{min-height:28rem;}.lb-hero-banner--height-medium{min-height:24rem;}.lb-hero-banner--height-small{min-height:18rem;}}',
  // B3: about-section layout — side-by-side (left/right) vs centered, mirroring about-section.tsx.
  '.lb-about-section{display:grid;gap:var(--lb-space-lg);align-items:center;}',
  '.lb-about-section--layout-left,.lb-about-section--layout-right{grid-template-columns:1fr;}',
  '.lb-about-section--layout-right .lb-about-section__image{order:-1;}',
  '.lb-about-section--layout-center{grid-template-columns:1fr;text-align:center;}',
  '.lb-about-section--layout-center .lb-about-section__image{margin-inline:auto;}',
  '@media (min-width:48em){.lb-about-section--layout-left,.lb-about-section--layout-right{grid-template-columns:repeat(2,1fr);}}',
  // ---- Category / featured / product grids -------------------------------------------------------
  // Mobile: 2-up (matches Dawn-class density on a 360px floor); more columns from tablet up.
  '.lb-category-grid__items,.lb-featured-products__items,.lb-product-grid__items,.lb-first-party-spotlight__blocks,.lb-spotlight__blocks,.lb-banner-carousel__slides{display:grid;gap:var(--lb-space-sm);grid-template-columns:repeat(2,1fr);}',
  '@media (min-width:48em){.lb-category-grid__items,.lb-featured-products__items,.lb-first-party-spotlight__blocks,.lb-spotlight__blocks,.lb-banner-carousel__slides{grid-template-columns:repeat(3,1fr);}.lb-product-grid__items{grid-template-columns:repeat(3,1fr);}}',
  '@media (min-width:64em){.lb-product-grid__items[data-columns="4"]{grid-template-columns:repeat(4,1fr);}}',
  '.lb-category-card{position:relative;display:flex;flex-direction:column;gap:0.25rem;border-radius:var(--lb-radius-lg);background:var(--surface,rgb(255 255 255));padding:var(--lb-space-sm);border:1px solid var(--border-color,rgb(226 232 240));transition:transform var(--lb-transition),box-shadow var(--lb-transition);}',
  '.lb-category-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(15,23,42,.08);}',
  '.lb-trust-badges article,.lb-testimonials blockquote,.lb-services-grid article,.lb-portfolio-grid article{border:1px solid var(--border-color,rgb(226 232 240));border-radius:var(--lb-radius-lg);background:var(--surface,rgb(255 255 255));padding:var(--lb-space-sm);}',
  '.lb-featured-products__empty,.lb-product-grid__empty,.lb-category-grid__empty,.lb-testimonials__empty{padding-block:var(--lb-space-xl);text-align:center;color:var(--foreground);opacity:0.65;}',
  '.lb-featured-products__items + a{margin-top:var(--lb-space-md);}',
  // ---- Product card: image, badge, price, hover/focus, keyboard-safe nested-interactive layout --
  // The image link is the "whole card" click target; the add-to-cart/wishlist controls are separate
  // focusable buttons OUTSIDE that anchor (not nested inside it) so no control is unreachable/invalid
  // HTML (an interactive element inside an <a> is itself an accessibility bug this avoids entirely).
  '.lb-product-card{position:relative;display:flex;flex-direction:column;border-radius:var(--lb-radius-lg);background:var(--surface,rgb(255 255 255));border:1px solid var(--border-color,rgb(226 232 240));overflow:hidden;transition:transform var(--lb-transition),box-shadow var(--lb-transition);}',
  '.lb-product-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(15,23,42,.1);}',
  '.lb-product-card__media{position:relative;aspect-ratio:1;background:var(--border-color,rgb(226 232 240));overflow:hidden;}',
  // T6/W2 — functional parity for the two-image hover swap; see liquid-theme.css's identical rule
  // for why this is a plain opacity swap, not a resolution/srcset swap (no resize service exists).
  '.lb-product-card__image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 300ms ease,transform 400ms ease;}',
  '.lb-product-card__image--hover{opacity:0;}',
  '.lb-product-card:hover .lb-product-card__image--primary,.lb-product-card:focus-within .lb-product-card__image--primary{transform:scale(1.04);}',
  '.lb-product-card:hover .lb-product-card__image--hover,.lb-product-card:focus-within .lb-product-card__image--hover{opacity:1;}',
  '.lb-product-card__placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--foreground);opacity:.35;font-size:var(--lb-text-xs);text-align:center;padding:var(--lb-space-2xs);}',
  '.lb-product-card__badges{position:absolute;top:0.625rem;left:0.625rem;display:flex;flex-direction:column;gap:0.25rem;z-index:1;}',
  '.lb-product-card__badge{display:inline-flex;align-items:center;border-radius:var(--lb-radius-pill);padding:0.1875rem 0.625rem;font-size:var(--lb-text-xs);font-weight:700;background:var(--background);}',
  '.lb-product-card__badge--sale{background:#dc2626;color:#fff;}',
  '.lb-product-card__badge--sold-out{background:var(--foreground);color:var(--background);}',
  '.lb-product-card__badge--low-stock{background:var(--background);border:1px solid var(--border-color,rgb(226 232 240));}',
  '.lb-product-card__badge--new{background:var(--accent,#2563eb);color:#fff;}',
  '.lb-product-card__body{display:flex;flex-direction:column;gap:0.25rem;padding:var(--lb-space-xs);flex:1;}',
  '.lb-product-card__title{font-size:var(--lb-text-sm);font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}',
  '.lb-product-card__rating{display:flex;align-items:center;gap:0.3rem;font-size:var(--lb-text-xs);opacity:.7;}',
  '.lb-product-card__rating .lb-icon-star{width:14px;height:14px;color:var(--primary);}',
  '.lb-product-card__price{display:flex;align-items:baseline;gap:0.375rem;font-weight:700;}',
  '.lb-product-card__price s{font-weight:400;opacity:.55;}',
  '.lb-product-card__actions{display:flex;gap:0.5rem;padding:0 var(--lb-space-xs) var(--lb-space-xs);margin-top:auto;}',
  '.lb-product-card__cta{flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:var(--lb-radius-md);background:var(--primary);color:#fff;font-weight:600;font-size:var(--lb-text-sm);border:0;cursor:pointer;}',
  '.lb-product-card__cta:disabled{opacity:.5;cursor:not-allowed;}',
  '.lb-product-card__actions lb-wishlist-toggle{min-width:44px;min-height:44px;}',
  // ---- Product detail (T6/W3 — functional parity: breadcrumb, gallery+thumbs, purchase row,
  // accordions; the two-column split now targets .lb-product-detail__layout, the wrapper this
  // phase introduced, not the section root the old rule assumed) ------------------------------
  '.lb-product-detail{display:block;}',
  '.lb-product-detail__breadcrumb{display:flex;flex-wrap:wrap;gap:0.4rem;font-size:var(--lb-text-xs);opacity:.7;margin-bottom:var(--lb-space-sm);}',
  '.lb-product-detail__layout{display:flex;flex-direction:column;gap:var(--lb-space-lg);}',
  '@media (min-width:64em){.lb-product-detail__layout{flex-direction:row;align-items:flex-start;}.lb-product-detail__gallery{flex:1 1 55%;position:sticky;top:var(--lb-space-sm);}.lb-product-detail__info{flex:1 1 45%;}}',
  '.lb-product-detail__gallery-main{position:relative;aspect-ratio:1;border-radius:var(--lb-radius-lg);overflow:hidden;background:var(--border-color,rgb(226 232 240));}',
  '.lb-product-detail__gallery-image,.lb-banner-carousel img{width:100%;height:100%;aspect-ratio:1;border-radius:var(--lb-radius-md);object-fit:cover;}',
  '.lb-product-detail__gallery-thumbs{display:flex;gap:var(--lb-space-2xs);margin-top:var(--lb-space-2xs);overflow-x:auto;}',
  '.lb-product-detail__gallery-thumb{flex:0 0 auto;width:56px;height:56px;padding:0;border-radius:var(--lb-radius-sm);overflow:hidden;border:2px solid transparent;background:none;cursor:pointer;}',
  '.lb-product-detail__gallery-thumb img{width:100%;height:100%;object-fit:cover;}',
  '.lb-product-detail__gallery-thumb[aria-selected="true"]{border-color:var(--primary);}',
  '.lb-product-detail__price{display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap;margin:var(--lb-space-2xs) 0 var(--lb-space-sm);}',
  '.lb-product-detail__price-current{font-size:var(--lb-text-xl);font-weight:700;color:var(--primary);}',
  '.lb-product-detail__price-compare{font-weight:400;opacity:.55;}',
  '.lb-product-detail__price-save{font-size:var(--lb-text-xs);font-weight:700;color:#dc2626;}',
  '.lb-product-detail__purchase{display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin:var(--lb-space-sm) 0;}',
  '.lb-product-detail__purchase lb-add-to-cart{display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;margin-top:0;flex:1 1 100%;}',
  '.lb-product-detail__quantity{width:4.5rem;min-height:44px;border:1px solid var(--border-color,rgb(226 232 240));border-radius:var(--lb-radius-md);padding-inline:0.6rem;}',
  '.lb-product-detail__cta{flex:1 1 10rem;min-height:44px;width:auto;}',
  '.lb-product-detail__cta--secondary{background:none;border:2px solid var(--primary);color:var(--primary);}',
  '.lb-product-detail__variant-group{display:flex;flex-wrap:wrap;gap:var(--lb-space-2xs);align-items:center;}',
  '.lb-product-detail__variant-values{display:flex;flex-wrap:wrap;gap:var(--lb-space-2xs);}',
  '.lb-product-detail__variant-status{font-size:var(--lb-text-xs);color:#dc2626;min-height:1em;}',
  '.lb-product-detail__accordion{border-top:1px solid var(--border-color,rgb(226 232 240));padding-block:0.1rem;}',
  '.lb-product-detail__accordion summary{min-height:44px;display:flex;align-items:center;font-weight:700;cursor:pointer;}',
  '.lb-product-detail__accordion-body{padding-bottom:var(--lb-space-sm);opacity:.85;}',
  // T6/W3 — [data-lb-variant-option] had no portable styling at all before this phase (a
  // pre-existing gap, not introduced here); a minimal, real style closes it.
  '.lb-product-detail__variants{display:flex;flex-direction:column;gap:var(--lb-space-2xs);margin-block:var(--lb-space-sm);}',
  '.lb-variant-option__name{font-weight:700;margin-right:var(--lb-space-3xs);}',
  '[data-lb-variant-option]{cursor:pointer;border:1px solid var(--border-color,rgb(226 232 240));background:var(--surface,#fff);border-radius:var(--lb-radius-md);padding:0.5rem 0.9rem;font-weight:600;min-height:44px;}',
  '[data-lb-variant-option][aria-pressed="true"]{border-color:var(--primary);background:var(--primary);color:#fff;}',
  '[data-lb-add-to-cart]:disabled,[data-lb-buy-now]:disabled{opacity:.5;cursor:not-allowed;}',
  // ---- Misc content sections ------------------------------------------------------------------
  '.lb-newsletter-signup form,.lb-contact-form form{display:flex;flex-wrap:wrap;gap:var(--lb-space-2xs);}',
  '.lb-newsletter-signup input,.lb-contact-form input{min-width:min(100%,16rem);min-height:44px;border:1px solid var(--border-color,rgb(226 232 240));border-radius:var(--lb-radius-md);padding-inline:1rem;}',
  '.lb-badge{display:inline-flex;align-items:center;gap:0.375rem;border-radius:var(--lb-radius-pill);background:var(--surface,rgb(241 245 249));padding:0.25rem 0.625rem;font-size:var(--lb-text-xs);font-weight:600;}',
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

function serializeLiquidFontFamily(value: string, fallback: string): string {
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
  const cssWide = new Set(['inherit', 'initial', 'revert', 'revert-layer', 'unset']);
  function serialize(input: string): string | null {
    if (!input.trim() || input.length > 120 || /[\u0000-\u001f\u007f<>{};@()\\]/.test(input)) return null;
    const families: string[] = [];
    let quote = '', start = 0;
    for (let i = 0; i < input.length; i++) {
      const character = input[i]!;
      if (character === '"' || character === "'") { if (!quote) quote = character; else if (quote === character) quote = ''; }
      if (character === ',' && !quote) { families.push(input.slice(start, i).trim()); start = i + 1; }
    }
    if (quote) return null;
    families.push(input.slice(start).trim());
    const names = families.map(family => ((family.startsWith('"') && family.endsWith('"')) || (family.startsWith("'") && family.endsWith("'"))) ? family.slice(1, -1) : family);
    if (names.some(name => !name || !/^[a-zA-Z0-9][a-zA-Z0-9 ,_-]*$/.test(name) && name !== '-apple-system')) return null;
    if (names.length === 1 && cssWide.has(names[0]!.toLowerCase()) && !/^["']/.test(families[0]!)) return names[0]!.toLowerCase();
    if (names.some((name, i) => cssWide.has(name.toLowerCase()) && !/^["']/.test(families[i]!))) return null;
    if (names.length === 1 && !generic.has(names[0]!.toLowerCase())) return fontFamilyWithFallback(names[0]!);
    return names.map((name, i) => generic.has(name.toLowerCase()) && !/^["']/.test(families[i]!) ? name : JSON.stringify(name)).join(', ');
  }
  return serialize(value) || serialize(fallback) || fontFamilyWithFallback('Inter');
}

function buildLiquidRootTokenBlock(bundle: LiquidThemePackageBundle): string {
  const current = (bundle.config?.settings_data?.current ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const decls: string[] = [];
  for (const [key, cssVar, fallback] of LIQUID_THEME_TOKEN_MAP) {
    const raw = current[key];
    const value = typeof raw === 'string' && raw.trim().length > 0 ? raw : fallback;
    const token = cssVar === '--font-body' || cssVar === '--font-display'
      ? serializeLiquidFontFamily(value, fallback) : sanitizeCssTokenValue(value);
    decls.push(`${cssVar}:${token};`);
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
// T2a-fix/W2/CAP-C19 — CSS Cascade Layers name. The base token block + LIQUID_THEME_BASE_CSS are
// wrapped in this named layer (below) so that when a consuming app ALSO ships its own unlayered
// CSS for the same .lb-* component classes (e.g. customer-web's liquid-theme.css — 89
// overlapping selectors were measured between the two, an exhaustive selector-by-selector
// reconciliation was judged out of scope for this fix), the unlayered app CSS always wins
// regardless of specificity or DOM/precedence insertion order — per-spec, ANY unlayered rule
// beats ANY layered rule. When no such app CSS exists (a theme rendered by a different, portable
// consumer — the actual point of this stylesheet), this layer's rules apply completely normally;
// they only ever yield, never disappear.
const LIQUID_THEME_BASE_CSS_LAYER_NAME = 'lb-liquid-theme-base';

export function buildLiquidThemeHeadAssets(
  bundle: LiquidThemePackageBundle,
  rawCustomCss?: string,
): string {
  const baseStyle = `<style data-theme-renderer="liquid">@layer ${LIQUID_THEME_BASE_CSS_LAYER_NAME}{${buildLiquidRootTokenBlock(bundle)}${LIQUID_THEME_BASE_CSS}}</style>`;
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
// W2: `settings` on a composed section only carries the keys someone actually set. A key that
// is genuinely absent falls back to its {% schema %} field `default`; a key that IS present —
// even set to an empty string — is an explicit value (possibly a merchant deliberately clearing
// a field) and must never be overwritten. hasOwnProperty is the absent/deliberately-blank test:
// it is true for `{ heading: '' }` and false for `{}`. A field with no declared default that is
// absent from settings stays absent (existing behavior for a field the schema never defaults).
function applyLiquidSectionSchemaDefaults(
    settings: Record<string, unknown>,
    schemaFields: ReadonlyArray<{ id: string; default?: unknown }>,
): Record<string, unknown> {
    let merged: Record<string, unknown> | null = null;
    for (const field of schemaFields) {
        if (field.default === undefined) continue;
        if (Object.prototype.hasOwnProperty.call(settings, field.id)) continue;
        merged ??= { ...settings };
        merged[field.id] = field.default;
    }
    return merged ?? settings;
}

// Older persisted first-party Liquid footers read section.settings.contactEmail
// directly. Bind an absent setting to the already-public shop contact drop so
// existing releases follow General's storefront opt-in without rewriting the
// merchant's draft or a historical release. Explicit merchant settings win.
function bindPublicFooterContact(
    resolvedType: string,
    configured: Record<string, unknown>,
    settings: Record<string, unknown>,
    schemaFields: ReadonlyArray<{ id: string }>,
    shop: Record<string, unknown> | undefined,
): Record<string, unknown> {
    if (resolvedType !== 'footer') return settings;
    const fields = new Set(schemaFields.map((field) => field.id));
    let next: Record<string, unknown> | null = null;
    for (const [field, shopKey] of [['contactEmail', 'contact_email'], ['contactPhone', 'contact_phone']] as const) {
        if (!fields.has(field)) continue;
        const explicit = Object.prototype.hasOwnProperty.call(configured, field);
        if (explicit && !(field === 'contactEmail' && configured[field] === 'help@letbuyy.com')) continue;
        const publicValue = shop?.[shopKey];
        next ??= { ...settings };
        next[field] = typeof publicValue === 'string' ? publicValue : '';
    }
    return next ?? settings;
}

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
            // W2: a merchant-composed settings object only carries the keys the merchant (or
            // LetBuyy's own template compositions) actually set. Any key absent from it falls
            // back to its {% schema %} `default` — explicit merchant value (including a
            // deliberately empty string, which stays present as an own key) always wins, then
            // schema default, then genuinely nothing. Computed once, outside the try, so both the
            // success path and the error-placeholder path report the same resolved settings.
            const defaultedSectionSettings = bindPublicFooterContact(
                resolvedType,
                templateSection.settings,
                applyLiquidSectionSchemaDefaults(templateSection.settings, sectionFile.schema.settings),
                sectionFile.schema.settings,
                input.liquidContext?.shop,
            );

            // C1: per-section try/catch — a single bad section must not crash the full page render.
            // On error we push an HTML comment placeholder and continue.
            try {
                // Phase W: resolve any dynamic-source binding descriptors in section settings
                // BEFORE the scope is built. Plain literal values are unchanged (no-op when no
                // descriptors are present). siteDrops is already tenant-scoped by the caller.
                const siteDrops: SiteDrops = (input.liquidContext?.siteDrops as SiteDrops | undefined) ?? {};
                const resolvedSectionSettings = resolveDynamicSourceDescriptors(
                    defaultedSectionSettings,
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
                            products: toLiquidDrop(input.liquidContext?.section_products?.[sectionId] ?? []),
                            blocks: renderedBlocks.map((block) => ({
                                id: block.id,
                                type: block.type,
                                settings: block.settings,
                                content: block.html,
                                html: block.html,
                                is_app_block: block.isAppBlock,
                                editor_attributes: block.editorAttributes ?? '',
                                // Phase T: expose rendered child blocks in the section-level block drop
                                sub_blocks: (block.sub_blocks ?? []).map((child) => ({
                                    id: child.id,
                                    type: child.type,
                                    settings: child.settings,
                                    content: child.html,
                                    html: child.html,
                                    is_app_block: child.isAppBlock,
                                    editor_attributes: child.editorAttributes ?? '',
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
                    settings: defaultedSectionSettings,
                    html: await sanitizeRenderedHtml(String(sectionHtml)),
                    blocks: renderedBlocks,
                };
            } catch (sectionErr: unknown) {
                const message = sectionErr instanceof Error ? sectionErr.message : String(sectionErr);
                // Placeholder is safe static HTML — no merchant data, no Liquid source.
                return {
                    id: sectionId,
                    type: resolvedType,
                    settings: defaultedSectionSettings,
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
    const s7RenderStart = Date.now();
    if (S7_PROFILE_ENABLED) s7ProfileSanitizeCallCount = 0;
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
    const s7ParseStart = Date.now();
    try {
      bundle = parseLiquidThemePackageBundle(input.liquidBundle);
      s7ProfileMark('parseLiquidThemePackageBundle', s7ParseStart);
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

    const themeHeadAssets = buildLiquidThemeHeadAssets(bundle, input.storeTemplate.customCss);
    // T2a-fix/W2/CAP-C19 — sanitized in parallel with (not instead of) the wholeDocument pass
    // layoutHtml already gets below; this is the SAME raw input run through the SAME allowHeadMetadata
    // DOMPurify config, just also captured as plain CSS text for a caller that renders a real <style>
    // element instead of nesting a document. See sanitizeLiquidHeadStyleText's own doc comment.
    // Layout-owned styles are collected after the complete document is rendered below.
    const embedHeader = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.header, { allowHeadMetadata: true });
    const contentForHeader = `${themeHeadAssets}${embedHeader}`;
    const contentForFooter = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.footer);
    const engine = createLiquidEngine(bundle, {
      contentForHeader,
      contentForFooter,
      locale: input.context.locale || 'en',
      basePath: `/store/${input.context.subdomain}`,
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
      headStyleText: await sanitizeLiquidHeadStyleText(layoutHtml, true),
    };
    const composition = composeLiquidStorefrontTheme(input, bundle, templateKey);
    s7ProfileMark('LiquidRenderer.render:total', s7RenderStart, { path: input.context.path, sanitizeCalls: s7ProfileSanitizeCallCount });

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

// LiquidJS `renderLimit` is a WALL-CLOCK budget in milliseconds measured from the start of
// parseAndRender — not a CPU budget and not an iteration count. Sections are rendered concurrently
// (Promise.all, see renderLiquidSections), and sanitizeRenderedHtml runs jsdom + DOMPurify
// synchronously, so a section that is itself trivial can be aborted purely because a sibling blocked
// the event loop while its clock ran. Measured: sections/product-detail.liquid renders in ~3ms in
// isolation under a 250ms limit, yet aborted with "template render limit exceeded" inside the
// concurrent pipeline — which is why the product, collection and search templates emitted an empty
// shell. Because the trip point depends on machine speed and load it also read as flaky.
//
// 5s keeps a hard abort on a genuinely runaway template while leaving headroom for that contention.
// It is NOT the sandbox's data-safety boundary: `ownPropertyOnly`, the drop scrub, `outputEscape`,
// upload-time `{% render %}` forbidding, `parseLimit` (template size) and `memoryLimit` (output size)
// are the structural guards and are unchanged. Reducing sibling contention — sanitizing off the
// render path, or rendering sections sequentially, which the F9 benchmark shows is ~5x faster than
// the current parallel path (42ms vs 227ms for N=25) — is the real fix and is tracked as follow-up.
const liquidRenderOptions = {
  templateLimit: 20_000,
  renderLimit: 5_000,
  memoryLimit: 2_000_000,
} as const;

function createLiquidEngine(
  bundle: LiquidThemePackageBundle,
  globals: { contentForHeader?: string; contentForFooter?: string; locale?: string; basePath?: string } = {},
): Liquid {
  const contentForHeader = globals.contentForHeader || '';
  const contentForFooter = globals.contentForFooter || '';
  const locale = globals.locale || 'en';
  const basePath = globals.basePath || '';
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

  registerLetbuyyLiquidFilters(engine, bundle, locale, basePath);
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
    const editorAttributes = input.input.context.previewMode ? `data-block-id="${escapeHtmlAttribute(blockId)}"` : '';

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
        editorAttributes,
      });
      continue;
    }

    const blockFile = input.bundle.blocks[block.type];
    const sectionFile = input.bundle.sections[input.sectionType];
    const inlineBlockAllowed = sectionFile?.schema.blocks.some((candidate) => candidate.type === block.type) === true;
    if (!blockFile && !inlineBlockAllowed) continue;

    // C1: block-level try/catch — a broken block source must not crash the enclosing section render.
    // On error the block is included with empty html so the section template can still render its structure.
    let blockHtml = '';
    // Existing reusable parents retain their canonical child path. Newly exposed inline
    // child drops include installed first-party reusable definitions only; app seams stay dormant.
    const nestedBlocks = blockFile ? block.blocks ?? {} : Object.fromEntries(
      Object.entries(block.blocks ?? {}).filter(([, child]) => !isLiquidAppBlockType(child.type) && Object.hasOwn(input.bundle.blocks, child.type)),
    );
    // Phase T: render child blocks first (before the parent) so sub_blocks is available in the
    // parent block's Liquid scope.  Depth guard: stop at RENDERER_MAX_BLOCK_DEPTH silently.
    let subBlockResults: LiquidRenderedBlock[] = [];
    try {
      if (depth < RENDERER_MAX_BLOCK_DEPTH && Object.keys(nestedBlocks).length > 0) {
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
              blocks: nestedBlocks,
              block_order: (block.block_order ?? []).filter(id => Object.hasOwn(nestedBlocks, id)),
              disabled: false,
            },
          },
          depth + 1,
        );
      }

      if (blockFile) {
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
              editor_attributes: editorAttributes,
              // Phase T: thread rendered child blocks into the parent block's Liquid drop
              sub_blocks: subBlockResults.map((child) => ({
                id: child.id,
                type: child.type,
                settings: child.settings,
                content: child.html,
                html: child.html,
                is_app_block: child.isAppBlock,
                editor_attributes: child.editorAttributes ?? '',
              })),
            },
          }),
          liquidRenderOptions,
        );
        blockHtml = await sanitizeRenderedHtml(String(rawBlockHtml));
      }
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
      editorAttributes,
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
      // T1/W2 — page-request query values (e.g. ?error=bot_verification after a failed Turnstile
      // challenge), so a form section can render a real message instead of a silent redirect.
      // Escaped like any other Liquid output ({{ }}, never `| raw`) — safe to display even though
      // it is caller-supplied, and never used for anything but display text.
      // Liquid synthesizes hash.size when the key is absent. A query map must
      // expose an empty clothing-size filter, never the number of query keys.
      query: { size: '', ...filterBlockedSettingsKeys(input.context.searchParams || {}) },
      error: (input.context.searchParams || {}).error || null,
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
    // T1/W1 — the routes drop, now base-path-aware. Every real storefront page under Liquid lives at
    // /store/{subdomain}/... (see apps/commerce/web/src/app/store/[subdomain]/**) — that path
    // is directly, unconditionally reachable on ANY host, confirmed by reading proxy.ts: /store/<sub>
    // is the internal rewrite TARGET (`rewriteToStore`), and proxy.ts explicitly skips its access
    // gate for requests that already start with /store/ ("reached as a URL instead of as a rewrite...
    // it is only ever legitimate host-routed" — proxy.ts:186-189), so it falls straight through to
    // Next.js's own router either way. This is also EXACTLY the pattern the React path already uses
    // unconditionally (composition-engine.tsx's `basePath = \`/store/${plan.route.subdomain}\``) —
    // proven correct in production today, not a new scheme invented for Liquid. Mirroring it exactly
    // means routes.* work identically under localhost:9000/store/snaz/... (local dev + theme-editor
    // preview) and under a production subdomain host, with no mode-branching needed inside the
    // renderer at all.
    routes: (() => {
      const basePath = `/store/${input.context.subdomain}`;
      const customerLoginUrl = `${basePath}/customers/login`;
      const customerRegisterUrl = `${basePath}/customers/register`;
      // POST-only — use inside a form, not a plain anchor href, to avoid CSRF and accidental GET logout.
      const customerLogoutUrl = '/api/customer/logout';
      return {
        root_url: basePath,
        cart_url: `${basePath}/cart`,
        search_url: `${basePath}/search`,
        all_products_collection_url: `${basePath}/products`,
        collections_url: `${basePath}/collections`,
        contact_url: `${basePath}/contact`,
        blog_url: `${basePath}/blog`,
        account_url: `${basePath}/account`,
        account_orders_url: `${basePath}/account/orders`,
        account_addresses_url: `${basePath}/account/addresses`,
        account_settings_url: `${basePath}/account/settings`,
        account_wishlist_url: `${basePath}/account/wishlist`,
        // Shopify-convention names (the phase's own requested vocabulary) ...
        customer_login_url: customerLoginUrl,
        customer_register_url: customerRegisterUrl,
        customer_logout_url: customerLogoutUrl,
        // ... kept as aliases too: nothing in this bundle currently reads the account_* forms, but
        // they were the pre-existing names and removing them outright is an unforced breaking change.
        account_login_url: customerLoginUrl,
        account_register_url: customerRegisterUrl,
        account_logout_url: customerLogoutUrl,
      };
    })(),
    product: commerceDrops.product,
    collection: commerceDrops.collection,
    collections: commerceDrops.collections,
    cart: commerceDrops.cart,
    customer: commerceDrops.customer,
    buyer: commerceDrops.buyer,
    buyer_wishlist: commerceDrops.buyer_wishlist,
    buyer_unavailable: commerceDrops.buyer_unavailable,
    search: commerceDrops.search,
    order: commerceDrops.order,
    // D1-A: linklists drop (Shopify convention). Populated by LANE-B (composition-engine.tsx).
    // toLiquidDrop safely sanitizes the nested nav structure; falls back to empty object.
    // T5/W1 — +2 depth budget: linklists(0)->menu(1)->links[](2)->item(3)->children[](4)->
    // child-item(5, an OBJECT, needs depth < max) is where the default cap of 4 blocks a child's
    // own entries (title/url/active) from ever being read. +1 alone only rescues the empty array
    // shell, not its contents — verified by a failing test before landing on +2. See
    // toLiquidDrop's doc comment for why this is scoped to linklists only.
    linklists: toLiquidDrop(input.liquidContext?.linklists, 0, MAX_LIQUID_DROP_DEPTH + 2) ?? {},
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
  buyer: unknown;
  buyer_wishlist: unknown;
  buyer_unavailable: boolean;
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
    buyer: toLiquidDrop(context?.buyer) || null,
    buyer_wishlist: toLiquidDrop(context?.buyer_wishlist) || null,
    buyer_unavailable: context?.buyer_unavailable === true,
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

// T5/W1 — `maxDepth` defaults to MAX_LIQUID_DROP_DEPTH (the enforced global cap; SEC-4 tests this
// exact default and must never be weakened). linklists is the one caller that passes a raised
// budget: a nav item's nested `.links` (one level of dropdown children) sits at depth 4 by the time
// its own array is reached (linklists->menu->links[]->item->links[]), one level deeper than generic
// drops need. Navigation is merchant-curated/editor-bounded, not arbitrary embedded content, so a
// scoped +1 for this one call site is a materially different risk than raising the global default.
function toLiquidDrop(value: unknown, depth = 0, maxDepth = MAX_LIQUID_DROP_DEPTH): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= maxDepth) return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_LIQUID_DROP_ARRAY_ITEMS)
      .map((item) => toLiquidDrop(item, depth + 1, maxDepth))
      .filter((item) => item !== undefined);
  }

  if (typeof value !== 'object') return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_LIQUID_DROP_KEYS)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || BLOCKED_DROP_KEYS.has(key)) continue;
    const next = toLiquidDrop(raw, depth + 1, maxDepth);
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

function registerLetbuyyLiquidFilters(engine: Liquid, bundle: LiquidThemePackageBundle, locale: string, basePath = ''): void {
  engine.registerFilter('money', (value: unknown) => formatLiquidMoney(value));
  engine.registerFilter('money_with_currency', (value: unknown, currency?: unknown) => formatLiquidMoney(value, currency));
  // JSON carriers stay inert through HTML attribute escaping and sanitization.
  // JSON.parse restores the exact text; literal brackets/entities cannot become
  // markup or make the sanitizer discard the complete data-* carrier.
  engine.registerFilter('json', (value: unknown) => JSON.stringify(toLiquidDrop(value) ?? null)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
  engine.registerFilter('asset_url', (value: unknown) => safeLiquidUrl(value));
  engine.registerFilter('image_url', (value: unknown) => safeLiquidUrl(value));
  // S5/W2 — video embed URLs (YouTube/Vimeo) get the exact same scheme allowlist as images/assets:
  // only absolute http(s), protocol-relative, or a root-relative path survive; anything else (a
  // javascript:/data: scheme) becomes ''. A distinct filter NAME for readability at the call site
  // only — safeLiquidUrl itself is not duplicated or reimplemented.
  engine.registerFilter('video_url', (value: unknown) => safeLiquidUrl(value));
  // T1/W1 — merchant-typed relative paths (nav link block settings, etc.) are stored as portable
  // fragments like "/products" so the SAME default composition works for every merchant's own
  // subdomain — they are not resolved at authoring time. This filter resolves one at RENDER time:
  // a root-relative path (starts with "/", not "//") gets the current store's base path prefixed
  // (unless it is already prefixed, so a merchant who once saves an already-resolved value is not
  // double-prefixed); anything else — an absolute http(s)/protocol-relative URL, mailto:, tel:, a
  // bare #anchor, or an empty value — passes through unchanged, since a merchant nav link
  // legitimately can point off-site. Mirrors composition-engine.tsx's own
  // `basePath = /store/${subdomain}` — the same, already-production-proven scheme, not a new one.
  engine.registerFilter('store_url', (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return raw;
    if (!raw.startsWith('/') || raw.startsWith('//')) return raw;
    if (basePath && (raw === basePath || raw.startsWith(`${basePath}/`))) return raw;
    return `${basePath}${raw}`;
  });
  engine.registerFilter('t', (value: unknown, replacements?: unknown) => {
    const key = String(value ?? '').trim();
    if (!key) return '';
    return tLocale(key, locale, bundle.locales, asRecord(replacements) as Record<string, string | number>);
  });
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

  // A5: React's AppBlockCard falls back to "Installed app" (app-platform.ts's default app-block
  // title) when no real app has populated this slot yet — an honest, visible placeholder rather
  // than silent empty space. Mirror that exact fallback text here so an app-block-slot section
  // with no installed app renders the same placeholder in both engines.
  return `<div class="lb-app-block__placeholder" data-letbuyy-app-block="${escapeHtmlAttribute(blockId)}" data-app-block-type="${escapeHtmlAttribute(block.type)}"><h3 class="lb-app-block__heading">Installed app</h3></div>`;
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
  const s7WasAlreadyInitialized = domPurifyPromise !== undefined;
  const s7InitStart = Date.now();
  domPurifyPromise ||= (async () => {
    const s7ImportStart = Date.now();
    // Package conditions keep Node DOM dependencies out of worker/client
    // bundles. Unsupported runtimes fail closed instead of skipping sanitization.
    const { createDOMPurify, JSDOM } = await loadThemeServerDom();
    s7ProfileMark('getThemeDomPurify:dynamic import(dompurify)+import(jsdom)', s7ImportStart);
    const s7WindowStart = Date.now();
    const { window } = new JSDOM('<!doctype html><html><body></body></html>');
    s7ProfileMark('getThemeDomPurify:new JSDOM(singleton window)', s7WindowStart);
    const s7CreatePurifyStart = Date.now();
    const purify = createDOMPurify(window as unknown as WindowLike);
    s7ProfileMark('getThemeDomPurify:createDOMPurify(window)', s7CreatePurifyStart);
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
    return { purify };
  })();
  const s7WasPending = !s7WasAlreadyInitialized;
  const resolved = await domPurifyPromise;
  if (s7WasPending) s7ProfileMark('getThemeDomPurify:first-init:total(await until resolved)', s7InitStart);
  else s7ProfileMark('getThemeDomPurify:already-resolved(await cost only)', s7InitStart);

  return resolved;
}

// S7/W2 — profile-justified fix for the cold-path finding in
// docs/evidence/liquid-load/S7-cold-path-profile.md: getThemeDomPurify()'s dynamic
// import('dompurify')+import('jsdom') plus the singleton JSDOM window construction measured
// ~490ms (454ms imports + 38ms window) the FIRST time any request reaches it in a process's
// lifetime — never again afterward (confirmed: singleton, module-level, persists correctly).
// This does not touch WHAT gets sanitized, the allowlist, the FORBID lists, or
// outputEscape:'escape' — only WHEN the already-existing lazy singleton gets constructed.
// Call this once from a server startup hook (e.g. Next.js instrumentation.ts's register(),
// Node.js runtime only — jsdom/dompurify are server-only) so the cost lands on server boot,
// which nobody is timing, instead of on whichever request happens to arrive first. Errors are
// swallowed deliberately: a failed warmup must never crash server startup — sanitizeRenderedHtml
// still lazily retries via the exact same getThemeDomPurify() call on the next real request.
export function warmupThemeDomPurify(): void {
  void getThemeDomPurify().catch(() => {});
}

export async function sanitizeRenderedHtml(
  html: string,
  options: RenderedHtmlSanitizerOptions = {},
): Promise<string> {
  const s7SanitizeStart = Date.now();
  if (S7_PROFILE_ENABLED) s7ProfileSanitizeCallCount += 1;
  const { purify } = await getThemeDomPurify();

  if (options.allowHeadMetadata) {
    const s7PurifyStart = Date.now();
    const sanitizedDocument = purify.sanitize(
      `<!doctype html><html><head>${html}</head><body></body></html>`,
      { ...LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG, RETURN_DOM: true },
    );
    s7ProfileMark('sanitizeRenderedHtml:purify.sanitize(allowHeadMetadata)', s7PurifyStart, { htmlLength: html.length });
    // WHOLE_DOCUMENT + RETURN_DOM returns the sanitized <html> element. Read
    // its head directly; serializing and reparsing in a new JSDOM window adds
    // work and retains a separate window for each render. No raw input is read.
    const result = sanitizedDocument.ownerDocument?.head.innerHTML.trim() ?? '';
    s7ProfileMark('sanitizeRenderedHtml:total(allowHeadMetadata)', s7SanitizeStart, { htmlLength: html.length });
    return result;
  }

  const s7PurifyStart = Date.now();
  const result = purify.sanitize(
    html,
    options.wholeDocument
      ? LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG
      : LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG,
  );
  s7ProfileMark('sanitizeRenderedHtml:purify.sanitize', s7PurifyStart, { htmlLength: html.length, wholeDocument: Boolean(options.wholeDocument) });
  s7ProfileMark('sanitizeRenderedHtml:total', s7SanitizeStart, { htmlLength: html.length, wholeDocument: Boolean(options.wholeDocument) });
  return result;
}

// T2a-fix/W2/CAP-C19 — extracts SANITIZED CSS TEXT (not an HTML string, no wrapping <style> tag)
// from theme-controlled head assets, for a caller that wants to render a real <style> element in
// a React tree (e.g. `<style data-theme-renderer="liquid">{cssText}</style>`) rather than embed a
// nested HTML document.
//
// Safety: this reuses sanitizeRenderedHtml's own `allowHeadMetadata` DOMPurify document-config
// pass unchanged (rawHeadHtml is parsed as `<head>{rawHeadHtml}</head>` inside a full jsdom
// document and run through the SAME LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG the
// wholeDocument layoutHtml path already uses). Extraction happens AFTER that pass, by reading
// `.textContent` off the resulting sanitized <style> DOM node(s) — not by string-slicing the raw
// input. A hostile theme-setting value containing a literal `</style>` breakout sequence is
// neutralized by DOMPurify's HTML parser: it has already split the input into
// separate nodes before DOMPurify ever ran, and any injected tag (e.g. <script>) is stripped by
// the same FORBID_TAGS/allowlist config the whole-document layout pass relies on — proven by the
// adversarial test in liquid-s1-w5-adversarial-security.test.ts covering this function.
export async function sanitizeLiquidHeadStyleText(rawHeadHtml: string, wholeDocument = false): Promise<string> {
  if (!rawHeadHtml || rawHeadHtml.trim() === '') return '';
  const { purify } = await getThemeDomPurify();
  const sanitizedDocument = purify.sanitize(
    wholeDocument ? rawHeadHtml : `<!doctype html><html><head>${rawHeadHtml}</head><body></body></html>`,
    { ...LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG, RETURN_DOM: true },
  );
  const head = sanitizedDocument.ownerDocument?.head;
  const styleNodes = Array.from<{ textContent: string | null }>(head?.querySelectorAll('style') ?? []);
  return styleNodes.map((node) => node.textContent ?? '').join('\n').trim();
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
