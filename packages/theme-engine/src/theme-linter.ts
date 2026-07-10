// H4 — Theme Linter
//
// Lint rules for a LiquidThemePackageBundle. All security checks (forbidden-tag,
// forbidden-attr) import their deny-lists from LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG as
// the single source of truth — the linter never hardcodes what the renderer rejects.
//
// Rule levels:
//   'error' — the source contains content the renderer's DOMPurify pass will strip or block.
//             Authors must fix these before publishing.
//   'warn'  — advisory: the section type is unknown to the built-in registry, or a setting
//             referenced in source is not declared in the schema (best-effort heuristic).

import type { LiquidThemePackageBundle } from './theme-bundle';
import { LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG } from './theme-renderer';
import { BUILT_IN_SECTION_SCHEMAS } from './built-in-section-schemas';
import { createLiquidParitySectionFiles } from './theme-bundle';

// ---- Known section types (single combined set) ----
// camelCase built-in React section types (header, heroBanner, etc.)
// + kebab-case first-party Liquid parity types (hero-banner, header, etc.)
function buildKnownSectionTypes(): Set<string> {
  const known = new Set<string>();
  for (const key of Object.keys(BUILT_IN_SECTION_SCHEMAS)) known.add(key);
  for (const key of Object.keys(createLiquidParitySectionFiles())) known.add(key);
  return known;
}

// Lazily-built, stable across a process lifetime.
let _knownSectionTypes: Set<string> | undefined;
function knownSectionTypes(): Set<string> {
  if (!_knownSectionTypes) _knownSectionTypes = buildKnownSectionTypes();
  return _knownSectionTypes;
}

// ---- Rule types ----

export type ThemeLintRule =
  | 'unknown-section-type'
  | 'forbidden-tag'
  | 'forbidden-attr'
  | 'missing-schema-block'
  | 'setting-referenced-not-in-schema';

export interface ThemeLintIssue {
  level: 'error' | 'warn';
  rule: ThemeLintRule;
  sectionType: string;
  message: string;
}

// ---- Helpers ----

function extractSectionStem(path: string): string {
  // 'sections/hero-banner.liquid' → 'hero-banner'
  const fileName = path.split('/').pop() ?? '';
  return fileName.replace(/\.liquid$/i, '');
}

// ---- Core lint function ----

export function lintThemeBundle(bundle: LiquidThemePackageBundle): ThemeLintIssue[] {
  // Derive forbidden tag/attr lists from the renderer config so we never diverge.
  const forbidTags = (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_TAGS as string[]) ?? [];
  const forbidAttrs = (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.FORBID_ATTR as string[]) ?? [];

  const issues: ThemeLintIssue[] = [];
  const known = knownSectionTypes();

  for (const [sectionKey, section] of Object.entries(bundle.sections)) {
    const sectionType = extractSectionStem(section.path) || sectionKey;
    const source = section.source;

    // (1) unknown-section-type
    if (!known.has(sectionKey) && !known.has(sectionType)) {
      issues.push({
        level: 'warn',
        rule: 'unknown-section-type',
        sectionType,
        message: `Section "${sectionType}" is not in the built-in or Liquid parity section registry. `
          + 'This is fine for private / theme-specific sections.',
      });
    }

    // (2) forbidden-tag — check each FORBID_TAG against the source
    const sourceLower = source.toLowerCase();
    for (const tag of forbidTags) {
      if (sourceLower.includes(`<${tag}`)) {
        issues.push({
          level: 'error',
          rule: 'forbidden-tag',
          sectionType,
          message: `Section "${sectionType}" contains forbidden tag "<${tag}>". `
            + 'The renderer\'s DOMPurify pass will strip this element.',
        });
      }
    }

    // (3) forbidden-attr — check each FORBID_ATTR from the sanitizer config (single source of truth),
    // not a hardcoded `style=`. Today FORBID_ATTR is ['style']; if the sanitizer adds more, the linter
    // follows automatically.
    for (const attr of forbidAttrs) {
      if (new RegExp(`\\b${attr}\\s*=`, 'i').test(source)) {
        issues.push({
          level: 'error',
          rule: 'forbidden-attr',
          sectionType,
          message: `Section "${sectionType}" contains a forbidden "${attr}=" attribute. `
            + `DOMPurify strips all ${attr}= attributes. Use class-based styling instead.`,
        });
      }
    }

    // (4) missing-schema-block — redundant for Zod-validated bundles but catches partial imports
    const hasSchemaOpen = /\{%\s*schema\s*%\}/i.test(source);
    const hasSchemaClose = /\{%\s*endschema\s*%\}/i.test(source);
    if (!hasSchemaOpen || !hasSchemaClose) {
      issues.push({
        level: 'error',
        rule: 'missing-schema-block',
        sectionType,
        message: `Section "${sectionType}" is missing a {% schema %} / {% endschema %} block. `
          + 'This is always rejected by parseLiquidThemePackageBundle; '
          + 'this check defends against partial imports that bypass Zod validation.',
      });
    }

    // (5) setting-referenced-not-in-schema (best-effort heuristic)
    const settingRefs = Array.from(source.matchAll(/\{\{\s*section\.settings\.([a-zA-Z0-9_]+)/g))
      .map((m) => m[1]);

    if (settingRefs.length > 0) {
      const declaredIds = new Set(section.schema.settings.map((s) => s.id));
      for (const ref of settingRefs) {
        if (!declaredIds.has(ref)) {
          issues.push({
            level: 'warn',
            rule: 'setting-referenced-not-in-schema',
            sectionType,
            message: `Section "${sectionType}" references setting "{{ section.settings.${ref} }}" `
              + 'which is not declared in the schema.settings array. '
              + '(Best-effort heuristic — false positives possible for dynamic access.)',
          });
        }
      }
    }
  }

  return issues;
}
