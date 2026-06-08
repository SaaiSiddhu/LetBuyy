'use client';

import { Button, Input } from '@letbuyy/ui';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { Suspense, useState } from 'react';
import ComingSoonRouter from '@/components/coming-soon';
import type { SiteType } from '@/components/coming-soon';

const SITE_TYPES: { type: SiteType; label: string; color: string }[] = [
    { type: 'store', label: 'Store', color: 'rgb(99 102 241)' },
    { type: 'portfolio', label: 'Portfolio', color: 'rgb(17 17 17)' },
    { type: 'resume', label: 'Resume', color: 'rgb(59 130 246)' },
    { type: 'landing', label: 'Landing', color: 'rgb(139 92 246)' },
    { type: 'blog', label: 'Blog', color: 'rgb(249 115 22)' },
];

function ComingSoonPreviewContent() {
    const [active, setActive] = useState<SiteType>('store');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const searchParams = useSearchParams();
    const reason = searchParams.get('reason');
    const gateMessage = searchParams.get('message');
    const isPasswordGate = reason === 'password-required';

    async function submitPassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus('submitting');
        const response = await fetch('/store-access/password', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (response.ok) {
            window.location.reload();
            return;
        }
        setStatus('error');
    }

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
            {/* Page */}
            <ComingSoonRouter
                siteType={active}
                storeName="LetBuyy Demo"
                tagline={gateMessage || 'Preview of the coming soon pages — switch between site types below.'}
            />

            {isPasswordGate ? (
                <form
                    onSubmit={submitPassword}
                    style={{
                        position: 'fixed',
                        left: '50%',
                        bottom: 84,
                        transform: 'translateX(-50%)',
                        display: 'grid',
                        gap: 10,
                        width: 'min(360px, calc(100vw - 32px))',
                        padding: 16,
                        borderRadius: 14,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,.78)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,.14)',
                        boxShadow: '0 12px 40px rgba(0,0,0,.4)',
                    }}
                >
                    <Input
                        unstyled
                        type="password"
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            if (status === 'error') setStatus('idle');
                        }}
                        placeholder="Store password"
                        aria-label="Store password"
                        style={{
                            width: '100%',
                            border: '1px solid rgba(255,255,255,.18)',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,.1)',
                            color: 'white',
                            padding: '10px 12px',
                            outline: 'none',
                        }}
                    />
                    <Button type="submit" disabled={status === 'submitting' || password.length === 0}>
                        {status === 'submitting' ? 'Checking...' : 'Enter store'}
                    </Button>
                    {status === 'error' ? (
                        <p style={{ margin: 0, color: 'rgb(252 165 165)', fontSize: 12 }}>That password did not match.</p>
                    ) : null}
                </form>
            ) : null}

            {/* Switcher Bar */}
            <div style={{
                position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 4, padding: 4, borderRadius: 14, zIndex: 9999,
                background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,.1)',
                boxShadow: '0 12px 40px rgba(0,0,0,.4)',
            }}>
                {SITE_TYPES.map(st => (
                    <Button unstyled
                        key={st.type}
                        onClick={() => setActive(st.type)}
                        style={{
                            padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontFamily: "'Inter',-apple-system,sans-serif",
                            fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                            background: active === st.type ? st.color : 'transparent',
                            color: active === st.type ? 'rgb(255 255 255)' : 'rgba(255,255,255,.5)',
                            transition: 'all .25s ease',
                        }}
                    >{st.label}</Button>
                ))}
            </div>
        </div>
    );
}

export default function ComingSoonPreview() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'rgb(5 5 5)' }} />}>
            <ComingSoonPreviewContent />
        </Suspense>
    );
}
