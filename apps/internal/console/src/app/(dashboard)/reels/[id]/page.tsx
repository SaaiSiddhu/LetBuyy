'use client';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Textarea } from '@letbuyy/ui';
import type { ReelReadback, ReelReviewerCommand } from '@letbuyy/api-client';
import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';
import { loadReelReview, reviewReel } from '../actions';

export default function PrivateReelReview() {
    const { id } = useParams<{ id: string }>();
    return <ReelReviewWorkspace key={id} id={id} />;
}
function ReelReviewWorkspace({ id }: { id: string }) {
    const [value, setValue] = useState<ReelReadback | null>(null), [actor, setActor] = useState('');
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState(''), [retry, setRetry] = useState(false);
    const live = useRef(true), generation = useRef(0), inFlight = useRef(false), pending = useRef<ReelReviewerCommand | null>(null), actorSeen = useRef('');
    const load = useCallback(async () => {
        const epoch = ++generation.current; setLoading(true); setError('');
        try {
            const result = await loadReelReview(id);
            if (!live.current || epoch !== generation.current) return;
            if (!result.ok) { setValue(null); setError(result.message); return; }
            if (actorSeen.current && actorSeen.current !== result.actorId) { pending.current = null; setReason(''); setRetry(false); }
            actorSeen.current = result.actorId || '';
            setActor(result.actorId || ''); setValue(result.data);
        } catch { if (live.current && epoch === generation.current) { setValue(null); setError('Private review is unavailable. Retry loading.'); } }
        finally { if (live.current && epoch === generation.current) setLoading(false); }
    }, [id]);
    useEffect(() => {
        live.current = true; void load();
        const focus = () => { if (!inFlight.current) void load(); }; window.addEventListener('focus', focus);
        return () => { live.current = false; generation.current++; window.removeEventListener('focus', focus); };
    }, [id, load]);
    async function act(action: ReelReviewerCommand['action'], same = false) {
        if (!value || !actor || inFlight.current) return;
        inFlight.current = true; setBusy(true); setError(''); const epoch = generation.current;
        if (!same || !pending.current) pending.current = { action, expected_version: value.reel.version, idempotency_key: crypto.randomUUID(), ...(reason ? { reason } : {}) };
        try {
            const result = await reviewReel(id, value.reel.site_id, actor, pending.current);
            if (!live.current || epoch !== generation.current) return;
            if (!result.ok) {
                setError(result.code === 'REEL_INSPECTION_UNAVAILABLE' ? 'Actual private media inspection and rights policy are unavailable. Approval remains disabled.' : result.message);
                const unknown = !result.status || result.status >= 500;
                setRetry(unknown);
                if (!unknown) pending.current = null;
                if (result.code === 'SESSION_CONTEXT_CHANGED' || result.status === 401 || result.status === 403) { setValue(null); setReason(''); pending.current = null; setRetry(false); }
                return;
            }
            pending.current = null; setRetry(false); setReason(''); await load();
        } catch { if (live.current && epoch === generation.current) { setRetry(true); setError('The outcome is unknown. Your exact command and reason are retained; retry the same request.'); } }
        finally { inFlight.current = false; if (live.current) setBusy(false); }
    }
    const assigned = value?.reel.assigned_reviewer_id === actor, waiting = value?.reel.status === 'pending_review';
    return <ConsoleWorkspace eyebrow="Marketplace" title="Review private reel" description="The exact saved revision, matched canonical product and attributable history.">
        <Link href="/reels">Back to queue</Link>{error && <p role="alert">{error}</p>}
        {loading ? <p role="status">Checking reviewer session and revision…</p> : !value ? <Button onClick={() => void load()}>Retry private review</Button> : <>
            <Panel title="Immutable submitted revision">
                <p>Status: {value.reel.status} · version {value.reel.version}</p>
                <p>Caption: {value.revision.selection.caption}</p><p>Fingerprint: {value.revision.fingerprint || 'Draft has no submitted payload'}</p>
                <p>Listing: {value.revision.selection.listing_id || 'Not selected'} · Variant: {value.revision.selection.variant_id || 'None'}</p>
                <p>Media: {value.revision.selection.media_asset_id || 'Not selected'} · Thumbnail: {value.revision.selection.thumbnail_asset_id || 'Not selected'}</p>
                <p>Rights references: {value.revision.selection.rights_evidence_ids.join(', ') || 'None supplied; no rights approval inferred.'}</p>
                <p>Private playback and policy-bound inspection are unavailable. No external embed or generic public URL can substitute for them.</p>
            </Panel>
            <Panel title="Assigned reviewer actions">
                {!value.reel.assigned_reviewer_id && waiting && <Button disabled={busy || retry} onClick={() => void act('claim')}>Claim this revision</Button>}
                <Textarea label="Actionable correction or takedown reason" value={reason} maxLength={1000} disabled={busy || retry} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)} />
                <Button disabled={busy || retry || !assigned || !waiting || reason.trim().length < 8} onClick={() => void act('reject')}>Return for correction</Button>
                <Button disabled={busy || retry || !assigned || !waiting || !value.inspection_available} onClick={() => void act('approve')}>Approve inspected revision</Button>
                {value.reel.status === 'approved' && <Button disabled={busy || retry || !assigned || reason.trim().length < 8} onClick={() => void act('take_down')}>Take down with reason</Button>}
                {retry && <Button disabled={busy} onClick={() => void act('claim', true)}>Retry same request</Button>}
                <Button disabled={busy} onClick={() => { pending.current = null; setRetry(false); void load(); }}>Reload authoritative revision</Button>
                {busy && <p role="status">Saving review…</p>}
            </Panel>
            <Panel title="Attributable review history">{value.events.map((event: ReelReadback['events'][number]) => <p key={event.id}>{event.action} · {event.actor_realm} {event.actor_id} · {event.reason || 'Revision recorded'} · {event.created_at}</p>)}</Panel>
        </>}
    </ConsoleWorkspace>;
}
