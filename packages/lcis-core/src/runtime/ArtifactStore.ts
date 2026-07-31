/**
 * ArtifactStore — loads and caches pre-computed graphify-out/*.json artifacts.
 * The single IO boundary of the engine: services receive parsed data and stay pure/testable.
 * Honest on absence (throws ArtifactMissingError or returns null) — never fabricates.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { graphifyOutDir } from './paths';

export class ArtifactMissingError extends Error {
  constructor(
    public readonly artifact: string,
    public readonly path: string,
  ) {
    super(
      `lcis-core: artifact not found: ${artifact} (expected at ${path}). ` +
        'Generate it first (e.g. `pnpm graph:db`, `pnpm graph:omega`).',
    );
    this.name = 'ArtifactMissingError';
  }
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly hitRate: number;
}

export class ArtifactStore {
  private readonly cache = new Map<string, unknown>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly root: string) {}

  /** Default store rooted at the repo's graphify-out directory. */
  static default(): ArtifactStore {
    return new ArtifactStore(graphifyOutDir());
  }

  /** Store rooted at an explicit directory (e.g. test fixtures). */
  static fromDir(dir: string): ArtifactStore {
    return new ArtifactStore(dir);
  }

  pathOf(name: string): string {
    return join(this.root, name.endsWith('.json') ? name : `${name}.json`);
  }

  has(name: string): boolean {
    return existsSync(this.pathOf(name));
  }

  /** Read + cache an artifact. Throws ArtifactMissingError if absent. */
  read<T = unknown>(name: string): T {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      this.hits++;
      return cached as T;
    }
    this.misses++;
    const p = this.pathOf(name);
    if (!existsSync(p)) throw new ArtifactMissingError(name, p);
    const data = JSON.parse(readFileSync(p, 'utf8')) as T;
    this.cache.set(name, data);
    return data;
  }

  /** Read an artifact, or null if it does not exist (honest absence). */
  tryRead<T = unknown>(name: string): T | null {
    return this.has(name) ? this.read<T>(name) : null;
  }

  /** Cache observability — hit rate, miss count, resident artifact count. */
  cacheStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total === 0 ? 0 : Math.round((this.hits / total) * 1000) / 1000,
    };
  }
}
