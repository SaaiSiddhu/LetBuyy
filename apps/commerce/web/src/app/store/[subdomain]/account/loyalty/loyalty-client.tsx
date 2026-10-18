'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Button, ChevronRight } from '@letbuyy/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StorefrontEmptyState, StorefrontListLoadingState } from '@/components/storefront/storefront-states';
import { useWishlist } from '@/context/wishlist-context';

interface LoyaltySummary {
    enrolled: boolean;
    balance: string | null;
    programActive?: boolean;
}

interface LoyaltyEntry {
    id: string;
    entryType: string;
    points: string;
    balanceAfter: string;
    createdAt: string;
}

const POINT_LABELS: Record<string, string> = {
    earned: 'Points earned',
    redeemed: 'Points used',
    refund_credit: 'Points returned',
    expired: 'Points expired',
    adjustment_credit: 'Points added',
    adjustment_debit: 'Points adjusted',
};
const DEBITS = new Set(['redeemed', 'expired', 'adjustment_debit']);
const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function LoyaltyClient({ subdomain: testSubdomain }: { subdomain?: string } = {}) {
    const params = useParams();
    const {
        buyerSessionReady,
        buyerSessionRefreshing,
        buyerSessionRevision,
        buyerSessionUnavailable,
    } = useWishlist();
    const subdomain = testSubdomain ?? params?.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const [summary, setSummary] = useState<LoyaltySummary | null>(null);
    const [entries, setEntries] = useState<LoyaltyEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [signedOut, setSignedOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const currentRevision = useRef(buyerSessionRevision);
    const requestGeneration = useRef(0);
    currentRevision.current = buyerSessionRevision;

    const load = useCallback(async (signal: AbortSignal | undefined, revision: number, generation: number) => {
        const canCommit = () => !signal?.aborted
            && requestGeneration.current === generation
            && currentRevision.current === revision;
        setLoading(true);
        setError(null);
        try {
            const [summaryResponse, historyResponse] = await Promise.all([
                fetch('/api/buyer/loyalty', { cache: 'no-store', signal }),
                fetch('/api/buyer/loyalty/history', { cache: 'no-store', signal }),
            ]);
            if (summaryResponse.status === 401 || historyResponse.status === 401) {
                if (!canCommit()) return;
                setSignedOut(true);
                setSummary(null);
                setEntries([]);
                return;
            }
            if (!summaryResponse.ok || !historyResponse.ok) throw new Error('Rewards are temporarily unavailable. Please try again.');
            const [summaryBody, historyBody] = await Promise.all([
                summaryResponse.json() as Promise<{ enrolled?: unknown; balance?: unknown; programActive?: unknown }>,
                historyResponse.json() as Promise<{ entries?: unknown }>,
            ]);
            if (typeof summaryBody.enrolled !== 'boolean'
                || (summaryBody.enrolled && (typeof summaryBody.balance !== 'string' || typeof summaryBody.programActive !== 'boolean'))
                || (!summaryBody.enrolled && summaryBody.balance !== null)
                || !Array.isArray(historyBody.entries)) throw new Error('Rewards are temporarily unavailable. Please try again.');
            if (!canCommit()) return;
            setSignedOut(false);
            setSummary({ enrolled: summaryBody.enrolled, balance: summaryBody.enrolled ? summaryBody.balance as string : null, ...(summaryBody.enrolled ? { programActive: summaryBody.programActive as boolean } : {}) });
            setEntries(historyBody.entries as LoyaltyEntry[]);
        } catch (cause) {
            if (cause instanceof DOMException && cause.name === 'AbortError') return;
            if (!canCommit()) return;
            setSummary(null);
            setEntries([]);
            setSignedOut(false);
            setError(cause instanceof Error ? cause.message : 'Rewards are temporarily unavailable. Please try again.');
        } finally {
            if (canCommit()) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const generation = ++requestGeneration.current;
        const controller = new AbortController();
        if (buyerSessionRefreshing || !buyerSessionReady) {
            setLoading(true);
            setSummary(null);
            setEntries([]);
            setSignedOut(false);
            setError(null);
        } else if (buyerSessionUnavailable) {
            setLoading(false);
            setSummary(null);
            setEntries([]);
            setSignedOut(false);
            setError('Rewards are temporarily unavailable. Please try again.');
        } else {
            void load(controller.signal, buyerSessionRevision, generation);
        }
        return () => {
            controller.abort();
            if (requestGeneration.current === generation) requestGeneration.current += 1;
        };
    }, [buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable, load]);

    const retry = () => {
        const generation = ++requestGeneration.current;
        void load(undefined, buyerSessionRevision, generation);
    };

    if (loading || !buyerSessionReady || buyerSessionRefreshing) return <StorefrontListLoadingState rows={4} />;

    if (signedOut) {
        return (
            <StorefrontEmptyState
                icon={<Award size={28} aria-hidden="true" />}
                title="Sign in to LetBuyy to view your rewards"
                body="Your points are private to your LetBuyy account at this store."
                actionHref={`/api/buyer-auth/start?return_to=${encodeURIComponent(`${basePath}/account/loyalty`)}`}
                actionLabel="Continue with LetBuyy"
                actionIcon={<Award size={18} aria-hidden="true" />}
            />
        );
    }

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Award size={25} className="text-[var(--primary)]" aria-hidden="true" />
                <h1 className="text-2xl font-bold">My Rewards</h1>
            </div>
            {error && <div role="alert" className="mb-5 rounded-xl border p-4 text-sm border-[var(--border)]">
                {error} <Button unstyled className="ml-2 underline" onClick={retry}>Try again</Button>
            </div>}
            {!error && summary?.enrolled === false && (
                <div className="rounded-2xl border p-6 border-[var(--border)]">
                    <h2 className="text-lg font-semibold">No rewards programme yet</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">This store has not enabled loyalty points.</p>
                </div>
            )}
            {!error && summary?.enrolled === true && (
                <>
                    <section className="rounded-2xl border p-6 border-[var(--border)]" aria-label="Rewards balance">
                        <p className="text-sm font-medium text-[var(--text-secondary)]">Available points</p>
                        <p className="mt-2 text-4xl font-bold" aria-live="polite">{groupDigits(summary.balance || '0')}</p>
                        {!summary.programActive && <p className="mt-3 text-sm" role="status">This store's programme is paused. Your recorded balance remains visible.</p>}
                        {summary.programActive && <p className="mt-3 text-sm text-[var(--text-secondary)]">Your balance is provided by this store's rewards programme.</p>}
                    </section>
                    <section className="mt-8" aria-labelledby="loyalty-history-title">
                        <h2 id="loyalty-history-title" className="mb-3 text-lg font-semibold">Recent activity</h2>
                        {entries.length === 0 ? (
                            <p className="rounded-xl border p-4 text-sm border-[var(--border)] text-[var(--text-secondary)]">No points activity yet.</p>
                        ) : (
                            <ul className="divide-y rounded-2xl border border-[var(--border)]">
                                {entries.map((entry) => {
                                    const debit = DEBITS.has(entry.entryType);
                                    const date = new Date(entry.createdAt);
                                    const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
                                    return <li key={entry.id} className="flex items-center justify-between gap-3 p-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{POINT_LABELS[entry.entryType] || 'Points activity'}</p>
                                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{dateLabel} · Balance {groupDigits(entry.balanceAfter)}</p>
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold" aria-label={`${debit ? 'minus' : 'plus'} ${entry.points} points`}>
                                            {debit ? '−' : '+'}{groupDigits(entry.points)}
                                        </span>
                                    </li>;
                                })}
                            </ul>
                        )}
                    </section>
                </>
            )}
            <Link href={`${basePath}/account`} className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--primary)]">Back to account <ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
    );
}
