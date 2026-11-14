'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Input, Select, Textarea } from '@letbuyy/ui';
import { ConsoleSupportTicketSchema, ConsoleSupportClockSchema, ConsoleSupportAssigneeSchema, SupportTicketPrioritySchema, SupportTicketStatusSchema, SupportTicketEscalationTargetSchema, type ConsoleSupportTicket, type ConsoleSupportClock, type ConsoleSupportAssignee } from '@letbuyy/shared-types';
import { supportSlaPresentation } from '@/lib/support-sla';
import { StatusPill } from '@/components/_local-ui/console-workspace';
type ThreadMessage = {
    id: string;
    author_type: string;
    visibility: string;
    body: string;
    created_at: string;
};
type Meta = {
    page: number;
    has_next: boolean;
    has_prev: boolean;
    total: number;
};
type Intent = {
    key: string;
    operation: 'reply' | 'resolve' | 'assign' | 'escalate';
    method?: 'POST' | 'PATCH';
    path: string;
    target_id: string;
    body: Record<string, string | null>;
};
type SupportQueueTicket = ConsoleSupportTicket;
class SupportHttpError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}
export function SupportDesk() {
    const params = useSearchParams(),
        router = useRouter(),
        ticket = params.get('ticket'),
        site = params.get('site_id') || '';
    const [query, setQuery] = useState(params.get('q') || ''), [messagePage, setMessagePage] = useState(1);
    const page = Number(params.get('page') || 1);
    function setPage(value: number) { const next=new URLSearchParams(params);next.set('page',String(value));router.push('/support?'+next); }
    const [ownershipUnavailable,setOwnershipUnavailable]=useState(false);
    const [manage,setManage]=useState(false),[clocks,setClocks]=useState<ConsoleSupportClock[]>([]),[observedAt,setObservedAt]=useState('');
    const [assignees,setAssignees]=useState<ConsoleSupportAssignee[]>([]),[staffPage,setStaffPage]=useState(1),[staffQuery,setStaffQuery]=useState(''),[staffInput,setStaffInput]=useState(''),[staffMeta,setStaffMeta]=useState<Meta|null>(null),[staffError,setStaffError]=useState('');
    const [owner,setOwner]=useState(''),[priority,setPriority]=useState('normal'),[ownershipReason,setOwnershipReason]=useState(''),[target,setTarget]=useState('engineering'),[escalationReason,setEscalationReason]=useState(''),[replyStatus,setReplyStatus]=useState('pending_customer');
    const [rows, setRows] = useState<SupportQueueTicket[]>([]),
        [meta, setMeta] = useState<Meta | null>(null),
        [threadMeta, setThreadMeta] = useState<Meta | null>(null);
    const [current, setCurrent] = useState<SupportQueueTicket | null>(null),
        [messages, setMessages] = useState<ThreadMessage[]>([]),
        [reply, setReply] = useState(false);
    const [readFailed, setReadFailed] = useState(false);
    const [body, setBody] = useState(''),
        [reason, setReason] = useState(''),
        [visibility, setVisibility] = useState('public');
    const [error, setError] = useState(''),
        [status, setStatus] = useState(''),
        [busy, setBusy] = useState(false),
        [loading, setLoading] = useState(true),
        [pending, setPending] = useState<Intent | null>(null);
    const generation = useRef(0),
        locked = useRef(false);
    const suffix = ['site_id','q','view','status','priority'].map(key=>params.get(key)?'&'+key+'='+encodeURIComponent(params.get(key)!):'').join('');
    const request = useCallback(async (path: string, init?: RequestInit) => {
        const r = await fetch('/api/v1/support/' + path, {
                cache: 'no-store',
                ...init,
            }),
            p = await r.json();
        if (!r.ok)
            throw new SupportHttpError(
                typeof p.error === 'string'
                    ? p.error
                    : p.error?.message || 'Support unavailable',
                r.status,
            );
        return p;
    }, []);
    const load = useCallback(async () => {
        const n = ++generation.current;
        setLoading(true);
        setReadFailed(false);
        setCurrent(null);
        setMessages([]);
        setRows([]);
        setMeta(null);
        setThreadMeta(null);
        setReply(false); setManage(false); setClocks([]);setOwnershipUnavailable(false);
        setError('');
        try {
            const list = await request('tickets?page=' + page + suffix);
            if (n !== generation.current) return;
            setRows(ConsoleSupportTicketSchema.array().parse(list.data));
            setObservedAt(list.observed_at);
            setManage(Boolean(list.capabilities?.manage));
            setOwnershipUnavailable(Boolean(list.capabilities?.can_manage&&!list.capabilities?.ownership_available));
            setMeta(list.meta);
            setReply(Boolean(list.capabilities?.reply));
            if (ticket) {
                const result = await request(
                    'tickets/' + ticket + '?page=' + messagePage,
                );
                if (n !== generation.current) return;
                const selected=ConsoleSupportTicketSchema.parse(result.data.ticket);
                setCurrent(selected);setOwner(selected.assignee_id||'');setPriority(selected.priority);
                setClocks(ConsoleSupportClockSchema.array().max(2).parse(result.data.sla_clocks));
                setMessages(result.data.messages);
                setThreadMeta(result.data.message_meta);
            }
        } catch (e) {
            if (n === generation.current) {
                setReadFailed(true);
                setError(
                    e instanceof Error ? e.message : 'Support unavailable',
                );
            }
        } finally {
            if (n === generation.current) setLoading(false);
        }
    }, [request, page, suffix, ticket, messagePage]);
    const invalidate = useCallback(() => {
        generation.current++;
    }, []);
    useEffect(() => {
        setPending(null);
        setBody('');
        setReason('');
    }, [ticket, site]);
    useEffect(() => {
        void load();
        return invalidate;
    }, [load, invalidate]);
    useEffect(()=>{
        if(!manage){setAssignees([]);setStaffMeta(null);return;}
        let active=true;setStaffError('');
        void request('assignees?page='+staffPage+'&q='+encodeURIComponent(staffQuery)).then(data=>{
            if(active){setAssignees(ConsoleSupportAssigneeSchema.array().parse(data.data));setStaffMeta(data.meta);}
        }).catch(()=>{if(active){setAssignees([]);setStaffMeta(null);setStaffError('Staff lookup unavailable. Retry the search.');}});
        return ()=>{active=false;};
    },[manage,staffPage,staffQuery,request]);
    async function send(intent: Intent) {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setPending(intent);
        setError('');
        const n = generation.current;
        try {
            await request(intent.path, {
                method: intent.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': intent.key,
                },
                body: JSON.stringify(intent.body),
            });
            if (n !== generation.current) return;
            setPending(null);
            setBody('');
            setReason('');setOwnershipReason('');setEscalationReason('');
            setStatus(
                intent.operation==='assign'?'Ownership and priority saved. No merchant notification was sent.':'Saved to the ticket. Notification delivery is separate.',
            );
            await load();
        } catch (e) {
            if (n === generation.current) {
                setError(
                    e instanceof Error ? e.message : 'Support unavailable',
                );
                if (e instanceof SupportHttpError && e.status < 500) {
                    setPending(null);
                    setStatus('Action refused. Draft retained.');
                } else
                    setStatus(
                        'Outcome not confirmed. Check the original request before retrying.',
                    );
            }
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    async function recover() {
        if (!pending || busy) return;
        setBusy(true);
        const version = generation.current;
        try {
            const p = await request('recovery', {
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
            if (p.data.state === 'completed') {
                setPending(null);
                setBody('');
                setReason('');
                setStatus('Original request recovered.');
                await load();
            } else
                setStatus(
                    'No committed result recorded. Retry the same request safely.',
                );
        } catch (e) {
            if (version === generation.current)
                setError(
                    e instanceof Error ? e.message : 'Recovery unavailable',
                );
        } finally {
            setBusy(false);
        }
    }
    function open(id: string) {
        const q = new URLSearchParams(params);
        q.set('ticket', id);
        router.push('/support?' + q);
        setMessagePage(1);
    }
    return (
        <div className={`console-support-desk ${current ? 'has-conversation' : ''}`}>
            <form
                className="console-filterbar console-support-filters"
                onSubmit={(e) => {
                    e.preventDefault();
                    const q = new URLSearchParams(params);
                    q.set('q', query);
                    q.delete('ticket');q.set('page','1');
                    for(const key of ['view','status','priority']){const value=String(new FormData(e.currentTarget).get(key)||'');if(value)q.set(key,value);else q.delete(key);}
                    router.push('/support?' + q);

                }}
            >
                <Input
                    label="Search tickets"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={160}
                />
                <Select key={'view-'+params.get('view')} name="view" label="Queue view" defaultValue={params.get('view')||'all'} options={[{value:'all',label:'All tickets'},{value:'mine',label:'My tickets'},{value:'unassigned',label:'Unassigned active tickets'},{value:'overdue',label:'Overdue active tickets'}]} />
                <Select key={'status-'+params.get('status')} name="status" label="Ticket status" defaultValue={params.get('status')||''} options={[{value:'',label:'All statuses'},...SupportTicketStatusSchema.options.map(value=>({value,label:value.replaceAll('_',' ')}))]} />
                <Select key={'priority-'+params.get('priority')} name="priority" label="Ticket priority" defaultValue={params.get('priority')||''} options={[{value:'',label:'All priorities'},...SupportTicketPrioritySchema.options.map(value=>({value,label:value}))]} />
                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button type="submit">Search</Button>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={() => void load()}
                    >
                        Refresh
                    </Button>
                </div>
            </form>
            {error && <p role="alert">{error}</p>}
            <p role="status" aria-live="polite">
                {status}
            </p>
            {loading ? (
                <p>Loading support…</p>
            ) : readFailed ? (
                <p>Ticket data is unavailable. Refresh to try again.</p>
            ) : (
                <>
                    <section
                        className="console-support-queue space-y-[var(--lb-space-3)]"
                        aria-label="Ticket queue"
                    >
                        <p>{meta?.total ?? 'Unknown'} matching tickets</p>
                        <ul className="space-y-[var(--lb-space-2)]">
                            {rows.map((t) => (
                                <li key={t.id} className="console-ticket-row" data-selected={current?.id === t.id}>
                                    <Button
                                        variant="ghost"
                                        className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left"
                                        aria-current={current?.id === t.id ? 'true' : undefined}
                                        onClick={() => open(t.id)}
                                    >
                                        {t.ticket_ref}: {t.subject}
                                    </Button>
                                    <span className="text-xs text-subdued">{t.priority} · {t.assignee_id?'Assigned':'Unassigned'}</span>
                                    <StatusPill value={t.status} />
                                </li>
                            ))}
                        </ul>
                        {rows.length === 0 && <p>No matching tickets.</p>}
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                variant="secondary"
                                disabled={!meta?.has_prev}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous tickets
                            </Button>
                            <Button
                                variant="secondary"
                                disabled={!meta?.has_next}
                                onClick={() => setPage(page + 1)}
                            >
                                Next tickets
                            </Button>
                        </div>
                    </section>
                    {current && (
                        <section
                            className="console-support-conversation space-y-[var(--lb-space-3)]"
                            aria-label="Support conversation"
                        >
                            <h2 className="break-words text-[length:var(--lb-font-size-card-title)] font-semibold">
                                {current.subject}
                            </h2>
                            <p className="flex flex-wrap items-center gap-[var(--lb-space-2)] text-sm text-subdued">
                                {current.ticket_ref} <StatusPill value={current.status} />
                            </p>
                            {current.site_id && (
                                <a
                                    className="inline-block font-medium underline underline-offset-4"
                                    href={'/merchants/' + current.site_id}
                                >
                                    Open merchant
                                </a>
                            )}
                            <section aria-label="Response and resolution deadlines" className="console-support-deadlines">
                                <h3>Response and resolution deadlines</h3>
                                {clocks.length===0?<p>Deadline evidence unavailable for this ticket.</p>:clocks.map(clock=>{
                                    const state=supportSlaPresentation(clock,observedAt);
                                    return <div key={clock.id}><strong>{clock.clock_type==='first_response'?'First response':'Resolution'}</strong> <StatusPill value={state.label} tone={state.tone} />
                                        <p>Due {new Date(clock.due_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
                                        {clock.satisfied_at&&<p>Completed {new Date(clock.satisfied_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>}</div>;
                                })}
                                <p className="text-xs text-subdued">Recorded deadlines · checked {observedAt?new Date(observedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'unknown'} IST. Refresh to check again.</p>
                            </section>
                            {ownershipUnavailable&&<p role="status">Ownership controls are temporarily unavailable. Refresh to check again.</p>}
                            {manage&&!['resolved','closed'].includes(current.status)&&<form aria-label="Ticket ownership and priority" className="console-support-management" onSubmit={event=>{
                                event.preventDefault();void send({key:crypto.randomUUID(),operation:'assign',method:'PATCH',target_id:current.id,path:'tickets/'+current.id+'/assign',body:{assignee_id:owner||null,priority,expected_updated_at:current.updated_at,reason:ownershipReason}});
                            }}>
                                <h3>Owner and priority</h3>
                                <Input label="Find platform staff" value={staffInput} maxLength={100} onChange={event=>setStaffInput(event.target.value)} /><Button type="button" variant="secondary" onClick={()=>{setStaffPage(1);setStaffQuery(staffInput);}}>Search staff</Button>
                                {staffError&&<p role="alert">{staffError}</p>}
                                <Select label="Assigned teammate" value={owner} onChange={event=>setOwner(event.target.value)} disabled={busy||!!pending} options={[
                                    {value:'',label:'Unassigned'},...(current.assignee_id&&!assignees.some(person=>person.id===current.assignee_id)?[{value:current.assignee_id,label:'Current owner · '+current.assignee_id}]:[]),
                                    ...assignees.map(person=>({value:person.id,label:person.full_name||person.email||person.id}))]} />
                                <div className="flex gap-3"><Button type="button" variant="secondary" disabled={!staffMeta?.has_prev} onClick={()=>setStaffPage(staffPage-1)}>Previous staff</Button><Button type="button" variant="secondary" disabled={!staffMeta?.has_next} onClick={()=>setStaffPage(staffPage+1)}>More staff</Button></div>
                                <Select label="New priority" value={priority} onChange={event=>setPriority(event.target.value)} disabled={busy||!!pending} options={SupportTicketPrioritySchema.options.map(value=>({value,label:value}))} />
                                <Textarea label="Ownership reason" value={ownershipReason} onChange={event=>setOwnershipReason(event.target.value)} minLength={8} maxLength={1000} required disabled={busy||!!pending} />
                                <Button type="submit" disabled={busy||!!pending||!!staffError}>Save owner and priority</Button>
                            </form>}
                            {reply&&!['resolved','closed'].includes(current.status)&&<div className="console-support-management">
                                <Select label="Escalation team" value={target} onChange={event=>setTarget(event.target.value)} options={SupportTicketEscalationTargetSchema.options.map(value=>({value,label:value.replaceAll('_',' ')}))} disabled={busy||!!pending} />
                                <Textarea label="Escalation reason" value={escalationReason} onChange={event=>setEscalationReason(event.target.value)} minLength={8} maxLength={1000} disabled={busy||!!pending} /><Button variant="secondary" disabled={busy||!!pending||escalationReason.trim().length<8} onClick={()=>void send({key:crypto.randomUUID(),operation:'escalate',target_id:current.id,path:'tickets/'+current.id+'/escalate',body:{target,reason:escalationReason}})}>Escalate ticket</Button>
                            </div>}
                            <ol className="space-y-[var(--lb-space-3)]">
                                {messages.map((m) => (
                                    <li
                                        key={m.id}
                                        className="console-message"
                                        data-visibility={m.visibility}
                                    >
                                        <strong>
                                            {m.visibility === 'internal'
                                                ? 'Internal note'
                                                : m.author_type === 'requester'
                                                  ? 'Requester'
                                                  : 'Public reply'}
                                        </strong>
                                        <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</time>
                                        <p className="mt-[var(--lb-space-2)] whitespace-pre-wrap break-words">
                                            {m.body}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button
                                    variant="secondary"
                                    disabled={!threadMeta?.has_prev}
                                    onClick={() =>
                                        setMessagePage(messagePage - 1)
                                    }
                                >
                                    Earlier messages
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={!threadMeta?.has_next}
                                    onClick={() =>
                                        setMessagePage(messagePage + 1)
                                    }
                                >
                                    Later messages
                                </Button>
                            </div>
                            {reply &&
                                !['resolved', 'closed'].includes(
                                    current.status,
                                ) && (
                                    <form
                                        className="space-y-[var(--lb-space-4)]"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            void send({
                                                key: crypto.randomUUID(),
                                                operation: 'reply',
                                                target_id: current.id,
                                                path:
                                                    'tickets/' +
                                                    current.id +
                                                    '/messages',
                                                body: {
                                                    body,
                                                    reason,
                                                    visibility,
                                                    ...(visibility==='public'?{status:replyStatus}:{}),
                                                },
                                            });
                                        }}
                                    >
                                        <Select
                                            label="Audience"
                                            id="support-audience"
                                            value={visibility}
                                            onChange={(e) => {setVisibility(e.target.value);setReplyStatus('pending_customer');}}
                                            disabled={busy || !!pending}
                                            options={[
                                                {
                                                    value: 'public',
                                                    label: 'Public reply to requester',
                                                },
                                                {
                                                    value: 'internal',
                                                    label: 'Internal note — operators only',
                                                },
                                            ]}
                                        />
                                        <Textarea
                                            label={
                                                visibility === 'public'
                                                    ? 'Public reply'
                                                    : 'Internal note'
                                            }
                                            value={body}
                                            onChange={(e) =>
                                                setBody(e.target.value)
                                            }
                                            maxLength={8000}
                                            required
                                            disabled={busy || !!pending}
                                        />
                                        <Input
                                            label="Reason / resolution explanation"
                                            value={reason}
                                            onChange={(e) =>
                                                setReason(e.target.value)
                                            }
                                            minLength={8}
                                            maxLength={1000}
                                            required
                                            disabled={busy || !!pending}
                                        />
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            {visibility==='public'&&<Select label="After replying" value={replyStatus} onChange={event=>setReplyStatus(event.target.value)} options={[{value:'pending_customer',label:'Waiting for merchant'},{value:'pending_internal',label:'Waiting for our team'},{value:'open',label:'Open'}]} disabled={busy||!!pending} />}
                                            <Button
                                                type="submit"
                                                disabled={busy || !!pending}
                                            >
                                                {visibility === 'public'
                                                    ? 'Send public reply'
                                                    : 'Save internal note'}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                type="button"
                                                disabled={
                                                    busy ||
                                                    !!pending ||
                                                    reason.trim().length < 8
                                                }
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Resolve ' +
                                                                current.ticket_ref +
                                                                '? This does not complete any payment or privacy action.',
                                                        )
                                                    )
                                                        void send({
                                                            key: crypto.randomUUID(),
                                                            operation:
                                                                'resolve',
                                                            target_id:
                                                                current.id,
                                                            path:
                                                                'tickets/' +
                                                                current.id +
                                                                '/resolve',
                                                            body: {
                                                                reason,
                                                                resolution_note:
                                                                    reason,
                                                            },
                                                        });
                                                }}
                                            >
                                                Resolve ticket
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            {!reply && (
                                <p>
                                    Read-only access. Reply permission is
                                    required for changes.
                                </p>
                            )}
                        </section>
                    )}
                    {pending && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                disabled={busy}
                                onClick={() => void recover()}
                            >
                                Check saved action
                            </Button>
                            <Button
                                disabled={busy}
                                onClick={() => void send(pending)}
                            >
                                Retry same action
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
