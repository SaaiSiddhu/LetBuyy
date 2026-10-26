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

const CATEGORY_CHECKS: Record<ThemeCategory, {focus:string; checks:string[]}> = {
    store:{focus:'Follow the shopping journey, from finding a collection to understanding a product.',checks:['Collection navigation and the density of your catalog.','Product images, long names, options, and useful descriptions.','The supported cart journey and mobile navigation.']},
    portfolio:{focus:'Let your work lead, with project layouts that support the story behind it.',checks:['A clear project index and readable case-study pages.','Image crops and layouts for the kind of work you produce.','A direct route from your services or profile to contact.']},
    resume:{focus:'Make a professional profile easy to scan and comfortable to read.',checks:['Experience, education, skills, and a clear introduction.','Long text and structured dates on narrow screens.','Actual contact or CV links provided by the selected package.']},
    landing:{focus:'Choose a focused structure for one offer and the action it needs.',checks:['A specific offer, useful explanation, and clear next action.','Real evidence and appropriate FAQ sections.','The actual behavior of any supported enquiry or signup form.']},
    saas:{focus:'Explain the product with the right page structure and supporting detail.',checks:['Product screenshots, feature explanations, and relevant page variations.','Pricing presentation and useful documentation links.','Which calls to action are functional and which are sample content.']},
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
            <section className="marketplace-content-note"><h2>What to look for in this category</h2><p>{CATEGORY_CHECKS[category].focus}</p><ul className="marketplace-checklist">{CATEGORY_CHECKS[category].checks.map(check=><li key={check}>{check}</li>)}</ul><p>Capabilities vary by listing and version. Review the actual package features and use your own content for the final preview.</p><Link href="/guides/choose-the-right-theme" className="marketplace-text-link">Read the theme selection guide</Link></section>
        </div>
    );
}
