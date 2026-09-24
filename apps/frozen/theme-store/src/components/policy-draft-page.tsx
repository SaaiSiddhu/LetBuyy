import Link from 'next/link';
import { Card, Page, PageContent, PageHeader, Section } from '@letbuyy/ui';

type PolicySection = {
    title: string;
    body: string;
};

type PolicyDraftPageProps = {
    title: string;
    description: string;
    sections: PolicySection[];
};

export default function PolicyDraftPage({ title, description, sections }: PolicyDraftPageProps) {
    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title={title}
                eyebrow="Policy"
                description={description}
                identity="themes"
                showEyebrow
                showDescription
                primaryAction={{ label: 'Contact support', href: 'mailto:support@letbuyy.com' }}
                secondaryActions={[{ label: 'Back to support', href: '/support' }]}
            />
            <PageContent>
                <Card className="p-[var(--lb-density-card-padding)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        This page states the operating policy for the local and staging theme marketplace runtime. Production publication uses the same route structure with operator-approved identifiers, jurisdiction language, and customer notices.
                    </p>
                </Card>

                <Section title="Policy details" className="px-0 py-0">
                    <div className="grid gap-[var(--lb-space-4)]">
                        {sections.map((section) => (
                            <Card key={section.title} className="p-[var(--lb-density-card-padding)]">
                                <h2 className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {section.title}
                                </h2>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                    {section.body}
                                </p>
                            </Card>
                        ))}
                    </div>
                </Section>

                <Card className="p-[var(--lb-density-card-padding)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        For account-specific questions, include the theme slug, purchase id, receipt number, or developer listing slug when contacting support.
                    </p>
                    <Link href="/contact" className="btn-secondary mt-[var(--lb-space-4)] inline-flex px-4 py-2 text-sm">
                        Contact options
                    </Link>
                </Card>
            </PageContent>
        </Page>
    );
}
