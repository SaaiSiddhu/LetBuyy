'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from '@letbuyy/ui';

export function ResetPasswordForm(props: {
    storeId: string;
    storeName: string;
    email: string;
    token: string;
    queryStoreMatches: boolean;
}) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        // Keep the one-time bearer token out of the address bar and browser history after capture.
        window.history.replaceState(null, '', window.location.pathname);
    }, []);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        if (!props.queryStoreMatches || !props.email || !props.token) {
            setError('This reset link is incomplete or belongs to a different store. Request a new one.');
            return;
        }
        if (password.length < 8 || password.length > 128) {
            setError('Choose a password between 8 and 128 characters.');
            return;
        }
        if (password !== confirmation) {
            setError('The passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: props.email,
                    password,
                    storeId: props.storeId,
                    resetToken: props.token,
                }),
            });
            if (!response.ok) {
                setError(response.status === 400
                    ? 'This reset link is invalid or expired. Request a new one.'
                    : 'Password reset is temporarily unavailable. Please try again.');
                return;
            }
            setComplete(true);
            setPassword('');
            setConfirmation('');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="mx-auto flex min-h-[60vh] max-w-md items-center px-4 py-12">
            <section className="w-full rounded-2xl border p-6 shadow-sm">
                <h1 className="text-2xl font-bold">Reset your {props.storeName} password</h1>
                {complete ? (
                    <div className="mt-4 space-y-4" role="status">
                        <p>Your password has been updated. You can now sign in to this store.</p>
                        <a className="inline-flex rounded-xl px-4 py-2 font-semibold bg-[var(--primary)] text-[white]" href="/customers/login">
                            Continue to sign in
                        </a>
                    </div>
                ) : (
                    <form className="mt-5 space-y-4" onSubmit={submit}>
                        <p className="text-sm text-[var(--lb-color-text-secondary)]">Choose a new password for the account linked to {props.email || 'your email'}.</p>
                        <label className="block text-sm font-medium">
                            New password
                            <Input unstyled autoComplete="new-password" className="mt-1 w-full rounded-xl border px-3 py-2" type="password" minLength={8} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />
                        </label>
                        <label className="block text-sm font-medium">
                            Confirm new password
                            <Input unstyled autoComplete="new-password" className="mt-1 w-full rounded-xl border px-3 py-2" type="password" minLength={8} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                        </label>
                        {error && <p className="text-sm text-[var(--lb-color-critical)]" role="alert">{error}</p>}
                        <Button unstyled className="w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-60 bg-[var(--primary)] text-[white]" type="submit" disabled={submitting || !props.queryStoreMatches}>
                            {submitting ? 'Updating password…' : 'Update password'}
                        </Button>
                        {!props.queryStoreMatches && <p className="text-sm text-[var(--lb-color-critical)]" role="alert">This reset link does not match this store. Request a new link from the store that sent it.</p>}
                    </form>
                )}
            </section>
        </main>
    );
}
