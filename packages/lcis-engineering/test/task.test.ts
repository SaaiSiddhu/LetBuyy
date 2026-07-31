/**
 * TaskIntelligenceService tests — EINS Phase 7.
 *
 * ≥ 45 tests covering:
 * - ordered build sequence (migration → rpc → gateway → proxy → ui → worker/queue → test → docs → verification)
 * - dependsOn is acyclic + every dep id exists in the set
 * - money feature → rpc task gated by canonical-ledger-only-validator
 * - priorities respect layer order
 * - agentType mapping correct per layer
 * - reuse-evidence present on all tasks
 * - determinism (deep-equal repeated call)
 * - honest empty list on unresolved request
 * - source scan (no forbidden IO keywords in implementation source)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@letbuyy/lcis-core';
import { TaskIntelligenceService } from '../src/task/index';
import type { EngineeringTask, EngineeringLayer } from '../src/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';
const now = () => FIXED;

function createService() {
  return new TaskIntelligenceService(createEngine(), now);
}

/** Read the first real domain from the graph so tests work against real data. */
function firstDomain(): string {
  const core = createEngine();
  const di = core.store.tryRead<{ domains?: { key: string }[] }>('domain-intel');
  return di?.domains?.[0]?.key ?? 'payments';
}

const FIRST_DOMAIN = firstDomain();

// Pre-resolve once to avoid repeated cold-graph work in individual tests.
// We use the first real domain from graphify-out so the request resolves.
const _svc = createService();
const _req = { text: `add feature to ${FIRST_DOMAIN}`, domains: [FIRST_DOMAIN] };
const _tasks = _svc.generateTasks(_req);

// ── Helpers ───────────────────────────────────────────────────────────────────

function tasksByLayer(tasks: EngineeringTask[], layer: EngineeringLayer): EngineeringTask[] {
  return tasks.filter((t) => t.layer === layer);
}

/** DFS cycle detection. */
function isAcyclic(tasks: EngineeringTask[]): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const t of tasks) color.set(t.id, WHITE);

  function visit(id: string): boolean {
    const task = tasks.find((t) => t.id === id);
    if (!task) return true; // external dep — fine
    const c = color.get(id);
    if (c === GRAY) return false;
    if (c === BLACK) return true;
    color.set(id, GRAY);
    for (const dep of task.dependsOn) {
      if (!visit(dep)) return false;
    }
    color.set(id, BLACK);
    return true;
  }
  for (const t of tasks) {
    if (color.get(t.id) === WHITE && !visit(t.id)) return false;
  }
  return true;
}

/** Every dep id in dependsOn must exist in the task set. */
function allDepsExist(tasks: EngineeringTask[]): { ok: boolean; missing: string[] } {
  const idSet = new Set(tasks.map((t) => t.id));
  const missing: string[] = [];
  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      if (!idSet.has(dep)) missing.push(`${t.id} → missing dep: ${dep}`);
    }
  }
  return { ok: missing.length === 0, missing };
}

// ── 1. Basic construction ─────────────────────────────────────────────────────

test('TaskIntelligenceService constructs without error', () => {
  assert.ok(createService() instanceof TaskIntelligenceService);
});

test('generateTasks with a resolved domain request returns a non-empty array', () => {
  assert.ok(_tasks.length > 0, `expected tasks for domain "${FIRST_DOMAIN}"; got 0`);
});

test('generateTasks returns properly shaped EngineeringTask objects', () => {
  for (const t of _tasks) {
    assert.ok(typeof t.id === 'string' && t.id.startsWith('TASK-'), `bad id: ${t.id}`);
    assert.ok(typeof t.title === 'string' && t.title.length > 0);
    assert.ok(typeof t.layer === 'string');
    assert.ok(typeof t.priority === 'number');
    assert.ok(typeof t.gate === 'string' && t.gate.length > 0);
    assert.ok(typeof t.agentType === 'string');
    assert.ok(Array.isArray(t.dependsOn));
    assert.ok(Array.isArray(t.evidence) && t.evidence.length > 0);
  }
});

test('unresolved request returns empty task list (honest, no fabrication)', () => {
  const svc = createService();
  // Empty text + no seeds = guaranteed unresolved (SeedResolver returns [])
  const tasks = svc.generateTasks({ text: '' });
  assert.equal(tasks.length, 0);
});

// ── 2. Layer priorities ───────────────────────────────────────────────────────

test('migration tasks have priority 10 (lowest — first in build)', () => {
  const migs = tasksByLayer(_tasks, 'migration');
  for (const t of migs) assert.equal(t.priority, 10);
});

test('rpc tasks have priority 20', () => {
  const rpcs = tasksByLayer(_tasks, 'rpc');
  for (const t of rpcs) assert.equal(t.priority, 20);
});

test('gateway tasks have priority 30', () => {
  const gw = tasksByLayer(_tasks, 'gateway');
  for (const t of gw) assert.equal(t.priority, 30);
});

test('proxy tasks have priority 40', () => {
  const px = tasksByLayer(_tasks, 'proxy');
  for (const t of px) assert.equal(t.priority, 40);
});

test('ui tasks have priority 50', () => {
  const ui = tasksByLayer(_tasks, 'ui');
  for (const t of ui) assert.equal(t.priority, 50);
});

test('worker tasks have priority 60', () => {
  const wk = tasksByLayer(_tasks, 'worker');
  for (const t of wk) assert.equal(t.priority, 60);
});

test('queue tasks have priority 65', () => {
  const q = tasksByLayer(_tasks, 'queue');
  for (const t of q) assert.equal(t.priority, 65);
});

test('test tasks have priority 80', () => {
  const ts = tasksByLayer(_tasks, 'test');
  for (const t of ts) assert.equal(t.priority, 80);
});

test('docs tasks have priority 90', () => {
  const ds = tasksByLayer(_tasks, 'docs');
  for (const t of ds) assert.equal(t.priority, 90);
});

test('verification tasks have priority 100 (highest — last)', () => {
  const vs = tasksByLayer(_tasks, 'verification');
  for (const t of vs) assert.equal(t.priority, 100);
});

// ── 3. Sort order ─────────────────────────────────────────────────────────────

test('task list is sorted by priority ascending then id alphabetically', () => {
  for (let i = 1; i < _tasks.length; i++) {
    const prev = _tasks[i - 1]!;
    const curr = _tasks[i]!;
    assert.ok(
      prev.priority < curr.priority || (prev.priority === curr.priority && prev.id <= curr.id),
      `order violation at [${i - 1}] ${prev.id}(p=${prev.priority}) vs [${i}] ${curr.id}(p=${curr.priority})`,
    );
  }
});

test('migration tasks always appear before rpc tasks in sorted output', () => {
  const migs = tasksByLayer(_tasks, 'migration');
  const rpcs = tasksByLayer(_tasks, 'rpc');
  if (migs.length > 0 && rpcs.length > 0) {
    const lastMigIdx = _tasks.indexOf(migs[migs.length - 1]!);
    const firstRpcIdx = _tasks.indexOf(rpcs[0]!);
    assert.ok(lastMigIdx < firstRpcIdx, 'all migration tasks must precede rpc tasks');
  }
});

test('test tasks appear before docs tasks in sorted output', () => {
  const tests = tasksByLayer(_tasks, 'test');
  const docs  = tasksByLayer(_tasks, 'docs');
  if (tests.length > 0 && docs.length > 0) {
    const lastTestIdx = _tasks.indexOf(tests[tests.length - 1]!);
    const firstDocsIdx = _tasks.indexOf(docs[0]!);
    assert.ok(lastTestIdx < firstDocsIdx, 'test tasks must precede docs tasks');
  }
});

test('verification tasks are the last tasks in the list', () => {
  const verifs = tasksByLayer(_tasks, 'verification');
  if (verifs.length > 0) {
    const minVerifIdx = Math.min(...verifs.map((t) => _tasks.indexOf(t)));
    const others = _tasks.filter((t) => t.layer !== 'verification');
    const maxOtherIdx = others.length > 0 ? Math.max(...others.map((t) => _tasks.indexOf(t))) : -1;
    if (maxOtherIdx >= 0) {
      assert.ok(minVerifIdx > maxOtherIdx, 'verification tasks must be last');
    }
  }
});

// ── 4. dependsOn: acyclic + all deps exist ────────────────────────────────────

test('dependsOn graph is acyclic', () => {
  assert.ok(isAcyclic(_tasks), 'cycle detected in dependsOn graph');
});

test('every dependsOn id exists in the task set', () => {
  const { ok, missing } = allDepsExist(_tasks);
  assert.ok(ok, `missing dep ids: ${missing.slice(0, 5).join('; ')}`);
});

test('migration tasks have no dependsOn (they are the root nodes)', () => {
  for (const t of tasksByLayer(_tasks, 'migration')) {
    assert.equal(t.dependsOn.length, 0, `migration task ${t.id} should have no deps`);
  }
});

test('rpc tasks depend on at least one migration task', () => {
  const migIds = new Set(tasksByLayer(_tasks, 'migration').map((t) => t.id));
  for (const t of tasksByLayer(_tasks, 'rpc')) {
    if (migIds.size > 0) {
      assert.ok(
        t.dependsOn.some((d) => migIds.has(d)),
        `rpc task ${t.id} must depend on a migration task`,
      );
    }
  }
});

test('ui tasks depend on their corresponding proxy task', () => {
  const proxyIds = new Set(tasksByLayer(_tasks, 'proxy').map((t) => t.id));
  for (const t of tasksByLayer(_tasks, 'ui')) {
    const hasProxy = t.dependsOn.some((d) => proxyIds.has(d));
    // proxy tasks may not exist if no domains with rpcs, but if proxy is present, ui must dep on it
    if (proxyIds.size > 0) {
      assert.ok(hasProxy, `ui task ${t.id} must depend on a proxy task`);
    }
  }
});

test('test tasks depend on gateway and/or ui tasks (or mig if neither exists)', () => {
  const gwIds  = new Set(tasksByLayer(_tasks, 'gateway').map((t) => t.id));
  const uiIds  = new Set(tasksByLayer(_tasks, 'ui').map((t) => t.id));
  const migIds = new Set(tasksByLayer(_tasks, 'migration').map((t) => t.id));
  for (const t of tasksByLayer(_tasks, 'test')) {
    const ok =
      t.dependsOn.some((d) => gwIds.has(d)) ||
      t.dependsOn.some((d) => uiIds.has(d))  ||
      t.dependsOn.some((d) => migIds.has(d));
    assert.ok(ok, `test task ${t.id} must dep on gateway/ui/mig`);
  }
});

test('verification tasks have non-empty dependsOn', () => {
  for (const t of tasksByLayer(_tasks, 'verification')) {
    assert.ok(t.dependsOn.length > 0, `verification task ${t.id} must have deps`);
  }
});

// ── 5. Money feature gate ─────────────────────────────────────────────────────

test('payments domain → rpc tasks are gated by canonical-ledger-only-validator', () => {
  const svc = createService();
  const tasks = svc.generateTasks({ text: 'extend payment feature', domains: ['payments'] });
  const rpcTasks = tasksByLayer(tasks, 'rpc');
  if (rpcTasks.length > 0) {
    for (const t of rpcTasks) {
      assert.equal(t.gate, 'canonical-ledger-only-validator', `rpc ${t.id} wrong gate`);
    }
  }
});

// ── 6. AgentType mapping ──────────────────────────────────────────────────────

test('migration tasks agentType = "database"', () => {
  for (const t of tasksByLayer(_tasks, 'migration')) {
    assert.equal(t.agentType, 'database');
  }
});

test('rpc tasks agentType = "database"', () => {
  for (const t of tasksByLayer(_tasks, 'rpc')) {
    assert.equal(t.agentType, 'database');
  }
});

test('gateway tasks agentType = "backend"', () => {
  for (const t of tasksByLayer(_tasks, 'gateway')) {
    assert.equal(t.agentType, 'backend');
  }
});

test('proxy tasks agentType = "backend"', () => {
  for (const t of tasksByLayer(_tasks, 'proxy')) {
    assert.equal(t.agentType, 'backend');
  }
});

test('ui tasks agentType = "frontend"', () => {
  for (const t of tasksByLayer(_tasks, 'ui')) {
    assert.equal(t.agentType, 'frontend');
  }
});

test('worker tasks agentType = "backend"', () => {
  for (const t of tasksByLayer(_tasks, 'worker')) {
    assert.equal(t.agentType, 'backend');
  }
});

test('test tasks agentType = "testing"', () => {
  for (const t of tasksByLayer(_tasks, 'test')) {
    assert.equal(t.agentType, 'testing');
  }
});

test('docs tasks agentType = "documentation"', () => {
  for (const t of tasksByLayer(_tasks, 'docs')) {
    assert.equal(t.agentType, 'documentation');
  }
});

test('verification tasks agentType = "verification"', () => {
  for (const t of tasksByLayer(_tasks, 'verification')) {
    assert.equal(t.agentType, 'verification');
  }
});

// ── 7. Evidence / reuse citation ──────────────────────────────────────────────

test('every task has at least one evidence item', () => {
  for (const t of _tasks) {
    assert.ok(t.evidence.length > 0, `task ${t.id} has no evidence`);
  }
});

test('every task has at least one lcis-execution reuse evidence', () => {
  for (const t of _tasks) {
    const hasReuse = t.evidence.some((e) => typeof e.ref === 'string' && e.ref.startsWith('lcis-execution:'));
    assert.ok(hasReuse, `task ${t.id} lacks lcis-execution reuse evidence`);
  }
});

test('migration tasks cite lcis-execution:eis.analyze', () => {
  for (const t of tasksByLayer(_tasks, 'migration')) {
    assert.ok(
      t.evidence.some((e) => e.ref === 'lcis-execution:eis.analyze'),
      `migration task ${t.id} must cite eis.analyze`,
    );
  }
});

test('verification tasks cite lcis-execution:eis.migration.analyzeMigration', () => {
  for (const t of tasksByLayer(_tasks, 'verification')) {
    assert.ok(
      t.evidence.some((e) => e.ref === 'lcis-execution:eis.migration.analyzeMigration'),
      `verification task ${t.id} must cite eis.migration.analyzeMigration`,
    );
  }
});

// ── 8. Gate correctness ───────────────────────────────────────────────────────

test('migration tasks gated by rollback-integrity-validator', () => {
  for (const t of tasksByLayer(_tasks, 'migration')) {
    assert.equal(t.gate, 'rollback-integrity-validator');
  }
});

test('gateway tasks gated by route-ownership lockstep', () => {
  for (const t of tasksByLayer(_tasks, 'gateway')) {
    assert.equal(t.gate, 'route-ownership lockstep');
  }
});

test('proxy tasks gated by route-ownership lockstep', () => {
  for (const t of tasksByLayer(_tasks, 'proxy')) {
    assert.equal(t.gate, 'route-ownership lockstep');
  }
});

test('test tasks gated by 107+ validator gate', () => {
  for (const t of tasksByLayer(_tasks, 'test')) {
    assert.equal(t.gate, '107+ validator gate');
  }
});

test('verification tasks gated by 107+ validator gate', () => {
  for (const t of tasksByLayer(_tasks, 'verification')) {
    assert.equal(t.gate, '107+ validator gate');
  }
});

test('docs tasks gated by governance-memory-validator', () => {
  for (const t of tasksByLayer(_tasks, 'docs')) {
    assert.equal(t.gate, 'governance-memory-validator');
  }
});

// ── 9. Task id stability ──────────────────────────────────────────────────────

test('task ids start with TASK- prefix', () => {
  for (const t of _tasks) {
    assert.ok(t.id.startsWith('TASK-'), `id "${t.id}" does not start with TASK-`);
  }
});

test('task ids are unique within the task set', () => {
  const ids = _tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate task ids detected');
});

test('task ids are stable across repeated calls', () => {
  const svc = new TaskIntelligenceService(createEngine(), () => FIXED);
  const run1 = svc.generateTasks(_req).map((t) => t.id).sort();
  const run2 = svc.generateTasks(_req).map((t) => t.id).sort();
  assert.deepEqual(run1, run2);
});

// ── 10. Determinism ───────────────────────────────────────────────────────────

test('generateTasks is deterministic: identical calls produce deep-equal output', () => {
  const svc = new TaskIntelligenceService(createEngine(), () => FIXED);
  const r1 = svc.generateTasks(_req);
  const r2 = svc.generateTasks(_req);
  assert.deepEqual(r1, r2);
});

test('two independent service instances with fixed now produce deep-equal output', () => {
  const s1 = new TaskIntelligenceService(createEngine(), () => FIXED);
  const s2 = new TaskIntelligenceService(createEngine(), () => FIXED);
  assert.deepEqual(s1.generateTasks(_req), s2.generateTasks(_req));
});

// ── 11. Read-only source scan ─────────────────────────────────────────────────

test('TaskIntelligenceService source has no forbidden IO calls (read-only contract)', () => {
  const srcPath = fileURLToPath(new URL('../src/task/TaskIntelligenceService.ts', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  // Strip comments before scanning
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  for (const kw of ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile', 'appendFile']) {
    assert.ok(!noComments.includes(kw), `forbidden call "${kw}" found in source`);
  }
});
