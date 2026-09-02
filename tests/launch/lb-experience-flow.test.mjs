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

const PICKER = 'apps/merchant_web/src/components/theme-editor/ExperiencePicker.tsx';
const EDITOR = 'apps/merchant_web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const ONBOARDING = 'apps/identity-platform/src/app/onboarding/page.tsx';
const STORES = 'services/api-gateway/src/routes/stores.ts';

// ── Stream A: Experience Picker ───────────────────────────────────────────────
test('A: the Experience Picker exists and renders experiences from the engine', () => {
  assert.ok(existsSync(resolve(ROOT, PICKER)), 'ExperiencePicker.tsx must exist');
  const picker = read(PICKER);
  assert.match(picker, /from '@letbuyy\/theme-engine'/);
  assert.match(picker, /listExperiences\(\)/);
  assert.match(picker, /exp\.name/);
  assert.match(picker, /exp\.preview\.swatches/);
  assert.match(picker, /exp\.industry/);
  assert.match(picker, /onApply\(exp\.id\)/);
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
  assert.match(editor, /buildExperienceSettingsOverlay/);
  assert.match(editor, /getExperience/);
  assert.match(editor, /const applyExperience = useCallback/);
  assert.match(editor, /<ExperiencePicker/);
  assert.match(editor, /onApply=\{applyExperience\}/);
});

test('B: applying an experience merges the token overlay into themeSettings (draft path)', () => {
  const editor = read(EDITOR);
  const fn = editor.slice(editor.indexOf('const applyExperience = useCallback'), editor.indexOf('const loadReleases'));
  assert.match(fn, /buildExperienceSettingsOverlay\(experience\)/);
  assert.match(fn, /themeSettings: \{ \.\.\.current\.themeSettings, \.\.\.overlay, experienceId \}/);
});

test('B: the editor no longer defaults the theme name to Urban Kicks', () => {
  const editor = read(EDITOR);
  assert.doesNotMatch(editor, /useState\('Urban Kicks'\)/);
  assert.match(editor, /useState\('LetBuyy Core'\)/);
});

// ── Stream C: industry onboarding -> server auto-apply ────────────────────────
test('C: onboarding captures an industry and sends it as survey.industry', () => {
  const onboarding = read(ONBOARDING);
  assert.match(onboarding, /ONBOARDING_INDUSTRIES/);
  assert.match(onboarding, /useState<string>\('general'\)/);
  assert.match(onboarding, /onChange=\{\(e\) => setIndustry\(e\.target\.value\)\}/);
  assert.match(onboarding, /survey: \{ industry \}/);
  // recommended experience is surfaced before creation
  assert.match(onboarding, /Recommended experience/);
});

test('C: the gateway store-creation handler auto-applies the recommended experience', () => {
  const stores = read(STORES);
  assert.match(stores, /import \{ resolveExperienceForIndustry, applyExperienceToTemplateConfig \} from '@letbuyy\/theme-engine'/);
  assert.match(stores, /resolveExperienceForIndustry\(industryHint \|\| null, experienceOverride\)/);
  assert.match(stores, /applyExperienceToTemplateConfig\(templateConfig, experience\)/);
  // additive: only applies when an industry/override is present (no behaviour change otherwise)
  assert.match(stores, /if \(industryHint \|\| experienceOverride\)/);
  assert.match(stores, /template_config: templateConfig,/);
});
