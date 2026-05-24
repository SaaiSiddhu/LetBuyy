import type { StoreTemplateConfig, ThemeDraftSaveResult, ThemeEditorPayload, ThemePublishResult } from '@letbuyy/theme-engine';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';
import { defineApplicationWorkflows } from '../src/workflow-descriptor';

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
