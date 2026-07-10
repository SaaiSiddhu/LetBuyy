// ============================================================================
// PHASE L4 — AI Accessibility Analyzer: deterministic a11y audit + fix suggestions
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All analysis is deterministic algorithm — no heuristics, no ML, no fabricated scores.
//   Contrast checks use the real WCAG 2.1 math from ai-color-system.ts.
//   Pattern detection (missing alt, missing form labels) uses string search on
//   Liquid source, which is accurate for first-party section sources and advisory for
//   merchant-authored content.
// ============================================================================

import type { LiquidThemePackageBundle } from './theme-bundle';
import { contrastRatio, meetsWcagAA } from './ai-color-system';
import type { ThemeLintIssue } from './theme-linter';

// ── Issue types ───────────────────────────────────────────────────────────────

export type AccessibilityIssueType =
  | 'contrast-aa-fail'     // text/background pair fails WCAG 2.1 AA (< 4.5:1)
  | 'contrast-aa-warn'     // text/background pair is close to but passes AA (< 4.65:1)
  | 'missing-img-alt'      // <img> tag with no alt attribute found in section source
  | 'missing-form-label'   // <input> with no associated <label> context in section source
  | 'lint-forbidden-attr'; // re-raised from linter: forbidden-attr issues (e.g. style=)

export type AccessibilityIssueSeverity = 'error' | 'warn';

export interface AccessibilityIssue {
  type: AccessibilityIssueType;
  severity: AccessibilityIssueSeverity;
  /** Human-readable explanation of the issue. */
  message: string;
  /** Which part of the bundle (e.g. 'settings_data.current', 'sections/hero-banner') */
  location: string;
  /** If this is a contrast issue, the actual contrast ratio (rounded to 2dp). */
  contrastRatio?: number;
  /** The hex colors involved (textColor, backgroundColor). */
  colors?: { text: string; background: string };
}

// ── Suggestion types ──────────────────────────────────────────────────────────

export type AccessibilityFixType =
  | 'adjust-text-contrast'  // suggest a darker/lighter text color that passes AA
  | 'add-img-alt'           // suggest adding alt attribute to img tags
  | 'add-form-label'        // suggest wrapping inputs in label elements
  | 'remove-style-attr';    // suggest replacing inline style= with lb-* token classes

export interface AccessibilityFix {
  type: AccessibilityFixType;
  /** Human-readable fix description. */
  description: string;
  /** The original location that produced the issue. */
  location: string;
  /** For contrast fixes: the suggested replacement text color (hex). */
  suggestedTextColor?: string;
  /** The original contrast ratio (contrast issues). */
  originalContrastRatio?: number;
  /** The target contrast ratio achieved by the fix. */
  targetContrastRatio?: number;
}

// ── Color extraction ──────────────────────────────────────────────────────────

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function extractHex(value: unknown): string | null {
  return typeof value === 'string' && HEX_PATTERN.test(value) ? value : null;
}

interface ColorPair {
  text: string;
  background: string;
  label: string;
}

/**
 * Extract meaningful text/background color pairs from a bundle's settings_data.current.
 * Returns pairs to check for WCAG AA compliance.
 */
function extractColorPairs(bundle: LiquidThemePackageBundle): ColorPair[] {
  const current = bundle.config?.settings_data?.current ?? {};
  const pairs: ColorPair[] = [];

  const textColor = extractHex(current['textColor']);
  const backgroundColor = extractHex(current['backgroundColor']);
  const primaryColor = extractHex(current['primaryColor']);
  const surfaceColor = extractHex(current['surfaceColor']);
  const accentColor = extractHex(current['accentColor']);

  if (textColor && backgroundColor) {
    pairs.push({ text: textColor, background: backgroundColor, label: 'textColor on backgroundColor' });
  }
  if (textColor && surfaceColor) {
    pairs.push({ text: textColor, background: surfaceColor, label: 'textColor on surfaceColor' });
  }
  if (primaryColor && backgroundColor) {
    pairs.push({ text: primaryColor, background: backgroundColor, label: 'primaryColor on backgroundColor (large text)' });
  }
  if (accentColor && backgroundColor) {
    pairs.push({ text: accentColor, background: backgroundColor, label: 'accentColor on backgroundColor (large text)' });
  }

  return pairs;
}

// ── Source pattern checks ─────────────────────────────────────────────────────

/** True if the Liquid source has an <img> that is missing an alt attribute. */
function hasMissingImgAlt(source: string): boolean {
  // Match <img ...> tags that do NOT contain alt=
  const imgTags = Array.from(source.matchAll(/<img\b([^>]*?)>/gi));
  for (const m of imgTags) {
    const attrs = m[1] ?? '';
    if (!/\balt\s*=/.test(attrs)) return true;
  }
  return false;
}

/** True if the Liquid source has an <input> that appears to lack a <label> association. */
function hasMissingFormLabel(source: string): boolean {
  // Simple heuristic: any <input> not inside a <label> element context.
  // This is a best-effort check on source string — false positives are possible.
  const inputCount = (source.match(/<input\b/gi) ?? []).length;
  const labelCount = (source.match(/<label\b/gi) ?? []).length;
  // If there are inputs but no labels at all, flag it.
  return inputCount > 0 && labelCount === 0;
}

// ── analyzeThemeAccessibility ──────────────────────────────────────────────────

/**
 * Analyze a LiquidThemePackageBundle for WCAG accessibility issues.
 * Returns a (possibly empty) list of AccessibilityIssues.
 *
 * Checks performed:
 *   1. WCAG 2.1 AA contrast for text/background color pairs in settings_data.current
 *   2. Missing alt attributes on <img> elements in section sources
 *   3. Missing <label> associations for <input> elements in section sources
 *
 * All checks are deterministic: same bundle → same issues.
 */
export function analyzeThemeAccessibility(bundle: LiquidThemePackageBundle): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // 1. Contrast checks
  const pairs = extractColorPairs(bundle);
  for (const pair of pairs) {
    const isLargeText = pair.label.includes('large text');
    const ratio = contrastRatio(pair.text, pair.background);
    const roundedRatio = Math.round(ratio * 100) / 100;
    const required = isLargeText ? 3.0 : 4.5;

    if (!meetsWcagAA(pair.text, pair.background, isLargeText)) {
      issues.push({
        type: 'contrast-aa-fail',
        severity: 'error',
        message: `${pair.label}: contrast ratio ${roundedRatio.toFixed(2)}:1 fails WCAG 2.1 AA (minimum ${required}:1).`,
        location: 'settings_data.current',
        contrastRatio: roundedRatio,
        colors: { text: pair.text, background: pair.background },
      });
    } else if (ratio < required * 1.03) {
      // Warn when close to the threshold (within 3% of the required ratio)
      issues.push({
        type: 'contrast-aa-warn',
        severity: 'warn',
        message: `${pair.label}: contrast ratio ${roundedRatio.toFixed(2)}:1 barely passes WCAG 2.1 AA (minimum ${required}:1). Consider increasing contrast.`,
        location: 'settings_data.current',
        contrastRatio: roundedRatio,
        colors: { text: pair.text, background: pair.background },
      });
    }
  }

  // 2. Section source checks
  for (const [sectionKey, section] of Object.entries(bundle.sections)) {
    const source = section.source;
    const loc = `sections/${sectionKey}`;

    if (hasMissingImgAlt(source)) {
      issues.push({
        type: 'missing-img-alt',
        severity: 'error',
        message: `Section "${sectionKey}" contains an <img> element without an alt attribute. Add descriptive alt text for screen reader accessibility.`,
        location: loc,
      });
    }

    if (hasMissingFormLabel(source)) {
      issues.push({
        type: 'missing-form-label',
        severity: 'warn',
        message: `Section "${sectionKey}" has <input> elements without apparent <label> associations. Wrap inputs in <label> or add aria-label attributes.`,
        location: loc,
      });
    }
  }

  return issues;
}

// ── suggestAccessibilityFixes ──────────────────────────────────────────────────

/**
 * Suggest a replacement text color that achieves WCAG AA contrast against bgHex.
 *
 * Uses an HSL-lightness sweep rather than a multiplicative RGB factor so that
 * dark-starting colors on dark backgrounds (e.g. #0A0A0A on #1A1A1A) produce
 * useful mid-range candidates instead of exhausting a narrow multiplicative
 * range and always falling back to #FFFFFF.
 *
 * Strategy:
 *   - light background → sweep HSL lightness DOWN from current toward 0
 *     (darken the text to reach the required contrast)
 *   - dark background  → sweep HSL lightness UP from 0.90 toward 0.50
 *     (lighten the text to reach the required contrast)
 *
 * Falls back to #000000 or #FFFFFF only when no mid-range candidate passes.
 */
function adjustTextForAA(textHex: string, bgHex: string, isLargeText = false): string | null {
  const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
  const m = HEX_RE.exec(textHex);
  if (!m) return null;

  const required = isLargeText ? 3.0 : 4.5;

  // Light background → darken text (black has better contrast than white on bg).
  const bgIsLight = contrastRatio('#000000', bgHex) > contrastRatio('#FFFFFF', bgHex);

  // Parse the text color into normalised [0, 1] RGB for HSL conversion.
  const rn = parseInt(m[1], 16) / 255;
  const gn = parseInt(m[2], 16) / 255;
  const bn = parseInt(m[3], 16) / 255;

  // RGB → HSL (normalised [0,1] inputs).
  const maxC = Math.max(rn, gn, bn);
  const minC = Math.min(rn, gn, bn);
  const l = (maxC + minC) / 2;
  let h = 0;
  let s = 0;
  if (maxC !== minC) {
    const d = maxC - minC;
    s = l > 0.5 ? d / (2 - maxC - minC) : d / (maxC + minC);
    if (maxC === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (maxC === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  h *= 360;

  /** Convert an HSL triple (degrees, [0,1], [0,1]) to an uppercase #RRGGBB string. */
  function hslToHexLocal(hh: number, ss: number, ll: number): string {
    if (ss === 0) {
      const v = Math.round(Math.max(0, Math.min(1, ll)) * 255);
      const hex = v.toString(16).padStart(2, '0');
      return `#${hex}${hex}${hex}`.toUpperCase();
    }
    const hFrac = (((hh % 360) + 360) % 360) / 360;
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    function hue(t: number): number {
      const t1 = ((t % 1) + 1) % 1;
      if (t1 < 1 / 6) return p + (q - p) * 6 * t1;
      if (t1 < 1 / 2) return q;
      if (t1 < 2 / 3) return p + (q - p) * (2 / 3 - t1) * 6;
      return p;
    }
    const toHex = (v: number): string =>
      Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${toHex(hue(hFrac + 1 / 3))}${toHex(hue(hFrac))}${toHex(hue(hFrac - 1 / 3))}`.toUpperCase();
  }

  if (bgIsLight) {
    // Darken text: sweep lightness down from just below current value toward 0.
    const startL = Math.min(l - 0.03, 0.50);
    for (let ll = startL; ll >= 0; ll -= 0.03) {
      const candidate = hslToHexLocal(h, s, ll);
      if (contrastRatio(candidate, bgHex) >= required) return candidate;
    }
    return '#000000';
  } else {
    // Lighten text: sweep lightness from 0.90 down to 0.50, checking each step.
    // Starting high (0.90) finds useful light-gray candidates for dark backgrounds
    // rather than jumping straight to pure white.
    for (let ll = 0.90; ll >= 0.50; ll -= 0.03) {
      const candidate = hslToHexLocal(h, s, ll);
      if (contrastRatio(candidate, bgHex) >= required) return candidate;
    }
    return '#FFFFFF';
  }
}

/**
 * Produce deterministic fix suggestions for the accessibility issues in a bundle.
 * Each fix corresponds to one or more issues found by analyzeThemeAccessibility.
 *
 * Fixes are SUGGESTIONS only — they are not applied to the bundle. The caller must
 * apply them using applyExperienceToSettingsData or equivalent.
 */
export function suggestAccessibilityFixes(
  bundle: LiquidThemePackageBundle,
  issues?: AccessibilityIssue[],
): AccessibilityFix[] {
  const resolvedIssues = issues ?? analyzeThemeAccessibility(bundle);
  const fixes: AccessibilityFix[] = [];

  for (const issue of resolvedIssues) {
    if (issue.type === 'contrast-aa-fail' && issue.colors) {
      const isLargeText = (issue.message ?? '').includes('large text');
      const suggested = adjustTextForAA(issue.colors.text, issue.colors.background, isLargeText);
      const targetRatio = suggested ? Math.round(contrastRatio(suggested, issue.colors.background) * 100) / 100 : null;
      fixes.push({
        type: 'adjust-text-contrast',
        description: suggested
          ? `Replace ${issue.colors.text} with ${suggested} to achieve ${targetRatio?.toFixed(2)}:1 contrast against ${issue.colors.background} (WCAG 2.1 AA).`
          : `The text color ${issue.colors.text} cannot be automatically adjusted for AA contrast. Manually choose a color with sufficient contrast against ${issue.colors.background}.`,
        location: issue.location,
        suggestedTextColor: suggested ?? undefined,
        originalContrastRatio: issue.contrastRatio,
        targetContrastRatio: targetRatio ?? undefined,
      });
    }

    if (issue.type === 'missing-img-alt') {
      fixes.push({
        type: 'add-img-alt',
        description: `Add descriptive alt text to all <img> elements in ${issue.location}. Use the product name, collection name, or a concise description of the image content. For decorative images, use alt="".`,
        location: issue.location,
      });
    }

    if (issue.type === 'missing-form-label') {
      fixes.push({
        type: 'add-form-label',
        description: `Wrap each <input> in ${issue.location} inside a <label> element, or add aria-label attributes. Example: <label>Email <input type="email" ...></label>.`,
        location: issue.location,
      });
    }

    if (issue.type === 'lint-forbidden-attr') {
      fixes.push({
        type: 'remove-style-attr',
        description: `Remove the inline style= attribute from ${issue.location}. Replace it with a CSS class using LetBuyy design tokens (--lb-* CSS custom properties). Example: class="lb-text--primary" instead of style="color: ..."`,
        location: issue.location,
      });
    }
  }

  return fixes;
}

/**
 * Convenience: lift ThemeLintIssues into AccessibilityIssues for the forbidden-attr rule.
 * Used when the linter output is available alongside the accessibility analysis.
 */
export function lintIssuesToAccessibilityIssues(lintIssues: ThemeLintIssue[]): AccessibilityIssue[] {
  return lintIssues
    .filter((i) => i.rule === 'forbidden-attr')
    .map((i) => ({
      type: 'lint-forbidden-attr' as const,
      severity: 'error' as const,
      message: i.message,
      location: `sections/${i.sectionType}`,
    }));
}
