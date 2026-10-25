/** Serial finite source runner; caller supplies admitted inputs and a fresh owned output. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertBundleIdentity, runThemeDataContract, sha256 } from './theme-data-contract.mjs';
import { loadCanonicalAdapters } from './canonical-adapters.mjs';

const flag = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputPath = flag('input'), outputPath = flag('output');
assert.ok(inputPath && outputPath, 'usage: node --import tsx run.mjs --input=<manifest.json> --output=<fresh-owned-folder> [--root=<repo>]');
const root = resolve(flag('root') ?? process.cwd());
const output = resolve(outputPath);
assert.ok(!existsSync(output), 'refuse to overwrite an earlier result');
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
const inputs = manifest.themes ?? [manifest];
assert.ok(Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 10, 'one explicit input per admitted theme; maximum ten');
const identities = new Set(), summary = [];
const verifyPins = pins => {
  assert.ok(Array.isArray(pins) && pins.length, 'caller must supply source pins');
  return pins.map(pin => {
    assert.equal(typeof pin.path, 'string');
    assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    const actual = sha256(readFileSync(resolve(root, pin.path)));
    assert.equal(actual, pin.sha256, `source input changed: ${pin.path}`);
    return { ...pin, actual };
  });
};
for (const input of inputs) {
  const expected = input.expectedIdentity;
  assert.ok(expected?.slug && expected?.version && expected?.bundleSha256, 'expected slug/version/bundle hash must come from the caller\'s actual admitted input, never factory output fallback');
  const id = `${expected.slug}__${expected.version}`;
  assert.ok(!identities.has(id), 'each input identity executes once per batch'); identities.add(id);
  const out = join(output, id);
  // Validate path-bearing identity before creating its folder or loading any factory.
  assert.match(expected.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(expected.version, /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);
  mkdirSync(out);
  const emit = (name, value) => {
    assert.ok(!name.includes('/') && !name.includes('..'), 'artifact names stay inside this identity');
    writeFileSync(join(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  };
  try {
    emit('input.json', input);
    const before = verifyPins(input.sourcePins); emit('source-pins-before.json', before);
    const module = await import(pathToFileURL(resolve(root, input.bundleFactory.module)).href);
    assert.equal(typeof module[input.bundleFactory.export], 'function');
    const bundle = await module[input.bundleFactory.export](...input.bundleFactory.args);
    assertBundleIdentity(bundle, expected); // fail BEFORE adapters on ignored selector/version
    const adapters = await loadCanonicalAdapters(input.adapters, { root, emit });
    const result = runThemeDataContract({ bundle, expectedIdentity: expected, templateKey: input.templateKey, adapters, fixtures: input.fixtures, emit });
    emit('result.json', result);
    const after = verifyPins(input.sourcePins); emit('source-pins-after.json', after);
    summary.push({ identity: expected, pass: result.pass, fail: result.fail, scope: result.classification, sourcePinsExact: true });
  } catch (error) {
    const failure = { identity: expected, fatal: error instanceof Error ? error.message : String(error), pass: 0, fail: 1, scope: 'SOURCE_RUN_REFUSED_OR_FAILED_NOT_INSTALLED_ACCEPTANCE' };
    emit('fatal.json', failure); summary.push(failure);
  }
}
writeFileSync(join(output, 'summary.json'), JSON.stringify({ classification: 'SERIAL_SOURCE_CONTRACT_BATCH_NOT_THEME_CERTIFICATION', inputs: summary }, null, 2) + '\n');
console.log(JSON.stringify(summary));
process.exitCode = summary.some(row => row.fail > 0) ? 1 : 0;
