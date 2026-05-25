import { z } from 'zod';

export type SearchDocumentType = 'product' | 'collection' | 'page' | 'blog_post' | 'theme' | 'app';
export type SearchProvider = 'postgres' | 'typesense' | 'meilisearch' | 'algolia' | 'custom';

export const SearchQuerySchema = z.object({
  site_id: z.string().uuid().optional(),
  query: z.string().trim().max(200).default(''),
  document_types: z.array(z.enum(['product', 'collection', 'page', 'blog_post', 'theme', 'app'])).max(20).optional(),
  filters: z.record(z.string(), z.unknown()).default({}),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface SearchDocument {
  id: string;
  site_id?: string;
  type: SearchDocumentType;
  title: string;
  body?: string;
  url?: string;
  image_url?: string;
  tags?: string[];
  attributes: Record<string, unknown>;
  updated_at: string;
}

export interface SearchIndexingJob {
  document: SearchDocument;
  action: 'upsert' | 'delete';
  provider?: SearchProvider;
  idempotency_key: string;
}

export interface SearchResult<TDocument extends SearchDocument = SearchDocument> {
  document: TDocument;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface RankingPolicy {
  key: string;
  provider: SearchProvider;
  weights: Record<string, number>;
}

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
