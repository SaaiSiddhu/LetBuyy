import type { StorefrontContentResource } from '@/lib/content-service';
import type { SectionModel } from '@letbuyy/theme-engine';

export function createContentFallbackSection(resource: StorefrontContentResource): SectionModel {
    return {
        id: `content-${resource.id || resource.slug}`,
        type: 'contentPage',
        order: 0,
        rendererKey: 'core.rich-content',
        settings: {
            title: resource.title,
            content: resource.content,
        },
        blocks: [],
        isVisible: true,
    };
}
