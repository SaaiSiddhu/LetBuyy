import type { StoreModel, SiteType, PaymentGateway, NavPage, StoreNavigation } from '@letbuyy/tenant-core';
import { normalizeAppBlockInstances, type AppBlockInstance } from '@letbuyy/shared-types';
import { DEFAULT_THEME_SETTINGS, LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import type { ThemeSettings, SectionModel, SectionType, BlockModel, StorefrontSectionGroupConfig, StorefrontTemplateConfig } from '@letbuyy/theme-engine';
import { createStorefrontApiClient, storefrontReadInit } from './api/client';
import {
    getDefaultStorefrontThemeTemplate,
    hasRenderableThemeTemplate,
    localizeThemeTemplateConfig,
} from '@letbuyy/theme-engine';
import { getUrbanKicksDemoStore as buildUrbanKicksDemoStore } from './demo/urban-kicks-demo';

interface ThemeReleaseRow {
    id: string;
    theme_id: string;
    theme_instance_id?: string | null;
    theme_package_version_id?: string | null;
    release_version: number;
    release_config: Record<string, unknown> | null;
    release_manifest?: Record<string, unknown> | null;
    template_snapshot?: Record<string, unknown> | null;
    settings_snapshot?: Record<string, unknown> | null;
    asset_manifest?: Record<string, unknown> | null;
    cache_manifest?: Record<string, unknown> | null;
    data_binding_manifest?: Record<string, unknown> | null;
    schema_manifest_version?: string | null;
    engine_version?: string | null;
    published_at: string | null;
}

type WorkerStorePayload = Record<string, unknown> & {
    current_theme_release?: ThemeReleaseRow | null;
    app_blocks?: unknown;
};

type WorkerNavigationItem = {
    id?: string;
    label?: string;
    href?: string;
    openInNewTab?: boolean;
    targetType?: string;
    targetResourceId?: string | null;
    metadata?: Record<string, unknown>;
    children?: WorkerNavigationItem[];
};

type WorkerNavigationPayload = {
    items?: WorkerNavigationItem[];
};

const STOREFRONT_REVALIDATE_SECONDS = 60;

/**
 * A store read that failed.
 *
 * `null` from these methods means "no such store", and the storefront layout
 * renders that as notFound() — an HTTP 404. Catching a FETCH FAILURE into the
 * same `null` therefore told shoppers and search engines that a live merchant's
 * shop did not exist, and a 404 is cacheable. Throwing routes the outage to the
 * storefront error boundary (app/error.tsx) with its working `reset()` retry
 * instead, and leaves "genuinely absent" as the only thing `null` can mean.
 */
export class StorefrontStoreError extends Error {
    readonly cause?: unknown;
    constructor(operation: string, cause: unknown) {
        super(`Storefront store read failed: ${operation}`);
        this.name = 'StorefrontStoreError';
        this.cause = cause;
    }
}

export const StoreService = {
    getUrbanKicksDemoStore(): StoreModel {
        return buildUrbanKicksDemoStore();
    },

    async getStoreBySubdomain(subdomain: string): Promise<StoreModel | null> {
        try {
            const [data, navigation] = await Promise.all([
                fetchWorkerStore(subdomain, false),
                fetchWorkerNavigationBundle(subdomain),
            ]);
            return data ? mapSupabaseToStore(data, data.current_theme_release || null, navigation) : null;

        } catch (error) {
            console.error('[StoreService] Error fetching store through worker:', error);
            throw new StorefrontStoreError('getStoreBySubdomain', error);
        }
    },

    async getPreviewStoreBySubdomain(subdomain: string, previewToken: string): Promise<StoreModel | null> {
        if (!previewToken || previewToken.length > 200) return null;

        try {
            const [data, navigation] = await Promise.all([
                fetchWorkerPreviewStore(subdomain, previewToken),
                fetchWorkerNavigationBundle(subdomain),
            ]);
            return data ? mapSupabaseToStore(data, data.current_theme_release || null, navigation) : null;
        } catch (error) {
            console.error('[StoreService] Error fetching preview store through worker:', error);
            throw new StorefrontStoreError('getPreviewStoreBySubdomain', error);
        }
    },

    async getStoreBySubdomainAnyStatus(subdomain: string): Promise<StoreModel | null> {
        try {
            const data = await fetchWorkerStore(subdomain, true);
            if (!data) return null;

            if (data.status !== 'published') {
                return mapStatusOnlyStore(data);
            }

            const publishedData = await fetchWorkerStore(subdomain, false);
            const storeData = publishedData || data;
            const navigation = await fetchWorkerNavigationBundle(subdomain);

            return mapSupabaseToStore(storeData, storeData.current_theme_release || null, navigation);
        } catch (error) {
            console.error('[StoreService] Error fetching store status through worker:', error);
            throw new StorefrontStoreError('getStoreBySubdomainAnyStatus', error);
        }
    },

    async getStoreById(storeId: string): Promise<StoreModel | null> {
        try {
            const data = await createStorefrontApiClient(
                storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [`storefront:store:${storeId}`]),
            ).storefront.getStoreById(storeId) as WorkerStorePayload | undefined;
            return data ? mapSupabaseToStore(data, data.current_theme_release || null) : null;
        } catch (error) {
            console.error('[StoreService] Error fetching store by ID through worker:', error);
            throw new StorefrontStoreError('getStoreById', error);
        }
    }
};

// ============= HELPER FUNCTIONS =============

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

function normalizeBlockRecord(value: Record<string, unknown>, index: number): BlockModel {
    return {
        id: (value.id as string) || `block-${index}`,
        type: (value.type as string) || 'block',
        order: (value.order as number) || index,
        rendererKey: typeof value.rendererKey === 'string'
            ? value.rendererKey
            : typeof value.renderer_key === 'string' ? value.renderer_key : undefined,
        schemaVersion: typeof value.schemaVersion === 'string'
            ? value.schemaVersion
            : typeof value.schema_version === 'string' ? value.schema_version : undefined,
        settings: asRecord(value.settings),
        isVisible: value.disabled === true
            ? false
            : value.visible !== undefined ? value.visible !== false : value.isVisible !== false,
    };
}

function normalizeBlockCollection(value: unknown, orderValue: unknown): BlockModel[] {
    if (Array.isArray(value)) {
        return value.map((block, blockIndex) => normalizeBlockRecord(asRecord(block), blockIndex));
    }

    const blockMap = asRecord(value);
    const orderedIds = stringArray(orderValue);
    const ids = [
        ...orderedIds,
        ...Object.keys(blockMap).filter((blockId) => !orderedIds.includes(blockId)),
    ];

    return ids
        .map((blockId, blockIndex) => {
            const blockRecord = asRecord(blockMap[blockId]);
            if (Object.keys(blockRecord).length === 0) return null;
            return normalizeBlockRecord({ id: blockId, order: blockIndex, ...blockRecord }, blockIndex);
        })
        .filter((block): block is BlockModel => block !== null);
}

function appBlockSlotId(slot: string): string {
    return slot
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'default';
}

function sectionAppBlockSlot(section: SectionModel): string {
    const slot = section.settings.slot;
    return typeof slot === 'string' && slot.trim().length > 0
        ? slot.trim()
        : 'storefront.home.after-hero';
}

function appBlockToThemeBlock(block: AppBlockInstance, order: number): BlockModel {
    return {
        id: block.id,
        type: 'app-block',
        order,
        rendererKey: 'apps.app-block',
        settings: {
            ...block.settings,
            id: block.id,
            app_id: block.app_id,
            extension_id: block.extension_id,
            slot: block.slot,
            title: block.title,
            render_mode: block.render_mode,
            iframe_url: block.iframe_url,
            content: block.content,
        },
        isVisible: true,
    };
}

function injectAppBlocksIntoSections(sections: SectionModel[], appBlocksInput: unknown): SectionModel[] {
    const appBlocks = normalizeAppBlockInstances(appBlocksInput);
    if (appBlocks.length === 0) return sections;

    const blocksBySlot = new Map<string, AppBlockInstance[]>();
    for (const block of appBlocks) {
        const existing = blocksBySlot.get(block.slot) || [];
        blocksBySlot.set(block.slot, [...existing, block]);
    }

    const usedBlockIds = new Set<string>();
    const nextSections = sections.map((section) => {
        const normalizedType = normalizeSectionType(section.type);
        if (normalizedType !== 'appBlockSlot') return section;

        const slot = sectionAppBlockSlot(section);
        const matchingBlocks = blocksBySlot.get(slot) || [];
        if (matchingBlocks.length === 0) return section;

        const existingBlocks = section.blocks || [];
        const existingIds = new Set(existingBlocks.map((block) => block.id));
        const injectedBlocks = matchingBlocks
            .filter((block) => !existingIds.has(block.id))
            .map((block, index) => {
                usedBlockIds.add(block.id);
                return appBlockToThemeBlock(block, existingBlocks.length + index);
            });

        if (injectedBlocks.length === 0) return section;

        return {
            ...section,
            type: 'appBlockSlot' as SectionType,
            rendererKey: section.rendererKey || 'apps.app-block-slot',
            settings: {
                ...section.settings,
                slot,
            },
            blocks: [...existingBlocks, ...injectedBlocks],
        };
    });

    const remainingBlocks = appBlocks.filter((block) => !usedBlockIds.has(block.id));
    if (remainingBlocks.length === 0) return nextSections;

    const maxOrder = nextSections.reduce((max, section) => Math.max(max, section.order), 0);
    const remainingSlots = Array.from(new Set(remainingBlocks.map((block) => block.slot)));
    const generatedSections = remainingSlots.map((slot, slotIndex): SectionModel => {
        const blocks = remainingBlocks
            .filter((block) => block.slot === slot)
            .map((block, blockIndex) => appBlockToThemeBlock(block, blockIndex));

        return {
            id: `app-block-slot-${appBlockSlotId(slot)}`,
            type: 'appBlockSlot',
            order: maxOrder + slotIndex + 1,
            rendererKey: 'apps.app-block-slot',
            settings: {
                slot,
                title: 'Apps',
                layout: 'grid',
            },
            blocks,
            isVisible: true,
        };
    });

    return [...nextSections, ...generatedSections];
}

function injectAppBlocksIntoTemplates(
    templates: Record<string, StorefrontTemplateConfig> | undefined,
    appBlocksInput: unknown,
): Record<string, StorefrontTemplateConfig> | undefined {
    if (!templates) return templates;

    const nextTemplates: Record<string, StorefrontTemplateConfig> = {};
    for (const [key, template] of Object.entries(templates)) {
        nextTemplates[key] = {
            ...template,
            sections: injectAppBlocksIntoSections(template.sections || [], appBlocksInput),
        };
    }

    return nextTemplates;
}

function normalizeSectionRecord(
    value: Record<string, unknown>,
    index: number,
    definition: Record<string, unknown> = {},
): SectionModel {
    const rawType = (value.type as string) || (definition.type as string) || `section-${index}`;
    const rendererKey = typeof value.rendererKey === 'string'
        ? value.rendererKey
        : typeof value.renderer_key === 'string'
            ? value.renderer_key
            : typeof definition.renderer_key === 'string'
                ? definition.renderer_key
                : undefined;
    const schemaVersion = typeof value.schemaVersion === 'string'
        ? value.schemaVersion
        : typeof value.schema_version === 'string'
            ? value.schema_version
            : typeof definition.schema_version === 'string'
                ? definition.schema_version
                : undefined;

    return {
        id: (value.id as string) || `section-${index}`,
        type: normalizeSectionType(rawType) as SectionType,
        order: (value.order as number) || index,
        rendererKey,
        schemaVersion,
        settings: asRecord(value.settings),
        blocks: normalizeBlockCollection(value.blocks, value.block_order),
        isVisible: value.disabled === true
            ? false
            : value.visible !== undefined ? value.visible !== false : value.isVisible !== false,
    };
}

function normalizeSectionArray(value: unknown): SectionModel[] {
    return Array.isArray(value)
        ? value.map((section, index) => normalizeSectionRecord(asRecord(section), index))
        : [];
}

function normalizeTemplateSectionMap(
    value: unknown,
    orderValue: unknown,
    sectionDefinitions: Record<string, unknown>,
): SectionModel[] {
    const sectionMap = asRecord(value);
    const orderedIds = stringArray(orderValue);
    const ids = [
        ...orderedIds,
        ...Object.keys(sectionMap).filter((sectionId) => !orderedIds.includes(sectionId)),
    ];

    return ids
        .map((sectionId, index) => {
            const sectionRecord = asRecord(sectionMap[sectionId]);
            if (Object.keys(sectionRecord).length === 0) return null;
            const sectionType = typeof sectionRecord.type === 'string' ? sectionRecord.type : sectionId;
            return normalizeSectionRecord(
                {
                    id: sectionId,
                    order: index,
                    ...sectionRecord,
                },
                index,
                asRecord(sectionDefinitions[sectionType]),
            );
        })
        .filter((section): section is SectionModel => section !== null);
}

function normalizeTemplateSections(
    templateRecord: Record<string, unknown>,
    sectionDefinitions: Record<string, unknown>,
): SectionModel[] {
    return Array.isArray(templateRecord.sections)
        ? normalizeSectionArray(templateRecord.sections)
        : normalizeTemplateSectionMap(templateRecord.sections, templateRecord.order, sectionDefinitions);
}

function normalizeSectionGroups(value: unknown): Record<string, StorefrontSectionGroupConfig> | undefined {
    const groups = asRecord(value);
    const normalized: Record<string, StorefrontSectionGroupConfig> = {};

    for (const [key, groupValue] of Object.entries(groups)) {
        const groupRecord = asRecord(groupValue);
        const sections = Array.isArray(groupValue)
            ? normalizeSectionArray(groupValue)
            : normalizeSectionArray(groupRecord.sections);

        normalized[key] = {
            id: (groupRecord.id as string) || key,
            role: groupRecord.role === 'header' || groupRecord.role === 'footer' || groupRecord.role === 'aside'
                ? groupRecord.role
                : key === 'header' || key === 'footer' ? key : 'custom',
            sections,
        };
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeTemplates(
    value: unknown,
    sectionDefinitions: Record<string, unknown> = {},
): Record<string, StorefrontTemplateConfig> | undefined {
    const templates = asRecord(value);
    const normalized: Record<string, StorefrontTemplateConfig> = {};

    for (const [key, templateValue] of Object.entries(templates)) {
        const templateRecord = asRecord(templateValue);
        const sections = normalizeTemplateSections(templateRecord, sectionDefinitions);

        normalized[key] = {
            id: (templateRecord.id as string) || key,
            type: (templateRecord.type as string) || key,
            layoutKey: (templateRecord.layoutKey as string) || 'theme',
            sections,
        };
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isThemeBundleSectionDefinitionMap(value: unknown): boolean {
    const sectionMap = asRecord(value);
    return Object.values(sectionMap).some((sectionValue) => {
        const section = asRecord(sectionValue);
        return typeof section.type === 'string'
            && (typeof section.renderer_key === 'string' || Object.keys(asRecord(section.settings_schema)).length > 0);
    });
}

async function fetchWorkerStore(subdomain: string, anyStatus: boolean): Promise<WorkerStorePayload | null> {
    const client = createStorefrontApiClient(
        storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [
            `storefront:${subdomain}`,
            anyStatus ? `storefront:${subdomain}:status` : `storefront:${subdomain}:published`,
        ]),
    );

    const data = anyStatus
        ? await client.storefront.status(subdomain)
        : await client.storefront.getStore(subdomain);

    return (data as WorkerStorePayload | undefined) || null;
}

async function fetchWorkerPreviewStore(subdomain: string, previewToken: string): Promise<WorkerStorePayload | null> {
    const data = await createStorefrontApiClient().storefront.themePreview(subdomain, previewToken);
    return (data as WorkerStorePayload | undefined) || null;
}

function mapWorkerNavigationItem(item: WorkerNavigationItem, index: number): NavPage {
    const id = typeof item.id === 'string' && item.id ? item.id : `nav-${index}`;
    const href = typeof item.href === 'string' && item.href ? item.href : '#';
    const label = typeof item.label === 'string' && item.label ? item.label : href;

    return {
        id,
        label,
        href,
        isDefault: false,
        isVisible: true,
        openInNewTab: item.openInNewTab === true,
        targetType: typeof item.targetType === 'string' ? item.targetType : undefined,
        targetResourceId: item.targetResourceId || null,
        metadata: item.metadata || {},
        children: Array.isArray(item.children)
            ? item.children.map((child, childIndex) => mapWorkerNavigationItem(child, childIndex))
            : [],
    };
}

async function fetchWorkerNavigation(subdomain: string, location: string): Promise<NavPage[]> {
    try {
        const data = await createStorefrontApiClient(
            storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [
                `storefront:${subdomain}`,
                `storefront:${subdomain}:navigation:${location}`,
            ]),
        ).storefront.navigation(subdomain, location) as WorkerNavigationPayload | undefined;
        return Array.isArray(data?.items)
            ? data.items.map((item, index) => mapWorkerNavigationItem(item, index))
            : [];
    } catch {
        return [];
    }
}

async function fetchWorkerNavigationBundle(subdomain: string): Promise<StoreNavigation> {
    const [main, footer, policies] = await Promise.all([
        fetchWorkerNavigation(subdomain, 'main'),
        fetchWorkerNavigation(subdomain, 'footer'),
        fetchWorkerNavigation(subdomain, 'policies'),
    ]);

    return { main, footer, policies };
}

function normalizeSiteType(value: unknown): SiteType {
    if (value === 'ecommerce') return 'store';
    if (value === 'landing_page') return 'landing';
    if (value === 'store' || value === 'portfolio' || value === 'resume' || value === 'landing') return value;
    return 'store';
}

function mapStatusOnlyStore(data: WorkerStorePayload): StoreModel {
    const themeId = (data.theme_id as string) || 'default';
    const storeLocale = (data.locale as string) || 'en-IN';
    return {
        id: data.id as string,
        sellerId: (data.user_id as string) || (data.custom_user_id as string) || '',
        name: (data.name as string) || (data.store_name as string) || 'Untitled Store',
        tagline: (data.tagline as string) || '',
        subdomain: (data.subdomain as string) || (data.store_name as string) || '',
        storeUrl: data.custom_domain as string,
        logoUrl: data.logo_url as string,
        themeId,
        currentThemeReleaseId: data.current_theme_release_id as string,
        storefrontReleaseVersion: (data.storefront_release_version as number) || 0,
        siteType: normalizeSiteType(data.site_type),
        selectedProductIds: [],
        status: ((data.status as string) || 'draft') as 'draft' | 'published' | 'suspended',
        customDomainStatus: (data.custom_domain_status as StoreModel['customDomainStatus']) || 'none',
        accessMode: (data.access_mode as StoreModel['accessMode']) || 'public',
        accessMessage: data.access_message as string | undefined,
        published: typeof data.published === 'boolean' ? data.published : data.status === 'published',
        plan: 'free',
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
        locale: storeLocale,
        codEnabled: true,
        onlinePaymentEnabled: true,
        paymentGateways: ['razorpay'],
        navigation: undefined,
        createdAt: (data.created_at as string) || new Date(0).toISOString(),
        updatedAt: data.updated_at as string,
        publishedAt: data.published_at as string,
        templateConfig: {
            storeId: data.id as string,
            themeId,
            themeSettings: DEFAULT_THEME_SETTINGS,
            sections: [],
        },
    };
}

function mapSupabaseToStore(
    data: Record<string, unknown>,
    release?: ThemeReleaseRow | null,
    navigation?: StoreNavigation
): StoreModel {
    const releaseConfig = asRecord(release?.template_snapshot || release?.release_config);
    const releaseManifest = asRecord(release?.release_manifest);
    const legacyTemplateConfig = asRecord(data.template_config);
    const manifestTemplateConfig = asRecord(releaseManifest.templateConfig);
    const rawTemplateConfig = Object.keys(releaseConfig).length > 0
        ? releaseConfig
        : Object.keys(manifestTemplateConfig).length > 0
            ? manifestTemplateConfig
            : legacyTemplateConfig;
    const themeId = release?.theme_id || (data.theme_id as string) || (rawTemplateConfig.themeId as string) || 'urban-kicks';
    const storeLocale = (data.locale as string) || 'en-IN';
    const fallbackTemplateConfig = getDefaultStorefrontThemeTemplate(themeId);
    const resolvedTemplateConfig: Record<string, unknown> = hasRenderableThemeTemplate(rawTemplateConfig)
        ? {
            ...rawTemplateConfig,
            themeId,
        }
        : {
            ...rawTemplateConfig,
            ...fallbackTemplateConfig,
            themeSettings: {
                ...fallbackTemplateConfig.themeSettings,
                ...asRecord(rawTemplateConfig.themeSettings),
            },
            themeId,
        };
    const templateConfig = localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale);
    const bundleSettingsData = asRecord(asRecord(templateConfig.config).settings_data);
    // LB-9 — appearance bridge: merge the merchant's appearance settings (sites.site_settings, snake_case)
    // over the theme defaults so the brand color / font / radius set in the Appearance page reach the
    // storefront :root tokens (layout.tsx). Merchant appearance wins over the theme bundle.
    const appearanceSettings = asRecord(data.site_settings);
    const appearanceOverrides: Record<string, unknown> = {};
    if (typeof appearanceSettings.primary_color === 'string' && appearanceSettings.primary_color) {
        appearanceOverrides.primaryColor = appearanceSettings.primary_color;
    }
    if (typeof appearanceSettings.font_family === 'string' && appearanceSettings.font_family) {
        appearanceOverrides.fontFamily = appearanceSettings.font_family;
        appearanceOverrides.headingFontFamily = appearanceSettings.font_family;
    }
    if (appearanceSettings.border_radius !== undefined && appearanceSettings.border_radius !== null && appearanceSettings.border_radius !== '') {
        const radius = Number(appearanceSettings.border_radius);
        if (Number.isFinite(radius)) appearanceOverrides.borderRadius = radius;
    }
    const themeSettingsRecord = {
        ...asRecord(bundleSettingsData.current),
        ...asRecord(templateConfig.themeSettings),
        ...appearanceOverrides,
    };
    const themeSettings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        ...themeSettingsRecord,
        primaryColor: themeSettingsRecord.primaryColor as string || DEFAULT_THEME_SETTINGS.primaryColor,
        secondaryColor: themeSettingsRecord.secondaryColor as string || DEFAULT_THEME_SETTINGS.secondaryColor,
        accentColor: themeSettingsRecord.accentColor as string || DEFAULT_THEME_SETTINGS.accentColor,
        fontFamily: themeSettingsRecord.fontFamily as string || DEFAULT_THEME_SETTINGS.fontFamily,
        borderRadius: themeSettingsRecord.borderRadius as number ?? DEFAULT_THEME_SETTINGS.borderRadius,
    };

    // Handle both formats:
    // 1. Editor format (object): { header: {...}, footer: {...}, template: [...] }
    // 2. Legacy format (array):  [{ id, type, settings, ... }, ...]
    const rawSections = templateConfig.sections;
    let sectionArray: SectionModel[] = [];
    let editorTemplateSections: SectionModel[] = [];
    const sectionGroups = normalizeSectionGroups(templateConfig.sectionGroups) || {};
    const sectionDefinitions = asRecord(templateConfig.sections);
    let templates = normalizeTemplates(templateConfig.templates, sectionDefinitions);

    if (Array.isArray(rawSections)) {
        // Legacy flat array format
        sectionArray = normalizeSectionArray(rawSections);
    } else if (rawSections && typeof rawSections === 'object' && !isThemeBundleSectionDefinitionMap(rawSections)) {
        // Editor object format — extract template array + header/footer as sections
        const editorSections = rawSections as Record<string, unknown>;
        editorTemplateSections = normalizeSectionArray(editorSections.template);
        sectionArray = [...editorTemplateSections];

        // Include header/footer as sections if present
        if (editorSections.header && typeof editorSections.header === 'object') {
            const header = normalizeSectionRecord(asRecord(editorSections.header), 0);
            sectionGroups.header = {
                id: 'header',
                role: 'header',
                sections: [header],
            };
            sectionArray.unshift(header);
        }
        if (editorSections.footer && typeof editorSections.footer === 'object') {
            const footer = normalizeSectionRecord(asRecord(editorSections.footer), sectionArray.length);
            sectionGroups.footer = {
                id: 'footer',
                role: 'footer',
                sections: [footer],
            };
            sectionArray.push(footer);
        }
    }

    if (!templates && editorTemplateSections.length > 0) {
        templates = {
            index: {
                id: 'index',
                type: 'index',
                layoutKey: 'theme',
                sections: editorTemplateSections,
            },
        };
    }

    if (sectionArray.length === 0 && templates?.index?.sections?.length) {
        sectionArray = [
            ...(sectionGroups.header?.sections || []),
            ...templates.index.sections,
            ...(sectionGroups.footer?.sections || []),
        ];
    }

    const appBlocks = data.app_blocks;
    const normalizedAppBlocks = normalizeAppBlockInstances(appBlocks);
    const sections = injectAppBlocksIntoSections(sectionArray, appBlocks);
    templates = injectAppBlocksIntoTemplates(templates, appBlocks);
    const liquidBundleResult = LiquidThemePackageBundleSchema.safeParse(templateConfig.liquidBundle);
    // Do not fall back to the Urban Kicks fixture: a store without a valid liquidBundle should render
    // React (canary off or no bundle), not silently wear the Urban Kicks demo theme.
    const liquidBundle = liquidBundleResult.success ? liquidBundleResult.data : undefined;
    const liquidRenderingCanary = typeof templateConfig.liquidRenderingCanary === 'boolean'
        ? templateConfig.liquidRenderingCanary
        // Safe default: undefined (NOT false). resolveThemeLiquidRenderingEnabled returns the first
        // EXPLICIT boolean candidate, so a literal false here would short-circuit per-theme opt-in via
        // themeSettings/releaseManifest/rendererManifest. undefined lets those resolve, then falls back
        // to THEME_LIQUID_RENDERING_DEFAULT_ENABLED (false). Per-theme activation lands in Phase 9.
        : undefined;

    // Liquid theme activation: a Liquid theme/release carries rendererEngine: 'liquid' (themes.default_template
    // or the gateway's resolved config). Pass it through so resolveThemeLiquidRenderingEnabled honors it.
    const rendererEngine = typeof templateConfig.rendererEngine === 'string'
        ? templateConfig.rendererEngine
        : undefined;

    // Parse payment gateways from store settings
    const paymentSettings = asRecord(data.payment_settings);
    const gateways: PaymentGateway[] = (paymentSettings.gateways as PaymentGateway[]) || ['razorpay'];

    return {
        id: data.id as string,
        sellerId: (data.user_id as string) || (data.custom_user_id as string) || '',
        name: (data.name as string) || (data.store_name as string) || 'Untitled Store',
        tagline: (data.tagline as string) || '',
        subdomain: (data.subdomain as string) || (data.store_name as string) || '',
        storeUrl: data.custom_domain as string,
        // LB-9 — the Appearance-page logo (site_settings.logo_url) overrides the base site logo.
        logoUrl: (typeof appearanceSettings.logo_url === 'string' && appearanceSettings.logo_url
            ? appearanceSettings.logo_url
            : data.logo_url) as string,
        bannerUrl: undefined,
        themeId,
        currentThemeReleaseId: (data.current_theme_release_id as string) || release?.id,
        storefrontReleaseVersion: (data.storefront_release_version as number) || release?.release_version || 0,
        siteType: normalizeSiteType(data.site_type),
        selectedProductIds: [],
        status: ((data.status as string) || 'draft') as 'draft' | 'published' | 'suspended',
        customDomainStatus: (data.custom_domain_status as StoreModel['customDomainStatus']) || 'none',
        accessMode: (data.access_mode as StoreModel['accessMode']) || 'public',
        accessMessage: data.access_message as string | undefined,
        published: typeof data.published === 'boolean' ? data.published : data.status === 'published',
        plan: 'free',
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
        locale: storeLocale,
        codEnabled: (data.cod_enabled as boolean) ?? true,
        onlinePaymentEnabled: (data.online_payment_enabled as boolean) ?? true,
        paymentGateways: gateways,
        navigation,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
        publishedAt: data.published_at as string,
        templateConfig: {
            storeId: data.id as string,
            themeId,
            releaseId: release?.id || (data.current_theme_release_id as string) || undefined,
            releaseVersion: release?.release_version || (data.storefront_release_version as number) || undefined,
            releasePublishedAt: release?.published_at || undefined,
            engineVersion: release?.engine_version || (typeof templateConfig.engineVersion === 'string' ? templateConfig.engineVersion : undefined),
            themeSettings,
            sections,
            sectionGroups: Object.keys(sectionGroups).length > 0 ? sectionGroups : undefined,
            templates,
            appBlocks: normalizedAppBlocks,
            liquidBundle,
            liquidRenderingCanary,
            rendererEngine,
            releaseManifest,
        },
    };
}

// Normalize section type names (handle legacy 'hero' -> 'heroBanner', 'product_grid' -> 'productGrid')
function normalizeSectionType(type: string): string {
    const typeMap: Record<string, string> = {
        'hero': 'heroBanner',
        'hero-banner': 'heroBanner',
        'product_grid': 'productGrid',
        'product-grid': 'productGrid',
        'product-detail': 'productDetail',
        'featured_collection': 'featuredProducts',
        'featured-products': 'featuredProducts',
        'portfolio_grid': 'portfolioGrid',
        'portfolio-grid': 'portfolioGrid',
        'skills_section': 'skillsSection',
        'skills-section': 'skillsSection',
        'experience_timeline': 'experienceTimeline',
        'experience-timeline': 'experienceTimeline',
        'contact_form': 'contactForm',
        'contact-form': 'contactForm',
        'cta_section': 'ctaSection',
        'cta-section': 'ctaSection',
        'services_grid': 'servicesGrid',
        'services-grid': 'servicesGrid',
        'content-page': 'contentPage',
        'rich-content': 'contentPage',
        'category-grid': 'categoryGrid',
        'brand-marquee': 'brandMarquee',
        'trust-badges': 'trustBadges',
        'app-block-slot': 'appBlockSlot',
        'app_block_slot': 'appBlockSlot',
    };
    return typeMap[type] || type;
}
