/**
 * EvidenceBuilder — builds adapter Evidence over the canonical lcis-core Evidence type.
 * Every observed fact cites its source of truth; absent live values are NOT_CONNECTED.
 */
import { type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';

export const EvidenceBuilder = {
  /** A fact observed from a live source of truth. */
  observed(ref: string, detail: string, source: string): Evidence {
    return evidence('artifact-field', ref, detail, source);
  },
  /** A cited table/rpc/policy/route/worker entity from a source of truth. */
  entity(kind: 'table' | 'rpc' | 'policy' | 'route' | 'worker', ref: string, source: string, detail?: string): Evidence {
    return evidence(kind, ref, detail, source);
  },
  /** Honest absence — a required live value whose credential is not present. */
  notConnected(ref: string, requiresEnvVar: string): Evidence {
    return notConnected(ref, requiresEnvVar);
  },
} as const;
