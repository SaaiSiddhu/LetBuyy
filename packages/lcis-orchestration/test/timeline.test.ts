/**
 * TimelineIntelligenceService tests (≥70 assertions).
 *
 * Test strategy:
 *  - createEngine() + buildEngineeringPackage() with a FIXED clock (no Date.now/new Date)
 *  - milestones map pkg.graph.milestones (structure CONNECTED)
 *  - durations/timestamps/historical values are NOT_CONNECTED + liveSource, never fabricated dates
 *  - stateTransitions mark derivable-vs-live correctly
 *  - provenance: envelope timestamp === FIXED
 *  - determinism: same input → same output
 *  - read-only scan: no fetch/spawn/exec/eval/writeFile in src/timeline, no Date.now/new Date
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/index';
import { TimelineIntelligenceService } from '../src/timeline/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const fixedNow = (): string => FIXED;

const engine = createEngine();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makePkg(text: string) {
  return buildEngineeringPackage(engine, { text }, fixedNow);
}

// ── Read-only source scan ─────────────────────────────────────────────────────

test('src/timeline files contain no Date.now() calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  // Strip single-line comments, then check
  const noComments = src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  assert.ok(!noComments.includes('Date.now()'), 'No Date.now() in source');
});

test('src/timeline files contain no new Date() calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  const noComments = src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  assert.ok(!noComments.includes('new Date()'), 'No new Date() in source');
});

test('src/timeline files contain no fetch calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  assert.ok(!src.includes('fetch('), 'No fetch() in source');
});

test('src/timeline files contain no child_process/spawn/exec calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  assert.ok(!src.includes('child_process'), 'No child_process in source');
  assert.ok(!src.includes('spawn('), 'No spawn() in source');
  assert.ok(!src.includes('exec('), 'No exec() in source');
});

test('src/timeline files contain no eval calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  assert.ok(!src.includes('eval('), 'No eval() in source');
});

test('src/timeline files contain no writeFile calls', () => {
  const src = readFileSync(
    new URL('../src/timeline/TimelineIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  assert.ok(!src.includes('writeFile'), 'No writeFile in source');
});

// ── Constructor ────────────────────────────────────────────────────────────────

test('TimelineIntelligenceService constructs with engine + fixed now', () => {
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(svc instanceof TimelineIntelligenceService);
});

test('TimelineIntelligenceService constructs with engine only (defaultNow)', () => {
  const svc = new TimelineIntelligenceService(engine);
  assert.ok(svc instanceof TimelineIntelligenceService);
});

// ── milestones() ──────────────────────────────────────────────────────────────

test('milestones() returns an array', async () => {
  const pkg = await makePkg('Add Gift Card Support');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  assert.ok(Array.isArray(ms));
});

test('milestones() maps exactly pkg.graph.milestones (same count)', async () => {
  const pkg = await makePkg('Add Gift Card Support');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  assert.equal(ms.length, pkg.graph.milestones.length);
});

test('milestones() each milestone has id, title, tasks, gate', async () => {
  const pkg = await makePkg('Build Shipping Zones');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (const m of ms) {
    assert.ok(typeof m.id === 'string' && m.id.length > 0, `id present: ${m.id}`);
    assert.ok(typeof m.title === 'string' && m.title.length > 0, `title present: ${m.title}`);
    assert.ok(Array.isArray(m.tasks), 'tasks is array');
    assert.ok(typeof m.gate === 'string' && m.gate.length > 0, `gate present: ${m.gate}`);
  }
});

test('milestones() ids match pkg.graph.milestones ids', async () => {
  const pkg = await makePkg('Build Shipping Zones');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  const expectedIds = pkg.graph.milestones.map((m) => m.id);
  const actualIds = ms.map((m) => m.id);
  assert.deepEqual(actualIds, expectedIds);
});

test('milestones() titles match pkg.graph.milestones titles', async () => {
  const pkg = await makePkg('Build Shipping Zones');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (let i = 0; i < ms.length; i++) {
    assert.equal(ms[i].title, pkg.graph.milestones[i].title);
  }
});

test('milestones() gates match pkg.graph.milestones gates', async () => {
  const pkg = await makePkg('Build Order Fulfillment');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (let i = 0; i < ms.length; i++) {
    assert.equal(ms[i].gate, pkg.graph.milestones[i].gate);
  }
});

test('milestones() task arrays match pkg.graph.milestones tasks', async () => {
  const pkg = await makePkg('Build Order Fulfillment');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (let i = 0; i < ms.length; i++) {
    assert.deepEqual([...ms[i].tasks], [...pkg.graph.milestones[i].tasks]);
  }
});

test('milestones() connection is NOT_CONNECTED (actual timestamps not wired)', async () => {
  const pkg = await makePkg('Add GST Filing');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (const m of ms) {
    assert.equal(m.connection, 'NOT_CONNECTED', `${m.id} connection`);
  }
});

test('milestones() liveSource is set (names the would-be source)', async () => {
  const pkg = await makePkg('Add GST Filing');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  for (const m of ms) {
    assert.ok(typeof m.liveSource === 'string' && m.liveSource.length > 0, `liveSource set: ${m.id}`);
  }
});

test('milestones() is deterministic (same input → same output)', async () => {
  const pkg = await makePkg('Build Coupon Engine');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const a = svc.milestones(pkg);
  const b = svc.milestones(pkg);
  assert.deepEqual(a, b);
});

// ── executionTimeline() ───────────────────────────────────────────────────────

test('executionTimeline() returns same structure as milestones()', async () => {
  const pkg = await makePkg('Add Coupon Discounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const et = svc.executionTimeline(pkg);
  const ms = svc.milestones(pkg);
  assert.deepEqual(et, ms);
});

test('executionTimeline() count matches pkg.graph.milestones', async () => {
  const pkg = await makePkg('Add Coupon Discounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.executionTimeline(pkg).length, pkg.graph.milestones.length);
});

// ── criticalMoments() ─────────────────────────────────────────────────────────

test('criticalMoments() returns an array', async () => {
  const pkg = await makePkg('Build Webhook System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const cm = svc.criticalMoments(pkg);
  assert.ok(Array.isArray(cm));
});

test('criticalMoments() is a subset of milestones()', async () => {
  const pkg = await makePkg('Build Webhook System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const ms = svc.milestones(pkg);
  const cm = svc.criticalMoments(pkg);
  const msIds = new Set(ms.map((m) => m.id));
  for (const m of cm) {
    assert.ok(msIds.has(m.id), `Critical moment ${m.id} is a real milestone`);
  }
});

test('criticalMoments() each has at least one task on criticalPath', async () => {
  const pkg = await makePkg('Build Webhook System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const cm = svc.criticalMoments(pkg);
  const critSet = new Set(pkg.graph.criticalPath);
  for (const m of cm) {
    const hasCritical = m.tasks.some((tid) => critSet.has(tid));
    assert.ok(hasCritical, `${m.id} has a critical-path task`);
  }
});

test('criticalMoments() does not include milestones with no critical tasks', async () => {
  const pkg = await makePkg('Build Webhook System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const cm = svc.criticalMoments(pkg);
  const critSet = new Set(pkg.graph.criticalPath);
  const cmIds = new Set(cm.map((m) => m.id));
  for (const m of svc.milestones(pkg)) {
    const hasCritical = m.tasks.some((tid) => critSet.has(tid));
    if (!hasCritical) {
      assert.ok(!cmIds.has(m.id), `Non-critical milestone ${m.id} excluded from criticalMoments`);
    }
  }
});

test('criticalMoments() count ≤ milestones() count', async () => {
  const pkg = await makePkg('Build Inventory System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(svc.criticalMoments(pkg).length <= svc.milestones(pkg).length);
});

test('criticalMoments() is deterministic', async () => {
  const pkg = await makePkg('Build Inventory System');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.deepEqual(svc.criticalMoments(pkg), svc.criticalMoments(pkg));
});

// ── stateTransitions() ────────────────────────────────────────────────────────

test('stateTransitions() returns an array', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  assert.ok(Array.isArray(st));
});

test('stateTransitions() has at least 2 entries', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(svc.stateTransitions(pkg).length >= 2);
});

test('stateTransitions() PLANNED→READY is CONNECTED', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'PLANNED' && t.to === 'READY');
  assert.ok(edge, 'PLANNED→READY edge present');
  assert.equal(edge!.connection, 'CONNECTED');
  assert.equal(edge!.liveSource, null);
});

test('stateTransitions() PLANNED→BLOCKED is CONNECTED', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'PLANNED' && t.to === 'BLOCKED');
  assert.ok(edge, 'PLANNED→BLOCKED edge present');
  assert.equal(edge!.connection, 'CONNECTED');
  assert.equal(edge!.liveSource, null);
});

test('stateTransitions() READY→RUNNING is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'READY' && t.to === 'RUNNING');
  assert.ok(edge, 'READY→RUNNING edge present');
  assert.equal(edge!.connection, 'NOT_CONNECTED');
  assert.ok(typeof edge!.liveSource === 'string' && edge!.liveSource.length > 0);
});

test('stateTransitions() RUNNING→COMPLETED is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Add Payment Gateway');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'RUNNING' && t.to === 'COMPLETED');
  assert.ok(edge, 'RUNNING→COMPLETED edge present');
  assert.equal(edge!.connection, 'NOT_CONNECTED');
  assert.ok(typeof edge!.liveSource === 'string' && edge!.liveSource.length > 0);
});

test('stateTransitions() RUNNING→FAILED is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'RUNNING' && t.to === 'FAILED');
  assert.ok(edge, 'RUNNING→FAILED edge present');
  assert.equal(edge!.connection, 'NOT_CONNECTED');
});

test('stateTransitions() VERIFIED→COMPLETED is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'VERIFIED' && t.to === 'COMPLETED');
  assert.ok(edge, 'VERIFIED→COMPLETED edge present');
  assert.equal(edge!.connection, 'NOT_CONNECTED');
});

test('stateTransitions() every NOT_CONNECTED edge has a non-null liveSource', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  for (const t of st) {
    if (t.connection === 'NOT_CONNECTED') {
      assert.ok(typeof t.liveSource === 'string' && t.liveSource.length > 0, `liveSource on ${t.from}→${t.to}`);
    }
  }
});

test('stateTransitions() every entry has from, to, note, connection, liveSource', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  for (const t of st) {
    assert.ok('from' in t, 'from');
    assert.ok('to' in t, 'to');
    assert.ok(typeof t.note === 'string' && t.note.length > 0, 'note non-empty');
    assert.ok(t.connection === 'CONNECTED' || t.connection === 'NOT_CONNECTED', 'connection valid');
    assert.ok('liveSource' in t, 'liveSource field present');
  }
});

test('stateTransitions() PLANNED→READY note mentions readyCount from pkg', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'PLANNED' && t.to === 'READY');
  assert.ok(edge!.note.includes(String(pkg.graph.parallelizable.length)));
});

test('stateTransitions() PLANNED→BLOCKED note mentions blockedCount from pkg', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const st = svc.stateTransitions(pkg);
  const edge = st.find((t) => t.from === 'PLANNED' && t.to === 'BLOCKED');
  assert.ok(edge!.note.includes(String(pkg.graph.blocked.length)));
});

test('stateTransitions() is deterministic', async () => {
  const pkg = await makePkg('Add Refunds');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.deepEqual(svc.stateTransitions(pkg), svc.stateTransitions(pkg));
});

// ── durationAnalysis() ────────────────────────────────────────────────────────

test('durationAnalysis() is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const da = svc.durationAnalysis(pkg);
  assert.equal(da.connection, 'NOT_CONNECTED');
});

test('durationAnalysis() totalDuration is null (no history)', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.durationAnalysis(pkg).totalDuration, null);
});

test('durationAnalysis() averageDurationPerTask is null (no history)', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.durationAnalysis(pkg).averageDurationPerTask, null);
});

test('durationAnalysis() criticalPathDuration is null (no history)', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.durationAnalysis(pkg).criticalPathDuration, null);
});

test('durationAnalysis() totalTasks matches pkg.tasks.length (CONNECTED)', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.durationAnalysis(pkg).totalTasks, pkg.tasks.length);
});

test('durationAnalysis() liveSource is set', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const da = svc.durationAnalysis(pkg);
  assert.ok(typeof da.liveSource === 'string' && da.liveSource.length > 0);
});

test('durationAnalysis() note is a non-empty string', async () => {
  const pkg = await makePkg('Build Analytics Dashboard');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(typeof svc.durationAnalysis(pkg).note === 'string');
});

// ── historicalView() ──────────────────────────────────────────────────────────

test('historicalView() is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.historicalView(pkg).connection, 'NOT_CONNECTED');
});

test('historicalView() previousRuns is null (no store wired)', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.historicalView(pkg).previousRuns, null);
});

test('historicalView() velocityData is null (no store wired)', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.historicalView(pkg).velocityData, null);
});

test('historicalView() taskCount matches pkg.tasks.length', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.historicalView(pkg).taskCount, pkg.tasks.length);
});

test('historicalView() liveSource is set', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(typeof svc.historicalView(pkg).liveSource === 'string');
});

test('historicalView() note mentions execution-history store', async () => {
  const pkg = await makePkg('Build Customer Portal');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.ok(svc.historicalView(pkg).note.toLowerCase().includes('execution-history'));
});

// ── generateTimelineReport() ──────────────────────────────────────────────────

test('generateTimelineReport() returns a TimelineReport shape', async () => {
  const pkg = await makePkg('Add Product Reviews');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok('milestones' in rpt, 'milestones');
  assert.ok('criticalPath' in rpt, 'criticalPath');
  assert.ok('stateTransitions' in rpt, 'stateTransitions');
  assert.ok('summary' in rpt, 'summary');
  assert.ok('evidence' in rpt, 'evidence');
  assert.ok('confidence' in rpt, 'confidence');
  assert.ok('sources' in rpt, 'sources');
  assert.ok('timestamp' in rpt, 'timestamp');
  assert.ok('liveConnected' in rpt, 'liveConnected');
});

test('generateTimelineReport() timestamp === FIXED (envelope uses injected now)', async () => {
  const pkg = await makePkg('Add Product Reviews');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.generateTimelineReport(pkg).timestamp, FIXED);
});

test('generateTimelineReport() liveConnected is false', async () => {
  const pkg = await makePkg('Add Product Reviews');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  assert.equal(svc.generateTimelineReport(pkg).liveConnected, false);
});

test('generateTimelineReport() milestones count matches pkg.graph.milestones', async () => {
  const pkg = await makePkg('Add Staff Accounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.equal(rpt.milestones.length, pkg.graph.milestones.length);
});

test('generateTimelineReport() criticalPath matches pkg.graph.criticalPath', async () => {
  const pkg = await makePkg('Add Staff Accounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.deepEqual([...rpt.criticalPath], [...pkg.graph.criticalPath]);
});

test('generateTimelineReport() stateTransitions is non-empty', async () => {
  const pkg = await makePkg('Add Staff Accounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(rpt.stateTransitions.length > 0);
});

test('generateTimelineReport() stateTransitions entries have from, to, note', async () => {
  const pkg = await makePkg('Add Staff Accounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  for (const t of rpt.stateTransitions) {
    assert.ok('from' in t, 'from');
    assert.ok('to' in t, 'to');
    assert.ok(typeof t.note === 'string' && t.note.length > 0, 'note');
  }
});

test('generateTimelineReport() stateTransitions embed connection label in note', async () => {
  const pkg = await makePkg('Add Staff Accounts');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  for (const t of rpt.stateTransitions) {
    assert.ok(
      t.note.includes('[CONNECTED]') || t.note.includes('[NOT_CONNECTED]'),
      `Note must embed connection label: "${t.note}"`,
    );
  }
});

test('generateTimelineReport() evidence is non-empty', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(rpt.evidence.length > 0);
});

test('generateTimelineReport() confidence > 0 (has CONNECTED evidence)', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(rpt.confidence > 0 && rpt.confidence <= 0.9);
});

test('generateTimelineReport() sources is non-empty array', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(Array.isArray(rpt.sources) && rpt.sources.length > 0);
});

test('generateTimelineReport() summary mentions feature name', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(rpt.summary.includes('Add Loyalty Points'));
});

test('generateTimelineReport() summary mentions NOT_CONNECTED for durations', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.ok(rpt.summary.includes('NOT_CONNECTED'));
});

test('generateTimelineReport() request matches pkg.request', async () => {
  const pkg = await makePkg('Add Loyalty Points');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  assert.deepEqual(rpt.request, pkg.request);
});

test('generateTimelineReport() is deterministic (same input → same output)', async () => {
  const pkg = await makePkg('Build Storefront Theme');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const a = svc.generateTimelineReport(pkg);
  const b = svc.generateTimelineReport(pkg);
  assert.equal(a.timestamp, b.timestamp);
  assert.equal(a.milestones.length, b.milestones.length);
  assert.equal(a.criticalPath.length, b.criticalPath.length);
  assert.equal(a.summary, b.summary);
  assert.equal(a.confidence, b.confidence);
});

test('generateTimelineReport() milestone ids in report match pkg.graph.milestones ids', async () => {
  const pkg = await makePkg('Build Storefront Theme');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  const expectedIds = pkg.graph.milestones.map((m) => m.id);
  const actualIds = rpt.milestones.map((m) => m.id);
  assert.deepEqual(actualIds, expectedIds);
});

test('generateTimelineReport() milestone connections are NOT_CONNECTED (no execution history)', async () => {
  const pkg = await makePkg('Build Storefront Theme');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  for (const m of rpt.milestones) {
    assert.equal(m.connection, 'NOT_CONNECTED', `${m.id} connection`);
  }
});

test('generateTimelineReport() milestone liveSource is set on every milestone', async () => {
  const pkg = await makePkg('Build Storefront Theme');
  const svc = new TimelineIntelligenceService(engine, fixedNow);
  const rpt = svc.generateTimelineReport(pkg);
  for (const m of rpt.milestones) {
    assert.ok(typeof m.liveSource === 'string' && m.liveSource.length > 0, m.id);
  }
});
