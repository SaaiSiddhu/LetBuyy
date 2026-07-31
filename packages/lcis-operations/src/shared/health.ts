/**
 * OperationalHealthCalculator — derives area health from structural findings + live-signal
 * connection. Structural (CONNECTED) findings drive the score; live telemetry connection is
 * reported separately. Honest: when nothing structural is known AND no live signal is connected,
 * the score is null and the band is 'unknown' (LCOS will not invent a health number).
 */
import type { HealthBand, LiveSignal, OperationalArea, OperationalFinding, OperationalHealth, Severity } from './types';

const SEV_PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 6, low: 2, info: 0 };

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export class OperationalHealthCalculator {
  forArea(
    area: OperationalArea | 'overall',
    findings: readonly OperationalFinding[],
    signals: readonly LiveSignal[],
  ): OperationalHealth {
    const connectedSignals = signals.filter((s) => s.status === 'CONNECTED').length;
    const notConnectedSignals = signals.filter((s) => s.status !== 'CONNECTED').length;
    const penalty = findings
      .filter((f) => f.status === 'CONNECTED')
      .reduce((a, f) => a + (SEV_PENALTY[f.severity] ?? 0), 0);
    const blind = connectedSignals === 0 && findings.length === 0;
    const score = blind ? null : clamp(100 - penalty);
    const band: HealthBand = score === null ? 'unknown' : score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'failing';
    return { area, score, band, connectedSignals, notConnectedSignals };
  }
}
