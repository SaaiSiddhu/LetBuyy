import { isFirstPartyCoreBundleSlug } from './theme-bundle-core';
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
  MAX_BUNDLE_BLOCK_NESTING_DEPTH,
  type LiquidThemePackageBundle,
  type ThemeBundleJson,
} from './theme-bundle';
import { createLetbuyyCoreLiquidThemeBundleFixture, LETBUYY_CORE_STARTER_ANNOUNCEMENT } from './theme-bundle-core';
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
  templates?: Record<string, unknown>;
  sectionGroups?: Record<string, unknown>;
  settings_data?: Record<string, unknown>;
  config?: Record<string, unknown>;
  sections?: {
    header?: PortableSectionInstance;
    template?: PortableSectionInstance[];
    footer?: PortableSectionInstance;
  };
}

export interface CompilePortableToLiquidOptions {
  /** Preserve the captured release's Liquid files while projecting its portable settings/templates. */
  baseBundle?: LiquidThemePackageBundle;
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
function plainSettings(settings: unknown): Record<string, ThemeBundleJson> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const out: Record<string, ThemeBundleJson> = {};
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
  if (options.baseBundle) return projectExistingLiquidBundle(templateConfig, options.baseBundle);
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


/** Recognize only the obsolete first-party demo cards in both portable shapes. */
export function isUnchangedCoreDemoCategoryBlocks(value: unknown, order?: unknown): boolean {
  const object=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:{};
  const seeds=[['category-sneakers','Sneakers','sneakers','Fresh pairs'],['category-apparel','Apparel','apparel','Daily fits'],['category-accessories','Accessories','accessories','Finish the look']];
  // jsonb objects have no semantic key order. Match known instance IDs, while
  // retaining strict explicit block_order and array ordering checks below.
  const entries=object(value);
  if(!Array.isArray(value) && Object.keys(entries).length!==seeds.length)return false;
  const rows=Array.isArray(value)?value.map(v=>{const b=object(v);return [b.id,b] as const;}):seeds.map(seed=>[seed[0],entries[seed[0]]] as const);
  if (order!==undefined && JSON.stringify(order)!==JSON.stringify(seeds.map(seed=>seed[0]))) return false;
  return rows.length===3 && rows.every(([key,value],i)=>{
    const b=object(value),settings=object(b.settings),seed=seeds[i];
    return key===seed[0] && (b.id===undefined || b.id===seed[0]) && b.type==='category'
      && (b.order===undefined || b.order===i || b.order===i*10) && b.visible!==false && b.disabled!==true
      && (b.visible===undefined || b.visible===true) && (b.disabled===undefined || b.disabled===false)
      // Editor normalization supplies empty child containers and ten-step order
      // metadata. They carry no merchant content; populated children still refuse.
      && (b.children===undefined || (Array.isArray(b.children) && b.children.length===0))
      && (b.blocks===undefined || (!Array.isArray(b.blocks) && b.blocks!==null && typeof b.blocks==='object' && Object.keys(b.blocks).length===0))
      && (b.block_order===undefined || (Array.isArray(b.block_order) && b.block_order.length===0))
      && Object.keys(b).every(k=>['id','type','order','visible','disabled','settings','children','blocks','block_order'].includes(k))
      && settings.name===seed[1] && settings.slug===seed[2] && settings.tagline===seed[3]
      && (settings.image===undefined || settings.image==='')
      && Object.keys(settings).every(k=>['name','slug','tagline','image'].includes(k));
  });
}

// Project a saved portable document onto its own immutable Liquid code bundle.
// Existing files and untouched templates remain byte-for-byte; no stock fixture
// or new rendering authority is introduced on this branch.
function projectExistingLiquidBundle(
  input: PortableThemeTemplateConfig,
  source: LiquidThemePackageBundle,
): CompilePortableToLiquidResult {
  const base = parseLiquidThemePackageBundle(source);
  const warnings: string[] = [];
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
  const id = (value: string) => {
    if (!value || value.length > 120 || BLOCKED_DROP_KEYS.has(value) || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid portable Liquid instance id');
    return value;
  };
  const collection = (value: unknown): Record<string, unknown> => {
    if (Array.isArray(value)) {
      const rows = value.map(value => {
        const row = object(value);
        if (typeof row.id !== 'string') throw new Error('Portable Liquid instances require stable ids');
        return [id(row.id), row] as const;
      });
      if (new Set(rows.map(([key]) => key)).size !== rows.length) throw new Error('Portable Liquid instance ids must be distinct');
      return Object.fromEntries(rows);
    }
    if (!value || typeof value !== 'object') throw new Error('Portable Liquid instances must be an object or array');
    return Object.fromEntries(Object.entries(value).map(([key, row]) => [id(key), row]));
  };
  const ordered = (value: unknown, rows: Record<string, unknown>): string[] => {
    if (value === undefined) return Object.keys(rows);
    if (!Array.isArray(value) || value.some(key => typeof key !== 'string' || !own(rows, key)) || new Set(value).size !== value.length) {
      throw new Error('Portable Liquid order must reference distinct existing instances');
    }
    return value as string[];
  };
  const disabled = (row: Record<string, unknown>, fallback = false): boolean => {
    if (row.disabled === true) return true;
    if (typeof row.visible === 'boolean') return !row.visible;
    if (typeof row.isVisible === 'boolean') return !row.isVisible;
    return typeof row.disabled === 'boolean' ? row.disabled : fallback;
  };
  type Section = LiquidThemePackageBundle['templates'][string]['sections'][string];
  type Block = Section['blocks'][string];
  const blocks = (value: unknown, order: unknown, previous: Section['blocks'], allowed: ReadonlySet<string>, depth = 0, aliases: Readonly<Record<string, string>> = {}): { blocks: Section['blocks']; block_order: string[] } => {
    if (value === undefined) return { blocks: previous, block_order: order === undefined ? Object.keys(previous) : ordered(order, previous) };
    const rows = collection(value);
    if (depth >= MAX_BUNDLE_BLOCK_NESTING_DEPTH && Object.keys(rows).length > 0) throw new Error('Portable Liquid block nesting exceeds the canonical maximum');
    const next: Section['blocks'] = Object.fromEntries(Object.entries(rows).map(([key, value]) => {
      const row = object(value), old = previous[key];
      const rawType = typeof row.type === 'string' ? row.type : old?.type;
      if (!rawType) throw new Error('Portable Liquid block type is missing');
      const existingType = allowed.has(rawType) || base.blocks[rawType] ? rawType :
        allowed.has(toKebabCase(rawType)) || base.blocks[toKebabCase(rawType)] ? toKebabCase(rawType) : null;
      const alias = aliases[rawType] || aliases[toKebabCase(rawType)];
      const type = existingType ?? (alias && allowed.has(alias) ? alias : rawType);
      const nestedOrder = row.blocks === undefined && row.block_order === undefined ? old?.block_order : row.block_order;
      const nested = blocks(row.blocks, nestedOrder, old?.blocks || {}, new Set(Object.keys(base.blocks)), depth + 1);
      const result: Block = { type, settings: own(row, 'settings') ? plainSettings(row.settings) : old?.settings || {},
        disabled: disabled(row, old?.disabled), ...nested };
      return [key, result];
    }));
    return { blocks: next, block_order: ordered(order, next) };
  };
  const section = (value: unknown, previous?: Section): Section => {
    const row = { ...object(value) }, rawType = typeof row.type === 'string' ? row.type : previous?.type;
    if (!rawType) throw new Error('Portable Liquid section type is missing');
    const type = resolveLiquidSectionType(rawType, new Set(Object.keys(base.sections)));
    if (!type) throw new Error('Portable section has no section file in the captured Liquid bundle: ' + rawType);
    // Older first-party Core defaults retained three fabricated category cards
    // after the Liquid section switched to real collections. Only those exact
    // untouched defaults are retired; arbitrary merchant blocks still fail validation.
    if (isFirstPartyCoreBundleSlug(base.package.slug, base.package.version) && type === 'category-grid' && isUnchangedCoreDemoCategoryBlocks(row.blocks, row.block_order)) {
      row.blocks={}; row.block_order=[];
      warnings.push('Retired unchanged legacy Core demo-category defaults; this section renders actual collections.');
    }
    const inlineTypes = new Set(base.sections[type].schema.blocks.map(block => block.type));
    const allowed = new Set([...Object.keys(base.blocks), ...inlineTypes]);
    // Canonical portable navigation names share label/href with these first-party inline links.
    // Existing captured definitions win; no alias is invented without the containing section's code.
    const aliases: Readonly<Record<string, string>> = !inlineTypes.has('link') ? {} : type === 'header'
      ? { navPage: 'link', 'nav-page': 'link' } : type === 'footer'
        ? { footerLink: 'link', 'footer-link': 'link' } : {};
    const nested = own(row, 'blocks') ? blocks(row.blocks, row.block_order, previous?.blocks || {}, allowed, 0, aliases) :
      { blocks: previous?.blocks || {}, block_order: row.block_order === undefined ? previous?.block_order || [] : ordered(row.block_order, previous?.blocks || {}) };
    const settings = own(row, 'settings') ? { ...(isFirstPartyCoreBundleSlug(base.package.slug, base.package.version) ? previous?.settings : {}), ...plainSettings(row.settings) } : previous?.settings || {};
    if (isFirstPartyCoreBundleSlug(base.package.slug, base.package.version) && type === 'featured-products') {
      // Persisted Core packages can predate the captured instance defaults. Use
      // their declared schema defaults only for omitted fields, preserving edits.
      for (const key of ['viewAllLabel', 'viewAllHref']) {
        if (!own(settings, key)) {
          const fallback = base.sections[type].schema.settings.find(field => field.id === key)?.default;
          if (fallback !== undefined) settings[key] = fallback;
        }
      }
      if (!own(object(row.settings), 'viewAllHref') && settings.viewAllHref === '/collections/new-arrivals') {
        settings.viewAllHref = '/products'; // Legacy defaults must not require an invented collection.
      }
    }
    return { type, settings,
      disabled: disabled(row, previous?.disabled), ...nested };
  };
  const templates = { ...base.templates };
  const projectTemplate = (key: string, value: unknown) => {
    // `password` is a canonical template, not a credential field. Keep the
    // sensitive-drop denylist for settings and section/block instance ids.
    if (key !== 'password') id(key);
    const row = object(value), previous = templates[key];
    if (!own(row, 'sections')) return;
    const rows = collection(row.sections);
    const next = Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, section(value, previous?.sections[key])]));
    templates[key] = { ...(previous || {}),
      ...(typeof row.name === 'string' ? { name: row.name } : {}),
      ...(typeof row.layout === 'string' ? { layout: row.layout } : {}),
      sections: next, order: ordered(row.order, next) };
  };
  const portableTemplates = object(input.templates);
  for (const [key, value] of Object.entries(portableTemplates)) {
    projectTemplate(key === 'home' && !own(portableTemplates, 'index') && !own(base.templates, 'home') ? 'index' : key, value);
  }
  const groups = object(input.sectionGroups);
  for (const key of ['header', 'footer']) {
    if (!own(portableTemplates, key) && own(groups, key)) projectTemplate(key, groups[key]);
  }
  const root = object(input.sections);
  if (Object.keys(portableTemplates).length === 0 && own(root, 'template')) {
    projectTemplate('index', { sections: root.template });
  }
  for (const key of ['header', 'footer']) {
    if (!own(root, key)) continue;
    const value = root[key], row = object(value), current = templates[key];
    if (!current) {
      if (value === null) continue;
      projectTemplate(key, { sections: [row] });
      continue;
    }
    const desiredType = typeof row.type === 'string' ? resolveLiquidSectionType(row.type, new Set(Object.keys(base.sections))) : key;
    const matches = Object.keys(current.sections).filter(id => current.sections[id].type === desiredType);
    const target = typeof row.id === 'string' && own(current.sections, row.id) ? row.id : matches.length === 1 ? matches[0] : null;
    if (!target) throw new Error('Review the captured global Liquid section before changing it');
    templates[key] = { ...current, sections: { ...current.sections,
      [target]: value === null ? { ...current.sections[target], disabled: true } : section(row, current.sections[target]) } };
  }
  // Old Core portable slots placed the same announcement into index as well
  // as the captured header group. Retire only the exact duplicate default.
  if (isFirstPartyCoreBundleSlug(base.package.slug, base.package.version)) {
    const global = templates.header?.sections['announcement-default'];
    const index = templates.index, duplicate = index?.sections['announcement-default'];
    // The frozen portable registry still emits the former Core default. Retire
    // only that complete unchanged instance when the new header owns the message;
    // a merchant-edited text/link/style must remain visible and editable.
    const oldDefault: Record<string, unknown> = {
      text: 'Free shipping on fresh drops this week.', linkLabel: 'Shop now', linkHref: '/products',
      alignment: 'center', backgroundColor: '#0F172A', textColor: '#FFFFFF', visibleOnMobile: true,
    };
    const unchangedOldDefault = duplicate && global?.settings.text === LETBUYY_CORE_STARTER_ANNOUNCEMENT
      && Object.keys(duplicate.settings).length === Object.keys(oldDefault).length
      && Object.entries(oldDefault).every(([key, value]) => duplicate.settings[key] === value)
      && !duplicate.disabled && Object.keys(duplicate.blocks || {}).length === 0;
    if (global?.type === 'announcement-bar' && duplicate?.type === 'announcement-bar'
        && ((global.settings.text === duplicate.settings.text && global.settings.linkHref === duplicate.settings.linkHref)
          || unchangedOldDefault)) {
      const sections = { ...index.sections }; delete sections['announcement-default'];
      templates.index = { ...index, sections, order: index.order.filter(id => id !== 'announcement-default') };
    }
  }
  const settings = object(input.settings_data), config = object(input.config), nestedSettings = object(config.settings_data);
  const current = { ...base.config.settings_data?.current,
    ...plainSettings(nestedSettings.current), ...plainSettings(settings.current), ...plainSettings(input.themeSettings) };
  const bundle = parseLiquidThemePackageBundle({ ...base, templates,
    config: { ...base.config, settings_data: { ...base.config.settings_data, current,
      presets: { ...base.config.settings_data?.presets, ...object(nestedSettings.presets), ...object(settings.presets) } } } });
  return { bundle, warnings };
}
