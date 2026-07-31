/**
 * LivePlatform — the unified read-only operational state over the adapters.
 * Aggregates health/status, runs adapter verification, and powers investigate() by
 * feeding collected LiveFacts into the CorrelationEngine (all reasoning in lcis-core).
 * No mutations; no new intelligence.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import {
  type AdapterHealthState,
  AdapterHealthMonitor,
  type AdapterStatus,
  type AdapterVerification,
  CorrelationEngine,
  type LiveAdapter,
  type LiveFact,
  SnapshotStore,
} from '@letbuyy/lcis-adapters';
import type { AdapterListing, Investigation, LiveHealth, LiveStatus } from './types';

function computeOverall(statuses: readonly AdapterStatus[]): AdapterStatus {
  if (statuses.length === 0) return 'NOT_CONNECTED';
  if (statuses.every((s) => s === 'CONNECTED')) return 'CONNECTED';
  if (statuses.every((s) => s === 'NOT_CONNECTED')) return 'NOT_CONNECTED';
  if (statuses.some((s) => s === 'CONNECTED')) return 'DEGRADED';
  return 'ERROR';
}

export class LivePlatform {
  private readonly correlation: CorrelationEngine;
  private readonly snapshots: SnapshotStore;
  private readonly monitor = new AdapterHealthMonitor();

  constructor(
    private readonly liveAdapters: readonly LiveAdapter[],
    engine: LcisEngine,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.correlation = new CorrelationEngine(engine);
    this.snapshots = new SnapshotStore();
  }

  adapter(name: string): LiveAdapter | undefined {
    return this.liveAdapters.find((a) => a.metadata().name === name);
  }

  adapters(): AdapterListing[] {
    return this.liveAdapters.map((a) => ({ name: a.metadata().name, metadata: a.metadata() }));
  }

  async health(): Promise<LiveHealth> {
    const results = await Promise.all(this.liveAdapters.map((a) => a.health()));
    for (const r of results) this.monitor.record(r.adapter, r.status, r.latencyMs, r.checkedAt);
    return { adapters: results, overall: computeOverall(results.map((r) => r.status)), generatedAt: this.now() };
  }

  async status(): Promise<LiveStatus> {
    const snaps = await Promise.all(
      this.liveAdapters.map(async (a) => {
        const key = a.metadata().name;
        const cached = this.snapshots.get(key);
        if (cached) return cached;
        const s = await a.collect();
        this.snapshots.set(key, s);
        this.monitor.record(s.adapter, s.status, null, s.timestamp);
        return s;
      }),
    );
    return { adapters: snaps, generatedAt: this.now() };
  }

  async verify(name?: string): Promise<AdapterVerification[]> {
    const targets = name ? this.liveAdapters.filter((a) => a.metadata().name === name) : this.liveAdapters;
    return Promise.all(targets.map((a) => a.verify()));
  }

  /** Correlate a subject's structural blast radius (lcis-core) with collected live facts. */
  async investigate(subject: string): Promise<Investigation> {
    const status = await this.status();
    const facts: LiveFact[] = [];
    const contributing = new Set<string>();
    const notConnected: string[] = [];
    for (const snap of status.adapters) {
      if (snap.status === 'CONNECTED') {
        const payloadFacts = (snap.payload as { facts?: LiveFact[] } | null)?.facts;
        if (Array.isArray(payloadFacts)) {
          facts.push(...payloadFacts);
          contributing.add(snap.adapter);
        }
      } else if (snap.status === 'NOT_CONNECTED') {
        notConnected.push(snap.adapter);
      }
    }
    const correlation = await this.correlation.correlate(subject, facts);
    return {
      subject,
      correlation,
      contributingAdapters: [...contributing],
      notConnected,
      evidence: [...correlation.evidence],
      generatedAt: this.now(),
    };
  }

  observability(): AdapterHealthState[] {
    return this.monitor.all();
  }
}
