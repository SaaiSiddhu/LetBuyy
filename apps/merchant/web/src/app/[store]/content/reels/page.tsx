'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Banner, Button, Card, Input, Section } from '@letbuyy/ui'
import type { ReelDraftSelection, ReelMerchantCommand, ReelReadback, ReelReviewPage } from '@letbuyy/api-client'
import { ReelMerchantCommandSchema } from '@letbuyy/cms-core'
import { PrivateReelIntake } from '@/components/reels/PrivateReelIntake'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'

const emptySelection = (): ReelDraftSelection => ({ media_asset_id: null, listing_id: null, variant_id: null, thumbnail_asset_id: null, caption: '', rights_evidence_ids: [] })
export default function ReelsPage() {
    const { store } = useParams<{ store: string }>(), { actorId } = useMerchantSecurityContext(store)
    return <ReelWorkspace key={`${actorId}:${store}`} store={store} actorId={actorId} />
}
function ReelWorkspace({ store, actorId }: { store: string; actorId: string }) {
    const endpoint = `/api/stores/${encodeURIComponent(store)}/reels`
    const [page, setPage] = useState<ReelReviewPage | null>(null), [detail, setDetail] = useState<ReelReadback | null>(null)
    const [selection, setSelection] = useState(emptySelection), [reelId, setReelId] = useState(''), [version, setVersion] = useState(0)
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
    const alive = useRef(true), epoch = useRef(0), inFlight = useRef(false), pending = useRef<{ id: string; command: ReelMerchantCommand } | null>(null)
    const [retry, setRetry] = useState(false)
    const recoveryKey = `letbuyy:private-reel-command:v1:${actorId}:${store}`
    const remember = useCallback((value: { id: string; command: ReelMerchantCommand } | null) => {
        pending.current = value
        try { if (value) sessionStorage.setItem(recoveryKey, JSON.stringify(value)); else sessionStorage.removeItem(recoveryKey) } catch { /* The mounted request still retains its exact key. */ }
    }, [recoveryKey])
    const request = useCallback(async (path: string, command?: ReelMerchantCommand) => {
        const response = await fetch(endpoint + path, { method: command ? 'POST' : 'GET', cache: 'no-store', ...(!command ? { signal: AbortSignal.timeout(15_000) } : {}), headers: {
            'Content-Type': 'application/json', 'X-LetBuyy-Merchant-Context': actorId,
            ...(command ? { 'X-Idempotency-Key': command.idempotency_key } : {}),
        }, ...(command ? { body: JSON.stringify(command) } : {}) })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
            const code = result?.error?.code
            const messages: Record<string, string> = {
                REEL_VERSION_CONFLICT: 'This reel changed. Your unsaved text remains here. Copy it before loading the saved revision.',
                REEL_CUSTODY_UNAVAILABLE: 'Verified private processing is unavailable. Save a draft; submission is unavailable.',
                SESSION_CONTEXT_CHANGED: 'The signed-in account changed. Reload this page.',
            }
            const failure = new Error(messages[code] || result?.error?.message || 'Reel request failed. Retry the same request.')
            Object.assign(failure, { status: response.status, code }); throw failure
        }
        if (!result?.data) throw new Error('Incomplete reel response. Retry the same request.')
        return result.data
    }, [endpoint, actorId])
    const load = useCallback(async (number = 1) => {
        const captured = ++epoch.current; setLoading(true); setError('')
        try { const value = await request(`?page=${number}`); if (alive.current && captured === epoch.current) setPage(value) }
        catch (cause) { if (alive.current && captured === epoch.current) {
            setPage(null); setDetail(null); setError(cause instanceof Error ? cause.message : 'Unable to load reels.')
            const failure = cause as { status?: number; code?: string }
            if (failure.status === 401 || failure.status === 403 || failure.code === 'SESSION_CONTEXT_CHANGED') { setSelection(emptySelection()); remember(null); setRetry(false) }
        } }
        finally { if (alive.current && captured === epoch.current) setLoading(false) }
    }, [request, remember])
    useEffect(() => {
        alive.current = true
        try {
            const raw = sessionStorage.getItem(recoveryKey)
            if (raw) {
                const saved = raw.length <= 40000 ? JSON.parse(raw) : null
                const parsed = ReelMerchantCommandSchema.safeParse(saved?.command)
                if (parsed.success && typeof saved.id === 'string' && /^[a-f0-9-]{36}$/i.test(saved.id)) {
                    pending.current = { id: saved.id, command: parsed.data }; setReelId(saved.id); setVersion(parsed.data.expected_version); setSelection(parsed.data.selection); setRetry(true)
                    setNotice('A previous request needs confirmation. Retry that exact request before editing.')
                } else remember(null)
            }
        } catch { remember(null) }
        void load(); const focus = () => { if (!inFlight.current) void load() }; window.addEventListener('focus', focus)
        return () => { alive.current = false; epoch.current++; window.removeEventListener('focus', focus) }
    }, [load, recoveryKey, remember])
    const open = async (id: string) => {
        const captured = ++epoch.current; setBusy(true); setError('')
        try { const value: ReelReadback = await request('/' + encodeURIComponent(id)); if (alive.current && captured === epoch.current) { setDetail(value); setReelId(id); setVersion(value.reel.version); setSelection(value.revision.selection); setNotice('Saved revision loaded.'); remember(null); setRetry(false) } }
        catch (cause) { if (alive.current && captured === epoch.current) setError(cause instanceof Error ? cause.message : 'Unable to load the saved revision.') }
        finally { if (alive.current && captured === epoch.current) setBusy(false) }
    }
    const save = async (action: 'save' | 'submit', sameRequest = false) => {
        if (inFlight.current) return
        inFlight.current = true
        const id = reelId || crypto.randomUUID(), captured = epoch.current
        if (!sameRequest || !pending.current) remember({ id, command: { action, expected_version: version, idempotency_key: crypto.randomUUID(), selection: structuredClone(selection) } })
        const command = pending.current!; setBusy(true); setError(''); setRetry(false)
        try {
            const result = await request('/' + command.id, command.command)
            if (!alive.current || captured !== epoch.current) return
            setReelId(command.id); setVersion(result.reel.version); remember(null); setNotice(result.replayed ? 'The previous saved result was recovered.' : 'Revision saved.'); setBusy(false)
            await open(command.id); await load(page?.page ?? 1)
        } catch (cause) {
            if (!alive.current || captured !== epoch.current) return
            const status = (cause as { status?: number }).status
            setError(cause instanceof Error ? cause.message : 'The outcome is unknown. Retry the same request.')
            if (status && status < 500 || (cause as { code?: string }).code === 'REEL_CUSTODY_UNAVAILABLE') { remember(null); setRetry(false) } else setRetry(true)
            if (status === 401 || status === 403 || (cause as { code?: string }).code === 'SESSION_CONTEXT_CHANGED') { setDetail(null); setPage(null); setSelection(emptySelection()); remember(null); setRetry(false) }
        } finally { inFlight.current = false; if (alive.current) setBusy(false) }
    }
    const options = page?.references, selectedProduct = options?.listings.find(item => item.id === selection.listing_id)
    const select = (name: 'media_asset_id' | 'listing_id' | 'variant_id' | 'thumbnail_asset_id', label: string, rows: Array<{ id: string; label?: string; name?: string; title?: string }>) => <label className="grid gap-2">{label}<select aria-label={label} value={selection[name] ?? ''} disabled={busy || retry} onChange={event => setSelection(current => ({ ...current, [name]: event.target.value || null, ...(name === 'listing_id' ? { variant_id: null } : {}) }))}><option value="">Select…</option>{rows.map(item => <option key={item.id} value={item.id}>{item.label || item.name || item.title || item.id}</option>)}</select></label>
    return <div className="grid gap-4"><h1>Product reels</h1>
        <PrivateReelIntake key={`${actorId}:${store}`} store={store} actorId={actorId} />
        <Banner title="Private reel drafts">Private video processing and reviewer playback are not available yet. Generic public uploads cannot be submitted as reels. Saving a draft does not publish or approve it.</Banner>
        {error && <Banner title="Reel needs attention" variant="critical">{error}</Banner>}{notice && <p role="status">{notice}</p>}
        {loading ? <p role="status">Checking private reel access…</p> : <><Card><Section title="Your reels">
            <Button disabled={busy || retry} onClick={() => { setDetail(null); setReelId(''); setVersion(0); setSelection(emptySelection()); setNotice('New private draft.'); remember(null) }}>New draft</Button>
            {!page ? <Button onClick={() => void load()}>Retry loading</Button> : page.items.length === 0 ? <p>No reel drafts yet.</p> : page.items.slice(0, 20).map(item => <p key={item.id}><Button disabled={busy || retry} onClick={() => void open(item.id)}>{item.status} · version {item.version} · {item.id}</Button></p>)}
            {page && <div className="flex gap-2"><Button disabled={busy || retry || page.page <= 1} onClick={() => void load(page.page - 1)}>Previous</Button><Button disabled={busy || retry || !page.has_more} onClick={() => void load(page.page + 1)}>Next</Button></div>}
        </Section></Card>{page && <Card><Section title={reelId ? 'Edit current draft' : 'New private draft'}>
            <fieldset disabled={busy || retry || (detail !== null && !['draft', 'rejected', 'pending_review', 'approved'].includes(detail.reel.status))} className="grid gap-4">
                <Input label="Caption" value={selection.caption} maxLength={4000} onChange={event => setSelection(current => ({ ...current, caption: event.target.value }))} />
                {select('listing_id', 'Approved product listing (first 100)', options?.listings ?? [])}
                {select('variant_id', 'Current product variant', selectedProduct?.variants ?? [])}
                {select('media_asset_id', 'Verified private video', options?.media ?? [])}
                {select('thumbnail_asset_id', 'Verified private thumbnail', options?.thumbnails ?? [])}
                <p>Rights evidence requires approved private custody. Evidence presence never grants rights permission.</p>
                {(options?.rights ?? []).map(item => <label key={item.id}><Input unstyled type="checkbox" checked={selection.rights_evidence_ids.includes(item.id)} disabled={!selection.rights_evidence_ids.includes(item.id) && selection.rights_evidence_ids.length >= 20} onChange={event => setSelection(current => ({ ...current, rights_evidence_ids: event.target.checked ? [...current.rights_evidence_ids, item.id] : current.rights_evidence_ids.filter(id => id !== item.id) }))} />{item.label}</label>)}
                <div className="flex gap-2"><Button onClick={() => void save('save')}>Save private draft</Button><Button disabled={!selection.media_asset_id || !selection.thumbnail_asset_id || !selection.listing_id} onClick={() => void save('submit')}>Submit for review</Button></div>
            </fieldset>
            {retry && <Button disabled={busy} onClick={() => void save('save', true)}>Retry same request</Button>}
            {reelId && <Button disabled={busy} onClick={() => void open(reelId)}>Load saved revision</Button>}
            {detail && <><p>Server state: {detail.reel.status} · version {detail.reel.version}</p><h2>Review history</h2>{detail.events.length === 0 ? <p>No review decisions.</p> : detail.events.map(event => <p key={event.id}>{event.action}: {event.reason || 'Revision recorded'} · {event.created_at}</p>)}</>}
        </Section></Card>}</>}
    </div>
}
