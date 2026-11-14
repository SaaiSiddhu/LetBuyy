// Phase-2 Streams B/C/D — Theme Preset Engine + Experience Registry + Industry Map.
// Behavioral tests (import the real engine, assert behavior), run via `tsx --test`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THEME_SETTINGS,
  EXPERIENCE_REGISTRY,
  EXPERIENCE_IDS,
  FALLBACK_EXPERIENCE_ID,
  INDUSTRY_EXPERIENCE_MAP,
  INDUSTRY_OPTIONS,
  applyExperienceToSettingsData,
  applyExperienceToTemplateConfig,
  buildExperienceSettingsOverlay,
  collectExperienceRegistryIssues,
  collectIndustryMapIssues,
  exportExperience,
  getExperience,
  importExperience,
  listExperiences,
  normalizeIndustry,
  resolveExperienceForIndustry,
  safeValidateExperience,
  validateExperience,
} from '../src/index.ts';

// ── Stream B/C: registry integrity ───────────────────────────────────────────

test('Stream C: the registry defines exactly the 10 named experiences', () => {
  assert.equal(EXPERIENCE_IDS.length, 10);
  for (const id of ['forge', 'sense', 'aura', 'craft', 'refresh', 'ride', 'dawn', 'bloom', 'nova', 'summit']) {
    assert.ok(getExperience(id), `missing experience '${id}'`);
  }
});

test('Stream B/C: registry passes all integrity checks (valid schema, known sections, unique industries)', () => {
  assert.deepEqual(collectExperienceRegistryIssues(), []);
});

test('Stream C: every experience fully defines tokens, color system, typography, layout, preview, sections', () => {
  for (const exp of listExperiences()) {
    // tokens (the 6 colors + 2 fonts + radius)
    for (const c of ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor', 'surfaceColor'] as const) {
      assert.match(exp.tokens[c], /^#[0-9A-Fa-f]{6}$/, `${exp.id}.${c}`);
    }
    assert.ok(exp.typography.headingFont.length > 0 && exp.typography.bodyFont.length > 0, exp.id);
    assert.ok(exp.layout.sectionOrder.length >= 1, exp.id);
    assert.ok(exp.defaultSections.length >= 1, exp.id);
    assert.ok(exp.preview.swatches.length >= 2, exp.id);
    assert.ok(['research', 'designed'].includes(exp.metadata.grounding), exp.id);
    // color system mirrors tokens (single source of truth, no drift)
    assert.equal(exp.colorSystem.primary, exp.tokens.primaryColor, exp.id);
    assert.equal(exp.colorSystem.surface, exp.tokens.surfaceColor, exp.id);
  }
});

test('Stream C: at least the documented grounded experiences are flagged grounded', () => {
  for (const id of ['forge', 'sense', 'craft', 'refresh', 'summit']) {
    assert.equal(getExperience(id)!.metadata.grounding, 'research', `${id} should be research-grounded`);
  }
});

test('Stream C: Summit (General fallback) tokens match DEFAULT_THEME_SETTINGS (zero-regression fallback)', () => {
  const summit = getExperience('summit')!;
  assert.equal(summit.tokens.primaryColor, DEFAULT_THEME_SETTINGS.primaryColor);
  assert.equal(summit.tokens.accentColor, DEFAULT_THEME_SETTINGS.accentColor);
  assert.equal(summit.tokens.borderRadius, DEFAULT_THEME_SETTINGS.borderRadius);
  assert.equal(FALLBACK_EXPERIENCE_ID, 'summit');
});

// ── Stream B: validation ──────────────────────────────────────────────────────

test('Stream B: validateExperience accepts a valid experience and rejects malformed ones', () => {
  const forge = getExperience('forge')!;
  assert.doesNotThrow(() => validateExperience(forge));
  assert.equal(safeValidateExperience(forge).success, true);
  assert.equal(safeValidateExperience({ ...forge, id: 'NOT KEBAB' }).success, false);
  assert.equal(safeValidateExperience({ ...forge, tokens: { ...forge.tokens, primaryColor: 'blue' } }).success, false);
  assert.equal(safeValidateExperience({ ...forge, defaultSections: [] }).success, false);
});

// ── Stream B: apply (preset → store config) ───────────────────────────────────

test('Stream B: the settings overlay emits both fontFamily and bodyFontFamily (React + Liquid paths)', () => {
  const overlay = buildExperienceSettingsOverlay(getExperience('sense')!);
  assert.equal(overlay.fontFamily, 'Inter');
  assert.equal(overlay.bodyFontFamily, 'Inter');
  assert.equal(overlay.headingFontFamily, 'Playfair Display');
  assert.equal(overlay.primaryColor, '#1A1A2E');
});

test('Stream B: applyExperienceToSettingsData merges (keeps unrelated keys) and can replace', () => {
  const merged = applyExperienceToSettingsData({ keepMe: 1, primaryColor: '#000000' }, getExperience('forge')!);
  assert.equal(merged.keepMe, 1);
  assert.equal(merged.primaryColor, '#1E3A5F'); // overlay wins
  const replaced = applyExperienceToSettingsData({ keepMe: 1 }, getExperience('forge')!, 'replace');
  assert.equal(replaced.keepMe, undefined);
  assert.equal(replaced.primaryColor, '#1E3A5F');
});

test('Stream B: applyExperienceToTemplateConfig writes BOTH render paths + records experienceId, never mutates input', () => {
  const input = { themeId: 'letbuyy-core', themeSettings: { borderRadius: 99 }, config: { settings_data: { current: { keep: true } } } };
  const out = applyExperienceToTemplateConfig(input, getExperience('refresh')!) as Record<string, any>;
  assert.equal(out.experienceId, 'refresh');
  // React path
  assert.equal(out.themeSettings.primaryColor, '#2D6A4F');
  // Liquid path
  assert.equal(out.config.settings_data.current.primaryColor, '#2D6A4F');
  assert.equal(out.config.settings_data.current.keep, true); // unrelated key preserved
  assert.equal(out.themeId, 'letbuyy-core'); // untouched
  // input not mutated
  assert.equal((input as any).experienceId, undefined);
  assert.equal(input.themeSettings.borderRadius, 99);
});

test('Stream B: export → import round-trips an experience exactly', () => {
  const craft = getExperience('craft')!;
  const json = exportExperience(craft);
  const restored = importExperience(json);
  assert.deepEqual(restored, craft);
  assert.throws(() => importExperience('{"id":"x"}')); // incomplete → schema rejects
});

// ── Stream D: industry mapping ────────────────────────────────────────────────

test('Stream D: industry map is internally consistent and points only at real experiences', () => {
  assert.deepEqual(collectIndustryMapIssues(), []);
  assert.equal(INDUSTRY_OPTIONS.length, 9);
});

test('Stream D: the documented industry → experience mappings resolve correctly', () => {
  const cases: Array<[string, string]> = [
    ['electronics', 'forge'],
    ['fashion', 'sense'],
    ['beauty', 'aura'],
    ['furniture', 'craft'],
    ['food', 'refresh'],
    ['sports', 'ride'],
    ['books', 'dawn'],
    ['pet', 'bloom'],
    ['general', 'summit'],
  ];
  for (const [industry, experienceId] of cases) {
    assert.equal(INDUSTRY_EXPERIENCE_MAP[industry], experienceId, `${industry} → ${experienceId}`);
    assert.equal(resolveExperienceForIndustry(industry).experience.id, experienceId);
  }
});

test('Stream D: the "Food → Harvest" brief error resolves to Refresh (Harvest is not an experience)', () => {
  assert.equal(getExperience('harvest'), undefined);
  assert.equal(resolveExperienceForIndustry('food').experience.id, 'refresh');
  assert.equal(resolveExperienceForIndustry('Harvest').experience.id, 'refresh'); // alias safety net
});

test('Stream D: synonyms normalize, unknown industry falls back to Summit, override wins', () => {
  assert.equal(normalizeIndustry('Grocery'), 'food');
  assert.equal(normalizeIndustry('Tech & Gadgets'), 'electronics');
  assert.equal(normalizeIndustry('  Apparel '), 'fashion');
  assert.equal(normalizeIndustry('unicorns'), null);

  const fallback = resolveExperienceForIndustry('unicorns');
  assert.equal(fallback.experience.id, 'summit');
  assert.equal(fallback.source, 'fallback');

  const fromIndustry = resolveExperienceForIndustry('electronics');
  assert.equal(fromIndustry.source, 'industry');

  const overridden = resolveExperienceForIndustry('electronics', 'sense');
  assert.equal(overridden.experience.id, 'sense');
  assert.equal(overridden.source, 'override');

  // invalid override is ignored, falls through to industry
  assert.equal(resolveExperienceForIndustry('electronics', 'not-real').experience.id, 'forge');
});
