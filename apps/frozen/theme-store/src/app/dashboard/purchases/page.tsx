import MarketplaceTaskTitle from '@/components/marketplace-task-title';
import Link from 'next/link';
import { Button, Input, ShoppingBag, ExternalLink, Star, Calendar } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import { formatReviewSummary } from '@/lib/utils';
import type { Metadata } from 'next';
import Image from 'next/image';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'My Purchases' };

type PurchaseTheme = {
    slug?: string;
    name?: string;
    thumbnail_url?: string;
    rating?: number;
    rating_avg?: number;
    review_count?: number;
};

type PurchaseRecord = {
    id?: string;
    themes?: PurchaseTheme;
    price_paid_inr?: number;
    status?: string;
    created_at?: string;
    license_key?: string;
    theme_purchase_receipts?: Array<{
        receipt_number?: string;
        invoice_number?: string;
        license_key?: string;
        amount_inr?: number;
        currency?: string;
    }>;
};

function formatInr(value: number): string {
    return value === 0 ? 'Free' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

async function requestRefundAction(formData: FormData) {
    'use server';

    const slug = formStringValue(formData.get('slug'));
    const purchaseId = formStringValue(formData.get('purchase_id'));
    const reason = formStringValue(formData.get('reason'));

    if (!slug || !purchaseId || reason.length < 3) {
        redirect('/dashboard/purchases?refund=invalid');
    }

    try {
        await ThemeService.requestThemeRefund(slug, { purchase_id: purchaseId, reason });
    } catch {
        redirect('/dashboard/purchases?refund=auth');
    }

    revalidatePath('/dashboard/purchases');
    redirect('/dashboard/purchases?refund=created');
}

export default async function PurchasesPage({ searchParams }: { searchParams?: Promise<{ refund?: string }> }) {
    const params = await searchParams;
    const purchases = await ThemeService.getUserPurchases() as PurchaseRecord[];

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <MarketplaceTaskTitle artwork="library">My Purchases</MarketplaceTaskTitle>
                    <p className="text-sm text-text-muted">{purchases.length} themes purchased</p>
                </div>
                <Link href="/themes" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Browse More
                </Link>
            </div>

            {params?.refund === 'created' && (
                <p className="mb-4 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success" role="status">
                    Refund request saved for review.
                </p>
            )}
            {params?.refund === 'auth' && (
                <p className="mb-4 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
                    Sign in before requesting a refund.
                </p>
            )}
            {params?.refund === 'invalid' && (
                <p className="mb-4 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
                    Add a purchase, theme, and refund reason before submitting.
                </p>
            )}

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
                    {purchases.map((purchase) => {
                        const theme = purchase.themes || {};
                        const receipt = purchase.theme_purchase_receipts?.[0];
                        const pricePaid = receipt?.amount_inr ?? purchase.price_paid_inr ?? 0;
                        const rating = theme.rating_avg ?? theme.rating ?? 0;
                        const reviewCount = theme.review_count ?? 0;
                        const purchaseDate = purchase.created_at ? new Date(purchase.created_at) : null;

                        return (
                            <div key={purchase.id || theme.slug || theme.name} className="glass-card p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    {/* Theme Thumbnail */}
                                    <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
                                        {theme.thumbnail_url ? (
                                            <Image
                                                src={theme.thumbnail_url}
                                                alt={`${theme.name || 'Theme'} thumbnail`}
                                                width={80}
                                                height={56}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : null}
                                    </div>

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
                                                {purchaseDate && Number.isFinite(purchaseDate.getTime())
                                                    ? purchaseDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : 'Date unavailable'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3 h-3 text-warning fill-warning" />
                                                {formatReviewSummary(reviewCount, rating)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Price + Actions */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-sm font-bold text-text-heading">
                                            {formatInr(pricePaid)}
                                        </span>
                                        <div className="flex gap-2">
                                            <Link
                                                href={theme.slug ? `/themes/${theme.slug}` : '/themes'}
                                                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                View
                                            </Link>
                                            {receipt?.receipt_number ? (
                                                <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-subtle">
                                                    {receipt.receipt_number}
                                                </span>
                                            ) : (
                                                <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-subtle">
                                                    Receipt available after checkout
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* License Key Row */}
                                {(receipt?.license_key || purchase.license_key) && (
                                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                                        <span className="text-[10px] text-text-subtle uppercase tracking-wider">License:</span>
                                        <code className="text-xs font-mono text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                                            {receipt?.license_key || purchase.license_key}
                                        </code>
                                    </div>
                                )}

                                {purchase.id && theme.slug && purchase.status !== 'refunded' && (
                                    <form action={requestRefundAction} className="mt-4 grid gap-2 border-t border-border pt-4">
                                        <Input unstyled type="hidden" name="purchase_id" value={purchase.id} />
                                        <Input unstyled type="hidden" name="slug" value={theme.slug} />
                                        <label className="grid gap-1 text-xs font-medium text-text-heading">
                                            Refund reason
                                            <textarea
                                                name="reason"
                                                required
                                                minLength={3}
                                                maxLength={1000}
                                                rows={2}
                                                className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-heading"
                                            />
                                        </label>
                                        <Button unstyled type="submit" className="btn-secondary w-fit px-3 py-2 text-xs">
                                            Request refund review
                                        </Button>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
