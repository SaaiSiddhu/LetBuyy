import Link from 'next/link';
import { ArrowRight, Sparkles, Zap, Smartphone, Lock, Globe, Code, ShoppingBag, Palette, FileText, Rocket, Star, Check, ChevronRight } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import { ThemeService } from '@/lib/theme-service';

const STATS = [
    { label: 'Premium Themes', value: '50+', icon: Palette },
    { label: 'Active Installs', value: '10K+', icon: Zap },
    { label: 'Avg Rating', value: '4.8', icon: Star },
    { label: 'Categories', value: '4', icon: Globe },
];

const CATEGORIES = [
    { slug: 'store', label: 'Store Themes', description: 'E-commerce & retail storefronts', icon: ShoppingBag, color: 'from-blue-500 to-cyan-400', shadowColor: 'shadow-blue-500/20' },
    { slug: 'portfolio', label: 'Portfolio', description: 'Designers & creative showcases', icon: Palette, color: 'from-purple-500 to-pink-500', shadowColor: 'shadow-purple-500/20' },
    { slug: 'resume', label: 'Resume / CV', description: 'Professional profiles & CVs', icon: FileText, color: 'from-amber-500 to-orange-400', shadowColor: 'shadow-amber-500/20' },
    { slug: 'landing', label: 'Landing Pages', description: 'SaaS & product launches', icon: Rocket, color: 'from-emerald-500 to-teal-400', shadowColor: 'shadow-emerald-500/20' },
];

const VALUE_PROPS = [
    { icon: Zap, title: 'Instant Setup', desc: 'One-click install — your store is live in under 60 seconds. No code, no complexity.', accent: 'from-yellow-500 to-amber-500' },
    { icon: Palette, title: 'Fully Customizable', desc: 'Change colors, fonts, and layouts with a live visual editor. Make it truly yours.', accent: 'from-purple-500 to-pink-500' },
    { icon: Smartphone, title: 'Mobile Responsive', desc: 'Every theme looks pixel-perfect on phones, tablets, and desktops.', accent: 'from-blue-500 to-cyan-500' },
    { icon: Lock, title: 'Secure Payments', desc: 'Stripe & Razorpay integrated for Indian and global transactions out of the box.', accent: 'from-emerald-500 to-green-500' },
    { icon: Globe, title: 'Multi-Platform Export', desc: 'Export to WordPress, Shopify, HTML, or standalone React — your choice.', accent: 'from-indigo-500 to-violet-500' },
    { icon: Code, title: 'Developer Friendly', desc: 'Clean TypeScript code, well-documented APIs, and easily extensible architecture.', accent: 'from-rose-500 to-red-500' },
];

const TRUST_BADGES = [
    'No credit card required',
    'Free themes available',
    '24/7 support',
    'Cancel anytime',
];

export default async function HomePage() {
    const { themes: featuredThemes } = await ThemeService.listThemes({
        sort: 'rating',
        limit: 4,
    });

    const categoryCountPromises = CATEGORIES.map(async (cat) => {
        const { total } = await ThemeService.listThemes({ category: cat.slug, limit: 1 });
        return { slug: cat.slug, count: total };
    });
    const categoryCounts = await Promise.all(categoryCountPromises);
    const countMap = Object.fromEntries(categoryCounts.map(c => [c.slug, c.count]));

    return (
        <>
            {/* ═══════════════════════════════════════
                HERO — Premium Split Layout
               ═══════════════════════════════════════ */}
            <section className="relative overflow-hidden lg:min-h-[calc(100dvh-72px)] lg:flex lg:flex-col">
                {/* ── Ambient Background Effects ── */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Primary orb */}
                    <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-primary/[0.07] blur-[120px]" />
                    {/* Secondary orb */}
                    <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/[0.06] blur-[100px]" />
                    {/* Accent orb */}
                    <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-accent/[0.04] blur-[80px]" />
                    {/* Grid pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '60px 60px',
                        }}
                    />
                    {/* Top-edge gradient line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                </div>

                <div className="container-main relative pt-[24px] pb-[24px] md:pt-[40px] md:pb-[40px] lg:flex-1 lg:flex lg:items-center lg:pt-[40px] lg:pb-[40px]">
                    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-[32px] lg:gap-[64px] items-center">

                        {/* ─── Left: Hero Content ─── */}
                        <div className="order-2 lg:order-1">
                            {/* Headline */}
                            <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] lg:text-[3.75rem] font-extrabold tracking-tight leading-[1.08] mb-6">
                                <span className="text-text-heading">Build Stunning</span>
                                <br />
                                <span className="text-text-heading">Websites with </span>
                                <span className="gradient-text">Premium Themes</span>
                            </h1>

                            {/* Sub-headline */}
                            <p className="max-w-lg text-base md:text-lg text-text-muted leading-relaxed mb-8">
                                Launch your online store, portfolio, or landing page with
                                professionally crafted, pixel-perfect themes.{' '}
                                <span className="text-text-heading font-medium">Install in one click.</span>
                            </p>

                            {/* CTA Buttons */}
                            <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
                                <Link
                                    href="/themes"
                                    className="btn-primary text-sm py-3.5 px-8 flex items-center gap-2.5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                                >
                                    Browse All Themes
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                                <Link
                                    href="/pricing"
                                    className="btn-secondary text-sm py-3.5 px-8 flex items-center gap-2"
                                >
                                    View Pricing
                                </Link>
                            </div>

                            {/* Trust Badges */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-10">
                                {TRUST_BADGES.map(badge => (
                                    <div key={badge} className="flex items-center gap-1.5 text-xs text-text-subtle">
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        {badge}
                                    </div>
                                ))}
                            </div>

                            {/* Stats Bar */}
                            <div className="flex flex-wrap items-center gap-6 lg:gap-8 pt-6 border-t border-white/[0.06]">
                                {STATS.map(stat => (
                                    <div key={stat.label} className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                            <stat.icon className="w-3.5 h-3.5 text-primary-light" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-text-heading leading-none">{stat.value}</p>
                                            <p className="text-[10px] text-text-subtle mt-0.5">{stat.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ─── Right: Bento Grid ─── */}
                        <div className="order-1 lg:order-2 space-y-[10px] md:space-y-[12px] lg:pt-0 lg:max-h-[calc(100dvh-72px-100px)]">
                            {/* Top row: Store (tall left) + Portfolio (top right) + Landing (bottom right) */}
                            <div className="grid grid-cols-2 gap-[10px] md:gap-[12px]">
                                {/* Store — tall left spanning 2 rows */}
                                <div className="row-span-2 group relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-primary/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <img
                                        src="/previews/store.png"
                                        alt="Store Theme Preview"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 min-h-[220px] md:min-h-[260px] lg:h-[260px]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300 backdrop-blur-md border border-blue-400/20 mb-2">
                                            <ShoppingBag className="w-3 h-3" />
                                            Store
                                        </span>
                                        <p className="text-sm font-semibold text-white/90">E-commerce & Retail</p>
                                        <p className="text-xs text-white/50 mt-0.5">Dark minimalist storefront</p>
                                    </div>
                                </div>

                                {/* Portfolio — top right */}
                                <div className="group relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-purple-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <img
                                        src="/previews/portfolio.png"
                                        alt="Portfolio Theme Preview"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 min-h-[100px] md:min-h-[120px] lg:h-[122px]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-purple-500/20 text-purple-300 backdrop-blur-md border border-purple-400/20 mb-1.5">
                                            <Palette className="w-3 h-3" />
                                            Portfolio
                                        </span>
                                        <p className="text-xs font-medium text-white/80">Creative Showcase</p>
                                    </div>
                                </div>

                                {/* Landing — bottom right */}
                                <div className="group relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <img
                                        src="/previews/landing.png"
                                        alt="Landing Page Theme Preview"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 min-h-[100px] md:min-h-[120px] lg:h-[122px]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-400/20 mb-1.5">
                                            <Rocket className="w-3 h-3" />
                                            Landing
                                        </span>
                                        <p className="text-xs font-medium text-white/80">SaaS Launch</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resume — full-width card below the grid */}
                            <div className="group relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-amber-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                <img
                                    src="/previews/resume.png"
                                    alt="Resume Theme Preview"
                                    className="w-full object-cover transition-transform duration-700 group-hover:scale-105 h-[100px] md:h-[120px] lg:h-[120px]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-300 backdrop-blur-md border border-amber-400/20 mb-2">
                                        <FileText className="w-3 h-3" />
                                        Resume
                                    </span>
                                    <p className="text-sm font-semibold text-white/90">Professional CV</p>
                                    <p className="text-xs text-white/50 mt-0.5">Elegant dark theme with gold accents</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                FEATURED THEMES — Premium Grid
               ═══════════════════════════════════════ */}
            <section className="relative py-24 overflow-hidden">
                {/* Section ambient glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.04] blur-[120px] rounded-full pointer-events-none" />

                <div className="container-main relative">
                    {/* Section header */}
                    <div className="flex items-end justify-between mb-12">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-light text-[11px] font-semibold uppercase tracking-widest mb-3">
                                <Sparkles className="w-3 h-3" />
                                Handpicked
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-text-heading">
                                Featured Themes
                            </h2>
                            <p className="text-sm text-text-muted mt-2 max-w-md">
                                Curated collection of our best-rated, most-loved themes — ready to install.
                            </p>
                        </div>
                        <Link
                            href="/themes"
                            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary-light transition-colors duration-300 group"
                        >
                            View all
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {featuredThemes.map((theme: any) => (
                            <ThemeCard key={theme.id} theme={theme} featured />
                        ))}
                    </div>

                    {/* Mobile "View all" link */}
                    <div className="sm:hidden mt-8 text-center">
                        <Link
                            href="/themes"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-light"
                        >
                            View all themes
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                BROWSE BY CATEGORY — Shopify-Style Theme Showcase
               ═══════════════════════════════════════ */}
            <section className="relative py-24 border-t border-white/[0.04]">
                {/* Ambient glow */}
                <div className="absolute top-[20%] left-[-5%] w-[400px] h-[400px] bg-secondary/[0.04] blur-[120px] rounded-full pointer-events-none" />

                <div className="container-main relative">
                    {/* Section header — left-aligned like Shopify */}
                    <div className="mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-text-heading">
                            Top themes
                        </h2>
                        <p className="text-base text-text-muted mt-2 max-w-lg">
                            Fully customizable and regularly updated with the latest features. Pick a category and start building.
                        </p>
                    </div>

                    {/* Theme preview grid — 2 cols on desktop for large previews */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {CATEGORIES.map(cat => (
                            <Link
                                key={cat.slug}
                                href={`/themes?category=${cat.slug}`}
                                className="group block"
                            >
                                {/* Browser-frame preview card */}
                                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/[0.16] transition-all duration-500 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30">
                                    {/* Faux browser chrome */}
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                                        </div>
                                        <div className="flex-1 mx-3">
                                            <div className="max-w-[200px] mx-auto px-3 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
                                                <span className="text-[10px] text-text-subtle font-mono">letbuyy.store/{cat.slug}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Screenshot */}
                                    <div className="relative overflow-hidden aspect-[16/10]">
                                        <img
                                            src={`/previews/${cat.slug}.png`}
                                            alt={`${cat.label} Theme Preview`}
                                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                                        />
                                        {/* Bottom fade */}
                                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
                                    </div>
                                </div>

                                {/* Theme info below the card — like Shopify */}
                                <div className="mt-4 flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-text-heading group-hover:text-primary-light transition-colors duration-300">
                                            {cat.label}
                                        </h3>
                                        <p className="text-sm text-text-muted mt-0.5">{cat.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${cat.color} text-white`}>
                                            {countMap[cat.slug] || 0} themes
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                VALUE PROPOSITIONS — Bento Feature Grid
               ═══════════════════════════════════════ */}
            <section className="relative py-24 border-t border-white/[0.04] overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/[0.04] blur-[120px] rounded-full pointer-events-none" />

                <div className="container-main relative">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-semibold uppercase tracking-widest mb-3">
                            <Sparkles className="w-3 h-3" />
                            Why Choose Us
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-text-heading">
                            Everything You Need to{' '}
                            <span className="gradient-text">Succeed</span>
                        </h2>
                        <p className="text-sm text-text-muted mt-2 max-w-lg mx-auto">
                            Professional themes packed with modern features, optimized for performance, and built for growth.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {VALUE_PROPS.map((prop, i) => (
                            <div
                                key={prop.title}
                                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-500 hover:-translate-y-1"
                            >
                                {/* Icon with gradient accent */}
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${prop.accent} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
                                    <prop.icon className="w-5.5 h-5.5 text-white" />
                                </div>

                                <h3 className="text-base font-semibold text-text-heading mb-2.5">{prop.title}</h3>
                                <p className="text-sm text-text-muted leading-relaxed">{prop.desc}</p>

                                {/* Subtle bottom accent line on hover */}
                                <div className={`absolute bottom-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r ${prop.accent} opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════
                CTA BANNER — Gradient + Glass
               ═══════════════════════════════════════ */}
            <section className="container-main py-24">
                <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-12 md:p-20 text-center">
                    {/* Background gradient layers */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-secondary/[0.08]" />
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] bg-primary/[0.08] rounded-full blur-[100px]" />
                        <div className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] bg-secondary/[0.06] rounded-full blur-[100px]" />
                    </div>
                    {/* Grid pattern */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                        }}
                    />

                    <div className="relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-primary-light text-[11px] font-semibold uppercase tracking-widest mb-6">
                            <Rocket className="w-3 h-3" />
                            Get Started
                        </div>

                        <h2 className="text-3xl md:text-5xl font-bold text-text-heading mb-5 leading-tight">
                            Ready to Build Something{' '}
                            <span className="gradient-text">Amazing</span>?
                        </h2>
                        <p className="text-base text-text-muted max-w-lg mx-auto mb-10 leading-relaxed">
                            Join thousands of businesses using LetBuyy Themes to power their online presence. Start free, scale as you grow.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                href="/themes"
                                className="btn-primary text-base py-3.5 px-10 inline-flex items-center gap-2.5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                            >
                                Get Started — It&apos;s Free
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/pricing"
                                className="btn-secondary text-base py-3.5 px-10 inline-flex items-center gap-2"
                            >
                                Compare Plans
                            </Link>
                        </div>

                        {/* Trust line */}
                        <div className="flex items-center justify-center gap-5 mt-8">
                            {['No credit card required', 'Free tier available', 'Setup in 60s'].map(text => (
                                <span key={text} className="text-xs text-text-subtle flex items-center gap-1.5">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    {text}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
