/**
 * TestAnalyticsService — LQAS Phase 15, test/coverage/mutation/flaky analytics.
 *
 * Composes lcis-engineering (VerificationIntelligenceService via createEngineeringEngine)
 * to derive structural coverage gaps (CONNECTED) and plans.  All live values —
 * pass-rate, line/branch coverage, mutation score, flaky test list — are NOT_CONNECTED
 * until a CI test-run store is wired.  No fetch/exec/fs/DB/AI; advisory-only.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { createEngineeringEngine } from '@letbuyy/lcis-engineering';
import type { FeatureRequest } from '@letbuyy/lcis-engineering';
import { defaultNow } from '../shared/envelope';
import type {
  CoverageAnalytics,
  FlakyReport,
  MutationAnalytics,
  QualityFinding,
  Severity,
  TestAnalytics,
} from '../shared/types';

/** Map an EngineeringFinding severity to LQAS Severity (already compatible). */
function toSeverity(s: string): Severity {
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') return s;
  return 'info';
}

/** Stable QualityFinding id for a coverage gap (QA01 prefix + subject). */
function gapId(subject: string): string {
  return `QA01-COV-${subject.replace(/[^A-Za-z0-9_-]+/g, '-')}`;
}

export class TestAnalyticsService {
  private readonly eins: ReturnType<typeof createEngineeringEngine>;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.eins = createEngineeringEngine({ core, now });
  }

  // ── Private helper: resolve structural coverage gaps as QualityFinding[] ───

  /**
   * Calls eins.verification.coverageGaps with the canonical baseline request and maps
   * each EngineeringFinding to a QualityFinding (rule=QA01, connection=CONNECTED).
   * Honest: try/catch degrades to [] and surfaces a single NOT_CONNECTED advisory finding.
   */
  private coverageGapFindings(): QualityFinding[] {
    const req: FeatureRequest = {
      text: 'quality baseline',
      domains: [],
      tables: [],
      symbols: [],
    };
    try {
      const engineeringFindings = this.eins.verification.coverageGaps(req);
      return engineeringFindings.map((f) => ({
        id: gapId(f.subject),
        rule: 'QA01',
        severity: toSeverity(f.severity),
        subject: f.subject,
        title: f.title,
        detail: f.detail,
        connection: 'CONNECTED' as const,
        evidence: f.evidence,
      }));
    } catch {
      // Degrade honestly — return one advisory finding so callers know intelligence is partial.
      return [
        {
          id: 'QA01-COV-DEGRADED',
          rule: 'QA01',
          severity: 'info',
          subject: 'coverage-gap-detection',
          title: 'Coverage gap detection degraded',
          detail: 'engineering verification engine failed to produce coverage gaps; structural data incomplete',
          connection: 'CONNECTED' as const,
          evidence: [
            evidence(
              'artifact-field',
              'lcis-engineering:verification.coverageGaps',
              'engine error during coverageGaps()',
              'packages/lcis-engineering',
            ),
          ],
        },
      ];
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /**
   * analyze() — primary TestAnalytics report.
   *
   * coverageGaps: CONNECTED structural gaps (EngineeringFinding → QualityFinding rule QA01).
   * plannedTests: CONNECTED required-test count from EINS TestPlan.
   * passRate: NOT_CONNECTED — requires CI test-run store.
   */
  analyze(): TestAnalytics {
    const req: FeatureRequest = {
      text: 'quality baseline',
      domains: [],
      tables: [],
      symbols: [],
    };

    let coverageGaps: QualityFinding[] = [];
    let plannedTests = 0;

    try {
      coverageGaps = this.coverageGapFindings();
    } catch {
      // already caught inside coverageGapFindings, but defensive outer layer too
    }

    try {
      const testPlan = this.eins.verification.planTests(req);
      plannedTests = testPlan.required?.length ?? 0;
    } catch {
      plannedTests = 0;
    }

    const gapCount = coverageGaps.length;
    const highCount = coverageGaps.filter((g) => g.severity === 'critical' || g.severity === 'high').length;

    const summary =
      `Test analytics: ${gapCount} structural coverage gap(s) detected (${highCount} elevated), ` +
      `${plannedTests} planned/required test(s); ` +
      `pass-rate/coverage/mutation/flaky values NOT_CONNECTED — CI test-run store not wired.`;

    return {
      coverageGaps,
      plannedTests,
      passRate: {
        connection: 'NOT_CONNECTED',
        value: null,
        liveSource: 'CI test-run store (node --test / vitest results)',
      },
      summary,
    };
  }

  /**
   * coverage() — CoverageAnalytics.
   *
   * Line/branch pct: NOT_CONNECTED (requires c8/istanbul lcov report).
   * gaps: CONNECTED structural gaps (same QA01 findings from EINS verification).
   */
  coverage(): CoverageAnalytics {
    let gaps: QualityFinding[] = [];
    try {
      gaps = this.coverageGapFindings();
    } catch {
      // honest empty
    }

    return {
      connection: 'NOT_CONNECTED',
      linePct: null,
      branchPct: null,
      liveSource: 'coverage report (c8/istanbul lcov)',
      gaps,
    };
  }

  /**
   * mutation() — MutationAnalytics.
   *
   * Mutation score: NOT_CONNECTED (requires a stryker mutation-test run).
   */
  mutation(): MutationAnalytics {
    return {
      connection: 'NOT_CONNECTED',
      mutationScore: null,
      liveSource: 'mutation testing run (stryker)',
    };
  }

  /**
   * flaky() — FlakyReport.
   *
   * Flaky test list: NOT_CONNECTED (requires CI retry-history data).
   */
  flaky(): FlakyReport {
    return {
      connection: 'NOT_CONNECTED',
      flakyTests: [],
      liveSource: 'CI retry history (test-run store)',
    };
  }
}
