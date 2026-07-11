// Phase AA — Custom CSS Sanitizer (Lane A)
//
// validateAndScopeCustomCss(css, {scopeSelector, maxBytes}) → { ok, safeCss?, violations[] }
//
// SAFE-CSS LAW: merchant-authored custom CSS is UNTRUSTED. This module is the sole
// gate between raw merchant input and the inline <style> tag emitted by the theme
// renderer. DOMPurify is NOT a CSS parser and does not deep-inspect CSS values for
// expression()/url(javascript:)/etc. — this module fills that gap.
//
// Design contract:
//  1. Fail-closed: any doubt → violation, ok:false, no safeCss emitted.
//  2. Deterministic: same input always produces same output.
//  3. No DOM / browser globals required (pure string operations, Node-safe).
//  4. Scoping: valid CSS is wrapped in `${scopeSelector}{<css>}` (CSS nesting,
//     Chrome 112+/Firefox 117+/Safari 17.2+) so merchant selectors cannot reach
//     admin chrome or other tenants' storefronts.
//  5. Backward-compat: empty/undefined input → { ok: true, violations: [] } with no safeCss.
//
// Injection vectors blocked (each must have a failing-if-removed test):
//   @import                  — loads external stylesheets; data-exfiltration + remote script
//   @charset                 — encoding-shift attack
//   @namespace               — namespace prefix injection
//   url(javascript:)         — script execution in legacy browsers
//   url(vbscript:)           — VBScript execution
//   url(data:text/html)      — HTML data URI with inline script
//   url(data:image/svg)      — SVG data URI with <script>
//   url(data:*javascript*)   — JS MIME data URIs
//   url(data:*ecmascript*)   — ECMAScript MIME data URIs
//   url(data:application/xhtml) — XHTML data URI
//   url(blob:)               — blob URI with script
//   expression()             — IE CSS expression; direct JS eval
//   behavior:                — IE .htc behavior; arbitrary script
//   -moz-binding:            — Firefox XUL/XBL binding; inline script
//   -o-link:                 — Opera CSS link injection
//   -o-link-source:          — Opera CSS link injection
//   filter: progid:          — IE DXImageTransform filter; script eval
//   </style>                 — style-block breakout; subsequent bytes = HTML
//   <!-- / -->               — IE CSS hide / HTML comment injection
//   < or >                   — HTML angle-bracket injection
//   CSS unicode escapes       — e.g. \3c/style\3e decoded to </style>
//   whitespace-smuggled url   — java\t script: / java\nscript: bypass
//   null bytes               — string truncation in some parsers
//   unbalanced braces        — escape from .lb-theme{ } scope wrapper
//
// NOT modified: LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG (LOCKED).

// ---------------------------------------------------------------------------
// Public constant
// ---------------------------------------------------------------------------

/** Maximum allowed byte length for merchant custom CSS (UTF-8 encoded). */
export const CUSTOM_CSS_MAX_BYTES = 50_000;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CustomCssValidationResult {
  /** true when the CSS passed all checks; safeCss is populated. */
  ok: boolean;
  /**
   * The validated, normalised, scope-wrapped CSS ready for injection into a
   * `<style data-lb-custom-css="1">` element.
   * Present only when ok === true and the input was non-empty.
   */
  safeCss?: string;
  /** Human-readable description of each blocked vector (empty when ok === true). */
  violations: string[];
}

// ---------------------------------------------------------------------------
// Internal: normalisation
// ---------------------------------------------------------------------------

/**
 * Strip CSS block comments ( `/ * … * /` ).
 * CSS has no line comments (// is not CSS). No CDATA or HTML comment stripping
 * here — those are caught as explicit violations later.
 */
function stripCssBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Decode a single pass of CSS Unicode escapes: `\XXXXXX` (1–6 hex digits,
 * followed by one optional ASCII space/tab that is consumed as part of the
 * escape sequence).  Reveals characters hidden as `\3c` → `<`, `\3e` → `>`,
 * `\0069mport` → `import`, etc.
 *
 * Only one decode pass is applied. An attacker would need more than six
 * consecutive hex digits to defeat a single-pass decoder, which is not valid
 * CSS.
 */
function decodeCssUnicodeEscapes(css: string): string {
  return css.replace(/\\([0-9a-fA-F]{1,6})[ \t]?/g, (_, hex: string) => {
    const cp = parseInt(hex, 16);
    // Replacement character for surrogates / out-of-range code points
    if (cp > 0x10_ffff) return '�';
    try {
      return String.fromCodePoint(cp);
    } catch {
      return '�';
    }
  });
}

/**
 * Decode CSS non-hex backslash escapes: `\X` where X is NOT a hex digit and
 * NOT a newline.  Per the CSS spec, a backslash before any such character
 * simply removes the backslash and yields the character literally.  This
 * prevents the `@\import` → `@import` bypass: `i` is not a hex digit, so
 * `decodeCssUnicodeEscapes` leaves `\import` intact; this pass removes the
 * backslash to reveal `import`, which the `@import` guard then catches.
 *
 * Run AFTER `decodeCssUnicodeEscapes` so that hex escapes already decoded
 * to their code points are not re-processed here.
 *
 * Newlines (CR/LF) are deliberately excluded: CSS ignores `\<newline>` as a
 * line continuation and the whitespace-collapse step neutralises them anyway.
 */
function decodeCssNonHexEscapes(css: string): string {
  // Matches backslash followed by any char that is not a hex digit or newline.
  return css.replace(/\\([^0-9a-fA-F\r\n])/g, (_, c: string) => c);
}

/**
 * Collapse ASCII whitespace (0x09 HT, 0x0A LF, 0x0D CR, 0x20 SP) and C0
 * control characters (0x00–0x1F) to a single ASCII space.  This defeats
 * whitespace-smuggling attacks such as `java\tscript:` or `java\nscript:`.
 */
function collapseControlAndWhitespace(css: string): string {
  return css.replace(/[\x00-\x20]+/g, ' ');
}

/**
 * Full normalisation pipeline — apply in strict order:
 *   1. Strip block comments (prevent comment-obfuscated payloads)
 *   2. Decode CSS Unicode hex escapes (reveal hidden chars, e.g. \3c → <)
 *   3. Decode CSS non-hex backslash escapes (\X → X, e.g. \import → import)
 *   4. Collapse C0 / whitespace (defeat whitespace-smuggling)
 */
function normalizeCss(css: string): string {
  return collapseControlAndWhitespace(
    decodeCssNonHexEscapes(
      decodeCssUnicodeEscapes(
        stripCssBlockComments(css),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Internal: url() value extraction
// ---------------------------------------------------------------------------

/**
 * Extract the URL string from every `url(...)` occurrence in the CSS text.
 * Uses a character-scanning approach rather than a regex to handle unquoted
 * URLs correctly without risking catastrophic backtracking.
 */
function extractUrlValues(css: string): string[] {
  const results: string[] = [];
  const lower = css.toLowerCase();
  let i = 0;
  while (i < lower.length) {
    const urlIdx = lower.indexOf('url(', i);
    if (urlIdx === -1) break;
    i = urlIdx + 4; // advance past 'url('
    // Skip leading whitespace inside the parens
    while (i < css.length && (css[i] === ' ' || css[i] === '\t')) i++;
    // Detect optional quote delimiter
    const quote = (css[i] === '"' || css[i] === "'") ? css[i]! : null;
    if (quote !== null) i++; // consume opening quote
    let value = '';
    if (quote !== null) {
      // Quoted URL — read until matching closing quote
      while (i < css.length && css[i] !== quote) {
        value += css[i]!;
        i++;
      }
      if (i < css.length) i++; // consume closing quote
    } else {
      // Unquoted URL — read until closing paren
      while (i < css.length && css[i] !== ')') {
        value += css[i]!;
        i++;
      }
    }
    results.push(value.trim());
  }
  return results;
}

// ---------------------------------------------------------------------------
// Internal: unsafe URL scheme detection
// ---------------------------------------------------------------------------

/**
 * Prefix table for URL schemes that can cause script execution or
 * security-relevant resource loads when placed inside CSS `url()`.
 *
 * Deliberately not exported — callers should use `hasUnsafeCssUrlScheme`.
 */
const UNSAFE_CSS_URL_SCHEME_PREFIXES: ReadonlyArray<string> = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:text/javascript',
  'data:text/ecmascript',
  'data:image/svg',            // catches data:image/svg+xml
  'data:application/javascript',
  'data:application/ecmascript',
  'data:application/xhtml',
  'blob:',
];

/**
 * Returns true if the URL value (extracted from a CSS `url()`) contains an
 * unsafe scheme after stripping all ASCII whitespace and null bytes.
 *
 * Stripping whitespace defeats `java\tscript:` / `java\nscript:` smuggling.
 */
export function hasUnsafeCssUrlScheme(urlValue: string): boolean {
  // Strip all whitespace and control chars including null bytes from the scheme check
  const stripped = urlValue.replace(/[\x00-\x20\x7f]+/g, '').toLowerCase();
  return UNSAFE_CSS_URL_SCHEME_PREFIXES.some((scheme) => stripped.startsWith(scheme));
}

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

export interface ValidateAndScopeOptions {
  /**
   * CSS selector to wrap the merchant CSS inside, e.g. `.lb-theme`.
   * Defaults to `.lb-theme` when not provided.
   */
  scopeSelector?: string;
  /**
   * Maximum UTF-8 byte length of the raw input CSS.
   * Defaults to `CUSTOM_CSS_MAX_BYTES` (50 000).
   */
  maxBytes?: number;
}

/**
 * Validate and scope merchant-authored custom CSS.
 *
 * ```ts
 * const result = validateAndScopeCustomCss(rawCss, { scopeSelector: '.lb-theme' });
 * if (!result.ok) throw new Error(result.violations.join('\n'));
 * // result.safeCss is ready for injection into <style data-lb-custom-css="1">
 * ```
 */
export function validateAndScopeCustomCss(
  css: string,
  options: ValidateAndScopeOptions = {},
): CustomCssValidationResult {
  const scopeSelector = options.scopeSelector ?? '.lb-theme';
  const maxBytes = options.maxBytes ?? CUSTOM_CSS_MAX_BYTES;

  // --- (0) Backward-compat: empty / missing input → no-op success ---
  if (!css || css.trim() === '') {
    return { ok: true, violations: [] };
  }

  // --- (1) Size guard (checked against raw bytes before any processing) ---
  const rawByteLength = Buffer.byteLength(css, 'utf8');
  if (rawByteLength > maxBytes) {
    return {
      ok: false,
      violations: [
        `Custom CSS exceeds the maximum size of ${maxBytes} bytes (received ${rawByteLength} bytes)`,
      ],
    };
  }

  const violations: string[] = [];

  // --- (2) Null-byte check on raw input ---
  // Null bytes (0x00) can truncate string processing in some parsers.
  // Checked on the raw string before normalisation so they cannot be hidden by
  // comment stripping (a comment containing a null byte is itself an attack).
  if (css.includes('\x00')) {
    violations.push('CSS contains null bytes (\\x00) which are forbidden');
  }

  // --- (3) HTML comment markers on raw input ---
  // IE processes HTML comment delimiters inside <style> blocks, allowing an
  // attacker to smuggle in CSS that spec-compliant parsers skip over.
  // Checked on raw (pre-normalised) lower-case form to catch case variations.
  const rawLower = css.toLowerCase();
  if (rawLower.includes('<!--') || rawLower.includes('-->')) {
    violations.push('CSS contains HTML comment markers (<!-- or -->) which are forbidden');
  }

  // --- (4) </style> breakout check on raw input ---
  // Must be checked before normalisation in case an attacker relies on the raw
  // byte sequence.  Also checked on the normalised form to catch CSS-unicode-
  // escaped variants (e.g. \3c/style\3e → </style> after decode).
  if (rawLower.includes('</style')) {
    violations.push('CSS contains </style> which would break out of the style block');
  }

  // --- (5) Normalise ---
  // 1. Strip block comments  2. Decode CSS Unicode escapes  3. Collapse C0/whitespace
  const normalized = normalizeCss(css);
  const normLower = normalized.toLowerCase();

  // --- (6) HTML breakout in normalised form ---
  // After unicode-escape decoding (both hex and non-hex), \3c → '<', \3e → '>' etc.
  // are now literal chars. Also check for --> in the normalised form since
  // \2d\2d\3e decodes to --> but the raw check at step (3) above only sees the
  // pre-decode form.

  if (normLower.includes('</style')) {
    // Catches unicode-escaped </style> variants not caught in raw check above
    if (!violations.some((v) => v.includes('</style>'))) {
      violations.push('CSS contains </style> (possibly unicode-escaped) which would break out of the style block');
    }
  }

  // Check for --> in normalised form (catches CSS-unicode-encoded: \2d\2d\3e → --)
  if (normalized.includes('-->') && !violations.some((v) => v.includes('-->'))) {
    violations.push('CSS contains --> (possibly unicode-escaped) which is a forbidden HTML comment marker');
  }

  // '<' has no valid use in CSS (not a selector combinator, not a value token).
  // '>' IS a valid CSS child combinator (.parent > .child) and is NOT blocked here —
  // the specific </style> check (above) and --> check (above) already cover all
  // HTML injection vectors that use '>'.
  if (normalized.includes('<')) {
    violations.push('CSS contains a "<" character which could allow HTML tag injection');
  }

  // --- (7) @-rule blocklist ---
  if (/@import\b/i.test(normLower)) {
    violations.push('@import is not allowed in custom CSS (loads external resources / data-exfiltration)');
  }
  if (/@charset\b/i.test(normLower)) {
    violations.push('@charset is not allowed in custom CSS (encoding-shift attack)');
  }
  if (/@namespace\b/i.test(normLower)) {
    violations.push('@namespace is not allowed in custom CSS (namespace prefix injection)');
  }

  // --- (8) Dangerous CSS property / function blocklist ---

  // IE CSS expression(): evaluates JavaScript in a CSS value context.
  if (/\bexpression\s*\(/i.test(normLower)) {
    violations.push('expression() is not allowed in custom CSS (IE CSS expression executes JavaScript)');
  }

  // IE behavior:: loads an .htc file with arbitrary script.
  if (/\bbehavior\s*:/i.test(normLower)) {
    violations.push('behavior: is not allowed in custom CSS (IE CSS behavior loads executable script)');
  }

  // Firefox -moz-binding:: loads an XBL binding with embedded script.
  if (/-moz-binding\s*:/i.test(normLower)) {
    violations.push('-moz-binding is not allowed in custom CSS (Firefox XUL binding with script)');
  }

  // Opera -o-link: / -o-link-source:: CSS link injection in Opera.
  if (/-o-link\s*:/i.test(normLower)) {
    violations.push('-o-link is not allowed in custom CSS (Opera CSS link injection)');
  }
  if (/-o-link-source\s*:/i.test(normLower)) {
    violations.push('-o-link-source is not allowed in custom CSS (Opera CSS link injection)');
  }

  // IE filter: progid:DXImageTransform.*: can evaluate script in IE.
  if (/filter\s*:\s*progid\s*:/i.test(normLower)) {
    violations.push('filter: progid: is not allowed in custom CSS (IE DXImageTransform filter can execute script)');
  }

  // --- (9) url() scheme check ---
  // Extract all url() values from the normalised CSS, then check each one for
  // unsafe schemes.  Whitespace stripping inside the scheme check defeats
  // java\tscript: / java\nscript: smuggling.
  const urlValues = extractUrlValues(normalized);
  for (const urlValue of urlValues) {
    if (hasUnsafeCssUrlScheme(urlValue)) {
      const preview = urlValue.slice(0, 80);
      violations.push(`url() contains an unsafe scheme: url(${preview}${urlValue.length > 80 ? '…' : ''})`);
    }
  }

  // --- (10) Brace-balance check ---
  // An unbalanced `}` in the merchant CSS would escape the `.lb-theme { … }`
  // scope wrapper, exposing bare selectors to the outer document.
  let depth = 0;
  let unbalancedClose = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth < 0) {
        unbalancedClose = true;
        break;
      }
    }
  }
  if (unbalancedClose) {
    violations.push('CSS contains an unbalanced closing brace (}) that could escape the scope wrapper');
  } else if (depth !== 0) {
    violations.push('CSS contains unbalanced braces — the opening and closing brace counts do not match');
  }

  // --- (11) Return violations if any ---
  if (violations.length > 0) {
    return { ok: false, violations };
  }

  // --- (12) Scope: wrap in scopeSelector using CSS nesting ---
  // All merchant selectors nest under scopeSelector. @media / @supports /
  // @keyframes inside the merchant CSS are also nested correctly by modern
  // browsers (Chrome 112+, Firefox 117+, Safari 17.2+).
  const trimmed = normalized.trim();
  const safeCss = `${scopeSelector}{${trimmed}}`;

  return { ok: true, safeCss, violations: [] };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Validate-only alias — returns `{ ok, violations }` without producing `safeCss`.
 * Suitable for gateway validation where scoping happens later at render time.
 *
 * This is the function imported by the gateway route and the editor UI for
 * pre-save validation.
 */
export function validateCustomCss(
  css: string,
  options: ValidateAndScopeOptions = {},
): { ok: boolean; violations: string[] } {
  const { ok, violations } = validateAndScopeCustomCss(css, options);
  return { ok, violations };
}

/**
 * Build the scoped CSS string for injection.
 *
 * Throws if the CSS fails validation.  Callers that already validated (e.g.
 * the renderer using a pre-validated DB value) should call
 * `validateAndScopeCustomCss` directly and check `ok` themselves.
 */
export function buildScopedCustomCss(
  css: string,
  options: ValidateAndScopeOptions = {},
): string {
  const result = validateAndScopeCustomCss(css, options);
  if (!result.ok || result.safeCss === undefined) {
    throw new Error(
      `Custom CSS failed validation: ${result.violations.join('; ')}`,
    );
  }
  return result.safeCss;
}
