import { replayPayloadChecksum, type ReplayCursor } from '@letbuyy/distributed-runtime';

export interface ProjectionDependencyEdge {
  fromProjection: string;
  toProjection: string;
  reason: 'read-model-derived' | 'cache-derived' | 'aggregation-derived';
}

export interface ProjectionRebuildCandidate {
  projectionName: string;
  projectionVersion: number;
  lastHealthyGlobalPosition: number;
  targetGlobalPosition: number;
  priority: number;
  estimatedRecords: number;
}

export interface ProjectionReplayWindow {
  projectionName: string;
  cursor: ReplayCursor;
  targetGlobalPosition: number;
  batchSize: number;
}

export interface ProjectionRebuildPlanSummary {
  windows: ProjectionReplayWindow[];
  orderedProjections: string[];
  planChecksum: string;
}

function orderProjections(candidates: ProjectionRebuildCandidate[], dependencies: ProjectionDependencyEdge[]): string[] {
  const names = candidates.map((candidate) => candidate.projectionName).sort();
  const incoming = new Map(names.map((name) => [name, 0]));
  const outgoing = new Map(names.map((name) => [name, [] as string[]]));

  for (const edge of dependencies) {
    if (!incoming.has(edge.fromProjection) || !incoming.has(edge.toProjection)) {
      throw new Error(`Projection dependency references unknown projection ${edge.fromProjection} -> ${edge.toProjection}`);
    }
    incoming.set(edge.toProjection, (incoming.get(edge.toProjection) || 0) + 1);
    outgoing.get(edge.fromProjection)?.push(edge.toProjection);
  }

  const ready = names.filter((name) => incoming.get(name) === 0).sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const name = ready.shift();
    if (!name) break;
    ordered.push(name);
    for (const target of (outgoing.get(name) || []).sort()) {
      incoming.set(target, (incoming.get(target) || 0) - 1);
      if (incoming.get(target) === 0) ready.push(target);
      ready.sort();
    }
  }
  if (ordered.length !== names.length) throw new Error('Projection dependency cycle exists');
  return ordered;
}

export function planSelectiveProjectionRebuild(input: {
  candidates: ProjectionRebuildCandidate[];
  dependencies: ProjectionDependencyEdge[];
  maxBatchSize: number;
}): ProjectionRebuildPlanSummary {
  const orderedProjections = orderProjections(input.candidates, input.dependencies);
  const candidateByName = new Map(input.candidates.map((candidate) => [candidate.projectionName, candidate]));
  const windows = orderedProjections
    .map((projectionName) => {
      const candidate = candidateByName.get(projectionName);
      if (!candidate) throw new Error(`Projection rebuild candidate missing: ${projectionName}`);
      const delta = Math.max(0, candidate.targetGlobalPosition - candidate.lastHealthyGlobalPosition);
      return {
        projectionName,
        cursor: { afterGlobalPosition: candidate.lastHealthyGlobalPosition, streamName: projectionName },
        targetGlobalPosition: candidate.targetGlobalPosition,
        batchSize: Math.min(input.maxBatchSize, Math.max(1, delta || candidate.estimatedRecords)),
      };
    })
    .sort((left, right) => {
      const leftCandidate = candidateByName.get(left.projectionName);
      const rightCandidate = candidateByName.get(right.projectionName);
      const priorityDiff = (leftCandidate?.priority || 0) - (rightCandidate?.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return left.projectionName.localeCompare(right.projectionName);
    });

  return {
    windows,
    orderedProjections,
    planChecksum: replayPayloadChecksum({ windows, orderedProjections }),
  };
}

export function assertProjectionRebuildPlanBounded(plan: ProjectionRebuildPlanSummary, maxBatchSize: number): void {
  for (const window of plan.windows) {
    if (window.batchSize > maxBatchSize || window.batchSize < 1) {
      throw new Error(`Projection rebuild batch is not bounded: ${window.projectionName}`);
    }
    if ((window.cursor.afterGlobalPosition || 0) > window.targetGlobalPosition) {
      throw new Error(`Projection rebuild window regresses cursor: ${window.projectionName}`);
    }
  }
}
