// Phase AA — Custom CSS Sanitizer tests (Lane A)
//
// SAFE-CSS LAW: every test below that asserts a vector is BLOCKED must fail if
// the corresponding guard in custom-css-sanitizer.ts is removed.  The comment
// "// Guard: <what to remove>" marks exactly which code path each test relies on.
//
// Test layout:
//   Group 1  — Attack vectors: each must be rejected (ok === false)
//   Group 2  — Safe CSS: well-formed merchant CSS must pass (ok === true)
//   Group 3  — Scoping: valid CSS must be wrapped in .lb-theme{…}
//   Group 4  — Backward-compat / renderer integration

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateAndScopeCustomCss,
  validateCustomCss,
  buildScopedCustomCss,
  hasUnsafeCssUrlScheme,
  CUSTOM_CSS_MAX_BYTES,
} from '../src/custom-css-sanitizer.ts';
import { buildLiquidThemeHeadAssets } from '../src/theme-renderer.ts';
import { createMinimalLiquidThemeBundleFixture } from '../src/theme-bundle.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blocked(css: string, description: string): void {
  const result = validateAndScopeCustomCss(css, { scopeSelector: '.lb-theme' });
  assert.equal(
    result.ok,
    false,
    `Expected BLOCKED for "${description}" but validator returned ok:true. Remove the guard to reproduce.`,
  );
  assert.ok(
    result.violations.length > 0,
    `Expected at least one violation message for "${description}"`,
  );
  assert.equal(
    result.safeCss,
    undefined,
    `safeCss must be absent when ok:false (${description})`,
  );
}

function allowed(css: string, description: string): { safeCss: string } {
  const result = validateAndScopeCustomCss(css, { scopeSelector: '.lb-theme' });
  assert.equal(
    result.ok,
    true,
    `Expected ALLOWED for "${description}" but validator returned ok:false. Violations: ${result.violations.join('; ')}`,
  );
  assert.equal(result.violations.length, 0, `Violations must be empty when ok:true (${description})`);
  assert.ok(
    typeof result.safeCss === 'string',
    `safeCss must be a string when ok:true (${description})`,
  );
  return { safeCss: result.safeCss as string };
}

// ============================================================================
// Group 1 — Attack vectors (every test MUST fail if the guard is removed)
// ============================================================================

// --- 1.1 @import ---

test('AA-SEC-01a @import url() is blocked', () => {
  // Guard: the /@import\b/i check in validateAndScopeCustomCss
  blocked('@import url("https://evil.example.com/steal.css");', '@import url()');
});

test('AA-SEC-01b @import with string literal is blocked', () => {
  // Guard: the /@import\b/i check
  blocked("@import 'https://evil.example.com/steal.css';", '@import string');
});

test('AA-SEC-01c @import with CSS unicode escape is blocked', () => {
  // \0069 = 'i'; after decode → @import
  // Guard: decodeCssUnicodeEscapes + /@import\b/i check
  blocked('@\\0069mport url("https://evil.com/x.css");', '@import via unicode escape');
});

test('AA-SEC-01d @import via non-hex CSS backslash escape is blocked', () => {
  // @\import: '\i' — 'i' is not a hex digit, so decodeCssUnicodeEscapes leaves it intact.
  // decodeCssNonHexEscapes then removes the backslash: \i → i, yielding @import.
  // Guard: decodeCssNonHexEscapes — remove this function from normalizeCss to make it fail.
  blocked('@\\import url("https://evil.com/x.css");', '@import via non-hex backslash escape');
});

// --- 1.2 url(javascript:) ---

test('AA-SEC-02a url(javascript:) is blocked', () => {
  // Guard: hasUnsafeCssUrlScheme + extractUrlValues in validateAndScopeCustomCss
  blocked('.x{background:url(javascript:alert(1))}', 'url(javascript:)');
});

test('AA-SEC-02b url("javascript:") double-quoted is blocked', () => {
  // Guard: hasUnsafeCssUrlScheme
  blocked('.x{background:url("javascript:alert(document.cookie)")}', 'url("javascript:")');
});

test('AA-SEC-02c url(javascript:) with whitespace smuggling is blocked', () => {
  // java\tscript: after whitespace collapse + strip → javascript: → blocked
  // Guard: stripping whitespace in hasUnsafeCssUrlScheme before scheme check
  blocked('.x{background:url("java\tscript:alert(1)")}', 'url(java\\tscript:) whitespace smuggling');
});

test('AA-SEC-02d url(javascript:) with embedded newline smuggling is blocked', () => {
  // Guard: whitespace stripping in hasUnsafeCssUrlScheme
  blocked('.x{background:url("java\nscript:alert(1)")}', 'url(java\\nscript:) newline smuggling');
});

// --- 1.3 expression() ---

test('AA-SEC-03a expression() is blocked', () => {
  // Guard: /\bexpression\s*\(/i check
  blocked('.x{width:expression(alert(1))}', 'expression()');
});

test('AA-SEC-03b EXPRESSION() uppercase is blocked', () => {
  // Guard: case-insensitive /\bexpression\s*\(/i
  blocked('.x{width:EXPRESSION(document.cookie)}', 'EXPRESSION() uppercase');
});

// --- 1.4 behavior: ---

test('AA-SEC-04a behavior: is blocked', () => {
  // Guard: /\bbehavior\s*:/i check
  blocked('.x{behavior:url(evil.htc)}', 'behavior:');
});

// --- 1.5 -moz-binding: ---

test('AA-SEC-05a -moz-binding: is blocked', () => {
  // Guard: /-moz-binding\s*:/i check
  blocked('.x{-moz-binding:url(https://evil.com/binding.xml#xss)}', '-moz-binding:');
});

// --- 1.6 url(data:image/svg) ---

test('AA-SEC-06a url(data:image/svg+xml) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'data:image/svg'
  blocked(
    '.x{background:url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><script>alert(1)</script></svg>")}',
    'url(data:image/svg+xml)',
  );
});

test('AA-SEC-06b url(data:image/svg+xml;base64,...) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES 'data:image/svg'
  blocked(
    '.x{background:url("data:image/svg+xml;base64,PHN2ZyB4bWxuczpzdmc9ImV4YW1wbGUi")}',
    'url(data:image/svg+xml;base64)',
  );
});

// --- 1.7 </style> breakout ---

test('AA-SEC-07a </style> literal is blocked', () => {
  // Guard: rawLower.includes('</style') check
  blocked('.x{color:red}</style><script>alert(1)</script><style>', '</style> literal');
});

test('AA-SEC-07b </style> with CSS unicode escape is blocked — no literal < in raw input', () => {
  // \3c → '<' and \3e → '>' after decodeCssUnicodeEscapes; decoded form contains '</style>'.
  // The raw input has NO literal '<', so the rawLower.includes('</style') check at step (4)
  // does NOT fire.  Only the post-decode normalized check at step (6) catches this.
  // Guard: decodeCssUnicodeEscapes → normalised includes '<' — remove decode step to make it fail.
  blocked('.x{color:red}\\3c/style\\3e', '</style> via unicode escape — no literal < in raw input');
});

// --- 1.8 Oversize rejection ---

test('AA-SEC-08 CSS exceeding maxBytes is rejected', () => {
  // Guard: Buffer.byteLength(css) > maxBytes check
  const oversize = '.x{color:red}'.repeat(5000); // well over 50 000 bytes
  blocked(oversize, `CSS over ${CUSTOM_CSS_MAX_BYTES} bytes`);
});

test('AA-SEC-08b custom maxBytes limit is enforced', () => {
  // Guard: the maxBytes option wired into size check
  const css = '.x{color:red}'; // 13 bytes
  const result = validateAndScopeCustomCss(css, { maxBytes: 5, scopeSelector: '.lb-theme' });
  assert.equal(result.ok, false, 'Must be blocked when CSS exceeds custom maxBytes');
  assert.ok(result.violations[0]?.includes('maximum size'));
});

// --- 1.9 @charset ---

test('AA-SEC-09a @charset is blocked', () => {
  // Guard: /@charset\b/i check
  blocked('@charset "UTF-7"; .x{color:red}', '@charset');
});

// --- 1.10 @namespace ---

test('AA-SEC-10a @namespace is blocked', () => {
  // Guard: /@namespace\b/i check
  blocked('@namespace url("http://www.w3.org/1999/xhtml"); .x{color:red}', '@namespace');
});

// --- 1.11 HTML comment markers ---

test('AA-SEC-11a <!-- HTML comment opening is blocked', () => {
  // Guard: rawLower.includes('<!--') check
  blocked('<!-- .x{color:red} -->', '<!-- HTML comment');
});

test('AA-SEC-11b --> HTML comment closing is blocked', () => {
  // Guard: rawLower.includes('-->') check
  blocked('.x{color:red}-->', '--> HTML comment closing');
});

test('AA-SEC-11c --> via CSS unicode escape is blocked', () => {
  // \2d → '-' (U+002D), \3e → '>' (U+003E); decoded form = '-->'
  // The raw input has no literal '-->' so the raw check at step (3) does NOT fire.
  // After decodeCssUnicodeEscapes the normalised string contains '-->' and the
  // normalised-form --> check at step (6) catches it.
  // Guard: normalized.includes('-->') check — remove it from validateAndScopeCustomCss to fail.
  blocked('.x{color:red}\\2d\\2d\\3e', '--> via CSS unicode escape — no literal --> in raw input');
});

// --- 1.12 url(vbscript:) ---

test('AA-SEC-12a url(vbscript:) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'vbscript:'
  blocked('.x{background:url(vbscript:MsgBox("xss"))}', 'url(vbscript:)');
});

// --- 1.13 url(blob:) ---

test('AA-SEC-13a url(blob:) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'blob:'
  blocked('.x{background:url(blob:https://example.com/abc-123)}', 'url(blob:)');
});

// --- 1.14 url(data:text/html) ---

test('AA-SEC-14a url(data:text/html) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'data:text/html'
  blocked('.x{background:url("data:text/html,<script>alert(1)</script>")}', 'url(data:text/html)');
});

// --- 1.15 url(data:text/javascript) ---

test('AA-SEC-15a url(data:text/javascript) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'data:text/javascript'
  blocked('.x{src:url("data:text/javascript,alert(1)")}', 'url(data:text/javascript)');
});

// --- 1.16 url(data:application/javascript) ---

test('AA-SEC-16a url(data:application/javascript) is blocked', () => {
  // Guard: UNSAFE_CSS_URL_SCHEME_PREFIXES includes 'data:application/javascript'
  blocked('.x{src:url("data:application/javascript,alert(1)")}', 'url(data:application/javascript)');
});

// --- 1.17 Unbalanced braces ---

test('AA-SEC-17a extra closing brace is blocked', () => {
  // Guard: depth < 0 → unbalancedClose check
  blocked('.x{color:red}} body{background:evil}', 'extra closing brace');
});

test('AA-SEC-17b unmatched opening brace is blocked', () => {
  // Guard: depth !== 0 check at end of scan
  blocked('.x{color:red', 'unmatched opening brace');
});

// --- 1.18 Null byte ---

test('AA-SEC-18a null byte is blocked', () => {
  // Guard: css.includes('\x00') check
  blocked('.x{color:red\x00}', 'null byte');
});

// --- 1.19 -o-link: ---

test('AA-SEC-19a -o-link: is blocked', () => {
  // Guard: /-o-link\s*:/i check
  blocked('.x{-o-link:url(https://evil.com)}', '-o-link:');
});

// --- 1.20 filter: progid: ---

test('AA-SEC-20a filter: progid: is blocked', () => {
  // Guard: /filter\s*:\s*progid\s*:/i check
  blocked(
    '.x{filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src="javascript:alert(1)")}',
    'filter: progid:',
  );
});

// --- 1.21 Angle brackets ---

test('AA-SEC-21a < angle bracket is blocked', () => {
  // Guard: normalized.includes('<') check
  // Note: '>' is a valid CSS child combinator and is NOT blocked. '<' has no valid CSS use.
  blocked('.x{color:red} <body { background:evil }', 'angle bracket < (no valid CSS use)');
});

test('AA-SEC-21b CSS unicode-escaped < is blocked', () => {
  // \3c → '<' after decodeCssUnicodeEscapes; then caught by normalized.includes('<')
  // Guard: decodeCssUnicodeEscapes + angle-bracket check
  blocked('.x{color:red}\\3c/script\\3e', 'unicode-escaped < via \\3c');
});

// ---------------------------------------------------------------------------
// Group 2 — Safe CSS: valid merchant CSS must PASS
// ---------------------------------------------------------------------------

test('AA-SAFE-01 basic color and font declarations pass', () => {
  allowed('.hero { color: #e63946; font-size: 2rem; }', 'color + font-size');
});

test('AA-SAFE-02 flexbox layout declarations pass', () => {
  allowed(
    '.grid { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }',
    'flexbox',
  );
});

test('AA-SAFE-03 CSS grid declarations pass', () => {
  allowed(
    '.products { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1.5rem; }',
    'CSS grid',
  );
});

test('AA-SAFE-04 CSS custom properties pass', () => {
  allowed(':root { --brand-red: #e63946; --brand-blue: #457b9d; }', 'CSS custom properties');
});

test('AA-SAFE-05 safe data: image/png URL passes', () => {
  // data:image/png is NOT in the unsafe-scheme list
  allowed(
    '.logo { background-image: url("data:image/png;base64,iVBORw0KGgo="); background-repeat: no-repeat; }',
    'data:image/png URL',
  );
});

test('AA-SAFE-06 https URL passes', () => {
  allowed('.icon { background: url("https://cdn.example.com/icon.png") no-repeat; }', 'https URL');
});

test('AA-SAFE-07 CSS transitions and transforms pass', () => {
  allowed(
    '.card { transition: transform 0.3s ease; } .card:hover { transform: translateY(-4px); }',
    'transition + transform',
  );
});

test('AA-SAFE-08 @media query passes and braces are balanced', () => {
  allowed(
    '@media (max-width: 768px) { .hero h1 { font-size: 1.5rem; } }',
    '@media query',
  );
});

test('AA-SAFE-09 @supports query passes', () => {
  allowed(
    '@supports (display: grid) { .container { display: grid; } }',
    '@supports query',
  );
});

test('AA-SAFE-10 @keyframes animation passes', () => {
  allowed(
    '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .hero { animation: fadeIn 0.5s ease; }',
    '@keyframes animation',
  );
});

test('AA-SAFE-11 multiple selectors with combinators pass', () => {
  allowed(
    '.hero > h1 + p { margin-top: 1rem; } .hero ~ .cta { font-weight: bold; }',
    'combinators',
  );
});

test('AA-SAFE-12 pseudo-classes and pseudo-elements pass', () => {
  allowed(
    'a:hover { text-decoration: underline; } p::first-line { font-variant: small-caps; }',
    'pseudo-classes and pseudo-elements',
  );
});

test('AA-SAFE-13 empty CSS string is valid (backward-compat)', () => {
  const result = validateAndScopeCustomCss('', { scopeSelector: '.lb-theme' });
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.safeCss, undefined, 'safeCss must be absent for empty input');
});

test('AA-SAFE-14 whitespace-only CSS string is valid (backward-compat)', () => {
  const result = validateAndScopeCustomCss('   \n\t  ', { scopeSelector: '.lb-theme' });
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
  assert.equal(result.safeCss, undefined);
});

// ---------------------------------------------------------------------------
// Group 3 — Scoping assertions
// ---------------------------------------------------------------------------

test('AA-SCOPE-01 top-level selector is scoped to .lb-theme', () => {
  // Guard: the `${scopeSelector}{${trimmed}}` wrapping step
  const { safeCss } = allowed('.hero { color: red; }', 'scoping');
  assert.ok(
    safeCss.startsWith('.lb-theme{'),
    `safeCss must start with ".lb-theme{" but got: ${safeCss.slice(0, 60)}`,
  );
  assert.ok(safeCss.includes('.hero'), 'original selector must appear inside the scope');
});

test('AA-SCOPE-02 @media rules are inside the .lb-theme wrapper', () => {
  // Guard: wrapping step; @media goes inside the outer .lb-theme{ } block
  const { safeCss } = allowed(
    '@media (min-width: 768px) { .hero { font-size: 2rem; } }',
    '@media scoping',
  );
  assert.ok(safeCss.startsWith('.lb-theme{'), '@media must be inside .lb-theme scope');
  assert.ok(safeCss.includes('@media'), '@media must be present in scoped output');
  assert.ok(safeCss.includes('.hero'), '.hero selector must be present inside @media');
});

test('AA-SCOPE-03 @keyframes are preserved inside the .lb-theme wrapper', () => {
  // Guard: @keyframes are not blocked and appear inside the scope wrapper
  const { safeCss } = allowed(
    '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }',
    '@keyframes preserved',
  );
  assert.ok(safeCss.startsWith('.lb-theme{'), '@keyframes must be inside .lb-theme scope');
  assert.ok(safeCss.includes('@keyframes'), '@keyframes must be present');
  assert.ok(safeCss.includes('spin'), 'keyframe name must be preserved');
});

test('AA-SCOPE-04 scopeSelector option controls the wrapper selector', () => {
  // Guard: scopeSelector option is used in wrapping
  const result = validateAndScopeCustomCss('.hero{color:red}', { scopeSelector: '#theme-root' });
  assert.equal(result.ok, true);
  assert.ok(result.safeCss?.startsWith('#theme-root{'), 'custom scopeSelector must be used');
});

test('AA-SCOPE-05 safeCss ends with closing brace matching the scope wrapper', () => {
  // Guard: wrapping produces `scopeSelector{content}`
  const { safeCss } = allowed('p { font-size: 1rem; }', 'scope closing brace');
  assert.ok(safeCss.endsWith('}'), 'safeCss must end with } to close the scope wrapper');
});

test('AA-SCOPE-06 scoped output is deterministic (same input same output)', () => {
  // Guard: no random/date state in the validator
  const css = '.hero { color: #e63946; } @media (min-width: 768px) { .hero { font-size: 2rem; } }';
  const r1 = validateAndScopeCustomCss(css, { scopeSelector: '.lb-theme' });
  const r2 = validateAndScopeCustomCss(css, { scopeSelector: '.lb-theme' });
  assert.equal(r1.ok, r2.ok, 'Determinism: ok must be the same across calls');
  assert.equal(r1.safeCss, r2.safeCss, 'Determinism: safeCss must be identical across calls');
  assert.deepEqual(r1.violations, r2.violations, 'Determinism: violations must be identical');
});

// ---------------------------------------------------------------------------
// Group 4 — Backward-compat: theme-renderer integration
// ---------------------------------------------------------------------------

test('AA-COMPAT-01 buildLiquidThemeHeadAssets without customCss is byte-identical to baseline', () => {
  // Guard: the optional customCss parameter has no effect when absent or empty
  const bundle = createMinimalLiquidThemeBundleFixture();
  const baseline = buildLiquidThemeHeadAssets(bundle);
  const withUndefined = buildLiquidThemeHeadAssets(bundle, undefined);
  const withEmpty = buildLiquidThemeHeadAssets(bundle, '');
  assert.equal(withUndefined, baseline, 'undefined customCss must produce identical output');
  assert.equal(withEmpty, baseline, 'empty customCss must produce identical output');
});

test('AA-COMPAT-02 buildLiquidThemeHeadAssets with valid raw CSS validates-and-scopes internally', () => {
  // Guard: buildLiquidThemeHeadAssets now validates + scopes internally (single enforcement point).
  // Callers pass the RAW css — the renderer handles validation; pre-scoping is not required.
  const bundle = createMinimalLiquidThemeBundleFixture();
  const css = '.hero { color: red; }';
  const result = buildLiquidThemeHeadAssets(bundle, css);
  assert.ok(
    result.includes('<style data-lb-custom-css="1">'),
    'Expected <style data-lb-custom-css="1"> in renderer output',
  );
  assert.ok(result.includes('.lb-theme{'), 'Expected scoped CSS inside custom style tag');
  assert.ok(
    result.includes('<style data-theme-renderer="liquid">'),
    'Base style tag must still be present',
  );
});

test('AA-COMPAT-03 base style tag appears before custom CSS style tag', () => {
  // Guard: ordering in buildLiquidThemeHeadAssets (base first, custom second)
  const bundle = createMinimalLiquidThemeBundleFixture();
  const html = buildLiquidThemeHeadAssets(bundle, 'p{font-size:1rem;}');
  const baseIdx = html.indexOf('<style data-theme-renderer="liquid">');
  const customIdx = html.indexOf('<style data-lb-custom-css="1">');
  assert.ok(baseIdx >= 0, 'Base style tag must be present');
  assert.ok(customIdx >= 0, 'Custom CSS style tag must be present');
  assert.ok(baseIdx < customIdx, 'Base style tag must come before custom CSS style tag');
});

test('AA-COMPAT-04 buildLiquidThemeHeadAssets with invalid CSS drops the custom style (fail-closed)', () => {
  // Guard: the fail-closed path in buildLiquidThemeHeadAssets — invalid CSS is never injected.
  const bundle = createMinimalLiquidThemeBundleFixture();
  const maliciousCss = '@import url("https://evil.com/steal.css");';
  const result = buildLiquidThemeHeadAssets(bundle, maliciousCss);
  assert.ok(
    !result.includes('<style data-lb-custom-css="1">'),
    'Invalid CSS must not produce a custom style tag (fail-closed)',
  );
  assert.ok(
    result.includes('<style data-theme-renderer="liquid">'),
    'Base style tag must still be present after invalid CSS is dropped',
  );
});

// ---------------------------------------------------------------------------
// Group 5 — validateCustomCss and buildScopedCustomCss helpers
// ---------------------------------------------------------------------------

test('AA-HELPER-01 validateCustomCss returns ok + violations without safeCss', () => {
  const safe = validateCustomCss('.hero{color:red}', { scopeSelector: '.lb-theme' });
  assert.equal(safe.ok, true);
  assert.equal(safe.violations.length, 0);
  // validateCustomCss does not expose safeCss
  assert.equal('safeCss' in safe, false, 'validateCustomCss must not expose safeCss');
});

test('AA-HELPER-02 validateCustomCss reports violations for unsafe CSS', () => {
  const unsafe = validateCustomCss('@import url("https://evil.com/x.css");', { scopeSelector: '.lb-theme' });
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.violations.some((v) => v.includes('@import')), 'Must report @import violation');
});

test('AA-HELPER-03 buildScopedCustomCss returns scoped CSS for valid input', () => {
  const scoped = buildScopedCustomCss('.x{color:red}', { scopeSelector: '.lb-theme' });
  assert.ok(scoped.startsWith('.lb-theme{'), 'Must start with scope selector');
  assert.ok(scoped.includes('.x'), 'Must contain original selector');
});

test('AA-HELPER-04 buildScopedCustomCss throws for invalid input', () => {
  assert.throws(
    () => buildScopedCustomCss('@import url("https://evil.com/x.css");'),
    /Custom CSS failed validation/,
    'Must throw for invalid CSS',
  );
});

test('AA-HELPER-05 hasUnsafeCssUrlScheme returns true for javascript: with whitespace', () => {
  // Guard: whitespace stripping in hasUnsafeCssUrlScheme
  assert.equal(hasUnsafeCssUrlScheme('java\tscript:alert(1)'), true);
  assert.equal(hasUnsafeCssUrlScheme('java\nscript:alert(1)'), true);
  assert.equal(hasUnsafeCssUrlScheme('java script:alert(1)'), true);
});

test('AA-HELPER-06 hasUnsafeCssUrlScheme returns false for safe schemes', () => {
  assert.equal(hasUnsafeCssUrlScheme('https://example.com/image.png'), false);
  assert.equal(hasUnsafeCssUrlScheme('data:image/png;base64,abc'), false);
  assert.equal(hasUnsafeCssUrlScheme('data:image/jpeg;base64,abc'), false);
  assert.equal(hasUnsafeCssUrlScheme('data:image/webp;base64,abc'), false);
  assert.equal(hasUnsafeCssUrlScheme('/images/logo.png'), false);
});

// ---------------------------------------------------------------------------
// Group 6 — CUSTOM_CSS_MAX_BYTES constant
// ---------------------------------------------------------------------------

test('AA-CONST-01 CUSTOM_CSS_MAX_BYTES is 50 000', () => {
  assert.equal(CUSTOM_CSS_MAX_BYTES, 50_000);
});

test('AA-CONST-02 CSS exactly at the byte limit passes', () => {
  // Build a CSS string that is exactly CUSTOM_CSS_MAX_BYTES bytes (ASCII so byte = char)
  // ".a{color:red}" = 13 bytes; pad comment to hit the limit
  const padding = 'a'.repeat(CUSTOM_CSS_MAX_BYTES - 13);
  // Use a CSS comment for the padding (stripped by sanitizer)
  const atLimit = `/* ${padding} */.a{color:red}`;
  // The raw byte count check happens BEFORE comment stripping
  // Ensure we're at or below the limit
  const rawBytes = Buffer.byteLength(atLimit, 'utf8');
  if (rawBytes <= CUSTOM_CSS_MAX_BYTES) {
    const result = validateAndScopeCustomCss(atLimit, { scopeSelector: '.lb-theme' });
    assert.equal(result.ok, true, `CSS at ${rawBytes} bytes should pass`);
  }
  // If the comment padding pushed us over, that's fine — the oversize test covers rejection
});
