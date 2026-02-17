/**
 * Theme Schema Registry
 *
 * Hard-coded section schemas and global theme settings schemas
 * sourced from the Urban Kicks theme's JSON files.
 * This avoids filesystem reads at runtime.
 */

// ---------- Types ----------

export interface SchemaField {
    type: 'text' | 'textarea' | 'richtext' | 'color' | 'image' | 'select' | 'toggle' | 'range' | 'number' | 'url' | 'radio'
    label: string
    default?: unknown
    maxLength?: number
    options?: string[]
    min?: number
    max?: number
    step?: number
    unit?: string
    info?: string
    description?: string
}

export interface BlockSchema {
    name: string
    fields: Record<string, SchemaField>
}

export interface SectionSchema {
    name: string
    type: string
    description: string
    defaults: Record<string, unknown>
    presets?: Array<{ name: string; settings: Record<string, unknown> }>
    settings_schema: Record<string, SchemaField>
    blocks_schema?: Record<string, BlockSchema>
    sample_blocks?: Array<{ type: string; settings: Record<string, unknown> }>
}

export interface ThemeSettingsGroup {
    label: string
    description: string
    fields: Record<string, SchemaField>
}

export interface ThemeSettingsSchema {
    schema_version: string
    settings: Record<string, ThemeSettingsGroup>
}

// ---------- Section Schemas ----------

const heroBanner: SectionSchema = {
    name: 'Hero Banner',
    type: 'heroBanner',
    description: 'Full-screen hero section with cinematic overlay and centered text',
    defaults: {
        heading: 'Streetwear 2026',
        subheading: 'The future of fashion is here.',
        ctaText: 'Shop New Arrivals',
        ctaLink: '#products',
        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2000',
        overlay: 0.4,
        height: 'full',
        textAlign: 'center',
    },
    presets: [
        { name: 'Centered Hero', settings: { heading: 'Streetwear 2026', subheading: 'The future of fashion is here.', ctaText: 'Shop New Arrivals', overlay: 0.4, height: 'full', textAlign: 'center' } },
        { name: 'Left-Aligned Hero', settings: { heading: 'New Season', subheading: 'Explore the latest drops from top brands.', ctaText: 'Browse Collection', overlay: 0.5, height: 'large', textAlign: 'left' } },
        { name: 'Minimal Hero', settings: { heading: 'URBAN KICKS', subheading: 'Premium streetwear delivered to your door.', ctaText: 'Shop Now', overlay: 0.6, height: 'medium', textAlign: 'center' } },
    ],
    settings_schema: {
        heading: { type: 'text', label: 'Heading', maxLength: 100 },
        subheading: { type: 'text', label: 'Subheading', maxLength: 200 },
        ctaText: { type: 'text', label: 'Button Text', maxLength: 40 },
        ctaLink: { type: 'url', label: 'Button Link' },
        image: { type: 'image', label: 'Background Image' },
        overlay: { type: 'range', label: 'Overlay Opacity', min: 0, max: 1, step: 0.1 },
        height: { type: 'select', label: 'Height', options: ['full', 'large', 'medium', 'small'] },
        textAlign: { type: 'select', label: 'Text Alignment', options: ['left', 'center', 'right'] },
    },
}

const productGrid: SectionSchema = {
    name: 'Product Grid',
    type: 'productGrid',
    description: 'Responsive product grid with hover animations and quick-add-to-cart',
    defaults: { title: 'Trending Drops', subtitle: 'Hottest picks this season', columns: 4, columnsTablet: 3, columnsMobile: 2, rows: 2, showTitle: true, showPrice: true, showRating: true, showAddToCart: true, cardStyle: 'minimal', sortBy: 'newest' },
    presets: [
        { name: '4-Column Grid', settings: { title: 'Trending Drops', subtitle: 'Hottest picks this season', columns: 4, showPrice: true, showRating: true, showAddToCart: true, cardStyle: 'minimal' } },
        { name: '3-Column Featured', settings: { title: 'Featured Collection', subtitle: 'Hand-picked for you', columns: 3, showPrice: true, showRating: false, showAddToCart: true, cardStyle: 'detailed' } },
        { name: '2-Column Showcase', settings: { title: 'New Arrivals', subtitle: 'Just dropped', columns: 2, showPrice: true, showRating: true, showAddToCart: false, cardStyle: 'standard' } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Section Title', maxLength: 80 },
        subtitle: { type: 'text', label: 'Subtitle', maxLength: 120 },
        columns: { type: 'range', label: 'Columns', min: 2, max: 5, step: 1 },
        rows: { type: 'range', label: 'Rows', min: 1, max: 4, step: 1 },
        showPrice: { type: 'toggle', label: 'Show Price' },
        showRating: { type: 'toggle', label: 'Show Rating' },
        showAddToCart: { type: 'toggle', label: 'Show Add to Cart' },
        cardStyle: { type: 'select', label: 'Card Style', options: ['standard', 'minimal', 'detailed'] },
        sortBy: { type: 'select', label: 'Sort By', options: ['newest', 'price_low', 'price_high', 'popular'] },
    },
}

const categoryGridSchema: SectionSchema = {
    name: 'Category Grid',
    type: 'categoryGrid',
    description: 'Visual category cards linking to filtered shop views',
    defaults: { title: 'Shop by Category', subtitle: 'Find exactly what you\'re looking for', columns: 3, cardStyle: 'overlay' },
    presets: [
        { name: '3-Column Overlay', settings: { title: 'Shop by Category', columns: 3, cardStyle: 'overlay' } },
        { name: '4-Column Minimal', settings: { title: 'Categories', columns: 4, cardStyle: 'minimal' } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Heading', maxLength: 60 },
        subtitle: { type: 'text', label: 'Subheading', maxLength: 120 },
        columns: { type: 'range', label: 'Columns', min: 2, max: 4, step: 1 },
        cardStyle: { type: 'select', label: 'Card Style', options: ['overlay', 'minimal', 'bordered'] },
    },
    blocks_schema: {
        category: { name: 'Category Card', fields: { name: { type: 'text', label: 'Name', maxLength: 30 }, slug: { type: 'text', label: 'Slug' }, image: { type: 'image', label: 'Image' }, tagline: { type: 'text', label: 'Tagline', maxLength: 50 } } },
    },
}

const brandMarquee: SectionSchema = {
    name: 'Brand Marquee',
    type: 'brandMarquee',
    description: 'Auto-scrolling horizontal brand logo strip',
    defaults: { title: 'Trusted by top brands worldwide', speed: 25, pauseOnHover: true, brands: ['NIKE', 'ADIDAS', 'PUMA', 'JORDAN', 'NEW BALANCE', 'CONVERSE', 'REEBOK', 'VANS', 'ASICS', 'UNDER ARMOUR'] },
    presets: [
        { name: 'Default Dark', settings: { title: 'Trusted by top brands worldwide', speed: 25, pauseOnHover: true } },
        { name: 'Fast Scroll', settings: { title: 'Our Partners', speed: 15, pauseOnHover: false } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Heading', maxLength: 60 },
        speed: { type: 'range', label: 'Scroll Speed (seconds)', min: 10, max: 60, step: 5 },
        pauseOnHover: { type: 'toggle', label: 'Pause on Hover' },
    },
    blocks_schema: {
        brand: { name: 'Brand', fields: { name: { type: 'text', label: 'Brand Name', maxLength: 30 }, logo: { type: 'image', label: 'Logo (optional)' } } },
    },
}

const testimonials: SectionSchema = {
    name: 'Testimonials',
    type: 'testimonials',
    description: 'Customer testimonial carousel with star ratings',
    defaults: { title: 'What Our Customers Say', subtitle: 'Real reviews from real sneakerheads', layout: 'carousel', autoplay: true, showRating: true, showImage: false },
    presets: [
        { name: 'Carousel', settings: { title: 'What Our Customers Say', layout: 'carousel', autoplay: true, showRating: true } },
        { name: 'Grid', settings: { title: 'Customer Reviews', layout: 'grid', autoplay: false, showRating: true } },
    ],
    sample_blocks: [
        { type: 'testimonialCard', settings: { name: 'Priya S.', text: 'Amazing quality! Best sneakers I\'ve ever owned.', rating: 5 } },
        { type: 'testimonialCard', settings: { name: 'Rahul K.', text: 'Fast delivery and excellent packaging.', rating: 5 } },
        { type: 'testimonialCard', settings: { name: 'Ananya M.', text: 'Love the designs! The streetwear collection is fire.', rating: 4 } },
        { type: 'testimonialCard', settings: { name: 'Vikram D.', text: 'Finally a store that gets streetwear culture.', rating: 5 } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Section Title', maxLength: 80 },
        subtitle: { type: 'text', label: 'Subtitle', maxLength: 120 },
        layout: { type: 'select', label: 'Layout', options: ['carousel', 'grid', 'masonry'] },
        autoplay: { type: 'toggle', label: 'Autoplay Carousel' },
        showRating: { type: 'toggle', label: 'Show Star Ratings' },
        showImage: { type: 'toggle', label: 'Show Customer Photos' },
    },
}

const trustBadges: SectionSchema = {
    name: 'Trust Badges',
    type: 'trustBadges',
    description: 'Horizontal row of trust/feature badges with icons',
    defaults: {
        title: '',
        badges: [
            { icon: 'truck', label: 'Free Shipping', description: 'On orders above ₹999' },
            { icon: 'shield-check', label: '100% Authentic', description: 'Guaranteed genuine products' },
            { icon: 'rotate-ccw', label: 'Easy Returns', description: '7-day hassle-free returns' },
            { icon: 'headphones', label: '24/7 Support', description: 'We\'re here to help' },
        ],
    },
    settings_schema: {
        title: { type: 'text', label: 'Section Heading (optional)', maxLength: 60 },
    },
    blocks_schema: {
        badge: {
            name: 'Badge',
            fields: {
                icon: { type: 'select', label: 'Icon', options: ['truck', 'shield-check', 'rotate-ccw', 'headphones', 'award', 'star', 'heart', 'zap', 'lock', 'clock', 'globe', 'check-circle', 'package', 'credit-card'] },
                label: { type: 'text', label: 'Label', maxLength: 30 },
                description: { type: 'text', label: 'Description', maxLength: 60 },
            },
        },
    },
}

const newsletter: SectionSchema = {
    name: 'Newsletter',
    type: 'newsletter',
    description: 'Email signup section with heading, subtext, and subscribe button',
    defaults: { title: 'Stay in the Loop', subtitle: 'Get early access to new drops and exclusive discounts.', buttonText: 'Subscribe', placeholder: 'Enter your email', backgroundColor: 'transparent', successMessage: 'Thanks for subscribing!' },
    presets: [
        { name: 'Default', settings: { title: 'Stay in the Loop', subtitle: 'Get early access to new drops and exclusive discounts.', buttonText: 'Subscribe', placeholder: 'Enter your email' } },
        { name: 'Minimal', settings: { title: 'Join the Club', subtitle: 'No spam, just drops.', buttonText: 'Sign Up', placeholder: 'Your email' } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Heading', maxLength: 80 },
        subtitle: { type: 'text', label: 'Subheading', maxLength: 200 },
        buttonText: { type: 'text', label: 'Button Text', maxLength: 30 },
        placeholder: { type: 'text', label: 'Placeholder Text', maxLength: 40 },
        backgroundColor: { type: 'color', label: 'Background Color' },
        successMessage: { type: 'text', label: 'Success Message', maxLength: 100 },
    },
}

const header: SectionSchema = {
    name: 'Header',
    type: 'header',
    description: 'Sticky site header with logo, navigation, search, and cart icons',
    defaults: { behavior: 'sticky', logoPlacement: 'left', displayMode: 'name', navPlacement: 'right', showSearch: true, showCart: true, showAccount: false },
    settings_schema: {
        behavior: { type: 'select', label: 'Header Behavior', options: ['sticky', 'scroll', 'hide-on-scroll'] },
        logoPlacement: { type: 'select', label: 'Logo Position', options: ['left', 'center'] },
        displayMode: { type: 'select', label: 'Display Mode', options: ['logo', 'name', 'both'] },
        showSearch: { type: 'toggle', label: 'Show Search Icon' },
        showCart: { type: 'toggle', label: 'Show Cart Icon' },
        showAccount: { type: 'toggle', label: 'Show Account Icon' },
    },
    blocks_schema: {
        navPage: { name: 'Navigation Link', fields: { label: { type: 'text', label: 'Label', maxLength: 30 }, href: { type: 'url', label: 'URL' }, isVisible: { type: 'toggle', label: 'Visible' } } },
    },
}

const footer: SectionSchema = {
    name: 'Footer',
    type: 'footer',
    description: 'Store footer with columns, social links, and payment icons',
    defaults: { columns: 3, showLogo: true, showNewsletter: true, showSocial: true, showPaymentIcons: true, copyrightText: '© 2026 Urban Kicks. All rights reserved.', instagramUrl: 'https://instagram.com/urbankicks', twitterUrl: 'https://twitter.com/urbankicks', contactEmail: 'hello@urban-kicks.store' },
    presets: [
        { name: 'Standard', settings: { columns: 3, showLogo: true, showNewsletter: true, showSocial: true, showPaymentIcons: true } },
        { name: 'Minimal', settings: { columns: 2, showLogo: true, showNewsletter: false, showSocial: true, showPaymentIcons: false } },
    ],
    settings_schema: {
        columns: { type: 'range', label: 'Columns', min: 2, max: 4, step: 1 },
        showLogo: { type: 'toggle', label: 'Show Logo' },
        showNewsletter: { type: 'toggle', label: 'Show Newsletter' },
        showSocial: { type: 'toggle', label: 'Show Social Links' },
        showPaymentIcons: { type: 'toggle', label: 'Show Payment Icons' },
        copyrightText: { type: 'text', label: 'Copyright Text', maxLength: 100 },
        instagramUrl: { type: 'url', label: 'Instagram URL' },
        twitterUrl: { type: 'url', label: 'Twitter/X URL' },
        contactEmail: { type: 'text', label: 'Contact Email' },
    },
}

// ---------- Registry ----------

export const SECTION_SCHEMAS: Record<string, SectionSchema> = {
    heroBanner,
    productGrid,
    categoryGrid: categoryGridSchema,
    brandMarquee,
    testimonials,
    trustBadges,
    newsletter,
    header,
    footer,
}

// ---------- Theme Settings Schema ----------

export const THEME_SETTINGS_SCHEMA: ThemeSettingsSchema = {
    schema_version: '1.0',
    settings: {
        colors: {
            label: 'Colors',
            description: 'Customize the color palette for your store',
            fields: {
                primaryColor: { type: 'color', label: 'Primary Color', default: '#000000', description: 'Main brand color used for buttons, links, and accents' },
                secondaryColor: { type: 'color', label: 'Secondary Color', default: '#FFFFFF', description: 'Secondary color for backgrounds and contrast elements' },
                accentColor: { type: 'color', label: 'Accent Color', default: '#E5E5E5', description: 'Accent color for badges, highlights, and decorative elements' },
                backgroundColor: { type: 'color', label: 'Background Color', default: '#FFFFFF', description: 'Main page background color' },
                textColor: { type: 'color', label: 'Text Color', default: '#1A1A2E', description: 'Primary text color' },
            },
        },
        typography: {
            label: 'Typography',
            description: 'Choose fonts for your store',
            fields: {
                fontFamily: { type: 'select', label: 'Body Font', default: 'Inter', options: ['Inter', 'Outfit', 'Poppins', 'DM Sans', 'Open Sans', 'Montserrat', 'Nunito', 'Space Grotesk'] },
                headingFontFamily: { type: 'select', label: 'Heading Font', default: 'Inter', options: ['Inter', 'Outfit', 'Poppins', 'Space Grotesk', 'Montserrat', 'DM Sans', 'Playfair Display'] },
            },
        },
        layout: {
            label: 'Layout',
            description: 'Customize the layout and spacing',
            fields: {
                borderRadius: { type: 'range', label: 'Border Radius', default: 12, min: 0, max: 24, step: 2, unit: 'px' },
                enableAnimations: { type: 'toggle', label: 'Enable Animations', default: true as unknown as undefined, description: 'Smooth hover effects and scroll-reveal animations' },
                enableShadows: { type: 'toggle', label: 'Enable Shadows', default: true as unknown as undefined, description: 'Subtle shadows on cards and buttons' },
            },
        },
        header: {
            label: 'Header',
            description: 'Customize the store header',
            fields: {
                behavior: { type: 'select', label: 'Header Behavior', default: 'sticky', options: ['sticky', 'scroll', 'hide-on-scroll'] },
                logoPlacement: { type: 'select', label: 'Logo Position', default: 'left', options: ['left', 'center'] },
                displayMode: { type: 'select', label: 'Display Mode', default: 'name', options: ['logo', 'name', 'both'] },
                showSearch: { type: 'toggle', label: 'Show Search', default: true as unknown as undefined },
                showCart: { type: 'toggle', label: 'Show Cart', default: true as unknown as undefined },
            },
        },
        footer: {
            label: 'Footer',
            description: 'Customize the store footer',
            fields: {
                columns: { type: 'range', label: 'Footer Columns', default: 3, min: 2, max: 4, step: 1 },
                showNewsletter: { type: 'toggle', label: 'Show Newsletter Signup', default: true as unknown as undefined },
                showSocial: { type: 'toggle', label: 'Show Social Links', default: true as unknown as undefined },
                showPaymentIcons: { type: 'toggle', label: 'Show Payment Icons', default: true as unknown as undefined },
            },
        },
    },
}

/**
 * Get section schemas for a given theme.
 * Currently only supports 'urban-kicks'.
 */
export function getSectionSchemas(themeId: string): Record<string, SectionSchema> {
    if (themeId === 'urban-kicks') {
        return SECTION_SCHEMAS
    }
    // Fallback: return all schemas (single theme for now)
    return SECTION_SCHEMAS
}

/**
 * Get global theme settings schema for a given theme.
 */
export function getThemeSettingsSchema(themeId: string): ThemeSettingsSchema {
    if (themeId === 'urban-kicks') {
        return THEME_SETTINGS_SCHEMA
    }
    return THEME_SETTINGS_SCHEMA
}
