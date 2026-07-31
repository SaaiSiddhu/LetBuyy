/**
 * FindingBuilder — constructs a Finding with a deterministic id and a confidence derived
 * from its evidence. The atomic unit of governance intelligence.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import { ConfidenceCalculator } from './confidence';
import type { Finding, FindingCategory, Severity } from './types';

const conf = new ConfidenceCalculator();

export interface FindingInput {
  readonly id: string;
  readonly category: FindingCategory;
  readonly kind: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly rule?: string;
  readonly evidence: readonly Evidence[];
  readonly confidence?: number;
}

export class FindingBuilder {
  build(input: FindingInput): Finding {
    return {
      id: input.id,
      category: input.category,
      kind: input.kind,
      severity: input.severity,
      subject: input.subject,
      title: input.title,
      detail: input.detail,
      ...(input.rule !== undefined ? { rule: input.rule } : {}),
      confidence: input.confidence ?? conf.fromEvidence(input.evidence),
      evidence: input.evidence,
    };
  }
  /** Deterministic, stable id from a kind + subject (no timestamps / randomness). */
  stableId(kind: string, subject: string): string {
    return `${kind.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${subject}`;
  }
}
