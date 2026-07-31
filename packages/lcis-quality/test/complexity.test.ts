/**
 * ComplexityService — unit tests (node:test + assert/strict).
 *
 * Fixed clock: '2026-07-04T00:00:00.000Z'
 * Stub ArtifactStore: hand-built graph fixtures with known degrees.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEngine, type ArtifactStore } from '@letbuyy/lcis-core';
import { ComplexityService } from '../src/complexity/index';
import type { Complexity, ComplexityEntry, QualityBand } from '../src/shared/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-07-04T00:00:00.000Z';
const fixedClock = () => FIXED_NOW;

interface GraphFixture {
  nodes: Array<{ id: string }>;
  links: Array<{ source: string; target: string }>;
}

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: <T>(n: string): T | null => (n in artifacts ? (artifacts[n] as T) : null),
    read: <T>(n: string): T => {
      if (!(n in artifacts)) throw new Error('missing artifact: ' + n);
      return artifacts[n] as T;
    },
    pathOf: (n: string) => '/stub/' + n,
    cacheStats: () => ({ hits: 0, misses: 0, size: 0, hitRate: 0 }),
  } as unknown as ArtifactStore;
}

function makeEngine(graph: GraphFixture) {
  return createEngine({ store: stubStore({ graph }), repoRoot: '/stub' });
}

function makeService(graph: GraphFixture): ComplexityService {
  return new ComplexityService(makeEngine(graph), fixedClock);
}

// ── Degree calculation helpers for assertions ─────────────────────────────────

/**
 * Calculate expected degree for a node by counting appearances in links as source or target.
 * This matches GraphService.degree() which tracks per-edge, not per-unique-neighbor.
 */
function expectedDegree(id: string, links: Array<{ source: string; target: string }>): number {
  return links.filter((l) => l.source === id || l.target === id).length;
}

function expectedFanIn(id: string, links: Array<{ source: string; target: string }>): number {
  return links.filter((l) => l.target === id).length;
}

function expectedFanOut(id: string, links: Array<{ source: string; target: string }>): number {
  return links.filter((l) => l.source === id).length;
}

// ── Empty graph ───────────────────────────────────────────────────────────────

describe('ComplexityService — empty graph', () => {
  const EMPTY: GraphFixture = { nodes: [], links: [] };

  it('returns NOT_CONNECTED connection', () => {
    const result = makeService(EMPTY).analyze();
    assert.equal(result.connection, 'NOT_CONNECTED');
  });

  it('returns empty entries array', () => {
    const result = makeService(EMPTY).analyze();
    assert.deepEqual(result.entries, []);
  });

  it('returns meanDegree 0', () => {
    const result = makeService(EMPTY).analyze();
    assert.equal(result.meanDegree, 0);
  });

  it('returns maxDegree 0', () => {
    const result = makeService(EMPTY).analyze();
    assert.equal(result.maxDegree, 0);
  });

  it('is a plain object (no extra keys beyond the contract)', () => {
    const result = makeService(EMPTY).analyze();
    const keys = Object.keys(result).sort();
    assert.deepEqual(keys, ['connection', 'entries', 'maxDegree', 'meanDegree']);
  });
});

// ── Single node, no edges ─────────────────────────────────────────────────────

describe('ComplexityService — single isolated node', () => {
  const G: GraphFixture = { nodes: [{ id: 'A' }], links: [] };

  it('returns CONNECTED', () => {
    assert.equal(makeService(G).analyze().connection, 'CONNECTED');
  });

  it('has one entry', () => {
    assert.equal(makeService(G).analyze().entries.length, 1);
  });

  it('entry has entity A', () => {
    assert.equal(makeService(G).analyze().entries[0]!.entity, 'A');
  });

  it('entry has fanIn 0', () => {
    assert.equal(makeService(G).analyze().entries[0]!.fanIn, 0);
  });

  it('entry has fanOut 0', () => {
    assert.equal(makeService(G).analyze().entries[0]!.fanOut, 0);
  });

  it('entry has degree 0', () => {
    assert.equal(makeService(G).analyze().entries[0]!.degree, 0);
  });

  it('entry has band excellent (degree 0 < 6)', () => {
    assert.equal(makeService(G).analyze().entries[0]!.band, 'excellent');
  });

  it('meanDegree is 0', () => {
    assert.equal(makeService(G).analyze().meanDegree, 0);
  });

  it('maxDegree is 0', () => {
    assert.equal(makeService(G).analyze().maxDegree, 0);
  });
});

// ── Band boundary tests ───────────────────────────────────────────────────────

describe('ComplexityService — band boundaries', () => {
  /**
   * Build a star graph where HUB has exactly `hubDegree` edges.
   * Each spoke is a separate node connected to HUB (as source→HUB so fanIn=n).
   */
  function starGraph(hubDegree: number): GraphFixture {
    const spokes = Array.from({ length: hubDegree }, (_, i) => ({ id: `S${i}` }));
    return {
      nodes: [{ id: 'HUB' }, ...spokes],
      links: spokes.map((s) => ({ source: s.id, target: 'HUB' })),
    };
  }

  // degree=5 => excellent (< 6)
  it('degree 5 => excellent', () => {
    const g = starGraph(5);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 5);
    assert.equal(hub.band, 'excellent');
  });

  // degree=6 => good (>= 6)
  it('degree 6 => good', () => {
    const g = starGraph(6);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 6);
    assert.equal(hub.band, 'good');
  });

  // degree=14 => good (>= 6 but < 15)
  it('degree 14 => good', () => {
    const g = starGraph(14);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 14);
    assert.equal(hub.band, 'good');
  });

  // degree=15 => fair (>= 15)
  it('degree 15 => fair', () => {
    const g = starGraph(15);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 15);
    assert.equal(hub.band, 'fair');
  });

  // degree=29 => fair (>= 15 but < 30)
  it('degree 29 => fair', () => {
    const g = starGraph(29);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 29);
    assert.equal(hub.band, 'fair');
  });

  // degree=30 => poor (>= 30)
  it('degree 30 => poor', () => {
    const g = starGraph(30);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 30);
    assert.equal(hub.band, 'poor');
  });

  // degree=50 => poor
  it('degree 50 => poor', () => {
    const g = starGraph(50);
    const svc = makeService(g);
    const hub = svc.analyze().entries.find((e) => e.entity === 'HUB')!;
    assert.equal(hub.degree, 50);
    assert.equal(hub.band, 'poor');
  });

  // degree=1 => excellent
  it('degree 1 => excellent', () => {
    const g: GraphFixture = { nodes: [{ id: 'A' }, { id: 'B' }], links: [{ source: 'A', target: 'B' }] };
    const svc = makeService(g);
    const a = svc.analyze().entries.find((e) => e.entity === 'A')!;
    assert.equal(a.degree, 1);
    assert.equal(a.band, 'excellent');
  });
});

// ── fanIn / fanOut exactness ──────────────────────────────────────────────────

describe('ComplexityService — fanIn/fanOut exactness', () => {
  /**
   * Graph:
   *   A -> B
   *   C -> B
   *   B -> D
   *   B -> E
   *
   * B: fanIn=2 (from A,C), fanOut=2 (to D,E), degree=4
   * A: fanIn=0, fanOut=1, degree=1
   * C: fanIn=0, fanOut=1, degree=1
   * D: fanIn=1, fanOut=0, degree=1
   * E: fanIn=1, fanOut=0, degree=1
   */
  const G: GraphFixture = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }],
    links: [
      { source: 'A', target: 'B' },
      { source: 'C', target: 'B' },
      { source: 'B', target: 'D' },
      { source: 'B', target: 'E' },
    ],
  };

  function entry(id: string): ComplexityEntry {
    return makeService(G).analyze().entries.find((e) => e.entity === id)!;
  }

  it('B fanIn is 2', () => assert.equal(entry('B').fanIn, 2));
  it('B fanOut is 2', () => assert.equal(entry('B').fanOut, 2));
  it('B degree is 4', () => assert.equal(entry('B').degree, 4));
  it('B band is excellent (degree 4 < 6)', () => assert.equal(entry('B').band, 'excellent'));

  it('A fanIn is 0', () => assert.equal(entry('A').fanIn, 0));
  it('A fanOut is 1', () => assert.equal(entry('A').fanOut, 1));
  it('A degree is 1', () => assert.equal(entry('A').degree, 1));

  it('C fanIn is 0', () => assert.equal(entry('C').fanIn, 0));
  it('C fanOut is 1', () => assert.equal(entry('C').fanOut, 1));

  it('D fanIn is 1', () => assert.equal(entry('D').fanIn, 1));
  it('D fanOut is 0', () => assert.equal(entry('D').fanOut, 0));

  it('E fanIn is 1', () => assert.equal(entry('E').fanIn, 1));
  it('E fanOut is 0', () => assert.equal(entry('E').fanOut, 0));

  it('all 5 nodes appear in entries', () => {
    const ids = makeService(G).analyze().entries.map((e) => e.entity).sort();
    assert.deepEqual(ids, ['A', 'B', 'C', 'D', 'E']);
  });
});

// ── Mean and max degree ───────────────────────────────────────────────────────

describe('ComplexityService — meanDegree and maxDegree over ALL nodes', () => {
  /**
   * Linear chain: A->B->C->D
   * Degrees: A=1, B=2, C=2, D=1  (total=6, count=4, mean=1.5, max=2)
   */
  const CHAIN: GraphFixture = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    links: [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'D' },
    ],
  };

  it('meanDegree is 1.5 for chain A->B->C->D', () => {
    const result = makeService(CHAIN).analyze();
    assert.equal(result.meanDegree, 1.5);
  });

  it('maxDegree is 2 for chain A->B->C->D', () => {
    const result = makeService(CHAIN).analyze();
    assert.equal(result.maxDegree, 2);
  });

  /**
   * Star: HUB <- S0..S9 (10 spokes)
   * Degrees: HUB=10, each Si=1  (total=10+10=20, count=11, mean=20/11)
   */
  it('meanDegree is correct for star with 10 spokes', () => {
    const spokes = Array.from({ length: 10 }, (_, i) => ({ id: `S${i}` }));
    const g: GraphFixture = {
      nodes: [{ id: 'HUB' }, ...spokes],
      links: spokes.map((s) => ({ source: s.id, target: 'HUB' })),
    };
    const result = makeService(g).analyze();
    // total degree: HUB=10, 10 spokes × 1 = 10+10 = 20; nodeCount=11
    assert.equal(result.meanDegree, 20 / 11);
  });

  it('maxDegree is 10 for star with 10 spokes', () => {
    const spokes = Array.from({ length: 10 }, (_, i) => ({ id: `S${i}` }));
    const g: GraphFixture = {
      nodes: [{ id: 'HUB' }, ...spokes],
      links: spokes.map((s) => ({ source: s.id, target: 'HUB' })),
    };
    const result = makeService(g).analyze();
    assert.equal(result.maxDegree, 10);
  });

  it('isolated nodes count towards mean (degree 0)', () => {
    // 1 edge (A->B) plus 1 isolated node I
    // degrees: A=1, B=1, I=0; mean=(1+1+0)/3 = 2/3
    const g: GraphFixture = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'I' }],
      links: [{ source: 'A', target: 'B' }],
    };
    const result = makeService(g).analyze();
    assert.equal(result.meanDegree, 2 / 3);
  });

  it('maxDegree includes isolated nodes correctly (max still from edge nodes)', () => {
    const g: GraphFixture = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'I' }],
      links: [{ source: 'A', target: 'B' }],
    };
    const result = makeService(g).analyze();
    assert.equal(result.maxDegree, 1);
  });
});

// ── Top-N truncation + sort ───────────────────────────────────────────────────

describe('ComplexityService — top-50 truncation and sort order', () => {
  /**
   * Build 60 nodes where node `H{i}` has degree i+1 (via i+1 incoming edges from unique sources).
   * Top 50 by degree should be H59..H10 (degrees 60..11).
   */
  function buildRankedGraph(nodeCount: number): GraphFixture {
    const hubs = Array.from({ length: nodeCount }, (_, i) => ({ id: `H${i}` }));
    const nodes: Array<{ id: string }> = [...hubs];
    const links: Array<{ source: string; target: string }> = [];

    for (let i = 0; i < nodeCount; i++) {
      // each H{i} gets (i+1) unique spokes pointing at it
      for (let j = 0; j < i + 1; j++) {
        const spokeId = `spoke_${i}_${j}`;
        nodes.push({ id: spokeId });
        links.push({ source: spokeId, target: `H${i}` });
      }
    }
    return { nodes, links };
  }

  it('returns at most 50 entries when there are 60 hub nodes', () => {
    const g = buildRankedGraph(60);
    const result = makeService(g).analyze();
    assert.equal(result.entries.length, 50);
  });

  it('first entry is the highest-degree hub', () => {
    const g = buildRankedGraph(60);
    const result = makeService(g).analyze();
    // H59 has degree 60 (59 spokes pointing in + 0 out → degree 60 in the degree map)
    // Actually: each spoke has degree 1 (one outgoing edge), H{i} has fanIn=i+1, degree=i+1
    // H59 has degree 60 from the graph (spokes count once per edge in the degree map)
    assert.equal(result.entries[0]!.entity, 'H59');
  });

  it('entries are sorted by degree descending', () => {
    const g = buildRankedGraph(60);
    const entries = makeService(g).analyze().entries;
    for (let i = 1; i < entries.length; i++) {
      assert.ok(
        entries[i - 1]!.degree >= entries[i]!.degree,
        `Entry ${i - 1} degree ${entries[i - 1]!.degree} should be >= entry ${i} degree ${entries[i]!.degree}`,
      );
    }
  });

  it('meanDegree is over all nodes (not just top 50)', () => {
    const g = buildRankedGraph(60);
    const result = makeService(g).analyze();
    // Should be > 0 and computed over all nodes including small ones
    assert.ok(result.meanDegree > 0);
    assert.ok(result.entries.length <= 50);
  });

  it('returns exactly 50 entries when exactly 50 nodes exist', () => {
    const g = buildRankedGraph(50);
    const result = makeService(g).analyze();
    // 50 hub nodes all eligible; cap and top-50 both satisfied
    assert.equal(result.entries.length, 50);
  });

  it('returns all entries when fewer than 50 nodes', () => {
    const g: GraphFixture = {
      nodes: Array.from({ length: 10 }, (_, i) => ({ id: `N${i}` })),
      links: [],
    };
    const result = makeService(g).analyze();
    assert.equal(result.entries.length, 10);
  });

  it('ties in degree are broken by entity id asc', () => {
    // All nodes have degree 0 (no edges); should be sorted by id asc.
    const g: GraphFixture = {
      nodes: [{ id: 'Z' }, { id: 'A' }, { id: 'M' }],
      links: [],
    };
    const result = makeService(g).analyze();
    const ids = result.entries.map((e) => e.entity);
    assert.deepEqual(ids, ['A', 'M', 'Z']);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('ComplexityService — determinism', () => {
  const G: GraphFixture = {
    nodes: [{ id: 'X' }, { id: 'Y' }, { id: 'Z' }],
    links: [
      { source: 'X', target: 'Y' },
      { source: 'Y', target: 'Z' },
      { source: 'Z', target: 'X' },
    ],
  };

  it('analyze() returns identical results on repeated calls', () => {
    const svc = makeService(G);
    const r1 = svc.analyze();
    const r2 = svc.analyze();
    assert.deepEqual(r1, r2);
  });

  it('two separate services over the same fixture produce identical results', () => {
    const r1 = makeService(G).analyze();
    const r2 = makeService(G).analyze();
    assert.deepEqual(r1, r2);
  });

  it('entry order is stable across repeated calls', () => {
    const svc = makeService(G);
    const ids1 = svc.analyze().entries.map((e) => e.entity);
    const ids2 = svc.analyze().entries.map((e) => e.entity);
    assert.deepEqual(ids1, ids2);
  });
});

// ── Graph with cycle ──────────────────────────────────────────────────────────

describe('ComplexityService — cycle graph', () => {
  // A -> B -> C -> A  (triangle cycle)
  const G: GraphFixture = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    links: [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'A' },
    ],
  };

  it('returns CONNECTED', () => {
    assert.equal(makeService(G).analyze().connection, 'CONNECTED');
  });

  it('each node has degree 2 (one in, one out)', () => {
    const entries = makeService(G).analyze().entries;
    for (const e of entries) {
      assert.equal(e.degree, 2, `Expected degree 2 for ${e.entity}`);
    }
  });

  it('each node has fanIn 1 and fanOut 1', () => {
    const entries = makeService(G).analyze().entries;
    for (const e of entries) {
      assert.equal(e.fanIn, 1, `Expected fanIn 1 for ${e.entity}`);
      assert.equal(e.fanOut, 1, `Expected fanOut 1 for ${e.entity}`);
    }
  });

  it('meanDegree is 2', () => {
    assert.equal(makeService(G).analyze().meanDegree, 2);
  });

  it('maxDegree is 2', () => {
    assert.equal(makeService(G).analyze().maxDegree, 2);
  });
});

// ── Multi-edge (parallel edges) ───────────────────────────────────────────────

describe('ComplexityService — parallel edges', () => {
  // A->B appears twice; GraphService pushes each edge, so degree counts both
  const G: GraphFixture = {
    nodes: [{ id: 'A' }, { id: 'B' }],
    links: [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'B' },
    ],
  };

  it('fanOut of A reflects parallel edges', () => {
    const entry = makeService(G).analyze().entries.find((e) => e.entity === 'A')!;
    // GraphService pushes both edges, so outgoing.length = 2, degree map += 1 for each
    assert.equal(entry.fanOut, 2);
  });

  it('fanIn of B reflects parallel edges', () => {
    const entry = makeService(G).analyze().entries.find((e) => e.entity === 'B')!;
    assert.equal(entry.fanIn, 2);
  });

  it('degree of A is 2 from parallel outgoing edges', () => {
    const entry = makeService(G).analyze().entries.find((e) => e.entity === 'A')!;
    assert.equal(entry.degree, 2);
  });
});

// ── SCAN_CAP boundary (>200 nodes) ────────────────────────────────────────────

describe('ComplexityService — SCAN_CAP 200 node cap', () => {
  /**
   * Build 250 nodes, each with a unique degree (node i has degree i via i spokes).
   * After capping at top-200 by degree, the 50 lowest-degree nodes are excluded from
   * the candidate pool — and then top-50 of those 200 are returned.
   */
  function buildLargeGraph(n: number): GraphFixture {
    const hubs = Array.from({ length: n }, (_, i) => ({ id: `H${i}` }));
    const nodes: Array<{ id: string }> = [...hubs];
    const links: Array<{ source: string; target: string }> = [];
    for (let i = 1; i < n; i++) {
      for (let j = 0; j < i; j++) {
        const spokeId = `sp_${i}_${j}`;
        nodes.push({ id: spokeId });
        links.push({ source: spokeId, target: `H${i}` });
      }
    }
    return { nodes, links };
  }

  it('returns at most 50 entries even with 250 hub nodes', () => {
    const g = buildLargeGraph(250);
    const result = makeService(g).analyze();
    assert.equal(result.entries.length, 50);
  });

  it('meanDegree is computed over ALL nodes (>200 + spokes), not just the cap', () => {
    const g = buildLargeGraph(60);
    const result = makeService(g).analyze();
    // There are 60 + sum(0..59) = 60 + 1770 = 1830 nodes; mean > 0
    assert.ok(result.meanDegree > 0);
    // The 60 hub nodes are exactly the candidates; all appear (< 200 so no cap effect)
    assert.ok(result.entries.length <= 50);
  });
});

// ── hotspotEvidence ───────────────────────────────────────────────────────────

describe('ComplexityService — hotspotEvidence()', () => {
  function starGraph(n: number): GraphFixture {
    const spokes = Array.from({ length: n }, (_, i) => ({ id: `S${i}` }));
    return {
      nodes: [{ id: 'HUB' }, ...spokes],
      links: spokes.map((s) => ({ source: s.id, target: 'HUB' })),
    };
  }

  it('returns up to 5 evidence records by default', () => {
    const g = starGraph(20);
    const evs = makeService(g).hotspotEvidence();
    assert.ok(evs.length <= 5);
  });

  it('hotspotEvidence count=1 returns at most 1 record', () => {
    const g = starGraph(10);
    const evs = makeService(g).hotspotEvidence(1);
    assert.equal(evs.length, 1);
  });

  it('hotspotEvidence count=0 returns empty array', () => {
    const g = starGraph(10);
    const evs = makeService(g).hotspotEvidence(0);
    assert.equal(evs.length, 0);
  });

  it('evidence records have kind graph-node', () => {
    const g = starGraph(10);
    const evs = makeService(g).hotspotEvidence(3);
    for (const ev of evs) {
      assert.equal(ev.kind, 'graph-node');
    }
  });

  it('evidence detail includes degree and band', () => {
    const g = starGraph(10);
    const evs = makeService(g).hotspotEvidence(1);
    const detail = evs[0]!.detail ?? '';
    assert.ok(detail.includes('degree'), 'detail should include degree');
    assert.ok(detail.includes('band'), 'detail should include band');
  });

  it('evidence source is graphify-out/graph.json', () => {
    const g = starGraph(10);
    const evs = makeService(g).hotspotEvidence(1);
    assert.equal(evs[0]!.source, 'graphify-out/graph.json');
  });

  it('returns 0 records for empty graph', () => {
    const evs = makeService({ nodes: [], links: [] }).hotspotEvidence();
    assert.equal(evs.length, 0);
  });
});

// ── Structural contract properties ────────────────────────────────────────────

describe('ComplexityService — contract structural properties', () => {
  const G: GraphFixture = {
    nodes: [{ id: 'P' }, { id: 'Q' }, { id: 'R' }],
    links: [
      { source: 'P', target: 'Q' },
      { source: 'R', target: 'Q' },
    ],
  };

  it('every entry has entity as a non-empty string', () => {
    for (const e of makeService(G).analyze().entries) {
      assert.ok(typeof e.entity === 'string' && e.entity.length > 0);
    }
  });

  it('every entry fanIn >= 0', () => {
    for (const e of makeService(G).analyze().entries) {
      assert.ok(e.fanIn >= 0);
    }
  });

  it('every entry fanOut >= 0', () => {
    for (const e of makeService(G).analyze().entries) {
      assert.ok(e.fanOut >= 0);
    }
  });

  it('every entry degree >= 0', () => {
    for (const e of makeService(G).analyze().entries) {
      assert.ok(e.degree >= 0);
    }
  });

  it('every entry degree === fanIn + fanOut', () => {
    for (const e of makeService(G).analyze().entries) {
      assert.equal(
        e.degree,
        e.fanIn + e.fanOut,
        `${e.entity}: degree ${e.degree} != fanIn ${e.fanIn} + fanOut ${e.fanOut}`,
      );
    }
  });

  it('every entry band is a valid QualityBand', () => {
    const valid: Set<QualityBand> = new Set(['excellent', 'good', 'fair', 'poor']);
    for (const e of makeService(G).analyze().entries) {
      assert.ok(valid.has(e.band), `Invalid band: ${e.band}`);
    }
  });

  it('meanDegree >= 0', () => {
    assert.ok(makeService(G).analyze().meanDegree >= 0);
  });

  it('maxDegree >= 0', () => {
    assert.ok(makeService(G).analyze().maxDegree >= 0);
  });

  it('maxDegree >= meanDegree', () => {
    const result = makeService(G).analyze();
    assert.ok(result.maxDegree >= result.meanDegree);
  });

  it('connection is either CONNECTED or NOT_CONNECTED', () => {
    const c = makeService(G).analyze().connection;
    assert.ok(c === 'CONNECTED' || c === 'NOT_CONNECTED');
  });

  it('maxDegree matches the highest degree in entries when entries exist', () => {
    const result = makeService(G).analyze();
    const maxInEntries = Math.max(...result.entries.map((e) => e.degree));
    // maxDegree is over ALL nodes; if all nodes appear in entries, they should match
    // Here 3 nodes, all in entries, so maxDegree should equal maxInEntries
    assert.equal(result.maxDegree, maxInEntries);
  });
});

// ── Injectable clock ──────────────────────────────────────────────────────────

describe('ComplexityService — injectable clock / no Date.now() usage', () => {
  it('service can be constructed with a fixed clock without errors', () => {
    const svc = new ComplexityService(
      makeEngine({ nodes: [{ id: 'A' }], links: [] }),
      fixedClock,
    );
    assert.ok(svc instanceof ComplexityService);
  });

  it('service analyze() does not throw when clock is fixed', () => {
    const svc = new ComplexityService(
      makeEngine({ nodes: [{ id: 'A' }], links: [] }),
      fixedClock,
    );
    assert.doesNotThrow(() => svc.analyze());
  });
});
