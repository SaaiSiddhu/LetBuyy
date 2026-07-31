/**
 * lcis-live types — the unified read-only operational view assembled from the adapters.
 */
import type { Evidence } from '@letbuyy/lcis-core';
import type {
  AdapterMetadata,
  AdapterSnapshot,
  AdapterStatus,
  CorrelationResult,
  HealthResult,
} from '@letbuyy/lcis-adapters';

export interface LiveHealth {
  readonly adapters: readonly HealthResult[];
  readonly overall: AdapterStatus;
  readonly generatedAt: string;
}

export interface LiveStatus {
  readonly adapters: readonly AdapterSnapshot[];
  readonly generatedAt: string;
}

export interface AdapterListing {
  readonly name: string;
  readonly metadata: AdapterMetadata;
}

export interface Investigation {
  readonly subject: string;
  readonly correlation: CorrelationResult;
  readonly contributingAdapters: readonly string[];
  readonly notConnected: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly generatedAt: string;
}
