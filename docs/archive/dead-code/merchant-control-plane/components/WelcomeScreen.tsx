'use client'

import Link from 'next/link'
import { Card, MaterialIcon } from '@letbuyy/ui'

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
        <div className="grid gap-[var(--lb-space-5)]">
            <div className="flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text)] shadow-[var(--lb-shadow-sm)]">
                <MaterialIcon name="storefront" size={18} className="text-[var(--lb-color-primary)]" />
                <span>
                    Welcome to <strong className="font-[var(--lb-font-weight-semibold)]">{storeName || store}</strong>
                </span>
            </div>

            {/* Setup guide */}
            <div>
                <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                    Get started with your {siteType}
                </h3>
                <p className="mt-[var(--lb-space-1)] max-w-[var(--lb-size-content-measure)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                    Complete these steps to set up your {siteType === 'store' ? 'online store' : siteType}.
                </p>
            </div>

            {/* Quick start cards */}
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                <Card className="grid gap-[var(--lb-space-4)] p-[var(--lb-space-5)]">
                    <div className="flex h-[var(--lb-size-empty-state-icon)] w-[var(--lb-size-empty-state-icon)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                        <MaterialIcon name="storefront" size={24} />
                    </div>
                    <div className="grid gap-[var(--lb-space-1)]">
                        <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                            Customize your online {siteType}
                        </h3>
                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                            Pick a theme, add your logo, and make it uniquely yours.
                        </p>
                    </div>
                    <div>
                        <Link href={`/${store}/pages`} className="inline-flex h-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                            Customize
                        </Link>
                    </div>
                </Card>

                <Card className="grid gap-[var(--lb-space-4)] p-[var(--lb-space-5)]">
                    <div className="flex h-[var(--lb-size-empty-state-icon)] w-[var(--lb-size-empty-state-icon)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                        <MaterialIcon name={siteType === 'store' ? 'shopping_bag' : 'add_circle'} size={24} />
                    </div>
                    <div className="grid gap-[var(--lb-space-1)]">
                        <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                            {siteType === 'store'
                                ? 'Add your first product'
                                : siteType === 'blog'
                                    ? 'Write your first post'
                                    : 'Add your first content'}
                        </h3>
                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                            {siteType === 'store'
                                ? 'Add photos, pricing, and details for your items.'
                                : 'Start creating the content that will attract visitors.'}
                        </p>
                    </div>
                    <div>
                        <Link
                            href={`/${store}/${steps[0]?.href || 'dashboard'}`}
                            className="inline-flex h-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        >
                            Get started
                        </Link>
                    </div>
                </Card>
            </div>

            {/* Steps list */}
            <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2 xl:grid-cols-5">
                {steps.map((step, i) => (
                    <Link
                        key={i}
                        href={`/${store}/${step.href}`}
                        className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] text-[var(--lb-color-text)] no-underline shadow-[var(--lb-shadow-sm)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                    >
                        <div className="flex h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] items-center justify-center rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                            <MaterialIcon name={step.icon} size={20} />
                        </div>
                        <h4 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">{step.title}</h4>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{step.desc}</p>
                    </Link>
                ))}
            </div>

            {/* Helpful hint */}
            <div className="flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text-subdued)]">
                <MaterialIcon name="tips_and_updates" size={18} className="text-[var(--lb-color-primary)]" />
                <span>
                    Tip: Press <kbd className="rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[1px] text-[11px] text-[var(--lb-color-text)]">⌘K</kbd> to quickly navigate anywhere.
                </span>
            </div>
        </div>
    )
}
