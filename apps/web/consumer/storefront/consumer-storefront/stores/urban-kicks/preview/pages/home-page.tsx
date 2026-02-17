'use client';

import { urbanKicks } from '@/lib/themes/store/urban-kicks';
import HeroSection from '@/components/sections/hero';
import ProductGrid from '@/components/sections/product-grid';
import TestimonialsSection from '@/components/sections/testimonials';
import NewsletterSection from '@/components/sections/newsletter';
import { SectionModel } from '@/types/store';
import PreviewShell from '../components/preview-shell';
import { MOCK_PRODUCTS } from '../lib/mock-data';

export default function UrbanKicksHomePage() {
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
                            <ProductGrid
                                key={section.id}
                                section={section}
                                products={MOCK_PRODUCTS.slice(0, 6)}
                                theme={themeSettings}
                            />
                        );
                    case 'testimonials':
                        return (
                            <TestimonialsSection
                                key={section.id}
                                section={section}
                                theme={themeSettings}
                            />
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
