import type { SectionModel, StorefrontSectionGroupConfig, StorefrontTemplateConfig } from '@letbuyy/theme-engine';
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

export function resolveStorefrontTemplate(
    store: StoreModel,
    route: StorefrontRouteContext,
): StorefrontRenderPlan {
    const templateKey = resolveTemplateKey(route.type);
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
