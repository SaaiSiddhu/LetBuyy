import type { Metadata } from 'next';
import { Card, Page, PageContent, PageHeader, Section, Table } from '@letbuyy/ui';

export const metadata: Metadata = {
    title: 'API Reference',
    robots: { index: false, follow: true },
};

const API_ROWS = [
    ['Catalog', 'GET /v1/themes', 'Filters by category, site type, layout, tag, feature, price, pagination, and sort.'],
    ['Suggestions', 'GET /v1/themes/suggest', 'Returns catalog-wide theme, tag, industry, and feature suggestions.'],
    ['Collections', 'GET /v1/themes/collections', 'Lists curated or generated marketplace collections.'],
    ['Author profiles', 'GET /v1/themes/authors/:handle', 'Returns developer profile and public theme portfolio data.'],
    ['Reviews', 'GET/POST /v1/themes/:slug/reviews', 'Lists published reviews and accepts verified-purchase review submissions.'],
    ['Preview', 'POST /v1/themes/:slug/preview-session', 'Creates a signed store preview session for authenticated merchants.'],
    ['Purchase', 'POST /v1/themes/:slug/purchase', 'Creates a provider-backed INR purchase order with server-side price lookup.'],
    ['Verify purchase', 'POST /v1/themes/:slug/purchase/verify', 'Verifies provider signature and issues receipt/license records.'],
    ['Downloads', 'GET /v1/themes/:slug/downloads/:platform', 'Checks entitlement and returns artifact metadata or a signed URL when storage is active.'],
    ['Developer listings', 'POST /v1/themes/developer/listings', 'Creates draft or submitted developer listing records.'],
];

export default function ApiDocsPage() {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title="Theme Marketplace API Reference"
                eyebrow="API"
                description="Versioned gateway surfaces consumed by the theme marketplace app through `@letbuyy/api-client`."
                identity="themes"
                showEyebrow
                showDescription
                showBreadcrumbs
                breadcrumbs={[
                    { label: 'Docs', href: '/docs' },
                    { label: 'API reference' },
                ]}
            />
            <PageContent>
                <Section title="Gateway surfaces" className="px-0 py-0">
                    <Table tableClassName="min-w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">Area</th>
                                <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">Endpoint</th>
                                <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase text-[color:var(--lb-color-text-subdued)]">Purpose</th>
                            </tr>
                        </thead>
                        <tbody>
                            {API_ROWS.map(([area, endpoint, purpose]) => (
                                <tr key={endpoint} className="border-b border-[var(--lb-color-border)] last:border-0">
                                    <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                        {area}
                                    </th>
                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                        <code className="rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]">
                                            {endpoint}
                                        </code>
                                    </td>
                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                        {purpose}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Section>

                <Card className="p-[var(--lb-density-card-padding)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        Public partner API publication remains owned by the developer portal. This page documents the theme marketplace runtime surfaces that this app consumes today.
                    </p>
                </Card>
            </PageContent>
        </Page>
    );
}
