// APPID-P2 — the secret scan covers documentation, root AGENTS.md and reference/ donors, and its only
// escape hatch binds one exact value in one exact file.
//
// WHY. Until 2026-09-24 environment-validator skipped every path under docs/, root AGENTS.md and
// config/env/templates/. The founder: "Do not exempt all documentation or Markdown from secret
// scanning. Use narrow, justified test-fixture exceptions. Never print detected credential values."
// These tests run the real validator in a throwaway repository, so they prove what the gate does, not
// what a helper returns. No key-shaped literal appears in this file: every sample is assembled at
// runtime from random bytes, so the scanner cannot trip on the test itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  exceptionMatches,
  exceptionRegistryProblems,
  findSecretLikeValues,
  isPlaceholderValue,
  sha256,
} from '../../scripts/validators/secret-scan-core.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const randomBody = (length) => [...crypto.randomBytes(length)].map((byte) => ALNUM[byte % ALNUM.length]).join('');
const googleShaped = () => ['AI', 'za', randomBody(35)].join('');
const razorpayShaped = () => ['rzp', '_test_', randomBody(14)].join('');

test('a key-shaped value is found, and the finding never carries the value', () => {
  const value = googleShaped();
  const findings = findSecretLikeValues(`const config = { apiKey: '${value}' };\n`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'google-api-key');
  assert.equal(findings[0].line, 1);
  assert.equal(findings[0].sha256, sha256(value));
  assert.ok(!JSON.stringify(findings).includes(value), 'a finding must never contain the value it found');
});

test('placeholders and labelled fixtures are not findings, key material is', () => {
  const prefix = ['rzp', '_test_'].join('');
  assert.equal(findSecretLikeValues(`Key ID: ${prefix}${'X'.repeat(12)}\n`).length, 0, 'an all-X body is a placeholder');
  assert.equal(findSecretLikeValues(`Key ID: ${prefix}${'0'.repeat(14)}\n`).length, 0, 'one repeated symbol is a placeholder');
  assert.equal(findSecretLikeValues(`key: '${razorpayShaped()}' // placeholder\n`).length, 0, 'an explicit fixture marker on the line');
  assert.equal(findSecretLikeValues(`key: '${razorpayShaped()}'\n`).length, 1, 'a random body is key material');
  assert.equal(isPlaceholderValue(`${prefix}${randomBody(14)}`, /^rzp_test_/), false);
});

test('a PEM header alone is a redaction fixture; a full block is a key', () => {
  const begin = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const end = ['-----END', 'PRIVATE KEY-----'].join(' ');
  assert.equal(findSecretLikeValues(`expect(output).not.toContain('${begin}')\n`).length, 0);
  assert.equal(findSecretLikeValues(`${begin}\n${randomBody(64)}\n${end}\n`).length, 1);
});

test('an exception binds path, kind and value together', () => {
  const value = googleShaped();
  const [finding] = findSecretLikeValues(`k='${value}'`);
  const entry = { path: 'apps/a/config.json', kind: 'google-api-key', sha256: sha256(value) };
  assert.equal(exceptionMatches(entry, 'apps/a/config.json', finding), true);
  assert.equal(exceptionMatches(entry, 'apps/b/config.json', finding), false, 'the same value in another file is not excepted');
  const [other] = findSecretLikeValues(`k='${googleShaped()}'`);
  assert.equal(exceptionMatches(entry, 'apps/a/config.json', other), false, 'another value in the same file is not excepted');
});

test('the registry refuses prefix, directory and glob exemptions and unreviewed entries', () => {
  const tracked = new Set(['docs/a.md']);
  const good = {
    path: 'docs/a.md', kind: 'google-api-key', sha256: 'a'.repeat(64), classification: 'public-client-identifier',
    justification: 'j', evidence: 'e', retire_when: 'r',
  };
  assert.deepEqual(exceptionRegistryProblems({ exceptions: [good] }, (p) => tracked.has(p)), []);
  const problems = (entry) => exceptionRegistryProblems({ exceptions: [entry] }, (p) => tracked.has(p));
  assert.ok(problems({ ...good, path: 'docs/' }).some((m) => /one file/.test(m)));
  assert.ok(problems({ ...good, path: 'docs/*.md' }).some((m) => /one file/.test(m)));
  assert.ok(problems({ ...good, prefix: 'docs/' }).some((m) => /unsupported field prefix/.test(m)));
  assert.ok(problems({ ...good, classification: 'documentation' }).some((m) => /unknown classification/.test(m)));
  assert.ok(problems({ ...good, justification: '' }).some((m) => /missing justification/.test(m)));
  assert.ok(problems({ ...good, path: 'docs/gone.md' }).some((m) => /not tracked/.test(m)));
  assert.ok(problems({ ...good, sha256: 'not-a-hash' }).some((m) => /64 lowercase hex/.test(m)));
});

// --- the real validator, in a throwaway repository -------------------------------------------------

function makeFixtureRepo(exceptions) {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'letbuyy-secret-scan-'));
  const write = (rel, text) => { fs.mkdirSync(dirname(join(dir, rel)), { recursive: true }); fs.writeFileSync(join(dir, rel), text); };
  for (const module of ['environment-validator.mjs', 'governance-common.mjs', 'secret-scan-core.mjs']) {
    write(`scripts/validators/${module}`, fs.readFileSync(join(repoRoot, 'scripts/validators', module), 'utf8'));
  }
  // The only files the validator parses before its secret scan; empty objects keep it running.
  write('config/env/ownership/runtime-env-ownership.json', '{}');
  write('config/env/staging-production-secret-matrix.json', '{}');
  const values = { docs: googleShaped(), agents: razorpayShaped(), reference: googleShaped(), app: googleShaped() };
  write('docs/guide/leak.md', `# Guide\n\nThe key is ${values.docs}.\n`);
  write('AGENTS.md', `# Rules\n\nkey id ${values.agents}\n`);
  write('reference/apps/donor/lib/config.dart', `const apiKey = '${values.reference}';\n`);
  write('apps/web/src/config.ts', `export const apiKey = '${values.app}';\n`);
  write('config/governance/secret-scan-exceptions.json', JSON.stringify({ exceptions: exceptions(values) }));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return { dir, values };
}

function runFixture(exceptions) {
  const { dir, values } = makeFixtureRepo(exceptions);
  try {
    const result = spawnSync(process.execPath, ['scripts/validators/environment-validator.mjs'], { cwd: dir, encoding: 'utf8' });
    return { output: `${result.stdout}${result.stderr}`, status: result.status, values };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const entry = (path, value) => ({
  path, kind: value.startsWith('AI') ? 'google-api-key' : 'razorpay-key-id', sha256: sha256(value),
  classification: 'public-client-identifier', justification: 'fixture', evidence: 'fixture', retire_when: 'fixture',
});

test('documentation, root AGENTS.md and reference/ donors are scanned, and values are never printed', () => {
  const { output, status, values } = runFixture(() => []);
  assert.notEqual(status, 0);
  for (const expected of ['docs/guide/leak.md:3 (google-api-key)', 'AGENTS.md:3 (razorpay-key-id)', 'reference/apps/donor/lib/config.dart:1 (google-api-key)', 'apps/web/src/config.ts:1 (google-api-key)']) {
    assert.ok(output.includes(expected), `the validator did not report ${expected}:\n${output}`);
  }
  for (const value of Object.values(values)) assert.ok(!output.includes(value), 'a detected value reached the output');
});

test('a reviewed exception clears exactly its own value and file', () => {
  const { output, values } = runFixture((v) => [entry('docs/guide/leak.md', v.docs), entry('reference/apps/donor/lib/config.dart', v.docs)]);
  assert.ok(!output.includes('docs/guide/leak.md:3'), 'the excepted value is still reported');
  assert.ok(output.includes('reference/apps/donor/lib/config.dart:1 (google-api-key)'), 'an exception for one value excused a different value');
  assert.ok(output.includes('AGENTS.md:3 (razorpay-key-id)'));
  // The second entry names a real file but a value that file does not contain: stale.
  assert.match(output, /no longer match any value[^\n]*reference\/apps\/donor\/lib\/config\.dart \(google-api-key\)/);
  for (const value of Object.values(values)) assert.ok(!output.includes(value));
});

test('a prefix-style registry entry is rejected by the real validator', () => {
  const { output } = runFixture((v) => [{ ...entry('docs/guide/leak.md', v.docs), path: 'docs/' }]);
  assert.match(output, /exception registry is malformed[^\n]*one file/);
  assert.ok(output.includes('docs/guide/leak.md:3 (google-api-key)'), 'a directory entry must not excuse files under it');
});
