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
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
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
