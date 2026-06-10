import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditThemeRendererRegistry,
  BUILT_IN_SECTION_SCHEMAS,
  BUILT_IN_SECTION_TYPES,
  collectBuiltInSectionSchemaGaps,
  DEFAULT_THEME_SETTINGS,
  migrateThemeTemplateSchemas,
  PreviewTokenSchema,
  SECTION_SCHEMAS,
  SaveThemeDraftSchema,
  THEME_SETTINGS_SCHEMA,
  THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION,
  THEME_LIQUID_PORTABLE_SECTION_PARITY,
  collectLiquidPortableSectionParityGaps,
  collectThemeTemplateValidationIssues,
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  LiquidRenderer,
  resolveThemeLiquidRenderingEnabled,
  sanitizeRenderedHtml,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

test('theme draft and preview contracts require template scope and bounded TTL/version data', () => {
  assert.deepEqual(PreviewTokenSchema.parse({ store_id: STORE_ID }), {
    store_id: STORE_ID,
    template_key: 'index',
    ttl_seconds: 900,
  });
  assert.equal(PreviewTokenSchema.safeParse({ store_id: STORE_ID, template_key: '../index' }).success, false);
  assert.equal(PreviewTokenSchema.safeParse({ store_id: STORE_ID, ttl_seconds: 59 }).success, false);
  assert.equal(SaveThemeDraftSchema.safeParse({
    store_id: STORE_ID,
    template_key: 'product',
    template_config: {},
    base_version: 0,
  }).success, false);
});

test('theme template validation rejects unsafe JSON keys, unknown sections, and unsafe URLs', () => {
  const issues = collectThemeTemplateValidationIssues({
    themeSlug: 'urban-kicks',
    runtime: {
      sectionSchemas: SECTION_SCHEMAS,
      settingsSchema: THEME_SETTINGS_SCHEMA,
    },
    templateConfig: {
      themeId: 'urban-kicks',
      sections: {
        header: {
          id: 'header',
          type: 'header',
          visible: true,
          settings: {},
        },
        template: [{
          id: 'hero',
          type: 'heroBanner',
          visible: true,
          settings: {
            heading: 'Launch',
            ctaLink: 'javascript:alert(1)',
            unknownSetting: true,
          },
        }, {
          id: 'unknown',
          type: 'thirdPartyUpload',
          visible: true,
          settings: {},
        }],
      },
      themeSettings: {
        primaryColor: '#00B3B3',
        onclick: 'alert(1)',
      },
    },
  });

  assert.ok(issues.some((issue) => issue.includes('ctaLink contains an unsafe URL protocol')));
  assert.ok(issues.some((issue) => issue.includes('unknownSetting is not defined')));
  assert.ok(issues.some((issue) => issue.includes('thirdPartyUpload')));
  assert.ok(issues.some((issue) => issue.includes('themeSettings.onclick is not allowed')));
});

test('Wave 6 built-in theme registry exposes schemas for all 25 built-in section types', () => {
  assert.equal(BUILT_IN_SECTION_TYPES.length, 25);
  assert.deepEqual(collectBuiltInSectionSchemaGaps(), []);

  for (const sectionType of BUILT_IN_SECTION_TYPES) {
    const schema = BUILT_IN_SECTION_SCHEMAS[sectionType];
    assert.equal(schema.type, sectionType);
    assert.ok(schema.name.length > 0, `${sectionType} must have a name`);
    assert.ok(schema.description.length > 0, `${sectionType} must have a description`);
    assert.ok(schema.settings_schema, `${sectionType} must have settings schema`);
  }
});

test('Wave 6 renderer registry validation starts in WARN mode and can enforce after mismatches are resolved', () => {
  const templateConfig = {
    themeId: 'urban-kicks',
    themeSettings: {
      primaryColor: '#00B3B3',
      secondaryColor: '#008080',
      accentColor: '#A4E500',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A2E',
      fontFamily: 'Inter',
      headingFontFamily: 'Inter',
      borderRadius: 12,
      enableAnimations: true,
      enableShadows: true,
    },
    sections: [{
      id: 'unknown-saved-section',
      type: 'partnerUpload',
      order: 10,
      rendererKey: 'partner.upload',
      schemaVersion: 'legacy',
      settings: {},
      isVisible: true,
    }],
  };

  const warnAudit = auditThemeRendererRegistry({ templateConfig });
  assert.equal(warnAudit.mode, 'warn');
  assert.equal(warnAudit.status, 'warn');
  assert.equal(warnAudit.unresolvedCount, 1);
  assert.equal(warnAudit.errors.length, 0);
  assert.ok(warnAudit.warnings[0]?.message.includes('not registered'));

  const enforceAudit = auditThemeRendererRegistry({ templateConfig, mode: 'enforce' });
  assert.equal(enforceAudit.status, 'fail');
  assert.equal(enforceAudit.errors.length, 1);

  const resolvedAudit = auditThemeRendererRegistry({
    templateConfig: {
      ...templateConfig,
      sections: [{
        id: 'hero',
        type: 'heroBanner',
        order: 10,
        rendererKey: 'core.hero',
        schemaVersion: '2026-06',
        settings: {},
        isVisible: true,
      }],
    },
    approvedRendererKeys: ['core.hero'],
    mode: 'enforce',
  });
  assert.equal(resolvedAudit.status, 'pass');
});

test('Wave 6 schema migration runner migrates existing saved store sections', () => {
  const result = migrateThemeTemplateSchemas({
    templateConfig: {
      themeId: 'urban-kicks',
      themeSettings: {
        primaryColor: '#00B3B3',
        secondaryColor: '#008080',
        accentColor: '#A4E500',
        backgroundColor: '#FFFFFF',
        textColor: '#1A1A2E',
        fontFamily: 'Inter',
        headingFontFamily: 'Inter',
        borderRadius: 12,
        enableAnimations: true,
        enableShadows: true,
      },
      sections: [{
        id: 'legacy-hero',
        type: 'heroBanner',
        order: 10,
        schemaVersion: '2026-05',
        settings: {
          title: 'Legacy heading',
          ctaText: 'Shop',
        },
        isVisible: true,
      }],
    },
    migrations: [{
      sectionType: 'heroBanner',
      fromVersion: '2026-05',
      toVersion: '2026-06',
      migrateSettings: (settings) => ({
        ...settings,
        heading: settings.heading || settings.title,
        title: undefined,
      }),
    }],
  });

  assert.equal(result.applied.length, 1);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.templateConfig.sections[0]?.schemaVersion, '2026-06');
  assert.equal(result.templateConfig.sections[0]?.settings.heading, 'Legacy heading');
});

test('D7 Liquid rendering stays per-theme canary and records platform-wide flip as deferred', () => {
  const templateConfig = {
    themeId: 'urban-kicks-liquid',
    themeSettings: DEFAULT_THEME_SETTINGS,
    sections: [],
  };

  assert.equal(resolveThemeLiquidRenderingEnabled({ templateConfig }), false);
  assert.equal(resolveThemeLiquidRenderingEnabled({
    templateConfig: {
      ...templateConfig,
      liquidRenderingCanary: true,
    },
  }), true);
  assert.equal(resolveThemeLiquidRenderingEnabled({
    templateConfig: {
      ...templateConfig,
      releaseManifest: {
        liquidCanary: {
          enabled: true,
          scope: 'theme',
        },
      },
    },
  }), true);
  assert.equal(THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status, 'deferred');
  assert.equal(THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.defaultEnabled, false);
});

test('D7 first-party Liquid bundle has parity section files for the frozen React section set', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const gaps = collectLiquidPortableSectionParityGaps(Object.keys(bundle.sections));

  assert.equal(THEME_LIQUID_PORTABLE_SECTION_PARITY.length, 20);
  assert.deepEqual(gaps, []);

  for (const entry of THEME_LIQUID_PORTABLE_SECTION_PARITY) {
    const section = bundle.sections[entry.liquidSectionType];
    assert.ok(section, `${entry.liquidSectionType} must exist for ${entry.reactFile}`);
    assert.equal(section.path, `sections/${entry.liquidSectionType}.liquid`);
    assert.match(section.source, /\{%\s*schema\s*%\}/);
  }
});

test('D7 DOMPurify sanitizer preserves Liquid hydration elements while removing active content', async () => {
  const sanitized = await sanitizeRenderedHtml([
    '<section data-theme-renderer="liquid">',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)" onclick="alert(1)">bad link</a>',
    '<lb-add-to-cart data-lb-island="add-to-cart" data-product-id="prod_1" onclick="alert(1)">',
    '<button type="button" data-lb-add-to-cart>Add</button>',
    '<span data-lb-add-to-cart-status aria-live="polite"></span>',
    '</lb-add-to-cart>',
    '</section>',
  ].join(''));

  assert.match(sanitized, /lb-add-to-cart/);
  assert.match(sanitized, /data-lb-add-to-cart/);
  assert.doesNotMatch(sanitized, /<script/i);
  assert.doesNotMatch(sanitized, /onclick=/i);
  assert.doesNotMatch(sanitized, /javascript:/i);
});

test('D7 Liquid renderer auto-escapes merchant settings before sanitized raw block HTML is inserted', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: {
      storeId: STORE_ID,
      subdomain: 'local-kicks',
      path: '/',
      previewMode: true,
      locale: 'en',
    },
    storeTemplate: {
      storeId: STORE_ID,
      themeId: 'liquid-starter',
      themeSettings: DEFAULT_THEME_SETTINGS,
      sections: [],
    },
    routeTemplate: {
      id: 'index',
      type: 'index',
      layoutKey: 'theme',
      sections: [],
    },
    liquidBundle: {
      ...bundle,
      templates: {
        ...bundle.templates,
        index: {
          ...bundle.templates.index,
          sections: {
            ...bundle.templates.index.sections,
            spotlight: {
              ...bundle.templates.index.sections.spotlight,
              settings: {
                ...bundle.templates.index.sections.spotlight.settings,
                heading: '<img src=x onerror=alert(1)>',
              },
              blocks: {
                first_badge: {
                  type: 'badge',
                  settings: {
                    label: '<strong onclick="alert(1)">Trusted</strong>',
                  },
                },
              },
              block_order: ['first_badge'],
            },
          },
        },
      },
    },
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml || '';
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /<[^>]+onclick=/i);
  assert.doesNotMatch(html, /<[^>]+onerror=/i);
  assert.doesNotMatch(html, /<script/i);
});
