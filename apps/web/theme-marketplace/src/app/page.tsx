import Link from 'next/link';
import { ArrowRight, Sparkles, Zap, Smartphone, Lock, Globe, Code, ShoppingBag, Palette, FileText, Rocket } from 'lucide-react';
import ThemeCard from '@/components/theme-card';
import { MOCK_THEMES } from '@/lib/theme-data';
import { formatCount } from '@/lib/utils';

const STATS = [
    { label: 'Themes', value: '50+', icon: Palette },
    { label: 'Installs', value: '10K+', icon: Zap },
    { label: 'Avg Rating', value: '4.8★', icon: Sparkles },
    { label: 'Categories', value: '4', icon: Globe },
];

const CATEGORIES = [
    { slug: 'store', label: 'Store Themes', description: 'E-commerce & retail', icon: ShoppingBag, count: 25, color: 'from-blue-500 to-cyan-500' },
    { slug: 'portfolio', label: 'Portfolio', description: 'Designers & creatives', icon: Palette, count: 10, color: 'from-purple-500 to-pink-500' },
    { slug: 'resume', label: 'Resume / CV', description: 'Professional profiles', icon: FileText, count: 8, color: 'from-amber-500 to-orange-500' },
    { slug: 'landing', label: 'Landing Pages', description: 'Product & SaaS launches', icon: Rocket, count: 12, color: 'from-emerald-500 to-teal-500' },
];

const VALUE_PROPS = [
    { icon: Zap, title: 'Instant Setup', desc: 'One-click install — your store is live in under 60 seconds.' },
    { icon: Palette, title: 'Fully Customizable', desc: 'Change colors, fonts, and layouts with a live visual editor.' },
    { icon: Smartphone, title: 'Mobile Responsive', desc: 'Every theme looks perfect on phones, tablets, and desktops.' },
    { icon: Lock, title: 'Secure Payments', desc: 'Stripe & Razorpay integrated for Indian and global transactions.' },
    { icon: Globe, title: 'Multi-Platform Export', desc: 'Export to WordPress, Shopify, HTML, or standalone React.' },
    { icon: Code, title: 'Developer Friendly', desc: 'Clean TypeScript code, well-documented, and easily extensible.' },
];

export default function HomePage() {
    const featuredThemes = MOCK_THEMES.slice(0, 4);

    return (
        <>
            {/* ═══════════════════════════════════════
                HERO SECTION
               ═══════════════════════════════════════ */}
            <section className="relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px]" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                </div>

                <div className="container-main relative py-24 md:py-36 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary-light text-xs font-medium mb-6">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>50+ Professionally Designed Themes</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
                        Beautiful Themes for{' '}
                        <span className="gradient-text">Every Business</span>
                    </h1>

                    {/* Sub-headline */}
                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-text-body mb-10 leading-relaxed">
                        Launch your online store, portfolio, or landing page with{' '}
                        <strong className="text-text-heading">professionally designed</strong>,{' '}
                        <strong className="text-text-heading">customizable themes</strong>.
                        Install in one click.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link href="/themes" className="btn-primary text-base py-3 px-8 flex items-center gap-2">
                            Browse All Themes
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link href="/pricing" className="btn-secondary text-base py-3 px-8">
                            View Pricing
                        </Link>
                    </div>

                    {/* Stats Bar */}
                    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
                        {STATS.map(stat => (
                            <div key={stat.label} className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center">
                                    <stat.icon className="w-4.5 h-4.5 text-primary-light" />
                                </div>
                                <div className="text-left">
                                    <p className="text-lg font-bold text-text-heading">{stat.value}</p>
                                    <p className="text-[11px] text-text-subtle uppercase tracking-wider">{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                FEATURED THEMES
               ═══════════════════════════════════════ */}
            <section className="container-main py-20">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-2">Handpicked</p>
                        <h2 className="text-2xl md:text-3xl font-bold">Featured Themes</h2>
                    </div>
                    <Link href="/themes" className="text-sm text-text-body hover:text-primary-light flex items-center gap-1.5 transition-colors">
                        View all <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {featuredThemes.map(theme => (
                        <ThemeCard key={theme.id} theme={theme} featured />
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════
                BROWSE BY CATEGORY
               ═══════════════════════════════════════ */}
            <section className="container-main py-20">
                <div className="text-center mb-12">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-2">Categories</p>
                    <h2 className="text-2xl md:text-3xl font-bold">Browse by Type</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {CATEGORIES.map(cat => (
                        <Link
                            key={cat.slug}
                            href={`/themes?category=${cat.slug}`}
                            className="glass-card p-6 group text-center"
                        >
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                                <cat.icon className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-base font-semibold text-text-heading mb-1">{cat.label}</h3>
                            <p className="text-xs text-text-muted mb-3">{cat.description}</p>
                            <span className="text-[11px] text-text-subtle">{cat.count} themes</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════
                VALUE PROPOSITIONS
               ═══════════════════════════════════════ */}
            <section className="py-20 border-t border-border">
                <div className="container-main">
                    <div className="text-center mb-14">
                        <p className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-2">Why Choose Us</p>
                        <h2 className="text-2xl md:text-3xl font-bold">Everything You Need</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {VALUE_PROPS.map(prop => (
                            <div key={prop.title} className="glass-card p-6">
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                    <prop.icon className="w-5 h-5 text-primary-light" />
                                </div>
                                <h3 className="text-base font-semibold text-text-heading mb-2">{prop.title}</h3>
                                <p className="text-sm text-text-muted leading-relaxed">{prop.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                CTA BANNER
               ═══════════════════════════════════════ */}
            <section className="container-main py-20">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-bg-card to-secondary/20 border border-border p-10 md:p-16 text-center">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-[80px]" />
                        <div className="absolute bottom-0 left-0 w-72 h-72 bg-secondary/10 rounded-full blur-[80px]" />
                    </div>
                    <div className="relative">
                        <h2 className="text-2xl md:text-4xl font-bold mb-4">
                            Ready to Build Something{' '}
                            <span className="gradient-text">Amazing</span>?
                        </h2>
                        <p className="text-text-body max-w-lg mx-auto mb-8">
                            Join thousands of businesses using LetBuyy Themes to power their online presence.
                        </p>
                        <Link href="/themes" className="btn-primary text-base py-3 px-8 inline-flex items-center gap-2">
                            Get Started — It&apos;s Free
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
