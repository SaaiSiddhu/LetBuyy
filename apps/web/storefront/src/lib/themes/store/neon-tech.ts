import { ThemeEntry } from '../types';

export const neonTechStore: ThemeEntry = {
    slug: 'neon-tech',
    name: 'Neon Tech Store',
    description: 'Futuristic dark theme with neon accents for tech & gadgets',
    longDescription: `Neon Tech Store is a cutting-edge e-commerce theme designed for electronics, gaming gear, and tech gadgets. The deep dark palette with electric cyan and purple neon accents creates a futuristic atmosphere. Features include animated grid backgrounds, glowing hover effects, and a high-contrast product grid.

**Perfect for:** Electronics · Gaming · Tech Gadgets · Software

The theme uses bold typography with a monospace accent font for that hacker-chic aesthetic. Product cards feature glassmorphism effects and neon borders on hover, making every interaction feel like navigating a cyberpunk interface.`,
    siteType: 'store',
    themeId: 'tech_elite',
    pricing: 'premium',
    price: 29,
    tags: ['tech', 'electronics', 'dark', 'neon', 'gaming', 'futuristic'],
    features: ['Neon Effects', 'Glassmorphism', 'Product Grid', 'Dark Mode', 'Cart & Checkout', 'Animated Backgrounds', 'Mobile Responsive'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1200',
        'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?q=80&w=1200',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.7,
    reviewCount: 63,
    demoConfig: {
        id: 'theme-neon-tech',
        sellerId: 'theme-author',
        name: 'Neon Tech Store',
        tagline: 'Future-Forward Gear',
        subdomain: 'neon-tech',
        themeId: 'tech_elite',
        siteType: 'store',
        selectedProductIds: ['1', '2', '3', '4'],
        status: 'published',
        paymentGateways: ['stripe'],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'tech_elite',
            themeSettings: {
                primaryColor: '#00D4FF',
                secondaryColor: '#7B2FFF',
                accentColor: '#00FF88',
                backgroundColor: '#0A0A0F',
                textColor: '#FFFFFF',
                fontFamily: 'Inter',
                headingFontFamily: 'Space Grotesk',
                borderRadius: 8,
                enableAnimations: true,
                enableShadows: true,
                isDark: true,
                surfaceColor: '#1A1A2E',
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'Next-Gen Tech',
                        subheading: 'Gear up for the future.',
                        ctaText: 'Browse Gadgets',
                        ctaLink: '#products',
                        image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=2000',
                        overlay: 0.6, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'grid-1', type: 'productGrid', isVisible: true, order: 1,
                    settings: { title: 'Latest Drops', subtitle: 'Cutting-edge technology', columns: 4, showPrice: true, showRating: true, showAddToCart: true }
                },
                {
                    id: 'testimonials-1', type: 'testimonials', isVisible: true, order: 2,
                    settings: { title: 'User Reviews', layout: 'carousel' },
                    blocks: [
                        { id: 't1', type: 'testimonialCard', order: 0, settings: { name: 'Alex T.', text: 'Best tech store online. Lightning fast shipping.', rating: 5 }, isVisible: true },
                        { id: 't2', type: 'testimonialCard', order: 1, settings: { name: 'Sam K.', text: 'Amazing product quality and great support!', rating: 5 }, isVisible: true },
                    ]
                }
            ]
        }
    }
};
