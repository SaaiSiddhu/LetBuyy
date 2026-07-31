/**
 * QualityAnalyticsEngine — the LQAS composition facade. Assembles test/coverage/mutation/
 * flaky analytics (engineering + honest NOT_CONNECTED live values), complexity (graph fan/
 * degree), architecture quality + maintainability (twin), technical debt (churn × complexity),
 * doc/API quality, and the deterministic composite quality score + advisory recommendations.
 * Pure composition — no new intelligence, no mutation, advisory-only.
 */
import { type LcisEngine, evidence, getEngine } from '@letbuyy/lcis-core';
import { ArchitectureQualityService } from './architecture/index';
import { ComplexityService } from './complexity/index';
import { DocApiQualityService } from './docapi/index';
import { QualityScoreService } from './score/index';
import {
  defaultNow,
  quality,
  type QualityReport,
} from './shared/index';
import { TechDebtService } from './techdebt/index';
import { TestAnalyticsService } from './test/index';

export interface QualityAnalyticsEngine {
  readonly core: LcisEngine;
  readonly test: TestAnalyticsService;
  readonly complexity: ComplexityService;
  readonly architecture: ArchitectureQualityService;
  readonly techDebt: TechDebtService;
  readonly docapi: DocApiQualityService;
  readonly score: QualityScoreService;
  generateQualityReport(): QualityReport;
}

export interface QualityAnalyticsEngineOptions {
  readonly core?: LcisEngine;
  readonly now?: () => string;
}

class QualityAnalyticsEngineImpl implements QualityAnalyticsEngine {
  readonly core: LcisEngine;
  readonly test: TestAnalyticsService;
  readonly complexity: ComplexityService;
  readonly architecture: ArchitectureQualityService;
  readonly techDebt: TechDebtService;
  readonly docapi: DocApiQualityService;
  readonly score: QualityScoreService;
  private readonly now: () => string;

  constructor(opts: QualityAnalyticsEngineOptions = {}) {
    this.core = opts.core ?? getEngine();
    this.now = opts.now ?? defaultNow;
    const core = this.core;
    const now = this.now;
    this.test = new TestAnalyticsService(core, now);
    this.complexity = new ComplexityService(core, now);
    this.architecture = new ArchitectureQualityService(core, now);
    this.techDebt = new TechDebtService(core, now);
    this.docapi = new DocApiQualityService(core, now);
    this.score = new QualityScoreService();
  }

  /** The LQAS flagship: the unified quality-analytics report. */
  generateQualityReport(): QualityReport {
    const test = this.test.analyze();
    const coverage = this.test.coverage();
    const mutation = this.test.mutation();
    const flaky = this.test.flaky();
    const complexity = this.complexity.analyze();
    const architecture = this.architecture.analyze();
    const maintainability = this.architecture.maintainability();
    const techDebt = this.techDebt.hotspots();
    const docs = this.docapi.docs();
    const api = this.docapi.api();

    const scored = this.score.score({
      coverageGaps: coverage.gaps,
      architecture,
      complexity,
      techDebt,
      docs,
      api,
      coverageConnected: coverage.connection === 'CONNECTED',
    });

    const summary =
      `Quality analytics: quality score ${scored.score.score}/100 (${scored.score.band}), ` +
      `health ${scored.health.band}${scored.health.score !== null ? ` (${scored.health.score})` : ''}; ` +
      `${architecture.cycleCount} cycle(s), ${architecture.spofCount} SPOF(s), ` +
      `${complexity.entries.length} complexity entr(ies), ${techDebt.length} debt hotspot(s), ` +
      `doc coverage ${(docs.ratio * 100).toFixed(0)}%; ${scored.recommendations.length} advisory recommendation(s). ` +
      `Coverage/mutation/flaky values NOT_CONNECTED — structural quality only.`;

    return quality(
      {
        test,
        coverage,
        mutation,
        flaky,
        docs,
        api,
        complexity,
        architecture,
        maintainability,
        techDebt,
        score: scored.score,
        health: scored.health,
        recommendations: scored.recommendations,
        summary,
      },
      {
        evidence: [
          evidence('artifact-field', 'lcis-quality:report', `score ${scored.score.score}, ${techDebt.length} debt hotspot(s)`, 'packages/lcis-quality'),
          ...architecture.findings.slice(0, 3).flatMap((f) => [...f.evidence].slice(0, 1)),
        ],
        liveConnected: false,
        now: this.now,
      },
    );
  }
}

export function createQualityAnalyticsEngine(opts?: QualityAnalyticsEngineOptions): QualityAnalyticsEngine {
  return new QualityAnalyticsEngineImpl(opts);
}

let shared: QualityAnalyticsEngine | null = null;

/** Process-wide singleton LQAS engine. */
export function getQualityAnalyticsEngine(opts?: QualityAnalyticsEngineOptions): QualityAnalyticsEngine {
  if (shared === null) shared = createQualityAnalyticsEngine(opts);
  return shared;
}

/** Reset the singleton (tests only). */
export function resetQualityAnalyticsEngine(): void {
  shared = null;
}
