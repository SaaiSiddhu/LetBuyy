import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import AboutSection from '@/components/sections/about-section';
import NewsletterSection from '@/components/sections/newsletter';
import FeaturedProducts from '@/components/sections/featured-products';
import PortfolioGrid from '@/components/sections/portfolio-grid';
import SkillsSection from '@/components/sections/skills-section';
import ExperienceTimeline from '@/components/sections/experience-timeline';
import ContactForm from '@/components/sections/contact-form';
import CtaSection from '@/components/sections/cta-section';
import ServicesGrid from '@/components/sections/services-grid';
import RichContentSection from '@/components/sections/rich-content-section';
import CategoryGrid from '@/components/sections/category-grid';
import BrandMarquee from '@/components/sections/brand-marquee';
import TrustBadges from '@/components/sections/trust-badges';
import AppBlockSlot from '@/components/sections/app-block-slot';
import ProductDetailSection from '@/components/sections/product-detail-section';
import DynamicHeader from '@/components/layout/dynamic-header';
import DynamicFooter from '@/components/layout/dynamic-footer';
import {
    SECTION_SCHEMAS,
    type BlockSchema,
    type SchemaField,
    type SectionSchema,
} from '@letbuyy/theme-engine';
import type { FooterSettings, HeaderSettings, SectionModel } from '@letbuyy/theme-engine';
import type { SectionRendererProps } from './types';
import type { ReactNode } from 'react';

type SectionRenderer = (props: SectionRendererProps) => ReactNode;

interface RegisteredSectionRenderer {
    rendererKey: string;
    sectionTypes: readonly string[];
    schema: SectionSchema;
    render: SectionRenderer;
}

export interface SectionRendererManifestEntry {
    rendererKey: string;
    sectionTypes: readonly string[];
    schema: SectionSchema;
}

function field(type: SchemaField['type'], label: string, extra: Omit<SchemaField, 'type' | 'label'> = {}): SchemaField {
    return { type, label, ...extra };
}

function defineSectionSchema(input: {
    type: string;
    name: string;
    description: string;
    defaults?: Record<string, unknown>;
    settings_schema?: Record<string, SchemaField>;
    blocks_schema?: Record<string, BlockSchema>;
    sample_blocks?: Array<{ type: string; settings: Record<string, unknown> }>;
}): SectionSchema {
    return {
        defaults: {},
        settings_schema: {},
        ...input,
    };
}

const RUNTIME_SECTION_SCHEMAS: Record<string, SectionSchema> = {
    productDetail: defineSectionSchema({
        type: 'productDetail',
        name: 'Product Detail',
        description: 'Product media, pricing, variants, and purchase controls for product routes.',
        settings_schema: {
            showGallery: field('toggle', 'Show gallery', { default: true }),
            showDescription: field('toggle', 'Show description', { default: true }),
            showVariantSelector: field('toggle', 'Show variant selector', { default: true }),
            showQuantity: field('toggle', 'Show quantity selector', { default: true }),
            showBuyNow: field('toggle', 'Show buy now button', { default: true }),
        },
    }),
    featuredProducts: defineSectionSchema({
        type: 'featuredProducts',
        name: 'Featured Products',
        description: 'Curated product rail backed by the store catalog.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Featured Products', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
            columns: field('range', 'Columns', { default: 4, min: 2, max: 4, step: 1 }),
            showPrice: field('toggle', 'Show price', { default: true }),
            showAddToCart: field('toggle', 'Show add to cart', { default: true }),
            productIds: field('text', 'Product ids'),
        },
    }),
    aboutSection: defineSectionSchema({
        type: 'aboutSection',
        name: 'About Section',
        description: 'Merchant story content with optional supporting media.',
        settings_schema: {
            title: field('text', 'Title', { default: 'About Us', maxLength: 80 }),
            content: field('richtext', 'Content'),
            imageUrl: field('image', 'Image'),
            layout: field('select', 'Layout', { default: 'left', options: ['left', 'right', 'center'] }),
        },
    }),
    portfolioGrid: defineSectionSchema({
        type: 'portfolioGrid',
        name: 'Portfolio Grid',
        description: 'Grid of portfolio projects for creator and service sites.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Portfolio', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
            columns: field('range', 'Columns', { default: 3, min: 2, max: 4, step: 1 }),
            layout: field('select', 'Layout', { default: 'grid', options: ['grid', 'masonry'] }),
        },
    }),
    skillsSection: defineSectionSchema({
        type: 'skillsSection',
        name: 'Skills Section',
        description: 'Skill tags or bars for resumes and portfolios.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Skills', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
            layout: field('select', 'Layout', { default: 'tags', options: ['tags', 'bars'] }),
        },
    }),
    experienceTimeline: defineSectionSchema({
        type: 'experienceTimeline',
        name: 'Experience Timeline',
        description: 'Timeline list for work, education, or milestones.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Experience', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
        },
    }),
    contactForm: defineSectionSchema({
        type: 'contactForm',
        name: 'Contact Form',
        description: 'Lead capture form for storefront, portfolio, and landing pages.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Contact Us', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
            email: field('text', 'Notification email'),
            showPhone: field('toggle', 'Show phone field', { default: true }),
            showAddress: field('toggle', 'Show address field', { default: false }),
        },
    }),
    ctaSection: defineSectionSchema({
        type: 'ctaSection',
        name: 'Call to Action',
        description: 'Focused promotional call-to-action band.',
        settings_schema: {
            heading: field('text', 'Heading', { default: 'Ready to get started?', maxLength: 100 }),
            subheading: field('text', 'Subheading', { maxLength: 160 }),
            ctaText: field('text', 'Button text', { default: 'Shop Now', maxLength: 40 }),
            ctaLink: field('url', 'Button link', { default: '/shop' }),
            style: field('select', 'Style', { default: 'primary', options: ['primary', 'gradient', 'dark'] }),
        },
    }),
    servicesGrid: defineSectionSchema({
        type: 'servicesGrid',
        name: 'Services Grid',
        description: 'Service cards for creators, freelancers, and local businesses.',
        settings_schema: {
            title: field('text', 'Title', { default: 'Services', maxLength: 80 }),
            subtitle: field('text', 'Subtitle', { maxLength: 120 }),
            columns: field('range', 'Columns', { default: 3, min: 2, max: 4, step: 1 }),
        },
        blocks_schema: {
            service: {
                name: 'Service',
                fields: {
                    icon: field('select', 'Icon', { options: ['design', 'code', 'web', 'mobile', 'photo', 'branding', 'analytics', 'marketing'] }),
                    title: field('text', 'Title', { maxLength: 60 }),
                    description: field('textarea', 'Description', { maxLength: 200 }),
                    link: field('url', 'Link'),
                },
            },
        },
    }),
    contentPage: defineSectionSchema({
        type: 'contentPage',
        name: 'Rich Content',
        description: 'Theme-rendered page or policy content.',
        settings_schema: {
            title: field('text', 'Title', { maxLength: 100 }),
            body: field('richtext', 'Body'),
            html: field('richtext', 'HTML content'),
        },
    }),
};

function schemaFor(sectionType: string): SectionSchema {
    return SECTION_SCHEMAS[sectionType] || RUNTIME_SECTION_SCHEMAS[sectionType] || defineSectionSchema({
        type: sectionType,
        name: sectionType,
        description: `Runtime section renderer for ${sectionType}.`,
    });
}

const SECTION_RENDERER_DEFINITIONS: RegisteredSectionRenderer[] = [
    {
        rendererKey: 'core.header',
        sectionTypes: ['header'],
        schema: schemaFor('header'),
        render: ({ section, store, data }) => (
            <DynamicHeader
                store={store}
                settings={section.settings as Partial<HeaderSettings> as HeaderSettings}
                products={data.products || []}
            />
        ),
    },
    {
        rendererKey: 'core.footer',
        sectionTypes: ['footer'],
        schema: schemaFor('footer'),
        render: ({ section, store }) => (
            <DynamicFooter
                store={store}
                settings={section.settings as Partial<FooterSettings> as FooterSettings}
                blocks={section.blocks}
            />
        ),
    },
    {
        rendererKey: 'core.hero',
        sectionTypes: ['heroBanner', 'hero', 'hero-banner'],
        schema: schemaFor('heroBanner'),
        render: ({ section, theme }) => <HeroSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.product-grid',
        sectionTypes: ['productGrid', 'product-grid', 'product_grid'],
        schema: schemaFor('productGrid'),
        render: ({ section, data, theme, store, basePath }) => store.siteType === 'store'
            ? <ProductGrid section={section} products={data.products || []} theme={theme} basePath={basePath} />
            : null,
    },
    {
        rendererKey: 'core.product-detail',
        sectionTypes: ['productDetail', 'product-detail'],
        schema: schemaFor('productDetail'),
        render: ({ section, data, theme, store, route }) => store.siteType === 'store'
            ? (
                <ProductDetailSection
                    section={section}
                    product={data.product}
                    subdomain={route.subdomain}
                    storeId={store.id}
                    theme={theme}
                />
            )
            : null,
    },
    {
        rendererKey: 'core.featured-products',
        sectionTypes: ['featuredProducts', 'featured-products', 'featured_collection'],
        schema: schemaFor('featuredProducts'),
        render: ({ section, data, theme, store }) => store.siteType === 'store'
            ? <FeaturedProducts section={section} products={data.products || []} theme={theme} />
            : null,
    },
    {
        rendererKey: 'core.testimonials',
        sectionTypes: ['testimonials'],
        schema: schemaFor('testimonials'),
        render: ({ section, theme }) => <TestimonialsSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.about',
        sectionTypes: ['aboutSection', 'about-section', 'about'],
        schema: schemaFor('aboutSection'),
        render: ({ section, theme }) => <AboutSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.newsletter',
        sectionTypes: ['newsletter'],
        schema: schemaFor('newsletter'),
        render: ({ section, theme }) => <NewsletterSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.portfolio-grid',
        sectionTypes: ['portfolioGrid', 'portfolio-grid', 'portfolio_grid'],
        schema: schemaFor('portfolioGrid'),
        render: ({ section, theme }) => <PortfolioGrid section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.skills',
        sectionTypes: ['skillsSection', 'skills-section', 'skills_section'],
        schema: schemaFor('skillsSection'),
        render: ({ section, theme }) => <SkillsSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.experience-timeline',
        sectionTypes: ['experienceTimeline', 'experience-timeline', 'experience_timeline'],
        schema: schemaFor('experienceTimeline'),
        render: ({ section, theme }) => <ExperienceTimeline section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.contact-form',
        sectionTypes: ['contactForm', 'contact-form', 'contact_form'],
        schema: schemaFor('contactForm'),
        render: ({ section, theme }) => <ContactForm section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.cta',
        sectionTypes: ['ctaSection', 'cta-section', 'cta_section'],
        schema: schemaFor('ctaSection'),
        render: ({ section, theme }) => <CtaSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.services-grid',
        sectionTypes: ['servicesGrid', 'services-grid', 'services_grid'],
        schema: schemaFor('servicesGrid'),
        render: ({ section, theme }) => <ServicesGrid section={section} theme={theme} />,
    },
    {
        rendererKey: 'core.rich-content',
        sectionTypes: ['contentPage', 'content-page', 'richContent', 'rich-content'],
        schema: schemaFor('contentPage'),
        render: ({ section, theme }) => <RichContentSection section={section} theme={theme} />,
    },
    {
        rendererKey: 'commerce.category-grid',
        sectionTypes: ['categoryGrid', 'category-grid'],
        schema: schemaFor('categoryGrid'),
        render: ({ section, basePath }) => <CategoryGrid section={section} basePath={basePath} />,
    },
    {
        rendererKey: 'commerce.brand-marquee',
        sectionTypes: ['brandMarquee', 'brand-marquee'],
        schema: schemaFor('brandMarquee'),
        render: ({ section }) => <BrandMarquee section={section} />,
    },
    {
        rendererKey: 'commerce.trust-badges',
        sectionTypes: ['trustBadges', 'trust-badges'],
        schema: schemaFor('trustBadges'),
        render: ({ section }) => <TrustBadges section={section} />,
    },
    {
        rendererKey: 'apps.app-block-slot',
        sectionTypes: ['appBlockSlot', 'app-block-slot', 'app_block_slot'],
        schema: schemaFor('appBlockSlot'),
        render: ({ section, theme }) => <AppBlockSlot section={section} theme={theme} />,
    },
];

const COMPATIBILITY_RENDERER_KEYS = Object.fromEntries(
    SECTION_RENDERER_DEFINITIONS.flatMap((definition) => [
        [definition.rendererKey, definition.rendererKey],
        ...definition.sectionTypes.map((sectionType) => [sectionType, definition.rendererKey]),
    ]),
) as Record<string, string>;

const APPROVED_SECTION_RENDERERS = Object.fromEntries(
    SECTION_RENDERER_DEFINITIONS.map((definition) => [definition.rendererKey, definition.render]),
) as Record<string, SectionRenderer>;

export function getRegisteredSectionRendererManifest(): SectionRendererManifestEntry[] {
    return SECTION_RENDERER_DEFINITIONS.map(({ rendererKey, sectionTypes, schema }) => ({
        rendererKey,
        sectionTypes,
        schema,
    }));
}

export function getRegisteredSectionSchemas(): Record<string, SectionSchema> {
    return Object.fromEntries(
        SECTION_RENDERER_DEFINITIONS.flatMap((definition) => (
            definition.sectionTypes.map((sectionType) => [sectionType, definition.schema])
        )),
    ) as Record<string, SectionSchema>;
}

export function resolveSectionRendererKey(section: SectionModel): string | undefined {
    const configuredRendererKey = section.rendererKey
        || (typeof section.settings.rendererKey === 'string' ? section.settings.rendererKey : undefined);

    if (configuredRendererKey && COMPATIBILITY_RENDERER_KEYS[configuredRendererKey]) {
        return COMPATIBILITY_RENDERER_KEYS[configuredRendererKey];
    }

    return COMPATIBILITY_RENDERER_KEYS[section.type];
}

function UnknownSectionFallback({ section, rendererKey }: { section: SectionModel; rendererKey?: string }): ReactNode {
    const sectionTitle = typeof section.settings.title === 'string' && section.settings.title.trim().length > 0
        ? section.settings.title.trim()
        : 'Theme section unavailable';

    return (
        <section
            data-theme-section-fallback="true"
            data-section-id={section.id}
            data-section-type={section.type}
            data-renderer-key={rendererKey || 'unresolved'}
            aria-label={`Unsupported theme section ${section.type}`}
            className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <p className="font-medium text-slate-900 dark:text-slate-100">{sectionTitle}</p>
                <p className="mt-1">
                    Renderer {rendererKey || section.type} is not available in this storefront runtime.
                </p>
            </div>
        </section>
    );
}

export function renderRegisteredSection(props: SectionRendererProps): ReactNode {
    const rendererKey = resolveSectionRendererKey(props.section);
    if (!rendererKey) return <UnknownSectionFallback section={props.section} />;

    const renderer = APPROVED_SECTION_RENDERERS[rendererKey];
    if (!renderer) return <UnknownSectionFallback section={props.section} rendererKey={rendererKey} />;

    return renderer(props);
}
