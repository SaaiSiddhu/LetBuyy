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
  LIQUID_SECTION_TYPE_ALIASES,
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

// ============================================================================
// C1 — Liquid crash recovery tests
// ============================================================================

test('C1 section crash isolation: one bad section does not crash the page; valid section renders', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();
  // Inject one valid section and one section whose source has invalid Liquid (unclosed tag).
  // ThemeLiquidSectionSchema is strict: requires name, settings (array), blocks (array), presets (array).
  // Source must contain {% schema %} and {% endschema %} to pass ThemeLiquidSectionFileSchema.
  const BAD_SECTION_SOURCE = '{% if unclosed\n{% schema %}{"name":"Bad Section","settings":[],"blocks":[],"presets":[]}{% endschema %}';
  const badBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'bad-section': {
        path: 'sections/bad-section.liquid',
        schema: { name: 'Bad Section', settings: [], blocks: [], presets: [] },
        source: BAD_SECTION_SOURCE,
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          spotlight: bundle.templates.index.sections.spotlight,
          'bad-one': {
            type: 'bad-section',
            settings: {},
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['spotlight', 'bad-one'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: badBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered, got ${result.status}. Warnings: ${result.warnings.join(', ')}`);
  assert.ok(result.warnings.some((w) => w.includes('bad-one') || w.includes('bad-section')), 'warnings must mention the failing section');
  // The valid spotlight section content should appear
  assert.ok(result.liquid?.contentForLayout.includes('lb-first-party-spotlight') || result.liquid?.contentForLayout.includes('spotlight'), 'valid section HTML must appear in output');
  // The placeholder for the broken section must appear
  assert.ok(result.liquid?.contentForLayout.includes('lb:section-error'), 'broken section must emit an error placeholder comment');
});

test('C1 all sections fail: renderer returns error status when every section is broken', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();
  const BAD_SOURCE_A = '{% if unclosed\n{% schema %}{"name":"Bad A","settings":[],"blocks":[],"presets":[]}{% endschema %}';
  const BAD_SOURCE_B = '{% for unclosed\n{% schema %}{"name":"Bad B","settings":[],"blocks":[],"presets":[]}{% endschema %}';
  const badBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'bad-a': { path: 'sections/bad-a.liquid', schema: { name: 'Bad A', settings: [], blocks: [], presets: [] }, source: BAD_SOURCE_A },
      'bad-b': { path: 'sections/bad-b.liquid', schema: { name: 'Bad B', settings: [], blocks: [], presets: [] }, source: BAD_SOURCE_B },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'fail-1': { type: 'bad-a', settings: {}, blocks: {}, block_order: [], disabled: false },
          'fail-2': { type: 'bad-b', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['fail-1', 'fail-2'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: badBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'error', `Expected error status when all sections fail, got ${result.status}`);
  assert.equal(result.liquid, undefined, 'liquid output must be undefined when status is error');
});

test('C1 layout crash: renderer returns error status when layout template is broken', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();
  const brokenLayoutBundle = {
    ...bundle,
    layout: {
      theme: {
        path: bundle.layout.theme.path,
        source: '{% if unclosed',
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: brokenLayoutBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'error', `Expected error status when layout fails, got ${result.status}`);
  assert.equal(result.liquid, undefined, 'liquid must be undefined when layout crashes');
  assert.ok(result.warnings.some((w) => w.includes('layout')), 'warning must mention the layout failure');
});

test('C1 block crash isolation: bad block source does not crash the enclosing section', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();
  // The spotlight section in the minimal fixture accepts 'badge' and '@app' block types.
  // The 'badge' block in the fixture is a reusable block (bundle.blocks.badge).
  // We replace the badge block source with invalid Liquid to trigger a block-level crash.
  // The section should still render — the block gets empty html instead of crashing.
  const badBlockBundle = {
    ...bundle,
    blocks: {
      ...bundle.blocks,
      badge: {
        // Keep the same path and schema as the original badge block, but corrupt the source.
        path: bundle.blocks.badge.path,
        schema: bundle.blocks.badge.schema,
        source: '{% if unclosed tag that crashes liquidjs',
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: badBlockBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  // The section must still render (block error is non-fatal)
  assert.notEqual(result.status, 'error', `Section must survive a bad block render. Warnings: ${result.warnings.join(', ')}`);
  // The valid section structure (spotlight) should appear in output
  assert.ok(result.liquid?.contentForLayout, 'contentForLayout must not be empty despite block error');
  // The section's own HTML (lb-spotlight or lb-first-party-spotlight class) must appear
  assert.ok(
    result.liquid?.contentForLayout.includes('lb-spotlight') || result.liquid?.contentForLayout.includes('spotlight'),
    'section structure must appear even when a block fails',
  );
});

// ============================================================================
// C4 — Newsletter render-time alias tests
// ============================================================================

test('C4 LIQUID_SECTION_TYPE_ALIASES constant is exported and correct', () => {
  assert.equal(LIQUID_SECTION_TYPE_ALIASES['newsletter'], 'newsletter-signup', "newsletter must resolve to newsletter-signup");
  assert.equal(LIQUID_SECTION_TYPE_ALIASES['newsletter-signup'], 'newsletter-signup', "newsletter-signup must be idempotent");
});

test('C4 newsletter alias resolves at render time for bundles with type "newsletter" in section data', async () => {
  // The Urban Kicks fixture has 'newsletter-signup' in bundle.sections.
  // We test the render-time alias by:
  //   1. Adding a 'newsletter' section file to the bundle so schema validation passes.
  //   2. Setting the template section type to 'newsletter' (the React schema name).
  //   3. Verifying the alias resolves to 'newsletter-signup' and renders its content.
  // The 'newsletter' section file has distinct content (no lb-newsletter-signup class) so we can
  // confirm that the alias redirected to 'newsletter-signup' rather than using the 'newsletter' file.
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  assert.ok(bundle.sections['newsletter-signup'], 'fixture must have newsletter-signup section file');

  // A minimal valid section file for the 'newsletter' key — just enough to pass schema validation.
  // Its output is distinct: it uses class "lb-newsletter-REACT-ALIAS-DUMMY" so we can detect
  // if the alias accidentally used THIS file instead of the newsletter-signup file.
  const DUMMY_CONTENT = 'lb-newsletter-REACT-ALIAS-DUMMY';
  const aliasBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      // Add 'newsletter' key to satisfy schema validation (templates can reference it).
      // The render-time alias must override this lookup and use 'newsletter-signup' instead.
      'newsletter': {
        path: 'sections/newsletter.liquid',
        source: `<section class="${DUMMY_CONTENT}" data-section-id="{{ section.id }}"></section>\n{% schema %}{"name":"Newsletter (react alias)","settings":[],"blocks":[],"presets":[]}{% endschema %}`,
        schema: { name: 'Newsletter (react alias)', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'newsletter-only': {
            type: 'newsletter', // React/schema type name — alias must resolve this to 'newsletter-signup'
            settings: { title: 'Subscribe', subtitle: 'Get drops first', buttonLabel: 'Join' },
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['newsletter-only'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: aliasBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Newsletter alias must resolve and render; got ${result.status}. Warnings: ${result.warnings.join(', ')}`);

  // The alias must have redirected the lookup to 'newsletter-signup', so the real section's class appears.
  assert.ok(
    result.liquid?.contentForLayout.includes('lb-newsletter-signup'),
    `newsletter-signup section HTML must appear in output (alias redirected correctly). Content: ${result.liquid?.contentForLayout?.slice(0, 500)}`,
  );

  // The dummy 'newsletter' file content must NOT appear (the alias bypassed it).
  assert.ok(
    !result.liquid?.contentForLayout.includes(DUMMY_CONTENT),
    `dummy newsletter content must NOT appear — alias must have used newsletter-signup instead`,
  );
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
