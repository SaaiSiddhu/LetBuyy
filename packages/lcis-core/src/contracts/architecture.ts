/**
 * Architecture & domain entities — the canonical structural vocabulary.
 */
import type { Evidence } from './evidence';

export type Criticality = 'critical' | 'high' | 'medium' | 'low';

export type ArchitectureNodeKind =
  | 'domain'
  | 'service'
  | 'runtime'
  | 'table'
  | 'rpc'
  | 'route'
  | 'worker'
  | 'package';

export interface ArchitectureNode {
  readonly id: string;
  readonly kind: ArchitectureNodeKind;
  readonly name: string;
  readonly layer?: number;
  readonly criticality?: Criticality;
  readonly evidence: readonly Evidence[];
}

export type ArchitectureEdgeRelation =
  | 'depends-on'
  | 'calls'
  | 'contains'
  | 'serves'
  | 'owns'
  | 'cross-domain';

export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: ArchitectureEdgeRelation;
  readonly evidence: readonly Evidence[];
}

export interface Domain {
  readonly key: string;
  readonly label: string;
  readonly money: boolean;
  readonly tenant: boolean;
  readonly tables: readonly string[];
  readonly rpcs: readonly string[];
  readonly criticality: Criticality;
}

export type RuntimeKind =
  | 'vercel-app'
  | 'cloudflare-worker'
  | 'mobile'
  | 'gateway'
  | 'reserved';

export interface Service {
  readonly name: string;
  readonly runtime: RuntimeKind;
  readonly domains: readonly string[];
}

export interface Dependency {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly evidence: readonly Evidence[];
}

export type ExplanationKind =
  | 'domain'
  | 'service'
  | 'dependency'
  | 'architecture'
  | 'runtime'
  | 'ownership'
  | 'risk';

export interface Explanation {
  readonly subject: string;
  readonly kind: ExplanationKind;
  readonly summary: string;
  readonly detail?: string;
  readonly evidence: readonly Evidence[];
}
