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
import ProductDetailSection from '@/components/sections/product-detail-section';
import DynamicHeader from '@/components/layout/dynamic-header';
import DynamicFooter from '@/components/layout/dynamic-footer';
import type { FooterSettings, HeaderSettings, SectionModel } from '@/types/store';
import type { SectionRendererProps } from './types';
import type { ReactNode } from 'react';

type SectionRenderer = (props: SectionRendererProps) => ReactNode;

const COMPATIBILITY_RENDERER_KEYS: Record<string, string> = {
    header: 'core.header',
    footer: 'core.footer',
    heroBanner: 'core.hero',
    productGrid: 'core.product-grid',
    productDetail: 'core.product-detail',
    featuredProducts: 'core.featured-products',
    testimonials: 'core.testimonials',
    aboutSection: 'core.about',
    newsletter: 'core.newsletter',
    portfolioGrid: 'core.portfolio-grid',
    skillsSection: 'core.skills',
    experienceTimeline: 'core.experience-timeline',
    contactForm: 'core.contact-form',
    ctaSection: 'core.cta',
    servicesGrid: 'core.services-grid',
    contentPage: 'core.rich-content',
    categoryGrid: 'commerce.category-grid',
    brandMarquee: 'commerce.brand-marquee',
    trustBadges: 'commerce.trust-badges',
};

const APPROVED_SECTION_RENDERERS: Record<string, SectionRenderer> = {
    'core.header': ({ section, store, data }) => (
        <DynamicHeader
            store={store}
            settings={section.settings as Partial<HeaderSettings> as HeaderSettings}
            products={data.products || []}
        />
    ),
    'core.footer': ({ section, store }) => (
        <DynamicFooter
            store={store}
            settings={section.settings as Partial<FooterSettings> as FooterSettings}
        />
    ),
    'core.hero': ({ section, theme }) => <HeroSection section={section} theme={theme} />,
    'core.product-grid': ({ section, data, theme, store, basePath }) => store.siteType === 'store'
        ? <ProductGrid section={section} products={data.products || []} theme={theme} basePath={basePath} />
        : null,
    'core.product-detail': ({ section, data, theme, store, route }) => store.siteType === 'store'
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
    'core.featured-products': ({ section, data, theme, store }) => store.siteType === 'store'
        ? <FeaturedProducts section={section} products={data.products || []} theme={theme} />
        : null,
    'core.testimonials': ({ section, theme }) => <TestimonialsSection section={section} theme={theme} />,
    'core.about': ({ section, theme }) => <AboutSection section={section} theme={theme} />,
    'core.newsletter': ({ section, theme }) => <NewsletterSection section={section} theme={theme} />,
    'core.portfolio-grid': ({ section, theme }) => <PortfolioGrid section={section} theme={theme} />,
    'core.skills': ({ section, theme }) => <SkillsSection section={section} theme={theme} />,
    'core.experience-timeline': ({ section, theme }) => <ExperienceTimeline section={section} theme={theme} />,
    'core.contact-form': ({ section, theme }) => <ContactForm section={section} theme={theme} />,
    'core.cta': ({ section, theme }) => <CtaSection section={section} theme={theme} />,
    'core.services-grid': ({ section, theme }) => <ServicesGrid section={section} theme={theme} />,
    'core.rich-content': ({ section, theme }) => <RichContentSection section={section} theme={theme} />,
    'commerce.category-grid': ({ section, basePath }) => <CategoryGrid section={section} basePath={basePath} />,
    'commerce.brand-marquee': ({ section }) => <BrandMarquee section={section} />,
    'commerce.trust-badges': ({ section }) => <TrustBadges section={section} />,
};

export function resolveSectionRendererKey(section: SectionModel): string | undefined {
    const configuredRendererKey = section.rendererKey
        || (typeof section.settings.rendererKey === 'string' ? section.settings.rendererKey : undefined);

    return configuredRendererKey || COMPATIBILITY_RENDERER_KEYS[section.type];
}

export function renderRegisteredSection(props: SectionRendererProps): ReactNode {
    const rendererKey = resolveSectionRendererKey(props.section);
    if (!rendererKey) return null;

    const renderer = APPROVED_SECTION_RENDERERS[rendererKey];
    if (!renderer) return null;

    return renderer(props);
}
