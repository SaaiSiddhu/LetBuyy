'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

/** Preserve the submitted intent/key when a response is lost after commit.
 * Transport/presentation only: Gateway still validates the real session, live
 * permissions, independently reviewed payload and atomic effect receipt. */
export function ConsoleApprovalForm({ action, children, className }: {
    action: '/api/approvals/request-mfa-reset' | '/api/approvals/request' | '/api/approvals/request-money' | '/api/approvals/request-trust' | '/api/approvals/enforce-trust' | '/api/approvals/decision' | '/api/approvals/execute';
    children: ReactNode; className?: string;
}) {
    const busy = useRef(false), [pending, setPending] = useState(false), [error, setError] = useState('');
    const [enhanced, setEnhanced] = useState(false);
    useEffect(() => { setEnhanced(true); }, []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current) return;
        const form = event.currentTarget, submitter = (event.nativeEvent as SubmitEvent).submitter;
        const body = new FormData(form, submitter);
        busy.current = true; setPending(true); setError('');
        try {
            const response = await fetch(action, { method: 'POST', body, credentials: 'same-origin',
                headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
            const result: unknown = await response.json();
            if (!result || typeof result !== 'object') throw new Error('Approval response unavailable. Retry the same form.');
            if (!response.ok) {
                setError('error' in result && typeof result.error === 'string' ? result.error : 'Could not confirm the result. Retry the same form.');
                return;
            }
            if (!('redirect_to' in result) || typeof result.redirect_to !== 'string') throw new Error('Approval response unavailable. Retry the same form.');
            const target = new URL(result.redirect_to, window.location.origin);
            if (target.origin !== window.location.origin || !/^\/(approvals|merchants|mfa|login|money-reconciliation|trust-safety)(?:[/?]|$)/.test(target.pathname)) {
                throw new Error('Approval response unavailable. Retry the same form.');
            }
            window.location.assign(target.href);
        } catch {
            setError('Could not confirm the result. Retry the same form; your entries have been retained.');
        } finally { busy.current = false; setPending(false); }
    }
    return <form action={action} method="post" className={className} onSubmit={submit} aria-busy={pending} data-enhanced={enhanced}>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={pending} className="contents">{children}</fieldset>
        {pending && <p role="status">Saving…</p>}
    </form>;
}
