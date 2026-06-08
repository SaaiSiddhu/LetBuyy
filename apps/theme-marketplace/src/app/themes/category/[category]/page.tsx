import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page, PageContent, PageHeader } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import ThemeCategoryLanding, {
    isThemeCategorySlug,
    THEME_CATEGORY_LANDING_COPY,
} from '@/components/theme-category-landing';
import MarketplaceUnavailable from '@/components/marketplace-unavailable';
import { ThemeService } from '@/lib/theme-service';

interface CategoryPageProps {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
    const { category } = await params;
    if (!isThemeCategorySlug(category)) return { title: 'Theme category not found' };
    const copy = THEME_CATEGORY_LANDING_COPY[category];

    return {
        title: copy.title,
        description: copy.seo,
        openGraph: {
            title: copy.title,
            description: copy.seo,
        },
    };
}

export default async function ThemeCategoryPage({ params }: CategoryPageProps) {
    const { category } = await params;
    if (!isThemeCategorySlug(category)) notFound();

    const copy = THEME_CATEGORY_LANDING_COPY[category];
    const result = await ThemeService.listThemes({ category, limit: 24, sort: 'popular' });

    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title={copy.title}
                eyebrow="Theme category"
                description={copy.intro}
                identity="themes"
                showBreadcrumbs
                showDescription
                showEyebrow
                breadcrumbs={[
                    { label: 'Themes', href: '/themes' },
                    { label: copy.title },
                ]}
                primaryAction={{ label: 'All themes', href: '/themes' }}
            />
            <PageContent>
                {result.ok ? (
                    <ThemeCategoryLanding
                        category={category}
                        themes={result.value.themes as unknown as Theme[]}
                        total={result.value.total}
                    />
                ) : (
                    <MarketplaceUnavailable />
                )}
            </PageContent>
        </Page>
    );
}
