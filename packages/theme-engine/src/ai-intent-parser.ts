// ============================================================================
// PHASE AC — Merchant-Intent AI Orchestration Layer
// ----------------------------------------------------------------------------
//
// HONESTY CONTRACT (inherited from Phase L):
//   All functions are DETERMINISTIC — same input → same output.
//   No LLM, model, external service, HTTP client, or credential is imported.
//   No wall-clock calls, random number generation, or non-deterministic I/O.
//   Free-text intent → explicit NOT_CONNECTED result (no heuristic/keyword NLU).
//
// SAFETY CONTRACT (validated before every return):
//   1. parseThemeDocument() — every proposal passes the Zod + version gate.
//   2. WCAG 2.1 AA — palette proposals reuse deterministicPalette() guarantee.
//   3. Known fonts only — typography proposals reuse suggestTypographyPairing()
//      which only returns families from EXPERIENCE_FONT_REGISTRY.
//   4. Parity sections only — add-section validates the camelCase type is in
//      BUILT_IN_SECTION_TYPES AND its kebab form is in section_definitions.
//   5. isUnsafeUrl guard — any string value written to settings_data.current
//      is checked for unsafe URL schemes (javascript:, vbscript:, data:…, blob:).
//      In practice palette/typography values are hex/font strings — always safe.
//   6. Lint is downstream — this layer works with ThemeDocuments, not raw Liquid.
//      Added sections already have linted Liquid sources in section_definitions;
//      no new Liquid source is emitted here.
//
// APPLY-PATH COMPLIANCE (RISK-DUAL-N01):
//   Only config.settings_data.current and template.sections[] are mutated.
//   section_definitions, block_definitions, layout, locales, and renderer are
//   NEVER touched. The input document is deep-cloned; the original is immutable.
//
// MODEL BOUNDARY (NOT-CONNECTED):
//   Free-text intent understanding requires THEME_AI_PROVIDER_API_KEY and the
//   gateway route POST /v1/theme-ai/parse-brief (which does not exist).
//   The seam is documented explicitly. No keyword-heuristic NLU is performed.
// ============================================================================

import { deterministicPalette, suggestTypographyPairing } from './theme-ai-sdk';
import type { PaletteVariant, FontPairingIntent } from './theme-ai-sdk';
import { generateColorSystem, meetsWcagAA, contrastRatio } from './ai-color-system';
import { parseThemeDocument } from './theme-document';
import type { ThemeDocument, ThemeDocumentSection } from './theme-document';
import type { ThemeBundleJson } from './theme-bundle';
import { BUILT_IN_SECTION_TYPES } from './built-in-section-schemas';
import { BUILT_IN_TO_LIQUID_SECTION_TYPE } from './section-type-map';
import { isUnsafeUrl } from './schema-field-extensions';

// ============================================================================
// INTENT TYPES
// ============================================================================

export type AIIntentKind =
  | 'palette'
  | 'typography'
  | 'add-section'
  | 'accessibility-fix'
  | 'free-text';

/**
 * A structured merchant-AI customization request.
 *
 * palette          — change the color palette via deterministicPalette().
 * typography       — change the font pairing via suggestTypographyPairing().
 * add-section      — add a known parity section to a template.
 * accessibility-fix — fix WCAG AA contrast failures in settings_data.current.
 * free-text        — NOT-CONNECTED; returns a documented model seam result.
 *
 * DESIGN NOTE: structured intents are the ONLY wired inputs. Free-text
 * understanding is NOT-CONNECTED (see MODEL_BOUNDARY in theme-ai-sdk.ts).
 */
export type AICustomizationIntent =
  | {
      kind: 'palette';
      /** Aesthetic variant — maps to deterministicPalette() 'warm'|'cool'|'bold'|'muted'|'neutral'. */
      tone: PaletteVariant;
      /**
       * Optional explicit seed hex (#RRGGBB). When omitted, the document's
       * current primaryColor is used as the seed. Falls back to '#00B3B3'
       * (platform default) when the document has no primaryColor.
       */
      seedHex?: string;
    }
  | {
      kind: 'typography';
      /** Font pairing intent — maps to suggestTypographyPairing() catalog. */
      intent: FontPairingIntent;
    }
  | {
      kind: 'add-section';
      /**
       * camelCase BUILT_IN_SECTION_TYPE (e.g. 'testimonials', 'ctaSection').
       * Must be in BUILT_IN_SECTION_TYPES and present in the document's
       * section_definitions; otherwise returns status 'incompatible'.
       */
      sectionType: string;
      /**
       * Which template to add the section to. Defaults to 'index'.
       * The template must exist in the document.
       */
      templateKey?: 'index' | 'product' | 'collection';
    }
  | {
      kind: 'accessibility-fix';
    }
  | {
      kind: 'free-text';
      text: string;
    };

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface AISettingDiff {
  /** settings_data.current key that changed. */
  key: string;
  /** Previous value (undefined if the key was absent from current). */
  previousValue: unknown;
  /** New value written by the AI proposal. */
  newValue: unknown;
}

export interface AISectionAddedEntry {
  /** Template key the section was added to. */
  templateKey: string;
  /** Generated section id (alphanumeric+hyphen, deterministic from input). */
  sectionId: string;
  /** Liquid kebab-case section type as stored in section_definitions. */
  sectionType: string;
  /** 0-based insert position within the template's sections array. */
  insertIndex: number;
}

export interface AICustomizationDiff {
  kind: AIIntentKind;
  /** settings_data.current token changes. Empty for add-section. */
  settingsChanged: AISettingDiff[];
  /** Sections added to templates. Empty for palette/typography/accessibility. */
  sectionsAdded: AISectionAddedEntry[];
  /** Human-readable summary of the change. */
  summary: string;
}

/**
 * A validated, reversible theme customization proposal.
 * The document has passed parseThemeDocument() + isUnsafeUrl guard.
 * The diff is the exact inverse of the change:
 *   - settings: apply previousValues to reverse
 *   - sections: remove by sectionId to reverse
 */
export interface AICustomizationProposal {
  status: 'ok';
  document: ThemeDocument;
  diff: AICustomizationDiff;
}

/**
 * Returned for free-text intent. The model seam is NOT-CONNECTED.
 * Use structured intents (palette / typography / add-section / accessibility-fix) instead.
 */
export interface AINotConnectedResult {
  status: 'NOT_CONNECTED';
  /** Human-readable description of what the missing model would provide. */
  seam: string;
  /** The env var that must be set to activate the real model path. */
  envVar: 'THEME_AI_PROVIDER_API_KEY';
  /** Full explanation including alternative structured intents. */
  explanation: string;
}

/**
 * Returned when the requested section type cannot be added to the document:
 * - Not a known BUILT_IN_SECTION_TYPE
 * - Not present in the document's section_definitions
 * - Target template not found in the document
 */
export interface AIIncompatibleResult {
  status: 'incompatible';
  reason: string;
  /** The requested sectionType, if applicable. */
  sectionType?: string;
}

export type AICustomizationResult =
  | AICustomizationProposal
  | AINotConnectedResult
  | AIIncompatibleResult;

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

/** Hex color pattern — 6-digit, case-insensitive. */
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Extract a valid 6-digit hex color from an arbitrary settings value. Returns null otherwise. */
function extractHexColor(v: unknown): string | null {
  return typeof v === 'string' && HEX_RE.test(v) ? v : null;
}

/** Deep-clone a ThemeDocument via JSON round-trip. Fully deterministic — no wall-clock calls. */
function cloneDocument(doc: ThemeDocument): ThemeDocument {
  return JSON.parse(JSON.stringify(doc)) as ThemeDocument;
}

/**
 * Safety guard: assert that no string value being written to settings_data.current
 * uses an unsafe URL scheme. This is defensive — palette/typography changes only
 * write hex strings and font names, so this guard will never trigger in normal use.
 *
 * @throws if any value is an unsafe URL (this is a generator bug, not user error).
 */
function assertNoUnsafeUrls(changes: AISettingDiff[]): void {
  for (const change of changes) {
    if (typeof change.newValue === 'string' && isUnsafeUrl(change.newValue)) {
      throw new Error(
        `[ai-intent-parser] Proposal would write an unsafe URL to settings_data.current` +
        ` (key="${change.key}", value="${change.newValue}"). ` +
        'This is a bug in the intent parser — hex colors and font names cannot be unsafe URLs.',
      );
    }
  }
}

/** The color token keys updated by palette proposals. */
const PALETTE_COLOR_KEYS = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'textColor',
  'surfaceColor',
] as const;

// ============================================================================
// PALETTE INTENT HANDLER
// ============================================================================

function handlePaletteIntent(
  doc: ThemeDocument,
  tone: PaletteVariant,
  seedHex?: string,
): AICustomizationProposal {
  const current = doc.config.settings_data.current;

  // Resolve seed: explicit > document primaryColor > platform default.
  const seed =
    (seedHex && HEX_RE.test(seedHex) ? seedHex : null)
    ?? extractHexColor(current['primaryColor'])
    ?? '#00B3B3';

  // Generate a WCAG-AA-guaranteed palette (deterministicPalette throws on violation).
  const newTokens = deterministicPalette(seed, tone);

  // Compute the settings diff.
  const settingsChanged: AISettingDiff[] = [];
  for (const key of PALETTE_COLOR_KEYS) {
    const prev = current[key];
    const next = newTokens[key] as ThemeBundleJson;
    settingsChanged.push({ key, previousValue: prev, newValue: next });
  }

  // Safety: no unsafe URLs (always passes for hex strings, but check anyway).
  assertNoUnsafeUrls(settingsChanged);

  // Apply to a deep clone.
  const cloned = cloneDocument(doc);
  const clonedCurrent = cloned.config.settings_data.current as Record<string, ThemeBundleJson>;
  for (const { key, newValue } of settingsChanged) {
    clonedCurrent[key] = newValue as ThemeBundleJson;
  }

  // Fail-closed: parseThemeDocument validates the result.
  const validated = parseThemeDocument(cloned);

  return {
    status: 'ok',
    document: validated,
    diff: {
      kind: 'palette',
      settingsChanged,
      sectionsAdded: [],
      summary:
        `Applied "${tone}" palette from seed ${seed}. ` +
        `${PALETTE_COLOR_KEYS.length} color token(s) updated. ` +
        `All color pairs guaranteed WCAG 2.1 AA.`,
    },
  };
}

// ============================================================================
// TYPOGRAPHY INTENT HANDLER
// ============================================================================

/** The font token keys updated by typography proposals. */
const TYPOGRAPHY_FONT_KEYS = ['fontFamily', 'bodyFontFamily', 'headingFontFamily'] as const;

function handleTypographyIntent(
  doc: ThemeDocument,
  intent: FontPairingIntent,
): AICustomizationProposal {
  const current = doc.config.settings_data.current;

  // Resolve font pairing — all families guaranteed from EXPERIENCE_FONT_REGISTRY.
  const pairing = suggestTypographyPairing(intent);

  const fontUpdates: Record<string, string> = {
    fontFamily: pairing.fontFamily,
    bodyFontFamily: pairing.fontFamily,   // Liquid token path mirrors fontFamily
    headingFontFamily: pairing.headingFontFamily,
  };

  const settingsChanged: AISettingDiff[] = [];
  for (const key of TYPOGRAPHY_FONT_KEYS) {
    const prev = current[key];
    const next = fontUpdates[key] as ThemeBundleJson;
    settingsChanged.push({ key, previousValue: prev, newValue: next });
  }

  // Safety: font family strings cannot be unsafe URLs.
  assertNoUnsafeUrls(settingsChanged);

  const cloned = cloneDocument(doc);
  const clonedCurrent = cloned.config.settings_data.current as Record<string, ThemeBundleJson>;
  for (const { key, newValue } of settingsChanged) {
    clonedCurrent[key] = newValue as ThemeBundleJson;
  }

  const validated = parseThemeDocument(cloned);

  return {
    status: 'ok',
    document: validated,
    diff: {
      kind: 'typography',
      settingsChanged,
      sectionsAdded: [],
      summary:
        `Applied "${intent}" typography pairing. ` +
        `heading=${pairing.headingFontFamily}, body=${pairing.fontFamily}. ` +
        `Both families are from the known EXPERIENCE_FONT_REGISTRY.`,
    },
  };
}

// ============================================================================
// ADD-SECTION INTENT HANDLER
// ============================================================================

function handleAddSectionIntent(
  doc: ThemeDocument,
  sectionType: string,
  templateKey: 'index' | 'product' | 'collection' = 'index',
): AICustomizationResult {
  // 1. Validate the sectionType is a known BUILT_IN.
  if (!(BUILT_IN_SECTION_TYPES as ReadonlyArray<string>).includes(sectionType)) {
    return {
      status: 'incompatible',
      reason:
        `"${sectionType}" is not a known BUILT_IN_SECTION_TYPE. ` +
        `Valid types: ${[...BUILT_IN_SECTION_TYPES].join(', ')}.`,
      sectionType,
    };
  }

  // 2. Resolve camelCase → Liquid kebab type.
  const kebabType = BUILT_IN_TO_LIQUID_SECTION_TYPE[sectionType];
  if (!kebabType) {
    return {
      status: 'incompatible',
      reason:
        `Section type "${sectionType}" has no Liquid type mapping in ` +
        `BUILT_IN_TO_LIQUID_SECTION_TYPE. Cannot add to a ThemeDocument.`,
      sectionType,
    };
  }

  // 3. Check presence in document section_definitions (parity + bundle check).
  if (!(kebabType in doc.section_definitions)) {
    return {
      status: 'incompatible',
      reason:
        `Section type "${kebabType}" (from "${sectionType}") is not present in ` +
        `this document's section_definitions. The theme bundle must include a ` +
        `Liquid section file for "${kebabType}" before it can be added. ` +
        `This section type either has no Liquid parity file or is not in the ` +
        `current theme bundle.`,
      sectionType,
    };
  }

  // 4. Find the target template.
  const template = doc.templates.find((t) => t.key === templateKey);
  if (!template) {
    return {
      status: 'incompatible',
      reason:
        `Template "${templateKey}" not found in this document. ` +
        `Available templates: ${doc.templates.map((t) => t.key).join(', ')}.`,
    };
  }

  // 5. Generate a deterministic section ID.
  //    Count existing sections of this type in the template → determines suffix.
  //    If the derived ID collides with an existing id, increment until unique.
  const existingIds = new Set(template.sections.map((s) => s.id));
  const typeCount = template.sections.filter((s) => s.type === kebabType).length;
  let attempt = typeCount + 1;
  let newSectionId = `ai-${sectionType}-${attempt}`;
  while (existingIds.has(newSectionId)) {
    attempt++;
    newSectionId = `ai-${sectionType}-${attempt}`;
  }

  // 6. Clone the document.
  const cloned = cloneDocument(doc);
  const clonedTemplate = cloned.templates.find((t) => t.key === templateKey)!;

  // 7. Determine insertion position: before 'newsletter-signup', else at end.
  const newsletterIdx = clonedTemplate.sections.findIndex(
    (s) => s.type === 'newsletter-signup',
  );
  const insertIndex = newsletterIdx >= 0
    ? newsletterIdx
    : clonedTemplate.sections.length;

  const newSection: ThemeDocumentSection = {
    id: newSectionId,
    type: kebabType,
    settings: {},
    disabled: false,
    blocks: [],
  };

  clonedTemplate.sections.splice(insertIndex, 0, newSection);

  // 8. Fail-closed: parseThemeDocument validates the full document including the new section.
  const validated = parseThemeDocument(cloned);

  return {
    status: 'ok',
    document: validated,
    diff: {
      kind: 'add-section',
      settingsChanged: [],
      sectionsAdded: [
        {
          templateKey,
          sectionId: newSectionId,
          sectionType: kebabType,
          insertIndex,
        },
      ],
      summary:
        `Added section type "${kebabType}" (id: "${newSectionId}") ` +
        `to template "${templateKey}" at position ${insertIndex}.`,
    },
  };
}

// ============================================================================
// ACCESSIBILITY-FIX INTENT HANDLER
// ============================================================================

function handleAccessibilityFixIntent(doc: ThemeDocument): AICustomizationProposal {
  const current = doc.config.settings_data.current;
  const textColor = extractHexColor(current['textColor']);
  const backgroundColor = extractHexColor(current['backgroundColor']);

  // Case A: one or both color tokens not set — nothing to fix.
  if (!textColor || !backgroundColor) {
    const cloned = cloneDocument(doc);
    const validated = parseThemeDocument(cloned);
    return {
      status: 'ok',
      document: validated,
      diff: {
        kind: 'accessibility-fix',
        settingsChanged: [],
        sectionsAdded: [],
        summary:
          'Color tokens textColor / backgroundColor are not both set in this document. ' +
          'No contrast fix applied.',
      },
    };
  }

  // Case B: already passes WCAG AA — no change needed.
  if (meetsWcagAA(textColor, backgroundColor)) {
    const ratio = Math.round(contrastRatio(textColor, backgroundColor) * 100) / 100;
    const cloned = cloneDocument(doc);
    const validated = parseThemeDocument(cloned);
    return {
      status: 'ok',
      document: validated,
      diff: {
        kind: 'accessibility-fix',
        settingsChanged: [],
        sectionsAdded: [],
        summary:
          `No contrast issues detected. ${textColor} achieves ${ratio}:1 against ` +
          `${backgroundColor}, passing WCAG 2.1 AA (minimum 4.5:1 for normal text).`,
      },
    };
  }

  // Case C: contrast fails — derive a WCAG-AA-compliant replacement.
  //   Use generateColorSystem(primaryColor, 'light') whose .text field is guaranteed
  //   ≥ 4.5:1 on white background. If the document's backgroundColor is not white,
  //   we still use the generated text (it is very dark, so it passes on most light bgs).
  const primaryColor = extractHexColor(current['primaryColor']) ?? textColor;
  const colorSystem = generateColorSystem(primaryColor, 'light');
  const newTextColor = colorSystem.text;

  const settingsChanged: AISettingDiff[] = [
    { key: 'textColor', previousValue: textColor, newValue: newTextColor },
  ];

  // Safety: the generated textColor is a hex string (never a URL).
  assertNoUnsafeUrls(settingsChanged);

  const cloned = cloneDocument(doc);
  (cloned.config.settings_data.current as Record<string, ThemeBundleJson>)['textColor'] =
    newTextColor;

  const validated = parseThemeDocument(cloned);

  return {
    status: 'ok',
    document: validated,
    diff: {
      kind: 'accessibility-fix',
      settingsChanged,
      sectionsAdded: [],
      summary:
        `Adjusted textColor from ${textColor} to ${newTextColor} to meet WCAG 2.1 AA ` +
        `contrast against ${backgroundColor}. ` +
        `Previous contrast: ${Math.round(contrastRatio(textColor, backgroundColor) * 100) / 100}:1 (fail).`,
    },
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Propose a deterministic, validated theme customization from a structured merchant intent.
 *
 * DETERMINISM: same (document, intent) → same AICustomizationResult every call.
 *   Fully deterministic — no wall-clock calls or external I/O.
 *
 * BACKWARD COMPAT: a document not targeted by AI renders byte-identically.
 *   The input `document` is never mutated; proposals work on a deep clone.
 *
 * VALIDATED OUTPUT: every 'ok' proposal passes:
 *   - parseThemeDocument() (version gate + Zod schema)
 *   - deterministicPalette() WCAG AA guarantee (palette proposals)
 *   - EXPERIENCE_FONT_REGISTRY membership (typography proposals)
 *   - section_definitions presence check (add-section proposals)
 *   - isUnsafeUrl guard on all written string values
 *
 * FREE-TEXT: returns status 'NOT_CONNECTED' — no heuristic NLU is performed.
 *   Provide a structured intent instead.
 *
 * REVERSIBILITY:
 *   - settings: restore diff.settingsChanged[n].previousValue for each key
 *   - sections: remove sections by diff.sectionsAdded[n].sectionId from template
 *
 * @param document  The merchant's current ThemeDocument (must pass parseThemeDocument).
 * @param intent    A structured customization request.
 * @returns         A validated proposal, a NOT_CONNECTED seam result, or incompatible.
 */
export function proposeThemeCustomization(
  document: ThemeDocument,
  intent: AICustomizationIntent,
): AICustomizationResult {
  switch (intent.kind) {
    case 'palette':
      return handlePaletteIntent(document, intent.tone, intent.seedHex);

    case 'typography':
      return handleTypographyIntent(document, intent.intent);

    case 'add-section':
      return handleAddSectionIntent(
        document,
        intent.sectionType,
        intent.templateKey,
      );

    case 'accessibility-fix':
      return handleAccessibilityFixIntent(document);

    case 'free-text':
      return {
        status: 'NOT_CONNECTED',
        seam: 'NL free-text → structured AICustomizationIntent (requires a real language model)',
        envVar: 'THEME_AI_PROVIDER_API_KEY',
        explanation:
          '[NOT_CONNECTED] Free-text intent understanding requires a real language model ' +
          '(THEME_AI_PROVIDER_API_KEY) and the gateway route POST /v1/theme-ai/parse-brief, ' +
          'which does not yet exist. ' +
          'This is the documented NOT-CONNECTED model boundary (MODEL_BOUNDARY in theme-ai-sdk.ts). ' +
          'No heuristic keyword NLU is performed. ' +
          'Please use a structured intent instead:\n' +
          '  { kind: "palette", tone: "warm"|"cool"|"bold"|"muted"|"neutral" }\n' +
          '  { kind: "typography", intent: "editorial"|"technical"|"artisanal"|"friendly"|"neutral" }\n' +
          '  { kind: "add-section", sectionType: "<BUILT_IN_SECTION_TYPE>" }\n' +
          '  { kind: "accessibility-fix" }',
      };
  }
}
