import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { NODE_CLI_SHEBANG } from '../helpers/node-cli-shim.mjs';

test('fake CLIs execute through a Node path containing spaces and preserve exact arguments', () => {
    const root = mkdtempSync(join(tmpdir(), 'owned-cli-shim-'));
    try {
        const bin = join(root, 'Node Tools # தமிழ்');
        mkdirSync(bin);
        const interpreter = join(bin, 'node');
        symlinkSync(process.execPath, interpreter);
        const body = 'process.stdout.write(JSON.stringify(process.argv.slice(2)));';
        const good = join(root, 'fake-cli');
        writeFileSync(good, NODE_CLI_SHEBANG + body);
        chmodSync(good, 0o755);
        // No real provider/Docker CLI is reachable through this controlled PATH.
        const env = { ...process.env, PATH: bin };
        const args = ['two words', '#100%', 'தமிழ்'];
        const actual = spawnSync(good, args, { env, encoding: 'utf8', timeout: 5000 });
        assert.equal(actual.status, 0, actual.stderr);
        assert.deepEqual(JSON.parse(actual.stdout), args);
        const broken = join(root, 'broken-cli');
        writeFileSync(broken, `#!${interpreter}\n${body}`);
        chmodSync(broken, 0o755);
        const rejected = spawnSync(broken, args, { env, encoding: 'utf8', timeout: 5000 });
        assert.equal(rejected.status, null);
        assert.ok(['ENOENT', 'EACCES'].includes(rejected.error?.code), 'the old absolute shebang must fail at interpreter lookup on Linux/macOS');
        assert.equal(rejected.stdout ?? '', '', 'the rejected shim must execute no JavaScript');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
