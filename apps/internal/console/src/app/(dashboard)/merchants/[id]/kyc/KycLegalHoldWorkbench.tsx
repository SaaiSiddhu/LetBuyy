'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, StatusPill } from '@/components/_local-ui/console-workspace';

export type HoldReceipt = {
    id: string; document_type: string; purpose: string; status: string;
    outcome: string | null; created_at: string; deletion_requested_at: string | null;
    intent_expires_at: string | null; holdable: boolean;
};
export type LegalHold = {
    id: string; receipt_id: string; authority_type: string; authority_reference: string;
    reason: string; review_at: string; expires_at: string;
    released_at: string | null; created_at: string;
};

type CommandResult = { success?: boolean; data?: { accepted?: boolean; hold_id?: string; replayed?: boolean }; error?: string };
const INDIA_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
});

function readableDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? INDIA_DATE_FORMATTER.format(date) + ' IST'
        : 'Unknown date';
}

async function sendCommand(input: Record<string, unknown>) {
    let response: Response;
    try {
        response = await fetch('/api/kyc-holds/action', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
            signal: AbortSignal.timeout(15_000),
        });
    } catch {
        throw new Error('The request outcome is unknown. Retry the same form to check it safely.');
    }
    const result = (await response.json().catch(() => ({}))) as CommandResult;
    if (!response.ok || result.success !== true || result.data?.accepted !== true)
        throw new Error(result.error || 'The hold change could not be confirmed. Retry with the same request.');
    return result;
}

function CreateHoldForm({ siteId, receipts }: { siteId: string; receipts: HoldReceipt[] }) {
    const router = useRouter();
    const key = useRef<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const eligible = receipts.filter(row => row.holdable);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const receiptId = String(values.get('receiptId') || '');
        const review = new Date(`${String(values.get('reviewAt') || '')}+05:30`);
        const expiry = new Date(`${String(values.get('expiresAt') || '')}+05:30`);
        if (!Number.isFinite(review.getTime()) || !Number.isFinite(expiry.getTime())) {
            setError('Enter valid review and expiry dates in India time.'); return;
        }
        key.current ||= crypto.randomUUID();
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await sendCommand({
                action: 'create', siteId, receiptId, requestKey: key.current,
                authorityType: values.get('authorityType'),
                authorityReference: values.get('authorityReference'),
                reason: values.get('reason'),
                reviewAt: review.toISOString(), expiresAt: expiry.toISOString(),
            });
            key.current = null;
            form.reset();
            setMessage(result.data?.replayed ? 'This exact hold was already recorded.' : 'This exact hold was recorded and audited.');
            router.refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'The hold could not be confirmed. Retry the same request.');
        } finally { setBusy(false); }
    }

    return <Panel title="Preserve an exact receipt" description="Only a documented court, statutory, or provider obligation can pause deletion. An unreleased hold remains active after its review date; review it and release it explicitly when the obligation ends.">
        {eligible.length === 0 ? <p className="m-0 text-sm text-[var(--lb-color-text-subdued)]">No holdable receipt is available on this page.</p>
            : <form onSubmit={submit} onChange={() => { key.current = null; setError(''); setMessage(''); }}
                className="grid gap-4" aria-busy={busy}>
                <label className="grid gap-1 text-sm font-medium">Mumbai receipt
                    <select name="receiptId" required className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2">
                        <option value="">Select an exact receipt</option>
                        {eligible.map(row => <option key={row.id} value={row.id}>
                            {row.document_type.replaceAll('_', ' ')} · {row.purpose.replaceAll('_', ' ')} · {row.id}
                        </option>)}
                    </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">Authority type
                        <select name="authorityType" required className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2">
                            <option value="court_order">Court order</option><option value="statutory">Statutory requirement</option>
                            <option value="provider_contract">Provider contract</option>
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium">Authority reference
                        <input name="authorityReference" required minLength={8} maxLength={160} autoComplete="off"
                            className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2" />
                    </label>
                </div>
                <label className="grid gap-1 text-sm font-medium">Reason and exact scope
                    <textarea name="reason" required minLength={8} maxLength={1000} rows={3}
                        className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">Review by (IST, within 30 days)
                        <input type="datetime-local" name="reviewAt" required
                            className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">Authority expiry (IST, within 365 days)
                        <input type="datetime-local" name="expiresAt" required
                            className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2" />
                    </label>
                </div>
                <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">The expiry date triggers review; it does not automatically release or delete evidence.</p>
                <div role="status" aria-live="polite" className="text-sm text-[var(--lb-color-text)]">{message}</div>
                {error ? <p role="alert" className="m-0 text-sm text-[var(--lb-color-danger)]">{error}</p> : null}
                <button type="submit" disabled={busy}
                    className="w-fit rounded-md bg-[var(--lb-color-primary)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                    {busy ? 'Recording hold…' : 'Record exact hold'}
                </button>
            </form>}
    </Panel>;
}

function ReleaseHoldForm({ siteId, hold }: { siteId: string; hold: LegalHold }) {
    const router = useRouter();
    const key = useRef<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const reason = String(new FormData(form).get('reason') || '').trim();
        key.current ||= crypto.randomUUID();
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await sendCommand({ action: 'release', siteId,
                receiptId: hold.receipt_id, holdId: hold.id, requestKey: key.current, reason });
            key.current = null;
            setMessage(result.data?.replayed ? 'This hold was already released.' : 'The release was recorded and audited. Cleanup may resume.');
            router.refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Release could not be confirmed. Retry the same request.');
        } finally { setBusy(false); }
    }
    return <form onSubmit={submit} onChange={() => { key.current = null; setError(''); setMessage(''); }}
        className="mt-3 grid gap-2" aria-busy={busy}>
        <label className="grid gap-1 text-sm font-medium">Release reason
            <textarea name="reason" required minLength={8} maxLength={1000} rows={2}
                className="w-full rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-2" />
        </label>
        <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">Releasing this hold allows the pending exact receipt deletion to resume.</p>
        <div role="status" aria-live="polite" className="text-sm">{message}</div>
        {error ? <p role="alert" className="m-0 text-sm text-[var(--lb-color-danger)]">{error}</p> : null}
        <button type="submit" disabled={busy}
            className="w-fit rounded-md border border-[var(--lb-color-border)] px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
            {busy ? 'Releasing…' : 'Release exact hold'}
        </button>
    </form>;
}

export function KycLegalHoldWorkbench({ siteId, receipts, holds }: {
    siteId: string; receipts: HoldReceipt[]; holds: LegalHold[];
}) {
    return <>
        <Panel title="Mumbai evidence receipts" description="Review the exact document type, purpose, receipt ID, and deletion state before creating a hold. Object keys and document bytes are never shown here.">
            {receipts.length === 0 ? <p className="m-0 text-sm text-[var(--lb-color-text-subdued)]">No Mumbai receipts were found on this page.</p>
                : <ul className="m-0 list-none divide-y divide-[var(--lb-color-border)] p-0">
                    {receipts.map(row => <li key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]">
                        <div><p className="m-0 font-medium">{row.document_type.replaceAll('_', ' ')} · {row.purpose.replaceAll('_', ' ')}</p>
                            <code className="break-all text-xs">{row.id}</code>
                            <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">Created {readableDate(row.created_at)} · Deletion requested {readableDate(row.deletion_requested_at)}</p>
                        </div>
                        <div className="flex items-start gap-2"><StatusPill value={row.status} />
                            <StatusPill value={row.holdable ? 'holdable' : 'unavailable for hold'} /></div>
                    </li>)}
                </ul>}
        </Panel>
        <CreateHoldForm siteId={siteId} receipts={receipts} />
        <Panel title="Legal holds" description="An active hold requires explicit release. Review and expiry dates are escalation points, not automatic release instructions.">
            {holds.length === 0 ? <p className="m-0 text-sm text-[var(--lb-color-text-subdued)]">No legal holds were found on this page.</p>
                : <ul className="m-0 list-none divide-y divide-[var(--lb-color-border)] p-0">
                    {holds.map(hold => <li key={hold.id} className="py-4 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><strong>{hold.authority_type.replaceAll('_', ' ')}</strong>
                            <StatusPill value={hold.released_at ? 'released' : 'active'} /></div>
                        <p className="mb-1 mt-2">{hold.authority_reference} · {hold.reason}</p>
                        <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">Receipt <code className="break-all">{hold.receipt_id}</code></p>
                        <p className="m-0 text-xs text-[var(--lb-color-text-subdued)]">Review {readableDate(hold.review_at)} · Authority expiry {readableDate(hold.expires_at)}
                            {hold.released_at ? ` · Released ${readableDate(hold.released_at)}` : ''}</p>
                        {!hold.released_at ? <ReleaseHoldForm siteId={siteId} hold={hold} /> : null}
                    </li>)}
                </ul>}
        </Panel>
    </>;
}
