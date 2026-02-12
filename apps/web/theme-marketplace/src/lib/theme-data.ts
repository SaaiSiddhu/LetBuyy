import { Theme } from '@/types';

/**
 * Mock theme data for development.
 * In production, these come from the Supabase `themes` table.
 */
export const MOCK_THEMES: Theme[] = [
    {
        id: 'theme-urban-kicks',
        slug: 'urban-kicks',
        name: 'Urban Kicks',
        description: 'Clean, minimal streetwear & sneaker store theme with bold typography and cinematic hero.',
        long_description: 'Urban Kicks is a bold, minimal e-commerce theme built for streetwear brands, sneaker shops, and urban fashion labels. Features a full-screen hero with cinematic overlays, 4-column product grid with hover animations, and testimonial carousel.',
        category: 'store',
        industry: ['streetwear', 'sneakers', 'fashion'],
        theme_preset_id: 'minimal_modern',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'free',
        letbuyy_price_usd: 0,
        letbuyy_price_inr: 0,
        wordpress_price_usd: 29,
        shopify_price_usd: 29,
        html_price_usd: 19,
        react_price_usd: 39,
        thumbnail_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/urban-kicks',
        screenshots: [
            'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=1200',
            'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1200',
            'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1200',
        ],
        demo_url: 'https://urban-kicks.letbuyy.store',
        customizable_sections: {},
        color_presets: [
            { name: 'Default', colors: { primary: '#000000', secondary: '#FFFFFF', accent: '#E5E5E5' } },
            { name: 'Fire', colors: { primary: '#1A1A1A', secondary: '#FF4500', accent: '#FFD700' } },
        ],
        font_options: ['Inter', 'Space Grotesk', 'DM Sans', 'Outfit'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['streetwear', 'sneakers', 'fashion', 'minimal', 'black-white'],
        features: ['Full-width Hero', 'Product Grid', 'Cart & Checkout', 'Testimonials', 'Mobile Responsive', 'Animations', 'SEO Ready'],
        supported_platforms: ['letbuyy', 'wordpress', 'shopify', 'html'],
        rating: 4.8,
        review_count: 124,
        install_count: 2400,
        download_count: 850,
        purchase_count: 0,
        published_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-luxe-atelier',
        slug: 'luxe-atelier',
        name: 'Luxe Atelier',
        description: 'Premium luxury fashion theme with elegant typography, warm tones, and sophisticated product displays.',
        long_description: 'Luxe Atelier is designed for high-end fashion boutiques, jewelry stores, and luxury brands. Featuring warm gold accents, serif typography, and a curated editorial layout that elevates your products.',
        category: 'store',
        industry: ['luxury', 'fashion', 'jewelry'],
        theme_preset_id: 'luxe_atelier',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'one_time',
        letbuyy_price_usd: 29,
        letbuyy_price_inr: 2399,
        wordpress_price_usd: 49,
        shopify_price_usd: 49,
        html_price_usd: 29,
        react_price_usd: 59,
        thumbnail_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/luxe-atelier',
        screenshots: [
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200',
            'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=1200',
        ],
        demo_url: 'https://luxe-atelier.letbuyy.store',
        customizable_sections: {},
        color_presets: [
            { name: 'Gold', colors: { primary: '#2C1810', secondary: '#D4A574', accent: '#F5E6D3' } },
            { name: 'Silver', colors: { primary: '#1A1A2E', secondary: '#C0C0C0', accent: '#E8E8E8' } },
        ],
        font_options: ['Playfair Display', 'Cormorant Garamond', 'Lora'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['luxury', 'fashion', 'elegant', 'premium', 'gold'],
        features: ['Editorial Layout', 'Product Showcase', 'Wishlist', 'Quick View', 'Cart', 'Mobile Responsive'],
        supported_platforms: ['letbuyy', 'wordpress', 'shopify', 'html'],
        rating: 4.6,
        review_count: 87,
        install_count: 1200,
        download_count: 600,
        purchase_count: 520,
        published_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-neon-tech',
        slug: 'neon-tech',
        name: 'Neon Tech',
        description: 'Futuristic dark neon theme for electronics, gaming, and tech stores with glowing accents.',
        long_description: 'Neon Tech brings a cyberpunk-inspired aesthetic to your online store. Perfect for electronics, gaming gear, and tech accessories. Features neon gradients, glass-morphism cards, and dynamic hover effects.',
        category: 'store',
        industry: ['electronics', 'gaming', 'tech'],
        theme_preset_id: 'neon_tech',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'one_time',
        letbuyy_price_usd: 49,
        letbuyy_price_inr: 3999,
        wordpress_price_usd: 69,
        shopify_price_usd: 69,
        html_price_usd: 39,
        react_price_usd: 79,
        thumbnail_url: 'https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/neon-tech',
        screenshots: [
            'https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf?q=80&w=1200',
            'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=1200',
        ],
        demo_url: 'https://neon-tech.letbuyy.store',
        customizable_sections: {},
        color_presets: [
            { name: 'Cyber', colors: { primary: '#0a0a0f', secondary: '#00F5FF', accent: '#FF00E5' } },
            { name: 'Matrix', colors: { primary: '#0a0a0f', secondary: '#00FF41', accent: '#39FF14' } },
        ],
        font_options: ['Orbitron', 'Rajdhani', 'Share Tech Mono'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['tech', 'neon', 'dark', 'gaming', 'cyberpunk', 'futuristic'],
        features: ['Neon Glow Effects', 'Glass Cards', 'Product Grid', 'Cart', 'Animations', 'Mobile Responsive'],
        supported_platforms: ['letbuyy', 'wordpress', 'shopify', 'html', 'react'],
        rating: 4.9,
        review_count: 56,
        install_count: 980,
        download_count: 420,
        purchase_count: 380,
        published_at: '2026-01-15T00:00:00Z',
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-natures-basket',
        slug: 'natures-basket',
        name: "Nature's Basket",
        description: 'Warm, organic theme for food, grocery, and eco-friendly product stores.',
        long_description: "Nature's Basket is a warm, inviting theme designed for organic food stores, grocery delivery, farm-to-table brands, and eco-friendly product shops. Features earthy tones, rounded corners, and nature-inspired design elements.",
        category: 'store',
        industry: ['food', 'grocery', 'organic', 'eco-friendly'],
        theme_preset_id: 'natures_basket',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'free',
        letbuyy_price_usd: 0,
        letbuyy_price_inr: 0,
        wordpress_price_usd: 29,
        shopify_price_usd: 29,
        html_price_usd: 19,
        react_price_usd: 39,
        thumbnail_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/natures-basket',
        screenshots: [
            'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200',
            'https://images.unsplash.com/photo-1488459716781-31db52582fe9?q=80&w=1200',
        ],
        demo_url: 'https://natures-basket.letbuyy.store',
        customizable_sections: {},
        color_presets: [
            { name: 'Forest', colors: { primary: '#2D5016', secondary: '#8BC34A', accent: '#FFF8E1' } },
            { name: 'Earth', colors: { primary: '#5D4037', secondary: '#A1887F', accent: '#EFEBE9' } },
        ],
        font_options: ['Nunito', 'Quicksand', 'Poppins'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['organic', 'food', 'grocery', 'green', 'eco', 'natural'],
        features: ['Category Carousel', 'Product Grid', 'Recipe Section', 'Cart', 'Newsletter', 'Mobile Responsive'],
        supported_platforms: ['letbuyy', 'wordpress', 'html'],
        rating: 4.5,
        review_count: 45,
        install_count: 1800,
        download_count: 320,
        purchase_count: 0,
        published_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-creative-folio',
        slug: 'creative-folio',
        name: 'Creative Folio',
        description: 'Bold portfolio theme for designers, photographers, and creative professionals.',
        long_description: 'Creative Folio is a striking portfolio theme for designers, photographers, illustrators, and creative agencies. Features masonry layouts, full-bleed images, project case studies, and smooth page transitions.',
        category: 'portfolio',
        industry: ['design', 'photography', 'creative'],
        theme_preset_id: 'creative_folio',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'one_time',
        letbuyy_price_usd: 19,
        letbuyy_price_inr: 1499,
        wordpress_price_usd: 39,
        shopify_price_usd: 0,
        html_price_usd: 19,
        react_price_usd: 39,
        thumbnail_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/creative-folio',
        screenshots: [
            'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200',
            'https://images.unsplash.com/photo-1558655146-9f40138edfeb?q=80&w=1200',
        ],
        demo_url: '#',
        customizable_sections: {},
        color_presets: [
            { name: 'Dark', colors: { primary: '#1A1A1A', secondary: '#FF6B6B', accent: '#4ECDC4' } },
        ],
        font_options: ['Space Grotesk', 'Syne', 'Clash Display'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['portfolio', 'designer', 'creative', 'photography', 'minimal'],
        features: ['Masonry Grid', 'Project Pages', 'About Section', 'Contact Form', 'Animations', 'Mobile Responsive'],
        supported_platforms: ['letbuyy', 'wordpress', 'html', 'react'],
        rating: 4.7,
        review_count: 32,
        install_count: 650,
        download_count: 280,
        purchase_count: 240,
        published_at: '2026-01-20T00:00:00Z',
        created_at: '2026-01-20T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-clean-resume',
        slug: 'clean-resume',
        name: 'Clean Resume',
        description: 'Professional resume/CV theme with print-ready layouts and ATS-friendly design.',
        long_description: 'Clean Resume is a professional online resume theme designed for developers, marketers, and professionals. Features a clean, print-ready layout, skills visualization, timeline components, and downloadable PDF export.',
        category: 'resume',
        industry: ['professional', 'developer', 'marketing'],
        theme_preset_id: 'clean_resume',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'one_time',
        letbuyy_price_usd: 9,
        letbuyy_price_inr: 749,
        wordpress_price_usd: 19,
        shopify_price_usd: 0,
        html_price_usd: 9,
        react_price_usd: 19,
        thumbnail_url: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/clean-resume',
        screenshots: [
            'https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1200',
        ],
        demo_url: '#',
        customizable_sections: {},
        color_presets: [
            { name: 'Professional', colors: { primary: '#2C3E50', secondary: '#3498DB', accent: '#E74C3C' } },
        ],
        font_options: ['Inter', 'Roboto', 'Source Sans Pro'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['resume', 'cv', 'professional', 'minimal', 'print-ready'],
        features: ['Skills Chart', 'Experience Timeline', 'PDF Export', 'Contact Form', 'Mobile Responsive'],
        supported_platforms: ['letbuyy', 'wordpress', 'html'],
        rating: 4.4,
        review_count: 28,
        install_count: 900,
        download_count: 420,
        purchase_count: 380,
        published_at: '2026-01-10T00:00:00Z',
        created_at: '2026-01-10T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
    {
        id: 'theme-saas-launch',
        slug: 'saas-launch',
        name: 'SaaS Launch',
        description: 'High-converting SaaS landing page theme with pricing tables, feature showcases, and CTA sections.',
        long_description: 'SaaS Launch is a conversion-optimized landing page theme for SaaS products, apps, and startups. Includes pricing tables, feature comparison grids, testimonials, FAQ accordions, and multiple CTA sections with A/B testing support.',
        category: 'landing',
        industry: ['saas', 'startup', 'tech'],
        theme_preset_id: 'saas_launch',
        version: '1.0.0',
        is_active: true,
        letbuyy_pricing_type: 'one_time',
        letbuyy_price_usd: 39,
        letbuyy_price_inr: 3199,
        wordpress_price_usd: 59,
        shopify_price_usd: 0,
        html_price_usd: 29,
        react_price_usd: 49,
        thumbnail_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&h=500&fit=crop',
        preview_url: '/themes/saas-launch',
        screenshots: [
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200',
        ],
        demo_url: '#',
        customizable_sections: {},
        color_presets: [
            { name: 'Modern', colors: { primary: '#6C5CE7', secondary: '#00D2D3', accent: '#FD79A8' } },
        ],
        font_options: ['Inter', 'Plus Jakarta Sans', 'DM Sans'],
        author_id: null,
        author_name: 'LetBuyy Team',
        tags: ['saas', 'landing', 'startup', 'conversion', 'pricing'],
        features: ['Pricing Tables', 'Feature Grid', 'Testimonials', 'FAQ', 'Newsletter', 'Mobile Responsive', 'A/B Testing'],
        supported_platforms: ['letbuyy', 'wordpress', 'html', 'react'],
        rating: 4.8,
        review_count: 41,
        install_count: 730,
        download_count: 310,
        purchase_count: 290,
        published_at: '2026-01-05T00:00:00Z',
        created_at: '2026-01-05T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
    },
];

/** Helper: get themes filtered and paginated */
export function getFilteredThemes(filters: {
    category?: string;
    pricing?: string;
    sort?: string;
    search?: string;
    page?: number;
    limit?: number;
}) {
    let themes = [...MOCK_THEMES];

    if (filters.category && filters.category !== 'all') {
        themes = themes.filter(t => t.category === filters.category);
    }

    if (filters.pricing) {
        if (filters.pricing === 'free') {
            themes = themes.filter(t => t.letbuyy_pricing_type === 'free');
        } else if (filters.pricing === 'paid') {
            themes = themes.filter(t => t.letbuyy_pricing_type !== 'free');
        }
    }

    if (filters.search) {
        const q = filters.search.toLowerCase();
        themes = themes.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some(tag => tag.includes(q))
        );
    }

    // Sorting
    switch (filters.sort) {
        case 'newest':
            themes.sort((a, b) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
            break;
        case 'rating':
            themes.sort((a, b) => b.rating - a.rating);
            break;
        case 'price_low':
            themes.sort((a, b) => a.letbuyy_price_usd - b.letbuyy_price_usd);
            break;
        case 'price_high':
            themes.sort((a, b) => b.letbuyy_price_usd - a.letbuyy_price_usd);
            break;
        default: // popular
            themes.sort((a, b) => b.install_count - a.install_count);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const start = (page - 1) * limit;
    const paginated = themes.slice(start, start + limit);

    return {
        data: paginated,
        total: themes.length,
        page,
        totalPages: Math.ceil(themes.length / limit),
        hasMore: start + limit < themes.length,
    };
}

/** Helper: get single theme by slug */
export function getThemeBySlug(slug: string) {
    return MOCK_THEMES.find(t => t.slug === slug) || null;
}
