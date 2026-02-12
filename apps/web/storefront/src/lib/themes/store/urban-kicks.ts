import { ThemeEntry } from '../types';

export const urbanKicks: ThemeEntry = {
    slug: 'urban-kicks',
    name: 'Urban Kicks',
    description: 'Clean, minimal streetwear & sneaker store theme',
    longDescription: `Urban Kicks is a bold, minimal e-commerce theme built for streetwear brands, sneaker shops, and lifestyle stores. It features a full-screen hero with cinematic overlays, a 4-column product grid with hover animations, and a testimonial carousel. The black-and-white palette lets your products take center stage while maintaining a premium, high-fashion feel.

**Perfect for:** Streetwear · Sneakers · Apparel · Accessories

The responsive layout adapts seamlessly from desktop to mobile, with touch-friendly interactions and optimized image loading. Every detail is crafted for conversions — from the prominent \"Add to Cart\" buttons to the streamlined checkout flow.`,
    siteType: 'store',
    themeId: 'minimal_modern',
    pricing: 'free',
    tags: ['streetwear', 'sneakers', 'fashion', 'minimal', 'black-white'],
    features: ['Full-width Hero', 'Product Grid', 'Cart & Checkout', 'Testimonials', 'Mobile Responsive', 'Animations', 'SEO Ready', 'Multi-payment'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=1200',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200',
        'https://images.unsplash.com/photo-1556906781-9a412961c28c?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.8,
    reviewCount: 124,
    demoConfig: {
        id: 'theme-urban-kicks',
        sellerId: 'theme-author',
        name: 'Urban Kicks',
        tagline: 'Premium Streetwear & Sneakers',
        subdomain: 'urban-kicks',
        themeId: 'minimal_modern',
        siteType: 'store',
        selectedProductIds: ['1', '2', '3', '4'],
        status: 'published',
        paymentGateways: ['razorpay'],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'minimal_modern',
            themeSettings: {
                primaryColor: '#000000',
                secondaryColor: '#FFFFFF',
                accentColor: '#E5E5E5',
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A2E',
                fontFamily: 'Inter',
                headingFontFamily: 'Inter',
                borderRadius: 12,
                enableAnimations: true,
                enableShadows: true,
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'Streetwear 2026',
                        subheading: 'The future of fashion is here.',
                        ctaText: 'Shop New Arrivals',
                        ctaLink: '#products',
                        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2000',
                        overlay: 0.4, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'grid-1', type: 'productGrid', isVisible: true, order: 1,
                    settings: { title: 'Trending Drops', subtitle: 'Hottest picks this season', columns: 4, showPrice: true, showRating: true, showAddToCart: true }
                },
                {
                    id: 'testimonials-1', type: 'testimonials', isVisible: true, order: 2,
                    settings: { title: 'What Our Customers Say', layout: 'carousel' },
                    blocks: [
                        { id: 't1', type: 'testimonialCard', order: 0, settings: { name: 'Priya S.', text: 'Amazing quality! Best sneakers I\'ve ever owned.', rating: 5 }, isVisible: true },
                        { id: 't2', type: 'testimonialCard', order: 1, settings: { name: 'Rahul K.', text: 'Fast delivery and excellent packaging.', rating: 5 }, isVisible: true },
                        { id: 't3', type: 'testimonialCard', order: 2, settings: { name: 'Ananya M.', text: 'Love the designs! Will definitely order again.', rating: 4 }, isVisible: true },
                    ]
                }
            ]
        }
    }
};
