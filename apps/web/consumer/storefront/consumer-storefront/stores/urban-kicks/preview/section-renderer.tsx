'use client';

/**
 * Urban Kicks — Preview Section Renderer
 *
 * Client component that maps section types to preview components.
 * Used by the preview home page to render sections based on the demo config.
 */

import { SectionModel, ThemeSettings, ProductModel } from '@/types/store';
import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import NewsletterSection from '@/components/sections/newsletter';
import FeaturedProducts from '@/components/sections/featured-products';
import AboutSection from '@/components/sections/about-section';
import CtaSection from '@/components/sections/cta-section';
import CategoryGrid from './components/sections/category-grid';
import BrandMarquee from './components/sections/brand-marquee';
import TrustBadges from './components/sections/trust-badges';

interface PreviewSectionRendererProps {
    sections: SectionModel[];
    themeSettings: ThemeSettings;
    products?: ProductModel[];
    basePath?: string;
}

export default function PreviewSectionRenderer({
    sections,
    themeSettings,
    products = [],
    basePath = '/theme-preview/urban-kicks',
}: PreviewSectionRendererProps) {
    return (
        <>
            {sections
                .filter(s => s.isVisible !== false)
                .sort((a, b) => a.order - b.order)
                .map(section => (
                    <PreviewSection
                        key={section.id}
                        section={section}
                        theme={themeSettings}
                        products={products}
                        basePath={basePath}
                    />
                ))}
        </>
    );
}

interface PreviewSectionProps {
    section: SectionModel;
    theme: ThemeSettings;
    products: ProductModel[];
    basePath: string;
}

function PreviewSection({ section, theme, products, basePath }: PreviewSectionProps) {
    switch (section.type) {
        case 'heroBanner':
            return <HeroSection section={section} theme={theme} />;

        case 'productGrid':
            return <ProductGrid section={section} products={products.slice(0, 8)} theme={theme} />;

        case 'featuredProducts':
            return <FeaturedProducts section={section} products={products.slice(0, 4)} theme={theme} />;

        case 'testimonials':
            return <TestimonialsSection section={section} theme={theme} />;

        case 'newsletter':
            return <NewsletterSection section={section} theme={theme} />;

        case 'aboutSection':
            return <AboutSection section={section} theme={theme} />;

        case 'ctaSection':
            return <CtaSection section={section} theme={theme} />;

        case 'categoryGrid':
            return <CategoryGrid section={section} basePath={basePath} />;

        case 'brandMarquee':
            return <BrandMarquee section={section} />;

        case 'trustBadges':
            return <TrustBadges section={section} />;

        // Header and footer are handled by PreviewShell — skip here
        case 'header':
        case 'footer':
            return null;

        default:
            if (process.env.NODE_ENV === 'development') {
                return (
                    <div className="py-8 text-center text-sm text-black/30 border-y border-dashed border-black/10">
                        Unknown section type: <code className="font-mono">{section.type}</code>
                    </div>
                );
            }
            return null;
    }
}
