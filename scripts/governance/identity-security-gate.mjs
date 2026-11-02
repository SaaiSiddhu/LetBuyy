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
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => {
  try { return readFileSync(join(root, p), 'utf8'); } catch { return null; }
};

/** @type {{id:string,file:string,mustContain:string[],desc:string}[]} */
const checks = [
  {
    id: 'SEC-C1',
    file: 'apps/platform/identity/src/app/api/auth/switch/route.ts',
    mustContain: ["checkRateLimit('switch'", 'validateSession(', 'getAccounts()', 'isProvenAccount'],
    desc: '/switch must require rate-limit + a valid current session + target in signed accounts cookie',
  },
  {
    id: 'SEC-C2',
    file: 'apps/internal/console/src/lib/console-session.ts',
    mustContain: ['verifyIdentityPlatformSession(cookieValue,', 'publicJwks:process.env.LETBUYY_IDENTITY_PUBLIC_JWKS'],
    desc: 'Console must delegate human-session verification to the sole Identity public verifier',
  },
  {
    id: 'SEC-C3',
    file: 'services/api-gateway/src/lib/crypto.ts',
    mustContain: ['Sandbox KMS is not permitted in production'],
    desc: 'sandbox KMS must fail closed in production-like runtimes',
  },
  {
    id: 'SEC-H3',
    file: 'apps/platform/identity/src/lib/auth/cookies.ts',
    mustContain: ['isProductionIdentityRuntime(process.env)'],
    desc: 'lb_accounts signing key must refuse the weak dev key in any production-like runtime',
  },
];

/** Disallowed: a dangerous default that would re-introduce a bypass. */
const forbidden = [
  {
    id: 'SEC-C2-literal-default',
    file: 'apps/internal/console/src/lib/console-session.ts',
    mustNotMatch: /PLATFORM_CONSOLE_SESSION_SECRET|createHmac|SignJWT/,
    desc: 'Console must not restore a local symmetric verifier or human-session signer',
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

// The old symmetric-secret production check is superseded by the canonical
// issuer/verifier contract. Reuse its executable-body/SQL guard rather than
// treating a matching comment or an uncalled public verifier as evidence.
try {
  execFileSync(process.execPath, [join(root, 'scripts/validators/session-security-validator.mjs')], { cwd: root, stdio: 'pipe' });
  console.log('✓ canonical session-security validator passed (sole issuer, live verifier and durable MFA)');
} catch {
  console.error('✗ canonical session-security validator failed; run it for the exact guard diagnostic.');
  failed++;
}

if (failed) {
  console.error(`\nidentity-security-gate: ${failed} regression(s) detected.`);
  process.exit(1);
}
console.log('\nidentity-security-gate: all Wave 0 security guards present.');
