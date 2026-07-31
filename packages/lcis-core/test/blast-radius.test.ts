/**
 * BlastRadiusService — integration tests against the real graphify-out artifacts.
 * Thresholds are deliberately conservative (>=) so they survive graph rebuilds while
 * still asserting the consolidated behaviour from spec-blast-radius.md.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore } from '../src/runtime/ArtifactStore';
import { GraphService } from '../src/graph/GraphService';
import { BlastRadiusService } from '../src/blast-radius/index';

const store = ArtifactStore.default();
const graph = new GraphService(store);
const svc = new BlastRadiusService(graph, store);

const hasDomain = store.has('domain-intel.json');
const hasRel = store.has('relationship-intel.json');

test('graph loads at the expected scale', () => {
  assert.ok(graph.nodeCount() > 40000, `nodeCount=${graph.nodeCount()}`);
  assert.ok(graph.edgeCount() > 50000, `edgeCount=${graph.edgeCount()}`);
});

test('blast(getSupabaseAdmin) impacts many files via layered inbound BFS', () => {
  const r = svc.blast('getSupabaseAdmin');
  assert.ok(r, 'expected a blast result');
  assert.match(r.node.file.toLowerCase(), /supabase/);
  assert.ok(r.impactedFiles >= 100, `impactedFiles=${r.impactedFiles}`);
  assert.ok(r.layers.length >= 1 && r.layers.length <= 3, `layers=${JSON.stringify(r.layers)}`);
  assert.ok(r.impactedNodes >= r.impactedFiles, 'impactedNodes >= impactedFiles');
  assert.equal(r.artifact, 'graphify-out/graph.json');
  assert.equal(r.node.provenance, r.node.id);
});

test('consumers(getSupabaseAdmin) returns the direct inbound edges with relations', () => {
  const r = svc.consumers('getSupabaseAdmin');
  assert.ok(r);
  assert.ok(r.consumedBy.length >= 50, `consumedBy=${r.consumedBy.length}`);
  for (const c of r.consumedBy) assert.equal(typeof c.rel, 'string');
});

test('dependencies(getSupabaseAdmin) returns outbound edges', () => {
  const r = svc.dependencies('getSupabaseAdmin');
  assert.ok(r);
  assert.ok(Array.isArray(r.dependsOn));
});

test('critical(5) returns 5 nodes sorted by descending degree', () => {
  const r = svc.critical(5);
  assert.equal(r.nodes.length, 5);
  for (let i = 1; i < r.nodes.length; i++) {
    assert.ok(r.nodes[i - 1].degree >= r.nodes[i].degree, 'degree must be non-increasing');
  }
});

test('blast() returns null for an unknown symbol (honest, no fabrication)', () => {
  assert.equal(svc.blast('__definitely_not_a_real_symbol_zzz__'), null);
});

test('crossDomain(payments) walks domain consumer edges', { skip: !hasDomain }, () => {
  const r = svc.crossDomain('payments');
  assert.ok(!('error' in r), JSON.stringify(r));
  if (!('error' in r)) {
    assert.equal(r.domain, 'payments');
    assert.ok(r.blastRadius.domains >= 3, `domains=${r.blastRadius.domains}`);
    assert.equal(r.artifact, 'graphify-out/domain-intel.json');
  }
});

test('impact(payments) composes risk flags + deployment gate', { skip: !hasDomain }, () => {
  const r = svc.impact('payments');
  assert.ok(!('error' in r), JSON.stringify(r));
  if (!('error' in r)) {
    assert.equal(typeof r.risk.money, 'boolean');
    assert.ok(r.breaks.domains.count >= 0);
    assert.match(r.breaks.deployments.gate, /production-deploy/);
  }
});

test('relationships(sites) returns FK fan-in/out', { skip: !hasRel }, () => {
  const r = svc.relationships('sites');
  assert.ok(!('error' in r), JSON.stringify(r));
  if (!('error' in r)) {
    assert.ok(r.fanIn >= 1, `fanIn=${r.fanIn}`);
    assert.ok(Array.isArray(r.references));
  }
});
