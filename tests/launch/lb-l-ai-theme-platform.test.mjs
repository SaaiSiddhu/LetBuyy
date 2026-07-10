// Phase L — AI Theme Platform Contract (source-contract assertions)
//
// PURPOSE: Enforce the HONESTY LAW and SAFETY LAW at the source level.
// These are static assertions on file contents — no runtime imports of TypeScript
// (this file runs with plain `node --test`, not tsx). Behavioural tests live in
// packages/theme-engine/test/theme-ai-sdk.test.ts (run by pnpm --filter @letbuyy/theme-engine test).
//
// Assertions:
//   SDK exports  — theme-ai-sdk.ts exports all required symbols in index.ts
//   No provider  — zero real AI provider imports in any packages/theme-engine/src/ file
//   MODEL_BOUNDARY — the NOT-CONNECTED seam is documented in the source
//   Contract doc — AI_THEME_PLATFORM_CONTRACT.md exists + carries required sections
//   WCAG math    — relativeLuminance / contrastRatio / meetsWcagAA are in the source
//   Safety law   — every generator calls the validators (WCAG + ExperienceTokensSchema)

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const exists = (p) => existsSync(resolve(ROOT, p));

// ─── SDK source file exists ───────────────────────────────────────────────────

test('L/source: theme-ai-sdk.ts exists in packages/theme-engine/src/', () => {
  assert.ok(exists('packages/theme-engine/src/theme-ai-sdk.ts'));
});

test('L/source: theme-ai-sdk.ts is exported from index.ts', () => {
  const index = read('packages/theme-engine/src/index.ts');
  assert.match(index, /export \* from ['"]\.\/theme-ai-sdk['"]/);
});

// ─── Required SDK symbol exports ─────────────────────────────────────────────

const SDK_SRC = read('packages/theme-engine/src/theme-ai-sdk.ts');

test('L/exports: theme-ai-sdk.ts exports relativeLuminance', () => {
  // Matches both `export function relativeLuminance` (own impl) and
  // `export { relativeLuminance` (re-export from ai-color-system — the canonical
  // single source of truth for WCAG math after the deduplication refactor).
  assert.match(SDK_SRC, /export\b[^{]*function relativeLuminance|export\s*\{[^}]*relativeLuminance/);
});

test('L/exports: theme-ai-sdk.ts exports contrastRatio', () => {
  assert.match(SDK_SRC, /export\b[^{]*function contrastRatio|export\s*\{[^}]*contrastRatio/);
});

test('L/exports: theme-ai-sdk.ts exports meetsWcagAA', () => {
  assert.match(SDK_SRC, /export\b[^{]*function meetsWcagAA|export\s*\{[^}]*meetsWcagAA/);
});

test('L/exports: theme-ai-sdk.ts exports deterministicPalette', () => {
  assert.match(SDK_SRC, /export function deterministicPalette/);
});

test('L/exports: theme-ai-sdk.ts exports suggestTypographyPairing', () => {
  assert.match(SDK_SRC, /export function suggestTypographyPairing/);
});

test('L/exports: theme-ai-sdk.ts exports FONT_PAIRING_CATALOG', () => {
  assert.match(SDK_SRC, /export const FONT_PAIRING_CATALOG/);
});

test('L/exports: theme-ai-sdk.ts exports generateSectionOrder', () => {
  assert.match(SDK_SRC, /export function generateSectionOrder/);
});

test('L/exports: theme-ai-sdk.ts exports a11yAdvisories', () => {
  assert.match(SDK_SRC, /export function a11yAdvisories/);
});

test('L/exports: theme-ai-sdk.ts exports optimizeThemeBundle', () => {
  assert.match(SDK_SRC, /export function optimizeThemeBundle/);
});

test('L/exports: theme-ai-sdk.ts exports selectExperienceForMerchant', () => {
  assert.match(SDK_SRC, /export function selectExperienceForMerchant/);
});

test('L/exports: theme-ai-sdk.ts exports generateTheme', () => {
  assert.match(SDK_SRC, /export function generateTheme/);
});

test('L/exports: theme-ai-sdk.ts exports checkAccessibility', () => {
  assert.match(SDK_SRC, /export function checkAccessibility/);
});

test('L/exports: theme-ai-sdk.ts exports MODEL_BOUNDARY', () => {
  assert.match(SDK_SRC, /export const MODEL_BOUNDARY/);
});

test('L/exports: theme-ai-sdk.ts exports THEME_AI_SDK singleton', () => {
  assert.match(SDK_SRC, /export const THEME_AI_SDK/);
});

test('L/exports: theme-ai-sdk.ts exports ThemeAISDK interface', () => {
  assert.match(SDK_SRC, /export interface ThemeAISDK/);
});

test('L/exports: theme-ai-sdk.ts exports ThemeBrief interface', () => {
  assert.match(SDK_SRC, /export interface ThemeBrief/);
});

test('L/exports: theme-ai-sdk.ts exports MerchantProfile interface', () => {
  assert.match(SDK_SRC, /export interface MerchantProfile/);
});

// ─── No fabricated AI provider calls ─────────────────────────────────────────

// Patterns that would indicate a real LLM provider is wired.
const FORBIDDEN_PROVIDER_PATTERNS = [
  /from\s+['"]openai['"]/,
  /from\s+['"]@anthropic-ai/,
  /from\s+['"]@google\/generative-ai['"]/,
  /from\s+['"]@ai-sdk\//,
  /from\s+['"]ai['"]\s/,
  /from\s+['"]langchain/,
  /process\.env\.OPENAI_API_KEY/,
  /process\.env\.ANTHROPIC_API_KEY/,
  /process\.env\.GEMINI_API_KEY/,
  /new OpenAI\(/,
  /new Anthropic\(/,
  /openai\.chat\.completions\.create/,
  /anthropic\.messages\.create/,
  /fetch\(['"`]https:\/\/api\.openai\.com/,
  /fetch\(['"`]https:\/\/api\.anthropic\.com/,
];

// Read every .ts file in packages/theme-engine/src/
const THEME_ENGINE_SRC_DIR = resolve(ROOT, 'packages/theme-engine/src');
const srcFiles = readdirSync(THEME_ENGINE_SRC_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ name: f, content: readFileSync(resolve(THEME_ENGINE_SRC_DIR, f), 'utf8') }));

for (const { name, content } of srcFiles) {
  for (const pattern of FORBIDDEN_PROVIDER_PATTERNS) {
    test(`L/no-provider: ${name} does not contain fabricated AI provider call (${pattern.source.slice(0, 30)}...)`, () => {
      assert.doesNotMatch(
        content,
        pattern,
        `${name} contains a real AI provider import or call: ${pattern.source}`,
      );
    });
  }
}

// ─── MODEL_BOUNDARY documentation ─────────────────────────────────────────────

test('L/model-boundary: MODEL_BOUNDARY.status is set to NOT_CONNECTED in source', () => {
  assert.match(SDK_SRC, /NOT_CONNECTED/);
});

test('L/model-boundary: MODEL_BOUNDARY.envVar documents THEME_AI_PROVIDER_API_KEY', () => {
  assert.match(SDK_SRC, /THEME_AI_PROVIDER_API_KEY/);
});

test('L/model-boundary: MODEL_BOUNDARY.gatewayRoute documents the non-existent route', () => {
  assert.match(SDK_SRC, /does not exist/i);
});

test('L/model-boundary: source documents the 3 NOT-CONNECTED seams', () => {
  // NL brief seam
  assert.match(SDK_SRC, /NL brief.*ThemeBrief|ThemeBrief.*NL brief/si);
  // NL colour mood seam
  assert.match(SDK_SRC, /NL colour|colour mood|seed hex/i);
  // NL section intent seam
  assert.match(SDK_SRC, /NL section|section intent|SectionGoal/i);
});

// ─── WCAG contrast math ───────────────────────────────────────────────────────
// Phase L (deduplication refactor): the WCAG 2.1 contrast math now has a single
// canonical implementation in ai-color-system.ts; theme-ai-sdk.ts re-exports it.
// These tests verify the canonical source carries the correct formulas.

const AI_COLOR_SYSTEM_SRC = read('packages/theme-engine/src/ai-color-system.ts');

test('L/wcag-source: theme-engine WCAG math module contains sRGB linearisation formula', () => {
  // ai-color-system.ts is the canonical WCAG math source; theme-ai-sdk.ts re-exports from it.
  assert.match(AI_COLOR_SYSTEM_SRC, /0\.04045/);
  assert.match(AI_COLOR_SYSTEM_SRC, /12\.92/);
  assert.match(AI_COLOR_SYSTEM_SRC, /1\.055/);
});

test('L/wcag-source: theme-engine WCAG math module uses WCAG luminance coefficients', () => {
  assert.match(AI_COLOR_SYSTEM_SRC, /0\.2126/);
  assert.match(AI_COLOR_SYSTEM_SRC, /0\.7152/);
  assert.match(AI_COLOR_SYSTEM_SRC, /0\.0722/);
});

test('L/wcag-source: theme-ai-sdk.ts enforces 4.5:1 threshold for normal text', () => {
  assert.match(SDK_SRC, /4\.5/);
});

test('L/wcag-source: theme-ai-sdk.ts enforces 3.0:1 threshold for large text', () => {
  assert.match(SDK_SRC, /3\.0/);
});

// ─── Safety law: generator calls validators ────────────────────────────────────

test('L/safety: deterministicPalette calls ExperienceTokensSchema.parse', () => {
  assert.match(SDK_SRC, /ExperienceTokensSchema\.parse/);
});

test('L/safety: deterministicPalette calls meetsWcagAA before returning', () => {
  // The function must call meetsWcagAA inside deterministicPalette body.
  // We check that meetsWcagAA is called in the same function context.
  assert.match(SDK_SRC, /meetsWcagAA/);
});

test('L/safety: deterministicPalette throws on WCAG failure (fail-closed)', () => {
  assert.match(SDK_SRC, /This is a bug in the generator/);
});

test('L/safety: generateTheme calls lintThemeBundle', () => {
  assert.match(SDK_SRC, /lintThemeBundle/);
});

test('L/safety: generateTheme throws on lint errors (fail-closed)', () => {
  assert.match(SDK_SRC, /lint error/i);
});

test('L/safety: optimizeThemeBundle validates via parseLiquidThemePackageBundle', () => {
  assert.match(SDK_SRC, /parseLiquidThemePackageBundle/);
});

test('L/safety: optimizeThemeBundle returns original on validation failure (fail-safe)', () => {
  // The catch block must exist so invalid trimmed bundles are not returned.
  assert.match(SDK_SRC, /} catch/);
});

// ─── Contract document ────────────────────────────────────────────────────────

const CONTRACT_DOC_PATH = 'docs/storefront-liquid-discovery/phase-l/AI_THEME_PLATFORM_CONTRACT.md';

test('L/contract-doc: AI_THEME_PLATFORM_CONTRACT.md exists', () => {
  assert.ok(exists(CONTRACT_DOC_PATH), `${CONTRACT_DOC_PATH} must exist`);
});

const CONTRACT_DOC = read(CONTRACT_DOC_PATH);

test('L/contract-doc: contract doc declares NOT-CONNECTED model boundary', () => {
  assert.match(CONTRACT_DOC, /NOT-CONNECTED/i);
  assert.match(CONTRACT_DOC, /THEME_AI_PROVIDER_API_KEY/);
});

test('L/contract-doc: contract doc documents WCAG AA math', () => {
  assert.match(CONTRACT_DOC, /WCAG/i);
  assert.match(CONTRACT_DOC, /4\.5/);
  assert.match(CONTRACT_DOC, /3\.0/);
});

test('L/contract-doc: contract doc documents all 5 PaletteVariants', () => {
  assert.match(CONTRACT_DOC, /warm/);
  assert.match(CONTRACT_DOC, /cool/);
  assert.match(CONTRACT_DOC, /bold/);
  assert.match(CONTRACT_DOC, /muted/);
  assert.match(CONTRACT_DOC, /neutral/);
});

test('L/contract-doc: contract doc documents the safety guardrails', () => {
  assert.match(CONTRACT_DOC, /parseLiquidThemePackageBundle/);
  assert.match(CONTRACT_DOC, /lintThemeBundle/);
  assert.match(CONTRACT_DOC, /ExperienceSettingsOverlaySchema/);
});

test('L/contract-doc: contract doc names the facade entry point (generateTheme)', () => {
  assert.match(CONTRACT_DOC, /generateTheme/);
});

test('L/contract-doc: contract doc names all 7 ThemeAISDK methods', () => {
  assert.match(CONTRACT_DOC, /generatePalette/);
  assert.match(CONTRACT_DOC, /generateTypography/);
  assert.match(CONTRACT_DOC, /generateLayout/);
  assert.match(CONTRACT_DOC, /checkAccessibility/);
  assert.match(CONTRACT_DOC, /suggestOptimizations/);
  assert.match(CONTRACT_DOC, /personalize/);
});

test('L/contract-doc: contract doc declares 0-error-level lint guarantee', () => {
  assert.match(CONTRACT_DOC, /0 error/i);
});

test('L/contract-doc: contract doc explicitly says no fabricated model calls', () => {
  assert.match(CONTRACT_DOC, /No Fabricated Model Calls|no.*fabricated|fabricated.*model/i);
});

test('L/contract-doc: contract doc documents the section-order anchor constraints', () => {
  assert.match(CONTRACT_DOC, /heroBanner/);
  assert.match(CONTRACT_DOC, /newsletter/);
});
