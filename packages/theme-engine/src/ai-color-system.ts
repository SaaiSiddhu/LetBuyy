// ============================================================================
// PHASE L2 — AI Color System: WCAG contrast math + deterministic palette generator
// ----------------------------------------------------------------------------
// HONESTY CONTRACT:
//   All functions here are deterministic algorithms — same input → same output.
//   No LLM, model, or external service is involved.
//   The step that maps a merchant's NL color description ("warm and earthy") to a
//   seed hex color requires a real language model and is NOT-CONNECTED in this repo
//   (env var: THEME_AI_PROVIDER_API_KEY via services/api-gateway, not in theme-engine).
//   This module accepts an already-structured hex color as input.
//
// WCAG 2.1 math sources:
//   IEC 61966-2-1 (sRGB linearization)
//   WCAG 2.1 SC 1.4.3 (AA: 4.5:1 normal, 3:1 large text)
//   WCAG 2.1 SC 1.4.6 (AAA: 7:1 normal, 4.5:1 large text)
// ============================================================================

import { ExperienceColorSystemSchema } from './theme-presets';

// ── sRGB linearization (IEC 61966-2-1) ──────────────────────────────────────

/**
 * Linearize a single sRGB channel value in [0, 1].
 * Implements the piecewise function from IEC 61966-2-1.
 */
function linearizeSrgbChannel(c: number): number {
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}

// ── Hex parsing ──────────────────────────────────────────────────────────────

/** Parse a 6-digit hex color string (#RRGGBB or #rrggbb) to 0–255 RGB components. */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length !== 6) throw new Error(`ai-color-system: invalid hex color "${hex}"`);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ── WCAG 2.1 core math ───────────────────────────────────────────────────────

/**
 * Compute the WCAG 2.1 relative luminance of a hex color.
 * L = 0.2126R + 0.7152G + 0.0722B on linearized sRGB channels.
 * Returns a value in [0, 1] (0 = black, 1 = white).
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const R = linearizeSrgbChannel(r / 255);
  const G = linearizeSrgbChannel(g / 255);
  const B = linearizeSrgbChannel(b / 255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colors.
 * ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 * Result is in [1, 21]. Argument order does not matter.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 SC 1.4.3 Level AA contrast check.
 * Normal text: ratio ≥ 4.5:1. Large text (≥18pt / ≥14pt bold): ratio ≥ 3:1.
 */
export function meetsWcagAA(textHex: string, bgHex: string, isLargeText = false): boolean {
  return contrastRatio(textHex, bgHex) >= (isLargeText ? 3.0 : 4.5);
}

/**
 * WCAG 2.1 SC 1.4.6 Level AAA contrast check.
 * Normal text: ratio ≥ 7:1. Large text: ratio ≥ 4.5:1.
 */
export function meetsWcagAAA(textHex: string, bgHex: string, isLargeText = false): boolean {
  return contrastRatio(textHex, bgHex) >= (isLargeText ? 4.5 : 7.0);
}

// ── Color space utilities (internal) ─────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hueToRgbChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgbChannel(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgbChannel(p, q, hn) * 255),
    b: Math.round(hueToRgbChannel(p, q, hn - 1 / 3) * 255),
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexFromRgb(r: number, g: number, b: number): string {
  return `#${clampByte(r).toString(16).padStart(2, '0')}${clampByte(g).toString(16).padStart(2, '0')}${clampByte(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return hexFromRgb(r, g, b);
}

function shiftHue(h: number, delta: number): number {
  return ((h + delta) % 360 + 360) % 360;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── generateColorSystem ───────────────────────────────────────────────────────

/**
 * The six-color palette shape produced by generateColorSystem.
 * Matches ExperienceColorSystemSchema (primary, secondary, accent, background, text, surface).
 */
export interface GeneratedColorSystem {
  /** The seed color. */
  primary: string;
  /** A darker/shifted variant of the primary for depth and hierarchy. */
  secondary: string;
  /** A split-complement accent for calls-to-action and highlights. */
  accent: string;
  /** Page background (#FFFFFF for light mode). */
  background: string;
  /**
   * Body text color. GUARANTEED to meet WCAG 2.1 SC 1.4.3 AA (≥4.5:1 contrast
   * with background). The lightness is nudged downward until the ratio passes.
   */
  text: string;
  /** A very lightly tinted surface for cards and panels. */
  surface: string;
}

/**
 * Generate a 6-color palette from a seed hex color with GUARANTEED WCAG AA contrast.
 *
 * Derivation is purely deterministic: same `seedHex` + `mode` → same palette.
 * The output is validated through ExperienceColorSystemSchema.
 *
 * mode: 'light' (default) — light background (#FFFFFF), dark text.
 *       'dark'            — dark background, light text.
 *
 * NOT-CONNECTED seam: the step that picks the seed hex from a merchant's natural-language
 * brief ("earthy and warm tones") requires a real LLM and is NOT implemented in
 * packages/theme-engine. The provider env var is THEME_AI_PROVIDER_API_KEY and the
 * NL→hex boundary lives in services/api-gateway (not in this pure library).
 */
export function generateColorSystem(
  seedHex: string,
  mode: 'light' | 'dark' = 'light',
): GeneratedColorSystem {
  const { r, g, b } = parseHex(seedHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const normalizedSeed = hexFromRgb(r, g, b); // normalized uppercase

  if (mode === 'light') {
    const background = '#FFFFFF';

    // Surface: seed hue, very desaturated, very high lightness (~97%)
    const surface = hslToHex(h, clamp01(s * 0.15), 0.97);

    // Secondary: hue-15°, 85% saturation of seed, 15% darker (clamped to ≥5% so it's visible)
    const secondary = hslToHex(
      shiftHue(h, -15),
      clamp01(s * 0.85),
      clamp01(Math.max(l - 0.15, 0.05)),
    );

    // Accent: split-complement (+150° hue shift), vivid
    const accentH = shiftHue(h, 150);
    const accentS = clamp01(Math.min(s * 1.1 + 0.05, 0.90));
    const accentL = clamp01(l < 0.35 ? Math.min(l + 0.15, 0.55) : Math.max(l - 0.1, 0.38));
    const accent = hslToHex(accentH, accentS, accentL);

    // Text: seed hue, low saturation, very dark — start at 8% lightness (always passes AA on white)
    let textL = 0.08;
    const textS = clamp01(s * 0.3);
    let textHex = hslToHex(h, textS, textL);

    // Safety loop: nudge darker until contrast passes (rarely needed — 8% lightness on white ≫ 4.5:1)
    while (!meetsWcagAA(textHex, background) && textL > 0) {
      textL = Math.max(0, textL - 0.01);
      textHex = hslToHex(h, textS, textL);
    }

    // Post-loop invariant: the text color MUST pass WCAG AA. If it does not, this is
    // a bug in the generator (starting textL=0.08 on white should always exceed 4.5:1).
    if (!meetsWcagAA(textHex, background)) {
      throw new Error(
        `[ai-color-system] generateColorSystem: generated text color "${textHex}" fails ` +
        `WCAG AA on background "${background}" — this is a generator bug.`,
      );
    }

    return ExperienceColorSystemSchema.parse({
      primary: normalizedSeed,
      secondary,
      accent,
      background,
      text: textHex,
      surface,
    });
  }

  // Dark mode
  // Background: seed hue, faintly saturated, very dark (~8% lightness)
  const background = hslToHex(h, clamp01(s * 0.2), 0.08);

  // Surface: slightly lighter dark (~14% lightness)
  const surface = hslToHex(h, clamp01(s * 0.15), 0.14);

  // Secondary: lighter/brighter for dark mode
  const secondary = hslToHex(
    shiftHue(h, -15),
    clamp01(s * 0.85),
    clamp01(Math.min(l + 0.15, 0.75)),
  );

  // Accent: vivid complement, bright enough to pop on dark background
  const accentH = shiftHue(h, 150);
  const accentS = clamp01(Math.min(s * 1.15 + 0.1, 0.90));
  const accent = hslToHex(accentH, accentS, 0.60);

  // Text: very light, start at 90% lightness
  let textL = 0.90;
  let textHex = hslToHex(h, 0.05, textL);

  // Safety loop: nudge lighter until contrast passes
  while (!meetsWcagAA(textHex, background) && textL < 1.0) {
    textL = Math.min(1.0, textL + 0.01);
    textHex = hslToHex(h, 0.05, textL);
  }

  // Post-loop invariant: the dark-mode text color MUST pass WCAG AA. The loop
  // starts at textL=0.90 against a dark background (L≈0.06), giving >10:1 contrast
  // before any iteration, so this throw guards against future parameter changes.
  if (!meetsWcagAA(textHex, background)) {
    throw new Error(
      `[ai-color-system] generateColorSystem: generated dark-mode text color "${textHex}" ` +
      `fails WCAG AA on background "${background}" — this is a generator bug.`,
    );
  }

  return ExperienceColorSystemSchema.parse({
    primary: normalizedSeed,
    secondary,
    accent,
    background,
    text: textHex,
    surface,
  });
}
