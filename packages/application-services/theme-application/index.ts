import type { StoreTemplateConfig, ThemeDraftSaveResult, ThemeEditorPayload, ThemePublishResult } from '@letbuyy/theme-engine';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';
import { defineExecutionPipelines } from '../src/execution-pipeline';

export interface ThemeApplicationPorts {
  loadEditor(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; themeId: string }>): Promise<ThemeEditorPayload>;
  saveDraft(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; themeId: string; config: StoreTemplateConfig }>): Promise<ThemeDraftSaveResult>;
  publish(command: CorrelatedCommand<{ tenant: RuntimeTenantContext; themeId: string; message?: string }>): Promise<ThemePublishResult>;
}

export interface ThemeExecutionPolicy {
  draftVersionRequired: true;
  publishCreatesImmutableRelease: true;
  storefrontHydrationUsesReleaseSnapshot: true;
}

export const THEME_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
  resolveRuntimeSchema: {
    name: 'theme.resolve-runtime-schema',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: false,
    requiresIdempotency: false,
    emitsEvents: false,
    coordinatesDomains: ['theme'],
  },
  installTheme: {
    name: 'theme.install',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['theme', 'tenant', 'billing'],
  },
  saveDraft: {
    name: 'theme.save-draft',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: true,
    coordinatesDomains: ['theme', 'event'],
  },
  publishRelease: {
    name: 'theme.publish-release',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['theme', 'tenant', 'event'],
  },
  rollbackRelease: {
    name: 'theme.rollback-release',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: true,
    emitsEvents: true,
    coordinatesDomains: ['theme', 'tenant', 'event'],
  },
  createPreviewSession: {
    name: 'theme.create-preview-session',
    owner: 'theme-application',
    version: '1.0.0',
    requiresTenantScope: true,
    requiresIdempotency: false,
    emitsEvents: true,
    coordinatesDomains: ['theme', 'auth'],
  },
});

export const THEME_EXECUTION_PIPELINES = defineExecutionPipelines({
  resolveRuntimeSchema: {
    workflow: THEME_APPLICATION_WORKFLOWS.resolveRuntimeSchema,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'none',
    asyncBoundary: 'inline',
    observabilityBoundary: 'correlation-required',
    steps: [
      { name: 'resolve-theme-package-runtime', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'hydrate-runtime-schema', stage: 'complete', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
    ],
  },
  installTheme: {
    workflow: THEME_APPLICATION_WORKFLOWS.installTheme,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'verify-store-owner', stage: 'authorize', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'resolve-installable-theme', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'write-theme-instance', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  saveDraft: {
    workflow: THEME_APPLICATION_WORKFLOWS.saveDraft,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'validate-template-config', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'persist-theme-draft', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: false },
    ],
  },
  publishRelease: {
    workflow: THEME_APPLICATION_WORKFLOWS.publishRelease,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'validate-release-snapshot', stage: 'validate', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'publish-immutable-release', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
      { name: 'emit-theme-published-event', stage: 'publish', ownsTransaction: false, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  rollbackRelease: {
    workflow: THEME_APPLICATION_WORKFLOWS.rollbackRelease,
    executionBoundary: 'application-service',
    transactionBoundary: 'database-rpc',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'outbox',
    observabilityBoundary: 'audit-required',
    steps: [
      { name: 'load-release-snapshot', stage: 'load', ownsTransaction: false, emitsEvent: false, requiresIdempotency: true },
      { name: 'publish-rollback-release', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: true },
    ],
  },
  createPreviewSession: {
    workflow: THEME_APPLICATION_WORKFLOWS.createPreviewSession,
    executionBoundary: 'application-service',
    transactionBoundary: 'application-service-declared',
    retryBoundary: 'orchestration-runtime',
    asyncBoundary: 'inline',
    observabilityBoundary: 'trace-required',
    steps: [
      { name: 'validate-preview-scope', stage: 'authorize', ownsTransaction: false, emitsEvent: false, requiresIdempotency: false },
      { name: 'persist-preview-token', stage: 'mutate', ownsTransaction: true, emitsEvent: true, requiresIdempotency: false },
    ],
  },
});
