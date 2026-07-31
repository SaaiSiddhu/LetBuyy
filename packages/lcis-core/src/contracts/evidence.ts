/**
 * Evidence — provenance for every LCIS answer.
 * No result is emitted without evidence, or an explicit absence label.
 */

export type EvidenceKind =
  | 'graph-node'
  | 'graph-edge'
  | 'file'
  | 'artifact-field'
  | 'rpc'
  | 'table'
  | 'policy'
  | 'route'
  | 'worker'
  | 'doc'
  | 'decision'
  | 'migration'
  | 'validator'
  | 'not-connected';

export interface Evidence {
  /** What kind of thing is cited. */
  readonly kind: EvidenceKind;
  /** The cited entity: node id, file path, artifact field, rpc/table name, env var, ... */
  readonly ref: string;
  /** Human-readable note. */
  readonly detail?: string;
  /** Originating artifact/file, e.g. 'graphify-out/graph.json'. */
  readonly source?: string;
}

/** Construct an Evidence record. */
export function evidence(
  kind: EvidenceKind,
  ref: string,
  detail?: string,
  source?: string,
): Evidence {
  const e: { kind: EvidenceKind; ref: string; detail?: string; source?: string } = { kind, ref };
  if (detail !== undefined) e.detail = detail;
  if (source !== undefined) e.source = source;
  return e;
}

/**
 * Honest absence — used wherever a live value would be required but is not connected.
 * Never fabricate a live value; cite the exact env var instead.
 */
export function notConnected(ref: string, requiresEnvVar: string): Evidence {
  return {
    kind: 'not-connected',
    ref,
    detail: `NOT CONNECTED — requires ${requiresEnvVar}`,
    source: requiresEnvVar,
  };
}
