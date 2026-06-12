#!/usr/bin/env node
// Phase E.0 snapshot capture: fetch storefront, extract section HTML + head meta, save to evidence/.
//
// Usage:
//   node scripts/liquid-parity/capture-snapshot.mjs \
//     --section hero --subdomain my-store --engine react --viewport desktop
//
// Env:
//   STAGING_STOREFRONT_BASE_URL  (required)
//   STAGING_TEST_SUBDOMAIN       (fallback subdomain if --subdomain not given)

import { parseArgs } from 'node:util';
import {
  requireEnv,
  fetchStorefrontPage,
  extractSectionHtml,
  extractHeadMeta,
  writeSnapshot,
  ALL_FROZEN_SECTIONS,
  VIEWPORTS,
} from './harness-lib.mjs';

const { values: opts } = parseArgs({
  options: {
    section:  { type: 'string' },
    subdomain: { type: 'string' },
    engine:   { type: 'string', default: 'react' },
    viewport: { type: 'string', default: 'desktop' },
    mode:     { type: 'string', default: 'both' },
  },
  strict: false,
});

const baseUrl  = requireEnv('STAGING_STOREFRONT_BASE_URL');
const subdomain = opts.subdomain || requireEnv('STAGING_TEST_SUBDOMAIN');
const section  = opts.section;
const engine   = opts.engine;
const viewport = opts.viewport;
const mode     = opts.mode;

if (!section || !ALL_FROZEN_SECTIONS.includes(section)) {
  console.error(`--section must be one of:\n  ${ALL_FROZEN_SECTIONS.join('\n  ')}`);
  process.exit(1);
}
if (!['react', 'liquid'].includes(engine)) {
  console.error('--engine must be react or liquid');
  process.exit(1);
}
if (!VIEWPORTS[viewport]) {
  console.error('--viewport must be desktop or mobile');
  process.exit(1);
}

console.log(`\n[parity-capture] section=${section} engine=${engine} viewport=${viewport} subdomain=${subdomain}`);

let html;
try {
  html = await fetchStorefrontPage(baseUrl, subdomain, viewport);
} catch (err) {
  console.error(`Fetch failed: ${err.message}`);
  process.exit(1);
}

const renderEngineHeader = 'Response did not include X-Lb-Render-Engine (run against a wired deploy)';
console.log(`  Render engine header hint: ${renderEngineHeader}`);

if (mode === 'both' || mode === 'body') {
  const sectionHtml = extractSectionHtml(html, section);
  if (!sectionHtml) {
    console.warn(`  WARNING: section "${section}" not found in page HTML (section may not be on homepage)`);
    const fallback = `<!-- section ${section} not present in homepage; run against a store fixture that includes this section -->`;
    const outPath = writeSnapshot(engine, viewport, section, fallback);
    console.log(`  Wrote placeholder to: ${outPath}`);
  } else {
    const outPath = writeSnapshot(engine, viewport, section, sectionHtml);
    console.log(`  Wrote body snapshot: ${outPath}`);
  }
}

if (mode === 'both' || mode === 'head') {
  const headMeta = extractHeadMeta(html);
  const outPath = writeSnapshot(engine, `${viewport}-head`, section, headMeta);
  console.log(`  Wrote head snapshot: ${outPath}`);
}

console.log(`[parity-capture] done`);
