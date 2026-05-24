import type { RuntimeProjection } from './projection';
import type { RuntimeQueryContext, RuntimeQueryExecutionMetadata } from './query-runtime';

export interface ProjectionExecutionBoundary {
  authority: 'runtime-composition';
  forbiddenOwners: Array<'apps' | 'services' | 'application-services'>;
  cacheBoundary: 'runtime-composition';
  responseBoundary: 'runtime-composition';
}

export interface ProjectionExecutionContext<TSource = Record<string, unknown>> {
  context: RuntimeQueryContext;
  source: TSource;
  projectionName: string;
  projectionVersion: number;
  startedAt?: string;
}

export interface ProjectionExecutionResult<TProjection> {
  projection: RuntimeProjection<TProjection>;
  metadata: RuntimeQueryExecutionMetadata;
  boundary: ProjectionExecutionBoundary;
}

export interface ProjectionAssembler<TSource, TProjection> {
  name: string;
  version: number;
  assemble(input: ProjectionExecutionContext<TSource>): RuntimeProjection<TProjection>;
}

export const RUNTIME_PROJECTION_EXECUTION_BOUNDARY: ProjectionExecutionBoundary = {
  authority: 'runtime-composition',
  forbiddenOwners: ['apps', 'services', 'application-services'],
  cacheBoundary: 'runtime-composition',
  responseBoundary: 'runtime-composition',
};

export function defineProjectionAssembler<const T extends ProjectionAssembler<unknown, unknown>>(assembler: T): T {
  return assembler;
}

export async function executeProjectionRuntime<TSource, TProjection>(
  assembler: ProjectionAssembler<TSource, TProjection>,
  source: TSource,
  context: RuntimeQueryContext,
): Promise<ProjectionExecutionResult<TProjection>> {
  const startedAt = new Date().toISOString();
  const projection = assembler.assemble({
    context,
    source,
    projectionName: assembler.name,
    projectionVersion: assembler.version,
    startedAt,
  });

  return {
    projection: normalizeProjectionExecution(projection, assembler),
    metadata: {
      pipelineName: assembler.name,
      pipelineVersion: String(assembler.version),
      runtime: context.runtime,
      route: context.route,
      tenantId: context.tenantId,
      cacheKeys: projection.cachePolicy ? [projection.cachePolicy.key] : [],
      executedSteps: [`${assembler.name}:assemble`],
      startedAt,
      completedAt: new Date().toISOString(),
      correlation: context.correlation,
    },
    boundary: RUNTIME_PROJECTION_EXECUTION_BOUNDARY,
  };
}

export function normalizeProjectionExecution<TSource, TProjection>(
  projection: RuntimeProjection<TProjection>,
  assembler: ProjectionAssembler<TSource, TProjection>,
): RuntimeProjection<TProjection> {
  return {
    ...projection,
    projectionName: projection.projectionName || assembler.name,
    projectionVersion: projection.projectionVersion || assembler.version,
  };
}
