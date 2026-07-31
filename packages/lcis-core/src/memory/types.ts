/**
 * MemoryService — service-local types.
 * These extend the shared contracts/memory.ts vocabulary with richer fields
 * required by the BM25 engine and the spec-memory.md API surface.
 */

// ── BM25 internal types ──────────────────────────────────────────────────────

export interface PostingEntry {
  readonly docId: string;
  /** Normalised term frequency: count(t,d) / len(d) */
  readonly tf: number;
  readonly positions: readonly number[];
}

export interface IndexedDocument {
  readonly id: string;
  /** Relative file path, e.g. "CLAUDE.md" */
  readonly source: string;
  /** Nearest heading above the chunk (≤90 chars) */
  readonly section: string;
  /** Raw chunk text (≤1600 chars) */
  readonly text: string;
  readonly tokens: readonly string[];
  /** Corpus category */
  readonly type: 'governance' | 'architecture' | 'governance_detail' | 'security' | 'runbook' | 'launch' | 'decision' | 'migration';
  readonly subtype?: string;
  /** Imperative rule text — decisions only */
  readonly rule?: string;
}

export interface MemoryIndex {
  readonly builtAt: string;
  readonly builtAtMigration: number;
  readonly schemaHash: string;
  readonly documents: readonly IndexedDocument[];
  readonly invertedIndex: Record<string, PostingEntry[]>;
}

// ── Public API types (per spec §1) ───────────────────────────────────────────

export interface MemoryHit {
  readonly id: string;
  readonly score: number;
  readonly type: 'decision' | 'governance' | 'architecture' | 'runbook' | 'migration';
  readonly subtype?: string;
  readonly source: string;
  readonly section: string;
  readonly text: string;
  readonly rule?: string;
}

export interface Citation {
  readonly id: string;
  readonly source: string;
  readonly section: string;
  readonly text: string;
  readonly confidence: 'high' | 'medium' | 'low';
}

export interface ContextPack {
  readonly query: string;
  readonly tokenBudget: number;
  readonly tokensUsed: number;
  readonly hits: readonly MemoryHit[];
  readonly citations: readonly Citation[];
  readonly stale: boolean;
  readonly builtAtMigration: number;
  readonly schemaHash: string;
}

export interface Decision {
  readonly id: string;
  readonly type: string;
  readonly subtype?: string;
  readonly source: string;
  readonly section: string;
  readonly rule: string;
  readonly alternatives?: readonly string[];
  readonly rejectedAt?: string;
  readonly lastConfirmedMigration?: number;
}

// ── Raw memory-intel.json shapes ─────────────────────────────────────────────

export interface RawDecision {
  readonly id: string;
  readonly type: string;
  readonly subtype?: string;
  readonly source: string;
  readonly section: string;
  readonly rule: string;
}

export interface RawMigration {
  readonly n: number;
  readonly file: string;
  readonly name: string;
  readonly type: string;
  readonly decision: string;
}

export interface RawMemoryIntel {
  readonly decisions: readonly RawDecision[];
  readonly migrations: readonly RawMigration[];
}
