import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArtifactStore } from '../src/runtime/ArtifactStore';
import { GraphService } from '../src/graph/GraphService';

test('graph query reuse preserves degree ranking, exact IDs, ordering, limits and caller isolation', t => {
  const root = mkdtempSync(join(tmpdir(), 'lcis-graph-search-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'exact', label: 'Checkout first' },
      { id: 'popular', label: 'Checkout second' },
      { id: 'other', label: 'Other', source_file: 'src/checkout.ts' },
    ],
    links: [{ source: 'popular', target: 'other' }, { source: 'popular', target: 'exact' }],
  }));
  const graph = new GraphService(ArtifactStore.fromDir(root));
  for (let i = 0; i < 2; i++) {
    assert.equal(graph.resolve('CHECKOUT')?.id, 'popular');
    assert.equal(graph.resolve('exact')?.id, 'exact');
    assert.equal(graph.resolve('absent'), undefined);
    assert.deepEqual(graph.search('checkout', 1).map(n => n.id), ['exact']);
    assert.deepEqual(graph.search('CHECKOUT', 2).map(n => n.id), ['exact', 'popular']);
  }
  const callerResult = graph.search('checkout', 2);
  callerResult.splice(0);
  assert.equal(graph.search('checkout', 2).length, 2, 'a caller cannot mutate a cached result array');
  for (let i = 0; i < 4100; i++) {
    assert.deepEqual(graph.search(`missing-${i}`), []);
    assert.equal(graph.resolve(`missing-${i}`), undefined);
  }
  assert.equal(graph.resolve('checkout')?.id, 'popular', 'eviction preserves ranking');
  assert.deepEqual(graph.search('checkout', 2).map(n => n.id), ['exact', 'popular']);
});
