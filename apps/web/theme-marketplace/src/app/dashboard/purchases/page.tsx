import Link from 'next/link';
import { ShoppingBag, ExternalLink, Download, Star, Calendar, CreditCard, MoreHorizontal } from 'lucide-react';
import { MOCK_THEMES } from '@/lib/theme-data';
import { formatPrice } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Purchases' };

const PURCHASES = [
    {
        id: 'pur-001',
        theme: MOCK_THEMES[0],
        date: '2026-01-28',
        amount_usd: 0,
        payment_method: 'Free',
        license: 'LBTH-FREE-0001',
        status: 'active' as const,
    },
    {
        id: 'pur-002',
        theme: MOCK_THEMES[1],
        date: '2026-01-15',
        amount_usd: 29,
        payment_method: 'Stripe •••• 4242',
        license: 'LBTH-A4B2-C8D1-E6F3',
        status: 'active' as const,
    },
    {
        id: 'pur-003',
        theme: MOCK_THEMES[2],
        date: '2026-02-05',
        amount_usd: 49,
        payment_method: 'Razorpay UPI',
        license: 'LBTH-G7H9-J2K4-L6M8',
        status: 'active' as const,
    },
];

export default function PurchasesPage() {
    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1">My Purchases</h1>
                    <p className="text-sm text-text-muted">{PURCHASES.length} themes purchased</p>
                </div>
                <Link href="/themes" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Browse More
                </Link>
            </div>

            {/* Purchase Cards */}
            <div className="space-y-4">
                {PURCHASES.map(purchase => (
                    <div key={purchase.id} className="glass-card p-5" style={{ transform: 'none' }}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Theme Thumbnail */}
                            <div
                                className="w-20 h-14 rounded-lg bg-cover bg-center flex-shrink-0 border border-border"
                                style={{ backgroundImage: `url(${purchase.theme.thumbnail_url})` }}
                            />

                            {/* Info */}
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-semibold text-text-heading truncate">{purchase.theme.name}</h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/15 text-success border border-success/20">
                                        {purchase.status}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <CreditCard className="w-3 h-3" />
                                        {purchase.payment_method}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Star className="w-3 h-3 text-warning fill-warning" />
                                        {purchase.theme.rating}
                                    </span>
                                </div>
                            </div>

                            {/* Price + Actions */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-sm font-bold text-text-heading">
                                    {purchase.amount_usd === 0 ? 'Free' : formatPrice(purchase.amount_usd)}
                                </span>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/themes/${purchase.theme.slug}`}
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
                        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                            <span className="text-[10px] text-text-subtle uppercase tracking-wider">License:</span>
                            <code className="text-xs font-mono text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                                {purchase.license}
                            </code>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
