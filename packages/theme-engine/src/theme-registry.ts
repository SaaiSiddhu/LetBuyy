/**
 * Canonical theme schema registry.
 *
 * This package is the cross-surface contract source for editable theme sections
 * until the JSON Schema/Dart generation step consumes the worker registry.
 * Admin Web re-exports these contracts, the worker validates against them, and
 * Flutter receives the same schema through the worker API.
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

export interface StorefrontThemeBlockConfig {
    id: string
    type: string
    order: number
    visible: boolean
    settings: Record<string, unknown>
}

export interface StorefrontThemeSectionConfig {
    id: string
    type: string
    order: number
    visible: boolean
    settings: Record<string, unknown>
    blocks?: StorefrontThemeBlockConfig[]
}

export interface StorefrontThemeTemplateConfig {
    themeId: string
    themeSettings: Record<string, unknown>
    sections: {
        header: StorefrontThemeSectionConfig
        footer: StorefrontThemeSectionConfig
        template: StorefrontThemeSectionConfig[]
    }
}

// ---------- Section Schemas ----------

const heroBanner: SectionSchema = {
    name: 'Hero Banner',
    type: 'heroBanner',
    description: 'Full-screen hero section with cinematic overlay and centered text',
    defaults: {
        heading: 'New Collection',
        subheading: 'Introduce your latest products, story, or offer.',
        ctaText: 'Shop Now',
        ctaLink: '#products',
        image: '',
        overlay: 0.4,
        height: 'full',
        textAlign: 'center',
    },
    presets: [
        { name: 'Centered Hero', settings: { heading: 'New Collection', subheading: 'Introduce your latest products, story, or offer.', ctaText: 'Shop Now', overlay: 0.4, height: 'full', textAlign: 'center' } },
        { name: 'Left-Aligned Hero', settings: { heading: 'New Season', subheading: 'Explore the latest products from your catalog.', ctaText: 'Browse Collection', overlay: 0.5, height: 'large', textAlign: 'left' } },
        { name: 'Minimal Hero', settings: { heading: 'Featured Offer', subheading: 'Highlight a focused campaign or launch.', ctaText: 'Learn More', overlay: 0.6, height: 'medium', textAlign: 'center' } },
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
    defaults: { title: 'Featured Products', subtitle: 'Products selected from your catalog', columns: 4, columnsTablet: 3, columnsMobile: 2, rows: 2, showTitle: true, showPrice: true, showRating: true, showAddToCart: true, cardStyle: 'minimal', sortBy: 'newest' },
    presets: [
        { name: '4-Column Grid', settings: { title: 'Featured Products', subtitle: 'Products selected from your catalog', columns: 4, showPrice: true, showRating: true, showAddToCart: true, cardStyle: 'minimal' } },
        { name: '3-Column Featured', settings: { title: 'Featured Collection', subtitle: 'Hand-picked for you', columns: 3, showPrice: true, showRating: false, showAddToCart: true, cardStyle: 'detailed' } },
        { name: '2-Column Showcase', settings: { title: 'New Arrivals', subtitle: 'Just dropped', columns: 2, showPrice: true, showRating: true, showAddToCart: false, cardStyle: 'standard' } },
    ],
    settings_schema: {
        title: { type: 'text', label: 'Section Title', maxLength: 80 },
        subtitle: { type: 'text', label: 'Subtitle', maxLength: 120 },
        columns: { type: 'range', label: 'Columns', min: 2, max: 4, step: 1 },
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
    defaults: { title: 'Featured brands', speed: 25, pauseOnHover: true, brands: [] },
    presets: [
        { name: 'Default', settings: { title: 'Featured brands', speed: 25, pauseOnHover: true } },
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
    defaults: { title: 'What Customers Say', subtitle: 'Customer stories and reviews', layout: 'carousel', autoplay: true, showRating: true, showImage: false },
    presets: [
        { name: 'Carousel', settings: { title: 'What Our Customers Say', layout: 'carousel', autoplay: true, showRating: true } },
        { name: 'Grid', settings: { title: 'Customer Reviews', layout: 'grid', autoplay: false, showRating: true } },
    ],
    sample_blocks: [
        { type: 'testimonialCard', settings: { name: 'Customer', text: 'Add a real customer quote from your store.', rating: 5 } },
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
    defaults: { behavior: 'sticky', storeName: '', logoPlacement: 'left', logoUrl: '', displayMode: 'name', navPlacement: 'right', showSearch: true, showCart: true, showAccount: false },
    settings_schema: {
        behavior: { type: 'select', label: 'Header Behavior', options: ['sticky', 'scroll', 'hide-on-scroll'] },
        storeName: { type: 'text', label: 'Store Name', maxLength: 80 },
        logoUrl: { type: 'image', label: 'Logo' },
        logoPlacement: { type: 'select', label: 'Logo Position', options: ['left', 'center'] },
        displayMode: { type: 'select', label: 'Display Mode', options: ['logo', 'name', 'both'] },
        navPlacement: { type: 'select', label: 'Navigation Position', options: ['left', 'right'] },
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
    defaults: { columns: 3, showLogo: true, showNewsletter: true, showSocial: true, showPaymentIcons: true, copyrightText: '', instagramUrl: '', twitterUrl: '', contactEmail: '' },
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
    sample_blocks: [
        { type: 'footerLink', settings: { label: 'Shop', href: '/shop', openInNewTab: false } },
        { type: 'footerLink', settings: { label: 'Shipping', href: '/shipping', openInNewTab: false } },
    ],
    blocks_schema: {
        footerLink: {
            name: 'Footer Link',
            fields: {
                label: { type: 'text', label: 'Label', maxLength: 40 },
                href: { type: 'text', label: 'URL' },
                openInNewTab: { type: 'toggle', label: 'Open in new tab' },
            },
        },
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
                enableAnimations: { type: 'toggle', label: 'Enable Animations', default: true, description: 'Smooth hover effects and scroll-reveal animations' },
                enableShadows: { type: 'toggle', label: 'Enable Shadows', default: true, description: 'Subtle shadows on cards and buttons' },
            },
        },
        header: {
            label: 'Header',
            description: 'Customize the store header',
            fields: {
                behavior: { type: 'select', label: 'Header Behavior', default: 'sticky', options: ['sticky', 'scroll', 'hide-on-scroll'] },
                logoPlacement: { type: 'select', label: 'Logo Position', default: 'left', options: ['left', 'center'] },
                displayMode: { type: 'select', label: 'Display Mode', default: 'name', options: ['logo', 'name', 'both'] },
                showSearch: { type: 'toggle', label: 'Show Search', default: true },
                showCart: { type: 'toggle', label: 'Show Cart', default: true },
            },
        },
        footer: {
            label: 'Footer',
            description: 'Customize the store footer',
            fields: {
                columns: { type: 'range', label: 'Footer Columns', default: 3, min: 2, max: 4, step: 1 },
                showNewsletter: { type: 'toggle', label: 'Show Newsletter Signup', default: true },
                showSocial: { type: 'toggle', label: 'Show Social Links', default: true },
                showPaymentIcons: { type: 'toggle', label: 'Show Payment Icons', default: true },
            },
        },
    },
}

/**
 * Get section schemas for a given theme package.
 *
 * The runtime schema registry is database-backed; this static export is kept as
 * the shared fallback contract for older clients and migrations.
 */
export function getSectionSchemas(_themeId: string): Record<string, SectionSchema> {
    return SECTION_SCHEMAS
}

/**
 * Get global theme settings schema for a given theme package.
 */
export function getThemeSettingsSchema(_themeId: string): ThemeSettingsSchema {
    return THEME_SETTINGS_SCHEMA
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback
}

function sectionIsRenderable(value: unknown): boolean {
    const section = asRecord(value)
    return typeof section.type === 'string'
        && section.type.length > 0
        && section.visible !== false
        && section.isVisible !== false
}

function sectionArrayHasRenderableSections(value: unknown): boolean {
    return Array.isArray(value) && value.some(sectionIsRenderable)
}

/**
 * Detect whether a stored theme config contains real storefront sections.
 * Metadata-only records such as `{ themeId, templateId, survey }` must fall
 * back to the package default template instead of rendering a blank store.
 */
export function hasRenderableThemeTemplate(value: unknown): boolean {
    const templateConfig = asRecord(value)
    const sections = templateConfig.sections

    if (sectionArrayHasRenderableSections(sections)) return true

    const sectionSlots = asRecord(sections)
    if (sectionIsRenderable(sectionSlots.header) || sectionIsRenderable(sectionSlots.footer)) {
        return true
    }
    if (sectionArrayHasRenderableSections(sectionSlots.template)) return true

    const templates = asRecord(templateConfig.templates)
    for (const template of Object.values(templates)) {
        if (sectionArrayHasRenderableSections(asRecord(template).sections)) {
            return true
        }
    }

    const sectionGroups = asRecord(templateConfig.sectionGroups)
    for (const group of Object.values(sectionGroups)) {
        if (sectionArrayHasRenderableSections(asRecord(group).sections) || sectionArrayHasRenderableSections(group)) {
            return true
        }
    }

    return false
}

/**
 * Default production storefront template used when a store has selected a theme
 * but has not yet published a release-backed template snapshot.
 */
export function getDefaultStorefrontThemeTemplate(
    themeId = 'urban-kicks',
    themeConfig: Record<string, unknown> = {},
): StorefrontThemeTemplateConfig {
    const colors = asRecord(themeConfig.colors)
    const fonts = asRecord(themeConfig.fonts)

    const primaryColor = asString(colors.primary, '#8B5CF6')
    const secondaryColor = asString(colors.secondary, '#3B82F6')
    const accentColor = asString(colors.accent, '#F59E0B')
    const backgroundColor = asString(colors.background, '#FFFFFF')
    const textColor = asString(colors.text, '#1F2937')

    return {
        themeId,
        themeSettings: {
            primaryColor,
            secondaryColor,
            accentColor,
            backgroundColor,
            textColor,
            fontFamily: asString(fonts.body, 'Inter'),
            headingFontFamily: asString(fonts.heading, 'Inter'),
            borderRadius: 12,
            enableAnimations: true,
            enableShadows: true,
        },
        sections: {
            header: {
                id: 'header',
                type: 'header',
                order: 0,
                visible: true,
                settings: {
                    ...header.defaults,
                    displayMode: 'name',
                    showSearch: true,
                    showCart: true,
                    showAccount: true,
                },
            },
            footer: {
                id: 'footer',
                type: 'footer',
                order: 100,
                visible: true,
                settings: {
                    ...footer.defaults,
                    contactEmail: 'help@letbuyy.com',
                },
            },
            template: [
                {
                    id: 'hero-default',
                    type: 'heroBanner',
                    order: 10,
                    visible: true,
                    settings: {
                        ...heroBanner.defaults,
                        heading: 'New Season Essentials',
                        subheading: 'Fresh drops, everyday staples, and limited pieces curated for your store.',
                        ctaText: 'Shop Now',
                        ctaLink: '#products',
                        height: 'large',
                        textAlign: 'left',
                    },
                },
                {
                    id: 'trust-badges-default',
                    type: 'trustBadges',
                    order: 20,
                    visible: true,
                    settings: {
                        ...trustBadges.defaults,
                    },
                },
                {
                    id: 'product-grid-default',
                    type: 'productGrid',
                    order: 30,
                    visible: true,
                    settings: {
                        ...productGrid.defaults,
                        title: 'Featured Products',
                        subtitle: 'Products selected from your catalog',
                        columns: 4,
                        rows: 2,
                    },
                },
                {
                    id: 'brand-marquee-default',
                    type: 'brandMarquee',
                    order: 40,
                    visible: true,
                    settings: {
                        ...brandMarquee.defaults,
                        brands: ['LetBuyy', 'New Drops', 'Streetwear', 'Essentials', 'Limited Run'],
                    },
                },
                {
                    id: 'category-grid-default',
                    type: 'categoryGrid',
                    order: 50,
                    visible: true,
                    settings: {
                        ...categoryGridSchema.defaults,
                    },
                    blocks: [
                        {
                            id: 'category-sneakers',
                            type: 'category',
                            order: 0,
                            visible: true,
                            settings: {
                                name: 'Sneakers',
                                slug: 'sneakers',
                                tagline: 'Fresh pairs',
                            },
                        },
                        {
                            id: 'category-apparel',
                            type: 'category',
                            order: 1,
                            visible: true,
                            settings: {
                                name: 'Apparel',
                                slug: 'apparel',
                                tagline: 'Daily fits',
                            },
                        },
                        {
                            id: 'category-accessories',
                            type: 'category',
                            order: 2,
                            visible: true,
                            settings: {
                                name: 'Accessories',
                                slug: 'accessories',
                                tagline: 'Finish the look',
                            },
                        },
                    ],
                },
                {
                    id: 'newsletter-default',
                    type: 'newsletter',
                    order: 60,
                    visible: true,
                    settings: {
                        ...newsletter.defaults,
                    },
                },
            ],
        },
    }
}
