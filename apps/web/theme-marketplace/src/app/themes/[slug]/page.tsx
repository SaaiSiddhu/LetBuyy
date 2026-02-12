import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star, Download, Heart, ExternalLink, ArrowLeft, Check, ShoppingCart, Globe, Tag, Calendar, User, Package } from 'lucide-react';
import { getThemeBySlug, MOCK_THEMES } from '@/lib/theme-data';
import { formatPrice, formatCount, CATEGORY_LABELS } from '@/lib/utils';
import ThemeCard from '@/components/theme-card';
import type { Metadata } from 'next';

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const theme = getThemeBySlug(slug);
    if (!theme) return { title: 'Theme Not Found' };
    return {
        title: theme.name,
        description: theme.description,
        openGraph: { title: theme.name, description: theme.description, images: [theme.thumbnail_url] },
    };
}

export default async function ThemeDetailPage({ params }: Props) {
    const { slug } = await params;
    const theme = getThemeBySlug(slug);
    if (!theme) notFound();

    const isFree = theme.letbuyy_pricing_type === 'free';
    const similarThemes = MOCK_THEMES.filter(t => t.category === theme.category && t.id !== theme.id).slice(0, 3);

    const INFO_ROWS = [
        { label: 'Category', value: CATEGORY_LABELS[theme.category]?.label || theme.category, icon: Tag },
        { label: 'Version', value: `v${theme.version}`, icon: Package },
        { label: 'Author', value: theme.author_name, icon: User },
        { label: 'Published', value: new Date(theme.published_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), icon: Calendar },
        { label: 'Platforms', value: theme.supported_platforms.join(', '), icon: Globe },
    ];

    return (
        <div className="container-main py-8 md:py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-text-muted mb-8">
                <Link href="/themes" className="hover:text-text-heading transition-colors flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Themes
                </Link>
                <span>/</span>
                <span className="capitalize">{theme.category}</span>
                <span>/</span>
                <span className="text-text-heading">{theme.name}</span>
            </nav>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {/* Left: Screenshots */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Main Image */}
                    <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-border">
                        <Image
                            src={theme.thumbnail_url}
                            alt={theme.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 66vw"
                            priority
                        />
                    </div>

                    {/* Screenshot Thumbnails */}
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {theme.screenshots.map((ss, i) => (
                            <div key={i} className="relative w-28 h-20 rounded-lg overflow-hidden border border-border flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                                <Image src={ss} alt={`${theme.name} screenshot ${i + 1}`} fill className="object-cover" sizes="112px" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Info Panel */}
                <div className="space-y-5">
                    {/* Title */}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-1">{theme.name}</h1>
                        <p className="text-sm text-text-muted">by <span className="text-text-heading">{theme.author_name}</span></p>
                    </div>

                    {/* Rating & Downloads */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-warning fill-warning" />
                            <span className="text-sm font-semibold text-text-heading">{theme.rating}</span>
                            <span className="text-xs text-text-subtle">({theme.review_count} reviews)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-text-subtle">
                            <Download className="w-3.5 h-3.5" />
                            <span className="text-xs">{formatCount(theme.install_count)} installs</span>
                        </div>
                    </div>

                    {/* Price & Actions */}
                    <div className="glass-card p-5 space-y-4" style={{ transform: 'none' }}>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-text-heading">
                                {formatPrice(theme.letbuyy_price_usd)}
                            </p>
                            {!isFree && theme.letbuyy_price_inr > 0 && (
                                <p className="text-xs text-text-subtle mt-1">₹{theme.letbuyy_price_inr.toLocaleString()}</p>
                            )}
                            <p className="text-[11px] text-text-subtle mt-1">
                                {isFree ? 'Free to install on LetBuyy' : 'One-time purchase for LetBuyy'}
                            </p>
                        </div>

                        <Link
                            href={isFree ? '/dashboard' : `/checkout?theme=${theme.slug}`}
                            className="btn-primary w-full text-center py-3 flex items-center justify-center gap-2"
                        >
                            {isFree ? (
                                <>
                                    <Download className="w-4 h-4" />
                                    Install Now
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="w-4 h-4" />
                                    Buy Now
                                </>
                            )}
                        </Link>

                        <div className="flex gap-2">
                            <button className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-1.5 text-sm">
                                <Heart className="w-4 h-4" />
                                Wishlist
                            </button>
                            <a
                                href={theme.demo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-1.5 text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Live Demo
                            </a>
                        </div>
                    </div>

                    {/* Standalone Pricing */}
                    {(theme.wordpress_price_usd > 0 || theme.html_price_usd > 0) && (
                        <div className="glass-card p-4" style={{ transform: 'none' }}>
                            <p className="text-xs font-semibold text-text-heading mb-3 uppercase tracking-wider">Standalone Downloads</p>
                            <div className="space-y-2">
                                {theme.wordpress_price_usd > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">WordPress</span>
                                        <span className="font-medium text-text-heading">{formatPrice(theme.wordpress_price_usd)}</span>
                                    </div>
                                )}
                                {theme.shopify_price_usd > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">Shopify</span>
                                        <span className="font-medium text-text-heading">{formatPrice(theme.shopify_price_usd)}</span>
                                    </div>
                                )}
                                {theme.html_price_usd > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">HTML / CSS</span>
                                        <span className="font-medium text-text-heading">{formatPrice(theme.html_price_usd)}</span>
                                    </div>
                                )}
                                {theme.react_price_usd > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-muted">React</span>
                                        <span className="font-medium text-text-heading">{formatPrice(theme.react_price_usd)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Description & Features */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {/* Description */}
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold mb-4">Overview</h2>
                    <p className="text-text-body leading-relaxed mb-8">{theme.long_description}</p>

                    <h2 className="text-xl font-bold mb-4">Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {theme.features.map(feature => (
                            <div key={feature} className="flex items-center gap-2.5 p-3 rounded-lg bg-surface/50">
                                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-3 h-3 text-success" />
                                </div>
                                <span className="text-sm text-text-body">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Info Sidebar */}
                <div>
                    <h2 className="text-xl font-bold mb-4">Theme Info</h2>
                    <div className="glass-card divide-y divide-border" style={{ transform: 'none' }}>
                        {INFO_ROWS.map(row => (
                            <div key={row.label} className="flex items-center gap-3 px-4 py-3">
                                <row.icon className="w-4 h-4 text-text-subtle flex-shrink-0" />
                                <span className="text-xs text-text-muted flex-shrink-0 w-20">{row.label}</span>
                                <span className="text-sm text-text-heading ml-auto text-right">{row.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Tags */}
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-text-heading mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {theme.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 text-xs rounded-full bg-surface text-text-muted hover:bg-surface-hover transition-colors cursor-pointer">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Color Presets */}
                    {theme.color_presets.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-text-heading mb-3">Color Presets</h3>
                            <div className="space-y-3">
                                {theme.color_presets.map(preset => (
                                    <div key={preset.name} className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            {Object.values(preset.colors).map((color, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: color }} />
                                            ))}
                                        </div>
                                        <span className="text-xs text-text-muted">{preset.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Similar Themes */}
            {similarThemes.length > 0 && (
                <section className="border-t border-border pt-12">
                    <h2 className="text-xl font-bold mb-6">Similar Themes</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {similarThemes.map(t => (
                            <ThemeCard key={t.id} theme={t} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
