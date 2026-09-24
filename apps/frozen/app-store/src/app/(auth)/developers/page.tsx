import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Code2, DollarSign, Users, Zap, BookOpen, Shield } from '@letbuyy/ui';

export const metadata = {
    title: 'Developer Portal — LetBuyy App Store',
    description: 'Review the retained app-marketplace contracts for future approved LetBuyy integrations.',
};

export default function DeveloperPortalPage() {
    const benefits = [
        { icon: <Users size={24} />, title: 'Private Contracts', desc: 'Review retained OAuth, webhook, review, and app-token contracts before public activation.' },
        { icon: <DollarSign size={24} />, title: 'Commercial Metadata', desc: 'Model pricing and payout metadata without treating marketplace monetization as launched.' },
        { icon: <Zap size={24} />, title: 'Gateway APIs', desc: 'Build against source-backed REST, webhook, and app-store contracts in approved sandbox flows.' },
        { icon: <Shield size={24} />, title: 'OAuth 2.0', desc: 'Secure authentication with OAuth 2.0 — users grant specific permissions to your app.' },
        { icon: <Code2 size={24} />, title: 'Frozen Extensions', desc: 'Extension and function declarations remain review metadata until the recorded capability seam is retired or re-scoped.' },
        { icon: <BookOpen size={24} />, title: 'Documentation', desc: 'Read the retained contracts and human-approval boundaries before building against them.' },
    ];

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dev-portal">
                    <div className="dev-portal-hero">
                        <h1>LetBuyy app contracts</h1>
                        <p>
                            The third-party app marketplace is frozen pending the named demand trigger
                            and ARB approval. These pages document retained private contracts, not
                            production activation.
                        </p>
                        <div className="dev-portal-actions">
                            <Link href="/developers/register" className="dev-portal-cta">
                                <Code2 size={18} />
                                Review Contracts
                            </Link>
                            <Link href="/developers/docs" className="dev-portal-cta dev-portal-cta--secondary">
                                <BookOpen size={18} />
                                Read Docs
                            </Link>
                        </div>
                    </div>

                    <div className="dev-benefits-grid">
                        {benefits.map((b, i) => (
                            <div key={i} className="dev-benefit-card">
                                <div className="dev-benefit-card__icon">{b.icon}</div>
                                <h3>{b.title}</h3>
                                <p>{b.desc}</p>
                            </div>
                        ))}
                    </div>

                    <section className="dev-how-section">
                        <h2 className="dev-how-title">How it works</h2>
                        <div className="dev-how-grid">
                            {[
                                { step: '1', title: 'Register', desc: 'Create a developer account record for private review flows.' },
                                { step: '2', title: 'Build', desc: 'Use source-backed APIs and docs only in approved sandbox/private flows.' },
                                { step: '3', title: 'Submit', desc: 'Submit an app record for automated checks and human review.' },
                                { step: '4', title: 'Activate', desc: 'Public catalog activation is outside the current launch scope and is not claimed here.' },
                            ].map((s, i) => (
                                <div key={i} className="dev-step-card">
                                    <div className="dev-step-card__number">{s.step}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="dev-cta-panel">
                        <h2>Review the frozen seam</h2>
                        <p>Use these contracts for approved private work only until public activation is approved.</p>
                        <Link href="/developers/register" className="dev-portal-cta">
                            Create Review Account →
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
