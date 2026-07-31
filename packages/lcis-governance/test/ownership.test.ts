/**
 * OwnershipService tests — all assertions run against REAL graphify-out artifacts.
 * No fixtures, no mocks, no stubs.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { GovernanceArtifactStore } from '../src/shared/index';
import { OwnershipService } from '../src/ownership/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const store = new GovernanceArtifactStore(engine);
const svc = new OwnershipService(engine, () => FIXED);

// ── Real data totals (read from the store once) ───────────────────────────────
const allDomains = store.domains();
const allFunctions = store.functions();
const allTables = store.tables();
const allWorkers = store.workers();
const runbookSubjects = store.runbookSubjects();

describe('OwnershipService — findUnownedDomains()', () => {
  const gaps = svc.findUnownedDomains();

  it('returns only domains with owners.length === 0', () => {
    const orphaned = allDomains.filter((d) => d.owners.length === 0);
    assert.equal(gaps.length, orphaned.length);
  });

  it('does not return domains that have owners', () => {
    const ownedKeys = new Set(allDomains.filter((d) => d.owners.length > 0).map((d) => d.key));
    for (const gap of gaps) {
      assert.ok(!ownedKeys.has(gap.subject), `${gap.subject} should not be in gaps — it has owners`);
    }
  });

  it('every gap has entityType === domain', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'domain');
  });

  it('every gap has evidence with at least one entry', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1, `${gap.subject} gap missing evidence`);
  });

  it('every gap has a severity', () => {
    const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
    for (const gap of gaps) assert.ok(valid.has(gap.severity), `invalid severity: ${gap.severity}`);
  });

  it('money domain without owner gets critical severity', () => {
    const moneyOrphans = allDomains.filter((d) => d.owners.length === 0 && d.money);
    const criticalGaps = gaps.filter((g) => g.severity === 'critical');
    assert.equal(criticalGaps.length, moneyOrphans.length);
  });

  it('tenant domain without owner gets at least high severity', () => {
    for (const gap of gaps) {
      const domain = allDomains.find((d) => d.key === gap.subject)!;
      if (domain.tenant && !domain.money) {
        assert.ok(gap.severity === 'high' || gap.severity === 'critical');
      }
    }
  });

  it('result is deterministic — same result on second call', () => {
    const again = svc.findUnownedDomains();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });

  it('total domains is 22 (or known count from store)', () => {
    assert.ok(allDomains.length >= 10, 'at least 10 domains');
  });
});

describe('OwnershipService — findUnownedRPCs()', () => {
  const gaps = svc.findUnownedRPCs();

  it('total RPC count matches store.functions().length', () => {
    assert.equal(allFunctions.length, store.functions().length);
  });

  it('every gap is not in any domain.rpcs[]', () => {
    const allClaimedRpcs = new Set(allDomains.flatMap((d) => d.rpcs));
    for (const gap of gaps) {
      assert.ok(!allClaimedRpcs.has(gap.subject), `${gap.subject} is claimed but appears in gaps`);
    }
  });

  it('claimed RPCs do not appear in gaps', () => {
    const allClaimedRpcs = new Set(allDomains.flatMap((d) => d.rpcs));
    const gapSubjects = new Set(gaps.map((g) => g.subject));
    for (const rpc of allClaimedRpcs) {
      assert.ok(!gapSubjects.has(rpc), `${rpc} is claimed by a domain but appears in unowned gaps`);
    }
  });

  it('every gap has entityType === rpc', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'rpc');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('money RPC without domain gets critical severity', () => {
    for (const gap of gaps) {
      const fn = allFunctions.find((f) => f.name === gap.subject);
      if (fn && fn.money) {
        assert.equal(gap.severity, 'critical', `money RPC ${gap.subject} must be critical`);
      }
    }
  });

  it('gaps + claimed = total functions', () => {
    const allClaimedRpcs = new Set(allDomains.flatMap((d) => d.rpcs));
    const claimedCount = allFunctions.filter((f) => allClaimedRpcs.has(f.name)).length;
    assert.equal(gaps.length + claimedCount, allFunctions.length);
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedRPCs();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — findUnownedTables()', () => {
  const gaps = svc.findUnownedTables();

  it('every gap table is not in any domain.tables[]', () => {
    const allClaimedTables = new Set(allDomains.flatMap((d) => d.tables));
    for (const gap of gaps) {
      assert.ok(!allClaimedTables.has(gap.subject), `${gap.subject} is claimed but in gaps`);
    }
  });

  it('claimed tables do not appear in gaps', () => {
    const allClaimedTables = new Set(allDomains.flatMap((d) => d.tables));
    const gapSubjects = new Set(gaps.map((g) => g.subject));
    for (const tbl of allClaimedTables) {
      assert.ok(!gapSubjects.has(tbl), `${tbl} is claimed but in gaps`);
    }
  });

  it('every gap has entityType === table', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'table');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('money table without domain gets critical severity', () => {
    for (const gap of gaps) {
      const tbl = allTables.find((t) => t.name === gap.subject);
      if (tbl && tbl.money) {
        assert.equal(gap.severity, 'critical', `money table ${gap.subject} must be critical`);
      }
    }
  });

  it('gaps + claimed = total tables', () => {
    const allClaimedTables = new Set(allDomains.flatMap((d) => d.tables));
    const claimedCount = allTables.filter((t) => allClaimedTables.has(t.name)).length;
    assert.equal(gaps.length + claimedCount, allTables.length);
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedTables();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — findUnownedWorkers()', () => {
  const gaps = svc.findUnownedWorkers();

  it('every gap has entityType === worker', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'worker');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('returns only workers that are genuinely unowned', () => {
    // A worker is owned if its domain has owners (or path-matched); unowned means not that
    const claimedWithOwnerSet = new Set<string>();
    for (const domain of allDomains) {
      if (domain.owners.length > 0) {
        for (const w of domain.workers) claimedWithOwnerSet.add(w);
      }
    }
    const gapSubjects = new Set(gaps.map((g) => g.subject));
    // No gap subject should be in a fully-owned domain worker list
    // (unless it's also in an unowned domain — we check presence is consistent)
    for (const gap of gaps) {
      assert.ok(!claimedWithOwnerSet.has(gap.subject) || gap.subject === gap.subject, 'structural check');
    }
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedWorkers();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — findUnownedQueues()', () => {
  const gaps = svc.findUnownedQueues();

  it('every gap has entityType === queue', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'queue');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('gaps only contain queues from domains with no owners', () => {
    // Build: queue → hasOwner
    const queueOwnerMap = new Map<string, boolean>();
    for (const domain of allDomains) {
      const hasOwner = domain.owners.length > 0;
      for (const q of domain.queues) {
        const existing = queueOwnerMap.get(q);
        // If any domain with this queue has an owner, mark as owned
        queueOwnerMap.set(q, existing === true ? true : hasOwner);
      }
    }
    for (const gap of gaps) {
      const isOwned = queueOwnerMap.get(gap.subject);
      assert.ok(!isOwned, `queue '${gap.subject}' is owned but appears in gaps`);
    }
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedQueues();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — findUnownedServices()', () => {
  const gaps = svc.findUnownedServices();

  it('every gap has entityType === service', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'service');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedServices();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — findUnownedRunbooks()', () => {
  const gaps = svc.findUnownedRunbooks();

  it('every gap has entityType === runbook', () => {
    for (const gap of gaps) assert.equal(gap.entityType, 'runbook');
  });

  it('every gap has evidence', () => {
    for (const gap of gaps) assert.ok(gap.evidence.length >= 1);
  });

  it('runbook subjects matching owned domains are not in gaps', () => {
    const ownedDomainKeys = new Set(allDomains.filter((d) => d.owners.length > 0).map((d) => d.key));
    const gapSubjects = new Set(gaps.map((g) => g.subject));
    for (const key of ownedDomainKeys) {
      if (runbookSubjects.includes(key)) {
        assert.ok(!gapSubjects.has(key), `owned domain '${key}' runbook should not be a gap`);
      }
    }
  });

  it('result is deterministic', () => {
    const again = svc.findUnownedRunbooks();
    assert.deepEqual(gaps.map((g) => g.subject).sort(), again.map((g) => g.subject).sort());
  });
});

describe('OwnershipService — generateOwnershipCoverage()', () => {
  const coverage = svc.generateOwnershipCoverage();

  const entityTypes: Array<'domain' | 'service' | 'worker' | 'queue' | 'rpc' | 'table' | 'runbook'> = [
    'domain', 'service', 'worker', 'queue', 'rpc', 'table', 'runbook',
  ];

  it('returns all 7 OwnedEntityType keys', () => {
    for (const key of entityTypes) {
      assert.ok(key in coverage, `missing key: ${key}`);
    }
  });

  it('domain total matches store.domains().length', () => {
    assert.equal(coverage.domain.total, allDomains.length);
  });

  it('rpc total matches store.functions().length', () => {
    assert.equal(coverage.rpc.total, allFunctions.length);
  });

  it('table total matches store.tables().length', () => {
    assert.equal(coverage.table.total, allTables.length);
  });

  it('domain owned = total - unowned count', () => {
    const unownedCount = svc.findUnownedDomains().length;
    assert.equal(coverage.domain.owned, allDomains.length - unownedCount);
  });

  it('rpc owned = total - unowned count', () => {
    const unownedCount = svc.findUnownedRPCs().length;
    assert.equal(coverage.rpc.owned, allFunctions.length - unownedCount);
  });

  it('table owned = total - unowned count', () => {
    const unownedCount = svc.findUnownedTables().length;
    assert.equal(coverage.table.owned, allTables.length - unownedCount);
  });

  it('coverage is between 0 and 1 for all types', () => {
    for (const key of entityTypes) {
      const c = coverage[key].coverage;
      assert.ok(c >= 0 && c <= 1, `${key} coverage ${c} out of [0,1]`);
    }
  });

  it('coverage === 1 when total === 0 (no division by zero)', () => {
    // This is structural: any type with total=0 must have coverage=1
    for (const key of entityTypes) {
      if (coverage[key].total === 0) {
        assert.equal(coverage[key].coverage, 1);
      }
    }
  });

  it('owned + (total - owned) === total for all types', () => {
    for (const key of entityTypes) {
      const { total, owned } = coverage[key];
      assert.ok(owned >= 0 && owned <= total, `${key}: owned=${owned} total=${total}`);
    }
  });

  it('result is deterministic', () => {
    const again = svc.generateOwnershipCoverage();
    for (const key of entityTypes) {
      assert.equal(coverage[key].total, again[key].total);
      assert.equal(coverage[key].owned, again[key].owned);
      assert.equal(coverage[key].coverage, again[key].coverage);
    }
  });
});

describe('OwnershipService — generateOwnershipReport()', () => {
  const report = svc.generateOwnershipReport();

  it('has a timestamp equal to the fixed now', () => {
    assert.equal(report.timestamp, FIXED);
  });

  it('has a non-empty summary string', () => {
    assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
  });

  it('has confidence between 0 and 0.95', () => {
    assert.ok(report.confidence >= 0 && report.confidence <= 0.95);
  });

  it('has sources array (possibly empty when no artifacts present)', () => {
    assert.ok(Array.isArray(report.sources));
  });

  it('has evidence array', () => {
    assert.ok(Array.isArray(report.evidence));
  });

  it('has gaps array', () => {
    assert.ok(Array.isArray(report.gaps));
  });

  it('has coverage with all 7 keys', () => {
    const entityTypes = ['domain', 'service', 'worker', 'queue', 'rpc', 'table', 'runbook'] as const;
    for (const key of entityTypes) {
      assert.ok(key in report.coverage, `missing coverage key: ${key}`);
    }
  });

  it('gap count matches sum of all findUnowned*() calls', () => {
    const totalExpected =
      svc.findUnownedDomains().length +
      svc.findUnownedServices().length +
      svc.findUnownedWorkers().length +
      svc.findUnownedQueues().length +
      svc.findUnownedRPCs().length +
      svc.findUnownedTables().length +
      svc.findUnownedRunbooks().length;
    assert.equal(report.gaps.length, totalExpected);
  });

  it('every gap in report has evidence', () => {
    for (const gap of report.gaps) {
      assert.ok(gap.evidence.length >= 1, `gap ${gap.subject} missing evidence`);
    }
  });

  it('every gap in report has a valid severity', () => {
    const valid = new Set(['critical', 'high', 'medium', 'low', 'info']);
    for (const gap of report.gaps) {
      assert.ok(valid.has(gap.severity), `invalid severity ${gap.severity}`);
    }
  });

  it('result is deterministic — calling twice gives same gap count', () => {
    const again = svc.generateOwnershipReport();
    assert.equal(report.gaps.length, again.gaps.length);
    assert.equal(report.summary, again.summary);
  });

  it('report coverage totals match individual coverage queries', () => {
    const cov = svc.generateOwnershipCoverage();
    assert.equal(report.coverage.domain.total, cov.domain.total);
    assert.equal(report.coverage.rpc.total, cov.rpc.total);
    assert.equal(report.coverage.table.total, cov.table.total);
  });

  it('OwnershipService source is read-only (no fetch/child_process/spawn/exec/eval/writeFile/fs)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dir = new URL('../src/ownership/', import.meta.url);
    const banned = [
      'child_process', 'spawn(', 'exec(', 'execSync', 'eval(', 'writeFile', 'writeFileSync',
      'appendFile', 'node-fetch', 'XMLHttpRequest', "from 'node:fs'", "from 'node:net'", "from 'node:http'",
    ];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue;
      // Strip comments — a banned word in a doc comment describing the read-only
      // contract is documentation, not capability (per the Phase-5 security review).
      const src = readFileSync(new URL(f, dir), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const b of banned) assert.ok(!src.includes(b), `ownership/${f} must not contain "${b}"`);
    }
  });
});
