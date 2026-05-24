import type { RuntimeProjection } from './projection';

export interface RuntimeQueryCorrelation {
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
}

export interface RuntimeQueryContext {
  runtime: string;
  route: string;
  tenantId?: string | null;
  actorId?: string | null;
  correlation: RuntimeQueryCorrelation;
}

export interface RuntimeCachePolicy {
  key: string;
  ttlSeconds: number;
  tags: string[];
  tenantScoped: boolean;
}

export interface RuntimeQueryStep<TState> {
  name: string;
  cache?: (state: TState, context: RuntimeQueryContext) => RuntimeCachePolicy | null;
  execute: (state: TState, context: RuntimeQueryContext) => Promise<TState>;
}

export interface RuntimeQueryExecutionMetadata {
  pipelineName: string;
  pipelineVersion: string;
  runtime: string;
  route: string;
  tenantId?: string | null;
  cacheKeys: string[];
  executedSteps: string[];
  startedAt: string;
  completedAt: string;
  correlation: RuntimeQueryCorrelation;
}

export interface RuntimeQueryExecutionResult<TProjection> {
  projection: RuntimeProjection<TProjection>;
  metadata: RuntimeQueryExecutionMetadata;
}

export interface RuntimeCachePort {
  read<TValue>(policy: RuntimeCachePolicy, context: RuntimeQueryContext): Promise<TValue | null>;
  write<TValue>(policy: RuntimeCachePolicy, value: TValue, context: RuntimeQueryContext): Promise<void>;
}

export interface RuntimeAggregationPipeline<TState, TProjection> {
  name: string;
  version: string;
  steps: RuntimeQueryStep<TState>[];
  project: (state: TState, context: RuntimeQueryContext) => RuntimeProjection<TProjection>;
}

export async function executeRuntimeAggregation<TState, TProjection>(
  pipeline: RuntimeAggregationPipeline<TState, TProjection>,
  initialState: TState,
  context: RuntimeQueryContext,
): Promise<RuntimeProjection<TProjection>> {
  return (await executeRuntimeQuery(pipeline, initialState, context)).projection;
}

export async function executeRuntimeQuery<TState, TProjection>(
  pipeline: RuntimeAggregationPipeline<TState, TProjection>,
  initialState: TState,
  context: RuntimeQueryContext,
  cache?: RuntimeCachePort,
): Promise<RuntimeQueryExecutionResult<TProjection>> {
  let state = initialState;
  const cacheKeys: string[] = [];
  const executedSteps: string[] = [];
  const startedAt = new Date().toISOString();

  for (const step of pipeline.steps) {
    const policy = step.cache?.(state, context);
    if (policy) {
      cacheKeys.push(policy.key);
      const cached = await cache?.read<TState>(policy, context);
      if (cached) {
        state = cached;
        executedSteps.push(`${step.name}:cache-hit`);
        continue;
      }
    }

    state = await step.execute(state, context);
    executedSteps.push(step.name);
    if (policy) await cache?.write(policy, state, context);
  }

  const projection = pipeline.project(state, context);
  return {
    projection: normalizeRuntimeProjection(projection, pipeline),
    metadata: {
      pipelineName: pipeline.name,
      pipelineVersion: pipeline.version,
      runtime: context.runtime,
      route: context.route,
      tenantId: context.tenantId,
      cacheKeys,
      executedSteps,
      startedAt,
      completedAt: new Date().toISOString(),
      correlation: context.correlation,
    },
  };
}

export function normalizeRuntimeProjection<TState, TProjection>(
  projection: RuntimeProjection<TProjection>,
  pipeline: RuntimeAggregationPipeline<TState, TProjection>,
): RuntimeProjection<TProjection> {
  return {
    ...projection,
    projectionName: projection.projectionName || pipeline.name,
    projectionVersion: projection.projectionVersion || Number(pipeline.version.split('.')[0] || 1),
  };
}

export interface RuntimeResponseEnvelope<TData = Record<string, unknown>> {
  data: TData;
  projection: {
    name: string;
    version: number;
  };
  cache?: RuntimeCachePolicy | null;
  execution: RuntimeQueryExecutionMetadata;
}

export function composeRuntimeResponse<TProjection>(
  result: RuntimeQueryExecutionResult<TProjection>,
): RuntimeResponseEnvelope<TProjection> {
  return {
    data: result.projection.data,
    projection: {
      name: result.projection.projectionName,
      version: result.projection.projectionVersion,
    },
    cache: result.projection.cachePolicy || null,
    execution: result.metadata,
  };
}

export function createRuntimeCacheKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => encodeURIComponent(String(part)))
    .join(':');
}
