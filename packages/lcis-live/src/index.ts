/**
 * @letbuyy/lcis-live — unified read-only operational state + investigate, over
 * @letbuyy/lcis-adapters and @letbuyy/lcis-core. No new intelligence; no mutations.
 */
export * from './types';
export { LivePlatform } from './platform';
export { createLivePlatform, defaultAdapters, type LivePlatformOptions } from './factory';
// Re-export the adapter types surfaced by the platform so consumers need only @letbuyy/lcis-live.
export type {
  AdapterMetadata,
  AdapterSnapshot,
  AdapterStatus,
  AdapterVerification,
  CorrelationResult,
  HealthResult,
  LiveFact,
  VerificationFinding,
} from '@letbuyy/lcis-adapters';
