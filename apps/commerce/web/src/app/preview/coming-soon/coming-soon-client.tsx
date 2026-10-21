'use client';

import { Button, Input } from '@letbuyy/ui';
import type { FormEvent } from 'react';
import { useState } from 'react';
import ComingSoonRouter from '@/components/coming-soon';
import StorefrontAccessGate from '@/components/StorefrontAccessGate';
import type { SiteType } from '@/components/coming-soon';

const SITE_TYPES: { type: SiteType; label: string }[] = [
    { type: 'store', label: 'Store' },
    { type: 'portfolio', label: 'Portfolio' },
    { type: 'resume', label: 'Resume' },
    { type: 'landing', label: 'Landing' },
    { type: 'blog', label: 'Blog' },
];

type ComingSoonProps = { reason: string | null; message: string | null; storeName: string | null };

export default function ComingSoonPreviewContent({ reason, message: gateMessage, storeName }: ComingSoonProps) {
    const [active, setActive] = useState<SiteType>('store');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'error' | 'unavailable' | 'throttled'>('idle');
    const isPasswordGate = reason === 'password-required';

    async function submitPassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus('submitting');
        try {
            const response = await fetch('/store-access/password', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (response.ok) {
                window.location.reload();
                return;
            }
            setStatus(response.status === 429 ? 'throttled' : response.status >= 500 ? 'unavailable' : 'error');
        } catch {
            setStatus('unavailable');
        }
    }

    if (reason) return <StorefrontAccessGate storeName={storeName || 'This store'} message={gateMessage} passwordProtected={isPasswordGate}>
            {isPasswordGate && (
                <form
                    onSubmit={submitPassword}
                    className="grid gap-3 text-left"
                >
                    <label htmlFor="store-visitor-password" className="text-sm font-medium">Store password</label>
                    <Input
                        unstyled
                        id="store-visitor-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            if (status !== 'idle' && status !== 'submitting') setStatus('idle');
                        }}
                        placeholder="Store password"
                        aria-label="Store password"
                        className="w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-default outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
                    />
                    <Button type="submit" disabled={status === 'submitting' || password.length === 0}>
                        {status === 'submitting' ? 'Checking...' : 'Enter store'}
                    </Button>
                    {status === 'error' || status === 'unavailable' || status === 'throttled' ? (
                        <p role="status" className="m-0 text-xs text-critical">
                            {status === 'unavailable' ? 'Store access is temporarily unavailable. Please try again.'
                                : status === 'throttled' ? 'Too many attempts. Please try again later.'
                                    : 'That password did not match.'}
                        </p>
                    ) : null}
                </form>
            )}
        </StorefrontAccessGate>;

    return (
        <div className="relative h-dvh w-screen overflow-hidden">
            <ComingSoonRouter siteType={active} storeName="LetBuyy Demo" tagline="Preview of the gated storefront pages — switch between site types below." />

            {/* Standalone design preview only; storefront shoppers see their gate. */}
            {!reason ? (<div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-xl border border-line bg-surface p-1 text-default shadow-xl">
                {SITE_TYPES.map(st => (
                    <Button unstyled
                        key={st.type}
                        onClick={() => setActive(st.type)}
                        className={`cursor-pointer whitespace-nowrap rounded-lg border-0 px-3 py-1.5 text-xs font-semibold transition-colors ${active === st.type ? 'bg-primary text-inverse' : 'bg-transparent text-subdued'}`}
                    >{st.label}</Button>
                ))}
            </div>) : null}
        </div>
    );
}
