import Link from 'next/link';
import { ArrowRight, Card, EmptyState, Section } from '@letbuyy/ui';
import type { Theme, ThemeCategory } from '@letbuyy/theme-engine';
import ThemeCard from './theme-card';

type StoreThemeCategory = Extract<ThemeCategory, 'store'>;

export const THEME_CATEGORY_LANDING_COPY: Record<StoreThemeCategory, { title: string; intro: string; seo: string }> = {
    store: {
        title: 'Store Themes',
        intro: 'Retail-ready storefront themes for India-first catalogs, product storytelling, and checkout-led journeys.',
        seo: 'Browse LetBuyy store themes for e-commerce and retail storefronts.',
    },

};

const CATEGORY_CHECKS: Record<StoreThemeCategory, {focus:string; checks:string[]}> = {
    store:{focus:'Follow the shopping journey, from finding a collection to understanding a product.',checks:['Collection navigation and the density of your catalog.','Product images, long names, options, and useful descriptions.','The supported cart journey and mobile navigation.']},
};

const CATEGORY_CHECK_LABELS: Record<StoreThemeCategory, string[]> = {
    store: ['Find a collection', 'Understand the product', 'Follow the mobile journey'],
};

export function isThemeCategorySlug(value: string): value is StoreThemeCategory {
    return value === 'store';
}

export default function ThemeCategoryLanding({
    category,
    themes,
    total,
    renderCardImages = true,
}: {
    category: StoreThemeCategory;
    themes: Theme[];
    total: number;
    renderCardImages?: boolean;
}) {
    return (
        <div className="marketplace-category-page-content">
            <Section
                title="Available designs"
                description={`${total} published theme${total === 1 ? '' : 's'} in this category. Review the listing and available preview before you choose.`}
                className="px-0 py-0"
            >
                {themes.length > 0 ? (
                    <div className="marketplace-category-theme-grid marketplace-device-grid" data-single={themes.length === 1}>
                        {themes.map((theme) => <ThemeCard key={theme.id} theme={theme} devicePreview renderPreviewImages={renderCardImages} />)}
                    </div>
                ) : (
                    <Card className="flex min-h-[320px] items-center justify-center p-[var(--lb-density-card-padding)]">
                        <EmptyState
                            kind="themes"
                            title={`No ${THEME_CATEGORY_LANDING_COPY[category].title.toLowerCase()} yet`}
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
            <section className="category-selection-guide" aria-labelledby="category-selection-heading">
                <div className="category-selection-intro"><p className="marketplace-eyebrow">Choose with confidence</p><h2 id="category-selection-heading">What to look for in this category</h2><p>{CATEGORY_CHECKS[category].focus}</p></div>
                <ol className="category-selection-checks">{CATEGORY_CHECKS[category].checks.map((check,index)=><li key={check}><span aria-hidden="true">0{index+1}</span><div><h3>{CATEGORY_CHECK_LABELS[category][index]}</h3><p>{check}</p></div></li>)}</ol>
                <div className="category-selection-footer"><p>Features vary by theme and version. Check the listing, then preview with your own content.</p><Link href="/guides/choose-the-right-theme" className="marketplace-text-link">Read the selection guide<ArrowRight size={16} aria-hidden="true"/></Link></div>
            </section>
        </div>
    );
}
