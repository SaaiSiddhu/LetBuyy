/**
 * ChangeTrackingEngine — the LCTS composition facade. Wires the lcis-core engine + the five
 * tracking services (timeline / diff / impact / rollback / history) and composes the flagship
 * TrackingReport. Pure composition — no new intelligence, no duplicated reasoning.
 *
 * LCTS tracks what DID change; it never mutates, executes, or fabricates. Live change feeds
 * (commits/PRs/deployments) are honestly NOT_CONNECTED unless adapter LiveFacts are injected.
 */
import { type LcisEngine, evidence, getEngine, notConnected } from '@letbuyy/lcis-core';
import type { LiveFact } from '@letbuyy/lcis-adapters';
import { SemanticDiffService } from './diff/index';
import { HistoryService } from './history/index';
import { ImpactService } from './impact/index';
import { RollbackService } from './rollback/index';
import {
  TrackingRuleRegistry,
  defaultNow,
  tracking,
  type ChangeHistory,
  type ChangeImpact,
  type ChangeRecord,
  type ChangeRollback,
  type ChangeTimeline,
  type SemanticDiff,
  type SnapshotInventory,
  type TrackingFinding,
  type TrackingReport,
} from './shared/index';
import { TimelineService } from './timeline/index';

export interface TrackingEngine {
  readonly core: LcisEngine;
  readonly timeline: TimelineService;
  readonly diff: SemanticDiffService;
  readonly impact: ImpactService;
  readonly rollback: RollbackService;
  readonly history: HistoryService;
  generateTimeline(liveFacts?: readonly LiveFact[]): ChangeTimeline;
  generateDiff(before: SnapshotInventory, after: SnapshotInventory): SemanticDiff;
  generateImpact(record: ChangeRecord): ChangeImpact;
  generateRollback(record: ChangeRecord): ChangeRollback;
  generateHistory(subject: string, liveFacts?: readonly LiveFact[]): ChangeHistory;
  generateTrackingReport(liveFacts?: readonly LiveFact[]): TrackingReport;
}

export interface TrackingEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

/** Migration types that touch money paths — TR03 is a semantic rule over the record itself. */
const MONEY_MIGRATION_TYPES = new Set(['payment', 'refund', 'payout', 'gift-card', 'ledger']);

class ChangeTrackingEngineImpl implements TrackingEngine {
  readonly core: LcisEngine;
  readonly timeline: TimelineService;
  readonly diff: SemanticDiffService;
  readonly impact: ImpactService;
  readonly rollback: RollbackService;
  readonly history: HistoryService;
  private readonly now: () => string;
  private readonly rules = new TrackingRuleRegistry();

  constructor(opts: TrackingEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.timeline = new TimelineService(core, now);
    this.diff = new SemanticDiffService(core, now);
    this.impact = new ImpactService(core, now);
    this.rollback = new RollbackService(core, now);
    this.history = new HistoryService(core, now);
  }

  generateTimeline(liveFacts: readonly LiveFact[] = []): ChangeTimeline {
    return this.timeline.buildTimeline(liveFacts);
  }
  generateDiff(before: SnapshotInventory, after: SnapshotInventory): SemanticDiff {
    return this.diff.diff(before, after);
  }
  generateImpact(record: ChangeRecord): ChangeImpact {
    return this.impact.impactOf(record);
  }
  generateRollback(record: ChangeRecord): ChangeRollback {
    return this.rollback.rollbackOf(record);
  }
  generateHistory(subject: string, liveFacts: readonly LiveFact[] = []): ChangeHistory {
    return this.history.historyOf(subject, this.timeline.buildTimeline(liveFacts));
  }

  /** The LCTS flagship: timeline + semantic findings (TR01/TR03/TR06) + history anchors. */
  generateTrackingReport(liveFacts: readonly LiveFact[] = []): TrackingReport {
    const timeline = this.generateTimeline(liveFacts);
    const findings: TrackingFinding[] = [];

    // TR01 — stale/missing structural artifacts (from inventory evidence).
    const inv = this.diff.currentInventory();
    const missing = inv.evidence.filter((e) => e.kind === 'not-connected');
    for (const [i, e] of missing.entries()) {
      const rule = this.rules.get('TR01')!;
      findings.push({
        id: `TR01-${i + 1}`,
        rule: rule.id,
        severity: rule.severity,
        subject: e.ref,
        title: rule.title,
        detail: `Structural artifact unavailable — ${e.detail ?? e.source ?? 'unknown source'}. The timeline and diffs are partial until it is refreshed.`,
        connection: 'NOT_CONNECTED',
        evidence: [e],
      });
    }

    // TR03 — money-path migrations (semantic rule over the record's own type; no re-modeling).
    const moneyRecords = timeline.records.filter(
      (r) => r.kind === 'migration' && [...MONEY_MIGRATION_TYPES].some((t) => r.detail.toLowerCase().includes(t)),
    );
    for (const [i, r] of moneyRecords.slice(0, 10).entries()) {
      const rule = this.rules.get('TR03')!;
      findings.push({
        id: `TR03-${i + 1}`,
        rule: rule.id,
        severity: rule.severity,
        subject: r.subject,
        title: rule.title,
        detail: `${r.detail} — money-path migration; the canonical-ledger rules apply to any follow-up change.`,
        connection: 'CONNECTED',
        evidence: [...r.evidence],
      });
    }

    // TR06 — live change feeds disconnected.
    for (const [i, feed] of timeline.notConnectedFeeds.entries()) {
      const rule = this.rules.get('TR06')!;
      findings.push({
        id: `TR06-${i + 1}`,
        rule: rule.id,
        severity: rule.severity,
        subject: feed.feed,
        title: rule.title,
        detail: `Live feed '${feed.feed}' is NOT_CONNECTED — source: ${feed.source}.`,
        connection: 'NOT_CONNECTED',
        evidence: [notConnected(feed.feed, feed.source)],
      });
    }

    const migrations = timeline.records.filter((r) => r.kind === 'migration');
    const latest = migrations
      .map((r) => ({ n: Number(r.id.replace('migration-', '')), file: r.subject }))
      .filter((m) => Number.isFinite(m.n))
      .sort((a, b) => b.n - a.n)[0] ?? null;
    const decisionCount = timeline.records.filter((r) => r.kind === 'decision').length;

    const summary =
      `Tracking report: ${timeline.records.length} change record(s) (${migrations.length} migrations, ` +
      `${decisionCount} decisions), ${findings.length} finding(s); latest migration ` +
      `${latest ? `${latest.n} (${latest.file})` : 'unknown'}. ` +
      (timeline.notConnectedFeeds.length > 0
        ? `${timeline.notConnectedFeeds.length} live feed(s) NOT_CONNECTED — structural history only.`
        : 'Live change feeds connected.');

    return tracking(
      { timeline, findings, latestMigration: latest, decisionCount, summary },
      {
        evidence: [
          evidence('artifact-field', 'lcis-tracking:timeline', `${timeline.records.length} records composed`, 'graphify-out/memory-intel.json'),
          ...missing,
        ],
        liveConnected: timeline.liveConnected,
        now: this.now,
      },
    );
  }
}

export function createTrackingEngine(opts?: TrackingEngineOptions): TrackingEngine {
  return new ChangeTrackingEngineImpl(opts);
}

let shared: TrackingEngine | null = null;

/** Process-wide singleton LCTS engine (reuses the lcis-core singleton + its warm graph). */
export function getTrackingEngine(opts?: TrackingEngineOptions): TrackingEngine {
  if (shared === null) shared = createTrackingEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetTrackingEngine(): void {
  shared = null;
}
