/**
 * Urban Kicks — Dynamic Section Renderer
 *
 * Server component that maps section types to shared section components
 * for rendering with real store data.
 */

import { SectionModel, ThemeSettings, ProductModel } from '@/types/store';
import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import NewsletterSection from '@/components/sections/newsletter';
import FeaturedProducts from '@/components/sections/featured-products';
import AboutSection from '@/components/sections/about-section';
import CtaSection from '@/components/sections/cta-section';

interface SectionRendererProps {
    section: SectionModel;
    theme: ThemeSettings;
    products?: ProductModel[];
    siteType?: string;
}

export default function SectionRenderer({
    section,
    theme,
    products = [],
    siteType = 'store',
}: SectionRendererProps) {
    switch (section.type) {
        case 'heroBanner':
            return <HeroSection section={section} theme={theme} />;

        case 'productGrid':
            return siteType === 'store'
                ? <ProductGrid section={section} products={products} theme={theme} />
                : null;

        case 'featuredProducts':
            return siteType === 'store'
                ? <FeaturedProducts section={section} products={products} theme={theme} />
                : null;

        case 'testimonials':
            return <TestimonialsSection section={section} theme={theme} />;

        case 'newsletter':
            return <NewsletterSection section={section} theme={theme} />;

        case 'aboutSection':
            return <AboutSection section={section} theme={theme} />;

        case 'ctaSection':
            return <CtaSection section={section} theme={theme} />;

        // Header, footer, and theme-specific client sections
        // are rendered by the layout shell — skip here
        case 'header':
        case 'footer':
        case 'categoryGrid':
        case 'brandMarquee':
        case 'trustBadges':
            return null;

        default:
            return null;
    }
}
