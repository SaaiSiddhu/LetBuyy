/**
 * ReadThroughCache — TTL read-through over the existing SnapshotStore (composition, not a
 * second cache). A hit returns the stored snapshot without touching the provider; a miss
 * collects once and stores by the snapshot's own ttlMs. Never caches an ERROR snapshot
 * (the next read retries the provider); NOT_CONNECTED snapshots are cached (credential
 * presence rarely changes mid-process, and the honest answer stays honest).
 */
import type { AdapterSnapshot, LiveAdapter } from './contracts';
import { SnapshotStore } from './snapshot-store';

export interface CachedRead {
  readonly snapshot: AdapterSnapshot;
  readonly cache: 'HIT' | 'MISS';
}

export class ReadThroughCache {
  constructor(private readonly store: SnapshotStore = new SnapshotStore()) {}

  async collect(adapter: LiveAdapter): Promise<CachedRead> {
    const key = adapter.metadata().name;
    const hit = this.store.get(key);
    if (hit !== null) {
      return { snapshot: hit, cache: 'HIT' };
    }
    const snapshot = await adapter.collect();
    if (snapshot.status !== 'ERROR') {
      this.store.set(key, snapshot);
    }
    return { snapshot, cache: 'MISS' };
  }

  invalidate(adapterName: string): void {
    this.store.delete(adapterName);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size();
  }
}
