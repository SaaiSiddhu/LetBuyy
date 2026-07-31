/**
 * EngineeringGraphService tests — the DAG synthesis over EngineeringTask[]. Uses synthetic
 * task sets with known shapes (linear / diamond / parallel / dangling / cyclic) to prove the
 * topological order, critical path, parallelizable + blocked sets, milestones, determinism, and
 * provenance — all deterministic, all pure.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { EngineeringGraphService } from '../src/index';
import type { EngineeringLayer, EngineeringTask } from '../src/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const svc = new EngineeringGraphService(createEngine(), () => FIXED);

function task(
  id: string,
  dependsOn: string[] = [],
  layer: EngineeringLayer = 'rpc',
  priority = 20,
): EngineeringTask {
  return { id, title: `task ${id}`, layer, domain: null, dependsOn, priority, gate: 'gate', agentType: 'backend', evidence: [] };
}

test('empty task set → empty, well-formed graph', () => {
  const g = svc.build([]);
  assert.deepEqual(g.nodes, []);
  assert.deepEqual(g.edges, []);
  assert.deepEqual(g.implementationOrder, []);
  assert.deepEqual(g.criticalPath, []);
  assert.deepEqual(g.parallelizable, []);
  assert.deepEqual(g.blocked, []);
  assert.ok(Array.isArray(g.evidence) && typeof g.timestamp === 'string');
});

test('linear chain a→b→c: order, depth, critical path, parallelizable', () => {
  const g = svc.build([task('a'), task('b', ['a']), task('c', ['b'])]);
  assert.deepEqual(g.implementationOrder, ['a', 'b', 'c']);
  assert.deepEqual(g.criticalPath, ['a', 'b', 'c']);
  assert.deepEqual(g.parallelizable, ['a']);
  assert.equal(g.nodes.find((n) => n.id === 'c')?.depth, 2);
  assert.ok(g.nodes.find((n) => n.id === 'b')?.onCriticalPath);
});

test('diamond a→{b,c}→d: a first, d last, critical path length 3, one root', () => {
  const g = svc.build([task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])]);
  assert.equal(g.implementationOrder[0], 'a');
  assert.equal(g.implementationOrder[g.implementationOrder.length - 1], 'd');
  assert.equal(g.criticalPath.length, 3);
  assert.deepEqual(g.parallelizable, ['a']);
  assert.equal(g.nodes.find((n) => n.id === 'd')?.depth, 2);
});

test('independent roots are all parallelizable', () => {
  const g = svc.build([task('a'), task('b'), task('c')]);
  assert.deepEqual([...g.parallelizable].sort(), ['a', 'b', 'c']);
  assert.equal(g.edges.length, 0);
});

test('a dangling dependency marks the task blocked (not in the order)', () => {
  const g = svc.build([task('a', ['does-not-exist'])]);
  assert.ok(g.blocked.includes('a'));
  assert.ok(!g.implementationOrder.includes('a'));
});

test('a cycle a→b→a leaves both blocked, neither ordered', () => {
  const g = svc.build([task('a', ['b']), task('b', ['a'])]);
  assert.ok(g.blocked.includes('a') && g.blocked.includes('b'));
  assert.equal(g.implementationOrder.length, 0);
});

test('deterministic tie-break by priority then id', () => {
  const g = svc.build([task('z', [], 'rpc', 10), task('a', [], 'rpc', 10), task('m', [], 'rpc', 5)]);
  // priority 5 first (m), then priority 10 alphabetical (a, z)
  assert.deepEqual(g.implementationOrder, ['m', 'a', 'z']);
});

test('milestones group tasks by construction layer', () => {
  const g = svc.build([
    task('mig', [], 'migration'),
    task('rpc1', ['mig'], 'rpc'),
    task('t1', ['rpc1'], 'test'),
    task('d1', ['t1'], 'docs'),
  ]);
  const titles = g.milestones.map((m) => m.id);
  assert.ok(titles.includes('M1') && titles.includes('M2') && titles.includes('M5'));
  assert.ok(g.milestones.find((m) => m.id === 'M1')?.tasks.includes('mig'));
});

test('build is deterministic under a fixed clock (deep-equal across runs)', () => {
  const tasks = [task('a'), task('b', ['a']), task('c', ['a', 'b'])];
  assert.deepEqual(svc.build(tasks), svc.build(tasks));
});

test('every node is classified; nodes count matches tasks', () => {
  const tasks = [task('a'), task('b', ['a']), task('c', ['x-missing'])];
  const g = svc.build(tasks);
  assert.equal(g.nodes.length, 3);
  for (const n of g.nodes) assert.ok(typeof n.depth === 'number' && typeof n.onCriticalPath === 'boolean');
});

test('graph carries provenance (evidence + timestamp)', () => {
  const g = svc.build([task('a')]);
  assert.ok(g.evidence.length >= 1);
  assert.equal(g.timestamp, FIXED);
  assert.ok(g.confidence >= 0 && g.confidence <= 0.9);
});
