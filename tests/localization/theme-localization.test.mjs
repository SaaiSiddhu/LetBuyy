import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const THEME_BUNDLE_SOURCE = 'packages/theme-engine/src/theme-bundle.ts';
const ADMIN_LOCALES_SOURCE = 'apps/merchant/web/src/lib/i18n/admin-locales.ts';
const STOREFRONT_STORE_SERVICE_SOURCE = 'apps/commerce/web/src/lib/store-service.ts';
const ADMIN_SETTINGS_PAGE_SOURCE = 'apps/merchant/web/src/app/[store]/settings/general/page.tsx';
const STORES_ROUTE_SOURCE = 'services/api-gateway/src/routes/stores.ts';

function createSchema(parseFn = (value) => ({ success: true, data: value })) {
  const schema = function schema() {};
  const chain = new Proxy(schema, {
    get(_target, property) {
      if (property === 'safeParse') return parseFn;
      if (property === 'parse') {
        return (value) => {
          const result = parseFn(value);
          if (!result.success) throw result.error || new Error('Schema parse failed');
          return result.data;
        };
      }
      if (
        property === 'optional' ||
        property === 'nullable' ||
        property === 'default' ||
        property === 'passthrough' ||
        property === 'strict' ||
        property === 'superRefine' ||
        property === 'min' ||
        property === 'max' ||
        property === 'length' ||
        property === 'regex' ||
        property === 'int' ||
        property === 'positive'
      ) {
        return () => chain;
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function createZodStub() {
  const generic = createSchema();
  const z = {
    ZodIssueCode: { custom: 'custom' },
    string: () => generic,
    number: () => generic,
    boolean: () => generic,
    unknown: () => generic,
    null: () => generic,
    literal: () => generic,
    enum: () => generic,
    union: () => generic,
    array: () => generic,
    record: () => generic,
    object: () => generic,
    lazy: () => generic,
    coerce: {
      number: () => generic,
      date: () => generic,
    },
  };

  return { z };
}

// Resolves a relative TypeScript specifier the same way Node/tsc would (an explicit extension, or
// bare `./name` meaning `./name.ts`/`./name.tsx`/`./name/index.ts`) -- these source files are read
// straight off disk, never through a bundler, so nothing else resolves this for us.
function resolveRelativeSpecifier(fromPath, specifier) {
  const base = resolvePath(dirname(fromPath), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolvePath(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve "${specifier}" from ${fromPath} (tried ${base}, ${base}.ts, ${base}.tsx, ${base}/index.ts)`);
}

// A hand-rolled TS->CJS loader, not a bundler: it stubs `zod` (these files' only non-relative
// dependency) and otherwise resolves and loads sibling/child relative imports recursively through
// itself, with a cache so a diamond import graph loads each file once. Anything neither `zod` nor a
// relative specifier still throws loudly -- the files this loader is asked to load are expected to
// have no other external dependencies, and a new one appearing here is a real signal, not something
// to silently stub away.
function loadTypeScriptModule(sourcePath, cache = new Map()) {
  const resolvedPath = resolvePath(sourcePath);
  if (cache.has(resolvedPath)) return cache.get(resolvedPath);

  const source = readFileSync(resolvedPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  cache.set(resolvedPath, module.exports); // set before evaluating, in case of a real cycle
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'zod') return createZodStub();
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        return loadTypeScriptModule(resolveRelativeSpecifier(resolvedPath, specifier), cache);
      }
      throw new Error(`Unexpected test require from ${resolvedPath}: ${specifier}`);
    },
    Date,
    Map,
    Set,
    Math,
    Number,
    String,
    RegExp,
    JSON,
    Array,
    Object,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: resolvedPath });
  cache.set(resolvedPath, module.exports);
  return module.exports;
}

const themeBundle = loadTypeScriptModule(THEME_BUNDLE_SOURCE);
const adminLocales = loadTypeScriptModule(ADMIN_LOCALES_SOURCE);

test('storefront theme bundle localization resolves Hindi settings before render normalization', () => {
  const templateConfig = {
    locales: {
      en: {
        general: {
          announcement: 'Delivery across India',
        },
        sections: {
          hero: {
            heading: 'Launch your India store',
            cta: 'Shop now',
          },
        },
      },
      hi: {
        general: {
          announcement: 'पूरे भारत में डिलीवरी',
        },
        sections: {
          hero: {
            heading: 'अपना भारतीय स्टोर शुरू करें',
            cta: 'अभी खरीदें',
          },
        },
      },
    },
    config: {
      settings_data: {
        current: {
          announcementText: 't:general.announcement',
        },
      },
    },
    templates: {
      index: {
        sections: {
          hero: {
            type: 'hero-banner',
            settings: {
              heading: 't:sections.hero.heading',
              ctaText: 't:sections.hero.cta',
              badges: ['t:general.announcement', 'Cash on delivery'],
            },
          },
        },
        order: ['hero'],
      },
    },
    sections: {
      'hero-banner': {
        type: 'hero-banner',
        renderer_key: 'heroBanner',
      },
    },
  };

  const localized = themeBundle.localizeThemeTemplateConfig(templateConfig, 'hi-IN');
  const heroSettings = localized.templates.index.sections.hero.settings;

  assert.equal(heroSettings.heading, 'अपना भारतीय स्टोर शुरू करें');
  assert.equal(heroSettings.ctaText, 'अभी खरीदें');
  assert.equal(heroSettings.badges[0], 'पूरे भारत में डिलीवरी');
  assert.equal(localized.config.settings_data.current.announcementText, 'पूरे भारत में डिलीवरी');
});

test('theme localization falls back by language and then English', () => {
  const locales = {
    en: { sections: { hero: { heading: 'Launch your store' } } },
    ta: { sections: { hero: { heading: 'உங்கள் கடையை தொடங்குங்கள்' } } },
  };

  assert.equal(themeBundle.normalizeThemeLocale('ta_in'), 'ta-IN');
  assert.equal(
    themeBundle.resolveThemeTranslation(locales, 'ta-IN', 't:sections.hero.heading'),
    'உங்கள் கடையை தொடங்குங்கள்',
  );
  assert.equal(
    themeBundle.resolveThemeTranslation(locales, 'ml-IN', 't:sections.hero.heading'),
    'Launch your store',
  );
});

test('storefront render path selects locale and localizes bundle config', () => {
  const storeService = readFileSync(STOREFRONT_STORE_SERVICE_SOURCE, 'utf8');
  const storefrontRoute = readStorefrontRouteSource();

  assert.match(storeService, /resolveStorefrontThemePresentation\(rawTemplateConfig, appearanceSettings, themeId, storeLocale\)/);
  const presentationOwner = readFileSync('packages/theme-engine/src/index.ts', 'utf8');
  assert.match(presentationOwner, /localizeThemeTemplateConfig\(resolvedTemplateConfig, storeLocale\)/);
  const checkoutReader = readFileSync('services/api-gateway/src/lib/checkout-store-presentation.ts', 'utf8');
  assert.match(checkoutReader, /resolveStorefrontThemePresentation/);
  assert.match(checkoutReader, /row.locale\|\|'en-IN'/);
  assert.match(storeService, /locale: storeLocale/);
  assert.match(storefrontRoute, /currency,locale,theme_id/);
});

test('merchant admin exposes India locale scaffold and persists store locale', () => {
  const supportedCodes = adminLocales.SUPPORTED_ADMIN_LOCALES.map((locale) => locale.code);

  assert.deepEqual(
    ['en-IN', 'hi-IN', 'bn-IN', 'mr-IN', 'ta-IN', 'te-IN', 'kn-IN', 'gu-IN', 'ml-IN'].every((code) => supportedCodes.includes(code)),
    true,
  );
  assert.equal(adminLocales.normalizeAdminLocale('hi'), 'hi-IN');
  assert.equal(adminLocales.normalizeAdminLocale('te-IN'), 'te-IN');
  assert.equal(adminLocales.normalizeAdminLocale('fr-FR'), 'en-IN');
  assert.equal(adminLocales.ADMIN_I18N_NAMESPACES.includes('settings'), true);

  const settingsPage = readFileSync(ADMIN_SETTINGS_PAGE_SOURCE, 'utf8');
  const storesRoute = readFileSync(STORES_ROUTE_SOURCE, 'utf8');

  assert.match(settingsPage, /Storefront language/);
  assert.match(settingsPage, /locale: data\.locale/);
  assert.match(storesRoute, /'site_settings', 'logo_url', 'custom_domain', 'currency', 'locale'/);
});
