import { ThemeEntry } from '../types';

export const creativeFolio: ThemeEntry = {
    slug: 'creative-folio',
    name: 'Creative Folio',
    description: 'Fresh, modern portfolio theme for creatives & designers',
    longDescription: `Creative Folio is a clean, minimalist portfolio theme built for designers, photographers, and creative professionals. The fresh mint palette with ample whitespace puts your work front and center. Features a masonry project grid, smooth scroll animations, and an elegant contact form.

**Perfect for:** Designers · Photographers · Artists · Illustrators

The single-page scroll experience guides visitors through your work, skills, and services with fluid transitions. Each portfolio card features hover overlays with project details, and the responsive grid adapts from 3 columns on desktop to a single column on mobile.`,
    siteType: 'portfolio',
    themeId: 'fresh_mint',
    pricing: 'free',
    tags: ['creative', 'portfolio', 'minimal', 'designer', 'photography'],
    features: ['Portfolio Grid', 'Smooth Scroll', 'Contact Form', 'Services Section', 'Responsive', 'Animations', 'Social Links'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=1200',
        'https://images.unsplash.com/photo-1558655146-9f40138edfeb?q=80&w=1200',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.7,
    reviewCount: 156,
    demoConfig: {
        id: 'theme-creative-folio',
        sellerId: 'theme-author',
        name: 'Sarah Chen',
        tagline: 'UI/UX Designer & Creative Director',
        subdomain: 'creative-folio',
        themeId: 'fresh_mint',
        siteType: 'portfolio',
        selectedProductIds: [],
        status: 'published',
        paymentGateways: [],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'fresh_mint',
            themeSettings: {
                primaryColor: '#059669',
                secondaryColor: '#10B981',
                accentColor: '#34D399',
                backgroundColor: '#F0FDF4',
                textColor: '#064E3B',
                fontFamily: 'Inter',
                headingFontFamily: 'DM Serif Display',
                borderRadius: 12,
                enableAnimations: true,
                enableShadows: true,
                isDark: false,
                surfaceColor: '#ECFDF5',
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'Sarah Chen',
                        subheading: 'UI/UX Designer crafting beautiful digital experiences.',
                        ctaText: 'View My Work',
                        ctaLink: '#portfolio',
                        image: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=2000',
                        overlay: 0.3, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'portfolio-1', type: 'portfolioGrid', isVisible: true, order: 1,
                    settings: { title: 'Selected Work', subtitle: 'A curated collection of recent projects', columns: 3 },
                    blocks: [
                        { id: 'p1', type: 'portfolioItem', order: 0, settings: { title: 'Brand Identity — Luxe', category: 'Branding', image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?q=80&w=600' }, isVisible: true },
                        { id: 'p2', type: 'portfolioItem', order: 1, settings: { title: 'Mobile App — FitTrack', category: 'UI/UX', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600' }, isVisible: true },
                        { id: 'p3', type: 'portfolioItem', order: 2, settings: { title: 'E-commerce — Bloom', category: 'Web Design', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600' }, isVisible: true },
                        { id: 'p4', type: 'portfolioItem', order: 3, settings: { title: 'Dashboard — Analytics', category: 'Product Design', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600' }, isVisible: true },
                        { id: 'p5', type: 'portfolioItem', order: 4, settings: { title: 'Landing Page — Startup', category: 'Web Design', image: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?q=80&w=600' }, isVisible: true },
                        { id: 'p6', type: 'portfolioItem', order: 5, settings: { title: 'Icon System — DevKit', category: 'Illustration', image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?q=80&w=600' }, isVisible: true },
                    ]
                },
                {
                    id: 'services-1', type: 'servicesGrid', isVisible: true, order: 2,
                    settings: { title: 'Services', subtitle: 'What I can do for you' },
                    blocks: [
                        { id: 's1', type: 'serviceCard', order: 0, settings: { title: 'UI/UX Design', description: 'User-centered design for web and mobile applications.', icon: '🎨' }, isVisible: true },
                        { id: 's2', type: 'serviceCard', order: 1, settings: { title: 'Brand Identity', description: 'Logo, typography, and visual systems for your brand.', icon: '✨' }, isVisible: true },
                        { id: 's3', type: 'serviceCard', order: 2, settings: { title: 'Web Development', description: 'Clean, responsive websites built with modern tech.', icon: '💻' }, isVisible: true },
                    ]
                },
                {
                    id: 'contact-1', type: 'contactForm', isVisible: true, order: 3,
                    settings: { title: 'Get In Touch', subtitle: "Let's work together on your next project.", email: 'sarah@example.com' }
                }
            ]
        }
    }
};
