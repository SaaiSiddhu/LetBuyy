'use client';

import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { InternalPlatformJobRecoveryRequestSchema, type InternalPlatformJob } from '@letbuyy/shared-types';
import { Input, Button, Textarea } from '@letbuyy/ui';

const draftSchema = InternalPlatformJobRecoveryRequestSchema.extend({ reason:z.string().max(1000) });
type Draft = z.infer<typeof draftSchema>;
type ReviewJob = InternalPlatformJob & { request_key:string };

function JobReview({ job, actorId, sessionId }: {job:ReviewJob;actorId:string;sessionId:string}) {
    const storageKey = `letbuyy:job-recovery:v1:${actorId}:${sessionId}:${job.id}`;
    const context = `${storageKey}:${job.source_fingerprint}`;
    const current = useRef(context), alive = useRef(true), busy = useRef(false);
    current.current = context;
    const [draft, setDraft] = useState<Draft>({site_id:job.site_id || '', source_fingerprint:job.source_fingerprint,
        expected_session_id:sessionId, request_key:job.request_key, reason:''});
    const [loaded,setLoaded] = useState(false), [pending,setPending] = useState(false), [error,setError] = useState('');
    useEffect(() => {
        alive.current = true;
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) {
                const parsed = draftSchema.safeParse(JSON.parse(saved));
                if (parsed.success && parsed.data.site_id === job.site_id && parsed.data.expected_session_id === sessionId &&
                    parsed.data.source_fingerprint === job.source_fingerprint) setDraft(parsed.data);
                else sessionStorage.removeItem(storageKey);
            }
        } catch { /* Memory still retains the current form; no credential is stored here. */ }
        setLoaded(true);
        return () => { alive.current = false; };
    },[storageKey,job.site_id,job.source_fingerprint,sessionId]);
    useEffect(() => { if (loaded) { try { sessionStorage.setItem(storageKey,JSON.stringify(draft)); } catch { /* Keep the form in memory. */ } } },[loaded,draft,storageKey]);

    async function submit(event:FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy.current || !loaded || !job.eligible) return;
        const intent = InternalPlatformJobRecoveryRequestSchema.safeParse(draft);
        if (!intent.success) { setError('Provide a clear reason between 8 and 1,000 characters.');return; }
        const captured = context, body = new FormData(event.currentTarget);
        busy.current = true;setPending(true);setError('');
        try {
            const response = await fetch('/api/approvals/request-job-recovery',{method:'POST',body,credentials:'same-origin',
                headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
            const result:unknown = await response.json();
            if (!alive.current || current.current !== captured) return;
            if (!response.ok || !result || typeof result !== 'object' || !('redirect_to' in result) || typeof result.redirect_to !== 'string') {
                setError(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
                    ? result.error : 'Could not confirm the saved review. Retry the same form.');return;
            }
            const target = new URL(result.redirect_to,window.location.origin);
            if (target.origin !== window.location.origin || !/^\/(?:approvals\/[0-9a-f-]{36}|mfa)$/.test(target.pathname)) {
                throw new Error('Unexpected review destination');
            }
            // Preserve the intent until a confirmed response; a same-tab reload
            // or lost reply retries the same key only within this exact sign-in.
            if (target.pathname !== '/mfa') { try { sessionStorage.removeItem(storageKey); } catch { /* The confirmed result still permits navigation. */ } }
            window.location.assign(target.href);
        } catch {
            if (alive.current && current.current === captured) setError('Could not confirm the saved review. Retry the same form; your entries have been retained.');
        } finally {
            busy.current = false;
            if (alive.current && current.current === captured) setPending(false);
        }
    }
    return <article className="rounded-lg border p-4 space-y-3" aria-label={`Recovery job ${job.id}`}>
        <dl className="grid gap-2 text-sm">
            <div><dt>Job</dt><dd className="break-all">{job.id}</dd></div>
            <div><dt>Store</dt><dd>{job.site_id || 'Unavailable'}</dd></div>
            <div><dt>Order</dt><dd>{job.order_id || 'Unavailable'}</dd></div>
            <div><dt>State</dt><dd>{job.status} · {job.attempts} attempts used of {job.max_attempts}</dd></div>
            <div><dt>Original redeemed points</dt><dd>{job.points || 'Unavailable'}</dd></div>
            <div><dt>Value recorded at redemption</dt><dd>{job.value_minor === null ? 'Unavailable' : `${job.value_minor} minor units`}</dd></div>
        </dl>
        {!job.eligible ? <p>This job cannot be retried in its current state. Reload after its source or recovery state has been reviewed.</p> : <>
            <p>Request one additional attempt using this job’s original order and points. A different active platform super admin must review it. Approval alone does not retry the job.</p>
            <form action="/api/approvals/request-job-recovery" method="post" onSubmit={submit} aria-busy={pending} data-enhanced={loaded}>
                <Input unstyled type="hidden" name="job_id" value={job.id} />
                {(['site_id','source_fingerprint','expected_session_id','request_key'] as const).map(name => <Input unstyled key={name} type="hidden" name={name} value={draft[name]} />)}
                <fieldset disabled={pending} className="space-y-3">
                    <Textarea label="Recovery reason" name="reason" value={draft.reason} minLength={8} maxLength={1000} required
                        onChange={event => setDraft({...draft,reason:event.target.value})} />
                    {error && <p role="alert">{error}</p>}
                    <Button type="submit">{pending ? 'Saving review…' : 'Request independent recovery approval'}</Button>
                </fieldset>
            </form>
        </>}
    </article>;
}

export function PlatformJobRecovery({jobs,actorId,sessionId,error,page,hasNext}: {
    jobs:ReviewJob[];actorId:string;sessionId:string;error?:string;page:number;hasNext:boolean;
}) {
    return <section aria-labelledby="platform-job-recovery-title" className="rounded-xl border p-5 space-y-4">
        <h2 id="platform-job-recovery-title">Exhausted loyalty recovery</h2>
        <p>Review point restorations whose retry budget is exhausted. Restoring points remains the responsibility of the existing worker.</p>
        {error ? <p role="alert">Recovery inspection unavailable. {error}</p> : jobs.length === 0 ? <p>No exhausted loyalty jobs found.</p>
            : jobs.map(job => <JobReview key={`${actorId}:${sessionId}:${job.id}:${job.source_fingerprint}`} job={job} actorId={actorId} sessionId={sessionId} />)}
        <nav aria-label="Recovery job pages" className="flex gap-4">
            <a href="/operations">Reload jobs</a>
            {page > 1 && <a href={`/operations?page=${page-1}`}>Previous jobs</a>}
            {hasNext && <a href={`/operations?page=${page+1}`}>Next jobs</a>}
        </nav>
    </section>;
}
