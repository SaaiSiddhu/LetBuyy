import type { RuntimeProjection } from './projection';
import type { RuntimeQueryContext, RuntimeQueryExecutionMetadata } from './query-runtime';

export interface RuntimeCompositionInput<TData = Record<string, unknown>> {
  projection: RuntimeProjection<TData>;
  context: RuntimeQueryContext;
  hydration?: Record<string, unknown>;
}

export interface RuntimeCompositionResult<TData = Record<string, unknown>> {
  data: TData;
  hydration: Record<string, unknown>;
  metadata: RuntimeQueryExecutionMetadata;
}

export interface HydrationAggregator<TData = Record<string, unknown>> {
  name: string;
  aggregate(input: RuntimeCompositionInput<TData>): Promise<Record<string, unknown>>;
}

export async function composeHydratedRuntimeProjection<TData>(
  input: RuntimeCompositionInput<TData>,
  aggregators: Array<HydrationAggregator<TData>>,
): Promise<RuntimeCompositionResult<TData>> {
  const hydration: Record<string, unknown> = { ...(input.hydration || {}) };
  const executedSteps: string[] = [];

  for (const aggregator of aggregators) {
    hydration[aggregator.name] = await aggregator.aggregate(input);
    executedSteps.push(aggregator.name);
  }

  return {
    data: input.projection.data,
    hydration,
    metadata: {
      pipelineName: input.projection.projectionName,
      pipelineVersion: String(input.projection.projectionVersion),
      runtime: input.context.runtime,
      route: input.context.route,
      tenantId: input.context.tenantId,
      cacheKeys: input.projection.cachePolicy ? [input.projection.cachePolicy.key] : [],
      executedSteps,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      correlation: input.context.correlation,
    },
  };
}
