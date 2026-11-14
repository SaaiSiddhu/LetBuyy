'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { unstable_rethrow, useRouter } from 'next/navigation';

/** Retain inputs and stable operation keys when a server action cannot confirm its result. */
export function ConsoleActionForm({ action, children, className }: {
    action: (data: FormData) => Promise<void>; children: ReactNode; className?: string;
}) {
    const router = useRouter();
    const lock = useRef(false);
    const [pending, setPending] = useState(false), [message, setMessage] = useState('');
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (lock.current) return;
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        lock.current = true; setPending(true); setMessage('');
        try { await action(data); setMessage('Saved.'); router.refresh(); }
        catch (error) { unstable_rethrow(error); setMessage('The result could not be confirmed. Your entries are retained. Review the current record before retrying.'); }
        finally { lock.current = false; setPending(false); }
    }
    return <form action={action} onSubmit={submit} className={className} aria-busy={pending}>
        <fieldset disabled={pending} className="contents">{children}</fieldset>
        {pending && <p role="status">Saving…</p>}
        {message && <p role={message === 'Saved.' ? 'status' : 'alert'}>{message}</p>}
    </form>;
}
