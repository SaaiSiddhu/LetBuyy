import Link from 'next/link';
import { Card, EmptyState, Section } from '@letbuyy/ui';
import type { Theme, ThemeCategory } from '@letbuyy/theme-engine';
import ThemeCard from './theme-card';

export const THEME_CATEGORY_LANDING_COPY: Record<ThemeCategory, { title: string; intro: string; seo: string }> = {
    store: {
        title: 'Store Themes',
        intro: 'Retail-ready storefront themes for India-first catalogs, product storytelling, and checkout-led journeys.',
        seo: 'Browse LetBuyy store themes for e-commerce and retail storefronts.',
    },
    portfolio: {
        title: 'Portfolio Themes',
        intro: 'Portfolio themes for designers, creators, consultants, and agencies that need project-first presentation.',
        seo: 'Browse LetBuyy portfolio themes for creators and service businesses.',
    },
    resume: {
        title: 'Resume Themes',
        intro: 'Resume and profile themes for professionals who need a polished personal site and structured work history.',
        seo: 'Browse LetBuyy resume and CV themes for professional profiles.',
    },
    landing: {
        title: 'Landing Page Themes',
        intro: 'Conversion-focused launch pages for campaigns, waitlists, services, and product announcements.',
        seo: 'Browse LetBuyy landing page themes for campaigns and launches.',
    },
    saas: {
        title: 'SaaS Themes',
        intro: 'Product-led themes for SaaS, tools, dashboards, pricing pages, and software launches.',
        seo: 'Browse LetBuyy SaaS themes for software and subscription products.',
    },
};

export function isThemeCategorySlug(value: string): value is ThemeCategory {
    return Object.prototype.hasOwnProperty.call(THEME_CATEGORY_LANDING_COPY, value);
}

export default function ThemeCategoryLanding({
    category,
    themes,
    total,
    renderCardImages = true,
}: {
    category: ThemeCategory;
    themes: Theme[];
    total: number;
    renderCardImages?: boolean;
}) {
    const copy = THEME_CATEGORY_LANDING_COPY[category];

    return (
        <div className="grid gap-[var(--lb-density-section-gap)]">
            <Section
                title={copy.title}
                description={`${copy.intro} ${total} theme${total === 1 ? '' : 's'} available in this category.`}
                className="px-0 py-0"
            >
                {themes.length > 0 ? (
                    <div className="grid grid-cols-1 gap-[var(--lb-space-4)] md:grid-cols-2 2xl:grid-cols-4">
                        {themes.map((theme) => <ThemeCard key={theme.id} theme={theme} renderPreviewImages={renderCardImages} />)}
                    </div>
                ) : (
                    <Card className="flex min-h-[320px] items-center justify-center p-[var(--lb-density-card-padding)]">
                        <EmptyState
                            kind="themes"
                            title={`No ${copy.title.toLowerCase()} yet`}
                            body="Browse the full marketplace while this category is being expanded."
                            primaryAction={(
                                <Link
                                    href="/themes"
                                    className="inline-flex h-[var(--lb-density-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)]"
                                >
                                    Browse all themes
                                </Link>
                            )}
                        />
                    </Card>
                )}
            </Section>
        </div>
    );
}
