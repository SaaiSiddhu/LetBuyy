/**
 * AdapterObservability — per-adapter, per-operation metrics over the read-only contract:
 * op counts, error counts, latency percentiles (bounded ring buffer), and the last error.
 * Composes the existing AuditLogger for the structured trail (no second logger) and never
 * records credential values. Purely in-memory; nothing is exported off-process.
 */
import { AuditLogger, type AdapterOp } from './audit';

export interface OpMetrics {
  readonly adapter: string;
  readonly op: AdapterOp;
  readonly count: number;
  readonly errorCount: number;
  readonly p50LatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  readonly lastError: string | null;
  readonly lastAt: string | null;
}

const RING_SIZE = 100;

function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx]!;
}

export class AdapterObservability {
  private readonly metrics = new Map<
    string,
    { count: number; errorCount: number; latencies: number[]; lastError: string | null; lastAt: string | null }
  >();

  constructor(private readonly audit: AuditLogger = new AuditLogger()) {}

  private key(adapter: string, op: AdapterOp): string {
    return `${adapter}:${op}`;
  }

  /** Record one operation. `error` is a message only — never a credential or payload. */
  record(adapter: string, op: AdapterOp, latencyMs: number | null, at: string, error?: string): void {
    const k = this.key(adapter, op);
    const m = this.metrics.get(k) ?? {
      count: 0,
      errorCount: 0,
      latencies: [] as number[],
      lastError: null as string | null,
      lastAt: null as string | null,
    };
    m.count++;
    m.lastAt = at;
    if (error !== undefined) {
      m.errorCount++;
      m.lastError = error;
    }
    if (latencyMs !== null) {
      m.latencies.push(latencyMs);
      if (m.latencies.length > RING_SIZE) m.latencies.shift();
    }
    this.metrics.set(k, m);
    this.audit.record(adapter, op, {
      latencyMs,
      error: error ?? null,
      count: m.count,
      errorCount: m.errorCount,
    });
  }

  of(adapter: string, op: AdapterOp): OpMetrics {
    const m = this.metrics.get(this.key(adapter, op));
    if (!m) {
      return { adapter, op, count: 0, errorCount: 0, p50LatencyMs: null, p95LatencyMs: null, lastError: null, lastAt: null };
    }
    const sorted = [...m.latencies].sort((a, b) => a - b);
    return {
      adapter,
      op,
      count: m.count,
      errorCount: m.errorCount,
      p50LatencyMs: percentile(sorted, 50),
      p95LatencyMs: percentile(sorted, 95),
      lastError: m.lastError,
      lastAt: m.lastAt,
    };
  }

  all(): readonly OpMetrics[] {
    return [...this.metrics.keys()].sort().map((k) => {
      const [adapter, op] = k.split(':') as [string, AdapterOp];
      return this.of(adapter, op);
    });
  }
}
