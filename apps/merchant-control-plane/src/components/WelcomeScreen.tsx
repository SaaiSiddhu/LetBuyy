'use client'

import Link from 'next/link'
import { MaterialIcon } from '@letbuyy/ui'

interface WelcomeScreenProps {
    store: string
    storeName: string
    siteType: string
}

const setupSteps: Record<string, Array<{ icon: string; title: string; desc: string; href: string }>> = {
    store: [
        { icon: 'inventory_2', title: 'Add your first product', desc: 'Start building your catalog', href: 'products/new' },
        { icon: 'palette', title: 'Customize your theme', desc: 'Make your store yours', href: 'pages' },
        { icon: 'local_shipping', title: 'Set up shipping', desc: 'Configure delivery options', href: 'settings' },
        { icon: 'payments', title: 'Set up payments', desc: 'Start accepting orders', href: 'settings' },
        { icon: 'domain', title: 'Add a custom domain', desc: 'yourstore.com', href: 'settings' },
    ],
    portfolio: [
        { icon: 'work', title: 'Add your first project', desc: 'Showcase your best work', href: 'projects/new' },
        { icon: 'image', title: 'Upload to gallery', desc: 'Add images and media', href: 'gallery' },
        { icon: 'star', title: 'List your skills', desc: 'Highlight what you do', href: 'skills' },
        { icon: 'palette', title: 'Customize appearance', desc: 'Pick your style', href: 'appearance' },
    ],
    resume: [
        { icon: 'work', title: 'Add experience', desc: 'Your work history', href: 'experience' },
        { icon: 'school', title: 'Add education', desc: 'Degrees & certifications', href: 'education' },
        { icon: 'star', title: 'List your skills', desc: 'Technical & soft skills', href: 'skills' },
        { icon: 'picture_as_pdf', title: 'Generate PDF', desc: 'Export your resume', href: 'export' },
    ],
    landing: [
        { icon: 'article', title: 'Edit your page', desc: 'Customize content', href: 'pages' },
        { icon: 'contact_page', title: 'Set up lead capture', desc: 'Collect visitor info', href: 'leads' },
        { icon: 'palette', title: 'Customize design', desc: 'Match your brand', href: 'appearance' },
    ],
    blog: [
        { icon: 'edit_note', title: 'Write your first post', desc: 'Start sharing your ideas', href: 'posts/new' },
        { icon: 'category', title: 'Create categories', desc: 'Organize your content', href: 'categories' },
        { icon: 'palette', title: 'Customize theme', desc: 'Make it your own', href: 'appearance' },
    ],
}

export default function WelcomeScreen({ store, storeName, siteType }: WelcomeScreenProps) {
    const steps = setupSteps[siteType] || setupSteps.store

    return (
        <div className="admin-welcome">
            <div className="admin-welcome-name">
                👋 Welcome to <strong style={{ marginLeft: '4px' }}>{storeName || store}</strong>
            </div>

            {/* Setup guide */}
            <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                }}>
                    Get started with your {siteType}
                </h3>
                <p style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    marginBottom: '16px',
                }}>
                    Complete these steps to set up your {siteType === 'store' ? 'online store' : siteType}.
                </p>
            </div>

            {/* Quick start cards */}
            <div className="admin-welcome-cards">
                <div className="admin-welcome-card">
                    <div className="admin-welcome-card-image">
                        <MaterialIcon name="storefront" />
                    </div>
                    <h3>Customize your online {siteType}</h3>
                    <p>Pick a theme, add your logo, and make it uniquely yours.</p>
                    <div className="admin-welcome-card-actions">
                        <Link href={`/${store}/pages`} className="admin-welcome-btn-primary">
                            Customize
                        </Link>
                    </div>
                </div>

                <div className="admin-welcome-card">
                    <div className="admin-welcome-card-image">
                        <MaterialIcon name={siteType === 'store' ? 'shopping_bag' : 'add_circle'} />
                    </div>
                    <h3>
                        {siteType === 'store'
                            ? 'Add your first product'
                            : siteType === 'blog'
                                ? 'Write your first post'
                                : 'Add your first content'}
                    </h3>
                    <p>
                        {siteType === 'store'
                            ? 'Add photos, pricing, and details for your items.'
                            : 'Start creating the content that will attract visitors.'}
                    </p>
                    <div className="admin-welcome-card-actions">
                        <Link
                            href={`/${store}/${steps[0]?.href || 'dashboard'}`}
                            className="admin-welcome-btn-primary"
                        >
                            Get started
                        </Link>
                    </div>
                </div>
            </div>

            {/* Steps list */}
            <div className="admin-welcome-steps">
                {steps.map((step, i) => (
                    <Link
                        key={i}
                        href={`/${store}/${step.href}`}
                        className="admin-welcome-step"
                        style={{ textDecoration: 'none' }}
                    >
                        <div className="admin-welcome-step-icons">
                            <MaterialIcon name={step.icon} style={{ fontSize: '20px', color: 'var(--primary)' }} />
                        </div>
                        <h4>{step.title}</h4>
                        <p>{step.desc}</p>
                    </Link>
                ))}
            </div>

            {/* Helpful hint */}
            <div className="admin-welcome-hint">
                <MaterialIcon name="tips_and_updates" style={{ fontSize: '18px', color: 'var(--primary)' }} />
                <span>
                    💡 Tip: Press <kbd style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                    }}>⌘K</kbd> to quickly navigate anywhere.
                </span>
            </div>
        </div>
    )
}
