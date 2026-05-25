import { replayPayloadChecksum } from './event-envelope-runtime';

export interface ResumableDagNode {
  nodeId: string;
  dependsOn: string[];
  operationChecksum: string;
}

export interface ResumableDagCursor {
  executionId: string;
  completedNodeIds: string[];
  nextNodeIds: string[];
  checkpointChecksum: string;
  continuationChecksum: string;
}

export function compileResumableDagCursor(input: {
  executionId: string;
  nodes: ResumableDagNode[];
  completedNodeIds: string[];
}): ResumableDagCursor {
  const completed = new Set(input.completedNodeIds);
  const orderedNodes = [...input.nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const nextNodeIds = orderedNodes
    .filter((node) => !completed.has(node.nodeId) && node.dependsOn.every((dependency) => completed.has(dependency)))
    .map((node) => node.nodeId)
    .sort();
  const completedNodeIds = [...completed].sort();
  const checkpointChecksum = replayPayloadChecksum({
    executionId: input.executionId,
    completedNodeIds,
    nextNodeIds,
  });
  return {
    executionId: input.executionId,
    completedNodeIds,
    nextNodeIds,
    checkpointChecksum,
    continuationChecksum: replayPayloadChecksum({
      executionId: input.executionId,
      checkpointChecksum,
      operationChecksums: orderedNodes.map((node) => node.operationChecksum),
    }),
  };
}

export function restoreExecutionContinuation(input: {
  nodes: ResumableDagNode[];
  cursor: ResumableDagCursor;
}): ResumableDagNode[] {
  const allowed = new Set(input.cursor.nextNodeIds);
  return input.nodes
    .filter((node) => allowed.has(node.nodeId))
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

export function assertResumableDagExecution(input: {
  nodes: ResumableDagNode[];
  cursor: ResumableDagCursor;
}): void {
  const nodeIds = new Set(input.nodes.map((node) => node.nodeId));
  for (const node of input.nodes) {
    for (const dependency of node.dependsOn) {
      if (!nodeIds.has(dependency)) {
        throw new Error(`DAG continuation ambiguous: missing dependency ${dependency}`);
      }
    }
  }
  for (const nodeId of input.cursor.nextNodeIds) {
    if (!nodeIds.has(nodeId)) {
      throw new Error(`checkpoint restoration unstable: cursor references missing node ${nodeId}`);
    }
  }
  if (!input.cursor.continuationChecksum || !input.cursor.checkpointChecksum) {
    throw new Error('continuation nondeterministic');
  }
}
