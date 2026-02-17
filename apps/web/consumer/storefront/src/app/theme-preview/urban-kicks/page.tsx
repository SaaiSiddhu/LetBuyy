'use client';

import { urbanKicks } from '@/lib/themes/store/urban-kicks';
import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import NewsletterSection from '@/components/sections/newsletter';
import CategorySection from './_components/category-section';
import BrandMarquee from './_components/brand-marquee';
import TrustFeatures from './_components/trust-features';
import { SectionModel } from '@/types/store';
import PreviewShell from './_components/preview-shell';
import { MOCK_PRODUCTS } from './_lib/mock-data';

export default function UrbanKicksPreview() {
    const demo = urbanKicks.demoConfig;
    const sections = demo.templateConfig.sections;
    const themeSettings = demo.templateConfig.themeSettings;

    return (
        <PreviewShell>
            {sections.map((section: SectionModel) => {
                switch (section.type) {
                    case 'heroBanner':
                        return (
                            <HeroSection
                                key={section.id}
                                section={section}
                                theme={themeSettings}
                            />
                        );
                    case 'productGrid':
                        return (
                            <div key={section.id}>
                                <ProductGrid
                                    section={section}
                                    products={MOCK_PRODUCTS.slice(0, 6)}
                                    theme={themeSettings}
                                />
                                <CategorySection />
                                <BrandMarquee />
                            </div>
                        );
                    case 'testimonials':
                        return (
                            <div key={section.id}>
                                <TestimonialsSection
                                    section={section}
                                    theme={themeSettings}
                                />
                                <TrustFeatures />
                            </div>
                        );
                    case 'newsletter':
                        return (
                            <NewsletterSection
                                key={section.id}
                                section={section}
                                theme={themeSettings}
                            />
                        );
                    default:
                        return null;
                }
            })}
        </PreviewShell>
    );
}
