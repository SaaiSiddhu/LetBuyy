'use client'

import type { SectionEntry } from '@/hooks/useEditorHistory'

interface CenterPanelProps {
    viewport: 'desktop' | 'tablet' | 'mobile'
    headerSection: SectionEntry
    footerSection: SectionEntry
    templateSections: SectionEntry[]
    selectedSectionId: string | null
    onSelectSection: (id: string) => void
}

const VIEWPORT_WIDTHS: Record<string, number> = {
    desktop: 1280,
    tablet: 768,
    mobile: 390,
}

export default function CenterPanel({
    viewport,
    headerSection,
    footerSection,
    templateSections,
    selectedSectionId,
    onSelectSection,
}: CenterPanelProps) {
    const allSections = [
        headerSection,
        ...templateSections.filter(s => s.visible),
        footerSection,
    ]

    return (
        <div className="te-center-panel">
            {/* Viewport frame */}
            <div
                className="te-preview-frame"
                style={{ maxWidth: VIEWPORT_WIDTHS[viewport] }}
            >
                <div className="te-preview-browser-bar">
                    <div className="te-preview-dots">
                        <span className="te-preview-dot te-preview-dot--red" />
                        <span className="te-preview-dot te-preview-dot--yellow" />
                        <span className="te-preview-dot te-preview-dot--green" />
                    </div>
                    <div className="te-preview-url-bar">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
                        <span className="te-preview-url">your-store.letbuyy.store</span>
                    </div>
                </div>

                {/* Preview body */}
                <div className="te-preview-body">
                    {allSections.map((section) => (
                        <div
                            key={section.id}
                            className={`te-preview-section ${selectedSectionId === section.id ? 'te-preview-section--selected' : ''}`}
                            onClick={() => onSelectSection(section.id)}
                        >
                            <SectionPreview section={section} />
                            <div className="te-preview-section-overlay">
                                <span className="te-preview-section-label">
                                    {section.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// --- Section Preview Placeholders ---
// These are simplified visual representations. In a full implementation,
// we'd import the actual storefront components and render them here.

function SectionPreview({ section }: { section: SectionEntry }) {
    switch (section.type) {
        case 'header':
            return <HeaderPreview settings={section.settings} />
        case 'heroBanner':
            return <HeroBannerPreview settings={section.settings} />
        case 'productGrid':
            return <ProductGridPreview settings={section.settings} />
        case 'categoryGrid':
            return <CategoryGridPreview settings={section.settings} />
        case 'brandMarquee':
            return <BrandMarqueePreview settings={section.settings} />
        case 'testimonials':
            return <TestimonialsPreview settings={section.settings} />
        case 'trustBadges':
            return <TrustBadgesPreview settings={section.settings} />
        case 'newsletter':
            return <NewsletterPreview settings={section.settings} />
        case 'footer':
            return <FooterPreview settings={section.settings} />
        default:
            return <GenericPreview type={section.type} />
    }
}

// ========== Section Preview Components ==========

function HeaderPreview({ settings }: { settings: Record<string, unknown> }) {
    return (
        <div className="te-sp te-sp-header">
            <div className="te-sp-header-logo">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>storefront</span>
                <span className="te-sp-header-name">Urban Kicks</span>
            </div>
            <nav className="te-sp-header-nav">
                <span>Home</span>
                <span>Shop</span>
                <span>New Arrivals</span>
            </nav>
            <div className="te-sp-header-icons">
                {settings.showSearch !== false && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>}
                {settings.showCart !== false && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_bag</span>}
            </div>
        </div>
    )
}

function HeroBannerPreview({ settings }: { settings: Record<string, unknown> }) {
    const bgImage = String(settings.image || '')
    const overlay = Number(settings.overlay ?? 0.4)
    const textAlign = String(settings.textAlign || 'center') as 'left' | 'center' | 'right'

    return (
        <div
            className="te-sp te-sp-hero"
            style={{
                backgroundImage: bgImage ? `url(${bgImage})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                textAlign,
            }}
        >
            <div className="te-sp-hero-overlay" style={{ opacity: overlay }} />
            <div className="te-sp-hero-content">
                <h1 className="te-sp-hero-heading">{String(settings.heading || 'Hero Heading')}</h1>
                <p className="te-sp-hero-sub">{String(settings.subheading || 'Subheading text')}</p>
                <button className="te-sp-hero-cta">{String(settings.ctaText || 'Shop Now')}</button>
            </div>
        </div>
    )
}

function ProductGridPreview({ settings }: { settings: Record<string, unknown> }) {
    const cols = Number(settings.columns ?? 4)
    return (
        <div className="te-sp te-sp-grid-section">
            <h2 className="te-sp-section-title">{String(settings.title || 'Products')}</h2>
            <p className="te-sp-section-sub">{String(settings.subtitle || '')}</p>
            <div className="te-sp-product-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: cols * 2 }).map((_, i) => (
                    <div key={i} className="te-sp-product-card">
                        <div className="te-sp-product-img" />
                        <div className="te-sp-product-info">
                            <span className="te-sp-product-name">Product {i + 1}</span>
                            {settings.showPrice !== false && <span className="te-sp-product-price">₹2,499</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function CategoryGridPreview({ settings }: { settings: Record<string, unknown> }) {
    const cols = Number(settings.columns ?? 3)
    const categories = ['Sneakers', 'Streetwear', 'Accessories']
    return (
        <div className="te-sp te-sp-grid-section">
            <h2 className="te-sp-section-title">{String(settings.title || 'Categories')}</h2>
            <div className="te-sp-category-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {categories.slice(0, cols).map((cat) => (
                    <div key={cat} className="te-sp-category-card">
                        <div className="te-sp-category-img" />
                        <span className="te-sp-category-name">{cat}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function BrandMarqueePreview({ settings }: { settings: Record<string, unknown> }) {
    return (
        <div className="te-sp te-sp-marquee">
            <p className="te-sp-marquee-title">{String(settings.title || 'Trusted by top brands')}</p>
            <div className="te-sp-marquee-strip">
                {['NIKE', 'ADIDAS', 'PUMA', 'JORDAN', 'NEW BALANCE'].map((b) => (
                    <span key={b} className="te-sp-marquee-brand">{b}</span>
                ))}
            </div>
        </div>
    )
}

function TestimonialsPreview({ settings }: { settings: Record<string, unknown> }) {
    return (
        <div className="te-sp te-sp-testimonials">
            <h2 className="te-sp-section-title">{String(settings.title || 'Testimonials')}</h2>
            <div className="te-sp-testimonial-cards">
                {['Priya S.', 'Rahul K.', 'Ananya M.'].map((name) => (
                    <div key={name} className="te-sp-testimonial-card">
                        <div className="te-sp-testimonial-stars">★★★★★</div>
                        <p className="te-sp-testimonial-text">&ldquo;Amazing quality and fast delivery!&rdquo;</p>
                        <span className="te-sp-testimonial-author">{name}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function TrustBadgesPreview({ settings: _settings }: { settings: Record<string, unknown> }) {
    const badges = [
        { icon: 'local_shipping', label: 'Free Shipping' },
        { icon: 'verified_user', label: '100% Authentic' },
        { icon: 'replay', label: 'Easy Returns' },
        { icon: 'headset_mic', label: '24/7 Support' },
    ]
    return (
        <div className="te-sp te-sp-trust">
            <div className="te-sp-trust-row">
                {badges.map((b) => (
                    <div key={b.label} className="te-sp-trust-badge">
                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{b.icon}</span>
                        <span>{b.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function NewsletterPreview({ settings }: { settings: Record<string, unknown> }) {
    return (
        <div className="te-sp te-sp-newsletter">
            <h2 className="te-sp-section-title">{String(settings.title || 'Newsletter')}</h2>
            <p className="te-sp-section-sub">{String(settings.subtitle || 'Get the latest updates')}</p>
            <div className="te-sp-newsletter-form">
                <div className="te-sp-newsletter-input">{String(settings.placeholder || 'Enter your email')}</div>
                <div className="te-sp-newsletter-btn">{String(settings.buttonText || 'Subscribe')}</div>
            </div>
        </div>
    )
}

function FooterPreview({ settings }: { settings: Record<string, unknown> }) {
    return (
        <div className="te-sp te-sp-footer">
            <div className="te-sp-footer-cols">
                <div className="te-sp-footer-col">
                    <strong>Urban Kicks</strong>
                    <span>Premium streetwear</span>
                </div>
                <div className="te-sp-footer-col">
                    <strong>Quick Links</strong>
                    <span>Shop</span>
                    <span>About</span>
                </div>
                <div className="te-sp-footer-col">
                    <strong>Contact</strong>
                    <span>{String(settings.contactEmail || 'hello@store.com')}</span>
                </div>
            </div>
            <div className="te-sp-footer-bottom">
                <span>{String(settings.copyrightText || '© 2026 Urban Kicks')}</span>
            </div>
        </div>
    )
}

function GenericPreview({ type }: { type: string }) {
    return (
        <div className="te-sp te-sp-generic">
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#999' }}>widgets</span>
            <span>{type}</span>
        </div>
    )
}
