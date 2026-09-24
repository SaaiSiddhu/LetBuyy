import Link from 'next/link';
import type { Metadata } from 'next';
import { BookOpen, Card, Code2, Page, PageContent, PageHeader, Section } from '@letbuyy/ui';

export const metadata: Metadata = {
    title: 'Documentation',
    robots: { index: false, follow: true },
};

const GUIDES = [
    ['Browse and compare', 'Use catalog filters, saved favorites, and side-by-side compare before choosing a theme.', '/themes'],
    ['Preview and install', 'Select a store, create a preview session, install as a draft, then publish or roll back from installations.', '/dashboard/installations'],
    ['Purchases and downloads', 'Completed purchases issue receipt/license records and unlock entitlement-checked artifacts.', '/dashboard/purchases'],
    ['Developer submissions', 'Draft a listing, add metadata, accept the developer agreement, and submit for marketplace review.', '/developer'],
];

export default function DocsPage() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Theme Marketplace Documentation"
                eyebrow="Docs"
                description="Operational notes for the implemented marketplace workflows in this runtime."
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'API reference', href: '/docs/api' }}
                secondaryActions={[{ label: 'Support', href: '/support' }]}
            />
            <PageContent>
                <Section title="Workflow guides" className="px-0 py-0">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        {GUIDES.map(([title, body, href]) => (
                            <Card key={title} layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                                <BookOpen className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {title}
                                </h2>
                                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                    {body}
                                </p>
                                <Link href={href} className="btn-secondary w-fit px-4 py-2 text-sm">
                                    Open workflow
                                </Link>
                            </Card>
                        ))}
                    </div>
                </Section>

                <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                    <Code2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                    <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        API ownership
                    </h2>
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                        Theme marketplace data flows through the versioned API gateway and the additive `@letbuyy/api-client` theme resource. App pages should consume those client methods instead of app-local database logic.
                    </p>
                    <Link href="/docs/api" className="btn-primary w-fit px-4 py-2 text-sm">
                        View API reference
                    </Link>
                </Card>
            </PageContent>
        </Page>
    );
}
