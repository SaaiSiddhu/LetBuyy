import {
    StoreModel,
    DEFAULT_THEME_SETTINGS,
    ThemeSettings,
    SectionModel,
    SectionType,
    BlockModel,
    SiteType,
    PaymentGateway,
    StorefrontSectionGroupConfig,
    StorefrontTemplateConfig,
    NavPage,
    StoreNavigation,
} from '@/types/store';
import { readWorkerJson, storefrontReadInit, workerFetch } from './worker-client';
import { getDefaultStorefrontThemeTemplate, hasRenderableThemeTemplate } from '@letbuyy/api-types';
import { getUrbanKicksDemoStore, isUrbanKicksDemoSubdomain } from './demo/urban-kicks-demo';

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

export const StoreService = {
    async getStoreBySubdomain(subdomain: string): Promise<StoreModel | null> {
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoStore();
        }

        try {
            const [data, navigation] = await Promise.all([
                fetchWorkerStore(subdomain, false),
                fetchWorkerNavigationBundle(subdomain),
            ]);
            return data ? mapSupabaseToStore(data, data.current_theme_release || null, navigation) : null;

        } catch (error) {
            console.error('[StoreService] Error fetching store through worker:', error);
            return null;
        }
    },

    async getPreviewStoreBySubdomain(subdomain: string, previewToken: string): Promise<StoreModel | null> {
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoStore();
        }

        if (!previewToken || previewToken.length > 200) return null;

        try {
            const [data, navigation] = await Promise.all([
                fetchWorkerPreviewStore(subdomain, previewToken),
                fetchWorkerNavigationBundle(subdomain),
            ]);
            return data ? mapSupabaseToStore(data, data.current_theme_release || null, navigation) : null;
        } catch (error) {
            console.error('[StoreService] Error fetching preview store through worker:', error);
            return null;
        }
    },

    async getStoreBySubdomainAnyStatus(subdomain: string): Promise<StoreModel | null> {
        if (isUrbanKicksDemoSubdomain(subdomain)) {
            return getUrbanKicksDemoStore();
        }

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
            return null;
        }
    },

    async getStoreById(storeId: string): Promise<StoreModel | null> {
        if (storeId === 'demo-urban-kicks-store') {
            return getUrbanKicksDemoStore();
        }

        try {
            const response = await workerFetch(
                `/storefront/store/${encodeURIComponent(storeId)}`,
                storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [`storefront:store:${storeId}`]),
            );
            const payload = await readWorkerJson(response);
            const data = payload?.data as WorkerStorePayload | undefined;
            return data ? mapSupabaseToStore(data, data.current_theme_release || null) : null;
        } catch (error) {
            console.error('[StoreService] Error fetching store by ID through worker:', error);
            return null;
        }
    }
};

// ============= HELPER FUNCTIONS =============

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function normalizeBlockRecord(value: Record<string, unknown>, index: number): BlockModel {
    return {
        id: (value.id as string) || `block-${index}`,
        type: (value.type as string) || 'block',
        order: (value.order as number) || index,
        rendererKey: typeof value.rendererKey === 'string' ? value.rendererKey : undefined,
        schemaVersion: typeof value.schemaVersion === 'string' ? value.schemaVersion : undefined,
        settings: asRecord(value.settings),
        isVisible: value.visible !== undefined ? value.visible !== false : value.isVisible !== false,
    };
}

function normalizeSectionRecord(value: Record<string, unknown>, index: number): SectionModel {
    const rawBlocks = Array.isArray(value.blocks) ? value.blocks : [];

    return {
        id: (value.id as string) || `section-${index}`,
        type: normalizeSectionType(value.type as string) as SectionType,
        order: (value.order as number) || index,
        rendererKey: typeof value.rendererKey === 'string' ? value.rendererKey : undefined,
        schemaVersion: typeof value.schemaVersion === 'string' ? value.schemaVersion : undefined,
        settings: asRecord(value.settings),
        blocks: rawBlocks
            .map((block, blockIndex) => normalizeBlockRecord(asRecord(block), blockIndex)),
        isVisible: value.visible !== undefined ? value.visible !== false : value.isVisible !== false,
    };
}

function normalizeSectionArray(value: unknown): SectionModel[] {
    return Array.isArray(value)
        ? value.map((section, index) => normalizeSectionRecord(asRecord(section), index))
        : [];
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

function normalizeTemplates(value: unknown): Record<string, StorefrontTemplateConfig> | undefined {
    const templates = asRecord(value);
    const normalized: Record<string, StorefrontTemplateConfig> = {};

    for (const [key, templateValue] of Object.entries(templates)) {
        const templateRecord = asRecord(templateValue);
        const sections = normalizeSectionArray(templateRecord.sections);

        normalized[key] = {
            id: (templateRecord.id as string) || key,
            type: (templateRecord.type as string) || key,
            layoutKey: (templateRecord.layoutKey as string) || 'theme',
            sections,
        };
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

async function fetchWorkerStore(subdomain: string, anyStatus: boolean): Promise<WorkerStorePayload | null> {
    const path = anyStatus
        ? `/storefront/${encodeURIComponent(subdomain)}/status`
        : `/storefront/${encodeURIComponent(subdomain)}`;

    const response = await workerFetch(
        path,
        storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [
            `storefront:${subdomain}`,
            anyStatus ? `storefront:${subdomain}:status` : `storefront:${subdomain}:published`,
        ]),
    );
    if (response.status === 404) return null;

    const payload = await readWorkerJson(response);
    return (payload?.data as WorkerStorePayload | undefined) || null;
}

async function fetchWorkerPreviewStore(subdomain: string, previewToken: string): Promise<WorkerStorePayload | null> {
    const response = await workerFetch(
        `/storefront/${encodeURIComponent(subdomain)}/theme-preview?token=${encodeURIComponent(previewToken)}`
    );
    if (response.status === 404) return null;

    const payload = await readWorkerJson(response);
    return (payload?.data as WorkerStorePayload | undefined) || null;
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
        const response = await workerFetch(
            `/storefront/${encodeURIComponent(subdomain)}/navigation?location=${encodeURIComponent(location)}`,
            storefrontReadInit(STOREFRONT_REVALIDATE_SECONDS, [
                `storefront:${subdomain}`,
                `storefront:${subdomain}:navigation:${location}`,
            ]),
        );
        if (response.status === 404) return [];

        const payload = await readWorkerJson(response);
        const data = payload?.data as WorkerNavigationPayload | undefined;
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
        plan: 'free',
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
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
    const fallbackTemplateConfig = getDefaultStorefrontThemeTemplate(themeId);
    const templateConfig: Record<string, unknown> = hasRenderableThemeTemplate(rawTemplateConfig)
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
    const themeSettings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        ...asRecord(templateConfig.themeSettings),
        primaryColor: asRecord(templateConfig.themeSettings).primaryColor as string || DEFAULT_THEME_SETTINGS.primaryColor,
        secondaryColor: asRecord(templateConfig.themeSettings).secondaryColor as string || DEFAULT_THEME_SETTINGS.secondaryColor,
        accentColor: asRecord(templateConfig.themeSettings).accentColor as string || DEFAULT_THEME_SETTINGS.accentColor,
        fontFamily: asRecord(templateConfig.themeSettings).fontFamily as string || DEFAULT_THEME_SETTINGS.fontFamily,
        borderRadius: asRecord(templateConfig.themeSettings).borderRadius as number ?? DEFAULT_THEME_SETTINGS.borderRadius,
    };

    // Handle both formats:
    // 1. Editor format (object): { header: {...}, footer: {...}, template: [...] }
    // 2. Legacy format (array):  [{ id, type, settings, ... }, ...]
    const rawSections = templateConfig.sections;
    let sectionArray: SectionModel[] = [];
    let editorTemplateSections: SectionModel[] = [];
    const sectionGroups = normalizeSectionGroups(templateConfig.sectionGroups) || {};
    let templates = normalizeTemplates(templateConfig.templates);

    if (Array.isArray(rawSections)) {
        // Legacy flat array format
        sectionArray = normalizeSectionArray(rawSections);
    } else if (rawSections && typeof rawSections === 'object') {
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

    const sections = sectionArray;

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
        logoUrl: data.logo_url as string,
        bannerUrl: undefined,
        themeId,
        currentThemeReleaseId: (data.current_theme_release_id as string) || release?.id,
        storefrontReleaseVersion: (data.storefront_release_version as number) || release?.release_version || 0,
        siteType: normalizeSiteType(data.site_type),
        selectedProductIds: [],
        status: ((data.status as string) || 'draft') as 'draft' | 'published' | 'suspended',
        plan: 'free',
        seoTitle: data.seo_title as string,
        seoDescription: data.seo_description as string,
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
            releaseManifest,
        },
    };
}

// Normalize section type names (handle legacy 'hero' -> 'heroBanner', 'product_grid' -> 'productGrid')
function normalizeSectionType(type: string): string {
    const typeMap: Record<string, string> = {
        'hero': 'heroBanner',
        'product_grid': 'productGrid',
        'featured_collection': 'featuredProducts',
        'portfolio_grid': 'portfolioGrid',
        'skills_section': 'skillsSection',
        'experience_timeline': 'experienceTimeline',
        'contact_form': 'contactForm',
        'cta_section': 'ctaSection',
        'services_grid': 'servicesGrid',
    };
    return typeMap[type] || type;
}
