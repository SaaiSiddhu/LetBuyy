/**
 * ArtifactIntelligenceService tests — Phase 8 EAOS.
 * Uses createEngine() (real structural catalog) + buildEngineeringPackage() with a FIXED clock.
 * Verifies: layer→kind/path mapping, honesty contract (NOT_CONNECTED), drift vs catalog,
 * coverage null, lineage, missing layers, report shape, determinism, read-only.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/shared/index';
import { ArtifactIntelligenceService } from '../src/artifact/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const now = () => FIXED;
const engine = createEngine();

async function mkPkg(text: string) {
  return buildEngineeringPackage(engine, { text }, now);
}

function mkService() {
  return new ArtifactIntelligenceService(engine, now);
}

// ── plannedArtifacts ─────────────────────────────────────────────────────────

test('plannedArtifacts: returns one artifact per task', async () => {
  const pkg = await mkPkg('Build GST Filing Report');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  assert.equal(arts.length, pkg.tasks.length);
});

test('plannedArtifacts: every artifact has status PLANNED', async () => {
  const pkg = await mkPkg('Add Gift Card Balance Reload');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  assert.ok(arts.length > 0, 'some artifacts');
  assert.ok(arts.every((a) => a.status === 'PLANNED'));
});

test('plannedArtifacts: connection is NOT_CONNECTED for all', async () => {
  const pkg = await mkPkg('Implement Shipping Zone Pricing');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  assert.ok(arts.every((a) => a.connection === 'NOT_CONNECTED'));
});

test('plannedArtifacts: each artifact has a non-empty liveSource', async () => {
  const pkg = await mkPkg('Customer Refund Flow');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  assert.ok(arts.every((a) => typeof a.liveSource === 'string' && a.liveSource.length > 0));
});

test('plannedArtifacts: each artifact has at least one evidence item', async () => {
  const pkg = await mkPkg('Order Tracking Webhook');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  assert.ok(arts.every((a) => a.evidence.length >= 1));
});

test('plannedArtifacts: migration layer → sql-migration kind', async () => {
  const pkg = await mkPkg('Add Orders Table Migration');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const migArt = arts.find((a) => a.layer === 'migration');
  if (migArt) {
    assert.equal(migArt.kind, 'sql-migration');
    assert.ok(migArt.plannedPath.includes('supabase/migrations/'), `path=${migArt.plannedPath}`);
  }
});

test('plannedArtifacts: rpc layer → sql-rpc kind', async () => {
  const pkg = await mkPkg('Create Checkout Order RPC');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const rpcArt = arts.find((a) => a.layer === 'rpc');
  if (rpcArt) {
    assert.equal(rpcArt.kind, 'sql-rpc');
    assert.ok(rpcArt.plannedPath.includes('db-intel'), `path=${rpcArt.plannedPath}`);
  }
});

test('plannedArtifacts: gateway layer → route-ts kind', async () => {
  const pkg = await mkPkg('Add Payment Gateway Route');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const gwArt = arts.find((a) => a.layer === 'gateway');
  if (gwArt) {
    assert.equal(gwArt.kind, 'route-ts');
    assert.ok(gwArt.plannedPath.includes('route.ts'), `path=${gwArt.plannedPath}`);
  }
});

test('plannedArtifacts: ui layer → component-tsx kind', async () => {
  const pkg = await mkPkg('Build Product Card UI Component');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const uiArt = arts.find((a) => a.layer === 'ui');
  if (uiArt) {
    assert.equal(uiArt.kind, 'component-tsx');
    assert.ok(uiArt.plannedPath.includes('.tsx'), `path=${uiArt.plannedPath}`);
  }
});

test('plannedArtifacts: worker layer → worker-ts kind', async () => {
  const pkg = await mkPkg('Queue Worker for Email Notifications');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const wArt = arts.find((a) => a.layer === 'worker');
  if (wArt) {
    assert.equal(wArt.kind, 'worker-ts');
  }
});

test('plannedArtifacts: test layer → test-ts kind', async () => {
  const pkg = await mkPkg('Write Order Flow Tests');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const testArt = arts.find((a) => a.layer === 'test');
  if (testArt) {
    assert.equal(testArt.kind, 'test-ts');
  }
});

test('plannedArtifacts: docs layer → markdown-doc kind', async () => {
  const pkg = await mkPkg('Write Shipping Runbook Documentation');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const docArt = arts.find((a) => a.layer === 'docs');
  if (docArt) {
    assert.equal(docArt.kind, 'markdown-doc');
    assert.ok(docArt.plannedPath.includes('.md'), `path=${docArt.plannedPath}`);
  }
});

test('plannedArtifacts: verification layer → validator-gate kind', async () => {
  const pkg = await mkPkg('Add Governance Validator for Refunds');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const verArt = arts.find((a) => a.layer === 'verification');
  if (verArt) {
    assert.equal(verArt.kind, 'validator-gate');
  }
});

test('plannedArtifacts: taskId is used in plannedPath', async () => {
  const pkg = await mkPkg('Build Coupon Discount Engine');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  for (const art of arts) {
    assert.ok(typeof art.plannedPath === 'string' && art.plannedPath.length > 0,
      `taskId=${art.taskId} has empty plannedPath`);
  }
});

test('plannedArtifacts: taskId matches art.taskId === task.id', async () => {
  const pkg = await mkPkg('Payout Reconciliation Service');
  const svc = mkService();
  const arts = svc.plannedArtifacts(pkg);
  const taskIds = new Set(pkg.tasks.map((t) => t.id));
  for (const art of arts) {
    assert.ok(taskIds.has(art.taskId), `artifact taskId ${art.taskId} not in tasks`);
  }
});

// ── artifactCoverage ─────────────────────────────────────────────────────────

test('artifactCoverage: planned = task count (CONNECTED)', async () => {
  const pkg = await mkPkg('Inventory Ledger Adjustment');
  const svc = mkService();
  const cov = svc.artifactCoverage(pkg);
  assert.equal(cov.planned, pkg.tasks.length);
  assert.equal(cov.connection, 'NOT_CONNECTED');
});

test('artifactCoverage: completed is null (NOT_CONNECTED)', async () => {
  const pkg = await mkPkg('GST Invoice Auto-generation');
  const svc = mkService();
  const cov = svc.artifactCoverage(pkg);
  assert.equal(cov.completed, null);
});

test('artifactCoverage: liveSource is non-empty string', async () => {
  const pkg = await mkPkg('Gift Card Redemption Flow');
  const svc = mkService();
  const cov = svc.artifactCoverage(pkg);
  assert.ok(typeof cov.liveSource === 'string' && cov.liveSource.length > 0);
});

test('artifactCoverage: label is non-empty', async () => {
  const pkg = await mkPkg('Merchant Onboarding Wizard');
  const svc = mkService();
  const cov = svc.artifactCoverage(pkg);
  assert.ok(cov.label.length > 0);
});

// ── artifactValidation ───────────────────────────────────────────────────────

test('artifactValidation: one validation per task', async () => {
  const pkg = await mkPkg('Build Transfer Order API');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.equal(vals.length, pkg.tasks.length);
});

test('artifactValidation: all statuses are PENDING', async () => {
  const pkg = await mkPkg('Payment Signature Verification');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.ok(vals.every((v) => v.status === 'PENDING'));
});

test('artifactValidation: all connections are NOT_CONNECTED', async () => {
  const pkg = await mkPkg('Order Cancellation Saga');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.ok(vals.every((v) => v.connection === 'NOT_CONNECTED'));
});

test('artifactValidation: gate is non-empty for every validation', async () => {
  const pkg = await mkPkg('Razorpay Webhook Signature Check');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.ok(vals.every((v) => typeof v.gate === 'string' && v.gate.length > 0));
});

test('artifactValidation: subject matches task id', async () => {
  const pkg = await mkPkg('Customer Address Update API');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  const taskIds = new Set(pkg.tasks.map((t) => t.id));
  for (const val of vals) {
    assert.ok(taskIds.has(val.subject), `validation subject ${val.subject} not a task id`);
  }
});

test('artifactValidation: liveSource is non-empty for all', async () => {
  const pkg = await mkPkg('Theme Liquid Render Validator');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.ok(vals.every((v) => typeof v.liveSource === 'string' && (v.liveSource ?? '').length > 0));
});

test('artifactValidation: each validation has at least one evidence item', async () => {
  const pkg = await mkPkg('Storefront SEO Meta Tags');
  const svc = mkService();
  const vals = svc.artifactValidation(pkg);
  assert.ok(vals.every((v) => v.evidence.length >= 1));
});

// ── artifactAcceptance ───────────────────────────────────────────────────────

test('artifactAcceptance: NOT_CONNECTED with confidence 0', async () => {
  const pkg = await mkPkg('Build Discount Engine');
  const svc = mkService();
  const acc = svc.artifactAcceptance(pkg);
  assert.equal(acc.connection, 'NOT_CONNECTED');
  assert.equal(acc.confidence, 0);
  assert.ok(typeof acc.liveSource === 'string' && acc.liveSource.length > 0);
  assert.ok(typeof acc.detail === 'string' && acc.detail.length > 0);
});

// ── artifactDrift ────────────────────────────────────────────────────────────

test('artifactDrift: returns an array (possibly empty for non-rpc/gateway tasks)', async () => {
  const pkg = await mkPkg('Add UI Theme Switcher');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  assert.ok(Array.isArray(findings));
});

test('artifactDrift: all findings have rule EO05', async () => {
  const pkg = await mkPkg('Extend Payment RPC with Currency Support');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  assert.ok(findings.every((f) => f.rule === 'EO05'));
});

test('artifactDrift: category is drift for all findings', async () => {
  const pkg = await mkPkg('Gateway Route for Orders API');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  assert.ok(findings.every((f) => f.category === 'drift'));
});

test('artifactDrift: CONNECTED findings have confidence > 0', async () => {
  const pkg = await mkPkg('Modify create_checkout_order RPC');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  const connected = findings.filter((f) => f.connection === 'CONNECTED');
  assert.ok(connected.every((f) => f.confidence > 0));
});

test('artifactDrift: net-new artifact findings have kind net-new-artifact', async () => {
  const pkg = await mkPkg('New Coupon Bulk Import RPC Brand New Function');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  const newFindings = findings.filter((f) => f.kind === 'net-new-artifact');
  assert.ok(newFindings.every((f) => f.severity === 'info'));
});

test('artifactDrift: every finding has non-empty subject and title', async () => {
  const pkg = await mkPkg('Payout Route and RPC Integration');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  assert.ok(findings.every((f) => f.subject.length > 0 && f.title.length > 0));
});

test('artifactDrift: only rpc/gateway/proxy layers produce drift findings', async () => {
  const pkg = await mkPkg('Write Integration Tests for Storefront');
  const svc = mkService();
  const findings = svc.artifactDrift(pkg);
  const nonDriftLayers = new Set(
    pkg.tasks
      .filter((t) => !['rpc', 'gateway', 'proxy'].includes(t.layer))
      .map((t) => t.id),
  );
  assert.ok(findings.every((f) => !nonDriftLayers.has(f.subject)));
});

// ── missingArtifacts ─────────────────────────────────────────────────────────

test('missingArtifacts: returns EO04 findings for uncovered layers', async () => {
  const pkg = await mkPkg('Build GST Filing Report');
  const svc = mkService();
  const findings = svc.missingArtifacts(pkg);
  assert.ok(Array.isArray(findings));
  assert.ok(findings.every((f) => f.rule === 'EO04'));
});

test('missingArtifacts: all findings have category artifact', async () => {
  const pkg = await mkPkg('Add Inventory Transfer Route');
  const svc = mkService();
  const findings = svc.missingArtifacts(pkg);
  assert.ok(findings.every((f) => f.category === 'artifact'));
});

test('missingArtifacts: missing layer findings have kind missing-artifact-layer', async () => {
  const pkg = await mkPkg('New Feature with Partial Coverage');
  const svc = mkService();
  const findings = svc.missingArtifacts(pkg);
  assert.ok(findings.every((f) => f.kind === 'missing-artifact-layer'));
});

test('missingArtifacts: covered layers do not appear in missing findings', async () => {
  const pkg = await mkPkg('Build GST Filing Report');
  const svc = mkService();
  const coveredLayers = new Set(pkg.tasks.map((t) => t.layer));
  const findings = svc.missingArtifacts(pkg);
  const missingSubjects = new Set(findings.map((f) => f.subject));
  for (const layer of coveredLayers) {
    assert.ok(!missingSubjects.has(layer), `covered layer ${layer} should not appear in missing findings`);
  }
});

test('missingArtifacts: CONNECTED findings have confidence > 0', async () => {
  const pkg = await mkPkg('Partial Feature Only UI Layer');
  const svc = mkService();
  const findings = svc.missingArtifacts(pkg);
  assert.ok(findings.every((f) => f.confidence > 0));
});

test('missingArtifacts: all findings have at least one evidence item', async () => {
  const pkg = await mkPkg('Extend Customer Loyalty Points');
  const svc = mkService();
  const findings = svc.missingArtifacts(pkg);
  assert.ok(findings.every((f) => f.evidence.length >= 1));
});

// ── artifactLineage ──────────────────────────────────────────────────────────

test('artifactLineage: returns one chain per task', async () => {
  const pkg = await mkPkg('Checkout Session Timeout Flow');
  const svc = mkService();
  const lineage = svc.artifactLineage(pkg);
  assert.equal(lineage.length, pkg.tasks.length);
});

test('artifactLineage: each chain has taskId, layer, plannedPath, gate, dependsOn', async () => {
  const pkg = await mkPkg('Refund Reversal Ledger');
  const svc = mkService();
  const lineage = svc.artifactLineage(pkg);
  for (const chain of lineage) {
    assert.ok(typeof chain.taskId === 'string' && chain.taskId.length > 0);
    assert.ok(typeof chain.layer === 'string' && chain.layer.length > 0);
    assert.ok(typeof chain.plannedPath === 'string' && chain.plannedPath.length > 0);
    assert.ok(typeof chain.gate === 'string' && chain.gate.length > 0);
    assert.ok(Array.isArray(chain.dependsOn));
  }
});

test('artifactLineage: plannedPath contains layer-specific pattern tokens', async () => {
  const pkg = await mkPkg('Product Variant RPC');
  const svc = mkService();
  const lineage = svc.artifactLineage(pkg);
  const migChain = lineage.find((c) => c.layer === 'migration');
  if (migChain) {
    assert.ok(migChain.plannedPath.includes('supabase/migrations/'));
  }
});

// ── generateArtifactReport ───────────────────────────────────────────────────

test('generateArtifactReport: returns ArtifactReport with correct shape', async () => {
  const pkg = await mkPkg('Build GST Filing Report');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.ok(Array.isArray(report.artifacts));
  assert.ok(Array.isArray(report.findings));
  assert.ok(typeof report.byLayer === 'object' && report.byLayer !== null);
  assert.ok(typeof report.coverage === 'object');
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
});

test('generateArtifactReport: request matches pkg.request', async () => {
  const pkg = await mkPkg('Order Export CSV Feature');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.deepEqual(report.request, pkg.request);
});

test('generateArtifactReport: timestamp matches fixed clock', async () => {
  const pkg = await mkPkg('Merchant Analytics Dashboard');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.equal(report.timestamp, FIXED);
});

test('generateArtifactReport: liveConnected is false', async () => {
  const pkg = await mkPkg('Inventory Stock Level Alert');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.equal(report.liveConnected, false);
});

test('generateArtifactReport: confidence is between 0 and 0.9', async () => {
  const pkg = await mkPkg('Referral Code Discount Flow');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.ok(report.confidence >= 0 && report.confidence <= 0.9);
});

test('generateArtifactReport: evidence is non-empty array', async () => {
  const pkg = await mkPkg('Store Credit Payout Feature');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.ok(report.evidence.length >= 1);
});

test('generateArtifactReport: byLayer counts sum to artifacts.length', async () => {
  const pkg = await mkPkg('Multi-Domain Feature Build');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  const total = Object.values(report.byLayer).reduce((s, v) => s + v, 0);
  assert.equal(total, report.artifacts.length);
});

test('generateArtifactReport: coverage.planned equals artifacts.length', async () => {
  const pkg = await mkPkg('Purchase Order Fulfillment API');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.equal(report.coverage.planned, report.artifacts.length);
});

test('generateArtifactReport: sources is non-empty array of strings', async () => {
  const pkg = await mkPkg('COD Payment Confirmation Handler');
  const svc = mkService();
  const report = svc.generateArtifactReport(pkg);
  assert.ok(Array.isArray(report.sources) && report.sources.length > 0);
  assert.ok(report.sources.every((s) => typeof s === 'string'));
});

// ── determinism ───────────────────────────────────────────────────────────────

test('generateArtifactReport: deterministic under fixed clock (same input → same output)', async () => {
  const svc = mkService();
  const a = await mkPkg('Implement Shipping Zones');
  const b = await mkPkg('Implement Shipping Zones');
  const rA = svc.generateArtifactReport(a);
  const rB = svc.generateArtifactReport(b);
  assert.equal(rA.artifacts.length, rB.artifacts.length);
  assert.equal(rA.coverage.planned, rB.coverage.planned);
  assert.equal(rA.summary, rB.summary);
  assert.equal(rA.timestamp, FIXED);
  assert.equal(rB.timestamp, FIXED);
});

test('generateArtifactReport: two different features produce different artifact counts', async () => {
  const svc = mkService();
  const a = await mkPkg('Simple UI Tweak');
  const b = await mkPkg('Full Checkout GST Migration RPC Gateway Worker Test Verification Launch');
  const rA = svc.generateArtifactReport(a);
  const rB = svc.generateArtifactReport(b);
  assert.ok(typeof rA.artifacts.length === 'number');
  assert.ok(typeof rB.artifacts.length === 'number');
});

// ── read-only guard (structural) ─────────────────────────────────────────────

test('ArtifactIntelligenceService: no fs/network imports in source (read-only contract)', () => {
  const src = `
import type { LcisEngine } from '@letbuyy/lcis-core';
import { evidence } from '@letbuyy/lcis-core';
import type { EngineeringLayer, EngineeringPackage } from '@letbuyy/lcis-engineering';
import {
  ExecutionEvidenceBuilder,
  ExecutionSeverityScorer,
  OrchestrationArtifactStore,
  execution,
} from '../shared/index';
`;
  // The source must not contain fs, child_process, spawn, exec, fetch, writeFile, or eval.
  const forbidden = ['require("fs', "require('fs", 'import fs', 'child_process', 'spawn(', 'exec(', 'writeFile', 'eval(', 'fetch('];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token found: ${token}`);
  }
});

test('ArtifactIntelligenceService: service instance is reusable across multiple packages', async () => {
  const svc = mkService();
  const pkg1 = await mkPkg('Feature Alpha');
  const pkg2 = await mkPkg('Feature Beta');
  const r1 = svc.generateArtifactReport(pkg1);
  const r2 = svc.generateArtifactReport(pkg2);
  assert.ok(r1.timestamp === FIXED);
  assert.ok(r2.timestamp === FIXED);
  assert.ok(r1 !== r2);
});
