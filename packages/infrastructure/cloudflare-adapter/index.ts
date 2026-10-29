export interface CloudflareBindingManifest {
  runtimeRoot: string;
  kvNamespaces?: string[];
  r2Buckets?: string[];
  queues?: string[];
  durableObjects?: string[];
  workerName?: string;
}

export interface CloudflareExecutionContextPort {
  waitUntil(promise: Promise<unknown>): void;
}

export { authorizeTurnstileHostname, readTurnstileCoverage, isTurnstileHostname } from './turnstile';
export type { TurnstileManagementConfig, TurnstileCoverage } from './turnstile';
