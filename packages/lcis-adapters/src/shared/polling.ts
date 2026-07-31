/**
 * PollingFramework — a caller-driven, deterministic poll scheduler. NO setInterval, NO
 * timers, NO background work: the HOST decides when time passes by calling tick(nowMs).
 * On each tick, adapters whose interval has elapsed are read (through the read-through
 * cache and the rate limiter) and their results recorded in the health monitor. The
 * framework can therefore be replayed byte-for-byte in tests with a scripted clock.
 */
import type { AdapterSnapshot, LiveAdapter } from './contracts';
import { ReadThroughCache } from './cache';
import { AdapterHealthMonitor } from './health-monitor';
import { RateLimitManager } from './rate-limit';

export interface PollEntry {
  readonly adapter: LiveAdapter;
  readonly intervalMs: number;
}

export interface PollResult {
  readonly adapter: string;
  readonly ran: boolean;
  /** Why a due adapter did not run (rate-limited) or null. */
  readonly skipped: 'rate-limited' | null;
  readonly cache: 'HIT' | 'MISS' | null;
  readonly snapshot: AdapterSnapshot | null;
}

export interface TickReport {
  readonly atMs: number;
  readonly due: readonly string[];
  readonly results: readonly PollResult[];
}

export class PollingFramework {
  private readonly entries = new Map<string, PollEntry>();
  private readonly lastRunMs = new Map<string, number>();

  constructor(
    private readonly cache: ReadThroughCache = new ReadThroughCache(),
    private readonly rateLimiter: RateLimitManager = new RateLimitManager(),
    private readonly health: AdapterHealthMonitor = new AdapterHealthMonitor(),
  ) {}

  schedule(adapter: LiveAdapter, intervalMs: number): void {
    const name = adapter.metadata().name;
    if (this.entries.has(name)) {
      throw new Error(`lcis-adapters: adapter '${name}' is already scheduled`);
    }
    if (intervalMs <= 0) {
      throw new Error(`lcis-adapters: intervalMs must be positive for '${name}'`);
    }
    this.entries.set(name, { adapter, intervalMs });
  }

  scheduled(): readonly string[] {
    return [...this.entries.keys()].sort();
  }

  /** Adapters due at nowMs (never run, or interval elapsed since their last run). */
  due(nowMs: number): readonly string[] {
    return this.scheduled().filter((name) => {
      const last = this.lastRunMs.get(name);
      const entry = this.entries.get(name)!;
      return last === undefined || nowMs - last >= entry.intervalMs;
    });
  }

  /** Run one deterministic poll pass at nowMs. The host owns the clock. */
  async tick(nowMs: number): Promise<TickReport> {
    const due = this.due(nowMs);
    const results: PollResult[] = [];
    for (const name of due) {
      const entry = this.entries.get(name)!;
      if (!this.rateLimiter.tryAcquire(name)) {
        results.push({ adapter: name, ran: false, skipped: 'rate-limited', cache: null, snapshot: null });
        continue;
      }
      const read = await this.cache.collect(entry.adapter);
      this.lastRunMs.set(name, nowMs);
      this.health.record(name, read.snapshot.status, null, read.snapshot.timestamp);
      results.push({ adapter: name, ran: true, skipped: null, cache: read.cache, snapshot: read.snapshot });
    }
    return { atMs: nowMs, due, results };
  }

  healthStates(): ReturnType<AdapterHealthMonitor['all']> {
    return this.health.all();
  }
}
