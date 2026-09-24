import Link from 'next/link';
import { BookOpen, Code2, DollarSign, FileText, ShieldCheck } from '@letbuyy/ui';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
    title: 'Developer docs — LetBuyy App Store',
    description: 'Frozen app-marketplace developer contracts for retained private/sandbox integration flows.',
};

const docCards = [
    {
        title: 'Getting started',
        description: 'Register, create an app record, submit for review, and keep activation human-approved.',
        href: '/developers/docs/getting-started',
        icon: BookOpen,
    },
    {
        title: 'API reference',
        description: 'Review app-token APIs, OAuth install, usage metering, webhooks, and private developer endpoints.',
        href: '/developers/docs/api-reference',
        icon: Code2,
    },
    {
        title: 'Manifest spec',
        description: 'Declare app URLs, OAuth redirects, scopes, extension metadata, function metadata, and version data.',
        href: '/developers/docs/manifest-spec',
        icon: FileText,
    },
    {
        title: 'Economics',
        description: 'Review schema-backed pricing metadata; public marketplace pricing is not launch-approved.',
        href: '/developers/docs/economics',
        icon: DollarSign,
    },
    {
        title: 'Review and trust',
        description: 'Review checks cover manifest integrity, security, data handling, pricing, support, media, and merchant clarity.',
        href: '/developers/docs/review-policy',
        icon: ShieldCheck,
    },
];

export default function DeveloperDocsPage() {
    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="marketplace-card marketplace-section">
                    <div className="marketplace-section-header">
                        <h1>Developer docs</h1>
                        <p>
                            Review retained app-platform contracts for approved private/sandbox flows. Public marketplace activation is frozen until the human-approved trigger.
                        </p>
                    </div>
                    <div className="dev-benefits-grid">
                        {docCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <Link key={card.title} href={card.href} className="dev-benefit-card">
                                    <div className="dev-benefit-card__icon">
                                        <Icon size={24} aria-hidden="true" />
                                    </div>
                                    <h3>{card.title}</h3>
                                    <p>{card.description}</p>
                                </Link>
                            );
                        })}
                    </div>
                    <div className="marketplace-banner marketplace-banner--info">
                        <strong>Current contracts</strong>
                        <span>
                            These docs reflect retained source-backed app submission, install, billing metadata, review, and trust contracts. They are not public launch documentation.
                        </span>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
