/**
 * OperationalFindingBuilder — constructs an OperationalFinding with a deterministic id and a
 * confidence derived from its connection status (0 for NOT_CONNECTED). The atomic unit LCOS
 * surfaces for human investigation.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import { OperationalConfidenceCalculator } from './confidence';
import type { OperationalArea, OperationalFinding, OperationalStatus, Severity } from './types';

const conf = new OperationalConfidenceCalculator();

export interface OperationalFindingInput {
  readonly id?: string;
  readonly area: OperationalArea;
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly status: OperationalStatus;
  readonly evidence: readonly Evidence[];
  readonly confidence?: number;
}

export class OperationalFindingBuilder {
  build(i: OperationalFindingInput): OperationalFinding {
    return {
      id: i.id ?? this.stableId(i.kind, i.subject),
      area: i.area,
      kind: i.kind,
      severity: i.severity,
      subject: i.subject,
      title: i.title,
      detail: i.detail,
      status: i.status,
      confidence: i.confidence ?? conf.forStatus(i.status, i.evidence),
      evidence: i.evidence,
    };
  }
  stableId(kind: string, subject: string): string {
    return `${kind.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${subject}`;
  }
}
