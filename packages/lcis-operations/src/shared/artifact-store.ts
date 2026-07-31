/**
 * OperationsArtifactStore — a typed, READ-ONLY reader over lcis-core's ArtifactStore for the
 * operational artifacts discovered in Phase 0. It does NO IO of its own (lcis-core owns that);
 * it exposes the well-known runtime shapes typed and the richer intelligence artifacts raw
 * (services navigate them with the discovery docs). Reuse, not duplication.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';

export interface RuntimeWorker {
  readonly dir?: string;
  readonly file?: string;
  readonly name: string;
  readonly routes?: readonly string[];
  readonly crons?: readonly string[];
  readonly queueProducers?: readonly string[];
  readonly queueConsumers?: readonly string[];
  readonly observability?: unknown;
  readonly analyticsDatasets?: readonly string[];
}
export interface QueueEdge {
  readonly queue: string;
  readonly producer?: string;
  readonly consumers?: readonly string[];
}
export interface OpsStatus {
  readonly area: string;
  readonly declared?: string;
  readonly live?: string;
  readonly query?: string;
}
export interface TelemetryAdapter {
  readonly source: string;
  readonly metrics?: readonly string[];
  readonly binding?: string;
  readonly auth?: string;
}

export class OperationsArtifactStore {
  constructor(private readonly core: LcisEngine) {}

  private obj(name: string): Record<string, unknown> | null {
    return this.core.store.tryRead<Record<string, unknown>>(name);
  }
  private slice<T>(name: string, key: string): readonly T[] {
    const a = this.obj(name);
    const v = a?.[key];
    return Array.isArray(v) ? (v as T[]) : [];
  }

  // ── runtime (typed) ──
  workers(): readonly RuntimeWorker[] {
    return this.slice<RuntimeWorker>('runtime-intel', 'workers');
  }
  queueGraph(): readonly QueueEdge[] {
    return this.slice<QueueEdge>('runtime-intel', 'queueGraph');
  }
  deadLetterQueues(): readonly string[] {
    const a = this.obj('runtime-observability');
    const v = a?.['deadLetterQueues'];
    return Array.isArray(v) ? (v as unknown[]).map((x) => (typeof x === 'string' ? x : String((x as { queue?: string }).queue ?? x))) : [];
  }
  opsCenterStatuses(): readonly OpsStatus[] {
    return this.slice<OpsStatus>('operations-center', 'statuses');
  }
  telemetryAdapters(): readonly TelemetryAdapter[] {
    return this.slice<TelemetryAdapter>('telemetry-intelligence', 'adapters');
  }
  crons(): readonly { worker: string; cron: string }[] {
    const out: { worker: string; cron: string }[] = [];
    for (const w of this.workers()) for (const c of w.crons ?? []) out.push({ worker: w.name, cron: c });
    return out;
  }

  // ── richer intelligence artifacts (raw; services navigate with the discovery docs) ──
  deployment(): Record<string, unknown> | null {
    return this.obj('deployment-intelligence-v5');
  }
  deploymentState(): Record<string, unknown> | null {
    return this.obj('deployment-state');
  }
  incidents(): Record<string, unknown> | null {
    return this.obj('incident-intelligence-v5');
  }
  runbooks(): Record<string, unknown> | null {
    return this.obj('runbooks');
  }
  security(): Record<string, unknown> | null {
    return this.obj('security-intelligence-v5');
  }
  cost(): Record<string, unknown> | null {
    return this.obj('cost-intelligence');
  }
  revenue(): Record<string, unknown> | null {
    return this.obj('revenue-intelligence-v2');
  }
  merchant(): Record<string, unknown> | null {
    return this.obj('merchant-intelligence');
  }
  customer(): Record<string, unknown> | null {
    return this.obj('customer-intelligence');
  }
  productionReadiness(): Record<string, unknown> | null {
    return this.obj('production-readiness-v2');
  }

  /** Generic raw accessor + presence check (honest absence). */
  raw(name: string): unknown {
    return this.core.store.tryRead(name);
  }
  has(name: string): boolean {
    return this.core.store.has(name);
  }
}
