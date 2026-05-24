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

export interface RenderingPipelineContract {
  loadTheme(input: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
  compose(input: StorefrontCompositionInput): Promise<StorefrontCompositionResult>;
  hydrate(config: MerchantConfigHydrationInput): Promise<HydratedThemeConfig>;
}

export interface RuntimeThemeLoader {
  loadPublishedTheme(storeId: string, context: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
  loadPreviewTheme(storeId: string, previewToken: string, context: ThemeEngineRenderContext): Promise<StoreTemplateConfig | null>;
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
