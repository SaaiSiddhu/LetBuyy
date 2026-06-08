import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Download, Package, Page, PageContent, PageHeader, Section, ShoppingBag, Upload } from '@letbuyy/ui';

export const metadata: Metadata = {
    title: 'Support',
    robots: { index: false, follow: true },
};

const SUPPORT_ITEMS = [
    {
        title: 'Purchases and receipts',
        body: 'View completed purchases, receipt numbers, and license keys from the purchases dashboard.',
        href: '/dashboard/purchases',
        icon: ShoppingBag,
    },
    {
        title: 'Installations and rollback',
        body: 'Open active installations, apply marketplace updates, and roll back releases from the installation dashboard.',
        href: '/dashboard/installations',
        icon: Package,
    },
    {
        title: 'Downloads',
        body: 'Download entitlement-checked artifacts when storage records are available for your purchased themes.',
        href: '/dashboard/downloads',
        icon: Download,
    },
    {
        title: 'Developer submissions',
        body: 'Create listings, submit review-ready metadata, and inspect review status from the developer console.',
        href: '/developer',
        icon: Upload,
    },
];

export default function SupportPage() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Theme Marketplace Support"
                eyebrow="Support"
                description="Use these workflow surfaces first; they read from the same marketplace records support will ask about."
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'Contact support', href: 'mailto:support@letbuyy.com' }}
                secondaryActions={[{ label: 'Browse docs', href: '/docs' }]}
            />
            <PageContent>
                <Section title="Support workflows" className="px-0 py-0">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        {SUPPORT_ITEMS.map((item) => (
                            <Card key={item.title} layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                <item.icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {item.title}
                                </h2>
                                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                    {item.body}
                                </p>
                                <Link href={item.href} className="btn-secondary w-fit px-4 py-2 text-sm">
                                    Open
                                </Link>
                            </Card>
                        ))}
                    </div>
                </Section>
            </PageContent>
        </Page>
    );
}
