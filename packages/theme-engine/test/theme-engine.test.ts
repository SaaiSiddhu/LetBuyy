import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
