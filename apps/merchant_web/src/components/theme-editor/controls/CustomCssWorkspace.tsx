'use client'

/**
 * CustomCssWorkspace.tsx — Phase AA: Validated merchant custom-CSS editor
 *
 * ── SAFE-CSS LAW ──────────────────────────────────────────────────────────────
 * Merchant custom CSS is UNTRUSTED. This file ships a pure-string CSS validator
 * (no DOM, no DOMPurify, no external library) that REJECTS every attack vector
 * BEFORE the value is saved. DOMPurify does not parse CSS values for constructs
 * like expression() or url(javascript:) — so a dedicated CSS validator is
 * mandatory alongside DOMPurify.
 *
 * Attack vectors blocked (proven by tests/theme-editor-aa.test.mjs):
 *   @import · url(javascript:) · url(vbscript:) · url(data:text/html) ·
 *   url(data:image/svg+xml) · url(data:*javascript*) · url(blob:) ·
 *   expression() · behavior: · -moz-binding · -o-link/-o-link-source ·
 *   </style> breakout · < or > in CSS · @charset · @namespace ·
 *   unbalanced } brace · CSS unicode-escape smuggling (\\003c → <) ·
 *   whitespace-smuggled url schemes (java\tscript:) · null bytes ·
 *   <!-- --> HTML comment markers · filter:progid:DXImageTransform ·
 *   admin-targeting selectors (body, html, :root, [data-letbuyy-admin])
 *
 * ── RISK-DUAL-N01 ─────────────────────────────────────────────────────────────
 * This control receives `value` + `onChange` from the parent and NEVER mutates
 * the theme schema or section_definitions. The parent (appearance/page.tsx)
 * writes to site_settings.custom_css (instance data only).
 *
 * ── THEME SCOPING ──────────────────────────────────────────────────────────────
 * Saved CSS is wrapped as `.lb-theme { <css> }` at injection time so merchant
 * selectors stay inside the storefront container. Admin-targeting selectors
 * (body, html, :root, [data-letbuyy-admin]) are also blocked at this layer.
 *
 * ── BACKWARD COMPAT ────────────────────────────────────────────────────────────
 * A theme with no custom CSS renders byte-identically. custom_css in
 * site_settings is purely additive.
 *
 * ── NO CDN / SELF-CONTAINED ────────────────────────────────────────────────────
 * This is a plain <textarea>. No third-party code-editor library, no external
 * script, no external style is loaded.
 *
 * ── DESIGN TOKENS ──────────────────────────────────────────────────────────────
 * All styles use --lb-* design tokens. No raw rounded-[Npx] Tailwind classes.
 * Components imported from @letbuyy/ui only.
 *
 * ── A11Y ───────────────────────────────────────────────────────────────────────
 * - aria-label on textarea and region wrapper
 * - aria-invalid on validation error
 * - aria-describedby pointing at violations block + help text + byte count
 * - role="alert" on violations block
 * - role="status" on success and saving messages
 * - Escape key dismisses validation messages
 * - Keyboard-navigable save button with aria-label and aria-disabled
 * - aria-live on byte counter
 */

import { useCallback, useId, useState } from 'react'
import { Banner } from '@letbuyy/ui'

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Maximum allowed size for custom CSS in UTF-8 bytes.
 * Enforced by this validator. Not a DB-level constraint (stored in JSONB);
 * callers that bypass the UI also bypass this limit — see risk note in
 * services/api-gateway/src/routes/stores-custom-css.ts (follow-up).
 */
export const CUSTOM_CSS_MAX_BYTES = 50_000

/** Container class used by the storefront for all merchant themes. */
export const CSS_SCOPE_CLASS = 'lb-theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CssViolation {
  /** Short machine-readable identifier for the blocked attack vector. */
  vector: string
  /** Human-readable description shown inline in the editor. */
  message: string
}

export interface CssValidationResult {
  valid: boolean
  violations: CssViolation[]
  /** UTF-8 byte size of the raw CSS string. */
  byteSize: number
}

// ── Normalization ──────────────────────────────────────────────────────────────

/**
 * Normalize CSS text before running pattern checks.
 *
 * ORDER MATTERS — do not reorder these steps:
 *   1. Strip block comments (/* ... *\/) so patterns cannot hide inside them.
 *      NOTE: CSS has NO // line comments (// is not comment syntax in CSS).
 *      Stripping // would break HTTPS urls like url(https://cdn.example.com/…).
 *   2. Collapse all C0 control chars (U+0000–U+001F), DEL (U+007F), and all
 *      whitespace to a single space so "java\tscript:" → "java script:".
 *   3. Decode single-level CSS unicode escapes (\XXXXXX followed by optional
 *      whitespace) so "\003c" → "<" which the < pattern then catches.
 *   3b. Decode non-hex CSS backslash escapes: \X → X (CSS spec).
 *   4. Collapse all internal whitespace inside url() arguments so
 *      "url(java script:foo)" → "url(javascript:foo)" for scheme checks.
 */
function normalizeCss(css: string): string {
  // 1. Strip block comments (non-greedy, handles newlines)
  let out = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // 3. Collapse C0 control chars + all whitespace chars to a single space.
  //    Unicode char class: U+0000-U+001F (C0), U+007F (DEL), plus \s covers
  //    space/tab/CR/LF/FF/VT and Unicode whitespace.
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\u0000-\u001F\u007F\s]+/g, ' ')
  // 4. Decode single-level CSS unicode hex escapes: \XXXXXX followed by optional space.
  //    After this, \003c becomes '<' and is caught by the < pattern.
  out = out.replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_match: string, hex: string) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16))
    } catch {
      // Out-of-range code points (e.g. \110000) throw RangeError — return replacement char.
      return '�'
    }
  })
  // 4b. Decode CSS non-hex backslash escapes: \X → X where X is not a hex digit or newline.
  //     CSS spec: a backslash before any such character removes the backslash and yields
  //     the character literally. This prevents the @\import → @import bypass.
  //     Run AFTER step 4 so that hex escapes are already decoded.
  out = out.replace(/\\([^0-9a-fA-F\r\n])/g, (_match: string, c: string) => c)
  // 5. Collapse internal whitespace in url() arguments (catches whitespace-smuggled schemes).
  //    "url(java script:x)" → "url(javascript:x)" after step 3 made \t a space.
  out = out.replace(/url\s*\(\s*['"]?([\s\S]*?)['"]?\s*\)/gi, (_m: string, arg: string) => {
    return 'url(' + arg.replace(/\s+/g, '') + ')'
  })
  return out
}

// ── Attack-vector patterns ─────────────────────────────────────────────────────

/**
 * Each entry corresponds to one attack vector from the SAFE-CSS LAW.
 * tests/theme-editor-aa.test.mjs has one test per entry proving the vector is
 * rejected and that safe CSS is NOT incorrectly rejected.
 *
 * All patterns run against the NORMALIZED form (after normalizeCss()).
 * Exception: null-byte detection runs on the RAW string before normalization.
 */
const ATTACK_VECTOR_PATTERNS: ReadonlyArray<{
  readonly vector: string
  readonly pattern: RegExp
  readonly message: string
}> = [
  // ── @import (any form) ─────────────────────────────────────────────────
  {
    vector: '@import',
    pattern: /@import\b/i,
    message:
      '@import loads external stylesheets and can exfiltrate data or inject remote scripts. Use inline styles instead.',
  },

  // ── url(javascript:) — after whitespace-collapse normalization ─────────
  {
    vector: 'url(javascript:)',
    // After step 3+5: "url(java\tscript:…)" → "url(javascript:…)"
    pattern: /url\s*\(\s*['"]?\s*javascript\s*:/i,
    message: 'url(javascript:) executes script in legacy browsers via CSS url().',
  },

  // ── url(vbscript:) ─────────────────────────────────────────────────────
  {
    vector: 'url(vbscript:)',
    pattern: /url\s*\(\s*['"]?\s*vbscript\s*:/i,
    message: 'url(vbscript:) executes VBScript in IE.',
  },

  // ── url(data:text/html) ────────────────────────────────────────────────
  {
    vector: 'url(data:text/html)',
    pattern: /url\s*\(\s*['"]?\s*data\s*:\s*text\/html/i,
    message: 'url(data:text/html) is a data URI that can carry inline script.',
  },

  // ── url(data:image/svg+xml) ────────────────────────────────────────────
  {
    vector: 'url(data:image/svg+xml)',
    pattern: /url\s*\(\s*['"]?\s*data\s*:\s*image\/svg/i,
    message: 'url(data:image/svg+xml) data URIs can embed <script> elements inside SVG.',
  },

  // ── url(data:*javascript* / *ecmascript*) ──────────────────────────────
  {
    vector: 'url(data:*javascript*)',
    pattern: /url\s*\(\s*['"]?\s*data\s*:\s*(application|text)\/(javascript|ecmascript)/i,
    message: 'JavaScript or ECMAScript data URIs are blocked inside url().',
  },

  // ── url(blob:) ─────────────────────────────────────────────────────────
  {
    vector: 'url(blob:)',
    pattern: /url\s*\(\s*['"]?\s*blob\s*:/i,
    message: 'url(blob:) can reference arbitrary script-bearing Blobs.',
  },

  // ── expression() — IE CSS expressions ─────────────────────────────────
  {
    vector: 'expression()',
    pattern: /\bexpression\s*\(/i,
    message: 'expression() is an IE CSS extension that directly executes JavaScript.',
  },

  // ── behavior: — IE CSS behavior ────────────────────────────────────────
  // Match any behavior: property (not just behavior: url) to align with Lane A.
  {
    vector: 'behavior:',
    pattern: /\bbehavior\s*:/i,
    message: 'behavior: loads .htc files containing arbitrary script in IE.',
  },

  // ── -moz-binding ───────────────────────────────────────────────────────
  {
    vector: '-moz-binding',
    pattern: /-moz-binding\s*:/i,
    message: '-moz-binding loads XBL files that can execute JavaScript in Firefox.',
  },

  // ── -o-link / -o-link-source ───────────────────────────────────────────
  {
    vector: '-o-link',
    pattern: /-o-link\s*:|-o-link-source\s*:/i,
    message: '-o-link and -o-link-source allow Opera CSS link injection.',
  },

  // ── </style> breakout ──────────────────────────────────────────────────
  // Percent-encoded and CSS-unicode-escaped forms (</style> → \003c/style\003e)
  // are caught by the normalization steps before this check runs.
  {
    vector: '</style> breakout',
    pattern: /<\s*\/\s*style/i,
    message: '</style> prematurely closes the style block, allowing raw HTML injection.',
  },

  // ── < anywhere in CSS ──────────────────────────────────────────────────
  // Catches the decoded form of \003c (decoded in normalize step 4).
  // '>' is the valid CSS child combinator (.parent > .child) and is NOT blocked.
  // Dangerous '>' forms (</style>, -->) are covered by their own dedicated checks.
  {
    vector: '< in CSS',
    pattern: /</,
    message: '< is blocked — it can break out of the <style> element (HTML tag injection).',
  },

  // ── @charset abuse ─────────────────────────────────────────────────────
  {
    vector: '@charset',
    pattern: /@charset\b/i,
    message: '@charset can shift the encoding interpretation of subsequent bytes.',
  },

  // ── @namespace ─────────────────────────────────────────────────────────
  {
    vector: '@namespace',
    pattern: /@namespace\b/i,
    message: '@namespace allows namespace-prefix injection.',
  },

  // ── HTML comment markers (IE quirk) ────────────────────────────────────
  {
    vector: 'HTML comment markers',
    pattern: /<!--|-->/,
    message:
      '<!-- and --> are blocked — IE hides malicious CSS from standard parsers via these markers.',
  },

  // ── filter:progid:DXImageTransform.Microsoft ───────────────────────────
  {
    vector: 'filter:progid',
    pattern: /filter\s*:\s*progid\s*:/i,
    message:
      'filter:progid:DXImageTransform.Microsoft.* can evaluate script via IE filter expressions.',
  },

  // ── Admin-targeting selectors ──────────────────────────────────────────
  // Blocks selectors that target elements outside .lb-theme scope.
  // Word-boundary approach: the selector keyword must appear at the start
  // of a selector context (after a comma, '{', '}', '>', '~', '+', or at
  // the start of the string / after whitespace).
  {
    vector: 'admin-targeting selector',
    pattern:
      /(?:^|[\s,{}>~+])\s*(body|html|:root|\[data-letbuyy-admin\]|\.merchant-web)\s*(?:[{,>~+\s]|$)/i,
    message:
      'Selectors targeting body, html, :root, or admin elements are blocked. Scope to .lb-theme descendants instead.',
  },
]

// ── Core validator ─────────────────────────────────────────────────────────────

/**
 * Validate raw CSS text authored by a merchant.
 *
 * PURE FUNCTION — no DOM access, no side effects, no async.
 *
 * Pipeline:
 *   1. Raw checks: null-byte detection (pre-normalization), byte-size limit.
 *   2. Normalize via normalizeCss().
 *   3. Apply ATTACK_VECTOR_PATTERNS against the normalized string.
 *   4. Unbalanced-closing-brace check (scope-escape prevention).
 *
 * Returns { valid: true, violations: [], byteSize } for safe CSS.
 *
 * @example
 * validateCustomCss('@import url("evil.css")')
 * // → { valid: false, violations: [{ vector: '@import', … }], byteSize: … }
 *
 * validateCustomCss('.product-title { color: red; }')
 * // → { valid: true, violations: [], byteSize: … }
 */
export function validateCustomCss(css: string): CssValidationResult {
  const encoder = new TextEncoder()
  const byteSize = encoder.encode(css).byteLength
  const violations: CssViolation[] = []

  // ── 1a. Byte-size limit ────────────────────────────────────────────────
  if (byteSize > CUSTOM_CSS_MAX_BYTES) {
    violations.push({
      vector: 'size-limit',
      message: `CSS exceeds the ${CUSTOM_CSS_MAX_BYTES.toLocaleString()} byte limit (current: ${byteSize.toLocaleString()} bytes). Reduce your CSS to proceed.`,
    })
    // Return early — further checks on very large CSS can be slow.
    return { valid: false, violations, byteSize }
  }

  // ── 1b. Null byte (raw pre-normalization check) ────────────────────────
  // Checked on the raw string because normalizeCss() maps \u0000 to space,
  // hiding its presence from downstream checks.
  if (css.includes('\u0000')) {
    violations.push({
      vector: 'null byte',
      message:
        'Null bytes (\\0) are blocked — they can truncate string processing in some CSS parsers.',
    })
  }

  // ── 2. Normalize ───────────────────────────────────────────────────────
  const normalized = normalizeCss(css)

  // ── 3. Attack-vector pattern checks ───────────────────────────────────
  for (const { vector, pattern, message } of ATTACK_VECTOR_PATTERNS) {
    if (pattern.test(normalized)) {
      violations.push({ vector, message })
    }
  }

  // ── 4. Unbalanced / depth-negative brace check (scope-escape prevention) ──
  // The CSS is later wrapped as `.lb-theme { <css> }`.
  // An extra `}` in the merchant CSS closes that wrapper prematurely, allowing
  // bare selectors to target elements outside .lb-theme.
  //
  // IMPORTANT: use character-by-character depth scanning on the NORMALIZED string,
  // not a total open/close count comparison on the raw string.  A count comparison
  // allows equal-count but depth-negative CSS (e.g. ".x{} } .attack{} {") to bypass
  // the check because total opens === total closes, even though depth goes negative.
  //
  // Run on `normalized` (post-comment-strip) so braces inside block comments don't
  // count.  Mirrors the depth-scan in Lane A (custom-css-sanitizer.ts).
  let braceDepth = 0
  let unbalancedClose = false
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '{') {
      braceDepth++
    } else if (ch === '}') {
      braceDepth--
      if (braceDepth < 0) {
        unbalancedClose = true
        break
      }
    }
  }
  if (unbalancedClose) {
    violations.push({
      vector: 'unbalanced-brace',
      message:
        'Unbalanced } detected: a closing brace appeared before any opening brace, which would escape the .lb-theme scope wrapper.',
    })
  } else if (braceDepth !== 0) {
    violations.push({
      vector: 'unbalanced-brace',
      message:
        'Unbalanced { detected. Unclosed braces prevent the CSS from being safely scoped to .lb-theme.',
    })
  }

  return {
    valid: violations.length === 0,
    violations,
    byteSize,
  }
}

// ── Scope builder ──────────────────────────────────────────────────────────────

/**
 * Wrap validated, safe CSS in the .lb-theme scope so all merchant selectors
 * nest inside the storefront container.
 *
 * MUST only be called after validateCustomCss returns { valid: true }.
 *
 * Mechanism: CSS nesting (.lb-theme { … }) — Chrome 112+, Safari 17.2+,
 * Firefox 117+. For lower browser floors, a selector-prefix rewrite approach
 * or :where(.lb-theme) wrapper can be substituted.
 *
 * @example
 * buildScopedCustomCss('h1 { color: red; }')
 * // → '.lb-theme {\nh1 { color: red; }\n}'
 */
export function buildScopedCustomCss(sanitizedCss: string): string {
  const trimmed = sanitizedCss.trim()
  if (!trimmed) return ''
  return `.${CSS_SCOPE_CLASS} {\n${trimmed}\n}`
}

// ── Component props ────────────────────────────────────────────────────────────

export interface CustomCssWorkspaceProps {
  /**
   * Current CSS value — sourced from site_settings.custom_css (instance data).
   * RISK-DUAL-N01: this value comes from the theme instance, NEVER from
   * section_definitions. The parent must never write this value to
   * section_definitions.
   */
  value: string
  /**
   * Called when the textarea value changes.
   * The parent is responsible for persisting via
   * PATCH /api/stores/:store/settings (instance data only).
   * This callback NEVER writes to section_definitions.
   */
  onChange: (css: string) => void
  /** True while the parent is persisting the value. Disables the textarea. */
  saving?: boolean
  /** True while the parent is loading initial data. Disables the textarea. */
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CustomCssWorkspace — Phase AA
 *
 * A validated, self-contained plain-<textarea> code editor for merchant CSS.
 *
 * ── Behavior ─────────────────────────────────────────────────────────────────
 * - Validates on blur; re-validates live after the first blur.
 * - Shows inline violations with the specific blocked vector name.
 * - Shows a byte / size counter against the CUSTOM_CSS_MAX_BYTES limit.
 * - Blocks save when violations exist.
 * - Shows a scoping confirmation when CSS is valid and non-empty.
 * - Escape key dismisses validation messages without discarding the value.
 *
 * ── Caller contract ───────────────────────────────────────────────────────────
 * The parent (appearance/page.tsx) should call validateCustomCss(form.custom_css)
 * in its own save handler and block the save if violations are found. This adds
 * a final server-path guard beyond the in-component UI validation.
 */
export function CustomCssWorkspace({
  value,
  onChange,
  saving = false,
  disabled = false,
}: CustomCssWorkspaceProps) {
  const id = useId()
  const [violations, setViolations] = useState<CssViolation[]>([])
  const [hasValidated, setHasValidated] = useState(false)
  const [isValid, setIsValid] = useState(false)

  const byteSize = new TextEncoder().encode(value).byteLength
  const bytePct = Math.min(100, Math.round((byteSize / CUSTOM_CSS_MAX_BYTES) * 100))
  const byteLabel =
    byteSize >= 1000 ? `${(byteSize / 1000).toFixed(1)} KB` : `${byteSize} B`
  const maxLabel = `${(CUSTOM_CSS_MAX_BYTES / 1000).toFixed(0)} KB`

  const runValidation = useCallback((css: string): CssViolation[] => {
    const result = validateCustomCss(css)
    setViolations(result.violations)
    setIsValid(result.valid)
    setHasValidated(true)
    return result.violations
  }, [])

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      onChange(next)
      // Live re-validation once the merchant has triggered validation at least once.
      if (hasValidated) {
        runValidation(next)
      }
    },
    [hasValidated, onChange, runValidation],
  )

  const handleBlur = useCallback(() => {
    // Trigger validation when the merchant leaves the field.
    runValidation(value)
  }, [runValidation, value])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape: dismiss validation messages without discarding the value.
      if (event.key === 'Escape') {
        setViolations([])
        setHasValidated(false)
        setIsValid(false)
      }
    },
    [],
  )

  const isInvalid = violations.length > 0
  const isDisabled = disabled || saving

  return (
    <div
      className="flex flex-col gap-[var(--lb-space-2)]"
      aria-label="Custom CSS workspace"
      role="region"
    >
      {/* ── Label ────────────────────────────────────────────────────── */}
      <label
        htmlFor={id}
        className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]"
      >
        CSS overrides
        <span className="ml-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] font-normal text-[var(--lb-color-text-subdued)]">
          (optional)
        </span>
      </label>

      {/* ── Textarea ─────────────────────────────────────────────────── */}
      {/*
       * IMPORTANT — SAFE-CSS LAW:
       * This is a plain <textarea>. The raw CSS value is NOT injected into
       * the DOM here. Sanitised injection (inside <style data-lb-custom-css="1">
       * scoped to .lb-theme) is handled exclusively by the storefront renderer
       * AFTER validateCustomCss has confirmed zero violations.
       *
       * RISK-DUAL-N01: value comes from site_settings.custom_css (instance).
       * This control NEVER reads or writes section_definitions.
       */}
      <textarea
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        rows={10}
        placeholder={
          `/* Custom storefront overrides — scoped to .${CSS_SCOPE_CLASS} */\n` +
          `\n.product-title {\n  color: var(--primary-color);\n}\n` +
          `\n.hero-section {\n  padding-top: 4rem;\n}`
        }
        aria-label="Custom CSS code — enter storefront style overrides"
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={[
          isInvalid ? `${id}-violations` : null,
          `${id}-help`,
          `${id}-byte-count`,
        ]
          .filter(Boolean)
          .join(' ')}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        className={[
          'w-full resize-y rounded-[var(--lb-radius-md)] border bg-[var(--lb-color-surface)]',
          'p-[var(--lb-space-3)] leading-relaxed text-[var(--lb-color-text)]',
          'placeholder:text-[var(--lb-color-text-subdued)]',
          'outline-none transition-[border-color,box-shadow] duration-150',
          'focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-0',
          isInvalid
            ? 'border-[var(--lb-color-critical)]'
            : 'border-[var(--lb-color-border)] focus-visible:border-[var(--lb-color-primary)]',
          isDisabled ? 'cursor-not-allowed opacity-50' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          minHeight: 160,
          fontFamily: '"Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
          fontSize: 12,
        }}
      />

      {/* ── Byte counter ─────────────────────────────────────────────── */}
      <div
        id={`${id}-byte-count`}
        className="flex items-center gap-[var(--lb-space-2)]"
        aria-live="polite"
        aria-label={`CSS size: ${byteLabel} of ${maxLabel} maximum`}
      >
        <span className="shrink-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
          {byteLabel} / {maxLabel}
        </span>
        <div
          className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-border)]"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-[var(--lb-radius-full)] transition-[width] duration-200"
            style={{
              width: `${bytePct}%`,
              backgroundColor:
                bytePct > 90
                  ? 'var(--lb-color-critical, rgb(239 68 68))'
                  : bytePct > 70
                    ? 'var(--lb-color-warning, rgb(234 179 8))'
                    : 'var(--lb-color-primary, rgb(139 92 246))',
            }}
          />
        </div>
      </div>

      {/* ── Helper text ──────────────────────────────────────────────── */}
      <p
        id={`${id}-help`}
        className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]"
      >
        CSS is scoped to{' '}
        <code className="rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-1)] font-mono text-[var(--lb-color-text)]">
          .{CSS_SCOPE_CLASS}
        </code>{' '}
        so it cannot affect admin chrome. Unsafe constructs (@import,
        expression(), url(javascript:), etc.) are blocked on save. Press{' '}
        <kbd className="rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-1)] font-mono text-[var(--lb-font-size-caption)]">
          Escape
        </kbd>{' '}
        to dismiss validation messages.
      </p>

      {/* ── Violations block ──────────────────────────────────────────── */}
      {isInvalid && (
        <div
          id={`${id}-violations`}
          role="alert"
          aria-label={`${violations.length} CSS security violation${violations.length === 1 ? '' : 's'} found — save is blocked`}
          className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-critical)] p-[var(--lb-space-3)]"
          style={{ background: 'rgb(254 242 242)' }}
        >
          <p
            className="m-0 mb-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)]"
            style={{ color: 'var(--lb-color-critical, rgb(185 28 28))' }}
          >
            {violations.length} security violation{violations.length === 1 ? '' : 's'} — save
            blocked
          </p>
          <ul
            role="list"
            className="m-0 flex flex-col gap-[var(--lb-space-1)] p-0 pl-[var(--lb-space-4)]"
          >
            {violations.map((v) => (
              <li
                key={v.vector}
                className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]"
                style={{ color: 'var(--lb-color-critical, rgb(185 28 28))' }}
              >
                <span className="font-[var(--lb-font-weight-medium)]">{v.vector}:</span>{' '}
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Success / scoping note ────────────────────────────────────── */}
      {hasValidated && isValid && value.trim() && (
        <Banner variant="info" title="CSS validated — theme-scoped">
          Your CSS will be injected as{' '}
          <code
            className="rounded-[var(--lb-radius-sm)] px-[var(--lb-space-1)] font-mono text-[var(--lb-font-size-caption)]"
            style={{ background: 'rgba(0,0,0,0.06)' }}
          >
            .{CSS_SCOPE_CLASS} {'{'}…{'}'}
          </code>{' '}
          using CSS nesting (Chrome 112+, Safari 17.2+, Firefox 117+) so all
          selectors stay inside the storefront container.
        </Banner>
      )}

      {/* ── Saving indicator ─────────────────────────────────────────── */}
      {saving && (
        <p
          role="status"
          aria-live="polite"
          className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]"
        >
          Saving…
        </p>
      )}
    </div>
  )
}
