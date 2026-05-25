import { replayPayloadChecksum } from './event-envelope-runtime';

export interface CloudflareWorkerEnvironmentOwnership {
  runtimeRoot: string;
  environment: 'dev' | 'staging' | 'production';
  workerName: string;
  vars: string[];
  queueProducers: string[];
  queueConsumers: string[];
  kvNamespaces: string[];
  r2Buckets: string[];
  durableObjects: string[];
  serviceBindings: string[];
  telemetry: string[];
}

export interface CloudflareResourceLineageNode {
  id: string;
  kind: 'worker' | 'var' | 'queue-producer' | 'queue-consumer' | 'kv' | 'r2' | 'durable-object' | 'service-binding' | 'telemetry';
  runtimeRoot: string;
  environment: string;
  owner: string;
}

export interface CloudflareResourceLineage {
  nodes: CloudflareResourceLineageNode[];
  lineageChecksum: string;
}

function nodeId(kind: CloudflareResourceLineageNode['kind'], environment: string, owner: string): string {
  return [environment, kind, owner].join(':');
}

export function compileCloudflareResourceLineage(ownership: CloudflareWorkerEnvironmentOwnership[]): CloudflareResourceLineage {
  const nodes: CloudflareResourceLineageNode[] = [];
  for (const env of ownership) {
    nodes.push({
      id: nodeId('worker', env.environment, env.workerName),
      kind: 'worker',
      runtimeRoot: env.runtimeRoot,
      environment: env.environment,
      owner: env.workerName,
    });
    for (const variable of env.vars) nodes.push({ id: nodeId('var', env.environment, `${env.workerName}:${variable}`), kind: 'var', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: variable });
    for (const binding of env.queueProducers) nodes.push({ id: nodeId('queue-producer', env.environment, `${env.workerName}:${binding}`), kind: 'queue-producer', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
    for (const queue of env.queueConsumers) nodes.push({ id: nodeId('queue-consumer', env.environment, `${env.workerName}:${queue}`), kind: 'queue-consumer', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: queue });
    for (const binding of env.kvNamespaces) nodes.push({ id: nodeId('kv', env.environment, `${env.workerName}:${binding}`), kind: 'kv', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
    for (const binding of env.r2Buckets) nodes.push({ id: nodeId('r2', env.environment, `${env.workerName}:${binding}`), kind: 'r2', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
    for (const binding of env.durableObjects) nodes.push({ id: nodeId('durable-object', env.environment, `${env.workerName}:${binding}`), kind: 'durable-object', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
    for (const binding of env.serviceBindings) nodes.push({ id: nodeId('service-binding', env.environment, `${env.workerName}:${binding}`), kind: 'service-binding', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
    for (const binding of env.telemetry) nodes.push({ id: nodeId('telemetry', env.environment, `${env.workerName}:${binding}`), kind: 'telemetry', runtimeRoot: env.runtimeRoot, environment: env.environment, owner: binding });
  }

  const ordered = nodes.sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set<string>();
  for (const node of ordered) {
    if (ids.has(node.id)) {
      throw new Error(`Cloudflare resource ownership is ambiguous: ${node.id}`);
    }
    ids.add(node.id);
  }

  return {
    nodes: ordered,
    lineageChecksum: replayPayloadChecksum(ordered),
  };
}

export function assertCloudflareResourceLineage(lineage: CloudflareResourceLineage): void {
  if (lineage.nodes.length === 0) {
    throw new Error('Cloudflare resource lineage requires explicit environment resources');
  }
  if (!lineage.lineageChecksum) {
    throw new Error('Cloudflare resource lineage requires checksum');
  }
}
