#!/usr/bin/env node
// Phase E.0 snapshot comparison: structural HTML diff React vs Liquid per section + viewport.
//
// Usage:
//   node scripts/liquid-parity/compare-snapshots.mjs --section hero --viewport desktop
//   node scripts/liquid-parity/compare-snapshots.mjs --section all   # all 20 sections

import { parseArgs } from 'node:util';
import {
  readSnapshot,
  writeDiff,
  structuralDiff,
  writeMatrixResult,
  ALL_FROZEN_SECTIONS,
  VIEWPORTS,
} from './harness-lib.mjs';

const { values: opts } = parseArgs({
  options: {
    section:  { type: 'string', default: 'all' },
    viewport: { type: 'string', default: 'all' },
  },
  strict: false,
});

const sections = opts.section === 'all' ? ALL_FROZEN_SECTIONS : [opts.section];
const viewports = opts.viewport === 'all' ? Object.keys(VIEWPORTS) : [opts.viewport];

const results = [];

for (const section of sections) {
  for (const viewport of viewports) {
    const reactHtml  = readSnapshot('react',  viewport, section);
    const liquidHtml = readSnapshot('liquid', viewport, section);

    if (!reactHtml || !liquidHtml) {
      console.log(`  SKIP  ${section} [${viewport}] — snapshots missing (run capture-snapshot.mjs first)`);
      results.push({ section, viewport, status: 'SKIP' });
      continue;
    }

    const diffs = structuralDiff(reactHtml, liquidHtml);
    const diffPath = writeDiff(section, viewport, diffs);
    const status = diffs ? 'FAIL' : 'PASS';

    if (diffs) {
      console.log(`  FAIL  ${section} [${viewport}] — ${diffs.filter(d => d.pos >= 0).length} diff(s) → ${diffPath}`);
    } else {
      console.log(`  PASS  ${section} [${viewport}]`);
    }

    writeMatrixResult(section, viewport, 'rendering', status, diffs ? `${diffs.length} diff(s)` : '');
    results.push({ section, viewport, status });

    // Head metadata comparison
    const reactHead  = readSnapshot('react',  `${viewport}-head`, section);
    const liquidHead = readSnapshot('liquid', `${viewport}-head`, section);
    if (reactHead && liquidHead) {
      const headDiffs = structuralDiff(reactHead, liquidHead);
      const headStatus = headDiffs ? 'FAIL' : 'PASS';
      writeMatrixResult(section, viewport, 'seo-meta', headStatus, headDiffs ? `${headDiffs.length} head diff(s)` : '');
      if (headDiffs) {
        console.log(`         SEO/meta FAIL  ${section} [${viewport}] — ${headDiffs.length} head diff(s)`);
      }
    }
  }
}

console.log(`\n───────────────────────────────────────────`);
const passed  = results.filter(r => r.status === 'PASS').length;
const failed  = results.filter(r => r.status === 'FAIL').length;
const skipped = results.filter(r => r.status === 'SKIP').length;
console.log(`COMPARISON SUMMARY: ${passed} pass  ${failed} fail  ${skipped} skip`);

if (failed > 0) {
  console.error(`\n${failed} section(s) have render diffs. Any red cell blocks canary.`);
  process.exit(1);
}
