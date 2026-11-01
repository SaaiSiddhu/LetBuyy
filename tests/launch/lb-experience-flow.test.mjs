// Phase-2.5 — the merchant-facing Experience flow is wired end to end:
//   onboarding industry -> server auto-apply -> editor Experiences tab -> apply -> publish.
// Source-contract tests (same style as the lb* launch suite): assert the wiring exists, that the
// merchant sees "Experience" (never "Urban Kicks", never "Theme Preset"), and the issuer/engine
// boundaries are honored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const PICKER = 'apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx';
const EDITOR = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const ONBOARDING = 'apps/platform/identity/src/app/onboarding/page.tsx';
const STORES = 'services/api-gateway/src/routes/stores.ts';

// ── Stream A: Experience Picker ───────────────────────────────────────────────
// S4-FIX/Defect 2 changed where the list comes from, not what the picker shows: the picker no longer
// reads the Experience registry itself. The editor resolves the presets a theme actually carries
// (settings_data.presets, the single source of which presets a theme has) with
// resolveExperiencePresetItems and hands them in as a prop, so a theme is never offered a preset its
// bundle does not define. The pins follow that: the picker renders ExperiencePresetItem entries from its
// prop and must not go back to the registry.
test('A: the Experience Picker exists and renders the theme\'s preset items from the engine\'s type', () => {
  assert.ok(existsSync(resolve(ROOT, PICKER)), 'ExperiencePicker.tsx must exist');
  const picker = read(PICKER);
  assert.match(picker, /import type \{ ExperiencePresetItem \} from '@letbuyy\/theme-engine'/);
  assert.match(picker, /presets: ExperiencePresetItem\[\]/);
  assert.doesNotMatch(picker, /listExperiences\(/, 'the picker must not read the Experience registry directly');
  assert.match(picker, /preset\.name/);
  assert.match(picker, /preset\.swatches/);
  assert.match(picker, /preset\.industry/);
  assert.match(picker, /onApply\(preset\.id\)/);
});

test('A: the picker speaks "Experience" — never Urban Kicks, never "Theme Preset"', () => {
  const picker = read(PICKER);
  assert.doesNotMatch(picker, /Urban Kicks/i);
  assert.doesNotMatch(picker, /theme preset/i);
  assert.match(picker, /Experience/);
});

// ── Stream A/B: editor wiring + apply ─────────────────────────────────────────
test('B: the editor wires the picker behind an Experiences panel and an apply handler', () => {
  const editor = read(EDITOR);
  assert.match(editor, /type PanelMode = [^\n]*'experiences'/);
  assert.match(editor, /import ExperiencePicker from '@\/components\/theme-editor\/ExperiencePicker'/);
  assert.match(editor, /resolveExperiencePresetItems\(presetsFromBaseConfig\(baseConfig\)\)/);
  assert.match(editor, /const applyExperience = useCallback/);
  assert.match(editor, /<ExperiencePicker/);
  assert.match(editor, /presets=\{presetItems\}/);
  assert.match(editor, /onApply=\{applyExperience\}/);
});

test('B: applying an experience merges the preset\'s own values into themeSettings (draft path)', () => {
  const editor = read(EDITOR);
  const fn = editor.slice(editor.indexOf('const applyExperience = useCallback'), editor.indexOf('const loadReleases'));
  assert.match(fn, /presetItems\.find\(\(item\) => item\.id === presetId\)/);
  assert.match(fn, /themeSettings: \{ \.\.\.current\.themeSettings, \.\.\.preset\.values \}/);
  assert.match(fn, /experienceId: preset\.id/);
  // The values are read from the bundle preset, never recomputed from the registry (ExperiencePresetItem.values).
  assert.doesNotMatch(fn, /buildExperienceSettingsOverlay|getExperience\(/);
});

test('B: the editor no longer defaults the theme name to Urban Kicks', () => {
  const editor = read(EDITOR);
  assert.doesNotMatch(editor, /useState\('Urban Kicks'\)/);
  assert.match(editor, /useState\('LetBuyy Core'\)/);
});

// ── Stream C: industry onboarding -> canonical first-party theme ──────────────
test('C: onboarding captures an industry and sends it as survey.industry', () => {
  const onboarding = read(ONBOARDING);
  assert.match(onboarding, /ONBOARDING_INDUSTRIES/);
  assert.match(onboarding, /useState<string>\('general'\)/);
  assert.match(onboarding, /onChange=\{\(e\) => setIndustry\(e\.target\.value\)\}/);
  assert.match(onboarding, /survey: \{ industry \}/);
  // Onboarding now names its actual default first-party theme before creation.
  assert.match(onboarding, /<span>Default theme<\/span>\s*<strong>Circuit<\/strong>/);
});

test('C: store creation preserves first-party theme design and only overlays legacy Core', () => {
  const stores = read(STORES);
  const bindings = stores.match(/import\s*\{([^}]+)\}\s*from '@letbuyy\/theme-engine'/)?.[1].split(',').map(name => name.trim()) || [];
  for (const name of ['resolveExperienceForIndustry', 'applyExperienceToTemplateConfig', 'LETBUYY_CORE_THEME_SLUG']) assert.ok(bindings.includes(name), `Missing canonical experience binding: ${name}`);
  assert.match(stores, /resolveExperienceForIndustry\(industryHint \|\| null, experienceOverride\)/);
  assert.match(stores, /applyExperienceToTemplateConfig\(templateConfig, experience\)/);
  // An authored first-party design must not be overwritten by an industry overlay.
  assert.match(stores, /const firstPartyDesign = firstPartyThemeListings\(\)\.some\(theme => theme\.slug === body\.theme_id\)/);
  assert.match(stores, /if \(!firstPartyDesign && \(industryHint \|\| experienceOverride\)\)/);
  assert.match(stores, /template_config: templateConfig,/);
});
