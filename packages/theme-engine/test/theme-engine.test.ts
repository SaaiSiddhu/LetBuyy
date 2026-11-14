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
  compilePortableToLiquidBundle,
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

// ============================================================================
// D1-A — linklists interface + scope passthrough
// ============================================================================

test('D1-A linklists key is in LiquidCommerceDrops and passes through toLiquidDrop into scope', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // toLiquidDrop requires keys matching /^[a-zA-Z][a-zA-Z0-9_]*$/ (security filter).
  // Shopify handles use hyphens (e.g. 'main-menu') but toLiquidDrop strips those.
  // LANE-B's navToLinklists helper must use underscore-safe handle keys (e.g. 'main_menu').
  // The test uses underscore keys to match what the sanitizer will pass through.
  const linklistBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'linklists-test': {
        path: 'sections/linklists-test.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-linklists-test">',
          '  {{ linklists.main_menu.title }}',
          '  {% if linklists.main_menu.links %}',
          '    {% for link in linklists.main_menu.links %}<a href="{{ link.url }}">{{ link.title }}</a>{% endfor %}',
          '  {% endif %}',
          '</section>',
          '{% schema %}{"name":"Linklists Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Linklists Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'll-test': {
            type: 'linklists-test',
            settings: {},
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['ll-test'],
      },
    },
  };

  // Note: toLiquidDrop strips keys with hyphens (security: /^[a-zA-Z][a-zA-Z0-9_]*$/).
  // LANE-B's navToLinklists must convert handle 'main-menu' -> 'main_menu' for safe drop access.
  const linklists = {
    main_menu: {
      handle: 'main_menu',
      title: 'Main Menu',
      links: [
        { title: 'Home', url: '/', active: false, links: [] },
        { title: 'Products', url: '/products', active: false, links: [] },
      ],
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: linklistBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    liquidContext: { linklists },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  // linklists.main-menu.title should appear in the rendered HTML
  assert.match(html, /Main Menu/, 'linklists title must render in scope');
  // nav links should also render
  assert.match(html, /href="\/products"/, 'linklists link url must render');
  assert.match(html, /Products/, 'linklists link title must render');
});

test('D1-A linklists falls back to empty object when not provided in liquidContext', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // A template that safely accesses linklists (it should be an empty object, not crash).
  const noLinkBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'linklists-empty': {
        path: 'sections/linklists-empty.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-linklists-empty">',
          '  {% if linklists %}ok{% else %}missing{% endif %}',
          '</section>',
          '{% schema %}{"name":"Linklists Empty","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Linklists Empty', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'll-empty': {
            type: 'linklists-empty',
            settings: {},
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['ll-empty'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: noLinkBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    // No liquidContext.linklists provided — must default to {} without crashing
  });

  assert.equal(result.status, 'rendered', `Expected rendered even without linklists. Warnings: ${result.warnings.join(', ')}`);
});

// ============================================================================
// D2 — settings drop resolves both flat and grouped key paths
// ============================================================================

test('D2 settings drop resolves both flat and grouped key paths', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // The minimal fixture has settings_schema with a 'colors' group containing 'primaryColor'.
  // Its settings_data.current is { primaryColor: '#00B3B3' }.
  // Build a section that renders both the flat key and the grouped key.
  const settingsBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'settings-test': {
        path: 'sections/settings-test.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-settings-test">',
          '  <span class="flat">{{ settings.primaryColor }}</span>',
          '  <span class="grouped">{{ settings.colors.primaryColor }}</span>',
          '</section>',
          '{% schema %}{"name":"Settings Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Settings Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'settings-sec': {
            type: 'settings-test',
            settings: {},
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['settings-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: settingsBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  // Both flat and grouped key paths must resolve to the same value (#00B3B3)
  assert.match(html, /<span class="flat">#00B3B3<\/span>/, 'flat settings.primaryColor must render');
  assert.match(html, /<span class="grouped">#00B3B3<\/span>/, 'grouped settings.colors.primaryColor must render');
});

test('D2 settings drop blocks credential-named keys (BLOCKED_DROP_KEYS)', async () => {
  // settings_data.current is merchant-writable passthrough JSON; credential-named keys written there
  // must never reach Liquid template scope, while legitimate settings keep rendering.
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const poisonedBundle = {
    ...bundle,
    config: {
      ...bundle.config,
      settings_data: {
        ...bundle.config.settings_data,
        current: {
          ...bundle.config.settings_data.current,
          api_key: 'dummy_sk_secret_must_never_render',
          webhook_secret: 'dummy_whsec_must_never_render',
        },
      },
    },
    sections: {
      ...bundle.sections,
      'settings-leak-test': {
        path: 'sections/settings-leak-test.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-settings-leak-test">',
          '  <span class="legit">{{ settings.primaryColor }}</span>',
          '  <span class="leak-a">{{ settings.api_key }}</span>',
          '  <span class="leak-b">{{ settings.webhook_secret }}</span>',
          '</section>',
          '{% schema %}{"name":"Settings Leak Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Settings Leak Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'settings-leak-sec': { type: 'settings-leak-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['settings-leak-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: poisonedBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  assert.match(html, /<span class="legit">#00B3B3<\/span>/, 'legitimate settings keys must still render');
  assert.doesNotMatch(html, /dummy_sk_secret_must_never_render/, 'settings.api_key must never reach Liquid output');
  assert.doesNotMatch(html, /dummy_whsec_must_never_render/, 'settings.webhook_secret must never reach Liquid output');
});

test('D2 settings drop with flat-only schema (no grouped settings wrapper) resolves flat keys correctly', async () => {
  // createUrbanKicksLiquidThemeBundleFixture has a settings_schema with a grouped 'settings' key.
  // Test a bundle with minimal flat-like schema to ensure flat keys still work.
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const flatBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'flat-test': {
        path: 'sections/flat-test.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-flat-test">{{ settings.primaryColor }}</section>',
          '{% schema %}{"name":"Flat Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Flat Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'flat-sec': { type: 'flat-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['flat-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: flatBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  assert.match(result.liquid?.contentForLayout ?? '', /#00B3B3/, 'flat key settings.primaryColor must still render');
});

// ============================================================================
// D6 — hero-banner Liquid section has image/overlay/height/textAlign schema fields
// ============================================================================

test('D6 hero-banner Liquid section has image, overlay, height, textAlign schema fields', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const heroBanner = bundle.sections['hero-banner'];
  assert.ok(heroBanner, 'hero-banner section must exist in Urban Kicks fixture');

  const settingIds = heroBanner.schema.settings.map((s) => s.id);
  assert.ok(settingIds.includes('image'), 'hero-banner must have image setting');
  assert.ok(settingIds.includes('overlay'), 'hero-banner must have overlay setting');
  assert.ok(settingIds.includes('height'), 'hero-banner must have height setting');
  assert.ok(settingIds.includes('textAlign'), 'hero-banner must have textAlign setting');
  // Existing fields must still be present
  assert.ok(settingIds.includes('heading'), 'hero-banner must keep heading setting');
  assert.ok(settingIds.includes('ctaText'), 'hero-banner must keep ctaText setting');

  // Verify schema types
  const overlaySetting = heroBanner.schema.settings.find((s) => s.id === 'overlay');
  assert.equal(overlaySetting?.type, 'range', 'overlay must be range type');
  assert.equal(overlaySetting?.default, 0.4, 'overlay default must be 0.4');

  const heightSetting = heroBanner.schema.settings.find((s) => s.id === 'height');
  assert.equal(heightSetting?.type, 'select', 'height must be select type');
  assert.deepEqual(heightSetting?.options, ['full', 'large', 'medium', 'small'], 'height must have correct options');

  const textAlignSetting = heroBanner.schema.settings.find((s) => s.id === 'textAlign');
  assert.equal(textAlignSetting?.type, 'select', 'textAlign must be select type');
  assert.deepEqual(textAlignSetting?.options, ['left', 'center', 'right'], 'textAlign must have correct options');
});

test('D6 hero-banner renders with image, overlay, height, textAlign settings', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  const heroBundle = {
    ...bundle,
    templates: {
      ...bundle.templates,
      index: {
        name: 'Home page',
        sections: {
          'hero-test': {
            type: 'hero-banner',
            settings: {
              heading: 'D6 Test Heading',
              image: 'https://example.com/hero-img.jpg',
              overlay: 0.6,
              height: 'large',
              textAlign: 'left',
              ctaText: 'Shop',
              ctaLink: '/products',
            },
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['hero-test'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: heroBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  assert.match(html, /data-height="large"/, 'rendered HTML must include data-height attribute');
  assert.match(html, /data-text-align="left"/, 'rendered HTML must include data-text-align attribute');
  assert.match(html, /data-image-url="https:\/\/example\.com\/hero-img\.jpg"/, 'rendered HTML must include data-image-url');
  assert.match(html, /D6 Test Heading/, 'rendered HTML must include heading text');
});

// ============================================================================
// D8 — BLOCKED_DROP_KEYS blocks api_key, secret_key, private_key, webhook_secret
// ============================================================================

test('D8 BLOCKED_DROP_KEYS blocks api_key, secret_key, private_key, webhook_secret', async () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // Build a section that tries to render all 4 blocked credential keys alongside a safe key.
  const blockedBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      'blocked-test': {
        path: 'sections/blocked-test.liquid',
        source: [
          '<section data-section-id="{{ section.id }}" class="lb-blocked-test">',
          '  <span class="safe">{{ product.safe_field }}</span>',
          '  <span class="api">{{ product.api_key }}</span>',
          '  <span class="secret">{{ product.secret_key }}</span>',
          '  <span class="private">{{ product.private_key }}</span>',
          '  <span class="webhook">{{ product.webhook_secret }}</span>',
          '</section>',
          '{% schema %}{"name":"Blocked Test","settings":[],"blocks":[],"presets":[]}{% endschema %}',
        ].join('\n'),
        schema: { name: 'Blocked Test', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'blocked-sec': { type: 'blocked-test', settings: {}, blocks: {}, block_order: [], disabled: false },
        },
        order: ['blocked-sec'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: blockedBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    // liquidContext.product has all 4 blocked keys plus a safe field
    liquidContext: {
      product: {
        safe_field: 'VISIBLE',
        api_key: 'dummy_sk_secret_api_key_do_not_expose',
        secret_key: 'dummy_secret_key_do_not_expose',
        private_key: 'dummy_private_key_do_not_expose',
        webhook_secret: 'dummy_whsec_do_not_expose',
      },
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  // Safe field must appear
  assert.match(html, /VISIBLE/, 'safe field must render in scope');
  // None of the blocked key values must appear in rendered output
  assert.doesNotMatch(html, /dummy_sk_secret_api_key_do_not_expose/, 'api_key value must be blocked');
  assert.doesNotMatch(html, /dummy_secret_key_do_not_expose/, 'secret_key value must be blocked');
  assert.doesNotMatch(html, /dummy_private_key_do_not_expose/, 'private_key value must be blocked');
  assert.doesNotMatch(html, /dummy_whsec_do_not_expose/, 'webhook_secret value must be blocked');
});

// ============================================================================
// D9 — contentPage aliases resolve to rich-content at both compile and render time
// ============================================================================

test('D9 LIQUID_SECTION_TYPE_ALIASES resolves contentPage and content-page to rich-content', () => {
  assert.equal(LIQUID_SECTION_TYPE_ALIASES['contentPage'], 'rich-content', "contentPage must resolve to rich-content");
  assert.equal(LIQUID_SECTION_TYPE_ALIASES['content-page'], 'rich-content', "content-page must resolve to rich-content");
  // Existing aliases must still work
  assert.equal(LIQUID_SECTION_TYPE_ALIASES['newsletter'], 'newsletter-signup', "newsletter alias unchanged");
});

test('D9 contentPage alias resolves to rich-content at render time', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // Verify rich-content section exists in the bundle
  assert.ok(bundle.sections['rich-content'], 'rich-content section must exist in Urban Kicks fixture');

  // Set up a template where section type is 'content-page' — the alias must redirect to 'rich-content'.
  // The bundle schema requires each template section.type to exist in bundle.sections.
  // We add a 'content-page' dummy section (valid lowercase key) to satisfy schema validation.
  // The alias maps 'content-page' -> 'rich-content' at render time, bypassing the dummy file.
  const DUMMY_CONTENT = 'lb-content-page-KEBAB-ALIAS-DUMMY';
  const aliasBundle = {
    ...bundle,
    sections: {
      ...bundle.sections,
      // 'content-page' is a valid lowercase key and path (passes bundle schema validation).
      // The render-time alias redirects to 'rich-content' so this dummy source must NOT appear in output.
      'content-page': {
        path: 'sections/content-page.liquid',
        source: `<section class="${DUMMY_CONTENT}" data-section-id="{{ section.id }}"></section>\n{% schema %}{"name":"Content Page Dummy","settings":[],"blocks":[],"presets":[]}{% endschema %}`,
        schema: { name: 'Content Page Dummy', settings: [], blocks: [], presets: [] },
      },
    },
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'content-only': {
            type: 'content-page',
            settings: { title: 'About Us' },
            blocks: {},
            block_order: [],
            disabled: false,
          },
        },
        order: ['content-only'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'test-store', path: '/pages/about', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
    liquidBundle: aliasBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `content-page alias must resolve and render; got ${result.status}. Warnings: ${result.warnings.join(', ')}`);
  // The alias must have used rich-content, so the dummy file content must NOT appear
  assert.ok(
    !result.liquid?.contentForLayout.includes(DUMMY_CONTENT),
    'dummy content-page content must NOT appear — alias must have used rich-content',
  );
  // The rich-content section's class must appear in the output
  assert.match(
    result.liquid?.contentForLayout ?? '',
    /lb-rich-content/,
    'rich-content HTML must appear in output after content-page alias resolution',
  );
});

test('D9 compilePortableToLiquidBundle maps contentPage to rich-content at compile time', () => {
  const result = compilePortableToLiquidBundle({
    sections: {
      template: [
        {
          id: 'page-section',
          type: 'contentPage',
          settings: { title: 'About Us' },
          isVisible: true,
        },
      ],
    },
  });
  // Must compile without errors (the contentPage type maps to rich-content which exists in the base bundle)
  assert.equal(result.warnings.length, 0, `contentPage must compile without warnings. Got: ${result.warnings.join(', ')}`);
  // The compiled template must contain a rich-content section type
  const indexSections = result.bundle.templates.index?.sections ?? {};
  const sectionEntries = Object.values(indexSections);
  assert.ok(
    sectionEntries.some((s) => s.type === 'rich-content'),
    'compiled template must have a rich-content section (mapped from contentPage)',
  );
});
