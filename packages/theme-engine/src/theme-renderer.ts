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
export type ThemeRendererStatus = 'rendered' | 'unsupported';

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
    'data-lb-island',
    'data-lb-variant-option',
    'data-letbuyy-app-block',
    'data-product-currency',
    'data-product-id',
    'data-product-name',
    'data-product-price',
    'data-product-url',
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
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker)$/,
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

    const contentForHeader = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.header, { allowHeadMetadata: true });
    const contentForFooter = await renderLiquidEmbedRegion(input.liquidAppEmbeds?.footer);
    const engine = createLiquidEngine(bundle, {
      contentForHeader,
      contentForFooter,
      locale: input.context.locale || 'en',
    });
    const renderedSections: LiquidRenderedSection[] = [];
    const sectionOrder = orderedKeys(template.sections, template.order);

    for (const sectionId of sectionOrder) {
      const templateSection = template.sections[sectionId];
      if (!templateSection || templateSection.disabled) continue;

      const sectionFile = bundle.sections[templateSection.type];
      if (!sectionFile) {
        warnings.push(`Liquid section "${templateSection.type}" was not found and was skipped.`);
        continue;
      }

      const renderedBlocks = await renderLiquidSectionBlocks({
        engine,
        bundle,
        input,
        sectionId,
        sectionType: templateSection.type,
        section: templateSection,
      });
      const sectionHtml = await engine.parseAndRender(
        stripLiquidSchemaBlocks(sectionFile.source),
        buildLiquidScope(input, bundle, {
          section: {
            id: sectionId,
            type: templateSection.type,
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
        type: templateSection.type,
        settings: templateSection.settings,
        html: await sanitizeRenderedHtml(String(sectionHtml)),
        blocks: renderedBlocks,
      });
    }

    const contentForLayout = renderedSections.map((section) => section.html).join('\n');
    const layoutHtml = await engine.parseAndRender(
      bundle.layout.theme.source,
      buildLiquidScope(input, bundle, {
        content_for_layout: contentForLayout,
        content_for_header: contentForHeader,
        content_for_footer: contentForFooter,
      }),
      liquidRenderOptions,
    );
    const liquid: LiquidRenderedTheme = {
      templateKey,
      layoutHtml: await sanitizeRenderedHtml(String(layoutHtml), { wholeDocument: true }),
      contentForLayout,
      sections: renderedSections,
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

    const html = await input.engine.parseAndRender(
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

    blocks.push({
      id: blockId,
      type: block.type,
      settings: block.settings,
      html: await sanitizeRenderedHtml(String(html)),
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
    settings: {
      ...asRecord(bundle.config.settings_data.current),
      ...(asRecord(input.liquidContext?.settings)),
    },
    routes: {
      root_url: '/',
      cart_url: '/cart',
      search_url: '/search',
    },
    product: commerceDrops.product,
    collection: commerceDrops.collection,
    collections: commerceDrops.collections,
    cart: commerceDrops.cart,
    customer: commerceDrops.customer,
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
const BLOCKED_DROP_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'password', 'password_hash', 'access_token', 'refresh_token', 'signing_secret', 'client_secret']);

function buildLiquidCommerceDrops(context?: LiquidCommerceDrops): {
  product: unknown;
  collection: unknown;
  collections: unknown[];
  cart: Record<string, unknown>;
  customer: unknown;
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
      import('jsdom'),
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
