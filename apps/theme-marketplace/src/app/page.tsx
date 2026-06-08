import Link from 'next/link';
import Image from 'next/image';
import type { Theme } from '@letbuyy/theme-engine';
import { ArrowRight, Sparkles, Zap, Smartphone, Lock, Globe, Code, ShoppingBag, Palette, FileText, Rocket, Check } from '@letbuyy/ui';
import ThemeCard from '@/components/theme-card';
import { ThemeService } from '@/lib/theme-service';
import MarketplaceUnavailable from '@/components/marketplace-unavailable';

const CATEGORIES = [
    { slug: 'store', label: 'Store Themes', description: 'E-commerce & retail storefronts', icon: ShoppingBag, image: '/previews/store.png', color: 'from-blue-500 to-cyan-400' },
    { slug: 'portfolio', label: 'Portfolio', description: 'Designers & creative showcases', icon: Palette, image: '/previews/portfolio.png', color: 'from-purple-500 to-pink-500' },
    { slug: 'resume', label: 'Resume / CV', description: 'Professional profiles & CVs', icon: FileText, image: '/previews/resume.png', color: 'from-amber-500 to-orange-400' },
    { slug: 'landing', label: 'Landing Pages', description: 'Launch, lead capture, and campaign layouts', icon: Rocket, image: '/previews/landing.png', color: 'from-emerald-500 to-teal-400' },
    { slug: 'saas', label: 'SaaS', description: 'Product-led software and subscription pages', icon: Sparkles, image: '/previews/saas-console-card.png', color: 'from-indigo-500 to-violet-500' },
];

const VALUE_PROPS = [
    { icon: Zap, title: 'Guided install', desc: 'Add an approved theme to a selected LetBuyy store through the marketplace install flow.', accent: 'from-yellow-500 to-amber-500' },
    { icon: Palette, title: 'Editable after install', desc: 'Open installed themes in the merchant editor when your store is ready to customize.', accent: 'from-purple-500 to-pink-500' },
    { icon: Smartphone, title: 'Responsive foundations', desc: 'Themes are designed for storefront, portfolio, resume, landing, and SaaS surfaces.', accent: 'from-blue-500 to-cyan-500' },
    { icon: Lock, title: 'INR checkout', desc: 'Paid theme purchases use provider-verified Razorpay checkout for India-first commerce.', accent: 'from-emerald-500 to-green-500' },
    { icon: Globe, title: 'Storefront runtime', desc: 'Themes render through LetBuyy storefront contracts instead of app-local business logic.', accent: 'from-indigo-500 to-violet-500' },
    { icon: Code, title: 'Governed packages', desc: 'Marketplace uploads are validated and routed through the shared API and theme-engine contracts.', accent: 'from-rose-500 to-red-500' },
];

const TRUST_BADGES = [
    'Free themes available',
    'Per-theme purchase path',
    'Razorpay INR checkout',
    'Store-scoped installs',
];

export default async function HomePage() {
    const categoryCountPromises = CATEGORIES.map(async (cat) => {
        const result = await ThemeService.listThemes({ category: cat.slug, limit: 1 });
        return { slug: cat.slug, count: result.ok ? result.value.total : 0 };
    });
    const [featuredResult, categoryCounts, collections] = await Promise.all([
        ThemeService.listThemes({
            sort: 'rating',
            limit: 4,
        }),
        Promise.all(categoryCountPromises),
        ThemeService.getCollections(),
    ]);
    const featuredThemes = featuredResult.ok ? featuredResult.value.themes as unknown as Theme[] : [];
    const themesUnavailable = !featuredResult.ok;
    const countMap = Object.fromEntries(categoryCounts.map(c => [c.slug, c.count]));
    const liveStats = [
        ...(featuredResult.ok ? [{ label: 'Themes listed', value: String(featuredResult.value.total), icon: Palette }] : []),
        { label: 'Categories', value: String(CATEGORIES.length), icon: Globe },
    ];

    return (
        <>
            {/* ═══════════════════════════════════════
                HERO — Premium Split Layout
               ═══════════════════════════════════════ */}
            <section className="relative overflow-hidden lg:min-h-[calc(100dvh-72px)] lg:flex lg:flex-col">
                {/* ── Background texture ── */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Grid pattern overlay */}
                    <div className="theme-grid-overlay-60 absolute inset-0 opacity-[0.03]" />
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
                                <span className="text-text-heading font-medium">Browse the live catalog and install only when a store is selected.</span>
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
                            {liveStats.length > 0 && (
                                <div className="flex flex-wrap items-center gap-6 lg:gap-8 pt-6 border-t border-white/[0.06]">
                                    {liveStats.map(stat => (
                                    <div key={stat.label} className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--lb-color-surface)]/[0.04] border border-white/[0.06] flex items-center justify-center">
                                            <stat.icon className="w-3.5 h-3.5 text-primary-light" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-text-heading leading-none">{stat.value}</p>
                                            <p className="text-[10px] text-text-subtle mt-0.5">{stat.label}</p>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ─── Right: Bento Grid ─── */}
                        <div className="order-1 lg:order-2 space-y-[10px] md:space-y-[12px] lg:pt-0 lg:max-h-[calc(100dvh-72px-100px)]">
                            {/* Top row: Store (tall left) + Portfolio (top right) + Landing (bottom right) */}
                            <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 md:gap-[12px]">
                                {/* Store — tall left spanning 2 rows */}
                                <div className="row-span-2 group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/[0.08] shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-primary/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <Image
                                        src="/previews/store.png"
                                        alt="Store Theme Preview"
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300 backdrop-blur-md border border-blue-400/20 mb-2">
                                            <ShoppingBag className="w-3 h-3" />
                                            Store
                                        </span>
                                        <p className="text-sm font-semibold text-white/90">E-commerce & Retail</p>
                                        <p className="text-xs text-white/75 mt-0.5">Dark minimalist storefront</p>
                                    </div>
                                </div>

                                {/* Portfolio — top right */}
                                <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-purple-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <Image
                                        src="/previews/portfolio.png"
                                        alt="Portfolio Theme Preview"
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
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
                                <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                    <Image
                                        src="/previews/landing.png"
                                        alt="Landing Page Theme Preview"
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
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
                            <div className="group relative aspect-[16/5] rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/15 hover:shadow-xl hover:shadow-amber-500/10 hover:border-white/[0.14] transition-all duration-500 hover:-translate-y-1">
                                <Image
                                    src="/previews/resume.png"
                                    alt="Resume Theme Preview"
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    sizes="(max-width: 1024px) 100vw, 640px"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-300 backdrop-blur-md border border-amber-400/20 mb-2">
                                        <FileText className="w-3 h-3" />
                                        Resume
                                    </span>
                                    <p className="text-sm font-semibold text-white/90">Professional CV</p>
                                    <p className="text-xs text-white/75 mt-0.5">Elegant dark theme with gold accents</p>
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
                <div className="container-main relative">
                    {/* Section header */}
                    <div className="flex items-end justify-between mb-12">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-text-heading text-[11px] font-semibold uppercase tracking-widest mb-3">
                                <Sparkles className="w-3 h-3" />
                                Handpicked
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-text-heading">
                                Featured Themes
                            </h2>
                            <p className="text-sm text-text-muted mt-2 max-w-md">
                                Themes returned by the live marketplace API. Ratings appear only after review data exists.
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

                    {themesUnavailable ? (
                        <MarketplaceUnavailable />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {featuredThemes.map((theme) => (
                                <ThemeCard key={theme.id} theme={theme} featured />
                            ))}
                        </div>
                    )}

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

            {collections.length > 0 && (
                <section className="relative py-16 border-t border-white/[0.04]">
                    <div className="container-main relative">
                        <div className="mb-8">
                            <h2 className="text-2xl md:text-3xl font-bold text-text-heading">
                                Curated collections
                            </h2>
                            <p className="text-sm text-text-muted mt-2 max-w-md">
                                Data-backed marketplace collections from the theme catalog API.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {collections.slice(0, 3).map((collection) => {
                                const slug = typeof collection.slug === 'string' ? collection.slug : '';
                                const title = typeof collection.title === 'string' ? collection.title : slug;
                                const description = typeof collection.description === 'string' ? collection.description : 'Browse this marketplace collection.';
                                return (
                                    <Link key={slug || title} href={slug ? `/collections/${slug}` : '/themes'} className="glass-card block p-5 transition-colors hover:border-primary/30">
                                        <p className="m-0 text-base font-semibold text-text-heading">{title}</p>
                                        <p className="m-0 mt-2 text-sm text-text-muted">{description}</p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════
                BROWSE BY CATEGORY — Shopify-Style Theme Showcase
               ═══════════════════════════════════════ */}
            <section className="relative py-24 border-t border-white/[0.04]">
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
                            href={`/themes/category/${cat.slug}`}
                                className="group block"
                            >
                                {/* Category preview card */}
                                <div className="relative rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/[0.16] transition-all duration-500 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30">
                                    {/* Screenshot */}
                                    <div className="relative overflow-hidden aspect-[16/10]">
                                        <Image
                                            src={cat.image}
                                            alt={`${cat.label} Theme Preview`}
                                            fill
                                            className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                                            sizes="(max-width: 768px) 100vw, 50vw"
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
                <div className="container-main relative">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-text-heading text-[11px] font-semibold uppercase tracking-widest mb-3">
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
                        {VALUE_PROPS.map((prop) => (
                            <div
                                key={prop.title}
                                className="group relative rounded-2xl border border-white/[0.06] bg-[var(--lb-color-surface)]/[0.02] p-7 hover:border-white/[0.12] hover:bg-[var(--lb-color-surface)]/[0.04] transition-all duration-500 hover:-translate-y-1"
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
                    {/* Background gradient layer */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-secondary/[0.08]" />
                    {/* Grid pattern */}
                    <div className="theme-grid-overlay-40 absolute inset-0 opacity-[0.03]" />

                    <div className="relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--lb-color-surface)]/[0.06] border border-white/[0.08] text-primary-light text-[11px] font-semibold uppercase tracking-widest mb-6">
                            <Rocket className="w-3 h-3" />
                            Get Started
                        </div>

                        <h2 className="text-3xl md:text-5xl font-bold text-text-heading mb-5 leading-tight">
                            Ready to Build Something{' '}
                            <span className="gradient-text">Amazing</span>?
                        </h2>
                        <p className="text-base text-text-muted max-w-lg mx-auto mb-10 leading-relaxed">
                            Browse the live catalog, select a store, and install an approved LetBuyy theme through the governed marketplace flow.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                href="/themes"
                                className="btn-primary text-base py-3.5 px-10 inline-flex items-center gap-2.5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                            >
                                Browse Themes
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
                            {['Free themes available', 'INR checkout for paid themes', 'Install requires a selected store'].map(text => (
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
