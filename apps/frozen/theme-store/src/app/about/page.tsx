import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Page, PageContent, PageHeader, Section } from '@letbuyy/ui';

export const metadata: Metadata = {
    title: 'About LetBuyy Themes',
    robots: { index: false, follow: true },
};

const PRINCIPLES = [
    ['Governed catalog', 'Themes are listed through the API gateway and backed by catalog metadata, reviews, purchases, installs, and releases.'],
    ['Try before publish', 'Merchants can preview themes against a selected store before publishing changes.'],
    ['India-first commerce', 'Paid listings use INR checkout, receipt, and license records; subscription billing is not part of this marketplace path.'],
    ['Developer pipeline', 'Theme authors can draft listings, submit for review, and track review status from the developer console.'],
];

export default function AboutPage() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="About LetBuyy Themes"
                eyebrow="Marketplace"
                description="A governed theme marketplace for LetBuyy storefront, portfolio, resume, SaaS, and landing-page sites."
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'Browse themes', href: '/themes' }}
                secondaryActions={[{ label: 'Developer console', href: '/developer' }]}
            />
            <PageContent>
                <Section title="What this marketplace owns" className="px-0 py-0">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        {PRINCIPLES.map(([title, body]) => (
                            <Card key={title} className="p-[var(--lb-density-card-padding)]">
                                <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {title}
                                </h2>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                    {body}
                                </p>
                            </Card>
                        ))}
                    </div>
                </Section>

                <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                    <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        Key workflows
                    </h2>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        {[
                            ['Catalog', '/themes'],
                            ['Compare', '/themes/compare'],
                            ['Saved themes', '/dashboard/favorites'],
                            ['Purchases', '/dashboard/purchases'],
                            ['Installations', '/dashboard/installations'],
                        ].map(([label, href]) => (
                            <Link key={href} href={href} className="btn-secondary px-4 py-2 text-sm">
                                {label}
                            </Link>
                        ))}
                    </div>
                </Card>
            </PageContent>
        </Page>
    );
}
