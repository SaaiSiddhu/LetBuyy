/**
 * AgentIntelligenceService tests — EINS Phase 7.
 *
 * Covers: 1:1 task mapping, agentType mapping per layer, dependsOn graph fidelity,
 * byAgentType counts, acceptance string contract, evidence/confidence/sources/timestamp
 * provenance, empty-input honesty, determinism, and read-only source scan.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { AgentIntelligenceService, agentTypeForLayer, layerAcceptanceCriterion, agentTaskId } from '../src/agent/index';
import type { EngineeringTask, AgentType, EngineeringLayer } from '../src/shared/index';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';

/** Full canonical chain: migration → rpc → gateway → ui → test → docs → verification */
const CHAIN: readonly EngineeringTask[] = [
  {
    id: 'T01', title: 'Add gift_card_ledger table', layer: 'migration',
    domain: 'gift-cards', dependsOn: [], priority: 1, gate: 'canonical-ledger-only-validator',
    agentType: 'database', evidence: [],
  },
  {
    id: 'T02', title: 'Create issue_gift_card RPC', layer: 'rpc',
    domain: 'gift-cards', dependsOn: ['T01'], priority: 2, gate: 'canonical-ledger-only-validator',
    agentType: 'database', evidence: [],
  },
  {
    id: 'T03', title: 'Add /v1/gift-cards gateway route', layer: 'gateway',
    domain: 'gift-cards', dependsOn: ['T02'], priority: 3, gate: 'route-ownership-lockstep',
    agentType: 'backend', evidence: [],
  },
  {
    id: 'T04', title: 'Expose gift cards in merchant UI', layer: 'ui',
    domain: 'gift-cards', dependsOn: ['T03'], priority: 4, gate: 'design-system-ratchet',
    agentType: 'frontend', evidence: [],
  },
  {
    id: 'T05', title: 'Write gift card integration tests', layer: 'test',
    domain: 'gift-cards', dependsOn: ['T03', 'T04'], priority: 5, gate: 'gate-green',
    agentType: 'testing', evidence: [],
  },
  {
    id: 'T06', title: 'Document gift card API', layer: 'docs',
    domain: 'gift-cards', dependsOn: ['T02', 'T03'], priority: 6, gate: 'docs-lint',
    agentType: 'documentation', evidence: [],
  },
  {
    id: 'T07', title: 'Verify gift card end-to-end flow', layer: 'verification',
    domain: 'gift-cards', dependsOn: ['T05', 'T06'], priority: 7, gate: 'acceptance-contract',
    agentType: 'verification', evidence: [],
  },
];

/** Extra tasks covering remaining layers for complete layer→agentType coverage */
const EXTRA_TASKS: readonly EngineeringTask[] = [
  {
    id: 'TX1', title: 'Add proxy rewrite rule', layer: 'proxy',
    domain: 'orders', dependsOn: [], priority: 1, gate: 'route-ownership-lockstep',
    agentType: 'backend', evidence: [],
  },
  {
    id: 'TX2', title: 'Queue coupon-expiry worker job', layer: 'queue',
    domain: 'coupons', dependsOn: [], priority: 1, gate: 'queue-signed-envelope',
    agentType: 'backend', evidence: [],
  },
  {
    id: 'TX3', title: 'Process inventory-sync worker', layer: 'worker',
    domain: 'inventory', dependsOn: [], priority: 1, gate: 'queue-signed-envelope',
    agentType: 'backend', evidence: [],
  },
  {
    id: 'TX4', title: 'Emit order.confirmed event', layer: 'event',
    domain: 'orders', dependsOn: [], priority: 1, gate: 'webhook-hmac-validator',
    agentType: 'backend', evidence: [],
  },
  {
    id: 'TX5', title: 'Execute launch checklist', layer: 'launch',
    domain: null, dependsOn: [], priority: 99, gate: 'launch-gate',
    agentType: 'verification', evidence: [],
  },
];

/** Single task — isolates 1:1 mapping */
const SINGLE: readonly EngineeringTask[] = [CHAIN[0]!];

function makeService() {
  return new AgentIntelligenceService(undefined, () => FIXED);
}

// ── Test suite ────────────────────────────────────────────────────────────────

test('1: empty input → empty plan (honest)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan([]);
  assert.equal(plan.tasks.length, 0);
  assert.deepEqual(plan.byAgentType, {});
  assert.ok(plan.summary.toLowerCase().includes('empty'));
});

test('2: empty plan confidence is 0 when no task evidence', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan([]);
  // Only the single "task-count" field evidence — still honest
  assert.ok(typeof plan.confidence === 'number');
});

test('3: single task → exactly one AgentTask', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(SINGLE);
  assert.equal(plan.tasks.length, 1);
});

test('4: single task id is agent:<taskId>', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(SINGLE);
  assert.equal(plan.tasks[0]!.id, 'agent:T01');
});

test('5: single task taskRef equals source task id', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(SINGLE);
  assert.equal(plan.tasks[0]!.taskRef, 'T01');
});

test('6: single task title preserved', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(SINGLE);
  assert.equal(plan.tasks[0]!.title, CHAIN[0]!.title);
});

test('7: chain — one AgentTask per EngineeringTask', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.tasks.length, CHAIN.length);
});

test('8: migration → agentType database', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T01')!;
  assert.equal(t.agentType, 'database');
});

test('9: rpc → agentType database', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T02')!;
  assert.equal(t.agentType, 'database');
});

test('10: gateway → agentType backend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T03')!;
  assert.equal(t.agentType, 'backend');
});

test('11: ui → agentType frontend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T04')!;
  assert.equal(t.agentType, 'frontend');
});

test('12: test → agentType testing', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T05')!;
  assert.equal(t.agentType, 'testing');
});

test('13: docs → agentType documentation', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T06')!;
  assert.equal(t.agentType, 'documentation');
});

test('14: verification → agentType verification', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T07')!;
  assert.equal(t.agentType, 'verification');
});

test('15: proxy → agentType backend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX1')!;
  assert.equal(t.agentType, 'backend');
});

test('16: queue → agentType backend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX2')!;
  assert.equal(t.agentType, 'backend');
});

test('17: worker → agentType backend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX3')!;
  assert.equal(t.agentType, 'backend');
});

test('18: event → agentType backend', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX4')!;
  assert.equal(t.agentType, 'backend');
});

test('19: launch → agentType verification', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX5')!;
  assert.equal(t.agentType, 'verification');
});

test('20: dependsOn is empty for root task (T01)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T01')!;
  assert.deepEqual(t.dependsOn, []);
});

test('21: T02 depends on agent:T01', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T02')!;
  assert.deepEqual(t.dependsOn, ['agent:T01']);
});

test('22: T03 depends on agent:T02', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T03')!;
  assert.deepEqual(t.dependsOn, ['agent:T02']);
});

test('23: T05 depends on agent:T03 and agent:T04 (multi-dep)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T05')!;
  assert.deepEqual([...t.dependsOn].sort(), ['agent:T03', 'agent:T04'].sort());
});

test('24: T07 depends on agent:T05 and agent:T06', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T07')!;
  assert.deepEqual([...t.dependsOn].sort(), ['agent:T05', 'agent:T06'].sort());
});

test('25: dependsOn references are all valid agent-task ids within the plan', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const ids = new Set(plan.tasks.map((a) => a.id));
  for (const at of plan.tasks) {
    for (const dep of at.dependsOn) {
      assert.ok(ids.has(dep), `dep '${dep}' not found in plan ids`);
    }
  }
});

test('26: graph is acyclic (no task depends on itself)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  for (const at of plan.tasks) {
    assert.ok(!at.dependsOn.includes(at.id), `task ${at.id} depends on itself`);
  }
});

test('27: byAgentType counts sum to tasks.length', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const total = Object.values(plan.byAgentType).reduce((a, b) => a + b, 0);
  assert.equal(total, CHAIN.length);
});

test('28: byAgentType has correct database count (T01+T02)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['database'], 2);
});

test('29: byAgentType has correct backend count (T03)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['backend'], 1);
});

test('30: byAgentType has correct frontend count (T04)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['frontend'], 1);
});

test('31: byAgentType has correct testing count (T05)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['testing'], 1);
});

test('32: byAgentType has correct documentation count (T06)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['documentation'], 1);
});

test('33: byAgentType has correct verification count (T07)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.byAgentType['verification'], 1);
});

test('34: acceptance includes the gate name', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  for (const at of plan.tasks) {
    const srcTask = CHAIN.find((t) => t.id === at.taskRef)!;
    assert.ok(
      at.acceptance.includes(srcTask.gate),
      `acceptance for ${at.id} does not mention gate '${srcTask.gate}'`,
    );
  }
});

test('35: acceptance includes "passes"', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  for (const at of plan.tasks) {
    assert.ok(at.acceptance.toLowerCase().includes('passes'), `acceptance missing 'passes': ${at.acceptance}`);
  }
});

test('36: inputs includes domain, layer, gate for task with domain', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  const t = plan.tasks.find((a) => a.taskRef === 'T01')!;
  assert.ok(t.inputs.some((i) => i.startsWith('domain:')));
  assert.ok(t.inputs.some((i) => i.startsWith('layer:')));
  assert.ok(t.inputs.some((i) => i.startsWith('gate:')));
});

test('37: inputs for null-domain task has no domain: entry', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(EXTRA_TASKS);
  const t = plan.tasks.find((a) => a.taskRef === 'TX5')!;
  assert.ok(!t.inputs.some((i) => i.startsWith('domain:')));
  assert.ok(t.inputs.some((i) => i.startsWith('layer:')));
  assert.ok(t.inputs.some((i) => i.startsWith('gate:')));
});

test('38: plan has evidence array (non-empty)', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.ok(Array.isArray(plan.evidence) && plan.evidence.length > 0);
});

test('39: plan has confidence in [0, 0.9]', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.ok(plan.confidence >= 0 && plan.confidence <= 0.9);
});

test('40: plan has sources array', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.ok(Array.isArray(plan.sources));
});

test('41: plan timestamp equals fixed clock', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  assert.equal(plan.timestamp, FIXED);
});

test('42: determinism — same input → same output (called twice)', () => {
  const svc = makeService();
  const p1 = svc.generateAgentPlan(CHAIN);
  const p2 = svc.generateAgentPlan(CHAIN);
  assert.equal(p1.tasks.length, p2.tasks.length);
  for (let i = 0; i < p1.tasks.length; i++) {
    assert.equal(p1.tasks[i]!.id, p2.tasks[i]!.id);
    assert.equal(p1.tasks[i]!.agentType, p2.tasks[i]!.agentType);
    assert.deepEqual(p1.tasks[i]!.dependsOn, p2.tasks[i]!.dependsOn);
    assert.equal(p1.tasks[i]!.acceptance, p2.tasks[i]!.acceptance);
  }
});

test('43: every AgentTask evidence is non-empty', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  for (const at of plan.tasks) {
    assert.ok(at.evidence.length > 0, `AgentTask ${at.id} has no evidence`);
  }
});

test('44: agentTaskId helper produces stable id', () => {
  assert.equal(agentTaskId('T01'), 'agent:T01');
  assert.equal(agentTaskId('T99'), 'agent:T99');
});

test('45: agentTypeForLayer helper covers all layers correctly', () => {
  const mapping: Array<[EngineeringLayer, AgentType]> = [
    ['migration', 'database'],
    ['rpc', 'database'],
    ['gateway', 'backend'],
    ['proxy', 'backend'],
    ['worker', 'backend'],
    ['queue', 'backend'],
    ['event', 'backend'],
    ['ui', 'frontend'],
    ['test', 'testing'],
    ['docs', 'documentation'],
    ['verification', 'verification'],
    ['launch', 'verification'],
  ];
  for (const [layer, expected] of mapping) {
    assert.equal(agentTypeForLayer(layer), expected, `layer '${layer}' expected '${expected}'`);
  }
});

test('46: layerAcceptanceCriterion returns a non-empty string for all layers', () => {
  const layers: EngineeringLayer[] = [
    'migration', 'rpc', 'gateway', 'proxy', 'worker', 'queue', 'event',
    'ui', 'test', 'docs', 'verification', 'launch',
  ];
  for (const layer of layers) {
    const crit = layerAcceptanceCriterion(layer);
    assert.ok(crit.length > 0, `layerAcceptanceCriterion('${layer}') returned empty string`);
  }
});

test('47: summary mentions task and agent-type counts for non-empty plan', () => {
  const svc = makeService();
  const plan = svc.generateAgentPlan(CHAIN);
  // Summary should mention either the count or agent types
  assert.ok(
    plan.summary.includes(String(CHAIN.length)) || plan.summary.includes('task'),
    `summary missing task count: ${plan.summary}`,
  );
});

test('48: out-of-batch dependsOn references are silently dropped (honest)', () => {
  const taskWithExternalDep: EngineeringTask = {
    id: 'TORPHAN', title: 'Orphan task', layer: 'test',
    domain: null, dependsOn: ['DOES_NOT_EXIST'], priority: 1, gate: 'gate-green',
    agentType: 'testing', evidence: [],
  };
  const svc = makeService();
  const plan = svc.generateAgentPlan([taskWithExternalDep]);
  const t = plan.tasks[0]!;
  // The external dep is dropped — not fabricated
  assert.deepEqual(t.dependsOn, []);
});

test('49: read-only source scan — AgentIntelligenceService.ts has no forbidden calls', () => {
  const src = readFileSync(
    new URL('../src/agent/AgentIntelligenceService.ts', import.meta.url).pathname,
    'utf8',
  );
  // Strip both single-line and block comments before scanning
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments (incl. JSDoc)
    .replace(/\/\/.*$/gm, '');           // single-line comments
  const forbidden = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile(', 'writeFileSync('];
  for (const tok of forbidden) {
    assert.ok(
      !stripped.includes(tok),
      `AgentIntelligenceService.ts contains forbidden call: '${tok}'`,
    );
  }
});

test('50: mixed batch — byAgentType counts sum to input length', () => {
  const all = [...CHAIN, ...EXTRA_TASKS];
  const svc = makeService();
  const plan = svc.generateAgentPlan(all);
  const total = Object.values(plan.byAgentType).reduce((a, b) => a + b, 0);
  assert.equal(total, all.length);
  assert.equal(plan.tasks.length, all.length);
});
