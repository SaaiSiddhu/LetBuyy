'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Input } from '@letbuyy/ui';
import { useWishlist } from '@/context/wishlist-context';
import { clearSupportPending, readSupportPending, saveSupportPending, withSupportPendingLock, supportIntentHash, supportReceipt, type SupportPending, type SupportMutationReceipt } from '@/lib/buyer-support-pending';

interface Ticket { id: string; ticket_ref: string | null; subject: string | null; status: string; topic: string | null; created_at: string; last_agent_message_at: string | null }
interface Message { id: string; author_type: string; body: string; created_at: string }
interface Receipt { ticket: Ticket; complaintCopy: { subject: string; body: string; recordedAt: string }; receiptConfirmedAt: string }
interface ActionResult extends Partial<Receipt> { message?: Message; mutationReceipt?: SupportMutationReceipt; error?: string }
const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(row => [row.id, row])).values()];

export default function SupportClient({ subdomain }: { subdomain: string }) {
    const { buyerSessionId, buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable } = useWishlist();
    const basePath = `/store/${subdomain}`;
    const scope = typeof window === 'undefined' ? subdomain : `${window.location.origin}/${subdomain}`;
    const [tickets, setTickets] = useState<Ticket[]>([]), [selected, setSelected] = useState<Ticket | null>(null), [messages, setMessages] = useState<Message[]>([]);
    const [renderedContext, setRenderedContext] = useState('');
    const [loading, setLoading] = useState(true), [signedOut, setSignedOut] = useState(false), [loadError, setLoadError] = useState('');
    const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [reply, setReply] = useState('');
    const [sending, setSending] = useState(false), [replying, setReplying] = useState(false), [sendError, setSendError] = useState(''), [replyError, setReplyError] = useState('');
    const [receipt, setReceipt] = useState<Receipt | null>(null), [pending, setPending] = useState<SupportPending | null>(null);
    const [pendingError, setPendingError] = useState(''), [storageError, setStorageError] = useState(''), [recovering, setRecovering] = useState(false);
    const [ticketCursor, setTicketCursor] = useState<string | null>(null), [messageCursor, setMessageCursor] = useState<string | null>(null);
    const [listBusy, setListBusy] = useState(false), [messageBusy, setMessageBusy] = useState(false), [replyNotice, setReplyNotice] = useState('');
    const sessionGeneration = useRef(0), conversationGeneration = useRef(0), listGeneration = useRef(0), busy = useRef<number | null>(null);
    const sessionState = useRef({ buyer: buyerSessionId, scope, revision: buyerSessionRevision, ready: buyerSessionReady, refreshing: buyerSessionRefreshing, unavailable: buyerSessionUnavailable });
    sessionState.current = { buyer: buyerSessionId, scope, revision: buyerSessionRevision, ready: buyerSessionReady, refreshing: buyerSessionRefreshing, unavailable: buyerSessionUnavailable };
    const selectedState = useRef(selected); selectedState.current = selected;
    const isCurrentSession = useCallback((revision: number, generation: number, buyer: string, store: string) => {
        const current = sessionState.current;
        return current.ready && !current.refreshing && !current.unavailable && current.buyer === buyer && current.scope === store
            && current.revision === revision && sessionGeneration.current === generation;
    }, []);
    const loadTickets = useCallback(async (signal: AbortSignal | undefined, revision: number, generation: number, buyer: string, store: string, cursor: string | null = null) => {
        const requestGeneration = ++listGeneration.current;
        const current = () => !signal?.aborted && listGeneration.current === requestGeneration && isCurrentSession(revision, generation, buyer, store);
        setListBusy(true); setLoadError('');
        try {
            const query = new URLSearchParams({ pagination: 'cursor', limit: '20' }); if (cursor) query.set('cursor', cursor);
            const response = await fetch(`/api/buyer/support/tickets?${query}`, { headers: { 'x-letbuyy-expected-buyer-id': buyer }, cache: 'no-store', signal });
            if (response.status === 401 || response.status === 403 || response.status === 409) { if (current()) { setSignedOut(true); setTickets([]); setSelected(null); setMessages([]); setSubject(''); setBody(''); setReply(''); setReceipt(null); } return; }
            if (!response.ok) throw Error('Your support requests could not be loaded right now.');
            const payload = await response.json();
            if (!Array.isArray(payload.tickets) || typeof payload.hasMore !== 'boolean' || (payload.hasMore && !payload.nextCursor)) throw Error('Your support requests could not be loaded right now.');
            if (!current()) return;
            setTickets(previous => cursor ? unique([...previous, ...payload.tickets]) : payload.tickets); setTicketCursor(payload.hasMore ? payload.nextCursor : null);
        } catch { if (current()) setLoadError('Your support requests could not be loaded right now.'); }
        finally { if (current()) { setLoading(false); setListBusy(false); } }
    }, [isCurrentSession]);
    useEffect(() => {
        const generation = ++sessionGeneration.current, controller = new AbortController(); ++conversationGeneration.current;
        setRenderedContext(`${buyerSessionId}:${scope}:${buyerSessionRevision}`);
        setTickets([]); setSelected(null); setMessages([]); setSubject(''); setBody(''); setReply(''); setReceipt(null); setPending(null);
        setLoadError(''); setSendError(''); setReplyError(''); setPendingError(''); setStorageError(''); setReplyNotice(''); setSignedOut(false);
        setSending(false); setReplying(false); setRecovering(false); setMessageBusy(false); setListBusy(false); setTicketCursor(null); setMessageCursor(null);
        if (buyerSessionRefreshing || !buyerSessionReady) setLoading(true);
        else if (buyerSessionUnavailable) setLoading(false);
        else if (!buyerSessionId) { setLoading(false); setSignedOut(true); }
        else {
            setLoading(true);
            try { setPending(readSupportPending(window.localStorage, buyerSessionId, scope)); }
            catch { setStorageError('Saved support actions could not be read. Sending is paused to prevent duplicates. Restore browser storage access and reload.'); }
            void loadTickets(controller.signal, buyerSessionRevision, generation, buyerSessionId, scope);
        }
        return () => { controller.abort(); ++sessionGeneration.current; };
    }, [buyerSessionId, buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable, scope, loadTickets]);
    const refreshTickets = () => { if (buyerSessionId) void loadTickets(undefined, buyerSessionRevision, sessionGeneration.current, buyerSessionId, scope); };
    const retrySession = () => window.dispatchEvent(new Event('focus'));
    const readMessages = async (ticket: Ticket, revision: number, generation: number, buyer: string, store: string, conversation: number, cursor: string | null = null) => {
        const current = () => isCurrentSession(revision, generation, buyer, store) && conversationGeneration.current === conversation;
        setMessageBusy(true); setReplyError('');
        try {
            const query = new URLSearchParams({ pagination: 'cursor', limit: '100' }); if (cursor) query.set('cursor', cursor);
            const response = await fetch(`/api/buyer/support/tickets/${ticket.id}/messages?${query}`, { headers: { 'x-letbuyy-expected-buyer-id': buyer }, cache: 'no-store' });
            if ([401,403,409].includes(response.status)) { if (current()) { setSignedOut(true); setSelected(null); setMessages([]); setReply(''); } return; }
            if (!response.ok) throw Error('Messages could not be loaded right now.');
            const payload = await response.json(); if (!Array.isArray(payload.messages) || typeof payload.hasMore !== 'boolean' || (payload.hasMore && !payload.nextCursor)) throw Error('Messages could not be loaded right now.');
            if (!current()) return;
            setMessages(previous => unique<Message>(cursor ? [...previous, ...payload.messages] : payload.messages).sort((a: Message,b: Message) => Date.parse(a.created_at)-Date.parse(b.created_at) || a.id.localeCompare(b.id)));
            setMessageCursor(payload.hasMore ? payload.nextCursor : null);
        } catch { if (current()) setReplyError('Messages could not be loaded right now.'); }
        finally { if (current()) setMessageBusy(false); }
    };
    const openConversation = async (ticket: Ticket) => {
        const buyer = buyerSessionId, generation = sessionGeneration.current, revision = buyerSessionRevision;
        if (!buyer || !isCurrentSession(revision, generation, buyer, scope)) return;
        const conversation = ++conversationGeneration.current; setSelected(ticket); setMessages([]); setMessageCursor(null); setReply(''); setReplyNotice('');
        await readMessages(ticket, revision, generation, buyer, scope, conversation);
    };
    const confirm = async (action: SupportPending, payload: ActionResult, revision: number, generation: number, conversation: number) => {
        const ticket = action.operation === 'create' ? payload.ticket?.id : action.target;
        const message = action.operation === 'reply' ? payload.message?.id : undefined;
        if (!ticket || !supportReceipt(payload.mutationReceipt, action.key, action.operation, ticket, message)) throw Error('The original action could not be confirmed. Keep its saved key and check again.');
        const copy = payload.complaintCopy;
        if (action.operation === 'create' ? !payload.ticket || !copy || !payload.receiptConfirmedAt : !payload.message || payload.message.author_type !== 'requester') throw Error('The original action could not be confirmed.');
        const hash = await supportIntentHash(action.operation, action.target, copy?.subject ?? '', action.operation === 'create' ? copy!.body : payload.message!.body);
        if (!isCurrentSession(revision, generation, action.buyer, action.store)) return;
        if (hash !== action.hash) throw Error('The recorded action does not match this saved intent. Keep the saved action and contact support before retrying.');
        await withSupportPendingLock(action.buyer, action.store, () => {
            if (!isCurrentSession(revision, generation, action.buyer, action.store)) return;
            clearSupportPending(window.localStorage, action);
        });
        if (!isCurrentSession(revision, generation, action.buyer, action.store)) return;
        setPending(null); setPendingError('');
        if (action.operation === 'create') {
            const recorded = payload as Receipt; setReceipt(recorded); setSubject(''); setBody('');
            setSelected(recorded.ticket); setMessages([]); setMessageCursor(null); setReply('');
            const nextConversation = ++conversationGeneration.current;
            void readMessages(recorded.ticket, revision, generation, action.buyer, action.store, nextConversation);
            void loadTickets(undefined, revision, generation, action.buyer, action.store);
        } else if (conversation === conversationGeneration.current && selectedState.current?.id === action.target) {
            setMessages(previous => unique([...previous, payload.message!]).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id))); setReply(''); setReplyNotice('Reply recorded.');
        } else setPendingError('Your saved reply is confirmed. Open its conversation to read it.');
    };
    const submit = async (event: React.FormEvent<HTMLFormElement>, operation: 'create' | 'reply') => {
        event.preventDefault();
        const buyer = buyerSessionId, generation = sessionGeneration.current, revision = buyerSessionRevision, store = scope, conversation = conversationGeneration.current;
        const target = operation === 'reply' ? selected?.id ?? null : null;
        const input = { subject: subject.trim(), body: operation === 'create' ? body.trim() : reply.trim() };
        if (!buyer || storageError || busy.current === generation || (operation === 'reply' && !target) || !input.body || input.body.length > 4000 || (operation === 'create' && (!input.subject || input.subject.length > 200)) || !isCurrentSession(revision, generation, buyer, store)) return;
        busy.current = generation; operation === 'create' ? setSending(true) : setReplying(true); setSendError(''); setReplyError(''); setPendingError('');
        let action: SupportPending | undefined, firstAttempt = false;
        try {
            const hash = await supportIntentHash(operation, target, input.subject, input.body);
            if (!isCurrentSession(revision, generation, buyer, store) || (operation === 'reply' && conversationGeneration.current !== conversation)) return;
            action = await withSupportPendingLock(buyer, store, () => {
                if (!isCurrentSession(revision, generation, buyer, store) || (operation === 'reply' && conversationGeneration.current !== conversation)) return undefined;
                firstAttempt = !readSupportPending(window.localStorage, buyer, store);
                return saveSupportPending(window.localStorage, { version: 1, buyer, store, operation, target, hash, key: `support-${crypto.randomUUID()}` });
            });
            if (!action) return;
            setPending(action);
            if (!isCurrentSession(revision, generation, buyer, store)) return;
            const response = await fetch(`/api/buyer/support/tickets${target ? `/${target}/messages` : ''}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-letbuyy-expected-buyer-id': buyer, 'X-Idempotency-Key': action.key },
                body: JSON.stringify(operation === 'create' ? input : { body: input.body }), cache: 'no-store',
            });
            const payload = await response.json() as ActionResult;
            if (!isCurrentSession(revision, generation, buyer, store)) return;
            if (!response.ok) {
                // A first, definitive validation rejection has no previous ambiguous
                // attempt. All other pending identities survive until confirmed.
                if (response.status === 400 && firstAttempt) { await withSupportPendingLock(buyer, store, () => clearSupportPending(window.localStorage, action!)); if (!isCurrentSession(revision, generation, buyer, store)) return; setPending(null); }
                if ([401,403,409].includes(response.status)) { setSubject(''); setBody(''); setReply(''); retrySession(); }
                throw Error(payload.error || (response.status >= 500 ? 'The result is unknown. Check the saved action before retrying.' : 'The request was refused. Check your account and saved action.'));
            }
            await confirm(action, payload, revision, generation, conversation);
        } catch (error) {
            if (isCurrentSession(revision, generation, buyer, store)) {
                const message = error instanceof Error ? error.message : 'The result is unknown. Check your saved action before retrying.';
                operation === 'create' ? setSendError(message) : setReplyError(message);
            }
        } finally { if (busy.current === generation) busy.current = null; if (isCurrentSession(revision, generation, buyer, store)) { setSending(false); setReplying(false); } }
    };
    const submitComplaint = (event: React.FormEvent<HTMLFormElement>) => submit(event, 'create');
    const submitReply = (event: React.FormEvent<HTMLFormElement>) => submit(event, 'reply');
    const recover = async () => {
        const action = pending, revision = buyerSessionRevision, generation = sessionGeneration.current, conversation = conversationGeneration.current;
        if (!action || busy.current === generation || !isCurrentSession(revision, generation, action.buyer, action.store)) return;
        busy.current = generation; setRecovering(true); setPendingError('');
        try {
            const response = await fetch(`/api/buyer/support/tickets${action.target ? `/${action.target}/messages` : ''}`, { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-letbuyy-expected-buyer-id': action.buyer }, body: JSON.stringify({ action: 'recover', key: action.key }), cache: 'no-store' });
            const payload = await response.json() as ActionResult;
            if (!isCurrentSession(revision, generation, action.buyer, action.store)) return;
            if (!response.ok) {
                if ([401,403,409].includes(response.status)) retrySession();
                throw Error(response.status === 404 ? 'No confirmed result is available yet. Keep this saved action. Check again, or re-enter exactly the original text to retry with the same key.' : payload.error || 'The result could not be checked. Your saved action is kept.');
            }
            await confirm(action, payload, revision, generation, conversation);
        } catch (error) { if (isCurrentSession(revision, generation, action.buyer, action.store)) setPendingError(error instanceof Error ? error.message : 'Your saved action is kept. Check again.'); }
        finally { if (busy.current === generation) busy.current = null; if (isCurrentSession(revision, generation, action.buyer, action.store)) setRecovering(false); }
    };
    if (loading || !buyerSessionReady || buyerSessionRefreshing || renderedContext !== `${buyerSessionId}:${scope}:${buyerSessionRevision}`) return <main className="mx-auto max-w-5xl space-y-4 p-6" aria-busy="true"><h1 className="text-2xl font-bold">Support</h1><p role="status">Loading your support requests…</p></main>;
    if (buyerSessionUnavailable) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Support unavailable</h1><p role="alert">Your account could not be verified. Support requests are hidden until the session check succeeds.</p><Button unstyled type="button" onClick={retrySession} className="underline">Try again</Button></main>;
    if (signedOut) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Sign in for support</h1><p>Your support requests are private to your LetBuyy account.</p><Link className="inline-flex min-h-11 items-center rounded-xl px-4 py-2 font-semibold bg-[var(--primary)] text-[var(--lb-color-text-inverse,_white)]" href={`/api/buyer-auth/start?return_to=${encodeURIComponent(`${basePath}/account/support`)}`}>Continue with LetBuyy</Link></main>;

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm text-[var(--text-secondary)]">Your account</p><h1 className="text-2xl font-bold">Support</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Send a request to the store and keep its response in your LetBuyy account.</p></div>
                <Link href={`${basePath}/account/orders`} className="text-sm font-semibold underline">Back to orders</Link>
            </header>

            {storageError && <p role="alert">{storageError}</p>}
            {pending && <section className="space-y-2 rounded-2xl border p-5" aria-label="Saved support action"><h2 className="font-semibold">Saved action awaiting confirmation</h2><p>Your {pending.operation === 'create' ? 'request' : 'reply'} may already be recorded. Check its original result before sending anything different. Draft text is kept only on this page and is not saved across reloads.</p><Button unstyled type="button" onClick={() => void recover()} disabled={sending || replying || recovering} className="min-h-11 underline">{recovering ? 'Checking saved action…' : 'Check saved action'}</Button>{pendingError && <p role="alert">{pendingError}</p>}</section>}
            {!pending && pendingError && <p role="status">{pendingError}</p>}
            {receipt && <section role="status" aria-live="polite" className="space-y-3 rounded-2xl border p-5 border-[var(--border)]">
                <div><h2 className="text-lg font-semibold">Request received</h2><p className="text-sm">Reference {receipt.ticket.ticket_ref || receipt.ticket.id} · {new Date(receipt.receiptConfirmedAt).toLocaleString('en-IN')}</p></div>
                <div className="rounded-xl bg-[var(--surface)] p-4"><h3 className="text-sm font-semibold">Copy of your request</h3><p className="mt-2 font-medium">{receipt.complaintCopy.subject}</p><p className="mt-1 whitespace-pre-wrap text-sm">{receipt.complaintCopy.body}</p><p className="mt-3 text-xs text-[var(--text-secondary)]">Recorded {new Date(receipt.complaintCopy.recordedAt).toLocaleString('en-IN')}</p></div>
            </section>}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="space-y-4 rounded-2xl border p-5 border-[var(--border)]">
                    <div><h2 className="text-lg font-semibold">New support request</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Your message is saved to this store’s support queue.</p></div>
                    <form onSubmit={submitComplaint} className="space-y-3">
                        <div><label htmlFor="support-subject" className="mb-1 block text-sm font-medium">Subject</label><Input unstyled id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required className="w-full rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)' }} /></div>
                        <div><label htmlFor="support-body" className="mb-1 block text-sm font-medium">Message</label><textarea id="support-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} required rows={6} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border)' }} /><p className="mt-1 text-right text-xs text-[var(--text-secondary)]">{body.length}/4,000</p></div>
                        {sendError && <p role="alert" className="text-sm text-red-700">{sendError}</p>}
                        <Button unstyled type="submit" disabled={sending || replying || recovering || !!storageError || !subject.trim() || !body.trim()} className="min-h-11 rounded-xl px-4 py-2 font-semibold disabled:opacity-50 bg-[var(--primary)] text-[var(--lb-color-text-inverse,_white)]">{sending ? 'Sending…' : 'Send request'}</Button>
                    </form>
                </section>

                <section className="space-y-4 rounded-2xl border p-5 border-[var(--border)]">
                    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your requests</h2><Button unstyled type="button" onClick={refreshTickets} disabled={listBusy} className="text-sm underline">Refresh</Button></div>
                    {loadError ? <div role="alert" className="text-sm"><p>{loadError}</p><Button unstyled type="button" onClick={refreshTickets} className="mt-2 underline">Try again</Button></div>
                        : tickets.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">You have no support requests yet.</p>
                            : <ul className="space-y-2">{tickets.map((ticket) => <li key={ticket.id}><Button unstyled type="button" onClick={() => void openConversation(ticket)} className="w-full rounded-xl border p-3 text-left hover:bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}><span className="block font-medium">{ticket.subject || 'Support request'}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{ticket.ticket_ref || ticket.id} · {ticket.status} · {new Date(ticket.created_at).toLocaleDateString('en-IN')}</span></Button></li>)}</ul>}
                    {ticketCursor && <Button unstyled type="button" disabled={listBusy} className="min-h-11 underline" onClick={() => buyerSessionId && void loadTickets(undefined, buyerSessionRevision, sessionGeneration.current, buyerSessionId, scope, ticketCursor)}>Load older requests</Button>}
                    {selected && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">{selected.subject || 'Conversation'}</h3>
                        {replyError && <p role="alert" className="text-sm text-red-700">{replyError}</p>}
                        <ol className="max-h-72 space-y-3 overflow-auto">{messages.map((message) => <li key={message.id} className="rounded-xl bg-[var(--surface)] p-3"><p className="mb-1 text-xs font-semibold">{message.author_type === 'requester' ? 'You' : 'Store support'} · {new Date(message.created_at).toLocaleString('en-IN')}</p><p className="whitespace-pre-wrap text-sm">{message.body}</p></li>)}</ol>
                        {messageBusy && <p role="status">Loading messages…</p>}
                        {messageCursor && <div><p className="text-sm">More messages are available after this window.</p><Button unstyled type="button" disabled={messageBusy} className="min-h-11 underline" onClick={() => buyerSessionId && void readMessages(selected, buyerSessionRevision, sessionGeneration.current, buyerSessionId, scope, conversationGeneration.current, messageCursor)}>Load later messages</Button></div>}
                        {replyNotice && <p role="status">{replyNotice}</p>}
                        <form onSubmit={submitReply} className="space-y-2"><label htmlFor="support-reply" className="block text-sm font-medium">Reply</label><textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={4000} required rows={3} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border)' }} /><Button unstyled type="submit" disabled={replying || sending || recovering || !!storageError || !reply.trim()} className="min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 border-[var(--border)]">{replying ? 'Sending…' : 'Send reply'}</Button></form>
                    </div>}
                </section>
            </div>
        </main>
    );
}
