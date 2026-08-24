#!/usr/bin/env node
// S1/W4 — the render-parity harness (behavioral, not structural).
//
// For each of the 20 entries in THEME_LIQUID_PORTABLE_SECTION_PARITY
// (packages/theme-engine/src/theme-governance.ts), renders the React section component and its Liquid
// counterpart from IDENTICAL settings (generated from the Liquid section's own declared schema — the
// portable, canonical settings contract per THEME-R3) and produces a structured semantic diff: heading
// text, link targets, image sources, and presence of each declared setting value. This does NOT
// byte-compare HTML — whitespace/attribute-order differences are not defects.
//
// A section that fails parity is reported FAILING with the concrete reason. This harness is never tuned
// until it passes; a red report is a correct, expected outcome of this phase.
//
// SECURITY INVARIANT: this harness renders through the SAME LiquidRenderer + sanitizeRenderedHtml path
// every real request uses (packages/theme-engine/src/theme-renderer.ts) — it does not construct its own
// renderer and does not touch DOMPurify config, the FORBID lists, or outputEscape. See
// docs/evidence/liquid-parity/S1-security-performance-evidence.md for the dedicated security pass.
//
// Run: npx tsx --tsconfig apps/storefront-runtime/tsconfig.json apps/storefront-runtime/scripts/liquid-parity-harness.mjs
// (the explicit --tsconfig is required: without it tsx does not reliably pick up this app's
// react-jsx automatic runtime or its `@/*` path mapping for files reached via dynamic import())
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { THEME_LIQUID_PORTABLE_SECTION_PARITY } from '../../../packages/theme-engine/src/theme-governance.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidRenderer } from '../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../packages/theme-engine/src/index.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const STOREFRONT_ROOT = join(REPO_ROOT, 'apps/storefront-runtime');
const SECTIONS_DIR = join(STOREFRONT_ROOT, 'src/components/sections');
const HARNESS_DIR = join(STOREFRONT_ROOT, 'src/__liquid_parity_harness__');
const MOCKS_DIR = join(REPO_ROOT, 'scripts/liquid-parity/mocks');
const REPORT_PATH = join(REPO_ROOT, 'docs/evidence/liquid-parity/S1-render-parity.json');
const SUMMARY_PATH = join(REPO_ROOT, 'docs/evidence/liquid-parity/S1-render-parity-summary.md');

const STORE_ID = '99999999-9999-4999-8999-999999999999';

// ---------------------------------------------------------------------------------------------
// 1. Distinctive settings generation, driven by the Liquid section's OWN declared schema — the
//    canonical portable contract (THEME-R3) — so "identical settings" means the same source of truth
//    for both renders, not a hand-picked fixture per side.
// ---------------------------------------------------------------------------------------------
function distinctiveValueFor(field) {
  const id = field.id;
  switch (field.type) {
    case 'toggle':
      return true;
    case 'range':
    case 'number':
      return typeof field.max === 'number' ? Math.min(field.max, (field.min ?? 0) + 2) : 3;
    case 'url':
      return `/parity-test/${id}`;
    case 'image':
      return `https://cdn.example/parity-${id}.jpg`;
    case 'select':
      return Array.isArray(field.options) && field.options.length > 0 ? field.options[0] : `parity-${id}`;
    case 'color':
      return '#123456';
    default:
      return `Parity value for ${id}`;
  }
}

function buildSettingsFromSchemaFields(fields) {
  const settings = {};
  for (const field of fields || []) {
    settings[field.id] = field.default !== undefined ? field.default : distinctiveValueFor(field);
    // Force distinctive (not just the schema default) for string-shaped fields so presence-checking is
    // meaningful — a default like "" or a generic placeholder would make every section look identical.
    if (typeof settings[field.id] === 'string' && settings[field.id].length < 3) {
      settings[field.id] = distinctiveValueFor(field);
    }
  }
  return settings;
}

function buildBlocksFromSchemaBlocks(blockDefs) {
  return (blockDefs || []).map((blockDef, index) => ({
    id: `parity-block-${blockDef.type}-${index}`,
    type: blockDef.type,
    settings: buildSettingsFromSchemaFields(blockDef.settings),
  }));
}

// ---------------------------------------------------------------------------------------------
// 2. Liquid-side render: build a synthetic one-section template on a fresh Core bundle clone, render
//    through the real LiquidRenderer, and read the per-section fragment from result.liquid.sections —
//    no HTML-scraping/regex extraction needed, the renderer already segments per-section output.
// ---------------------------------------------------------------------------------------------
async function renderLiquidSide(liquidSectionType, settings, blocks) {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const sectionSchema = bundle.sections[liquidSectionType]?.schema;
  if (!sectionSchema) {
    return { ok: false, reason: `Liquid bundle has no section "${liquidSectionType}" (checked packages/theme-engine/examples/letbuyy-core-liquid/)` };
  }

  const sectionKey = 'parity-target';
  const blockMap = {};
  const blockOrder = [];
  for (const block of blocks) {
    blockMap[block.id] = { type: block.type, settings: block.settings, disabled: false };
    blockOrder.push(block.id);
  }

  bundle.templates['__parity_test__'] = {
    name: 'Parity test',
    layout: 'theme',
    sections: {
      [sectionKey]: {
        type: liquidSectionType,
        settings,
        blocks: blockMap,
        block_order: blockOrder,
        disabled: false,
      },
    },
    order: [sectionKey],
  };

  const renderer = new LiquidRenderer();
  let result;
  try {
    result = await renderer.render({
      context: { storeId: STORE_ID, subdomain: 'parity-test', path: '/parity-test', previewMode: true, locale: 'en' },
      storeTemplate: { storeId: STORE_ID, themeId: 'letbuyy-core-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
      routeTemplate: { id: '__parity_test__', type: 'page', layoutKey: 'theme', sections: [] },
      liquidTemplateKey: '__parity_test__',
      liquidContext: {},
      liquidBundle: bundle,
    });
  } catch (err) {
    return { ok: false, reason: `LiquidRenderer threw: ${err?.message || String(err)}` };
  }

  if (result.status !== 'rendered' || !result.liquid) {
    return { ok: false, reason: `Liquid render status="${result.status}"; warnings: ${result.warnings.join('; ') || '(none)'}` };
  }
  const section = result.liquid.sections.find((s) => s.id === sectionKey);
  if (!section) {
    return { ok: false, reason: 'target section missing from result.liquid.sections' };
  }
  if (section.isError) {
    return { ok: false, reason: 'Liquid section rendered as an error placeholder', html: section.html };
  }
  return { ok: true, html: section.html, warnings: result.warnings };
}

// ---------------------------------------------------------------------------------------------
// 3. React-side render. The section files import Next.js runtime APIs (next/image, next/link,
//    next/navigation) and app context hooks (@/context/cart-context) that require a mounted Next.js
//    App Router / provider tree this standalone harness does not have. A minimal, clearly-labelled
//    dependency-injection swap (import-specifier rewrite, not a content fabrication) lets the component's
//    actual JSX/logic run unmodified through react-dom/server. Everything else — @letbuyy/* packages,
//    @/components/*, @/context/wishlist-context (its own createContext default is provider-safe) —
//    resolves to the REAL module.
// ---------------------------------------------------------------------------------------------
const IMPORT_REWRITES = [
  [/(['"])next\/image\1/g, (mockPath) => `'${mockPath}'`],
  [/(['"])next\/link\1/g, (mockPath) => `'${mockPath}'`],
  [/(['"])next\/navigation\1/g, (mockPath) => `'${mockPath}'`],
  [/(['"])@\/context\/cart-context\1/g, (mockPath) => `'${mockPath}'`],
];
const MOCK_FILES = ['next-image.mjs', 'next-link.mjs', 'next-navigation.mjs', 'cart-context.mjs'];

function toRelativeSpecifier(fromDir, toAbsPath) {
  let rel = relative(fromDir, toAbsPath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

// The harness copies a section file OUT of its real directory (src/components/sections/) into a sibling
// scratch directory (src/__liquid_parity_harness__/) so its Next.js/context imports can be swapped for
// test doubles without touching the real source tree. That move breaks two kinds of import that were
// correct relative to the ORIGINAL location: (a) `@/...` alias imports resolved via tsconfig `paths`,
// which this harness found unreliable for dynamically-imported copies at runtime, and (b) bare relative
// imports to sibling files still sitting in src/components/sections/ (e.g. hero.tsx's
// `import BannerCarousel from './banner-carousel'`). Both are rewritten to real, computed relative
// filesystem paths — this changes WHERE a module is loaded from, never WHAT the component's own
// logic/JSX does.
function rewriteImportsForHarness(source, harnessFileDir) {
  let rewritten = source;

  // ORDER MATTERS: each pass's output must not look like a match for an earlier pass's input pattern.
  // 1) Bare relative imports first — at this point the only `./x`/`../x` specifiers present are the
  //    file's ORIGINAL ones (e.g. hero.tsx's `./banner-carousel`); rewritten to real sibling paths.
  const sectionsRel = toRelativeSpecifier(harnessFileDir, SECTIONS_DIR);
  rewritten = rewritten.replace(/(from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\2/g, (_match, prefix, quote, subpath) => {
    const cleaned = subpath.replace(/^\.\.?\//, '');
    return `${prefix}${quote}${sectionsRel}/${cleaned}${quote}`;
  });

  // 2) Specific mock swaps (next/image, next/link, next/navigation, @/context/cart-context) — none of
  //    these specifiers start with `.`, so pass 1 above never touched them; must run before pass 3's
  //    broad `@/` rewrite so `@/context/cart-context` still matches its dedicated pattern.
  IMPORT_REWRITES.forEach(([pattern], index) => {
    const mockAbs = join(MOCKS_DIR, MOCK_FILES[index]);
    const mockRel = toRelativeSpecifier(harnessFileDir, mockAbs);
    rewritten = rewritten.replace(pattern, IMPORT_REWRITES[index][1](mockRel));
  });

  // 3) Every remaining `@/foo/bar` (not already swapped to a mock in pass 2) -> relative path into src/.
  const srcRel = toRelativeSpecifier(harnessFileDir, join(STOREFRONT_ROOT, 'src'));
  rewritten = rewritten.replace(/(['"])@\/([^'"]+)\1/g, (_match, quote, subpath) => `${quote}${srcRel}/${subpath}${quote}`);

  // Classic-vs-automatic JSX runtime safety net: guarantee `React` is in scope regardless of which
  // transform tsx applies to a dynamically-imported, relocated copy, without altering any JSX/logic.
  if (!/^import\s+React\b/m.test(rewritten) && !/\bimport\s+\*\s+as\s+React\b/.test(rewritten)) {
    rewritten = `import React from 'react';\n${rewritten}`;
  }

  return rewritten;
}

async function renderReactSide(reactFile, settings, blocks) {
  const srcPath = join(SECTIONS_DIR, reactFile);
  if (!existsSync(srcPath)) {
    return { ok: false, reason: `React section file not found: apps/storefront-runtime/src/components/sections/${reactFile}` };
  }
  const source = readFileSync(srcPath, 'utf8');
  mkdirSync(HARNESS_DIR, { recursive: true });
  const harnessFile = join(HARNESS_DIR, reactFile.replace(/\.tsx$/, '.harness.tsx'));
  writeFileSync(harnessFile, rewriteImportsForHarness(source, HARNESS_DIR), 'utf8');

  try {
    const mod = await import(pathToFileURL(harnessFile).href);
    const Component = mod.default;
    if (typeof Component !== 'function') {
      return { ok: false, reason: `${reactFile} has no default export function component` };
    }
    const section = {
      id: 'parity-target',
      type: reactFile.replace(/\.tsx$/, ''),
      order: 0,
      settings,
      blocks: blocks.map((b, i) => ({ id: b.id, type: b.type, order: i, settings: b.settings, isVisible: true })),
      isVisible: true,
    };
    // A few sections (featured-products, product-grid) take `products`/`basePath` as separate props,
    // not settings — an empty catalog is the honest default for an isolated section render (no
    // fabricated product data); it lets the settings-driven chrome still render instead of crashing.
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Component, { section, theme: DEFAULT_THEME_SETTINGS, products: [], basePath: '' }),
    );
    return { ok: true, html };
  } catch (err) {
    const rawStack = err?.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : String(err);
    const stack = rawStack.split(REPO_ROOT + '/').join(''); // strip the local absolute path prefix
    return { ok: false, reason: `React render threw: ${stack}` };
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Semantic extraction + comparison (never a byte-diff).
// ---------------------------------------------------------------------------------------------
function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ');
}

function extractSemantics(html) {
  const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: stripTags(m[2]).replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text.length > 0);
  const links = [...html.matchAll(/<a\b[^>]*\shref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1], text: stripTags(m[2]).replace(/\s+/g, ' ').trim() }));
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((tag) => {
    const src = (tag[0].match(/\ssrc=["']([^"']*)["']/) || [])[1] || '';
    const alt = (tag[0].match(/\salt=["']([^"']*)["']/) || [])[1] || '';
    return { src, alt };
  });
  const text = stripTags(html).replace(/\s+/g, ' ').trim();
  return { headings, links, images, text };
}

function containsValue(sem, value) {
  const v = String(value);
  if (sem.text.includes(v)) return true;
  if (sem.links.some((l) => l.href.includes(v) || l.text.includes(v))) return true;
  if (sem.images.some((img) => img.src.includes(v) || img.alt.includes(v))) return true;
  return false;
}

function compareSides(reactHtml, liquidHtml, settings, blocks) {
  const reactSem = extractSemantics(reactHtml);
  const liquidSem = extractSemantics(liquidHtml);
  const diffs = [];

  const allValues = { ...settings };
  for (const block of blocks) {
    for (const [key, value] of Object.entries(block.settings)) {
      allValues[`block.${block.type}.${key}`] = value;
    }
  }

  let matched = 0;
  let checked = 0;
  for (const [fieldId, value] of Object.entries(allValues)) {
    if (typeof value === 'boolean' || typeof value === 'number') continue; // not text-searchable
    const strVal = String(value);
    if (!strVal || strVal.length < 3) continue;
    checked += 1;
    const inReact = containsValue(reactSem, strVal);
    const inLiquid = containsValue(liquidSem, strVal);
    if (inReact && inLiquid) {
      matched += 1;
    } else if (inReact && !inLiquid) {
      diffs.push(`setting "${fieldId}" present in React output only (value: ${strVal.slice(0, 60)})`);
    } else if (!inReact && inLiquid) {
      diffs.push(`setting "${fieldId}" present in Liquid output only (value: ${strVal.slice(0, 60)})`);
    } else {
      diffs.push(`setting "${fieldId}" absent from BOTH outputs — neither side renders it (value: ${strVal.slice(0, 60)})`);
    }
  }

  const reactHeadingTexts = reactSem.headings.map((h) => h.text);
  const liquidHeadingTexts = liquidSem.headings.map((h) => h.text);
  if (reactHeadingTexts.length > 0 || liquidHeadingTexts.length > 0) {
    const reactSet = new Set(reactHeadingTexts);
    const liquidSet = new Set(liquidHeadingTexts);
    const onlyReact = reactHeadingTexts.filter((t) => !liquidSet.has(t));
    const onlyLiquid = liquidHeadingTexts.filter((t) => !reactSet.has(t));
    if (onlyReact.length > 0) diffs.push(`heading text only in React: ${JSON.stringify(onlyReact)}`);
    if (onlyLiquid.length > 0) diffs.push(`heading text only in Liquid: ${JSON.stringify(onlyLiquid)}`);
  }

  return {
    verdict: diffs.length === 0 ? 'PASS' : 'FAIL',
    checked,
    matched,
    diffs,
    react: { headingCount: reactSem.headings.length, linkCount: reactSem.links.length, imageCount: reactSem.images.length },
    liquid: { headingCount: liquidSem.headings.length, linkCount: liquidSem.links.length, imageCount: liquidSem.images.length },
  };
}

// ---------------------------------------------------------------------------------------------
// 5. Orchestrate all 20 entries.
// ---------------------------------------------------------------------------------------------
async function main() {
  rmSync(HARNESS_DIR, { recursive: true, force: true });
  const results = [];

  for (const entry of THEME_LIQUID_PORTABLE_SECTION_PARITY) {
    const bundleProbe = createLetbuyyCoreLiquidThemeBundleFixture();
    const schema = bundleProbe.sections[entry.liquidSectionType]?.schema;
    const settings = buildSettingsFromSchemaFields(schema?.settings);
    const blocks = buildBlocksFromSchemaBlocks(schema?.blocks);

    const record = { ...entry, settingsUsed: settings, blocksUsed: blocks.map((b) => ({ id: b.id, type: b.type, settings: b.settings })) };

    const liquidResult = await renderLiquidSide(entry.liquidSectionType, settings, blocks);
    const reactResult = await renderReactSide(entry.reactFile, settings, blocks);

    record.liquid = { ok: liquidResult.ok, reason: liquidResult.reason };
    record.react = { ok: reactResult.ok, reason: reactResult.reason };

    if (!liquidResult.ok || !reactResult.ok) {
      record.verdict = 'FAIL';
      record.reasons = [
        !liquidResult.ok ? `Liquid: ${liquidResult.reason}` : null,
        !reactResult.ok ? `React: ${reactResult.reason}` : null,
      ].filter(Boolean);
    } else {
      const comparison = compareSides(reactResult.html, liquidResult.html, settings, blocks);
      record.verdict = comparison.verdict;
      record.reasons = comparison.diffs;
      record.stats = { checked: comparison.checked, matched: comparison.matched, react: comparison.react, liquid: comparison.liquid };
    }

    results.push(record);
    console.log(`[${record.verdict}] ${entry.reactFile} <-> ${entry.liquidSectionType}${record.reasons?.length ? ' — ' + record.reasons[0] : ''}`);
  }

  rmSync(HARNESS_DIR, { recursive: true, force: true });

  const passCount = results.filter((r) => r.verdict === 'PASS').length;
  const failCount = results.filter((r) => r.verdict === 'FAIL').length;

  const report = {
    generatedBy: 'scripts/liquid-parity/render-parity-harness.mjs',
    method: 'Semantic diff (headings/links/images/setting-value presence) via react-dom/server renderToStaticMarkup vs the real LiquidRenderer + sanitizeRenderedHtml path. Not a byte-compare.',
    totalSections: THEME_LIQUID_PORTABLE_SECTION_PARITY.length,
    passCount,
    failCount,
    results,
  };

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  const summaryLines = [
    '# S1/W4 — Render-parity harness results',
    '',
    `${passCount}/${THEME_LIQUID_PORTABLE_SECTION_PARITY.length} sections PASS semantic parity; ${failCount} FAIL.`,
    '',
    '| React file | Liquid section | Verdict | Reason (first) |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.reactFile} | ${r.liquidSectionType} | ${r.verdict} | ${(r.reasons?.[0] || '').replace(/\|/g, '\\|')} |`),
  ];
  writeFileSync(SUMMARY_PATH, summaryLines.join('\n') + '\n', 'utf8');

  console.log('');
  console.log(`${passCount}/${THEME_LIQUID_PORTABLE_SECTION_PARITY.length} PASS, ${failCount} FAIL`);
  console.log('written:', REPORT_PATH.replace(REPO_ROOT + '/', ''));
  console.log('written:', SUMMARY_PATH.replace(REPO_ROOT + '/', ''));
}

main().catch((err) => {
  console.error('FATAL harness error:', err);
  rmSync(HARNESS_DIR, { recursive: true, force: true });
  process.exit(1);
});
