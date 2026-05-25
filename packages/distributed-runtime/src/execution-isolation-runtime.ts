import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ExecutionCapability {
  capabilityId: string;
  ownerRuntime: string;
  operations: string[];
  trustDomain: string;
  sandboxPolicy: 'deny-by-default' | 'manifest-granted';
}

export interface ExecutionAuthorityGraph {
  capabilities: ExecutionCapability[];
  edges: Array<{ from: string; to: string; reason: 'grants' | 'requires' }>;
  authorityChecksum: string;
}

export function compileExecutionAuthorityGraph(capabilities: ExecutionCapability[]): ExecutionAuthorityGraph {
  const ordered = capabilities
    .map((capability) => ({
      ...capability,
      operations: [...capability.operations].sort(),
    }))
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  const edges = ordered.flatMap((capability) =>
    capability.operations.map((operation) => ({
      from: capability.capabilityId,
      to: operation,
      reason: 'grants' as const,
    })),
  );
  return {
    capabilities: ordered,
    edges,
    authorityChecksum: replayPayloadChecksum({ ordered, edges }),
  };
}

export function assertExecutionIsolation(graph: ExecutionAuthorityGraph): void {
  const operationOwners = new Map<string, string>();
  for (const capability of graph.capabilities) {
    if (capability.sandboxPolicy !== 'deny-by-default' && capability.sandboxPolicy !== 'manifest-granted') {
      throw new Error(`Runtime sandbox broken for capability ${capability.capabilityId}`);
    }
    for (const operation of capability.operations) {
      const existing = operationOwners.get(operation);
      if (existing && existing !== capability.ownerRuntime) {
        throw new Error(`Execution authority overlap exists for operation ${operation}`);
      }
      operationOwners.set(operation, capability.ownerRuntime);
    }
    if (!capability.trustDomain) {
      throw new Error(`Capability ownership ambiguous: ${capability.capabilityId}`);
    }
  }
}
