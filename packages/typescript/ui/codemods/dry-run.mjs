import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const codemodDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(codemodDir, 'fixtures');
const codemods = [
    'data-table-to-table',
    'index-table-to-table',
    'badge-danger-to-critical',
    'page-aliases-to-canonical',
    'text-style-to-text',
    'token-alias-rename',
];

function readFixture(name, kind) {
    const tsxPath = join(fixtureDir, `${name}.${kind}.tsx`);
    const cssPath = join(fixtureDir, `${name}.${kind}.css`);
    const path = existsSync(tsxPath) ? tsxPath : cssPath;
    return readFileSync(path, 'utf8');
}

for (const name of codemods) {
    const transform = require(`./${name}.cjs`);
    const input = readFixture(name, 'input');
    const expected = readFixture(name, 'output');
    const actual = transform({ path: `${name}.fixture`, source: input });
    assert.equal(actual, expected, `${name} fixture output matches`);
}

process.stdout.write(`codemod dry-run passed (${codemods.length} fixtures)\n`);
