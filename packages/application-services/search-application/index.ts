import type { SearchDocument, SearchIndexingJob, SearchQueryInput, SearchResult } from '@letbuyy/search-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
