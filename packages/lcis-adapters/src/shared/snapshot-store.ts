/**
 * SnapshotStore — TTL-bounded in-memory cache of adapter snapshots.
 * No permanent storage; entries expire by their snapshot's ttlMs. LCIS keeps no copy
 * of the source of truth beyond the TTL window.
 */
import type { AdapterSnapshot } from './contracts';

export class SnapshotStore {
  private readonly store = new Map<string, { snapshot: AdapterSnapshot; expiresAt: number }>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  set(key: string, snapshot: AdapterSnapshot): void {
    this.store.set(key, { snapshot, expiresAt: this.clock() + snapshot.ttlMs });
  }

  get(key: string): AdapterSnapshot | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (this.clock() > e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.snapshot;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
