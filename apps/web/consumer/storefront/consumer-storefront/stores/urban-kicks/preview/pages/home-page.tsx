'use client';

import { urbanKicks } from '@/lib/themes/store/urban-kicks';
import PreviewShell from '../components/preview-shell';
import PreviewSectionRenderer from '../section-renderer';
import { MOCK_PRODUCTS } from '../lib/mock-data';
import { SectionModel } from '@/types/store';

// Extra demo sections not in the base template
const EXTRA_SECTIONS: SectionModel[] = [
    {
        id: 'brand-marquee-1',
        type: 'brandMarquee',
        order: 0.5,
        isVisible: true,
        settings: {
            title: 'Trusted by top brands worldwide',
            speed: 25,
            pauseOnHover: true,
            brands: [
                'NIKE', 'ADIDAS', 'PUMA', 'JORDAN', 'NEW BALANCE',
                'CONVERSE', 'REEBOK', 'VANS', 'ASICS', 'UNDER ARMOUR',
            ],
        },
    },
    {
        id: 'category-grid-1',
        type: 'categoryGrid',
        order: 1.5,
        isVisible: true,
        settings: {
            title: 'Shop by Category',
            subtitle: 'Find exactly what you\'re looking for',
            columns: 3,
            cardStyle: 'overlay',
        },
    },
    {
        id: 'trust-badges-1',
        type: 'trustBadges',
        order: 2.5,
        isVisible: true,
        settings: {
            badges: [
                { icon: 'truck', label: 'Free Shipping', description: 'On orders above ₹999' },
                { icon: 'shield-check', label: '100% Authentic', description: 'Guaranteed genuine products' },
                { icon: 'rotate-ccw', label: 'Easy Returns', description: '7-day hassle-free returns' },
                { icon: 'headphones', label: '24/7 Support', description: 'We\'re here to help' },
            ],
        },
    },
];

export default function UrbanKicksHomePage() {
    const demo = urbanKicks.demoConfig;
    const baseSections = demo.templateConfig.sections;
    const themeSettings = demo.templateConfig.themeSettings;

    // Merge base sections with extra demo sections
    const allSections = [...baseSections, ...EXTRA_SECTIONS];

    return (
        <PreviewShell>
            <PreviewSectionRenderer
                sections={allSections}
                themeSettings={themeSettings}
                products={MOCK_PRODUCTS}
            />
        </PreviewShell>
    );
}
