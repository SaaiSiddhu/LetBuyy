#!/usr/bin/env node
// Committed secret placeholder validator.
//
// Fails CI if any committed wrangler.toml assigns a plaintext value to a CREDENTIAL key
// (name ending in _SECRET, _TOKEN, or _PRIVATE_KEY). Such values MUST be Cloudflare Worker secrets set
// via `wrangler secret put`, never committed as a `[vars]` value.
//
// This gate exists because a committed placeholder —
//   INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET"
// — shipped in mobile-bff/wrangler.toml and made the entire mobile backend return HTTP
// 500 for every authenticated request. Non-credential placeholders (e.g. FCM_PROJECT_ID,
// APNS_BUNDLE_ID) are intentionally allowed; credential keys are gated.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps', 'services'];
const CREDENTIAL_KEY = /^[A-Za-z0-9_]*(_SECRET|_TOKEN|_PRIVATE_KEY)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'build']);
const violations = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full);
    else if (name === 'wrangler.toml') scan(full);
  }
}

function scan(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const assignment = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) return;
    const [, key, rawValue] = assignment;
    if (!CREDENTIAL_KEY.test(key)) return;
    const quoted = rawValue.match(/^["']([^"']*)["']/);
    if (quoted && quoted[1].length > 0) {
      violations.push({ file, line: index + 1, key, value: quoted[1] });
    }
  });
}

for (const root of ROOTS) walk(root);

if (violations.length > 0) {
  console.error('Committed secret placeholder validator FAILED.');
  console.error('Credential keys (ending in _SECRET / _TOKEN / _PRIVATE_KEY) must be provisioned with');
  console.error('`wrangler secret put`, never committed as a plaintext [vars] value:');
  for (const v of violations) {
    const preview = v.value.length > 24 ? `${v.value.slice(0, 24)}…` : v.value;
    console.error(`  ${v.file}:${v.line}  ${v.key} = "${preview}"`);
  }
  process.exit(1);
}

console.log('Committed secret placeholder validator passed (no plaintext *_SECRET/*_TOKEN/*_PRIVATE_KEY in committed wrangler.toml).');
process.exit(0);
