export interface SearchProjectionSource {
  objectType: 'product' | 'order';
  objectId: string;
  siteId: string;
  sourceEventId: string;
  title: string;
  subtitle?: string | null;
  textParts: Array<string | number | null | undefined | string[]>;
  attributes: Record<string, unknown>;
  status: 'active' | 'hidden' | 'deleted';
  deletedAt?: string | null;
}

export interface SearchProjectionDocument {
  site_id: string;
  object_type: 'product' | 'order';
  object_id: string;
  title: string;
  subtitle?: string | null;
  searchable_text: string;
  attributes: Record<string, unknown>;
  source_event_id: string;
  status: 'active' | 'hidden' | 'deleted';
  indexed_at: string;
  deleted_at?: string | null;
}

export function queueRetryDelaySeconds(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 8));
  return Math.min(3600, 60 * 2 ** exponent);
}

export function normalizeQueueEnvelope<TEnvelope>(payload: Record<string, unknown>): TEnvelope {
  return payload as TEnvelope;
}

export function analyticsRollupDate(occurredAt?: string): string {
  const date = occurredAt ? new Date(occurredAt) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildSearchableText(...parts: Array<string | number | null | undefined | string[]>): string {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => String(part))
    .join(' ');
}

export function buildSearchProjectionDocument(source: SearchProjectionSource): SearchProjectionDocument {
  const now = new Date().toISOString();

  return {
    site_id: source.siteId,
    object_type: source.objectType,
    object_id: source.objectId,
    title: source.title,
    subtitle: source.subtitle || null,
    searchable_text: buildSearchableText(...source.textParts),
    attributes: source.attributes,
    source_event_id: source.sourceEventId,
    status: source.status,
    indexed_at: now,
    deleted_at: source.deletedAt ?? null,
  };
}
