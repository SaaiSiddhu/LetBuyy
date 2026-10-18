'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Input } from '@letbuyy/ui';
import { useWishlist } from '@/context/wishlist-context';

interface Ticket {
    id: string;
    ticket_ref: string | null;
    subject: string | null;
    status: string;
    topic: string | null;
    created_at: string;
    last_agent_message_at: string | null;
}
interface Message { id: string; author_type: string; body: string; created_at: string }
interface Receipt { ticket: Ticket; complaintCopy: { subject: string; body: string; recordedAt: string }; receiptConfirmedAt: string }

export default function SupportClient({ subdomain }: { subdomain: string }) {
    const {
        buyerSessionReady,
        buyerSessionRefreshing,
        buyerSessionRevision,
        buyerSessionUnavailable,
    } = useWishlist();
    const basePath = `/store/${subdomain}`;
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selected, setSelected] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [signedOut, setSignedOut] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [reply, setReply] = useState('');
    const [replying, setReplying] = useState(false);
    const [replyError, setReplyError] = useState('');
    const sessionGeneration = useRef(0);
    const conversationGeneration = useRef(0);
    const sessionState = useRef({ revision: buyerSessionRevision, ready: buyerSessionReady, refreshing: buyerSessionRefreshing, unavailable: buyerSessionUnavailable });
    sessionState.current = { revision: buyerSessionRevision, ready: buyerSessionReady, refreshing: buyerSessionRefreshing, unavailable: buyerSessionUnavailable };

    const isCurrentSession = useCallback((revision: number, generation: number) => {
        const current = sessionState.current;
        return current.ready && !current.refreshing && !current.unavailable
            && current.revision === revision && sessionGeneration.current === generation;
    }, []);

    const clearPrivateState = useCallback(() => {
        setTickets([]);
        setSelected(null);
        setMessages([]);
        setSignedOut(false);
        setLoadError('');
        setSubject('');
        setBody('');
        setSending(false);
        setSendError('');
        setReceipt(null);
        setReply('');
        setReplying(false);
        setReplyError('');
    }, []);

    const loadTickets = useCallback(async (signal: AbortSignal | undefined, revision: number, generation: number) => {
        const canCommit = () => !signal?.aborted && isCurrentSession(revision, generation);
        setLoading(true);
        setLoadError('');
        try {
            const response = await fetch('/api/buyer/support/tickets', { cache: 'no-store', signal });
            if (response.status === 401 || response.status === 403) {
                if (!canCommit()) return;
                setSignedOut(true);
                setTickets([]);
                setSelected(null);
                return;
            }
            if (!response.ok) throw new Error('Your support requests could not be loaded right now.');
            const payload = await response.json() as { tickets?: unknown };
            if (!Array.isArray(payload.tickets)) throw new Error('Your support requests could not be loaded right now.');
            if (!canCommit()) return;
            setSignedOut(false);
            setTickets(payload.tickets as Ticket[]);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            if (!canCommit()) return;
            setLoadError(error instanceof Error ? error.message : 'Your support requests could not be loaded right now.');
        } finally {
            if (canCommit()) setLoading(false);
        }
    }, [isCurrentSession]);

    useEffect(() => {
        const generation = ++sessionGeneration.current;
        const controller = new AbortController();
        conversationGeneration.current += 1;
        clearPrivateState();
        if (buyerSessionRefreshing || !buyerSessionReady) {
            setLoading(true);
        } else if (buyerSessionUnavailable) {
            setLoading(false);
            setLoadError('Your account could not be verified. Support requests are hidden until the session check succeeds.');
        } else {
            void loadTickets(controller.signal, buyerSessionRevision, generation);
        }
        return () => controller.abort();
    }, [buyerSessionReady, buyerSessionRefreshing, buyerSessionRevision, buyerSessionUnavailable, clearPrivateState, loadTickets]);

    const refreshTickets = () => {
        const generation = sessionGeneration.current;
        void loadTickets(undefined, buyerSessionRevision, generation);
    };
    const retrySession = () => window.dispatchEvent(new Event('focus'));

    const openConversation = async (ticket: Ticket) => {
        const revision = buyerSessionRevision;
        const generation = sessionGeneration.current;
        if (!isCurrentSession(revision, generation)) return;
        const conversation = ++conversationGeneration.current;
        setSelected(ticket);
        setMessages([]);
        setReplyError('');
        try {
            const response = await fetch(`/api/buyer/support/tickets/${encodeURIComponent(ticket.id)}/messages`, { cache: 'no-store' });
            if (response.status === 401 || response.status === 403) {
                if (!isCurrentSession(revision, generation) || conversationGeneration.current !== conversation) return;
                setSignedOut(true); setSelected(null); return;
            }
            if (!response.ok) throw new Error('Messages could not be loaded right now.');
            const payload = await response.json() as { messages?: unknown };
            if (!Array.isArray(payload.messages)) throw new Error('Messages could not be loaded right now.');
            if (!isCurrentSession(revision, generation) || conversationGeneration.current !== conversation) return;
            setMessages(payload.messages as Message[]);
        } catch (error) {
            if (!isCurrentSession(revision, generation) || conversationGeneration.current !== conversation) return;
            setReplyError(error instanceof Error ? error.message : 'Messages could not be loaded right now.');
        }
    };

    const submitComplaint = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const revision = buyerSessionRevision;
        const generation = sessionGeneration.current;
        if (sending || !isCurrentSession(revision, generation)) return;
        setSending(true);
        setSendError('');
        setReceipt(null);
        try {
            const response = await fetch('/api/buyer/support/tickets', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ subject, body }), cache: 'no-store',
            });
            const payload = await response.json() as { ticket?: Ticket; complaintCopy?: Receipt['complaintCopy']; receiptConfirmedAt?: string; error?: string };
            if (!isCurrentSession(revision, generation)) return;
            if (response.status === 401 || response.status === 403) { setSignedOut(true); return; }
            if (!response.ok || !payload.ticket || !payload.complaintCopy || !payload.receiptConfirmedAt) throw new Error(payload.error || 'Your support request could not be confirmed. Please try again.');
            const confirmed = { ticket: payload.ticket, complaintCopy: payload.complaintCopy, receiptConfirmedAt: payload.receiptConfirmedAt };
            setReceipt(confirmed);
            setSelected(payload.ticket);
            setMessages([{ id: 'receipt', author_type: 'requester', body: payload.complaintCopy.body, created_at: payload.complaintCopy.recordedAt }]);
            setSubject('');
            setBody('');
            await loadTickets(undefined, revision, generation);
        } catch (error) {
            if (!isCurrentSession(revision, generation)) return;
            setSendError(error instanceof Error ? error.message : 'Your support request could not be sent right now.');
        } finally {
            if (isCurrentSession(revision, generation)) setSending(false);
        }
    };

    const submitReply = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const revision = buyerSessionRevision;
        const generation = sessionGeneration.current;
        if (!selected || replying || !reply.trim() || !isCurrentSession(revision, generation)) return;
        setReplying(true);
        setReplyError('');
        try {
            const response = await fetch(`/api/buyer/support/tickets/${encodeURIComponent(selected.id)}/messages`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ body: reply }), cache: 'no-store',
            });
            const payload = await response.json() as { message?: Message; error?: string };
            if (!isCurrentSession(revision, generation)) return;
            if (response.status === 401 || response.status === 403) { setSignedOut(true); return; }
            if (!response.ok || !payload.message) throw new Error(payload.error || 'Your message could not be sent right now.');
            setMessages((current) => [...current, payload.message!]);
            setReply('');
        } catch (error) {
            if (!isCurrentSession(revision, generation)) return;
            setReplyError(error instanceof Error ? error.message : 'Your message could not be sent right now.');
        } finally {
            if (isCurrentSession(revision, generation)) setReplying(false);
        }
    };

    if (loading || !buyerSessionReady || buyerSessionRefreshing) return <main className="mx-auto max-w-5xl space-y-4 p-6" aria-busy="true"><h1 className="text-2xl font-bold">Support</h1><p role="status">Loading your support requests…</p></main>;
    if (buyerSessionUnavailable) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Support unavailable</h1><p role="alert">Your account could not be verified. Support requests are hidden until the session check succeeds.</p><Button unstyled type="button" onClick={retrySession} className="underline">Try again</Button></main>;
    if (signedOut) return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-2xl font-bold">Sign in for support</h1><p>Your support requests are private to your LetBuyy account.</p><Link className="inline-flex min-h-11 items-center rounded-xl px-4 py-2 font-semibold bg-[var(--primary)] text-[var(--lb-color-text-inverse,_white)]" href={`/api/buyer-auth/start?return_to=${encodeURIComponent(`${basePath}/account/support`)}`}>Continue with LetBuyy</Link></main>;

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm text-[var(--text-secondary)]">Your account</p><h1 className="text-2xl font-bold">Support</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Send a request to the store and keep its response in your LetBuyy account.</p></div>
                <Link href={`${basePath}/account/orders`} className="text-sm font-semibold underline">Back to orders</Link>
            </header>

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
                        <Button unstyled type="submit" disabled={sending || !subject.trim() || !body.trim()} className="min-h-11 rounded-xl px-4 py-2 font-semibold disabled:opacity-50 bg-[var(--primary)] text-[var(--lb-color-text-inverse,_white)]">{sending ? 'Sending…' : 'Send request'}</Button>
                    </form>
                </section>

                <section className="space-y-4 rounded-2xl border p-5 border-[var(--border)]">
                    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your requests</h2><Button unstyled type="button" onClick={refreshTickets} className="text-sm underline">Refresh</Button></div>
                    {loadError ? <div role="alert" className="text-sm"><p>{loadError}</p><Button unstyled type="button" onClick={refreshTickets} className="mt-2 underline">Try again</Button></div>
                        : tickets.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">You have no support requests at this store yet.</p>
                            : <ul className="space-y-2">{tickets.map((ticket) => <li key={ticket.id}><Button unstyled type="button" onClick={() => void openConversation(ticket)} className="w-full rounded-xl border p-3 text-left hover:bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}><span className="block font-medium">{ticket.subject || 'Support request'}</span><span className="mt-1 block text-xs text-[var(--text-secondary)]">{ticket.ticket_ref || ticket.id} · {ticket.status} · {new Date(ticket.created_at).toLocaleDateString('en-IN')}</span></Button></li>)}</ul>}
                    {selected && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">{selected.subject || 'Conversation'}</h3>
                        {replyError && <p role="alert" className="text-sm text-red-700">{replyError}</p>}
                        <ol className="max-h-72 space-y-3 overflow-auto">{messages.map((message) => <li key={message.id} className="rounded-xl bg-[var(--surface)] p-3"><p className="mb-1 text-xs font-semibold">{message.author_type === 'requester' ? 'You' : 'Store support'} · {new Date(message.created_at).toLocaleString('en-IN')}</p><p className="whitespace-pre-wrap text-sm">{message.body}</p></li>)}</ol>
                        <form onSubmit={submitReply} className="space-y-2"><label htmlFor="support-reply" className="block text-sm font-medium">Reply</label><textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={4000} required rows={3} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border)' }} /><Button unstyled type="submit" disabled={replying || !reply.trim()} className="min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 border-[var(--border)]">{replying ? 'Sending…' : 'Send reply'}</Button></form>
                    </div>}
                </section>
            </div>
        </main>
    );
}
