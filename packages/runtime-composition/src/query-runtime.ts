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
  let state = initialState;

  for (const step of pipeline.steps) {
    state = await step.execute(state, context);
  }

  const projection = pipeline.project(state, context);
  return {
    ...projection,
    projectionName: projection.projectionName || pipeline.name,
    projectionVersion: projection.projectionVersion || Number(pipeline.version.split('.')[0] || 1),
  };
}

export function createRuntimeCacheKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => encodeURIComponent(String(part)))
    .join(':');
}
