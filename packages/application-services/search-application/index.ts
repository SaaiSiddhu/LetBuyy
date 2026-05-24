import type { SearchDocument, SearchIndexingJob, SearchQueryInput, SearchResult } from '@letbuyy/search-core';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

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

export const SEARCH_EXECUTION_PIPELINES = defineExecutionPipelines({
  query: {
    workflow: SEARCH_APPLICATION_WORKFLOWS.query,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'resolve-search-scope', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'shape-search-response', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  indexDocument: {
    workflow: SEARCH_APPLICATION_WORKFLOWS.indexDocument,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'queue',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'load-index-source', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'delegate-search-index-plan', stage: 'plan', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'persist-search-document', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  rebuildTenantIndex: {
    workflow: SEARCH_APPLICATION_WORKFLOWS.rebuildTenantIndex,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'queue',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'resolve-tenant-index-scope', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'schedule-index-replay', stage: 'publish', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
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
