// L13 — Theme Authoring (engine: compile-on-publish + desync guard). The editor calls the L3 compiler to
// emit a Liquid bundle on publish/draft, and a guard blocks a portable-only publish over a Liquid store.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidThemePackageBundleSchema,
  compilePortableConfigForPublish,
  liquidBundlePublishWouldDesync,
} from '../src/index.ts';

const PORTABLE = {
  themeId: 'urban-kicks',
  themeSettings: { primaryColor: '#8B5CF6' },
  sections: {
    header: { type: 'header', settings: { storeName: 'Urban Kicks' } },
    template: [{ id: 'hero-1', type: 'heroBanner', settings: { heading: 'Edited heading' }, isVisible: true }],
    footer: { type: 'footer', settings: {} },
  },
};

test('L13: compile-on-publish emits a template_config patch with a schema-valid liquidBundle', () => {
  const { templateConfigPatch, warnings } = compilePortableConfigForPublish(PORTABLE);
  assert.equal(templateConfigPatch.rendererEngine, 'liquid');
  assert.equal(LiquidThemePackageBundleSchema.safeParse(templateConfigPatch.liquidBundle).success, true);
  // the merchant edit is carried into the compiled bundle
  assert.equal(templateConfigPatch.liquidBundle.templates.index.sections['hero-1'].settings.heading, 'Edited heading');
  assert.deepEqual(warnings, []);
});

test('L13: desync guard blocks a portable-only publish over a Liquid store', () => {
  const liquidStore = { liquidBundle: { any: true }, rendererEngine: 'liquid' };
  const portableOnly = { themeId: 'x', sections: {} };
  assert.equal(liquidBundlePublishWouldDesync(liquidStore, portableOnly), true);   // would strip -> BLOCK
});

test('L13: desync guard allows Liquid->Liquid and React->anything publishes', () => {
  const liquidStore = { liquidBundle: { any: true } };
  const liquidNext = compilePortableConfigForPublish(PORTABLE).templateConfigPatch;
  assert.equal(liquidBundlePublishWouldDesync(liquidStore, liquidNext), false);     // keeps the bundle -> OK
  assert.equal(liquidBundlePublishWouldDesync({ themeId: 'react' }, { themeId: 'react' }), false); // never had a bundle
});
