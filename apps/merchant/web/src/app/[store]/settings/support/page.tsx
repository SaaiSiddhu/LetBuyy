'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button, Input, Section, Textarea } from '@letbuyy/ui';
import type {
    MerchantSupportTicket,
    MerchantSupportMessage,
} from '@letbuyy/shared-types';
import { SettingsPane } from '@/components/settings/SettingsPane';

type Pending = {
    key: string;
    path: string;
    operation: 'create' | 'reply';
    target_id: string | null;
    body: Record<string, string>;
};
type PageMeta = {
    page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
};
class SupportHttpError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}
function message(error: unknown) {
    return error instanceof Error ? error.message : 'Support is unavailable.';
}
export default function MerchantSupportPage() {
    const { store } = useParams<{ store: string }>(),
        params = useSearchParams(),
        router = useRouter();
    const base = '/api/v1/stores/' + encodeURIComponent(store) + '/support',
        ticket = params.get('ticket');
    const [tickets, setTickets] = useState<MerchantSupportTicket[]>([]),
        [messages, setMessages] = useState<MerchantSupportMessage[]>([]);
    const [current, setCurrent] = useState<MerchantSupportTicket | null>(null),
        [meta, setMeta] = useState<PageMeta | null>(null);
    const [page, setPage] = useState(1),
        [threadPage, setThreadPage] = useState(1),
        [threadMeta, setThreadMeta] = useState<PageMeta | null>(null);
    const [subject, setSubject] = useState(''),
        [body, setBody] = useState(''),
        [error, setError] = useState(''),
        [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false),
        [loading, setLoading] = useState(true),
        [pending, setPending] = useState<Pending | null>(null);
    const [readFailed, setReadFailed] = useState(false);
    const generation = useRef(0),
        submitLock = useRef(false);
    const read = useCallback(
        async (path: string, init?: RequestInit) => {
            const response = await fetch(base + '/' + path, {
                    cache: 'no-store',
                    ...init,
                }),
                payload = await response.json();
            if (!response.ok)
                throw new SupportHttpError(
                    typeof payload.error === 'string'
                        ? payload.error
                        : payload.error?.message || 'Support is unavailable.',
                    response.status,
                );
            return payload;
        },
        [base],
    );
    const load = useCallback(async () => {
        const version = ++generation.current;
        setLoading(true);
        setReadFailed(false);
        setError('');
        setCurrent(null);
        setMessages([]);
        setTickets([]);
        setMeta(null);
        setThreadMeta(null);
        try {
            const list = await read('tickets?page=' + page);
            if (version !== generation.current) return;
            setTickets(list.data);
            setMeta(list.meta);
            if (ticket) {
                const detail = await read(
                    'tickets/' + ticket + '?page=' + threadPage,
                );
                if (version !== generation.current) return;
                setCurrent(detail.data.ticket);
                setMessages(detail.data.messages);
                setThreadMeta(detail.data.message_meta);
            }
        } catch (e) {
            if (version === generation.current) {
                setReadFailed(true);
                setError(message(e));
            }
        } finally {
            if (version === generation.current) setLoading(false);
        }
    }, [read, page, ticket, threadPage]);
    const invalidate = useCallback(() => {
        generation.current++;
    }, []);
    useEffect(() => {
        setPending(null);
        setBody('');
        setSubject('');
        setStatus('');
    }, [store, ticket]);
    useEffect(() => {
        void load();
        return invalidate;
    }, [load, invalidate]); // site/record changes retire prior results and draft
    async function send(intent: Pending) {
        if (submitLock.current) return;
        submitLock.current = true;
        setBusy(true);
        setPending(intent);
        setError('');
        setStatus('Saving request…');
        const version = generation.current;
        try {
            const result = await read(intent.path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': intent.key,
                },
                body: JSON.stringify(intent.body),
            });
            if (version !== generation.current) return;
            setPending(null);
            setBody('');
            setSubject('');
            setStatus(
                'Saved. Replies appear here; email delivery is not implied.',
            );
            if (intent.operation === 'create')
                router.push(
                    `/${encodeURIComponent(store)}/settings/support?ticket=${result.data.ticket.id}`,
                );
            else await load();
        } catch (e) {
            if (version === generation.current) {
                setError(message(e));
                if (e instanceof SupportHttpError && e.status < 500) {
                    setPending(null);
                    setStatus('Request refused. Your draft is retained.');
                } else
                    setStatus(
                        'Outcome not confirmed. Check this request before retrying.',
                    );
            }
        } finally {
            submitLock.current = false;
            setBusy(false);
        }
    }
    async function recover() {
        if (!pending || busy) return;
        setBusy(true);
        const version = generation.current;
        try {
            const result = await read('tickets/recovery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': pending.key,
                },
                body: JSON.stringify({
                    operation: pending.operation,
                    target_id: pending.target_id,
                    key: pending.key,
                }),
            });
            if (version !== generation.current) return;
            if (result.data.state === 'completed') {
                setPending(null);
                setBody('');
                setSubject('');
                setStatus('Saved request recovered.');
                if (pending.operation === 'create') {
                    router.push(
                        `/${encodeURIComponent(store)}/settings/support?ticket=${result.data.result.ticket.id}`,
                    );
                } else await load();
            } else
                setStatus(
                    'No committed result recorded yet. Retry the same saved request safely.',
                );
        } catch (e) {
            if (version === generation.current) setError(message(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <SettingsPane
            store={store}
            title="Support"
            description="Contact support and follow replies for this store."
        >
            {error && <p role="alert">{error}</p>}
            <p role="status" aria-live="polite">
                {status}
            </p>
            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                <Button
                    variant="secondary"
                    onClick={() => void load()}
                    disabled={busy}
                >
                    Refresh tickets
                </Button>
            </div>
            {loading ? (
                <p role="status">Loading support…</p>
            ) : readFailed ? (
                <p>Ticket data is unavailable. Refresh to try again.</p>
            ) : (
                <>
                    <Section
                        variant="grouped"
                        title="Your tickets"
                        aria-label="Support tickets"
                    >
                        {tickets.length === 0 ? (
                            <p>No tickets for this store.</p>
                        ) : (
                            <ul className="space-y-[var(--lb-space-3)]">
                                {tickets.map((t) => (
                                    <li key={t.id}>
                                        <a
                                            className="font-medium underline underline-offset-4"
                                            href={`/${encodeURIComponent(store)}/settings/support?ticket=${t.id}`}
                                        >
                                            {t.ticket_ref}: {t.subject}
                                        </a>{' '}
                                        — {t.status}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                            <Button
                                variant="secondary"
                                disabled={!meta?.has_prev || busy}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous tickets
                            </Button>
                            <span> Page {page} </span>
                            <Button
                                variant="secondary"
                                disabled={!meta?.has_next || busy}
                                onClick={() => setPage(page + 1)}
                            >
                                Next tickets
                            </Button>
                        </div>
                    </Section>
                    <Section
                        variant="grouped"
                        title="Conversation"
                        aria-label="Support conversation"
                    >
                        <h2 className="break-words text-[length:var(--lb-font-size-card-title)] font-semibold">
                            {current ? current.subject : 'New support request'}
                        </h2>
                        {current && (
                            <>
                                <p>Status: {current.status}</p>
                                <ol className="space-y-[var(--lb-space-3)]">
                                    {messages.map((m) => (
                                        <li
                                            key={m.id}
                                            className="border border-[var(--lb-color-border)] p-[var(--lb-space-3)]"
                                        >
                                            <strong>
                                                {m.author_type === 'requester'
                                                    ? 'You'
                                                    : 'Support'}
                                            </strong>{' '}
                                            ·{' '}
                                            {new Date(
                                                m.created_at,
                                            ).toLocaleString()}
                                            <p className="mt-[var(--lb-space-2)] whitespace-pre-wrap break-words">
                                                {m.body}
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                    <Button
                                        variant="secondary"
                                        disabled={!threadMeta?.has_prev}
                                        onClick={() =>
                                            setThreadPage(threadPage - 1)
                                        }
                                    >
                                        Earlier messages
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        disabled={!threadMeta?.has_next}
                                        onClick={() =>
                                            setThreadPage(threadPage + 1)
                                        }
                                    >
                                        Later messages
                                    </Button>
                                    <a
                                        className="font-medium underline underline-offset-4"
                                        href={`/${encodeURIComponent(store)}/settings/support`}
                                    >
                                        New request
                                    </a>
                                </div>
                            </>
                        )}
                        {(!current ||
                            !['resolved', 'closed'].includes(
                                current.status,
                            )) && (
                            <form
                                className="space-y-[var(--lb-space-4)]"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void send({
                                        key: crypto.randomUUID(),
                                        path: current
                                            ? 'tickets/' +
                                              current.id +
                                              '/messages'
                                            : 'tickets',
                                        operation: current ? 'reply' : 'create',
                                        target_id: current?.id || null,
                                        body: current
                                            ? { body }
                                            : {
                                                  subject,
                                                  body,
                                                  topic: 'general',
                                              },
                                    });
                                }}
                            >
                                {!current && (
                                    <Input
                                        label="Subject"
                                        minLength={3}
                                        maxLength={240}
                                        required
                                        value={subject}
                                        onChange={(e) =>
                                            setSubject(e.target.value)
                                        }
                                        disabled={busy || !!pending}
                                    />
                                )}
                                <Textarea
                                    label="Message"
                                    required
                                    maxLength={4000}
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    disabled={busy || !!pending}
                                />
                                <Button
                                    type="submit"
                                    disabled={busy || !!pending}
                                >
                                    {current ? 'Send reply' : 'Create ticket'}
                                </Button>
                            </form>
                        )}
                        {current &&
                            ['resolved', 'closed'].includes(current.status) && (
                                <p>
                                    This ticket is resolved. Start a new request
                                    if you need more help.
                                </p>
                            )}
                        {pending && (
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button
                                    variant="secondary"
                                    onClick={() => void recover()}
                                    disabled={busy}
                                >
                                    Check saved request
                                </Button>
                                <Button
                                    onClick={() => void send(pending)}
                                    disabled={busy}
                                >
                                    Retry same request
                                </Button>
                            </div>
                        )}
                    </Section>
                </>
            )}
        </SettingsPane>
    );
}
