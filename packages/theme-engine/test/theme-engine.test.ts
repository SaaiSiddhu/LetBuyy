import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditThemeRendererRegistry,
  BUILT_IN_SECTION_SCHEMAS,
  BUILT_IN_SECTION_TYPES,
  collectBuiltInSectionSchemaGaps,
  migrateThemeTemplateSchemas,
  PreviewTokenSchema,
  SECTION_SCHEMAS,
  SaveThemeDraftSchema,
  THEME_SETTINGS_SCHEMA,
  collectThemeTemplateValidationIssues,
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

test('Wave 6 built-in theme registry exposes schemas for all 24 built-in section types', () => {
  assert.equal(BUILT_IN_SECTION_TYPES.length, 24);
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
