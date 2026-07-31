/**
 * TelemetryNormalizer — turns artifact data + registry signals into normalized OperationalFacts
 * and honest LiveSignals. It never fabricates a value: a NOT_CONNECTED signal becomes a fact with
 * value=null and its exact env-var requirement carried through.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type { LiveSignal, OperationalArea, OperationalFact, OperationalSignal, OperationalStatus } from './types';

export class TelemetryNormalizer {
  fact(
    area: OperationalArea,
    kind: string,
    subject: string,
    detail: string,
    opts: { value?: number | string | null; status: OperationalStatus; at?: string | null; evidence: readonly Evidence[] },
  ): OperationalFact {
    return {
      area,
      kind,
      subject,
      detail,
      value: opts.value ?? null,
      status: opts.status,
      at: opts.at ?? null,
      evidence: opts.evidence,
    };
  }

  /** A registry signal → an honest LiveSignal (value null + status from the detectability matrix). */
  signalToLive(sig: OperationalSignal, evidence: readonly Evidence[]): LiveSignal {
    return {
      key: sig.key,
      area: sig.area,
      status: sig.detectability,
      value: null,
      requiresEnvVar: sig.requiresEnvVar,
      source: sig.liveSource ?? sig.dataSource,
      evidence,
    };
  }
}
