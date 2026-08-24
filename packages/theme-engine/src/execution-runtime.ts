import type {
  BlockModel,
  SectionModel,
  SectionType,
  StorefrontSectionGroupConfig,
  StorefrontTemplateConfig,
  StoreTemplateConfig,
  ThemeSettings,
} from './index';

export interface ThemeEngineRenderContext {
  storeId: string;
  subdomain: string;
  path: string;
  previewMode: boolean;
  requestId?: string;
  locale?: string;
  // T1/W2 — optional query-string values from the page request (e.g. ?error=bot_verification
  // after a failed Turnstile challenge), exposed to Liquid templates as request.query so a form
  // can render a real, human error message instead of a silent redirect. Never trust these for
  // anything beyond display text — they are merchant/shopper-visible page state, not auth input.
  searchParams?: Record<string, string>;
}

export interface SectionRuntimeDefinition<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  type: SectionType;
  rendererKey: string;
  schemaVersion: string;
  defaultSettings: TSettings;
  allowedBlockTypes?: string[];
}

export interface BlockRuntimeDefinition<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  type: string;
  rendererKey: string;
  schemaVersion: string;
  defaultSettings: TSettings;
}

export interface SectionRegistryRuntime {
  registerSection(definition: SectionRuntimeDefinition): void;
  getSection(type: SectionType): SectionRuntimeDefinition | undefined;
  listSections(): SectionRuntimeDefinition[];
}

export interface BlockRegistryRuntime {
  registerBlock(definition: BlockRuntimeDefinition): void;
  getBlock(type: string): BlockRuntimeDefinition | undefined;
  listBlocks(): BlockRuntimeDefinition[];
}

export interface SchemaHydrationInput {
  sections: SectionModel[];
  sectionRegistry: SectionRegistryRuntime;
  blockRegistry: BlockRegistryRuntime;
}

export interface MerchantConfigHydrationInput {
  themeSettings: Partial<ThemeSettings>;
  template?: StorefrontTemplateConfig;
  sectionGroups?: Record<string, StorefrontSectionGroupConfig>;
}

export interface HydratedThemeConfig {
  themeSettings: ThemeSettings;
  sections: SectionModel[];
  sectionGroups?: Record<string, StorefrontSectionGroupConfig>;
  templates?: Record<string, StorefrontTemplateConfig>;
}

export interface StorefrontCompositionInput {
  context: ThemeEngineRenderContext;
  storeTemplate: StoreTemplateConfig;
  routeTemplate?: StorefrontTemplateConfig;
}

export interface StorefrontCompositionResult {
  context: ThemeEngineRenderContext;
  layoutKey: string;
  themeSettings: ThemeSettings;
  sections: SectionModel[];
  sectionGroups: Record<string, StorefrontSectionGroupConfig>;
  hydrationManifest: ThemeHydrationManifest;
}

export interface ThemeHydrationManifest {
  engineVersion: string;
  schemaVersion?: string;
  releaseId?: string;
  releaseVersion?: number;
  sectionCount: number;
  blockCount: number;
  rendererKeys: string[];
}

export interface ThemeRuntimeCompositionMetadata {
  authority: 'theme-engine';
  storeId: string;
  path: string;
  previewMode: boolean;
  requestId?: string;
  layoutKey: string;
  sectionCount: number;
  blockCount: number;
  executedAt: string;
}

export interface RenderingPipelineContract {
  loadTheme(input: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
  compose(input: StorefrontCompositionInput): Promise<StorefrontCompositionResult>;
  hydrate(config: MerchantConfigHydrationInput): Promise<HydratedThemeConfig>;
}

export interface RuntimeThemeLoader {
  loadPublishedTheme(storeId: string, context: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
  loadPreviewTheme(storeId: string, previewToken: string, context: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
}

export interface RuntimeSectionInjection {
  position: 'before' | 'after' | 'replace';
  targetSectionId?: string;
  section: SectionModel;
}

export interface ThemeSectionExecutionContext {
  storeId: string;
  sectionId: string;
  sectionType: SectionType;
  lifecycle: 'load' | 'hydrate' | 'render' | 'dispose';
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeSectionExecutionResult {
  section: SectionModel;
  rendererKey?: string;
  schemaVersion?: string;
  lifecycle: ThemeSectionExecutionContext['lifecycle'];
  metadata?: SectionExecutionMetadata;
}

export interface SectionExecutionMetadata {
  authority: 'theme-engine';
  storeId: string;
  sectionId: string;
  sectionType: SectionType;
  lifecycle: ThemeSectionExecutionContext['lifecycle'];
  rendererKey?: string;
  schemaVersion?: string;
  executedAt: string;
}

export interface RuntimeBlockExecutionContext {
  storeId: string;
  sectionId: string;
  blockId: string;
  blockType: string;
  lifecycle: 'load' | 'hydrate' | 'render' | 'dispose';
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeBlockExecutionResult {
  block: BlockModel;
  rendererKey?: string;
  schemaVersion?: string;
  lifecycle: RuntimeBlockExecutionContext['lifecycle'];
  metadata: {
    authority: 'theme-engine';
    storeId: string;
    sectionId: string;
    blockId: string;
    blockType: string;
    executedAt: string;
  };
}

export interface LayoutRuntimeExecutionContext {
  context: ThemeEngineRenderContext;
  layoutKey: string;
  sectionGroups: Record<string, StorefrontSectionGroupConfig>;
}

export interface LayoutRuntimeExecutionResult {
  layoutKey: string;
  sectionGroups: Record<string, StorefrontSectionGroupConfig>;
  metadata: ThemeRuntimeCompositionMetadata;
}

export interface RuntimeTemplateExecutionInput {
  context: ThemeEngineRenderContext;
  template: StorefrontTemplateConfig;
  storeTemplate: StoreTemplateConfig;
  injections?: RuntimeSectionInjection[];
}

export interface RuntimeTemplateExecutionResult extends StorefrontCompositionResult {
  templateId?: string;
  executedSectionIds: string[];
  metadata?: ThemeRuntimeCompositionMetadata;
}

export interface ThemeRuntimeOrchestrator {
  sectionRegistry: SectionRegistryRuntime;
  blockRegistry: BlockRegistryRuntime;
  loader: RuntimeThemeLoader;
}

export class InMemorySectionRegistryRuntime implements SectionRegistryRuntime {
  private readonly sections = new Map<SectionType, SectionRuntimeDefinition>();

  registerSection(definition: SectionRuntimeDefinition): void {
    this.sections.set(definition.type, definition);
  }

  getSection(type: SectionType): SectionRuntimeDefinition | undefined {
    return this.sections.get(type);
  }

  listSections(): SectionRuntimeDefinition[] {
    return [...this.sections.values()];
  }
}

export class InMemoryBlockRegistryRuntime implements BlockRegistryRuntime {
  private readonly blocks = new Map<string, BlockRuntimeDefinition>();

  registerBlock(definition: BlockRuntimeDefinition): void {
    this.blocks.set(definition.type, definition);
  }

  getBlock(type: string): BlockRuntimeDefinition | undefined {
    return this.blocks.get(type);
  }

  listBlocks(): BlockRuntimeDefinition[] {
    return [...this.blocks.values()];
  }
}

export function hydrateSectionSchemas(input: SchemaHydrationInput): SectionModel[] {
  return input.sections.map((section) => {
    const definition = input.sectionRegistry.getSection(section.type);
    const blocks = section.blocks?.map((block) => hydrateBlockSchema(block, input.blockRegistry));

    return {
      ...section,
      rendererKey: section.rendererKey || definition?.rendererKey,
      schemaVersion: section.schemaVersion || definition?.schemaVersion,
      settings: {
        ...(definition?.defaultSettings || {}),
        ...section.settings,
      },
      blocks,
    };
  });
}

function hydrateBlockSchema(block: BlockModel, registry: BlockRegistryRuntime): BlockModel {
  const definition = registry.getBlock(block.type);
  return {
    ...block,
    rendererKey: block.rendererKey || definition?.rendererKey,
    schemaVersion: block.schemaVersion || definition?.schemaVersion,
    settings: {
      ...(definition?.defaultSettings || {}),
      ...block.settings,
    },
  };
}

export function createThemeHydrationManifest(config: StoreTemplateConfig): ThemeHydrationManifest {
  const sections = [
    ...config.sections,
    ...Object.values(config.sectionGroups || {}).flatMap((group) => group.sections),
    ...Object.values(config.templates || {}).flatMap((template) => template.sections),
  ];
  const blocks = sections.flatMap((section) => section.blocks || []);

  return {
    engineVersion: config.engineVersion || 'theme-engine-v1',
    releaseId: config.releaseId,
    releaseVersion: config.releaseVersion,
    sectionCount: sections.length,
    blockCount: blocks.length,
    rendererKeys: [...new Set([
      ...sections.map((section) => section.rendererKey).filter((value): value is string => Boolean(value)),
      ...blocks.map((block) => block.rendererKey).filter((value): value is string => Boolean(value)),
    ])],
  };
}

export function composeStorefrontTheme(input: StorefrontCompositionInput): StorefrontCompositionResult {
  const routeTemplate = input.routeTemplate;
  const sections = routeTemplate?.sections?.length ? routeTemplate.sections : input.storeTemplate.sections;
  const sectionGroups = input.storeTemplate.sectionGroups || {};

  return {
    context: input.context,
    layoutKey: routeTemplate?.layoutKey || 'theme',
    themeSettings: input.storeTemplate.themeSettings,
    sections: sections.filter((section) => section.isVisible !== false).sort((left, right) => left.order - right.order),
    sectionGroups,
    hydrationManifest: createThemeHydrationManifest(input.storeTemplate),
  };
}

export async function loadRuntimeTheme(
  orchestrator: ThemeRuntimeOrchestrator,
  context: ThemeEngineRenderContext,
  previewToken?: string | null,
): Promise<StoreTemplateConfig | null> {
  return previewToken
    ? orchestrator.loader.loadPreviewTheme(context.storeId, previewToken, context)
    : orchestrator.loader.loadPublishedTheme(context.storeId, context);
}

export function injectRuntimeSections(sections: SectionModel[], injections: RuntimeSectionInjection[]): SectionModel[] {
  let next = [...sections];

  for (const injection of injections) {
    if (!injection.targetSectionId) {
      next = [...next, injection.section];
      continue;
    }

    const targetIndex = next.findIndex((section) => section.id === injection.targetSectionId);
    if (targetIndex === -1) {
      next = [...next, injection.section];
      continue;
    }

    if (injection.position === 'replace') {
      next = [
        ...next.slice(0, targetIndex),
        injection.section,
        ...next.slice(targetIndex + 1),
      ];
    } else if (injection.position === 'before') {
      next = [
        ...next.slice(0, targetIndex),
        injection.section,
        ...next.slice(targetIndex),
      ];
    } else {
      next = [
        ...next.slice(0, targetIndex + 1),
        injection.section,
        ...next.slice(targetIndex + 1),
      ];
    }
  }

  return next.map((section, index) => ({ ...section, order: section.order ?? index }));
}

export function executeRuntimeSectionLifecycle(
  orchestrator: Pick<ThemeRuntimeOrchestrator, 'sectionRegistry' | 'blockRegistry'>,
  section: SectionModel,
  context: Omit<ThemeSectionExecutionContext, 'sectionId' | 'sectionType'>,
): RuntimeSectionExecutionResult {
  const hydrated = hydrateSectionSchemas({
    sections: [section],
    sectionRegistry: orchestrator.sectionRegistry,
    blockRegistry: orchestrator.blockRegistry,
  })[0] || section;

  return {
    section: hydrated,
    rendererKey: hydrated.rendererKey,
    schemaVersion: hydrated.schemaVersion,
    lifecycle: context.lifecycle,
    metadata: {
      authority: 'theme-engine',
      storeId: context.storeId,
      sectionId: hydrated.id,
      sectionType: hydrated.type,
      lifecycle: context.lifecycle,
      rendererKey: hydrated.rendererKey,
      schemaVersion: hydrated.schemaVersion,
      executedAt: new Date().toISOString(),
    },
  };
}

export function executeRuntimeBlockLifecycle(
  orchestrator: Pick<ThemeRuntimeOrchestrator, 'blockRegistry'>,
  block: BlockModel,
  context: RuntimeBlockExecutionContext,
): RuntimeBlockExecutionResult {
  const hydrated = hydrateBlockSchema(block, orchestrator.blockRegistry);

  return {
    block: hydrated,
    rendererKey: hydrated.rendererKey,
    schemaVersion: hydrated.schemaVersion,
    lifecycle: context.lifecycle,
    metadata: {
      authority: 'theme-engine',
      storeId: context.storeId,
      sectionId: context.sectionId,
      blockId: hydrated.id,
      blockType: hydrated.type,
      executedAt: new Date().toISOString(),
    },
  };
}

export function executeRuntimeTemplate(
  orchestrator: Pick<ThemeRuntimeOrchestrator, 'sectionRegistry' | 'blockRegistry'>,
  input: RuntimeTemplateExecutionInput,
): RuntimeTemplateExecutionResult {
  const composition = hydrateAndComposeStorefrontTheme(
    orchestrator,
    {
      context: input.context,
      storeTemplate: input.storeTemplate,
      routeTemplate: input.template,
    },
    input.injections || [],
  );

  return {
    ...composition,
    templateId: input.template.id,
    executedSectionIds: composition.sections.map((section) => section.id),
    metadata: createThemeRuntimeCompositionMetadata(composition),
  };
}

export function executeLayoutRuntime(input: LayoutRuntimeExecutionContext): LayoutRuntimeExecutionResult {
  return {
    layoutKey: input.layoutKey,
    sectionGroups: input.sectionGroups,
    metadata: {
      authority: 'theme-engine',
      storeId: input.context.storeId,
      path: input.context.path,
      previewMode: input.context.previewMode,
      requestId: input.context.requestId,
      layoutKey: input.layoutKey,
      sectionCount: Object.values(input.sectionGroups).flatMap((group) => group.sections).length,
      blockCount: Object.values(input.sectionGroups).flatMap((group) => group.sections).flatMap((section) => section.blocks || []).length,
      executedAt: new Date().toISOString(),
    },
  };
}

export function createThemeRuntimeCompositionMetadata(
  composition: StorefrontCompositionResult,
): ThemeRuntimeCompositionMetadata {
  return {
    authority: 'theme-engine',
    storeId: composition.context.storeId,
    path: composition.context.path,
    previewMode: composition.context.previewMode,
    requestId: composition.context.requestId,
    layoutKey: composition.layoutKey,
    sectionCount: composition.sections.length,
    blockCount: composition.sections.flatMap((section) => section.blocks || []).length,
    executedAt: new Date().toISOString(),
  };
}

export function hydrateAndComposeStorefrontTheme(
  orchestrator: Pick<ThemeRuntimeOrchestrator, 'sectionRegistry' | 'blockRegistry'>,
  input: StorefrontCompositionInput,
  injections: RuntimeSectionInjection[] = [],
): StorefrontCompositionResult {
  const composed = composeStorefrontTheme(input);
  const injectedSections = injectRuntimeSections(composed.sections, injections);
  const hydratedSections = hydrateSectionSchemas({
    sections: injectedSections,
    sectionRegistry: orchestrator.sectionRegistry,
    blockRegistry: orchestrator.blockRegistry,
  });

  return {
    ...composed,
    sections: hydratedSections,
    hydrationManifest: {
      ...composed.hydrationManifest,
      sectionCount: hydratedSections.length,
      blockCount: hydratedSections.flatMap((section) => section.blocks || []).length,
      rendererKeys: [...new Set([
        ...composed.hydrationManifest.rendererKeys,
        ...hydratedSections.map((section) => section.rendererKey).filter((value): value is string => Boolean(value)),
      ])],
    },
  };
}
