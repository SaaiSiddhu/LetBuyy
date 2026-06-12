#!/usr/bin/env node
// Phase E.0 full parity matrix runner.
// Captures React + Liquid snapshots for all 20 frozen sections × 2 viewports, then compares.
//
// Usage:
//   node scripts/liquid-parity/run-parity-matrix.mjs           # all 20 sections
//   node scripts/liquid-parity/run-parity-matrix.mjs hero      # specific section
//
// Required env:
//   STAGING_STOREFRONT_BASE_URL   — storefront base URL
//   STAGING_TEST_SUBDOMAIN        — subdomain of React-engine test store
//   STAGING_LIQUID_SUBDOMAIN      — subdomain of Liquid-engine test store (defaults to STAGING_TEST_SUBDOMAIN)

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_FROZEN_SECTIONS, VIEWPORTS, requireEnv } from './harness-lib.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

requireEnv('STAGING_STOREFRONT_BASE_URL');
requireEnv('STAGING_TEST_SUBDOMAIN');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const sections = args.length > 0 ? ALL_FROZEN_SECTIONS.filter(s => args.includes(s)) : ALL_FROZEN_SECTIONS;

if (sections.length === 0) {
  console.error(`No matching sections for: ${args.join(', ')}`);
  console.error(`Available: ${ALL_FROZEN_SECTIONS.join(', ')}`);
  process.exit(1);
}

const liquidSubdomain = process.env.STAGING_LIQUID_SUBDOMAIN || process.env.STAGING_TEST_SUBDOMAIN;
const reactSubdomain  = process.env.STAGING_TEST_SUBDOMAIN;

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`LetBuyy Liquid Parity Matrix — Document 6 §2`);
console.log(`Sections: ${sections.length}/${ALL_FROZEN_SECTIONS.length}  Viewports: ${Object.keys(VIEWPORTS).join(', ')}`);
console.log(`React store:  ${reactSubdomain}`);
console.log(`Liquid store: ${liquidSubdomain}`);
console.log(`═══════════════════════════════════════════════════\n`);

const captureScript  = join(SCRIPT_DIR, 'capture-snapshot.mjs');
const compareScript  = join(SCRIPT_DIR, 'compare-snapshots.mjs');
const captureErrors  = [];

function capture(engine, subdomain, section, viewport) {
  const result = spawnSync(process.execPath, [captureScript,
    '--section', section,
    '--subdomain', subdomain,
    '--engine', engine,
    '--viewport', viewport,
  ], { stdio: 'inherit', env: process.env });
  return result.status === 0;
}

// Phase 1: capture
console.log('PHASE 1 — capturing snapshots');
for (const section of sections) {
  for (const viewport of Object.keys(VIEWPORTS)) {
    const label = `${section} [${viewport}]`;
    const reactOk  = capture('react',  reactSubdomain,  section, viewport);
    const liquidOk = capture('liquid', liquidSubdomain, section, viewport);
    if (!reactOk || !liquidOk) {
      captureErrors.push(`${label}: capture failed (react=${reactOk} liquid=${liquidOk})`);
    }
  }
}

if (captureErrors.length > 0) {
  console.error(`\nCapture errors:\n${captureErrors.map(e => `  ${e}`).join('\n')}`);
}

// Phase 2: compare
console.log('\nPHASE 2 — comparing snapshots');
const compareResult = spawnSync(process.execPath, [compareScript,
  '--section', 'all',
  '--viewport', 'all',
], { stdio: 'inherit', env: process.env });

const allPassed = captureErrors.length === 0 && compareResult.status === 0;

console.log(`\n═══════════════════════════════════════════════════`);
console.log(`PARITY MATRIX RESULT: ${allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}`);
if (!allPassed) {
  console.log(`Evidence: LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/`);
  console.log(`Any red cell blocks canary C2 advancement (Document 6 §2).`);
  process.exit(1);
}
console.log(`Evidence written to: LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/`);
