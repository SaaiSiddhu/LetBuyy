import { replayPayloadChecksum } from './event-envelope-runtime';
import type { CloudflareWorkerEnvironmentOwnership } from './cloudflare-resource-lineage-runtime';

export interface CloudflareExecutionLineageEdge {
  from: string;
  to: string;
  reason: 'worker-executes' | 'produces-queue' | 'consumes-queue' | 'binds-service' | 'owns-durable-object' | 'binds-kv' | 'binds-r2';
}

export interface CloudflareExecutionLineage {
  nodes: string[];
  edges: CloudflareExecutionLineageEdge[];
  lineageChecksum: string;
}

function nodeId(environment: string, runtimeRoot: string, name: string): string {
  return [environment, runtimeRoot, name].join(':');
}

export function compileCloudflareExecutionLineage(ownership: CloudflareWorkerEnvironmentOwnership[]): CloudflareExecutionLineage {
  const nodes = new Set<string>();
  const edges: CloudflareExecutionLineageEdge[] = [];

  for (const env of ownership) {
    const worker = nodeId(env.environment, env.runtimeRoot, env.workerName);
    nodes.add(worker);
    for (const queue of env.queueProducers) {
      const queueNode = nodeId(env.environment, 'cloudflare-queue', queue);
      nodes.add(queueNode);
      edges.push({ from: worker, to: queueNode, reason: 'produces-queue' });
    }
    for (const queue of env.queueConsumers) {
      const queueNode = nodeId(env.environment, 'cloudflare-queue', queue);
      nodes.add(queueNode);
      edges.push({ from: queueNode, to: worker, reason: 'consumes-queue' });
    }
    for (const service of env.serviceBindings) {
      const serviceNode = nodeId(env.environment, 'cloudflare-service-binding', service);
      nodes.add(serviceNode);
      edges.push({ from: worker, to: serviceNode, reason: 'binds-service' });
    }
    for (const durableObject of env.durableObjects) {
      const durableObjectNode = nodeId(env.environment, 'cloudflare-durable-object', durableObject);
      nodes.add(durableObjectNode);
      edges.push({ from: worker, to: durableObjectNode, reason: 'owns-durable-object' });
    }
    for (const kv of env.kvNamespaces) {
      const kvNode = nodeId(env.environment, 'cloudflare-kv', kv);
      nodes.add(kvNode);
      edges.push({ from: worker, to: kvNode, reason: 'binds-kv' });
    }
    for (const r2 of env.r2Buckets) {
      const r2Node = nodeId(env.environment, 'cloudflare-r2', r2);
      nodes.add(r2Node);
      edges.push({ from: worker, to: r2Node, reason: 'binds-r2' });
    }
  }

  const orderedNodes = [...nodes].sort();
  const orderedEdges = edges.sort((left, right) => {
    const fromDiff = left.from.localeCompare(right.from);
    if (fromDiff !== 0) return fromDiff;
    return left.to.localeCompare(right.to);
  });

  return {
    nodes: orderedNodes,
    edges: orderedEdges,
    lineageChecksum: replayPayloadChecksum({ nodes: orderedNodes, edges: orderedEdges }),
  };
}

export function assertCloudflareExecutionLineage(lineage: CloudflareExecutionLineage): void {
  if (lineage.nodes.length === 0) {
    throw new Error('Cloudflare execution lineage requires explicit per-environment resources');
  }
  if (!lineage.edges.some((edge) => edge.reason === 'produces-queue') || !lineage.edges.some((edge) => edge.reason === 'consumes-queue')) {
    throw new Error('Cloudflare queue producer-consumer causality incomplete');
  }
  if (!lineage.lineageChecksum) {
    throw new Error('Cloudflare execution lineage checksum missing');
  }
}
