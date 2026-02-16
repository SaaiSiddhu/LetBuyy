'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'

/* ——————————————————————————————————————
   Theme Data — Pre-installed + Free catalog
   —————————————————————————————————————— */

const CURRENT_THEME = {
    name: 'Urban Kicks',
    version: '1.0.0',
    addedAt: new Date().toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }),
    colors: ['#8B5CF6', '#3B82F6', '#F59E0B', '#EF4444'],
}

const FREE_THEMES = [
    {
        id: 'aurora',
        name: 'Aurora',
        author: 'LetBuyy',
        description: 'Modern, gradient-based with glassmorphism cards',
        color1: '#6366F1',
        color2: '#EC4899',
        style: 'Modern',
    },
    {
        id: 'zenith',
        name: 'Zenith',
        author: 'LetBuyy',
        description: 'Clean, professional with full-width imagery',
        color1: '#0F172A',
        color2: '#64748B',
        style: 'Minimal',
    },
    {
        id: 'ember',
        name: 'Ember',
        author: 'LetBuyy',
        description: 'Luxury dark theme with gold accents',
        color1: '#1C1917',
        color2: '#D97706',
        style: 'Luxury',
    },
    {
        id: 'blossom',
        name: 'Blossom',
        author: 'LetBuyy',
        description: 'Soft, organic with pastel palette',
        color1: '#FDF2F8',
        color2: '#F9A8D4',
        style: 'Organic',
    },
    {
        id: 'nova',
        name: 'Nova',
        author: 'LetBuyy',
        description: 'Vibrant, energetic with neon gradients',
        color1: '#7C3AED',
        color2: '#06B6D4',
        style: 'Vibrant',
    },
]

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function ThemesPage() {
    const params = useParams()
    const store = params.store as string
    const [importOpen, setImportOpen] = useState(false)
    const [versionOpen, setVersionOpen] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const importRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    const handleOutsideClick = () => {
        if (importOpen) setImportOpen(false)
        if (versionOpen) setVersionOpen(false)
    }

    return (
        <div className="online-store-page" onClick={handleOutsideClick}>
            {/* Page Header */}
            <div className="os-page-header">
                <h1 className="os-page-title">
                    <span className="material-symbols-outlined">storefront</span>
                    Online Store
                </h1>
            </div>

            {/* Themes Section Header */}
            <div className="os-section-header">
                <h2 className="os-section-title">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>palette</span>
                    Themes
                </h2>
                <div className="os-section-actions">
                    <a
                        href={`https://${store}.letbuyy.store`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="os-btn os-btn-outline"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                        View your store
                    </a>
                    <div className="os-dropdown-wrapper" ref={importRef}>
                        <button
                            className="os-btn os-btn-outline"
                            onClick={(e) => {
                                e.stopPropagation()
                                setImportOpen(!importOpen)
                            }}
                        >
                            Import theme
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
                        </button>
                        {importOpen && (
                            <div className="os-dropdown-menu">
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">store</span>
                                    Visit Theme Store
                                </button>
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">upload_file</span>
                                    Upload zip file
                                </button>
                                <button className="os-dropdown-item">
                                    <span className="material-symbols-outlined">link</span>
                                    Connect from GitHub
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Current Theme Preview Card */}
            <div className="theme-preview-card">
                {/* Desktop + Mobile Preview */}
                <div className="theme-preview-mockups">
                    {/* Desktop Preview */}
                    <div className="theme-mockup-desktop">
                        <div className="theme-mockup-browser-bar">
                            <div className="theme-mockup-dots">
                                <span /><span /><span />
                            </div>
                            <div className="theme-mockup-url">{store}.letbuyy.store</div>
                        </div>
                        <div className="theme-mockup-content">
                            <div className="theme-mockup-nav">
                                <span className="theme-mockup-storename">Urban Kicks</span>
                                <span>Home</span>
                                <span>Catalog</span>
                                <span>Contact</span>
                                <div className="theme-mockup-nav-icons">
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>search</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_bag</span>
                                </div>
                            </div>
                            <div className="theme-mockup-hero">
                                <div className="theme-mockup-hero-gradient" />
                                <div className="theme-mockup-hero-text">
                                    <p>Welcome to our store</p>
                                    <h3>Browse our latest products</h3>
                                    <button className="theme-mockup-cta">Shop all</button>
                                </div>
                            </div>
                            <div className="theme-mockup-products-label">Products</div>
                            <div className="theme-mockup-products">
                                <div className="theme-mockup-product" style={{ background: '#FEE2E2' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#DC2626' }}>steps</span></div>
                                <div className="theme-mockup-product" style={{ background: '#DBEAFE' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#2563EB' }}>deployed_code</span></div>
                                <div className="theme-mockup-product" style={{ background: '#D1FAE5' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#059669' }}>checkroom</span></div>
                                <div className="theme-mockup-product" style={{ background: '#FEF3C7' }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D97706' }}>shopping_bag</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Preview */}
                    <div className="theme-mockup-mobile">
                        <div className="theme-mockup-mobile-notch" />
                        <div className="theme-mockup-content theme-mockup-content-mobile">
                            <div className="theme-mockup-nav theme-mockup-nav-mobile">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>menu</span>
                                <span className="theme-mockup-storename">Urban Kicks</span>
                                <div className="theme-mockup-nav-icons">
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shopping_bag</span>
                                </div>
                            </div>
                            <div className="theme-mockup-hero theme-mockup-hero-mobile">
                                <div className="theme-mockup-hero-gradient" />
                                <div className="theme-mockup-hero-text">
                                    <h3 style={{ fontSize: '13px' }}>Browse our latest products</h3>
                                    <button className="theme-mockup-cta" style={{ fontSize: '10px', padding: '4px 10px' }}>Shop all</button>
                                </div>
                            </div>
                            <div className="theme-mockup-products-label" style={{ fontSize: '11px' }}>Products</div>
                            <div className="theme-mockup-products theme-mockup-products-mobile">
                                <div className="theme-mockup-product" style={{ background: '#FEE2E2' }}><span className="material-symbols-outlined" style={{ fontSize: 14, color: '#DC2626' }}>steps</span></div>
                                <div className="theme-mockup-product" style={{ background: '#DBEAFE' }}><span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563EB' }}>deployed_code</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Protection Banner */}
                <div className="theme-password-banner">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock</span>
                    <span>Password protected: to remove the password, pick a plan</span>
                    <div className="theme-password-actions">
                        <button className="os-btn-link">Edit password</button>
                        <button className="os-btn os-btn-outline os-btn-sm">Pick a plan</button>
                    </div>
                </div>

                {/* Current Theme Info */}
                <div className="theme-info-bar">
                    <div className="theme-info-left">
                        <div className="theme-info-colors">
                            {CURRENT_THEME.colors.map((color, i) => (
                                <span key={i} className="theme-info-dot" style={{ background: color }} />
                            ))}
                        </div>
                        <div className="theme-info-details">
                            <div className="theme-info-name-row">
                                <span className="theme-info-name">{CURRENT_THEME.name}</span>
                                <span className="theme-info-badge">Current theme</span>
                            </div>
                            <div className="theme-info-meta">
                                Added: Today at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            <div className="theme-info-version-wrapper">
                                <button
                                    className="theme-info-version"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setVersionOpen(!versionOpen)
                                    }}
                                >
                                    Version {CURRENT_THEME.version}
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>expand_more</span>
                                </button>
                                {versionOpen && (
                                    <div className="os-dropdown-menu os-dropdown-version">
                                        <div className="os-dropdown-version-content">
                                            <div className="os-dropdown-version-dot" />
                                            <div>
                                                <strong>You&apos;re up to date on the latest version</strong>
                                                <p>Your current version: Urban Kicks {CURRENT_THEME.version}</p>
                                            </div>
                                        </div>
                                        <button className="os-btn os-btn-outline os-btn-sm" style={{ marginTop: '8px' }}>View release notes</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="theme-info-right">
                        <button className="os-btn-icon">
                            <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                        <button className="os-btn os-btn-primary">Edit theme</button>
                    </div>
                </div>
            </div>

            {/* AI Section — Design your store */}
            <div className="theme-ai-section">
                <div className="theme-ai-title">
                    Design your store in seconds
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-color)' }}>auto_awesome</span>
                </div>
                <p className="theme-ai-desc">Describe your business to create unique themes with personalized content</p>
                <div className="theme-ai-input-row">
                    <input
                        type="text"
                        className="theme-ai-input"
                        placeholder="e.g. modern handmade jewelry"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <button className="os-btn os-btn-outline" disabled={!aiPrompt.trim()}>Generate themes</button>
                </div>
            </div>

            {/* Popular Free Themes */}
            <div className="theme-popular-section">
                <div className="theme-popular-header">
                    <div className="theme-popular-icon">
                        <span className="material-symbols-outlined">diamond</span>
                    </div>
                    <div>
                        <h3 className="theme-popular-title">Popular free themes</h3>
                        <p className="theme-popular-desc">Made with core features you can easily customize — no coding needed.</p>
                    </div>
                </div>

                <div className="theme-grid">
                    {FREE_THEMES.map((theme) => (
                        <div key={theme.id} className="theme-card">
                            <div className="theme-card-preview" style={{
                                background: `linear-gradient(135deg, ${theme.color1}, ${theme.color2})`,
                            }}>
                                <div className="theme-card-preview-mockup">
                                    <div className="theme-card-mockup-nav">
                                        <div className="theme-card-mockup-dots">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                    <div className="theme-card-mockup-hero">
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#fff' }}>{theme.style}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="theme-card-swatches">
                                <span className="theme-card-swatch" style={{ background: theme.color1 }} />
                                <span className="theme-card-swatch" style={{ background: theme.color2 }} />
                                <span className="theme-card-swatch" style={{ background: '#fff', border: '1px solid var(--border-primary)' }} />
                            </div>
                            <div className="theme-card-footer">
                                <div>
                                    <a href="#" className="theme-card-name">{theme.name}</a>
                                    <p className="theme-card-author">by {theme.author}</p>
                                </div>
                                <button className="os-btn os-btn-outline os-btn-sm">Add</button>
                            </div>
                        </div>
                    ))}

                    {/* Last card: Explore more */}
                    <div className="theme-card theme-card-explore">
                        <div className="theme-card-explore-content">
                            <h4>Explore more themes</h4>
                            <p>Browse professionally designed free and paid themes.</p>
                            <a href="https://themes.letbuyy.store" target="_blank" rel="noopener noreferrer" className="os-btn os-btn-outline os-btn-sm">
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                                Visit Theme Store
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer link */}
            <div className="theme-footer-link">
                <a href="https://help.letbuyy.store/themes" target="_blank" rel="noopener noreferrer">
                    Learn more about themes
                </a>
            </div>
        </div>
    )
}
