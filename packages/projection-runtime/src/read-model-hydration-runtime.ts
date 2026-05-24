import type { RuntimeCorrelationContext } from '@letbuyy/distributed-runtime';
import type { ProjectionStoreRecord } from './projection-store';

export interface HydrationSourceDescriptor {
  name: string;
  version: number;
  required: boolean;
  cacheable: boolean;
}

export interface HydratedReadModel<TReadModel = Record<string, unknown>> {
  record: ProjectionStoreRecord<TReadModel>;
  hydration: Record<string, unknown>;
  hydratedAt: string;
}

export interface ReadModelHydrator<TReadModel = Record<string, unknown>> {
  source: HydrationSourceDescriptor;
  hydrate(record: ProjectionStoreRecord<TReadModel>, context: RuntimeCorrelationContext): Promise<Record<string, unknown>>;
}

export class ReadModelHydrationRuntime<TReadModel = Record<string, unknown>> {
  constructor(private readonly hydrators: Array<ReadModelHydrator<TReadModel>>) {}

  async hydrate(record: ProjectionStoreRecord<TReadModel>, context: RuntimeCorrelationContext): Promise<HydratedReadModel<TReadModel>> {
    const hydration: Record<string, unknown> = {};

    for (const hydrator of this.hydrators) {
      const result = await hydrator.hydrate(record, context);
      hydration[hydrator.source.name] = result;
    }

    return {
      record,
      hydration,
      hydratedAt: new Date().toISOString(),
    };
  }
}
