import { ThemeEntry } from '../types';

export const luxeAtelier: ThemeEntry = {
    slug: 'luxe-atelier',
    name: 'Luxe Atelier',
    description: 'Dark, premium luxury store theme with gold accents',
    longDescription: `Luxe Atelier is a high-end e-commerce theme designed for luxury brands, jewelry stores, and premium fashion houses. The dark palette with warm gold accents creates an atmosphere of exclusivity and sophistication. Features include a cinematic video hero, elegant product cards with hover zoom, and a refined checkout experience.

**Perfect for:** Luxury Fashion · Jewelry · Premium Brands · Watches

Every element is crafted to convey prestige — from the serif typography to the subtle shimmer animations. The dark background makes product images pop, while gold call-to-action buttons guide customers through a frictionless shopping journey.`,
    siteType: 'store',
    themeId: 'luxury_premium',
    pricing: 'premium',
    price: 49,
    tags: ['luxury', 'premium', 'dark', 'gold', 'elegant', 'jewelry'],
    features: ['Video Hero', 'Product Zoom', 'Cart & Checkout', 'Gold Accents', 'Dark Mode', 'Serif Typography', 'SEO Ready', 'Multi-payment'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200',
        'https://images.unsplash.com/photo-1515562141589-67f0d934c83a?q=80&w=1200',
        'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.9,
    reviewCount: 87,
    demoConfig: {
        id: 'theme-luxe-atelier',
        sellerId: 'theme-author',
        name: 'Luxe Atelier',
        tagline: 'Where Luxury Meets Craft',
        subdomain: 'luxe-atelier',
        themeId: 'luxury_premium',
        siteType: 'store',
        selectedProductIds: ['1', '2', '3', '4'],
        status: 'published',
        paymentGateways: ['stripe'],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'luxury_premium',
            themeSettings: {
                primaryColor: '#C9A96E',
                secondaryColor: '#8B7355',
                accentColor: '#D4AF37',
                backgroundColor: '#1C1C1C',
                textColor: '#F8F5F0',
                fontFamily: 'Playfair Display',
                headingFontFamily: 'Playfair Display',
                borderRadius: 4,
                enableAnimations: true,
                enableShadows: true,
                isDark: true,
                surfaceColor: '#2A2A2A',
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'The Art of Luxury',
                        subheading: 'Handcrafted pieces for the discerning collector.',
                        ctaText: 'Explore Collection',
                        ctaLink: '#products',
                        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2000',
                        overlay: 0.5, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'grid-1', type: 'productGrid', isVisible: true, order: 1,
                    settings: { title: 'Curated Selection', subtitle: 'Timeless pieces', columns: 3, showPrice: true, showRating: false, showAddToCart: true }
                },
                {
                    id: 'testimonials-1', type: 'testimonials', isVisible: true, order: 2,
                    settings: { title: 'Client Testimonials', layout: 'carousel' },
                    blocks: [
                        { id: 't1', type: 'testimonialCard', order: 0, settings: { name: 'Victoria M.', text: 'Exquisite craftsmanship. Worth every penny.', rating: 5 }, isVisible: true },
                        { id: 't2', type: 'testimonialCard', order: 1, settings: { name: 'James R.', text: 'The attention to detail is remarkable.', rating: 5 }, isVisible: true },
                    ]
                }
            ]
        }
    }
};
