import type { StoreTemplateConfig, ThemeDraftSaveResult, ThemeEditorPayload, ThemePublishResult } from '@letbuyy/theme-engine';
import type { RuntimeTenantContext } from '@letbuyy/tenant-core';
import type { CorrelatedCommand } from '@letbuyy/orchestration';

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
