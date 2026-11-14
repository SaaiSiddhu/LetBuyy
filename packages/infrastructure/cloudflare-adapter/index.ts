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
