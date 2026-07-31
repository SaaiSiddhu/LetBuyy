/**
 * Memory vocabulary — deterministic BM25 retrieval over the governance/decision corpus.
 * No embeddings, no vector DB.
 */

export interface MemoryDocument {
  readonly id: string;
  readonly title: string;
  /** Source file path. */
  readonly source: string;
  readonly category?: string;
  readonly text: string;
}

export interface MemoryHit {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  /** BM25 score (higher = more relevant). */
  readonly score: number;
  readonly snippet: string;
}

export interface Citation {
  readonly ref: string;
  readonly source: string;
  /** 0..1 derived from the BM25 score distribution. */
  readonly confidence: number;
  readonly snippet: string;
}

export interface ContextPack {
  readonly query: string;
  readonly hits: readonly MemoryHit[];
  readonly citations: readonly Citation[];
  readonly tokensApprox: number;
  /** True when the index is older than the latest migration. */
  readonly stale: boolean;
  readonly builtAtMigration?: number;
}
