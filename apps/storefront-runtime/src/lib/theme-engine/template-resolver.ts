import {
    LiquidThemePackageBundleSchema,
    isLiquidAppBlockType,
    type LiquidThemePackageBundle,
    type SectionModel,
    type StorefrontSectionGroupConfig,
    type StorefrontTemplateConfig,
} from '@letbuyy/theme-engine';
import type { StoreModel } from '@letbuyy/tenant-core';
import type {
    StorefrontRenderPlan,
    StorefrontRouteContext,
    StorefrontRouteType,
    StorefrontSectionGroups,
    StorefrontTemplate,
} from './types';

function sortVisibleSections(sections: SectionModel[] | undefined): SectionModel[] {
    return (sections || [])
        .filter((section) => section.isVisible !== false)
        .sort((a, b) => a.order - b.order);
}

function coerceSectionGroup(
    key: string,
    value: StorefrontSectionGroupConfig | SectionModel[] | undefined,
): SectionModel[] {
    if (Array.isArray(value)) {
        return sortVisibleSections(value);
    }

    if (value && Array.isArray(value.sections)) {
        return sortVisibleSections(value.sections);
    }

    return [];
}

function resolveSectionGroups(store: StoreModel): StorefrontSectionGroups {
    const config = store.templateConfig;
    const explicitGroups = config.sectionGroups || {};
    const flatSections = sortVisibleSections(config.sections);

    const groups: StorefrontSectionGroups = {
        header: coerceSectionGroup('header', explicitGroups.header),
        footer: coerceSectionGroup('footer', explicitGroups.footer),
    };

    for (const [key, value] of Object.entries(explicitGroups)) {
        if (key === 'header' || key === 'footer') continue;
        groups[key] = coerceSectionGroup(key, value);
    }

    if (groups.header.length === 0) {
        groups.header = flatSections.filter((section) => section.type === 'header');
    }

    if (groups.footer.length === 0) {
        groups.footer = flatSections.filter((section) => section.type === 'footer');
    }

    return groups;
}

function resolveTemplateKey(routeType: StorefrontRouteType): string {
    if (routeType === 'index') return 'index';
    return routeType;
}

function coerceTemplate(
    routeType: StorefrontRouteType,
    templateConfig: StorefrontTemplateConfig | undefined,
): StorefrontTemplate | null {
    if (!templateConfig || !Array.isArray(templateConfig.sections)) return null;

    return {
        id: templateConfig.id || resolveTemplateKey(routeType),
        type: routeType,
        layoutKey: templateConfig.layoutKey || 'theme',
        sections: sortVisibleSections(templateConfig.sections),
    };
}

function resolveLegacyTemplate(store: StoreModel, routeType: StorefrontRouteType): StorefrontTemplate {
    const sections = sortVisibleSections(store.templateConfig.sections)
        .filter((section) => section.type !== 'header' && section.type !== 'footer');

    return {
        id: resolveTemplateKey(routeType),
        type: routeType,
        layoutKey: 'theme',
        sections,
    };
}

function orderedKeys<T>(records: Record<string, T>, order: string[]): string[] {
    const ordered = order.filter((key) => Object.prototype.hasOwnProperty.call(records, key));
    const remaining = Object.keys(records).filter((key) => !ordered.includes(key));
    return [...ordered, ...remaining];
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function resolveLiquidBundle(store: StoreModel): LiquidThemePackageBundle | undefined {
    const releaseManifest = asRecord(store.templateConfig.releaseManifest);
    const candidates = [
        store.templateConfig.liquidBundle,
        releaseManifest.liquidBundle,
        releaseManifest.themeBundle,
        releaseManifest.bundle,
    ];

    for (const candidate of candidates) {
        const result = LiquidThemePackageBundleSchema.safeParse(candidate);
        if (result.success) return result.data;
    }

    return undefined;
}

function resolveLiquidTemplateKey(
    bundle: LiquidThemePackageBundle,
    route: StorefrontRouteContext,
    routeType: StorefrontRouteType,
): string {
    const routeTemplateKey = route.templateKey || resolveTemplateKey(routeType);
    if (bundle.templates[routeTemplateKey]) return routeTemplateKey;
    if (bundle.templates.index) return 'index';

    return Object.keys(bundle.templates)[0] || routeTemplateKey;
}

function coerceLiquidTemplate(
    bundle: LiquidThemePackageBundle,
    templateKey: string,
    routeType: StorefrontRouteType,
): StorefrontTemplate | null {
    const template = bundle.templates[templateKey];
    if (!template) return null;

    const sections = orderedKeys(template.sections, template.order)
        .map((sectionId, order): SectionModel | null => {
            const section = template.sections[sectionId];
            if (!section || section.disabled) return null;

            return {
                id: sectionId,
                type: section.type,
                order,
                rendererKey: `liquid.section.${section.type}`,
                schemaVersion: bundle.schema_version,
                settings: section.settings,
                blocks: orderedKeys(section.blocks, section.block_order)
                    .map((blockId, blockOrder) => {
                        const block = section.blocks[blockId];
                        if (!block || block.disabled) return null;

                        return {
                            id: blockId,
                            type: block.type,
                            order: blockOrder,
                            rendererKey: isLiquidAppBlockType(block.type) ? 'liquid.app-block' : `liquid.block.${block.type}`,
                            schemaVersion: bundle.schema_version,
                            settings: block.settings,
                            isVisible: true,
                        };
                    })
                    .filter((block): block is NonNullable<typeof block> => block !== null),
                isVisible: true,
            };
        })
        .filter((section): section is SectionModel => section !== null);

    return {
        id: templateKey,
        type: routeType,
        layoutKey: template.layout || 'theme',
        sections,
    };
}

export function resolveStorefrontTemplate(
    store: StoreModel,
    route: StorefrontRouteContext,
): StorefrontRenderPlan {
    const templateKey = resolveTemplateKey(route.type);
    const liquidBundle = resolveLiquidBundle(store);
    if (liquidBundle) {
        const liquidTemplateKey = resolveLiquidTemplateKey(liquidBundle, route, route.type);
        const liquidTemplate = coerceLiquidTemplate(liquidBundle, liquidTemplateKey, route.type);
        if (liquidTemplate) {
            return {
                route,
                layoutKey: liquidTemplate.layoutKey,
                rendererEngine: 'liquid',
                liquidBundle,
                liquidTemplateKey,
                sectionGroups: {
                    header: [],
                    footer: [],
                },
                template: liquidTemplate,
                themeSettings: store.templateConfig.themeSettings,
                releaseId: store.templateConfig.releaseId,
                releaseVersion: store.templateConfig.releaseVersion,
                cacheTags: [
                    `store:${store.id}`,
                    `theme:${liquidBundle.package.slug}`,
                    `release:${store.templateConfig.releaseId || 'liquid-preview'}`,
                    `route:${route.type}:${route.resourceId || route.resourceSlug || route.path}`,
                    `template:${liquidTemplate.id}`,
                ],
            };
        }
    }

    const assignedTemplate = route.templateKey
        ? coerceTemplate(route.type, store.templateConfig.templates?.[route.templateKey])
        : null;
    const fallbackTemplate = route.fallbackSections?.length
        ? {
            id: `${route.type}-resource-fallback`,
            type: route.type,
            layoutKey: 'theme',
            sections: sortVisibleSections(route.fallbackSections),
        }
        : null;
    const template = assignedTemplate
        || coerceTemplate(route.type, store.templateConfig.templates?.[templateKey])
        || (route.type === 'index' ? coerceTemplate(route.type, store.templateConfig.templates?.index) : null)
        || fallbackTemplate
        || resolveLegacyTemplate(store, route.type);

    const cacheTags = [
        `store:${store.id}`,
        `theme:${store.templateConfig.themeId}`,
        `release:${store.templateConfig.releaseId || 'legacy'}`,
        `route:${route.type}:${route.resourceId || route.resourceSlug || route.path}`,
        `template:${template.id}`,
    ];

    return {
        route,
        layoutKey: template.layoutKey,
        sectionGroups: resolveSectionGroups(store),
        template,
        themeSettings: store.templateConfig.themeSettings,
        releaseId: store.templateConfig.releaseId,
        releaseVersion: store.templateConfig.releaseVersion,
        cacheTags,
    };
}
