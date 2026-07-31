/**
 * AdapterHealthMonitor — tracks latency / success rate / error rate / last sync per adapter.
 */
import type { AdapterStatus } from './contracts';

export interface AdapterHealthState {
  readonly adapter: string;
  readonly status: AdapterStatus | 'UNKNOWN';
  readonly lastSyncAt: string | null;
  readonly successCount: number;
  readonly errorCount: number;
  readonly successRate: number;
  readonly avgLatencyMs: number | null;
}

export class AdapterHealthMonitor {
  private readonly s = new Map<
    string,
    { status: AdapterStatus | 'UNKNOWN'; lastSyncAt: string | null; success: number; error: number; latencies: number[] }
  >();

  record(adapter: string, status: AdapterStatus, latencyMs: number | null, at: string): void {
    const e = this.s.get(adapter) ?? {
      status: 'UNKNOWN' as AdapterStatus | 'UNKNOWN',
      lastSyncAt: null as string | null,
      success: 0,
      error: 0,
      latencies: [] as number[],
    };
    e.status = status;
    e.lastSyncAt = at;
    if (status === 'CONNECTED') e.success++;
    else if (status === 'ERROR') e.error++;
    if (latencyMs !== null) {
      e.latencies.push(latencyMs);
      if (e.latencies.length > 50) e.latencies.shift();
    }
    this.s.set(adapter, e);
  }

  state(adapter: string): AdapterHealthState {
    const e = this.s.get(adapter);
    if (!e) {
      return {
        adapter,
        status: 'UNKNOWN',
        lastSyncAt: null,
        successCount: 0,
        errorCount: 0,
        successRate: 0,
        avgLatencyMs: null,
      };
    }
    const total = e.success + e.error;
    const avg = e.latencies.length
      ? Math.round((e.latencies.reduce((a, b) => a + b, 0) / e.latencies.length) * 100) / 100
      : null;
    return {
      adapter,
      status: e.status,
      lastSyncAt: e.lastSyncAt,
      successCount: e.success,
      errorCount: e.error,
      successRate: total === 0 ? 0 : Math.round((e.success / total) * 1000) / 1000,
      avgLatencyMs: avg,
    };
  }

  all(): AdapterHealthState[] {
    return [...this.s.keys()].map((k) => this.state(k));
  }
}
