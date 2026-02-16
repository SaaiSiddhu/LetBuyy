import { ThemeEntry } from '../types';

export const naturesBasket: ThemeEntry = {
    slug: 'natures-basket',
    name: "Nature's Basket",
    description: 'Warm, organic theme for natural products & eco brands',
    longDescription: `Nature's Basket is a warm, earthy e-commerce theme designed for organic products, eco-friendly brands, and artisanal goods. The natural color palette with linen-textured backgrounds and sage green accents evokes a farm-to-table aesthetic. Features organic shapes, gentle shadows, and smooth transitions.

**Perfect for:** Organic Food · Eco Products · Artisan Crafts · Natural Beauty

The rounded corners and soft typography create a welcoming atmosphere that puts customers at ease. Product cards use warm shadows and earthy borders, while the hero section features nature-inspired imagery with elegant text overlays.`,
    siteType: 'store',
    themeId: 'natural_organic',
    pricing: 'free',
    tags: ['organic', 'eco', 'natural', 'green', 'artisan', 'warm'],
    features: ['Organic Shapes', 'Warm Palette', 'Product Grid', 'Cart & Checkout', 'Newsletter', 'Mobile Responsive', 'SEO Ready'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200',
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200',
        'https://images.unsplash.com/photo-1607349913338-fca6f7fc608d?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.6,
    reviewCount: 98,
    demoConfig: {
        id: 'theme-natures-basket',
        sellerId: 'theme-author',
        name: "Nature's Basket",
        tagline: 'Pure & Natural Living',
        subdomain: 'natures-basket',
        themeId: 'natural_organic',
        siteType: 'store',
        selectedProductIds: ['1', '2', '3', '4'],
        status: 'published',
        paymentGateways: ['razorpay'],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'natural_organic',
            themeSettings: {
                primaryColor: '#2D5016',
                secondaryColor: '#6B8E23',
                accentColor: '#DAA520',
                backgroundColor: '#F5F1EB',
                textColor: '#2D5016',
                fontFamily: 'DM Sans',
                headingFontFamily: 'Playfair Display',
                borderRadius: 16,
                enableAnimations: true,
                enableShadows: true,
                isDark: false,
                surfaceColor: '#FDFCFA',
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'Farm Fresh Goodness',
                        subheading: 'Organic produce delivered to your door.',
                        ctaText: 'Shop Organic',
                        ctaLink: '#products',
                        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000',
                        overlay: 0.3, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'grid-1', type: 'productGrid', isVisible: true, order: 1,
                    settings: { title: 'Fresh Picks', subtitle: 'Handpicked from local farms', columns: 4, showPrice: true, showRating: true, showAddToCart: true }
                },
                {
                    id: 'testimonials-1', type: 'testimonials', isVisible: true, order: 2,
                    settings: { title: 'Happy Customers', layout: 'carousel' },
                    blocks: [
                        { id: 't1', type: 'testimonialCard', order: 0, settings: { name: 'Meera J.', text: 'The freshest organic produce I\'ve found online!', rating: 5 }, isVisible: true },
                        { id: 't2', type: 'testimonialCard', order: 1, settings: { name: 'Arjun P.', text: 'Love supporting local farmers through this store.', rating: 5 }, isVisible: true },
                    ]
                }
            ]
        }
    }
};
