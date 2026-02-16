import { ThemeEntry } from '../types';

export const darkPortfolio: ThemeEntry = {
    slug: 'dark-portfolio',
    name: 'Dark Portfolio',
    description: 'Bold dark theme for developers & creative agencies',
    longDescription: `Dark Portfolio is a striking, dark-themed portfolio for developers, agencies, and digital creators. The deep purple-black background with vibrant accent colors creates a dramatic, professional atmosphere. Features include animated text reveals, a project showcase with modal previews, and a skills visualization section.

**Perfect for:** Developers · Agencies · Digital Creators · Tech Professionals

The theme leverages subtle grain textures and glassmorphism effects to add depth. Code-inspired typography accents and grid patterns reinforce the tech-forward aesthetic while maintaining excellent readability.`,
    siteType: 'portfolio',
    themeId: 'midnight_purple',
    pricing: 'premium',
    price: 39,
    tags: ['dark', 'developer', 'agency', 'bold', 'purple', 'tech'],
    features: ['Dark Mode', 'Animated Text', 'Project Showcase', 'Skills Visualization', 'Contact Form', 'Glassmorphism', 'Responsive'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&h=500&fit=crop',
    screenshots: [
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200',
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1200',
    ],
    author: 'LetBuyy Team',
    version: '1.0.0',
    rating: 4.9,
    reviewCount: 72,
    demoConfig: {
        id: 'theme-dark-portfolio',
        sellerId: 'theme-author',
        name: 'Dev Studio',
        tagline: 'Full-Stack Development Agency',
        subdomain: 'dark-portfolio',
        themeId: 'midnight_purple',
        siteType: 'portfolio',
        selectedProductIds: [],
        status: 'published',
        paymentGateways: [],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'midnight_purple',
            themeSettings: {
                primaryColor: '#A855F7',
                secondaryColor: '#7C3AED',
                accentColor: '#C084FC',
                backgroundColor: '#1a1625',
                textColor: '#FFFFFF',
                fontFamily: 'Inter',
                headingFontFamily: 'Space Grotesk',
                borderRadius: 8,
                enableAnimations: true,
                enableShadows: true,
                isDark: true,
                surfaceColor: '#2D2640',
            },
            sections: [
                {
                    id: 'hero-1', type: 'heroBanner', isVisible: true, order: 0,
                    settings: {
                        heading: 'We Build Digital',
                        subheading: 'Full-stack development for ambitious brands.',
                        ctaText: 'See Our Work',
                        ctaLink: '#portfolio',
                        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000',
                        overlay: 0.7, height: 'full', textAlign: 'center',
                    }
                },
                {
                    id: 'portfolio-1', type: 'portfolioGrid', isVisible: true, order: 1,
                    settings: { title: 'Case Studies', subtitle: 'Projects that define us', columns: 2 },
                    blocks: [
                        { id: 'p1', type: 'portfolioItem', order: 0, settings: { title: 'FinTech Dashboard', category: 'Web App', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600' }, isVisible: true },
                        { id: 'p2', type: 'portfolioItem', order: 1, settings: { title: 'AI Chat Platform', category: 'SaaS', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600' }, isVisible: true },
                        { id: 'p3', type: 'portfolioItem', order: 2, settings: { title: 'E-commerce Engine', category: 'Platform', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600' }, isVisible: true },
                        { id: 'p4', type: 'portfolioItem', order: 3, settings: { title: 'Mobile Banking', category: 'iOS/Android', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600' }, isVisible: true },
                    ]
                },
                {
                    id: 'services-1', type: 'servicesGrid', isVisible: true, order: 2,
                    settings: { title: 'What We Do', subtitle: 'End-to-end digital solutions' },
                    blocks: [
                        { id: 's1', type: 'serviceCard', order: 0, settings: { title: 'Web Development', description: 'Scalable web apps with React, Next.js, and Node.', icon: '🚀' }, isVisible: true },
                        { id: 's2', type: 'serviceCard', order: 1, settings: { title: 'Mobile Apps', description: 'Cross-platform apps with Flutter and React Native.', icon: '📱' }, isVisible: true },
                        { id: 's3', type: 'serviceCard', order: 2, settings: { title: 'Cloud & DevOps', description: 'AWS, GCP, and CI/CD pipeline setup.', icon: '☁️' }, isVisible: true },
                    ]
                },
                {
                    id: 'contact-1', type: 'contactForm', isVisible: true, order: 3,
                    settings: { title: "Let's Talk", subtitle: 'Ready to build something amazing?', email: 'hello@devstudio.com' }
                }
            ]
        }
    }
};
