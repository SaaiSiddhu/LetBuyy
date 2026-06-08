import Link from 'next/link';
import { BookOpen, Code2, DollarSign, FileText, ShieldCheck } from '@letbuyy/ui';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata = {
    title: 'Developer docs — LetBuyy App Store',
    description: 'App marketplace developer documentation for getting started, manifests, APIs, economics, and review requirements.',
};

const docCards = [
    {
        title: 'Getting started',
        description: 'Register, get approved, create an app, submit for review, and operate from Partner Console.',
        href: '/developers/docs/getting-started',
        icon: BookOpen,
    },
    {
        title: 'API reference',
        description: 'Use app-token APIs, OAuth install, usage metering, webhooks, and marketplace developer endpoints.',
        href: '/developers/docs/api-reference',
        icon: Code2,
    },
    {
        title: 'Manifest spec',
        description: 'Declare app URLs, OAuth redirects, scopes, extensions, functions, and version metadata.',
        href: '/developers/docs/manifest-spec',
        icon: FileText,
    },
    {
        title: 'Economics',
        description: 'Current in-code default is 85% partner share and 15% LetBuyy platform fee.',
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
                            Build, submit, publish, and operate marketplace apps with the current LetBuyy app platform contracts.
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
                            These docs reflect the current app submission, install, billing, review, and trust contracts available in the marketplace foundation.
                        </span>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
