#!/usr/bin/env node
/**
 * identity-security-gate.mjs — Wave 6 governance gate (LetBuyy Foundation Step-Up).
 *
 * Fails (exit 1) if any Wave 0 security fix has been reverted. This is a regression
 * guard, not a linter: it asserts the *presence* of each fix's load-bearing guard, so
 * a future change that removes the protection breaks CI loudly.
 *
 * Run: `node scripts/governance/identity-security-gate.mjs` (no dependencies).
 * Wire into CI alongside `node scripts/validate-governance.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => {
  try { return readFileSync(join(root, p), 'utf8'); } catch { return null; }
};

/** @type {{id:string,file:string,mustContain:string[],desc:string}[]} */
const checks = [
  {
    id: 'SEC-C1',
    file: 'apps/identity-platform/src/app/api/auth/switch/route.ts',
    mustContain: ["checkRateLimit('switch'", 'validateSession(', 'getAccounts()', 'isProvenAccount'],
    desc: '/switch must require rate-limit + a valid current session + target in signed accounts cookie',
  },
  {
    id: 'SEC-C2',
    file: 'apps/platform-console/src/lib/console-session.ts',
    mustContain: ["APP_ENV === 'production'", "VERCEL_ENV === 'production'"],
    desc: 'console session secret prod-gate must check APP_ENV and VERCEL_ENV, not NODE_ENV alone',
  },
  {
    id: 'SEC-C3',
    file: 'services/api-gateway/src/lib/crypto.ts',
    mustContain: ['Mock KMS is not permitted in production'],
    desc: 'mock KMS must fail closed in production-like runtimes',
  },
  {
    id: 'SEC-H3',
    file: 'apps/identity-platform/src/lib/auth/cookies.ts',
    mustContain: ['isProductionIdentityRuntime(process.env)'],
    desc: 'lb_accounts signing key must refuse the weak dev key in any production-like runtime',
  },
];

/** Disallowed: a dangerous default that would re-introduce a bypass. */
const forbidden = [
  {
    id: 'SEC-C2-literal-default',
    file: 'apps/platform-console/src/lib/console-session.ts',
    // The literal may exist only inside the non-production branch. Fail if the prod
    // gate reverts to NODE_ENV-only (i.e. APP_ENV/VERCEL_ENV checks removed).
    mustNotMatch: /if \(process\.env\.NODE_ENV === 'production'\) \{\s*\n\s*return isSafeSecret/,
    desc: 'console prod gate must not revert to NODE_ENV-only',
  },
];

let failed = 0;
for (const c of checks) {
  const src = read(c.file);
  if (src == null) { console.error(`✗ ${c.id}: missing file ${c.file}`); failed++; continue; }
  const missing = c.mustContain.filter((s) => !src.includes(s));
  if (missing.length) {
    console.error(`✗ ${c.id} REGRESSED in ${c.file}\n    expected: ${c.desc}\n    missing: ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
    failed++;
  } else {
    console.log(`✓ ${c.id} guard present (${c.file})`);
  }
}
for (const f of forbidden) {
  const src = read(f.file);
  if (src && f.mustNotMatch.test(src)) {
    console.error(`✗ ${f.id} forbidden pattern present in ${f.file}: ${f.desc}`);
    failed++;
  }
}

if (failed) {
  console.error(`\nidentity-security-gate: ${failed} regression(s) detected.`);
  process.exit(1);
}
console.log('\nidentity-security-gate: all Wave 0 security guards present.');
