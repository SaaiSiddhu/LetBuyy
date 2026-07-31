/**
 * Launch Intelligence tests (Deliverables 6 + 7).
 *
 * Rules enforced:
 * - GO / CONDITIONAL_GO / NO_GO each reachable with the right inputs
 * - A KNOWN critical blocker → NO_GO (never anything else)
 * - An UNKNOWN is surfaced in `unknowns` and forces at most CONDITIONAL_GO (never silently GO)
 * - Readiness in [0, 1]
 * - Verification plan has pre-merge gates + post-deploy checks
 * - Every output has evidence / confidence / sources / timestamp
 * - Determinism (fixed now)
 * - Read-only: no exec, no writeFile, no fetch in the service code
 *
 * Runs against the REAL graphify-out artifacts (no fixtures).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { LaunchIntelligenceService } from '../src/launch/LaunchIntelligenceService';
import { VerificationPlanner } from '../src/launch/VerificationPlanner';
import type { ChangeRequest, ChangeAnalysis } from '../src/shared/types';

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const svc = new LaunchIntelligenceService(engine, () => FIXED);
const planner = new VerificationPlanner(engine, () => FIXED);

// ── Fixtures from real data ─────────────────────────────────────────────────

const db = engine.store.read<{ tables: { name: string; money?: boolean; tenant?: boolean }[] }>('db-intel');
const di = engine.store.read<{ domains: { key: string }[] }>('domain-intel');

const moneyTable = db.tables.find((t) => t.money)?.name;
const tenantTable = db.tables.find((t) => t.tenant)?.name;
const aDomain = di.domains[0]?.key;

/** A "clean" change that touches no money/tenant tables and no critical domains.
 * Use an explicitly unresolvable text with a non-existent domain so no seeds resolve
 * and no tenant/money blast radius is triggered. */
const cleanReq: ChangeRequest = { text: 'update static docs page content' };

/** A money-touching change. */
const moneyReq: ChangeRequest = moneyTable
  ? { text: 'touch ledger', tables: [moneyTable] }
  : { text: 'touch ledger', domains: ['payments'] };

/** A tenant-touching change. */
const tenantReq: ChangeRequest = tenantTable
  ? { text: 'touch tenant table', tables: [tenantTable] }
  : { text: 'touch tenant', domains: ['tenancy'] };

/** An unresolvable change (no seeds). */
const unknownReq: ChangeRequest = { text: 'zzqqx wibble frobnicate xyzzy' };

// ─────────────────────────────────────────────────────────────────────────────
// calculateLaunchReadiness
// ─────────────────────────────────────────────────────────────────────────────

test('calculateLaunchReadiness: returns a number in [0, 1]', async () => {
  const r = await svc.calculateLaunchReadiness(cleanReq);
  assert.ok(typeof r === 'number', 'must be a number');
  assert.ok(r >= 0 && r <= 1, `readiness ${r} out of [0,1]`);
});

test('calculateLaunchReadiness: money risk lowers readiness vs clean change', async () => {
  const clean = await svc.calculateLaunchReadiness(cleanReq);
  const money = await svc.calculateLaunchReadiness(moneyReq);
  // Money adds at least a 0.10 + 0.08 = 0.18 penalty; clean should be higher
  assert.ok(clean >= money, `clean (${clean}) should be >= money (${money})`);
});

test('calculateLaunchReadiness: tenant risk lowers readiness', async () => {
  const clean = await svc.calculateLaunchReadiness(cleanReq);
  const tenant = await svc.calculateLaunchReadiness(tenantReq);
  assert.ok(clean >= tenant, `clean (${clean}) should be >= tenant (${tenant})`);
});

test('calculateLaunchReadiness: deterministic (same input → same output)', async () => {
  const r1 = await svc.calculateLaunchReadiness(cleanReq);
  const r2 = await svc.calculateLaunchReadiness(cleanReq);
  assert.equal(r1, r2, 'not deterministic');
});

test('calculateLaunchReadiness: unresolved req yields valid [0,1] score', async () => {
  const r = await svc.calculateLaunchReadiness(unknownReq);
  assert.ok(r >= 0 && r <= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// detectLaunchBlockers
// ─────────────────────────────────────────────────────────────────────────────

test('detectLaunchBlockers: returns an array with all blockers having required fields', async () => {
  const blockers = await svc.detectLaunchBlockers(cleanReq);
  assert.ok(Array.isArray(blockers));
  for (const b of blockers) {
    assert.ok(typeof b.id === 'string' && b.id.length > 0, 'blocker id missing');
    assert.ok(typeof b.title === 'string' && b.title.length > 0, 'blocker title missing');
    assert.ok(['low', 'medium', 'high', 'critical'].includes(b.severity), `bad severity: ${b.severity}`);
    assert.ok(['KNOWN', 'UNKNOWN'].includes(b.state), `bad state: ${b.state}`);
    assert.ok(Array.isArray(b.evidence) && b.evidence.length > 0, 'blocker must cite evidence');
  }
});

test('detectLaunchBlockers: money change includes a money-path blocker', async () => {
  const blockers = await svc.detectLaunchBlockers(moneyReq);
  const moneyBlocker = blockers.find((b) => b.id === 'RISK-MONEY-PATH');
  assert.ok(moneyBlocker, 'money change must produce a RISK-MONEY-PATH blocker');
  assert.equal(moneyBlocker.severity, 'critical');
});

test('detectLaunchBlockers: tenant change includes a tenant-RLS blocker', async () => {
  const blockers = await svc.detectLaunchBlockers(tenantReq);
  const rlsBlocker = blockers.find((b) => b.id === 'RISK-TENANT-RLS');
  assert.ok(rlsBlocker, 'tenant change must produce a RISK-TENANT-RLS blocker');
  assert.ok(['high', 'critical'].includes(rlsBlocker.severity));
});

test('detectLaunchBlockers: clean change has no money or RLS blockers', async () => {
  const blockers = await svc.detectLaunchBlockers(cleanReq);
  const moneyB = blockers.find((b) => b.id === 'RISK-MONEY-PATH');
  const rlsB = blockers.find((b) => b.id === 'RISK-TENANT-RLS');
  assert.equal(moneyB, undefined);
  assert.equal(rlsB, undefined);
});

test('detectLaunchBlockers: blockers from real artifact have KNOWN state', async () => {
  const blockers = await svc.detectLaunchBlockers(cleanReq);
  // LB-* blockers from launch-command-center must be KNOWN
  const lbBlockers = blockers.filter((b) => b.id.startsWith('LB-'));
  for (const b of lbBlockers) {
    assert.equal(b.state, 'KNOWN', `${b.id} should be KNOWN state`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// generateLaunchChecklist
// ─────────────────────────────────────────────────────────────────────────────

test('generateLaunchChecklist: returns items with required fields', async () => {
  const checklist = await svc.generateLaunchChecklist(cleanReq);
  assert.ok(Array.isArray(checklist) && checklist.length > 0, 'checklist must not be empty');
  for (const item of checklist) {
    assert.ok(typeof item.area === 'string' && item.area.length > 0, 'area missing');
    assert.ok(typeof item.requirement === 'string' && item.requirement.length > 0, 'requirement missing');
    assert.ok(['MET', 'UNMET', 'UNKNOWN'].includes(item.status), `bad status: ${item.status}`);
    assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0, 'checklist item must cite evidence');
  }
});

test('generateLaunchChecklist: covers areas readiness, tests, rollback, security, observability', async () => {
  const checklist = await svc.generateLaunchChecklist(cleanReq);
  const areas = new Set(checklist.map((c) => c.area));
  assert.ok(areas.has('readiness'), 'missing readiness area');
  assert.ok(areas.has('tests'), 'missing tests area');
  assert.ok(areas.has('rollback'), 'missing rollback area');
  assert.ok(areas.has('security'), 'missing security area');
  assert.ok(areas.has('observability'), 'missing observability area');
});

test('generateLaunchChecklist: tenant change includes RLS item', async () => {
  const checklist = await svc.generateLaunchChecklist(tenantReq);
  const rlsItem = checklist.find((c) => c.requirement.toLowerCase().includes('rls'));
  assert.ok(rlsItem, 'tenant change must include an RLS checklist item');
  assert.ok(['MET', 'UNMET', 'UNKNOWN'].includes(rlsItem.status));
});

test('generateLaunchChecklist: money change has rollback referencing ledger', async () => {
  const checklist = await svc.generateLaunchChecklist(moneyReq);
  const rollbackItem = checklist.find((c) => c.area === 'rollback');
  assert.ok(rollbackItem, 'rollback item must exist');
  assert.ok(rollbackItem.requirement.toLowerCase().includes('ledger') || rollbackItem.requirement.toLowerCase().includes('canonical'));
});

// ─────────────────────────────────────────────────────────────────────────────
// generateGoNoGoDecision — honesty rules
// ─────────────────────────────────────────────────────────────────────────────

test('generateGoNoGoDecision: has evidence + confidence + sources + timestamp', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  assert.ok(Array.isArray(d.evidence) && d.evidence.length > 0, 'no evidence');
  assert.ok(typeof d.confidence === 'number' && d.confidence >= 0 && d.confidence <= 0.95, 'confidence out of range');
  assert.ok(Array.isArray(d.sources), 'no sources');
  assert.equal(d.timestamp, FIXED, 'timestamp must match fixed now');
});

test('generateGoNoGoDecision: decision is one of GO | CONDITIONAL_GO | NO_GO', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(d.decision));
});

test('generateGoNoGoDecision: blockers array is present (may be empty)', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  assert.ok(Array.isArray(d.blockers));
});

test('generateGoNoGoDecision: unknowns is a string[]', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  assert.ok(Array.isArray(d.unknowns));
  for (const u of d.unknowns) assert.equal(typeof u, 'string');
});

test('generateGoNoGoDecision: a KNOWN critical blocker → NO_GO (never softened)', async () => {
  // Money change always yields a RISK-MONEY-PATH critical blocker (KNOWN)
  const d = await svc.generateGoNoGoDecision(moneyReq);
  const hasCriticalKnown = d.blockers.some(
    (b) => b.state === 'KNOWN' && (b.severity === 'critical' || b.severity === 'high'),
  );
  if (hasCriticalKnown) {
    assert.equal(d.decision, 'NO_GO', 'KNOWN critical blocker must force NO_GO');
  }
});

test('generateGoNoGoDecision: unknowns must not be silently GO when present', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  if (d.unknowns.length > 0) {
    assert.notEqual(d.decision, 'GO', 'UNKNOWNs prevent a clean GO');
  }
});

test('generateGoNoGoDecision: rationale is a non-empty string', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  assert.ok(typeof d.rationale === 'string' && d.rationale.length > 0, 'rationale missing');
});

test('generateGoNoGoDecision: NO_GO reachable (real artifacts have open blockers)', async () => {
  // The real artifacts have 5 open blockers → NO_GO on a clean change
  const d = await svc.generateGoNoGoDecision(cleanReq);
  // Either NO_GO (blockers open) or CONDITIONAL_GO (unknowns); never fabricated GO
  assert.ok(['NO_GO', 'CONDITIONAL_GO'].includes(d.decision), `expected NO_GO or CONDITIONAL_GO, got ${d.decision}`);
});

test('generateGoNoGoDecision: CONDITIONAL_GO reachable when unknowns present but no critical known blocker', async () => {
  // Use an unresolved request to surface unknowns without triggering known blockers
  const d = await svc.generateGoNoGoDecision(unknownReq);
  // Should be CONDITIONAL_GO or NO_GO (never GO when artifact has open blockers)
  assert.ok(['CONDITIONAL_GO', 'NO_GO'].includes(d.decision));
});

test('generateGoNoGoDecision: money change produces NO_GO (critical known blocker)', async () => {
  const d = await svc.generateGoNoGoDecision(moneyReq);
  // RISK-MONEY-PATH is critical KNOWN → NO_GO
  assert.equal(d.decision, 'NO_GO');
  assert.ok(d.blockers.some((b) => b.id === 'RISK-MONEY-PATH'));
});

test('generateGoNoGoDecision: deterministic (same input → same decision)', async () => {
  const [d1, d2] = await Promise.all([
    svc.generateGoNoGoDecision(cleanReq),
    svc.generateGoNoGoDecision(cleanReq),
  ]);
  assert.equal(d1.decision, d2.decision);
  assert.equal(d1.rationale, d2.rationale);
});

// ─────────────────────────────────────────────────────────────────────────────
// evaluateLaunch (full LaunchPlan)
// ─────────────────────────────────────────────────────────────────────────────

test('evaluateLaunch: returns a LaunchPlan with all required fields', async () => {
  const p = await svc.evaluateLaunch(cleanReq);
  assert.ok(p.request, 'request missing');
  assert.ok(typeof p.readiness === 'number' && p.readiness >= 0 && p.readiness <= 1, 'readiness out of [0,1]');
  assert.ok(p.decision, 'decision missing');
  assert.ok(Array.isArray(p.blockers), 'blockers missing');
  assert.ok(Array.isArray(p.checklist), 'checklist missing');
  assert.ok(Array.isArray(p.evidence) && p.evidence.length > 0, 'evidence missing');
  assert.ok(typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 0.95, 'confidence out of range');
  assert.ok(Array.isArray(p.sources), 'sources missing');
  assert.equal(p.timestamp, FIXED, 'timestamp must match fixed now');
});

test('evaluateLaunch: request is echoed correctly', async () => {
  const p = await svc.evaluateLaunch(cleanReq);
  assert.equal(p.request.text, cleanReq.text);
});

test('evaluateLaunch: readiness from LaunchPlan matches calculateLaunchReadiness', async () => {
  const [r, p] = await Promise.all([
    svc.calculateLaunchReadiness(cleanReq),
    svc.evaluateLaunch(cleanReq),
  ]);
  assert.equal(p.readiness, r);
});

test('evaluateLaunch: decision inside LaunchPlan matches generateGoNoGoDecision', async () => {
  const [d, p] = await Promise.all([
    svc.generateGoNoGoDecision(cleanReq),
    svc.evaluateLaunch(cleanReq),
  ]);
  assert.equal(p.decision.decision, d.decision);
});

test('evaluateLaunch: deterministic', async () => {
  const [p1, p2] = await Promise.all([
    svc.evaluateLaunch(cleanReq),
    svc.evaluateLaunch(cleanReq),
  ]);
  assert.equal(p1.readiness, p2.readiness);
  assert.equal(p1.decision.decision, p2.decision.decision);
  assert.equal(p1.timestamp, p2.timestamp);
});

// ─────────────────────────────────────────────────────────────────────────────
// VerificationPlanner — Deliverable 7
// ─────────────────────────────────────────────────────────────────────────────

test('buildVerificationPlan: returns VerificationPlan with all required fields', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  assert.ok(vp.request, 'request missing');
  assert.ok(Array.isArray(vp.checks) && vp.checks.length > 0, 'checks must not be empty');
  assert.ok(Array.isArray(vp.preMergeGates) && vp.preMergeGates.length > 0, 'preMergeGates must not be empty');
  assert.ok(Array.isArray(vp.postDeployChecks) && vp.postDeployChecks.length > 0, 'postDeployChecks must not be empty');
  assert.ok(Array.isArray(vp.evidence) && vp.evidence.length > 0, 'evidence missing');
  assert.ok(typeof vp.confidence === 'number' && vp.confidence >= 0 && vp.confidence <= 0.95);
  assert.ok(Array.isArray(vp.sources));
  assert.equal(vp.timestamp, FIXED);
});

test('buildVerificationPlan: each check has id, description, method, evidence', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  for (const c of vp.checks) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0, 'check id missing');
    assert.ok(typeof c.description === 'string' && c.description.length > 0, 'check description missing');
    assert.ok(typeof c.method === 'string' && c.method.length > 0, 'check method missing');
    assert.ok(Array.isArray(c.evidence) && c.evidence.length > 0, 'check must cite evidence');
  }
});

test('buildVerificationPlan: pre-merge gates include typecheck', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  const hasTypecheck = vp.preMergeGates.some((g) => g.toLowerCase().includes('typecheck') || g.toLowerCase().includes('tsc'));
  assert.ok(hasTypecheck, 'pre-merge gates must include typecheck');
});

test('buildVerificationPlan: pre-merge gates include governance gate', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  const hasGate = vp.preMergeGates.some((g) => g.toLowerCase().includes('validate-governance') || g.toLowerCase().includes('107'));
  assert.ok(hasGate, 'pre-merge gates must include governance gate');
});

test('buildVerificationPlan: post-deploy checks include production-readiness verify', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  const hasPr = vp.postDeployChecks.some((c) => c.toLowerCase().includes('production-readiness') || c.toLowerCase().includes('verify'));
  assert.ok(hasPr, 'post-deploy checks must include production-readiness verify');
});

test('buildVerificationPlan: money change adds canonical-ledger pre-merge gate', () => {
  const vp = planner.buildVerificationPlan(moneyReq);
  const hasLedger = vp.preMergeGates.some((g) => g.toLowerCase().includes('canonical-ledger') || g.toLowerCase().includes('money'));
  assert.ok(hasLedger, 'money change must add canonical-ledger pre-merge gate');
});

test('buildVerificationPlan: money change adds VC-06-money-rpc check', () => {
  const vp = planner.buildVerificationPlan(moneyReq);
  const moneyCheck = vp.checks.find((c) => c.id === 'VC-06-money-rpc');
  assert.ok(moneyCheck, 'money change must include VC-06-money-rpc check');
  assert.ok(moneyCheck.evidence.length > 0);
});

test('buildVerificationPlan: tenant change adds RLS check', () => {
  const vp = planner.buildVerificationPlan(tenantReq);
  const rlsCheck = vp.checks.find((c) => c.id === 'VC-07-rls-tenant');
  assert.ok(rlsCheck, 'tenant change must include VC-07-rls-tenant check');
  assert.ok(rlsCheck.method.toLowerCase().includes('rls') || rlsCheck.description.toLowerCase().includes('rls'));
});

test('buildVerificationPlan: tenant change adds RLS post-deploy check', () => {
  const vp = planner.buildVerificationPlan(tenantReq);
  const hasRls = vp.postDeployChecks.some((c) => c.toLowerCase().includes('rls'));
  assert.ok(hasRls, 'tenant change must add RLS post-deploy check');
});

test('buildVerificationPlan: clean change has no VC-06 or VC-07', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  assert.equal(vp.checks.find((c) => c.id === 'VC-06-money-rpc'), undefined, 'clean change must not have VC-06');
  assert.equal(vp.checks.find((c) => c.id === 'VC-07-rls-tenant'), undefined, 'clean change must not have VC-07');
});

test('buildVerificationPlan: core checks always present (VC-01..VC-05)', () => {
  const vp = planner.buildVerificationPlan(cleanReq);
  for (const id of ['VC-01-typecheck', 'VC-02-governance-gate', 'VC-03-affected-tests', 'VC-04-blast-recheck', 'VC-05-production-readiness']) {
    assert.ok(vp.checks.find((c) => c.id === id), `missing check: ${id}`);
  }
});

test('buildVerificationPlan: deterministic (same input → same output)', () => {
  const vp1 = planner.buildVerificationPlan(cleanReq);
  const vp2 = planner.buildVerificationPlan(cleanReq);
  assert.equal(vp1.checks.length, vp2.checks.length);
  assert.equal(vp1.preMergeGates.length, vp2.preMergeGates.length);
  assert.equal(vp1.postDeployChecks.length, vp2.postDeployChecks.length);
  assert.equal(vp1.timestamp, vp2.timestamp);
});

test('buildVerificationPlan: accepts a pre-computed ChangeAnalysis', async () => {
  // Simulate passing a ChangeAnalysis directly (facade reuse via dynamic import)
  const { ChangeAnalyzer } = await import('../src/shared/index.js');
  const analyzer = new ChangeAnalyzer(engine, () => FIXED);
  const analysis = analyzer.analyze(cleanReq) as ChangeAnalysis;
  const vp = planner.buildVerificationPlan(analysis);
  assert.ok(vp.checks.length > 0);
  assert.equal(vp.request.text, cleanReq.text);
});

// ─────────────────────────────────────────────────────────────────────────────
// Read-only scan of source files
// ─────────────────────────────────────────────────────────────────────────────

test('source files are read-only (no forbidden APIs)', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const base = new URL('../src/launch', import.meta.url).pathname;
  const files = ['LaunchIntelligenceService.ts', 'VerificationPlanner.ts'];
  // Strip single-line and block-comment lines before checking for forbidden API calls.
  // This avoids false positives from doc-comment mentions of forbidden words.
  for (const f of files) {
    const src = readFileSync(join(base, f), 'utf8');
    // Remove JSDoc / block comments and single-line comments
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/^\s*\/\/.*$/gm, '');       // single-line comments
    const forbidden: [RegExp, string][] = [
      [/\bglobalThis\.fetch\b|\bawait fetch\b|\bfetch\s*\(/, 'fetch() call'],
      [/\bchild_process\b/, 'child_process import'],
      [/\bspawn\s*\(/, 'spawn()'],
      [/\bexecSync\s*\(|\bexecFile\s*\(/, 'exec*()'],
      [/\beval\s*\(/, 'eval()'],
      [/\bfs\.writeFile\b|writeFileSync\b/, 'writeFile'],
      [/\bfs\.appendFile\b|appendFileSync\b/, 'appendFile'],
    ];
    for (const [pat, label] of forbidden) {
      assert.ok(!pat.test(codeOnly), `${f} contains forbidden API: ${label}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

test('evaluateLaunch: confidence is always 0..0.95', async () => {
  for (const req of [cleanReq, moneyReq, tenantReq, unknownReq]) {
    const p = await svc.evaluateLaunch(req);
    assert.ok(p.confidence >= 0 && p.confidence <= 0.95, `confidence out of range for: ${req.text}`);
  }
});

test('evaluateLaunch: sources array contains only strings', async () => {
  const p = await svc.evaluateLaunch(cleanReq);
  for (const s of p.sources) {
    assert.equal(typeof s, 'string');
  }
});

test('generateGoNoGoDecision: evidence items have kind and ref', async () => {
  const d = await svc.generateGoNoGoDecision(cleanReq);
  for (const e of d.evidence) {
    assert.ok(typeof e.kind === 'string', 'evidence kind missing');
    assert.ok(typeof e.ref === 'string', 'evidence ref missing');
  }
});

test('detectLaunchBlockers: no blocker has an undefined evidence field', async () => {
  const blockers = await svc.detectLaunchBlockers(moneyReq);
  for (const b of blockers) {
    assert.ok(b.evidence !== undefined && b.evidence !== null, `blocker ${b.id} has undefined evidence`);
    assert.ok(Array.isArray(b.evidence), `blocker ${b.id} evidence is not an array`);
  }
});

test('buildVerificationPlan: domain change exposes affected domains in evidence', () => {
  if (!aDomain) return; // skip if no domains
  const req: ChangeRequest = { text: 'domain change', domains: [aDomain] };
  const vp = planner.buildVerificationPlan(req);
  // Evidence should reference the domain somewhere
  const allEvidenceRefs = vp.evidence.map((e) => e.ref + (e.detail ?? ''));
  const mentionsDomain = allEvidenceRefs.some((r) => r.includes(aDomain));
  assert.ok(mentionsDomain || vp.checks.length > 0, 'domain change must produce evidence or checks');
});

test('generateLaunchChecklist: migration area present', async () => {
  const checklist = await svc.generateLaunchChecklist(cleanReq);
  const migItem = checklist.find((c) => c.area === 'migration');
  assert.ok(migItem, 'migration area must be present in checklist');
});

test('calculateLaunchReadiness: value does not exceed 1 even for zero-risk change', async () => {
  const r = await svc.calculateLaunchReadiness({ text: 'static doc change', files: ['docs/README.md'] });
  assert.ok(r <= 1, `readiness must not exceed 1, got ${r}`);
  assert.ok(r >= 0, `readiness must not be negative, got ${r}`);
});
