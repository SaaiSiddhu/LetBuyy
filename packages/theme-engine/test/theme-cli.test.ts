// H6 tests — Theme CLI contract tests
// All tests import { COMMANDS } from the CLI source and exercise commands in-process.
// No subprocesses, no file I/O.
import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS } from '../src/theme-cli.ts';
import { createUrbanKicksLiquidThemeBundleFixture } from '../src/theme-bundle.ts';

// (1) COMMANDS has all four expected functions
test('theme-cli: COMMANDS map has validate, lint, compile, export functions', () => {
  assert.ok(typeof COMMANDS.validate === 'function', 'COMMANDS.validate must be a function');
  assert.ok(typeof COMMANDS.lint === 'function', 'COMMANDS.lint must be a function');
  assert.ok(typeof COMMANDS.compile === 'function', 'COMMANDS.compile must be a function');
  assert.ok(typeof COMMANDS.export === 'function', 'COMMANDS.export must be a function');
});

// (2) validate command with Urban Kicks fixture returns ok=true
test('theme-cli: COMMANDS.validate with Urban Kicks fixture returns {ok: true, issues: []}', async () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const result = await COMMANDS.validate(JSON.stringify(fixture)) as { ok: boolean; issues: string[] };
  assert.equal(result.ok, true, `Expected ok=true but issues were: ${result.issues?.join(', ')}`);
  assert.deepEqual(result.issues, []);
});

// (3) lint command with Urban Kicks fixture returns an array (no error-level issues)
test('theme-cli: COMMANDS.lint with Urban Kicks fixture returns array with no error-level issues', async () => {
  const fixture = createUrbanKicksLiquidThemeBundleFixture();
  const result = await COMMANDS.lint(JSON.stringify(fixture)) as Array<{ level: string }>;
  assert.ok(Array.isArray(result), 'Expected lint result to be an array');
  const errors = result.filter((i) => i.level === 'error');
  assert.equal(errors.length, 0, `Expected no error-level issues but got ${errors.length}`);
});

// (4) validate command with empty object returns ok=false
test('theme-cli: COMMANDS.validate with "{}" returns {ok: false} with non-empty issues', async () => {
  const result = await COMMANDS.validate('{}') as { ok: boolean; issues: string[] };
  assert.equal(result.ok, false);
  assert.ok(result.issues.length > 0, 'Expected non-empty issues for an invalid bundle');
});
