import { replayPayloadChecksum } from './event-envelope-runtime';

export type OperationalCertificationScope = 'staging-executable' | 'live-provider';

export interface OperationalTelemetryEvent {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  category: string;
  operation: string;
  eventSequence: number;
  startedAt: string;
  durationMs: number;
  inputChecksum: string;
  resultChecksum: string;
  causalityChecksum: string;
}

export interface OperationalEvidenceItem {
  category: string;
  outcome: 'verified' | 'failed';
  telemetry: OperationalTelemetryEvent;
  resultChecksum: string;
}

export interface OperationalEvidenceManifest {
  scope: OperationalCertificationScope;
  productionCertification: boolean;
  traceId: string;
  categories: OperationalEvidenceItem[];
  evidenceHash: string;
}

export function createOperationalTelemetryEvent(input: {
  traceId: string;
  parentSpanId: string;
  category: string;
  operation: string;
  eventSequence: number;
  startedAt: string;
  durationMs: number;
  inputChecksum: string;
  resultChecksum: string;
}): OperationalTelemetryEvent {
  if (!input.traceId || !input.parentSpanId || !input.inputChecksum || !input.resultChecksum) {
    throw new Error('Operational telemetry lineage requires trace, parent, input, and result checksums');
  }
  return {
    ...input,
    spanId: replayPayloadChecksum({
      traceId: input.traceId,
      category: input.category,
      operation: input.operation,
      eventSequence: input.eventSequence,
    }),
    causalityChecksum: replayPayloadChecksum({
      traceId: input.traceId,
      parentSpanId: input.parentSpanId,
      inputChecksum: input.inputChecksum,
      resultChecksum: input.resultChecksum,
    }),
  };
}

export function compileOperationalEvidenceManifest(input: {
  scope: OperationalCertificationScope;
  productionCertification: boolean;
  traceId: string;
  categories: OperationalEvidenceItem[];
}): OperationalEvidenceManifest {
  const ordered = [...input.categories].sort((left, right) => left.category.localeCompare(right.category));
  const evidenceHash = replayPayloadChecksum({
    scope: input.scope,
    productionCertification: input.productionCertification,
    traceId: input.traceId,
    categories: ordered.map((category) => ({
      category: category.category,
      outcome: category.outcome,
      resultChecksum: category.resultChecksum,
      telemetry: category.telemetry.causalityChecksum,
    })),
  });
  return {
    scope: input.scope,
    productionCertification: input.productionCertification,
    traceId: input.traceId,
    categories: ordered,
    evidenceHash,
  };
}

export function assertOperationalEvidenceManifest(manifest: OperationalEvidenceManifest): void {
  if (manifest.productionCertification && manifest.scope !== 'live-provider') {
    throw new Error('Staging operational evidence cannot be marked as production certification');
  }
  if (!manifest.traceId || !manifest.evidenceHash) {
    throw new Error('Operational evidence requires trace and evidence hashes');
  }
  const categoryIds = new Set<string>();
  for (const item of manifest.categories) {
    if (categoryIds.has(item.category)) {
      throw new Error(`Operational evidence has duplicate category: ${item.category}`);
    }
    categoryIds.add(item.category);
    if (item.outcome !== 'verified') {
      throw new Error(`Operational evidence category did not verify: ${item.category}`);
    }
    if (item.telemetry.traceId !== manifest.traceId) {
      throw new Error(`Operational telemetry trace lineage broken: ${item.category}`);
    }
    if (!item.telemetry.causalityChecksum || !item.resultChecksum) {
      throw new Error(`Operational evidence missing causality or result checksum: ${item.category}`);
    }
  }
}
