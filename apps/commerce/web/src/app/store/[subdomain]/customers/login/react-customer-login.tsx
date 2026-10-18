'use client';

import { useRef, useState } from 'react';
import { Button, Input } from '@letbuyy/ui';
import TurnstileWidget, { type TurnstileHandle } from '@/components/security/turnstile-widget';

const LOGIN_ERRORS: Record<string, string> = {
    missing_fields: 'Enter your email and password.',
    invalid_credentials: 'The email or password is incorrect.',
    rate_limited: 'There have been too many attempts. Please try again later.',
    login_failed: 'Sign-in is temporarily unavailable. Please try again.',
};

export function ReactCustomerLogin(props: {
    storeId: string;
    storeName: string;
    subdomain: string;
    error: string;
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [error, setError] = useState(LOGIN_ERRORS[props.error] || '');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const turnstileRef = useRef<TurnstileHandle>(null);
    const basePath = `/store/${encodeURIComponent(props.subdomain)}`;
    const accountUrl = `${basePath}/account`;

    async function signIn(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/customer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    storeId: props.storeId,
                    turnstileToken,
                }),
            });
            const result = await response.json().catch(() => ({})) as { error?: string; code?: string };
            if (!response.ok) {
                setError(result.code === 'CUSTOMER_AUTH_RATE_LIMITED'
                    ? LOGIN_ERRORS.rate_limited
                    : result.code === 'TURNSTILE_REQUIRED'
                        ? 'Complete the security check and try again.'
                        : response.status === 401
                            ? LOGIN_ERRORS.invalid_credentials
                            : result.error || LOGIN_ERRORS.login_failed);
                setTurnstileToken('');
                turnstileRef.current?.reset();
                return;
            }
            window.location.assign(accountUrl);
        } catch {
            setError('Network error. Check your connection and try again.');
            setTurnstileToken('');
            turnstileRef.current?.reset();
        } finally {
            setBusy(false);
        }
    }

    async function requestReset(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_reset',
                    email,
                    storeId: props.storeId,
                    resetUrl: new URL(`${basePath}/customers/reset-password`, window.location.origin).toString(),
                }),
            });
            if (!response.ok) throw new Error('reset_request_failed');
            setNotice('If an account matches that email, password reset instructions will be sent.');
        } catch {
            setError('Password reset is temporarily unavailable. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
            <section className="w-full space-y-5 rounded-2xl border p-6 shadow-sm">
                <header className="space-y-2">
                    <h1 className="text-2xl font-bold">{resetMode ? 'Reset your password' : `Sign in to ${props.storeName}`}</h1>
                    <p className="text-sm" style={{ color: 'var(--lb-color-text-secondary)' }}>
                        {resetMode ? 'Enter your email to request a secure reset link.' : 'Use your existing password for this store account.'}
                    </p>
                </header>

                {resetMode ? (
                    <form className="space-y-4" onSubmit={requestReset}>
                        <label className="block text-sm font-medium">
                            Email
                            <Input unstyled className="mt-1 w-full rounded-xl border px-3 py-3" type="email" autoComplete="email" maxLength={256} required value={email} onChange={event => setEmail(event.target.value)} />
                        </label>
                        {error && <p className="text-sm" style={{ color: 'var(--lb-color-critical)' }} role="alert">{error}</p>}
                        {notice && <p className="text-sm" role="status">{notice}</p>}
                        <Button unstyled className="w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-60" style={{ background: 'var(--primary)', color: 'white' }} type="submit" disabled={busy}>
                            {busy ? 'Sending…' : 'Send reset link'}
                        </Button>
                        <Button unstyled className="w-full py-2 text-sm underline" type="button" onClick={() => { setResetMode(false); setError(''); setNotice(''); }}>Back to sign in</Button>
                    </form>
                ) : (
                    <form className="space-y-4" onSubmit={signIn}>
                        <label className="block text-sm font-medium">
                            Email
                            <Input unstyled className="mt-1 w-full rounded-xl border px-3 py-3" type="email" autoComplete="email" maxLength={256} required value={email} onChange={event => setEmail(event.target.value)} />
                        </label>
                        <label className="block text-sm font-medium">
                            Password
                            <Input unstyled className="mt-1 w-full rounded-xl border px-3 py-3" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
                        </label>
                        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
                        {error && <p className="text-sm" style={{ color: 'var(--lb-color-critical)' }} role="alert">{error}</p>}
                        <Button unstyled className="w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-60" style={{ background: 'var(--primary)', color: 'white' }} type="submit" disabled={busy}>
                            {busy ? 'Signing in…' : 'Sign in'}
                        </Button>
                        <Button unstyled className="w-full py-2 text-sm underline" type="button" onClick={() => { setResetMode(true); setError(''); setNotice(''); }}>Forgot password?</Button>
                    </form>
                )}

                <div className="space-y-3 border-t pt-4">
                    <a className="block text-center text-sm underline" href={`${basePath}/customers/register`}>Create a store account</a>
                    <a className="block w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold" href={`/api/buyer-auth/start?return_to=${encodeURIComponent(accountUrl)}`}>
                        Continue with LetBuyy
                    </a>
                    <div className="rounded-xl border p-4 text-sm">
                        <p>Have an older store account? Connect it with your verified LetBuyy account.</p>
                        <form className="mt-3" method="post" action="/api/buyer-auth/start">
                            <Input unstyled type="hidden" name="intent" value="link_store_customer" />
                            <Input unstyled type="hidden" name="return_to" value={accountUrl} />
                            <Button unstyled className="w-full rounded-xl border px-4 py-3 font-semibold" type="submit">Connect my store account</Button>
                        </form>
                    </div>
                </div>
            </section>
        </main>
    );
}
