import Link from 'next/link';
import { ShoppingBag, ExternalLink, Download, Star, Calendar, CreditCard } from 'lucide-react';
import { ThemeService } from '@/lib/theme-service';
import { formatPrice } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Purchases' };

export default async function PurchasesPage() {
    const purchases = await ThemeService.getUserPurchases();

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1">My Purchases</h1>
                    <p className="text-sm text-text-muted">{purchases.length} themes purchased</p>
                </div>
                <Link href="/themes" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Browse More
                </Link>
            </div>

            {purchases.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="w-7 h-7 text-text-subtle" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-heading mb-2">No purchases yet</h3>
                    <p className="text-sm text-text-muted mb-4">Browse our theme gallery to find the perfect theme.</p>
                    <Link href="/themes" className="btn-primary text-sm">Browse Themes</Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {purchases.map((purchase: any) => {
                        const theme = purchase.themes || {};
                        const pricePaid = purchase.price_paid_usd ?? purchase.amount_usd ?? 0;
                        const rating = theme.rating_avg ?? theme.rating ?? 0;

                        return (
                            <div key={purchase.id} className="glass-card p-5" style={{ transform: 'none' }}>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    {/* Theme Thumbnail */}
                                    <div
                                        className="w-20 h-14 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                        style={{ backgroundImage: `url(${theme.thumbnail_url || ''})` }}
                                    />

                                    {/* Info */}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-text-heading truncate">{theme.name || 'Unknown Theme'}</h3>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/15 text-success border border-success/20">
                                                {purchase.status || 'completed'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(purchase.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3 h-3 text-warning fill-warning" />
                                                {rating}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Price + Actions */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-sm font-bold text-text-heading">
                                            {pricePaid === 0 ? 'Free' : formatPrice(pricePaid)}
                                        </span>
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/themes/${theme.slug || ''}`}
                                                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                View
                                            </Link>
                                            <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                                                <Download className="w-3 h-3" />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* License Key Row */}
                                {purchase.license_key && (
                                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                                        <span className="text-[10px] text-text-subtle uppercase tracking-wider">License:</span>
                                        <code className="text-xs font-mono text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                                            {purchase.license_key}
                                        </code>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
