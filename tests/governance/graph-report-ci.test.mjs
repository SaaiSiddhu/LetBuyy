import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'letbuyy-graph-report-'));
  try {
    for (const dir of ['tools/graph-server', 'database/supabase/migrations', 'graphify-out']) {
      mkdirSync(join(root, dir), { recursive: true });
    }
    for (const file of ['gen-reports.mjs', 'db-intel.mjs']) {
      copyFileSync(join(sourceRoot, 'tools/graph-server', file), join(root, 'tools/graph-server', file));
    }
    writeFileSync(join(root, 'database/supabase/migrations/001_inventory.sql'),
      'CREATE TABLE public.graph_ci_inventory (\n  id uuid PRIMARY KEY,\n  site_id uuid\n);\n');
    const execute = () => spawnSync(process.execPath, ['tools/graph-server/gen-reports.mjs'], {
      cwd: root, encoding: 'utf8', timeout: 15_000,
    });
    const report = () => readFileSync(join(root, 'docs/central-intelligence/DATABASE_INTELLIGENCE_REPORT.generated.md'), 'utf8');
    run({ root, execute, report });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('fresh checkout reports real database inventory without fabricating a code graph', () => {
  fixture(({ root, execute, report }) => {
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.match(report(), /Tables \| \*\*1\*\*/);
    assert.match(report(), /Code graph unavailable/);
    assert.doesNotMatch(report(), /Graph: 0 nodes/);
    assert.equal(existsSync(join(root, 'graphify-out/graph.json')), false);
  });
});

test('available code graph retains its actual counts and source commit', () => {
  fixture(({ root, execute, report }) => {
    writeFileSync(join(root, 'graphify-out/graph.json'), JSON.stringify({
      nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }],
      built_at_commit: '0123456789abcdef',
    }));
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.match(report(), /Graph: 2 nodes \/ 1 edges @ 01234567/);
    assert.doesNotMatch(report(), /Code graph unavailable/);
  });
});

test('malformed existing code graph remains a hard failure', () => {
  fixture(({ root, execute }) => {
    writeFileSync(join(root, 'graphify-out/graph.json'), '{broken');
    const result = execute();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SyntaxError/);
    assert.equal(existsSync(join(root, 'docs/central-intelligence/DATABASE_INTELLIGENCE_REPORT.generated.md')), false);
  });
});
