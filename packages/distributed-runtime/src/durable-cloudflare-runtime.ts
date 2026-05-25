import { replayPayloadChecksum } from './event-envelope-runtime';
import type { CloudflareWorkerEnvironmentOwnership } from './cloudflare-resource-lineage-runtime';

export interface CloudflareDurableExecutionOwnership {
  runtimeRoot: string;
  environment: 'dev' | 'staging' | 'production';
  workerName: string;
  durableObjectNamespaces: string[];
  executionLeaseBindings: string[];
  queueBindings: string[];
  telemetryBindings: string[];
}

export interface CloudflareDurableExecutionLineage {
  ownership: CloudflareDurableExecutionOwnership[];
  lineageChecksum: string;
}

export function compileCloudflareDurableExecutionLineage(input: {
  workerOwnership: CloudflareWorkerEnvironmentOwnership[];
  durableOwnership: CloudflareDurableExecutionOwnership[];
}): CloudflareDurableExecutionLineage {
  const workerKeys = new Set(input.workerOwnership.map((owner) => `${owner.environment}:${owner.workerName}`));
  const ownership = input.durableOwnership
    .map((owner) => ({
      ...owner,
      durableObjectNamespaces: [...owner.durableObjectNamespaces].sort(),
      executionLeaseBindings: [...owner.executionLeaseBindings].sort(),
      queueBindings: [...owner.queueBindings].sort(),
      telemetryBindings: [...owner.telemetryBindings].sort(),
    }))
    .sort((left, right) => {
      const envDiff = left.environment.localeCompare(right.environment);
      if (envDiff !== 0) return envDiff;
      return left.workerName.localeCompare(right.workerName);
    });

  for (const owner of ownership) {
    if (!workerKeys.has(`${owner.environment}:${owner.workerName}`)) {
      throw new Error(`Worker execution lineage incomplete: ${owner.environment}:${owner.workerName}`);
    }
    if (owner.durableObjectNamespaces.length === 0) {
      throw new Error(`Durable Object ownership ambiguous: ${owner.environment}:${owner.workerName}`);
    }
  }

  return {
    ownership,
    lineageChecksum: replayPayloadChecksum(ownership),
  };
}

export function assertCloudflareDurableExecutionLineage(lineage: CloudflareDurableExecutionLineage): void {
  if (lineage.ownership.length === 0) {
    throw new Error('Cloudflare durable execution lineage requires explicit ownership');
  }
  for (const owner of lineage.ownership) {
    if (owner.executionLeaseBindings.length === 0) {
      throw new Error(`Execution lease ownership missing: ${owner.environment}:${owner.workerName}`);
    }
    if (owner.telemetryBindings.length === 0) {
      throw new Error(`Cloudflare durable execution telemetry binding missing: ${owner.environment}:${owner.workerName}`);
    }
  }
}
