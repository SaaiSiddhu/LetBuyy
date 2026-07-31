/**
 * LCTS (Change Tracking System) type vocabulary — the FROZEN contract every tracking
 * service implements against. LCTS tracks what DID change: a semantic timeline over
 * historical records (migrations/decisions — CONNECTED), semantic diffs over typed
 * inventory snapshots, and per-subject history with reasons. It never mutates, never
 * executes, and never relies on `git diff` — every record is a typed semantic fact.
 *
 * Honesty: migration/decision history is CONNECTED (graphify-out/memory-intel.json).
 * Live change events (commits/PRs/deployments) are NOT_CONNECTED unless adapter
 * LiveFacts are injected; historical inventory snapshots are NOT_CONNECTED unless an
 * archived snapshot is injected — carried as connection + the exact would-be source.
 *
 * No service may create types — they consume these. Nothing here imports a service.
 */
import type { Evidence } from '@letbuyy/lcis-core';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Connection = 'CONNECTED' | 'NOT_CONNECTED';

export type ChangeKind =
  | 'commit' | 'pr' | 'deployment' | 'migration' | 'decision'
  | 'table' | 'rpc' | 'policy' | 'trigger'
  | 'worker' | 'queue' | 'route' | 'config' | 'secret' | 'package' | 'infra';

export type ChangeAction = 'added' | 'removed' | 'modified' | 'applied' | 'observed';

/** Base provenance carried by EVERY LCTS output. */
export interface TrackingArtifact {
  readonly evidence: readonly Evidence[];
  /** 0..1 — structural-only; never fabricated. */
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly timestamp: string;
  /** True only if a live change feed was actually read. False until adapters are wired. */
  readonly liveConnected: boolean;
}

/** One semantic change record. The atom of LCTS. */
export interface ChangeRecord {
  /** Stable id, e.g. 'migration-174' or 'table:orders#added'. */
  readonly id: string;
  readonly kind: ChangeKind;
  /** Normalized subject: table/rpc/worker/queue name, file path, package name, … */
  readonly subject: string;
  readonly action: ChangeAction;
  /** ISO timestamp when known; null when the record has no reliable time. */
  readonly at: string | null;
  readonly detail: string;
  /** The system/artifact the record was read from. */
  readonly source: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface ChangeTimeline extends TrackingArtifact {
  /** Newest-first. Records without `at` sort after dated records, stable by id. */
  readonly records: readonly ChangeRecord[];
  readonly byKind: Readonly<Record<string, number>>;
  /** Live feeds that would extend this timeline, with their exact source, when absent. */
  readonly notConnectedFeeds: readonly { readonly feed: string; readonly source: string }[];
  readonly summary: string;
}

// ── Semantic diff ─────────────────────────────────────────────────────────────

/** A typed, named inventory — the input shape of the semantic diff. */
export interface SnapshotInventory {
  /** Label for provenance, e.g. 'current' or 'archive:2026-06-20'. */
  readonly label: string;
  /** ISO timestamp of when the snapshot was taken; null when unknown. */
  readonly at: string | null;
  readonly tables: readonly string[];
  readonly rpcs: readonly string[];
  readonly policies: readonly string[];
  readonly triggers: readonly string[];
  readonly workers: readonly string[];
  readonly queues: readonly string[];
  readonly routes: readonly string[];
  readonly packages: readonly string[];
}

export interface SemanticDiff extends TrackingArtifact {
  readonly before: string;
  readonly after: string;
  readonly records: readonly ChangeRecord[];
  readonly added: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly summary: string;
}

// ── Impact ────────────────────────────────────────────────────────────────────

export interface ChangeImpact extends TrackingArtifact {
  readonly record: ChangeRecord;
  /** Affected symbols/files from blast radius (empty when not derivable). */
  readonly affectedSymbols: readonly string[];
  readonly affectedFiles: number;
  readonly affectedDomains: readonly string[];
  /** Owners from CODEOWNERS/governance (empty when unowned). */
  readonly owners: readonly string[];
  /** Risk from EINS analysis: level + drivers (never re-modeled in LCTS). */
  readonly risk: { readonly level: string; readonly money: boolean; readonly tenant: boolean; readonly drivers: readonly string[] };
  readonly summary: string;
}

// ── Rollback guidance ─────────────────────────────────────────────────────────

export interface ChangeRollback extends TrackingArtifact {
  readonly record: ChangeRecord;
  readonly readiness: string;
  readonly steps: readonly string[];
  readonly irreversible: readonly string[];
  readonly summary: string;
}

// ── History (per subject) ─────────────────────────────────────────────────────

export interface ChangeHistory extends TrackingArtifact {
  readonly subject: string;
  readonly records: readonly ChangeRecord[];
  /** Reasons from the decision memory (why did this change) — empty when none found. */
  readonly reasons: readonly { readonly id: string; readonly title: string; readonly source: string }[];
  readonly summary: string;
}

// ── Findings (TR01..TR06) ─────────────────────────────────────────────────────

export interface TrackingFinding {
  readonly id: string;
  readonly rule: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}

// ── The flagship report ───────────────────────────────────────────────────────

export interface TrackingReport extends TrackingArtifact {
  readonly timeline: ChangeTimeline;
  readonly findings: readonly TrackingFinding[];
  readonly latestMigration: { readonly n: number; readonly file: string } | null;
  readonly decisionCount: number;
  readonly summary: string;
}
