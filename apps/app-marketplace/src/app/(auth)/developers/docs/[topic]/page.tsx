import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from '@letbuyy/ui';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

type DocTopic = {
    slug: string;
    title: string;
    description: string;
    sections: Array<{
        heading: string;
        items: string[];
    }>;
};

const topics: DocTopic[] = [
    {
        slug: 'getting-started',
        title: 'Getting started',
        description: 'Create and submit a LetBuyy app record for retained private/sandbox review flows.',
        sections: [
            {
                heading: 'Developer flow',
                items: [
                    'Register with business, tax, support, and consent details.',
                    'Create an app with URLs, manifest, OAuth redirects, scopes, pricing, media, support SLA, and data-handling disclosure.',
                    'Submit for automated checks and marketplace review.',
                    'Use Partner Console scaffolding for versions, pricing metadata, webhooks, analytics, usage metrics, and payout-status review.',
                ],
            },
            {
                heading: 'Before submission',
                items: [
                    'Use HTTPS for app, privacy, and OAuth redirect URLs.',
                    'Include at least one real screenshot.',
                    'Keep pricing, trial, usage, support, and data-handling claims accurate.',
                ],
            },
        ],
    },
    {
        slug: 'api-reference',
        title: 'API reference',
        description: 'Current app API surfaces for installed apps and marketplace developers.',
        sections: [
            {
                heading: 'Installed app APIs',
                items: [
                    'App-token routes require an active installation, token hash match, and granted scope.',
                    'Usage event ingestion records usage, quota accounting, and API metrics.',
                    'Quota responses expose remaining daily quota headers when accounting data is available.',
                ],
            },
            {
                heading: 'Developer APIs',
                items: [
                    'Partner Console calls gateway endpoints for app CRUD, versions, plans, analytics, webhooks, collaborators, sandbox requests, and demo sessions.',
                    'OAuth install is the documented merchant install path and uses PKCE S256.',
                    'Lifecycle and compliance webhooks are delivered through durable delivery records when subscriptions are persisted.',
                ],
            },
        ],
    },
    {
        slug: 'manifest-spec',
        title: 'Manifest spec',
        description: 'Required manifest fields and review-time validation rules.',
        sections: [
            {
                heading: 'Required fields',
                items: [
                    'Name, slug, version, app URL, privacy URL, OAuth redirect URLs, and requested scopes.',
                    'Extension and function declarations as review metadata while live execution remains frozen.',
                    'Version and release-note data when shipping an update.',
                ],
            },
            {
                heading: 'Validation',
                items: [
                    'Submitted slug must match the manifest slug.',
                    'URLs must be HTTPS and redirect URLs must match the submitted manifest.',
                    'Requested scopes must be known platform scopes and match the app use case.',
                    'Function/module URLs are review metadata only until `SKIP-CAP-CHECKOUT-WASM-RETIREMENT` is resolved or formally re-scoped.',
                ],
            },
        ],
    },
    {
        slug: 'economics',
        title: 'Marketplace economics',
        description: 'Current app pricing, revenue share, charge, and payout behavior.',
        sections: [
            {
                heading: 'Revenue share',
                items: [
                    'Pricing rows are retained as schema metadata.',
                    'Public app monetization is not launch-approved.',
                    'Pricing metadata supports free, freemium, recurring, one-time, and usage models for approved future activation.',
                ],
            },
            {
                heading: 'Billing lifecycle',
                items: [
                    'Merchants must review and approve paid app charges before any approved future activation.',
                    'Trials and usage metering are captured in app billing records.',
                    'Payout status follows the payout ledger state, not only the charge state.',
                ],
            },
        ],
    },
    {
        slug: 'review-policy',
        title: 'Review policy',
        description: 'How LetBuyy reviews marketplace app submissions and merchant reviews.',
        sections: [
            {
                heading: 'App review checks',
                items: [
                    'Developer approval, manifest integrity, scope clarity, redirect URLs, privacy URL, pricing, support, data handling, and media completeness.',
                    'Submitted app updates create version records and can require review before any approved publication.',
                    'Apps with hard automated-check failures cannot enter any approved catalog surface.',
                ],
            },
            {
                heading: 'Merchant reviews',
                items: [
                    'Published-review scaffolding requires verified active installation proof before any approved public surface.',
                    'Developers can reply to reviews.',
                    'Reports and fraud signals route reviews to moderation before public trust signals are affected.',
                ],
            },
        ],
    },
    {
        slug: 'trust-security',
        title: 'Trust and security',
        description: 'Security and transparency controls built into the marketplace foundation.',
        sections: [
            {
                heading: 'Merchant controls',
                items: [
                    'OAuth install uses PKCE and only grants approved scopes.',
                    'Merchants can review granted scopes and revoke individual scopes.',
                    'Spend controls can cap or flag app billing and usage activity.',
                ],
            },
            {
                heading: 'Trust signals',
                items: [
                    'Built-for-LetBuyy badges, support SLA, compatibility, review verification, and app health signals are backed by stored data.',
                    'Apps must provide structured data-handling disclosure.',
                    'Webhook delivery and compliance events use durable delivery records when subscriptions are persisted.',
                ],
            },
        ],
    },
];

function getTopic(slug: string): DocTopic | undefined {
    return topics.find((topic) => topic.slug === slug);
}

export function generateStaticParams() {
    return topics.map((topic) => ({ topic: topic.slug }));
}

interface DeveloperDocsTopicPageProps {
    params: Promise<{ topic: string }>;
}

export async function generateMetadata({ params }: DeveloperDocsTopicPageProps) {
    const { topic: slug } = await params;
    const topic = getTopic(slug);
    if (!topic) {
        return {
            title: 'Developer docs — LetBuyy App Store',
        };
    }

    return {
        title: `${topic.title} — LetBuyy App Store`,
        description: topic.description,
    };
}

export default async function DeveloperDocsTopicPage({ params }: DeveloperDocsTopicPageProps) {
    const { topic: slug } = await params;
    const topic = getTopic(slug);
    if (!topic) {
        notFound();
    }

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="marketplace-card marketplace-section">
                    <Link href="/developers/docs" className="marketplace-back-link">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Developer docs
                    </Link>
                    <div className="marketplace-section-header">
                        <h1>{topic.title}</h1>
                        <p>{topic.description}</p>
                    </div>
                    <div className="policy-section-list">
                        {topic.sections.map((section) => (
                            <section key={section.heading} className="policy-section">
                                <h2>{section.heading}</h2>
                                <div className="app-permission-checklist">
                                    {section.items.map((item) => (
                                        <span key={item}>
                                            <ShieldCheck size={14} aria-hidden="true" />
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
