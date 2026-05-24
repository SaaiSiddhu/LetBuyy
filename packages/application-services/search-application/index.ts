import type { SearchDocument, SearchIndexingJob, SearchQueryInput, SearchResult } from '@letbuyy/search-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

export const SEARCH_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  query: {
    name: 'search.query',
    owner: 'search-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['search-core', 'tenant-core'],
  },
  indexDocument: {
    name: 'search.index-document',
    owner: 'search-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['search-core', 'tenant-core', 'event-core'],
  },
  rebuildTenantIndex: {
    name: 'search.rebuild-tenant-index',
    owner: 'search-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['search-core', 'tenant-core', 'event-core'],
  },
});

export interface SearchApplicationPorts {
  query(command: CorrelatedCommand<{ tenant?: RuntimeTenantContext; input: SearchQueryInput }>): Promise<SearchResult>;
  indexDocument(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; document: SearchDocument }>): Promise<SearchIndexingJob>;
  rebuildTenantIndex(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; reason: string }>): Promise<SearchIndexingJob>;
}

export interface SearchExecutionPolicy {
  tenantScopedIndexes: true;
  publicSearchExcludesPrivateFields: true;
  indexingJobsAreReplayable: true;
}
