import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Mail, Page, PageContent, PageHeader, Section } from '@letbuyy/ui';

export const metadata: Metadata = {
    title: 'Contact',
    robots: { index: false, follow: true },
};

const CONTACT_ROUTES = [
    ['Purchase or license help', 'support@letbuyy.com', 'Include the receipt number or purchase id from your dashboard.'],
    ['Developer submissions', 'support@letbuyy.com', 'Include your listing slug and review status.'],
    ['Policy requests', 'support@letbuyy.com', 'Mention the legal page or data request you are asking about.'],
];

export default function ContactPage() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Contact LetBuyy Themes"
                eyebrow="Contact"
                description="Use the marketplace dashboard for account-specific records, or contact support with the relevant receipt, listing, or theme slug."
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'Email support', href: 'mailto:support@letbuyy.com' }}
                secondaryActions={[{ label: 'Support center', href: '/support' }]}
            />
            <PageContent>
                <Section title="Contact routes" className="px-0 py-0">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                        {CONTACT_ROUTES.map(([title, mailbox, detail]) => (
                            <Card key={title} layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {title}
                                </h2>
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {detail}
                                </p>
                                <a href={`mailto:${mailbox}`} className="btn-secondary px-4 py-2 text-sm">
                                    {mailbox}
                                </a>
                            </Card>
                        ))}
                    </div>
                </Section>

                <Card className="p-[var(--lb-density-card-padding)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        For theme-specific abuse or quality concerns, use the report action on the relevant theme detail page so the report is tied to the listing record.
                    </p>
                    <Link href="/themes" className="btn-primary mt-[var(--lb-space-4)] inline-flex px-4 py-2 text-sm">
                        Find a theme
                    </Link>
                </Card>
            </PageContent>
        </Page>
    );
}
