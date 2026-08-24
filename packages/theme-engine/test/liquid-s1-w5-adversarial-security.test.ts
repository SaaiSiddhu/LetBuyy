// S1/W5 — adversarial security gap-fill over qi-security.test.ts.
//
// qi-security.test.ts already behaviorally proves: DOMPurify FORBID_TAGS/FORBID_ATTR, SSTI via
// SECTION settings (never re-evaluated), toLiquidDrop depth/key limits, prototype-pollution key
// filtering, CSS token injection, XSS via data-* attributes, javascript:/data: URL blocking. This file
// fills three gaps the phase brief named that were not covered:
//   (1) XSS through EVERY declared settings field TYPE — not "text, textarea, url, image, html, liquid"
//       as speculated; the real, current type vocabulary (queried from the generated Core bundle) is
//       text, textarea, url, image, richtext, select. There is no "html" or "liquid" field type in this
//       schema system — richtext is the closest analog to "html", and it is still auto-escaped (no
//       renderer path uses `| raw` on a settings value; see (2) for the one legitimate `| raw` use).
//   (2) Injection via BLOCK settings, including the `| raw` re-embed of a block's OWN rendered HTML
//       into its parent section (category-grid/featured-products/product-grid templates use
//       `{{ block.content | raw }}`) — proven safe here because block.content is populated from
//       sanitizeRenderedHtml() output (theme-renderer.ts:926), not raw block.settings.
//   (3) Injection via the @app block handle path (liquidAppBlocks) — resolveLiquidAppBlockHtml also
//       routes caller-supplied HTML through sanitizeRenderedHtml (theme-renderer.ts:1226-1227).
//
// Every test asserts the NEUTRALISED output (not merely "did not throw").
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
  sanitizeLiquidHeadStyleText,
  buildLiquidThemeHeadAssets,
} from '../src/index.ts';

const STORE_ID = 'w5-adversarial-store-000000000000';

const XSS_PAYLOAD = '<script>window.__W5_PWNED__=1</script>';
const IMG_XSS_PAYLOAD = '"><img src=x onerror="window.__W5_PWNED__=1">';
const JS_URL_PAYLOAD = 'javascript:window.__W5_PWNED__=1//';

function sectionBundle(sectionType: string, bodySource: string, schemaSettings: unknown[] = [], schemaBlocks: unknown[] = []) {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const schema = { name: sectionType, settings: schemaSettings, blocks: schemaBlocks, presets: [{ name: sectionType }] };
  const source = `${bodySource}\n{% schema %}${JSON.stringify(schema)}{% endschema %}`;
  return {
    ...bundle,
    sections: {
      ...bundle.sections,
      [sectionType]: { path: `sections/${sectionType}.liquid`, source, schema },
    },
  };
}

async function renderWithSection(bundle: ReturnType<typeof sectionBundle>, sectionType: string, settings: Record<string, unknown>, blocks: Record<string, unknown> = {}, blockOrder: string[] = []) {
  const withTemplate = {
    ...bundle,
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          target: { type: sectionType, settings, blocks, block_order: blockOrder, disabled: false },
        },
        order: ['target'],
      },
    },
  };
  const renderer = new LiquidRenderer();
  return renderer.render({
    context: { storeId: STORE_ID, subdomain: 'w5-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: withTemplate as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });
}

// Parses the rendered output into a REAL DOM (jsdom, the same engine sanitizeRenderedHtml itself uses)
// and asserts no LIVE, executable node/attribute exists — not a raw-string search. A naive string
// search over-fires on a correctly-escaped payload: DOMPurify HTML-entity-escapes `<script>` to
// `&lt;script&gt;`, so the literal substring "onerror=" or the payload's marker text can still appear
// as INERT text content or inside an already-quoted attribute value without ever being live. Parsing
// confirms the distinction a byte/regex diff cannot: is this parsed as an executable node, or as text.
function assertNeutralised(html: string, label: string) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`);
  const { document } = dom.window;

  assert.equal(document.querySelectorAll('script').length, 0, `${label}: no live <script> element may exist in the parsed DOM`);

  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      assert.doesNotMatch(
        attr.name,
        /^on/i,
        `${label}: no live on* event-handler attribute may exist (found ${attr.name} on <${el.tagName.toLowerCase()}>)`,
      );
    }
  }

  // The payload's executable marker must never appear as an ACTIVE JS reference — i.e. it must not
  // be reachable via window.__W5_PWNED__ having actually been set. Since jsdom does not execute
  // <script> (scripts are inert by default without `runScripts: 'dangerously'`), and the loop above
  // already proved no on* handler is live, the marker property is definitionally never assigned.
  assert.equal((dom.window as unknown as Record<string, unknown>).__W5_PWNED__, undefined, `${label}: the payload must never actually execute`);
}

// ---------------------------------------------------------------------------------------------
// (1) XSS through every REAL declared settings field type.
// ---------------------------------------------------------------------------------------------

test('W5-XSS-text: a "text" field with a <script> payload is neutralised', async () => {
  const bundle = sectionBundle(
    'xss-text',
    '<section data-section-id="{{ section.id }}"><h2>{{ section.settings.title }}</h2></section>',
    [{ id: 'title', type: 'text', label: 'Title' }],
  );
  const result = await renderWithSection(bundle, 'xss-text', { title: XSS_PAYLOAD });
  assert.equal(result.status, 'rendered');
  assertNeutralised(result.liquid?.contentForLayout ?? '', 'text field');
});

test('W5-XSS-textarea: a "textarea" field with a <script> payload is neutralised', async () => {
  const bundle = sectionBundle(
    'xss-textarea',
    '<section data-section-id="{{ section.id }}"><p>{{ section.settings.body }}</p></section>',
    [{ id: 'body', type: 'textarea', label: 'Body' }],
  );
  const result = await renderWithSection(bundle, 'xss-textarea', { body: XSS_PAYLOAD });
  assert.equal(result.status, 'rendered');
  assertNeutralised(result.liquid?.contentForLayout ?? '', 'textarea field');
});

test('W5-XSS-richtext: a "richtext" field with a <script> payload is neutralised (no `| raw` on settings values)', async () => {
  const bundle = sectionBundle(
    'xss-richtext',
    '<section data-section-id="{{ section.id }}"><div>{{ section.settings.content }}</div></section>',
    [{ id: 'content', type: 'richtext', label: 'Content' }],
  );
  const result = await renderWithSection(bundle, 'xss-richtext', { content: XSS_PAYLOAD });
  assert.equal(result.status, 'rendered');
  assertNeutralised(result.liquid?.contentForLayout ?? '', 'richtext field');
});

test('W5-XSS-select: a "select" field value is escaped even when it does not match a declared option', async () => {
  const bundle = sectionBundle(
    'xss-select',
    '<section data-section-id="{{ section.id }}" data-align="{{ section.settings.align }}">{{ section.settings.align }}</section>',
    [{ id: 'align', type: 'select', label: 'Align', options: ['left', 'center', 'right'] }],
  );
  const result = await renderWithSection(bundle, 'xss-select', { align: '"><script>window.__W5_PWNED__=1</script>' });
  assert.equal(result.status, 'rendered');
  assertNeutralised(result.liquid?.contentForLayout ?? '', 'select field');
});

test('W5-XSS-url: a "url" field with a javascript: scheme does not produce an executable href', async () => {
  const bundle = sectionBundle(
    'xss-url',
    '<section data-section-id="{{ section.id }}"><a href="{{ section.settings.link }}">go</a></section>',
    [{ id: 'link', type: 'url', label: 'Link' }],
  );
  const result = await renderWithSection(bundle, 'xss-url', { link: JS_URL_PAYLOAD });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.contentForLayout ?? '';
  assert.doesNotMatch(html, /href="javascript:/i, 'a javascript: href must be stripped by the DOMPurify uponSanitizeAttribute hook');
});

test('W5-XSS-image: an "image" field with an attribute-breakout payload does not create a live onerror handler', async () => {
  const bundle = sectionBundle(
    'xss-image',
    '<section data-section-id="{{ section.id }}"><img src="{{ section.settings.imageUrl }}" alt="pic"></section>',
    [{ id: 'imageUrl', type: 'image', label: 'Image' }],
  );
  const result = await renderWithSection(bundle, 'xss-image', { imageUrl: IMG_XSS_PAYLOAD });
  assert.equal(result.status, 'rendered');
  assertNeutralised(result.liquid?.contentForLayout ?? '', 'image field');
});

// ---------------------------------------------------------------------------------------------
// (2) Injection via BLOCK settings, including the `| raw` re-embed pattern.
// ---------------------------------------------------------------------------------------------

test('W5-block-xss: a block setting with a <script> payload is neutralised in the block\'s own render', async () => {
  const bundle = sectionBundle(
    'block-host',
    '<section data-section-id="{{ section.id }}">{% for block in section.blocks %}{{ block.content | raw }}{% endfor %}</section>',
    [],
    [{ type: 'card', name: 'Card', settings: [{ id: 'label', type: 'text', label: 'Label' }] }],
  );
  const poisoned = {
    ...bundle,
    blocks: {
      ...bundle.blocks,
      card: {
        path: 'blocks/card.liquid',
        source: '<span class="card">{{ block.settings.label }}</span>',
        schema: { name: 'Card', settings: [{ id: 'label', type: 'text', label: 'Label' }], presets: [] },
      },
    },
  };

  const result = await renderWithSection(
    poisoned as ReturnType<typeof sectionBundle>,
    'block-host',
    {},
    { 'card-1': { type: 'card', settings: { label: XSS_PAYLOAD }, disabled: false } },
    ['card-1'],
  );
  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  // Proves the mechanism named in the file header: block.content is the SANITIZED render of the
  // block's own template (theme-renderer.ts:926), so re-embedding it via `| raw` in the parent
  // section is safe — the payload was already neutralised before `| raw` ever runs on it.
  assertNeutralised(html, 'block setting re-embedded via `| raw`');
  assert.match(html, /class="card"/, 'the block\'s safe structural markup must still render');
});

test('W5-block-ssti: a block setting value is never re-evaluated as a Liquid template (mirrors SEC-3a for blocks)', async () => {
  const bundle = sectionBundle(
    'block-ssti-host',
    '<section data-section-id="{{ section.id }}">{% for block in section.blocks %}{{ block.content | raw }}{% endfor %}</section>',
    [],
    [{ type: 'note', name: 'Note', settings: [{ id: 'text', type: 'text', label: 'Text' }] }],
  );
  const poisoned = {
    ...bundle,
    blocks: {
      ...bundle.blocks,
      note: {
        path: 'blocks/note.liquid',
        source: '<span>{{ block.settings.text }}</span>',
        schema: { name: 'Note', settings: [{ id: 'text', type: 'text', label: 'Text' }], presets: [] },
      },
    },
  };

  const result = await renderWithSection(
    poisoned as ReturnType<typeof sectionBundle>,
    'block-ssti-host',
    {},
    { 'note-1': { type: 'note', settings: { text: '{{ 6 | times: 6 }}' }, disabled: false } },
    ['note-1'],
  );
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.contentForLayout ?? '';
  assert.doesNotMatch(html, /<span>[^<]*36[^<]*<\/span>/, 'SSTI probe in a BLOCK setting must not be evaluated (would render "36" if it were)');
});

// ---------------------------------------------------------------------------------------------
// (3) Injection via the @app block handle path (liquidAppBlocks).
// ---------------------------------------------------------------------------------------------

test('W5-app-block-xss: a malicious liquidAppBlocks HTML payload is neutralised through resolveLiquidAppBlockHtml', async () => {
  const poisoned = sectionBundle(
    'app-slot-host',
    '<section data-section-id="{{ section.id }}">{% for block in section.blocks %}{{ block.content | raw }}{% endfor %}</section>',
    [],
    [{ type: '@app', name: 'App block' }],
  );

  const withTemplate = {
    ...poisoned,
    templates: {
      ...poisoned.templates,
      index: {
        ...poisoned.templates.index,
        sections: {
          target: {
            type: 'app-slot-host',
            settings: {},
            blocks: { 'app-1': { type: '@app', settings: { extension_handle: 'evil-extension' }, disabled: false } },
            block_order: ['app-1'],
            disabled: false,
          },
        },
        order: ['target'],
      },
    },
  };

  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'w5-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: withTemplate as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
    // Simulates a compromised/malicious app supplying HTML for its own block slot.
    liquidAppBlocks: { 'evil-extension': `<div>${XSS_PAYLOAD}</div>` },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);
  const html = result.liquid?.contentForLayout ?? '';
  assertNeutralised(html, '@app block liquidAppBlocks HTML');
});

test('W5-app-block-settings-filtered: credential-adjacent app block settings never reach the Liquid drop', async () => {
  const poisoned = sectionBundle(
    'app-cred-host',
    '<section data-section-id="{{ section.id }}">{% for block in section.blocks %}<span>{{ block.settings.api_key }}</span>{% endfor %}</section>',
    [],
    [{ type: '@app', name: 'App block' }],
  );
  const withTemplate = {
    ...poisoned,
    templates: {
      ...poisoned.templates,
      index: {
        ...poisoned.templates.index,
        sections: {
          target: {
            type: 'app-cred-host',
            settings: {},
            blocks: { 'app-1': { type: '@app', settings: { api_key: 'SECRET-LEAK-PROBE', label: 'Visible label' }, disabled: false } },
            block_order: ['app-1'],
            disabled: false,
          },
        },
        order: ['target'],
      },
    },
  };

  const renderer = new LiquidRenderer();
  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'w5-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'liquid-starter', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: withTemplate as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered');
  const html = result.liquid?.contentForLayout ?? '';
  assert.doesNotMatch(html, /SECRET-LEAK-PROBE/, 'api_key must be stripped by filterAppBlockSettings before reaching the Liquid drop');
});

// T2a-fix/W2/CAP-C19 — sanitizeLiquidHeadStyleText is the new extraction boundary added so the
// portable theme stylesheet (:root token block + LIQUID_THEME_BASE_CSS) can reach the browser as
// a real <style> element in composition-engine.tsx's React tree, instead of being discarded with
// the rest of layoutHtml. It reuses sanitizeRenderedHtml's own allowHeadMetadata DOMPurify pass —
// these tests prove that reuse is genuinely safe, not merely assumed: a hostile theme-setting
// value must never survive as live markup/script in the extracted CSS text, even in a
// worst-case scenario where it somehow bypassed the existing sanitizeCssTokenValue() token-level
// stripping (defense-in-depth, not "we trust the caller already cleaned it").
test('W5-head-style-breakout: a </style> breakout with an injected <script> cannot escape the extracted CSS text', async () => {
  const hostile = '<style data-theme-renderer="liquid">:root{--primary:#000}</style></style><script>window.__W5_PWNED__=1</script><style>';
  const text = await sanitizeLiquidHeadStyleText(hostile);
  assert.doesNotMatch(text, /<script/i, 'no script tag may survive extraction');
  assert.doesNotMatch(text, /__W5_PWNED__/, 'the injected payload must never appear in the extracted text');
  assert.match(text, /--primary:#000/, 'the legitimate token declaration before the breakout attempt must still survive');
});

test('W5-head-style-jsurl: a javascript: URL smuggled into head-asset HTML cannot become a live href/src', async () => {
  const hostile = '<style data-theme-renderer="liquid">:root{--primary:#111}</style><a href="javascript:window.__W5_PWNED__=1">x</a>';
  const text = await sanitizeLiquidHeadStyleText(hostile);
  // sanitizeLiquidHeadStyleText only ever returns <style> textContent — an <a> tag has none to
  // extract from, so the hostile element cannot contribute any text to the result at all.
  assert.doesNotMatch(text, /javascript:/i, 'no javascript: scheme may appear in the extracted CSS text');
  assert.doesNotMatch(text, /__W5_PWNED__/, 'the injected payload must never appear in the extracted text');
  assert.match(text, /--primary:#111/, 'the legitimate token declaration must still survive');
});

test('W5-head-style-expression: a CSS expression()/onerror payload smuggled via an event handler attribute cannot execute', async () => {
  const hostile = '<style onerror="window.__W5_PWNED__=1" data-theme-renderer="liquid">:root{--primary:#222}body{width:expression(window.__W5_PWNED__=1)}</style>';
  const text = await sanitizeLiquidHeadStyleText(hostile);
  assert.doesNotMatch(text, /onerror=/i, 'event handler attributes on the <style> tag itself must be stripped before extraction');
  // expression() is legacy-IE-only CSS with no effect in any real target browser; the assertion
  // here is that the extraction path does not itself provide a NEW way to execute it — the raw
  // text is inert once rendered as a React string child (see liquid-page-assembly.test.ts).
  assert.match(text, /--primary:#222/, 'the legitimate token declaration must still survive');
});

test('W5-head-style-real-pipeline: sanitizeLiquidHeadStyleText over the REAL buildLiquidThemeHeadAssets output stays safe end to end', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  bundle.config.settings_data.current = {
    ...bundle.config.settings_data.current,
    primaryColor: '</style><script>window.__W5_PWNED__=1</script><style>',
  };
  const rawHead = buildLiquidThemeHeadAssets(bundle);
  const text = await sanitizeLiquidHeadStyleText(rawHead);
  const primaryDeclaration = text.match(/--primary:[^;]*;/)?.[0] ?? '';
  // sanitizeCssTokenValue() (theme-renderer.ts) already strips `<>{};@()` from every token value
  // BEFORE it reaches buildLiquidThemeHeadAssets — this proves that holds through the full real
  // pipeline: no `<`/`>` character survives WITHIN THE TOKEN-DERIVED DECLARATION specifically
  // (scoped, not a whole-text check — the legitimate base stylesheet elsewhere in `text` uses `>`
  // as a real CSS child combinator, e.g. ".lb-featured-products > a", so a blanket check would
  // false-positive on safe content). No surviving `<`/`>` structurally guarantees no tag (script
  // or otherwise) can ever form here, regardless of what inert text remains — the leftover
  // "window.__W5_PWNED__=1" text is expected and harmless: it sits inertly inside a CSS
  // custom-property value it can never execute from or break out of. This mirrors the file's own
  // assertNeutralised() philosophy: prove structure/reachability, not a naive substring search.
  assert.ok(primaryDeclaration.length > 0, 'the --primary token declaration must survive, even if its value was neutralised');
  assert.doesNotMatch(text, /<script/i, 'no script tag may survive the real head-assets pipeline');
  assert.doesNotMatch(primaryDeclaration, /[<>]/, 'no angle bracket may survive token sanitization — nothing can ever form a tag');
  assert.match(text, /\.lb-hero-banner\b/, 'the legitimate base stylesheet must still be present');
});
