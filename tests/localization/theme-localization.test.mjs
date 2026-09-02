import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const THEME_BUNDLE_SOURCE = 'packages/theme-engine/src/theme-bundle.ts';
const ADMIN_LOCALES_SOURCE = 'apps/merchant_web/src/lib/i18n/admin-locales.ts';
const STOREFRONT_STORE_SERVICE_SOURCE = 'apps/customer_web/src/lib/store-service.ts';
const ADMIN_SETTINGS_PAGE_SOURCE = 'apps/merchant_web/src/app/[store]/settings/general/page.tsx';
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

function loadTypeScriptModule(sourcePath) {
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'zod') return createZodStub();
      throw new Error(`Unexpected test require from ${sourcePath}: ${specifier}`);
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

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
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

  assert.match(storeService, /localizeThemeTemplateConfig\(resolvedTemplateConfig, storeLocale\)/);
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
