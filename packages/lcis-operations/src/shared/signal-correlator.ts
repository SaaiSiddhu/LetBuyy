/**
 * SignalCorrelator — correlates an operational subject to its blast radius by DELEGATING to
 * lcis-core's BlastRadiusService. LCOS does not reimplement blast/impact logic; it reuses it.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';

interface ImpactResult {
  domain: string;
  label: string;
  breaks: { domains: { count: number; list: string[] }; tables: string[]; workers: string[]; queues: string[] };
  risk: { money: boolean; tenant: boolean };
}

const isErr = (x: unknown): x is { error: string } =>
  typeof x === 'object' && x !== null && 'error' in x;

export interface CorrelationResult {
  readonly subject: string;
  readonly impactedDomains: number;
  readonly affected: readonly string[];
  readonly tables: readonly string[];
  readonly workers: readonly string[];
  readonly queues: readonly string[];
  readonly money: boolean;
  readonly tenant: boolean;
}

export class SignalCorrelator {
  constructor(private readonly core: LcisEngine) {}

  /** Correlate a domain-keyed operational subject to its blast radius (reuses lcis-core). */
  correlateDomain(domainKey: string): CorrelationResult | null {
    const imp = this.core.blast.impact(domainKey) as ImpactResult | { error: string };
    if (isErr(imp)) return null;
    return {
      subject: domainKey,
      impactedDomains: imp.breaks.domains.count,
      affected: imp.breaks.domains.list,
      tables: imp.breaks.tables,
      workers: imp.breaks.workers,
      queues: imp.breaks.queues,
      money: imp.risk.money,
      tenant: imp.risk.tenant,
    };
  }
}
