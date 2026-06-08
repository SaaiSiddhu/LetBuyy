import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Code2, DollarSign, Users, Zap, BookOpen, Shield } from '@letbuyy/ui';

export const metadata = {
    title: 'Developer Portal — LetBuyy App Store',
    description: 'Build apps for the LetBuyy platform and reach thousands of Indian merchants.',
};

export default function DeveloperPortalPage() {
    const benefits = [
        { icon: <Users size={24} />, title: 'Reach Merchants', desc: 'Access thousands of Indian e-commerce merchants on the LetBuyy platform.' },
        { icon: <DollarSign size={24} />, title: 'Earn Revenue', desc: 'Monetize your apps with free, freemium, recurring, one-time, or usage-based pricing.' },
        { icon: <Zap size={24} />, title: 'Powerful APIs', desc: 'Build with our comprehensive REST APIs, webhooks, and extension points.' },
        { icon: <Shield size={24} />, title: 'OAuth 2.0', desc: 'Secure authentication with OAuth 2.0 — users grant specific permissions to your app.' },
        { icon: <Code2 size={24} />, title: 'Extension APIs', desc: 'Build storefront, checkout, admin, and embedded app surfaces as platform capabilities become available in-product.' },
        { icon: <BookOpen size={24} />, title: 'Documentation', desc: 'Comprehensive guides, API references, and code examples to get you started fast.' },
    ];

    return (
        <>
            <Header />
            <main className="appstore-main">
                <div className="dev-portal">
                    <div className="dev-portal-hero">
                        <h1>Build for LetBuyy</h1>
                        <p>
                            Create powerful apps and integrations for India&apos;s fastest-growing
                            e-commerce platform. Reach thousands of merchants and grow your business.
                        </p>
                        <div className="dev-portal-actions">
                            <Link href="/developers/register" className="dev-portal-cta">
                                <Code2 size={18} />
                                Start Building
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
                                { step: '1', title: 'Register', desc: 'Create your developer account and verify your identity.' },
                                { step: '2', title: 'Build', desc: 'Use our APIs and documentation to create your app.' },
                                { step: '3', title: 'Submit', desc: 'Submit your app for review by our team.' },
                                { step: '4', title: 'Publish', desc: 'Once approved, your app goes live in the App Store.' },
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
                        <h2>Ready to get started?</h2>
                        <p>Join the LetBuyy developer community today.</p>
                        <Link href="/developers/register" className="dev-portal-cta">
                            Create Developer Account →
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
