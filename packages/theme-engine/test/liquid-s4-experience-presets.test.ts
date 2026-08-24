// S4 / S4-FIX — The 10 Presets, Portable. Behavioral proof that:
//   W1: every key an EMITTED PRESET carries is declared in settings_schema.json (the exact class
//       of failure migration 193's header documents: an undeclared key makes the theme editor
//       reject the settings) — zero exclusions. buildExperienceSettingsOverlay's own output is
//       separately proven unchanged: the React-only fontFamily alias is filtered at the bundle
//       EMISSION boundary (buildLiquidThemeExperiencePresets), never from the shared overlay
//       function itself (Defect 1).
//   W2: settings_data.json carries exactly the 10 Experiences as real theme presets, generated
//       from EXPERIENCE_REGISTRY (theme-presets.ts) — not hand-invented — and never carries
//       content/SEO settings. A DRIFT GUARD fails (with an actionable message naming the
//       generator command) if the registry/schema and the committed example JSON disagree
//       (Defect 3).
//   W3: settings_data.presets is the SINGLE SOURCE the editor's picker and apply path read —
//       resolveExperiencePresetItems() resolves it, enriched by name lookup against the registry
//       for display copy only; a bundle preset absent from the registry still renders, a registry
//       Experience absent from the bundle does not; applying preserves content/SEO; A-then-B lands
//       cleanly on B; a theme with zero presets fails soft, not blank (Defect 2).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  createUrbanKicksLiquidThemeBundleFixture,
  LiquidThemePackageBundleSchema,
} from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import {
  EXPERIENCE_REGISTRY,
  listExperiences,
  buildExperienceSettingsOverlay,
  applyExperienceToTemplateConfig,
  resolveExperiencePresetItems,
} from '../src/theme-presets.ts';

const EXPERIENCE_NAMES = listExperiences().map((e) => e.name);
const CONTENT_SEO_KEYS = ['metaDescription', 'socialImageUrl', 'faviconUrl'];

function declaredSchemaKeys(bundle: ReturnType<typeof createLetbuyyCoreLiquidThemeBundleFixture>): Set<string> {
  const keys = new Set<string>();
  for (const group of Object.values(bundle.config.settings_schema.settings)) {
    for (const key of Object.keys((group as { fields: Record<string, unknown> }).fields)) keys.add(key);
  }
  return keys;
}

function readAppFile(relativeFromTestDir: string): string {
  return readFileSync(new URL(relativeFromTestDir, import.meta.url), 'utf8');
}

// ─── W1 / Defect 1: zero undeclared keys in any emitted preset, no exclusions ─────────────────

test('Defect 1: zero undeclared keys in any emitted preset — no exclusions (the exact failure class migration 193 recorded)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const declared = declaredSchemaKeys(bundle);
  const missing: string[] = [];
  for (const [name, preset] of Object.entries(bundle.config.settings_data.presets)) {
    for (const key of Object.keys(preset as object)) {
      if (!declared.has(key)) missing.push(`${name}.${key}`);
    }
  }
  assert.deepEqual(missing, [], `undeclared keys would make the editor reject these presets: ${missing.join(', ')}`);
});

test('Defect 1: buildExperienceSettingsOverlay itself is UNCHANGED — still emits all 10 keys including the React-only fontFamily alias', () => {
  for (const experience of listExperiences()) {
    const overlay = buildExperienceSettingsOverlay(experience);
    assert.equal(Object.keys(overlay).length, 10, `${experience.id}: overlay must still carry all 10 keys`);
    assert.equal(overlay.fontFamily, experience.tokens.fontFamily);
    assert.equal(overlay.bodyFontFamily, experience.tokens.fontFamily);
  }
});

test('W1: secondaryColor, backgroundColor, textColor and borderRadius are declared (the four the phase named as blocking)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const declared = declaredSchemaKeys(bundle);
  for (const key of ['secondaryColor', 'backgroundColor', 'textColor', 'borderRadius']) {
    assert.ok(declared.has(key), `${key} must be declared in settings_schema.json`);
  }
});

test('W1: color fields use type "color" (this bundle\'s own pre-existing convention), not migration 197\'s "text" — documented divergence, not silent drift', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const colors = bundle.config.settings_schema.settings.colors as { fields: Record<string, { type: string }> };
  for (const key of ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor', 'surfaceColor']) {
    assert.equal(colors.fields[key]?.type, 'color', `${key} must stay type "color" for a consistent color-picker UI`);
  }
});

test('W1: borderRadius converges on migration 197\'s type ("number")', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const appearance = bundle.config.settings_schema.settings.appearance as { fields: Record<string, { type: string }> };
  assert.equal(appearance.fields.borderRadius?.type, 'number');
});

test('W1: isDark/enableShadows/enableAnimations are deliberately NOT declared (no Experience references them — full 13-field convergence was out of scope)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const declared = declaredSchemaKeys(bundle);
  for (const key of ['isDark', 'enableShadows', 'enableAnimations']) {
    assert.equal(declared.has(key), false, `${key} should not be declared — no preset drives a real value into it`);
  }
});

// ─── W2: the 10 presets, generated, correct values, no content leak ───────────────────────────

test('W2: settings_data.json carries exactly 10 presets, named for the 10 Experiences', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const presetNames = Object.keys(bundle.config.settings_data.presets);
  assert.equal(presetNames.length, 10, 'Shopify caps a theme at 5 — LetBuyy keeps all 10, not trimmed');
  assert.deepEqual(new Set(presetNames), new Set(EXPERIENCE_NAMES));
});

for (const experience of listExperiences()) {
  test(`W2: preset "${experience.name}" equals buildExperienceSettingsOverlay(${experience.id}) filtered to declared schema keys (fontFamily dropped, nothing else changed)`, () => {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    const declared = declaredSchemaKeys(bundle);
    const preset = bundle.config.settings_data.presets[experience.name] as Record<string, unknown>;
    const overlay = buildExperienceSettingsOverlay(experience);
    const expected: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(overlay)) {
      if (declared.has(key)) expected[key] = value;
    }
    assert.deepEqual(preset, expected);
    assert.equal(Object.prototype.hasOwnProperty.call(preset, 'fontFamily'), false, 'the preset must not carry the undeclared fontFamily key');
    assert.equal(preset.bodyFontFamily, experience.tokens.fontFamily);
  });
}

test('W2: no preset carries metaDescription, socialImageUrl or faviconUrl — presets are presentational only', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  for (const [name, preset] of Object.entries(bundle.config.settings_data.presets)) {
    for (const key of CONTENT_SEO_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(preset as object, key), false, `preset "${name}" must not carry "${key}"`);
    }
  }
});

test('W2: settings_data.json parses and validates against the full bundle schema (LiquidThemePackageBundleSchema)', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const result = LiquidThemePackageBundleSchema.safeParse(bundle);
  assert.equal(result.success, true, result.success ? undefined : JSON.stringify(result.error.issues, null, 2));
});

// Defect 3 — drift guard. Fails "edited the registry, forgot to regenerate" loudly instead of
// letting it go silent, the same failure shape as tenant-table registry drift: names the exact
// fix command in the assertion message so a red run tells you what to run, not just what's wrong.
test('DRIFT GUARD (Defect 3): settings_data.presets (committed) matches the current EXPERIENCE_REGISTRY + declared schema', () => {
  const live = createLetbuyyCoreLiquidThemeBundleFixture();
  const livePresets = live.config.settings_data.presets;
  const liveNames = Object.keys(livePresets);
  assert.equal(liveNames.length, 10, `EXPERIENCE_REGISTRY must resolve to exactly 10 presets, found ${liveNames.length}`);
  assert.deepEqual(new Set(liveNames), new Set(EXPERIENCE_NAMES), 'every preset name must match a live Experience name');

  const committedPath = new URL('../examples/letbuyy-core-liquid/files/config/settings_data.json', import.meta.url);
  const committed = JSON.parse(readFileSync(committedPath, 'utf8'));
  assert.deepEqual(
    committed.presets,
    livePresets,
    'committed settings_data.json presets no longer match theme-presets.ts + theme-bundle.ts — '
      + 'the registry (or its declared schema) changed without regenerating the example bundles. '
      + 'Run: node --import tsx/esm packages/theme-engine/examples/generate-examples.mjs',
  );
});

test('W2: urban-kicks gets the same 10 presets (deliberate — see theme-bundle.ts comment; both bundles derive from one shared object literal)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const presetNames = Object.keys(bundle.config.settings_data.presets);
  assert.equal(presetNames.length, 10);
  assert.deepEqual(new Set(presetNames), new Set(EXPERIENCE_NAMES));
});

test('W2: files/sections and files/blocks remain byte-identical between the two bundles (config/ legitimately differs; sections/blocks must not)', () => {
  const core = readFileSync(new URL('../examples/letbuyy-core-liquid/files/sections/hero-banner.liquid', import.meta.url), 'utf8');
  const urban = readFileSync(new URL('../examples/urban-kicks-liquid/files/sections/hero-banner.liquid', import.meta.url), 'utf8');
  assert.equal(core, urban);
});

// ─── W3 / Defect 2: settings_data.presets is the single source the editor reads ───────────────

test('Defect 2: resolveExperiencePresetItems sources its list from the bundle presets, not the registry — a preset with no matching registry Experience still resolves', () => {
  const bundlePresets = {
    Forge: buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.forge),
    'Merchant Custom': { primaryColor: '#112233', secondaryColor: '#445566', borderRadius: 4 },
  };
  const items = resolveExperiencePresetItems(bundlePresets);
  const names = items.map((item) => item.name);
  assert.ok(names.includes('Forge'));
  assert.ok(names.includes('Merchant Custom'));
  const custom = items.find((item) => item.name === 'Merchant Custom');
  assert.ok(custom);
  assert.equal(custom?.description, 'A saved preset from this theme.');
  assert.deepEqual(custom?.swatches, ['#112233', '#445566']);
  assert.equal(custom?.sectionCount, null);
});

test('Defect 2: a registry Experience absent from the bundle presets does not appear in the resolved list', () => {
  const bundlePresets = { Forge: buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.forge) };
  const items = resolveExperiencePresetItems(bundlePresets);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Forge');
  assert.equal(items.some((item) => item.name === 'Bloom'), false, 'Bloom is a real registry Experience but was not in bundlePresets — must not appear');
});

test('Defect 2: a resolved preset\'s `values` come from the BUNDLE, not recomputed from the live registry token', () => {
  const staleForgeValues: Record<string, unknown> = { ...buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.forge) };
  delete staleForgeValues.fontFamily; // as a real post-Defect-1-filter bundle preset would have it
  staleForgeValues.primaryColor = '#ABCDEF';
  const items = resolveExperiencePresetItems({ Forge: staleForgeValues });
  const forgeItem = items.find((item) => item.name === 'Forge');
  assert.ok(forgeItem);
  assert.equal(forgeItem?.values.primaryColor, '#ABCDEF', 'values must come from the bundle preset, not the live registry token');
  assert.notEqual(forgeItem?.values.primaryColor, EXPERIENCE_REGISTRY.forge.tokens.primaryColor);
});

test('Defect 2: a resolved preset\'s values never carry content/SEO keys, including registry-unmatched presets', () => {
  const bundlePresets = {
    Forge: buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.forge),
    'Merchant Custom': { primaryColor: '#112233' },
  };
  const items = resolveExperiencePresetItems(bundlePresets);
  for (const item of items) {
    for (const key of CONTENT_SEO_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(item.values, key), false, `preset "${item.name}" values must not carry "${key}"`);
    }
  }
});

test('Defect 2: A-then-B preset apply (the same spread merge applyExperience uses) lands cleanly on B with no bleed from A', () => {
  const bundlePresets = {
    Forge: buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.forge),
    Bloom: buildExperienceSettingsOverlay(EXPERIENCE_REGISTRY.bloom),
  };
  const items = resolveExperiencePresetItems(bundlePresets);
  const forgeItem = items.find((item) => item.name === 'Forge');
  const bloomItem = items.find((item) => item.name === 'Bloom');
  assert.ok(forgeItem);
  assert.ok(bloomItem);

  let themeSettings: Record<string, unknown> = {};
  themeSettings = { ...themeSettings, ...forgeItem!.values, experienceId: forgeItem!.id };
  themeSettings = { ...themeSettings, ...bloomItem!.values, experienceId: bloomItem!.id };

  for (const [key, value] of Object.entries(bloomItem!.values)) {
    assert.equal(themeSettings[key], value, `key "${key}" must equal Bloom's value after applying Bloom last`);
  }
  for (const [key, value] of Object.entries(forgeItem!.values)) {
    if (bloomItem!.values[key] !== value) {
      assert.notEqual(themeSettings[key], value, `key "${key}" must not still carry Forge's value after Bloom was applied`);
    }
  }
  assert.equal(themeSettings.experienceId, bloomItem!.id);
});

test('Defect 2: resolveExperiencePresetItems returns an empty array (not a throw) for a theme with zero bundle presets', () => {
  assert.deepEqual(resolveExperiencePresetItems({}), []);
});

test('Defect 2: ExperiencePicker fails soft on zero presets — source contains an explained empty state, not a blank panel', () => {
  const picker = readAppFile('../../../apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx');
  assert.match(picker, /presets\.length === 0/, 'must branch on an empty preset list');
  assert.match(picker, /No Experiences on this theme yet/, 'must explain the empty state to the merchant, not render blank');
});

// applyExperienceToTemplateConfig itself is untouched by this phase (Defect 2 only changes how the
// editor SOURCES a preset's values, not the shared apply/merge/validate contract) — these three
// tests prove that shared function still does everything it always did.
test('W3: applying a preset changes the resolved theme settings to that preset\'s values', () => {
  const forge = EXPERIENCE_REGISTRY.forge;
  const templateConfig = { themeSettings: { primaryColor: '#000000' }, config: { settings_data: { current: {} } } };
  const result = applyExperienceToTemplateConfig(templateConfig, forge);
  const settings = result.themeSettings as Record<string, unknown>;
  assert.equal(settings.primaryColor, forge.tokens.primaryColor);
  assert.equal(settings.secondaryColor, forge.tokens.secondaryColor);
  assert.equal(settings.bodyFontFamily, forge.tokens.fontFamily);
  assert.equal(settings.borderRadius, forge.tokens.borderRadius);
  assert.equal((result as Record<string, unknown>).experienceId, 'forge');
});

test('W3: applying a preset does NOT alter metaDescription / socialImageUrl / faviconUrl', () => {
  const sense = EXPERIENCE_REGISTRY.sense;
  const templateConfig = {
    themeSettings: {
      metaDescription: 'A merchant wrote this themselves.',
      socialImageUrl: 'https://cdn.example/merchant-social.jpg',
      faviconUrl: 'https://cdn.example/merchant-favicon.ico',
    },
    config: { settings_data: { current: {} } },
  };
  const result = applyExperienceToTemplateConfig(templateConfig, sense);
  const settings = result.themeSettings as Record<string, unknown>;
  assert.equal(settings.metaDescription, 'A merchant wrote this themselves.');
  assert.equal(settings.socialImageUrl, 'https://cdn.example/merchant-social.jpg');
  assert.equal(settings.faviconUrl, 'https://cdn.example/merchant-favicon.ico');
});

test('W3: applying preset A then preset B lands cleanly on B\'s values, with no bleed from A', () => {
  const forge = EXPERIENCE_REGISTRY.forge;
  const bloom = EXPERIENCE_REGISTRY.bloom;
  let templateConfig: Record<string, unknown> = { themeSettings: {}, config: { settings_data: { current: {} } } };
  templateConfig = applyExperienceToTemplateConfig(templateConfig, forge);
  templateConfig = applyExperienceToTemplateConfig(templateConfig, bloom);

  const settings = templateConfig.themeSettings as Record<string, unknown>;
  for (const [key, value] of Object.entries(buildExperienceSettingsOverlay(bloom))) {
    assert.equal(settings[key], value, `key "${key}" must equal Bloom's value after applying Bloom last`);
  }
  for (const [key, value] of Object.entries(buildExperienceSettingsOverlay(forge))) {
    if (buildExperienceSettingsOverlay(bloom)[key] !== value) {
      assert.notEqual(settings[key], value, `key "${key}" must not still carry Forge's value after Bloom was applied`);
    }
  }
  assert.equal((templateConfig as Record<string, unknown>).experienceId, 'bloom');
});

test('W3/Defect 2: no second preset system — ExperiencePicker takes presets as a prop (not the registry); the editor page resolves them from settings_data.presets', () => {
  const picker = readAppFile('../../../apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx');
  assert.equal(/listExperiences\(\s*\)/.test(picker), false, 'ExperiencePicker must not call the registry\'s listExperiences() itself — presets come from the bundle, passed in as a prop');
  assert.match(picker, /presets: ExperiencePresetItem\[\]/, 'presets must be a typed prop');

  const editorPage = readAppFile('../../../apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');
  assert.match(editorPage, /resolveExperiencePresetItems/, 'the editor page must resolve presets from the loaded settings_data.presets');
  assert.equal(/getExperience\(experienceId\)/.test(editorPage), false, 'applyExperience must no longer look a preset up in the registry by id');
  assert.equal(/\bbuildExperienceSettingsOverlay\(/.test(editorPage), false, 'the editor page must no longer recompute overlay values — it reads them from the resolved bundle preset');
});
