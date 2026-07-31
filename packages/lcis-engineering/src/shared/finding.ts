/**
 * EngineeringFindingBuilder — constructs an EngineeringFinding (a gate / risk / gap / blocker)
 * with a deterministic id and an evidence-derived confidence.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import { EngineeringConfidenceCalculator } from './confidence';
import type { EngineeringFinding, Severity } from './types';

const conf = new EngineeringConfidenceCalculator();

export interface EngineeringFindingInput {
  readonly id?: string;
  readonly category: 'gate' | 'risk' | 'gap' | 'blocker';
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly rule?: string;
  readonly evidence: readonly Evidence[];
  readonly confidence?: number;
}

export class EngineeringFindingBuilder {
  build(i: EngineeringFindingInput): EngineeringFinding {
    return {
      id: i.id ?? this.stableId(i.kind, i.subject),
      category: i.category,
      kind: i.kind,
      severity: i.severity,
      subject: i.subject,
      title: i.title,
      detail: i.detail,
      ...(i.rule !== undefined ? { rule: i.rule } : {}),
      confidence: i.confidence ?? conf.fromEvidence(i.evidence),
      evidence: i.evidence,
    };
  }
  stableId(kind: string, subject: string): string {
    return `${kind.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${subject}`;
  }
}
