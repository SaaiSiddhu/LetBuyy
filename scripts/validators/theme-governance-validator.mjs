#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function read(path) {
  const full = join(ROOT, path);
  if (!existsSync(full)) {
    throw new Error(`Missing required file: ${path}`);
  }
  return readFileSync(full, 'utf8');
}

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`Could not find ${name}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function unique(values) {
  return [...new Set(values)];
}

const failures = [];
const builtInSchemas = read('packages/theme-engine/src/built-in-section-schemas.ts');
const themeRegistry = read('packages/theme-engine/src/theme-registry.ts');
const themeGovernance = read('packages/theme-engine/src/theme-governance.ts');
const themeIndex = read('packages/theme-engine/src/index.ts');
const themeRenderer = read('packages/theme-engine/src/theme-renderer.ts');
const rendererRegistry = read('apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx');
const templateResolver = read('apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts');
const noNewReactSectionsValidator = read('scripts/validators/no-new-react-sections-validator.mjs');
const packageTest = read('packages/theme-engine/test/theme-engine.test.ts');

const builtInSectionTypes = extractStringArray(builtInSchemas, 'BUILT_IN_SECTION_TYPES');
if (builtInSectionTypes.length !== 24) {
  failures.push(`Expected 24 built-in section types; found ${builtInSectionTypes.length}`);
}
if (unique(builtInSectionTypes).length !== builtInSectionTypes.length) {
  failures.push('Built-in section type list contains duplicates');
}

const schemaTypeMatches = [
  ...themeRegistry.matchAll(/\btype:\s*'([^']+)'/g),
  ...builtInSchemas.matchAll(/\btype:\s*'([^']+)'/g),
].map((match) => match[1]);
const schemaTypes = new Set(schemaTypeMatches);
for (const sectionType of builtInSectionTypes) {
  if (!schemaTypes.has(sectionType)) {
    failures.push(`Built-in section type "${sectionType}" has no schema definition`);
  }
}

if (!/THEME_RENDERER_GOVERNANCE_DEFAULT_MODE:[^=]+=\s*'warn'/.test(themeGovernance)) {
  failures.push('Theme renderer governance default mode must stay WARN until mismatch audit is clean');
}
if (!/THEME_LIQUID_RENDERING_DEFAULT_ENABLED\s*=\s*false/.test(themeGovernance)) {
  failures.push('Liquid rendering must default OFF until the Wave 6 Class-A product decision is resolved');
}
if (!/THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION[\s\S]*status:\s*'deferred'/.test(themeGovernance)) {
  failures.push('Liquid platform-wide flip must be recorded as deferred beyond per-theme canary');
}
if (!/export function resolveThemeLiquidRenderingEnabled/.test(themeGovernance)) {
  failures.push('Per-theme Liquid canary decision function is missing');
}
const liquidParityEntryCount = [...themeGovernance.matchAll(/reactFile:\s*'[^']+\.tsx'/g)].length;
if (liquidParityEntryCount !== 20) {
  failures.push(`Expected 20 Liquid parity entries for frozen React sections; found ${liquidParityEntryCount}`);
}
if (!/export function auditThemeRendererRegistry/.test(themeGovernance)) {
  failures.push('Renderer↔registry audit function is missing');
}
if (!/export function migrateThemeTemplateSchemas/.test(themeGovernance)) {
  failures.push('Schema migration runner is missing');
}
if (!/\.\.\.BUILT_IN_SECTION_SCHEMAS[\s\S]*\.\.\.input\.runtime\.sectionSchemas/.test(themeIndex)) {
  failures.push('Theme template validation must merge built-in schemas before runtime schemas');
}
if (!/data-theme-section-fallback="true"/.test(rendererRegistry) || !/UnknownSectionFallback/.test(rendererRegistry)) {
  failures.push('Storefront renderer must render an explicit fallback placeholder for unknown sections');
}
if (!/THEME_LIQUID_RENDERING_DEFAULT_ENABLED/.test(templateResolver) || !/resolveThemeLiquidRenderingEnabled/.test(templateResolver) || !/liquidEnabled\s*\?\s*resolveLiquidBundle/.test(templateResolver)) {
  failures.push('Storefront template resolver must gate Liquid rendering behind an explicit per-theme canary opt-in');
}
const sanitizerFunction = themeRenderer.match(/export async function sanitizeRenderedHtml[\s\S]*?\n}/)?.[0] || '';
if (!/import\('dompurify'\)/.test(themeRenderer) || !/LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG/.test(themeRenderer)) {
  failures.push('Liquid rendered HTML sanitizer must use DOMPurify with an explicit policy');
}
if (/\.replace\(/.test(sanitizerFunction)) {
  failures.push('Liquid rendered HTML sanitizer must not use regex replacement');
}
if (!/outputEscape:\s*'escape'/.test(themeRenderer)) {
  failures.push('LiquidJS renderer must enable outputEscape auto-escaping');
}
const frozenReactSectionCount = [...noNewReactSectionsValidator.matchAll(/apps\/storefront-runtime\/src\/components\/sections\/[^"]+\.tsx/g)].length;
if (frozenReactSectionCount !== 20) {
  failures.push(`React section freeze validator must enumerate 20 frozen sections; found ${frozenReactSectionCount}`);
}
if (!/migrateThemeTemplateSchemas/.test(packageTest) || !/schema migration runner migrates existing saved store sections/.test(packageTest)) {
  failures.push('Theme-engine tests must prove schema migration of an existing saved section');
}
if (!/auditThemeRendererRegistry/.test(packageTest) || !/WARN mode/.test(packageTest)) {
  failures.push('Theme-engine tests must prove WARN-mode renderer↔registry validation');
}
if (!/DOMPurify sanitizer preserves Liquid hydration elements/.test(packageTest) || !/first-party Liquid bundle has parity section files/.test(packageTest)) {
  failures.push('Theme-engine tests must prove D7 DOMPurify sanitizer and Liquid parity coverage');
}

if (failures.length) {
  console.error('✖ Theme governance validator failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Theme governance validator passed (${builtInSectionTypes.length} built-in section schemas, WARN mode, Liquid default OFF, fallback placeholder, schema migration runner).`);
