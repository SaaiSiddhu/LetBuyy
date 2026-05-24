import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { Code2, DollarSign, Users, Zap, BookOpen, Shield } from 'lucide-react';

export const metadata = {
    title: 'Developer Portal — LetBuyy App Store',
    description: 'Build apps for the LetBuyy platform and reach thousands of Indian merchants.',
};

export default function DeveloperPortalPage() {
    const benefits = [
        { icon: <Users size={24} />, title: 'Reach Merchants', desc: 'Access thousands of Indian e-commerce merchants on the LetBuyy platform.' },
        { icon: <DollarSign size={24} />, title: 'Earn Revenue', desc: 'Monetize your apps with flexible pricing models — subscriptions, one-time, or usage-based.' },
        { icon: <Zap size={24} />, title: 'Powerful APIs', desc: 'Build with our comprehensive REST APIs, webhooks, and extension points.' },
        { icon: <Shield size={24} />, title: 'OAuth 2.0', desc: 'Secure authentication with OAuth 2.0 — users grant specific permissions to your app.' },
        { icon: <Code2 size={24} />, title: '6 Extension Types', desc: 'From storefront blocks to checkout UI — extend every part of the LetBuyy experience.' },
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
                        <Link href="/developers/register" className="dev-portal-cta">
                            <Code2 size={18} />
                            Start Building
                        </Link>
                    </div>

                    {/* Benefits grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 20,
                        marginBottom: 48,
                    }}>
                        {benefits.map((b, i) => (
                            <div key={i} style={{
                                padding: 24,
                                borderRadius: 16,
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                animation: `slideUp 0.5s ease both`,
                                animationDelay: `${i * 0.1}s`,
                            }}>
                                <div style={{ color: 'var(--primary)', marginBottom: 12 }}>{b.icon}</div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                                    {b.title}
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                    {b.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* How it works */}
                    <section style={{ textAlign: 'center', marginBottom: 48 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>
                            How it works
                        </h2>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: 32,
                            flexWrap: 'wrap',
                        }}>
                            {[
                                { step: '1', title: 'Register', desc: 'Create your developer account and verify your identity.' },
                                { step: '2', title: 'Build', desc: 'Use our APIs and documentation to create your app.' },
                                { step: '3', title: 'Submit', desc: 'Submit your app for review by our team.' },
                                { step: '4', title: 'Publish', desc: 'Once approved, your app goes live in the App Store.' },
                            ].map((s, i) => (
                                <div key={i} style={{ maxWidth: 200, textAlign: 'center' }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        background: 'var(--primary)', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 12px', fontWeight: 800, fontSize: 18,
                                    }}>
                                        {s.step}
                                    </div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                                        {s.title}
                                    </h3>
                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                        {s.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* CTA */}
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 24px',
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.1))',
                        border: '1px solid var(--border)',
                    }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                            Ready to get started?
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                            Join the LetBuyy developer community today.
                        </p>
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
