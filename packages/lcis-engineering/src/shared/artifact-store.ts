/**
 * EngineeringArtifactStore — a thin READ-ONLY handle over lcis-core's ArtifactStore for the
 * few direct reads EINS needs (the feature anatomy: domains and their declared slice). The
 * heavy analysis is COMPOSED from the prior engines (eis/gov/ops), not read here. No IO of its
 * own; lcis-core owns caching.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';

export interface EngDomain {
  readonly key: string;
  readonly label: string;
  readonly money: boolean;
  readonly tenant: boolean;
  readonly routes: readonly string[];
  readonly rpcs: readonly string[];
  readonly tables: readonly string[];
  readonly queues: readonly string[];
  readonly workers: readonly string[];
  readonly owners: readonly string[];
}

export class EngineeringArtifactStore {
  constructor(private readonly core: LcisEngine) {}

  /** The lcis-core engine (for services that compose blast/memory/etc.). */
  get engine(): LcisEngine {
    return this.core;
  }

  /** The declared domains (the feature anatomy targets). */
  domains(): readonly EngDomain[] {
    const a = this.core.store.tryRead<{ domains?: unknown }>('domain-intel');
    const v = a?.domains;
    return Array.isArray(v) ? (v as EngDomain[]) : [];
  }

  /** A single domain by key. */
  domain(key: string): EngDomain | undefined {
    return this.domains().find((d) => d.key === key);
  }

  raw(name: string): unknown {
    return this.core.store.tryRead(name);
  }
  has(name: string): boolean {
    return this.core.store.has(name);
  }
}
