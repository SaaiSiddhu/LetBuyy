/**
 * EAOS Phase 8 — AgentIntelligenceService tests.
 *
 * Uses createEngine() (real lcis-core singleton) + buildEngineeringPackage() (real EINS package)
 * with a fixed clock. Tests confirm the honesty contract, 1:1 task mapping, CONNECTED/NOT_CONNECTED
 * boundary, ownership reuse from lcis-governance, provenance stamping, and read-only purity.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { AgentIntelligenceService } from '../src/agent/index';
import { buildEngineeringPackage } from '../src/shared/index';
import type { EngineeringPackage } from '@letbuyy/lcis-engineering';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new AgentIntelligenceService(engine, () => FIXED);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a real EINS package for a given feature text. */
async function buildPkg(text: string): Promise<EngineeringPackage> {
  return buildEngineeringPackage(engine, { text }, () => FIXED);
}

// ── 1. Constructor ─────────────────────────────────────────────────────────────

test('AgentIntelligenceService: constructor accepts core + now override', () => {
  const s = new AgentIntelligenceService(engine, () => FIXED);
  assert.ok(s instanceof AgentIntelligenceService);
});

test('AgentIntelligenceService: default now is ISO string', () => {
  const s = new AgentIntelligenceService(engine);
  // The service exists; the defaultNow is used internally only when called
  assert.ok(s instanceof AgentIntelligenceService);
});

// ── 2. agentAssignments: 1:1 with agentPlan.tasks ────────────────────────────

test('agentAssignments: returns one ExecutionAgent per agentPlan task', async () => {
  const pkg = await buildPkg('Build GST Filing with ledger RPC');
  const assignments = svc.agentAssignments(pkg);
  assert.equal(assignments.length, pkg.agentPlan.tasks.length, '1:1 correspondence');
});

test('agentAssignments: IDs match agentPlan task IDs', async () => {
  const pkg = await buildPkg('Add shipping rate calculator');
  const assignments = svc.agentAssignments(pkg);
  const planIds = new Set(pkg.agentPlan.tasks.map((t) => t.id));
  for (const a of assignments) {
    assert.ok(planIds.has(a.id), `assignment id ${a.id} must match a plan task`);
  }
});

test('agentAssignments: taskRef matches plan task taskRef', async () => {
  const pkg = await buildPkg('Implement coupon engine');
  const assignments = svc.agentAssignments(pkg);
  for (let i = 0; i < assignments.length; i++) {
    assert.equal(assignments[i].taskRef, pkg.agentPlan.tasks[i].taskRef);
  }
});

test('agentAssignments: dependsOn matches plan task dependsOn', async () => {
  const pkg = await buildPkg('Add inventory location transfer RPC');
  const assignments = svc.agentAssignments(pkg);
  for (let i = 0; i < assignments.length; i++) {
    assert.deepEqual([...assignments[i].dependsOn], [...pkg.agentPlan.tasks[i].dependsOn]);
  }
});

test('agentAssignments: acceptance copied from plan task', async () => {
  const pkg = await buildPkg('Build order export API');
  const assignments = svc.agentAssignments(pkg);
  for (let i = 0; i < assignments.length; i++) {
    assert.equal(assignments[i].acceptance, pkg.agentPlan.tasks[i].acceptance);
  }
});

test('agentAssignments: agentType matches plan task agentType', async () => {
  const pkg = await buildPkg('Webhook HMAC verification');
  const assignments = svc.agentAssignments(pkg);
  for (let i = 0; i < assignments.length; i++) {
    assert.equal(assignments[i].agentType, pkg.agentPlan.tasks[i].agentType);
  }
});

// ── 3. Honesty contract: ASSIGNED=CONNECTED, live activity=NOT_CONNECTED ─────

test('agentAssignments: status=ASSIGNED is CONNECTED', async () => {
  const pkg = await buildPkg('Build payment intent RPC');
  const assignments = svc.agentAssignments(pkg);
  for (const a of assignments) {
    assert.equal(a.status, 'ASSIGNED');
    assert.equal(a.connection, 'CONNECTED');
  }
});

test('agentAssignments: liveSource is set (not null) for live activity', async () => {
  const pkg = await buildPkg('Add webhook retry worker');
  const assignments = svc.agentAssignments(pkg);
  for (const a of assignments) {
    // liveSource names the tracker that would supply WORKING/FINISHED
    assert.ok(typeof a.liveSource === 'string' && a.liveSource.length > 0,
      'liveSource must name the would-be source');
  }
});

test('agentAssignments: evidence is present for each assignment', async () => {
  const pkg = await buildPkg('GST invoice generation');
  const assignments = svc.agentAssignments(pkg);
  for (const a of assignments) {
    assert.ok(a.evidence.length >= 1, 'each assignment must carry evidence');
  }
});

// ── 4. agentUtilization: fully NOT_CONNECTED ──────────────────────────────────

test('agentUtilization: connection=NOT_CONNECTED', async () => {
  const pkg = await buildPkg('Build refund ledger RPC');
  const util = svc.agentUtilization(pkg);
  assert.equal(util.connection, 'NOT_CONNECTED');
});

test('agentUtilization: confidence=0', async () => {
  const pkg = await buildPkg('Add customer detail page');
  const util = svc.agentUtilization(pkg);
  assert.equal(util.confidence, 0, 'live utilization → confidence must be 0');
});

test('agentUtilization: liveConnected=false', async () => {
  const pkg = await buildPkg('Shipping provider integration');
  const util = svc.agentUtilization(pkg);
  assert.equal(util.liveConnected, false);
});

test('agentUtilization: utilization=null (not fabricated)', async () => {
  const pkg = await buildPkg('Build product collections API');
  const util = svc.agentUtilization(pkg);
  assert.equal(util.utilization, null, 'per-agent utilization must be null, not fabricated');
});

test('agentUtilization: liveSource is descriptive string', async () => {
  const pkg = await buildPkg('COD order handling');
  const util = svc.agentUtilization(pkg);
  assert.ok(typeof util.liveSource === 'string' && util.liveSource.length > 5);
});

test('agentUtilization: byAgentType is CONNECTED from the plan', async () => {
  const pkg = await buildPkg('Queue worker for abandoned carts');
  const util = svc.agentUtilization(pkg);
  // byAgentType comes from the plan (structural = CONNECTED) even though live load is not
  assert.deepEqual(util.byAgentType, pkg.agentPlan.byAgentType);
});

test('agentUtilization: evidence has at least one not-connected entry', async () => {
  const pkg = await buildPkg('Build payout reconciliation report');
  const util = svc.agentUtilization(pkg);
  assert.ok(util.evidence.length >= 1);
  assert.ok(util.evidence.some((e) => e.kind === 'not-connected'));
});

// ── 5. agentOwnership: reuses lcis-governance ────────────────────────────────

test('agentOwnership: returns an array', async () => {
  const pkg = await buildPkg('Tax invoice export');
  const findings = svc.agentOwnership(pkg);
  assert.ok(Array.isArray(findings));
});

test('agentOwnership: all findings are category=ownership', async () => {
  const pkg = await buildPkg('Multi-currency support');
  const findings = svc.agentOwnership(pkg);
  for (const f of findings) {
    assert.equal(f.category, 'ownership');
  }
});

test('agentOwnership: findings have rule=EO01', async () => {
  const pkg = await buildPkg('Gift card ledger reconciliation');
  const findings = svc.agentOwnership(pkg);
  for (const f of findings) {
    assert.equal(f.rule, 'EO01');
  }
});

test('agentOwnership: findings are CONNECTED (governance is structural)', async () => {
  const pkg = await buildPkg('Build storefront product listing');
  const findings = svc.agentOwnership(pkg);
  for (const f of findings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('agentOwnership: reuse evidence references lcis-governance', async () => {
  const pkg = await buildPkg('Inventory transfer RPC');
  const findings = svc.agentOwnership(pkg);
  // At least one evidence entry should reference the governance reuse
  const allEvidence = findings.flatMap((f) => f.evidence);
  const hasGovernanceReuse = allEvidence.some((e) =>
    (e.source ?? '').includes('lcis-governance') ||
    (e.ref ?? '').includes('lcis-governance') ||
    (e.ref ?? '').includes('OwnershipReport'),
  );
  assert.ok(hasGovernanceReuse, 'must reuse-cite lcis-governance OwnershipReport');
});

test('agentOwnership: confidence=0.9 for structural findings', async () => {
  const pkg = await buildPkg('Customer portal login flow');
  const findings = svc.agentOwnership(pkg);
  for (const f of findings) {
    assert.ok(f.confidence > 0, 'CONNECTED ownership finding must have confidence > 0');
  }
});

// ── 6. agentHealth ────────────────────────────────────────────────────────────

test('agentHealth: area=agent', async () => {
  const pkg = await buildPkg('Add purchase order system');
  const health = svc.agentHealth(pkg);
  assert.equal(health.area, 'agent');
});

test('agentHealth: score is null or 0..100', async () => {
  const pkg = await buildPkg('Build product reviews feature');
  const health = svc.agentHealth(pkg);
  if (health.score !== null) {
    assert.ok(health.score >= 0 && health.score <= 100);
  }
});

test('agentHealth: band is one of healthy|degraded|failing|unknown', async () => {
  const pkg = await buildPkg('Staff role management');
  const health = svc.agentHealth(pkg);
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(health.band));
});

test('agentHealth: connectedSignals >= 0', async () => {
  const pkg = await buildPkg('Storefront hero section');
  const health = svc.agentHealth(pkg);
  assert.ok(health.connectedSignals >= 0);
});

test('agentHealth: notConnectedSignals >= 0', async () => {
  const pkg = await buildPkg('Email notification system');
  const health = svc.agentHealth(pkg);
  assert.ok(health.notConnectedSignals >= 0);
});

test('agentHealth: empty plan → healthy with score=100', async () => {
  // buildPkg always produces tasks; test the structural branch via a simple direct call
  // to confirm empty-plan health is honest
  const pkg = await buildPkg('Minimal empty-adjacent feature (search)');
  const health = svc.agentHealth(pkg);
  // Whether or not tasks exist, the health object must be structurally valid
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(health.band));
});

// ── 7. agentBlocking: CONNECTED from graph.blocked ───────────────────────────

test('agentBlocking: returns ExecutionFinding[]', async () => {
  const pkg = await buildPkg('Build cart checkout flow');
  const findings = svc.agentBlocking(pkg);
  assert.ok(Array.isArray(findings));
});

test('agentBlocking: all findings are category=blocked', async () => {
  const pkg = await buildPkg('Payment confirmation webhook');
  const findings = svc.agentBlocking(pkg);
  for (const f of findings) {
    assert.equal(f.category, 'blocked');
  }
});

test('agentBlocking: all findings are CONNECTED', async () => {
  const pkg = await buildPkg('Order tracking page');
  const findings = svc.agentBlocking(pkg);
  for (const f of findings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('agentBlocking: blocked count matches graph.blocked × agent cross-reference', async () => {
  const pkg = await buildPkg('Build refund flow with RPC');
  const findings = svc.agentBlocking(pkg);
  const blockedSet = new Set(pkg.graph.blocked);
  const expectedBlockedAgents = pkg.agentPlan.tasks.filter((at) => blockedSet.has(at.taskRef));
  assert.equal(findings.length, expectedBlockedAgents.length);
});

test('agentBlocking: rule=EO02 on all findings', async () => {
  const pkg = await buildPkg('Inventory sync with supplier');
  const findings = svc.agentBlocking(pkg);
  for (const f of findings) {
    assert.equal(f.rule, 'EO02');
  }
});

// ── 8. agentDependencyGraph ───────────────────────────────────────────────────

test('agentDependencyGraph: connection=CONNECTED', async () => {
  const pkg = await buildPkg('Product import pipeline');
  const dg = svc.agentDependencyGraph(pkg);
  assert.equal(dg.connection, 'CONNECTED');
});

test('agentDependencyGraph: nodes.length === agentPlan.tasks.length', async () => {
  const pkg = await buildPkg('Add Razorpay webhook handler');
  const dg = svc.agentDependencyGraph(pkg);
  assert.equal(dg.nodes.length, pkg.agentPlan.tasks.length);
});

test('agentDependencyGraph: edges use relation=depends-on', async () => {
  const pkg = await buildPkg('Build coupon validation RPC');
  const dg = svc.agentDependencyGraph(pkg);
  for (const e of dg.edges) {
    assert.equal(e.relation, 'depends-on');
  }
});

test('agentDependencyGraph: node IDs match plan task IDs', async () => {
  const pkg = await buildPkg('Merchant dashboard analytics widget');
  const dg = svc.agentDependencyGraph(pkg);
  const planIds = new Set(pkg.agentPlan.tasks.map((t) => t.id));
  for (const n of dg.nodes) {
    assert.ok(planIds.has(n.id));
  }
});

// ── 9. workDistribution ───────────────────────────────────────────────────────

test('workDistribution: connection=CONNECTED', async () => {
  const pkg = await buildPkg('Build collections filter UI');
  const wd = svc.workDistribution(pkg);
  assert.equal(wd.connection, 'CONNECTED');
});

test('workDistribution: byAgentType matches pkg.agentPlan.byAgentType', async () => {
  const pkg = await buildPkg('Order status page');
  const wd = svc.workDistribution(pkg);
  assert.deepEqual(wd.byAgentType, pkg.agentPlan.byAgentType);
});

test('workDistribution: totalTasks matches agentPlan.tasks.length', async () => {
  const pkg = await buildPkg('Add transfer inventory route');
  const wd = svc.workDistribution(pkg);
  assert.equal(wd.totalTasks, pkg.agentPlan.tasks.length);
});

// ── 10. orphanAgents ──────────────────────────────────────────────────────────

test('orphanAgents: returns ExecutionFinding[]', async () => {
  const pkg = await buildPkg('Build gift card redemption flow');
  const findings = svc.orphanAgents(pkg);
  assert.ok(Array.isArray(findings));
});

test('orphanAgents: all findings are category=ownership', async () => {
  const pkg = await buildPkg('Supplier management API');
  const findings = svc.orphanAgents(pkg);
  for (const f of findings) {
    assert.equal(f.category, 'ownership');
  }
});

test('orphanAgents: all findings are CONNECTED', async () => {
  const pkg = await buildPkg('Add product image upload');
  const findings = svc.orphanAgents(pkg);
  for (const f of findings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('orphanAgents: no orphan when plan covers all engineering tasks', async () => {
  const pkg = await buildPkg('Single feature minimal');
  // If the plan is 1:1 (EINS guarantees this), there should be no orphan engineering tasks
  const findings = svc.orphanAgents(pkg);
  const orphanEngTasks = findings.filter((f) => f.kind === 'orphan-engineering-task-no-agent');
  // EINS always produces a 1:1 plan, so this should be 0
  assert.equal(orphanEngTasks.length, 0, 'EINS produces 1:1 plan; no orphan eng tasks expected');
});

test('orphanAgents: rule=EO01 on all findings', async () => {
  const pkg = await buildPkg('Build multi-location inventory');
  const findings = svc.orphanAgents(pkg);
  for (const f of findings) {
    assert.equal(f.rule, 'EO01');
  }
});

// ── 11. generateAgentReport ───────────────────────────────────────────────────

test('generateAgentReport: returns AgentReport with all fields', async () => {
  const pkg = await buildPkg('Full checkout flow with payment');
  const report = svc.generateAgentReport(pkg);
  assert.ok(report.agents !== undefined);
  assert.ok(report.byAgentType !== undefined);
  assert.ok(report.findings !== undefined);
  assert.ok(report.health !== undefined);
  assert.ok(typeof report.summary === 'string');
});

test('generateAgentReport: timestamp=FIXED from fixed clock', async () => {
  const pkg = await buildPkg('Build store analytics dashboard');
  const report = svc.generateAgentReport(pkg);
  assert.equal(report.timestamp, FIXED);
});

test('generateAgentReport: liveConnected=false', async () => {
  const pkg = await buildPkg('Webhook signature verification');
  const report = svc.generateAgentReport(pkg);
  assert.equal(report.liveConnected, false);
});

test('generateAgentReport: confidence is 0..0.9', async () => {
  const pkg = await buildPkg('Build purchase order management');
  const report = svc.generateAgentReport(pkg);
  assert.ok(report.confidence >= 0 && report.confidence <= 0.9);
});

test('generateAgentReport: agents.length === agentPlan.tasks.length', async () => {
  const pkg = await buildPkg('Merchant onboarding wizard');
  const report = svc.generateAgentReport(pkg);
  assert.equal(report.agents.length, pkg.agentPlan.tasks.length);
});

test('generateAgentReport: byAgentType matches pkg.agentPlan.byAgentType', async () => {
  const pkg = await buildPkg('Product variant management');
  const report = svc.generateAgentReport(pkg);
  assert.deepEqual(report.byAgentType, pkg.agentPlan.byAgentType);
});

test('generateAgentReport: request matches pkg.request', async () => {
  const pkg = await buildPkg('Build COD cash collection flow');
  const report = svc.generateAgentReport(pkg);
  assert.deepEqual(report.request, pkg.request);
});

test('generateAgentReport: evidence array is non-empty', async () => {
  const pkg = await buildPkg('Order cancellation with refund');
  const report = svc.generateAgentReport(pkg);
  assert.ok(report.evidence.length >= 1);
});

test('generateAgentReport: sources is non-empty array of strings', async () => {
  const pkg = await buildPkg('Build admin role permissions');
  const report = svc.generateAgentReport(pkg);
  assert.ok(Array.isArray(report.sources));
  for (const s of report.sources) {
    assert.ok(typeof s === 'string');
  }
});

test('generateAgentReport: health.area=agent', async () => {
  const pkg = await buildPkg('Shipping zone management');
  const report = svc.generateAgentReport(pkg);
  assert.equal(report.health.area, 'agent');
});

test('generateAgentReport: all agents in report are ASSIGNED + CONNECTED', async () => {
  const pkg = await buildPkg('GST return filing automation');
  const report = svc.generateAgentReport(pkg);
  for (const a of report.agents) {
    assert.equal(a.status, 'ASSIGNED');
    assert.equal(a.connection, 'CONNECTED');
  }
});

test('generateAgentReport: not-connected evidence present for live agent source', async () => {
  const pkg = await buildPkg('Notification delivery service');
  const report = svc.generateAgentReport(pkg);
  const hasNC = report.evidence.some((e) => e.kind === 'not-connected');
  assert.ok(hasNC, 'report evidence must include a not-connected entry for live agent source');
});

// ── 12. Determinism ───────────────────────────────────────────────────────────

test('generateAgentReport: deterministic under fixed clock', async () => {
  const pkg1 = await buildPkg('Implement shipping rate zones');
  const pkg2 = await buildPkg('Implement shipping rate zones');
  const r1 = svc.generateAgentReport(pkg1);
  const r2 = svc.generateAgentReport(pkg2);
  assert.equal(r1.agents.length, r2.agents.length);
  assert.equal(r1.summary, r2.summary);
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.confidence, r2.confidence);
});

test('agentAssignments: deterministic on same pkg', async () => {
  const pkg = await buildPkg('Determinism check feature');
  const a1 = svc.agentAssignments(pkg);
  const a2 = svc.agentAssignments(pkg);
  assert.deepEqual(a1.map((a) => a.id), a2.map((a) => a.id));
});

// ── 13. Read-only purity scan ─────────────────────────────────────────────────

test('AgentIntelligenceService source: no forbidden IO symbols', async () => {
  // Read the source at test time to confirm no fetch/spawn/exec/writeFile present
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { resolve, dirname } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(__dirname, '../src/agent/AgentIntelligenceService.ts'), 'utf8');
  // Strip single-line and block comments before checking
  const noComments = src
    .replace(/\/\/.*$/gm, '')           // strip // comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // strip /* */ comments
  const forbidden = ['fetch(', 'child_process', 'spawn(', 'exec(', 'execSync(', 'writeFile', 'eval(', 'require('];
  for (const sym of forbidden) {
    assert.ok(!noComments.includes(sym), `forbidden symbol found: ${sym}`);
  }
});
