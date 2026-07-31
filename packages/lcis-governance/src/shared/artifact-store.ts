/**
 * GovernanceArtifactStore — a typed, READ-ONLY reader over lcis-core's ArtifactStore.
 * It does NOT do its own IO or caching (lcis-core owns that); it exposes the governance-
 * relevant slices of the real graphify-out artifacts with the exact shapes discovered in
 * Phase 0. Reuse, not duplication.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';

export interface GovTable {
  readonly name: string;
  readonly createdIn: string;
  readonly columns: number;
  readonly hasSiteId: boolean;
  readonly hasStoreId: boolean;
  readonly rls: boolean;
  readonly force: boolean;
  readonly policies: readonly string[];
  readonly triggers: readonly string[];
  readonly indexes: number;
  readonly money: boolean;
  readonly tenant: boolean;
}

export interface GovFunction {
  readonly name: string;
  readonly definedIn: string;
  readonly securityDefiner: boolean;
  readonly args: number;
  readonly touches: readonly string[];
  readonly hasIdempotency: boolean;
  readonly forUpdate: boolean;
  readonly money: boolean;
  readonly callers: readonly string[];
}

export interface GovPolicy {
  readonly name: string;
  readonly table: string;
  readonly public: boolean;
  readonly usesSiteId: boolean;
  readonly serviceRole: boolean;
}

export interface GovTrigger {
  readonly name: string;
  readonly table: string;
}

export interface GovDomain {
  readonly key: string;
  readonly label: string;
  readonly money: boolean;
  readonly tenant: boolean;
  readonly routes: readonly string[];
  readonly rpcs: readonly string[];
  readonly tables: readonly string[];
  readonly queues: readonly string[];
  readonly apps: readonly string[];
  readonly workers: readonly string[];
  readonly secrets: readonly string[];
  readonly owners: readonly string[];
  readonly workflows?: readonly string[];
  readonly dependsOn?: readonly { domain: string; strength?: number }[];
  readonly consumedBy?: readonly { domain: string; strength?: number }[];
}

export interface GovWorker {
  readonly file: string;
  readonly name: string;
  readonly queueProducers: readonly string[];
  readonly queueConsumers: readonly string[];
  readonly crons: readonly string[];
}

export interface GovOwnership {
  readonly path: string;
  readonly owners: readonly string[];
}

export interface GovMigration {
  readonly n: number;
  readonly file: string;
  readonly name: string;
  readonly type: string;
  readonly decision: string;
}

export interface GovReadinessSystem {
  readonly system: string;
  readonly key: string;
  readonly score: number;
  readonly evidence?: unknown;
  readonly blockers?: readonly unknown[];
}

const DB = 'graphify-out/db-intel.json';
const DOMAIN = 'graphify-out/domain-intel.json';
const INFRA = 'graphify-out/infra-intel.json';

export class GovernanceArtifactStore {
  constructor(private readonly core: LcisEngine) {}

  private slice<T>(artifact: string, key: string): readonly T[] {
    const a = this.core.store.tryRead<Record<string, unknown>>(artifact);
    const v = a?.[key];
    return Array.isArray(v) ? (v as T[]) : [];
  }

  // ── db-intel ──
  tables(): readonly GovTable[] {
    return this.slice<GovTable>('db-intel', 'tables');
  }
  functions(): readonly GovFunction[] {
    return this.slice<GovFunction>('db-intel', 'functions');
  }
  policies(): readonly GovPolicy[] {
    return this.slice<GovPolicy>('db-intel', 'policies');
  }
  triggers(): readonly GovTrigger[] {
    return this.slice<GovTrigger>('db-intel', 'triggers');
  }

  // ── domain-intel ──
  domains(): readonly GovDomain[] {
    return this.slice<GovDomain>('domain-intel', 'domains');
  }

  // ── infra-intel ──
  workers(): readonly GovWorker[] {
    return this.slice<GovWorker>('infra-intel', 'workers');
  }
  ownership(): readonly GovOwnership[] {
    return this.slice<GovOwnership>('infra-intel', 'ownership');
  }

  // ── memory-intel ──
  migrations(): readonly GovMigration[] {
    return this.slice<GovMigration>('memory-intel', 'migrations');
  }

  // ── readiness + runbooks (loosely shaped — consumers inspect) ──
  readinessSystems(): readonly GovReadinessSystem[] {
    return this.slice<GovReadinessSystem>('production-readiness-v2', 'systems');
  }
  runbooks(): unknown {
    return this.core.store.tryRead('runbooks');
  }
  /** Subjects (domain keys / names) that have a runbook, normalized to lowercase. Honest empty if none. */
  runbookSubjects(): readonly string[] {
    const rb = this.core.store.tryRead<Record<string, unknown>>('runbooks');
    const list = rb?.['runbooks'];
    const out = new Set<string>();
    if (Array.isArray(list)) {
      for (const r of list) {
        const o = r as Record<string, unknown>;
        for (const f of ['domain', 'key', 'subject', 'name', 'id']) {
          if (typeof o[f] === 'string') out.add((o[f] as string).toLowerCase());
        }
      }
    } else if (list && typeof list === 'object') {
      for (const k of Object.keys(list as object)) out.add(k.toLowerCase());
    }
    return [...out];
  }

  /** Provenance sources actually present (for honest `sources`). */
  sourcesPresent(): string[] {
    return [DB, DOMAIN, INFRA, 'graphify-out/memory-intel.json'].filter((s) =>
      this.core.store.has(s.replace('graphify-out/', '').replace('.json', '')),
    );
  }
}
