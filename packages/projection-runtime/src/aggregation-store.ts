import type { ProjectionIdentity } from './projection-store';

export interface AggregationWindow {
  granularity: 'minute' | 'hour' | 'day' | 'month' | 'all-time';
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface AggregationStoreRecord {
  identity: ProjectionIdentity;
  metricName: string;
  dimensions: Record<string, string | number | boolean | null>;
  value: number;
  window: AggregationWindow;
  sourceEventId?: string | null;
  updatedAt: string;
}

export interface AggregationStorePort {
  increment(record: AggregationStoreRecord, amount: number): Promise<AggregationStoreRecord>;
  read(identity: ProjectionIdentity, metricName: string, dimensions: Record<string, string | number | boolean | null>): Promise<AggregationStoreRecord | null>;
}

export function aggregationDimensionKey(dimensions: Record<string, string | number | boolean | null>): string {
  return Object.entries(dimensions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}
