/**
 * OrchestrationArtifactStore — a typed, READ-ONLY reader over lcis-core's ArtifactStore for the
 * structural catalog the ArtifactIntelligenceService compares PLANNED artifacts against. It does
 * NO IO of its own (lcis-core owns that) and no fs/git/CI probing — actual on-disk artifact
 * existence is NOT_CONNECTED and never read here.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';

export class OrchestrationArtifactStore {
  constructor(private readonly core: LcisEngine) {}

  private obj(name: string): Record<string, unknown> | null {
    return this.core.store.tryRead<Record<string, unknown>>(name);
  }
  private slice<T>(name: string, key: string): readonly T[] {
    const a = this.obj(name);
    const v = a?.[key];
    return Array.isArray(v) ? (v as T[]) : [];
  }

  /** Declared RPCs (structural catalog) — to compare against planned rpc-layer artifacts. */
  functions(): readonly { name: string }[] {
    return this.slice('db-intel', 'functions');
  }
  tables(): readonly { name: string }[] {
    return this.slice('db-intel', 'tables');
  }
  routes(): readonly string[] {
    const ds = this.slice<{ routes?: string[] }>('domain-intel', 'domains');
    return [...new Set(ds.flatMap((d) => d.routes ?? []))];
  }
  workers(): readonly { name?: string }[] {
    return this.slice('infra-intel', 'workers');
  }
  /** Subjects (domain keys) that have a runbook, lowercased. Honest empty if none. */
  runbookSubjects(): readonly string[] {
    const rb = this.obj('runbooks');
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
  has(name: string): boolean {
    return this.core.store.has(name);
  }
}
