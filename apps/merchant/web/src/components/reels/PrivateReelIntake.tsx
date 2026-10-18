'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input, Banner, Button, Card, Section } from '@letbuyy/ui'
import { ReelUploadBeginSchema, ReelUploadCapabilitiesSchema, type ReelUploadBegin, type ReelUploadCapabilities, type ReelUploadReadback } from '@letbuyy/shared-types'
import { bindPrivateIntakeReadback } from './private-intake-readback'
type Pending = { command: ReelUploadBegin; id: string | null }
export function PrivateReelIntake({ store, actorId }: { store: string; actorId: string }) {
    const endpoint = `/api/stores/${encodeURIComponent(store)}/reels/uploads`, storageKey = `letbuyy:private-reel-intake:v1:${actorId}:${store}`
    const [capabilities, setCapabilities] = useState<ReelUploadCapabilities | null>(null), [row, setRow] = useState<ReelUploadReadback | null>(null)
    const [command, setCommand] = useState<ReelUploadBegin | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
    const file = useRef<File | null>(null), pending = useRef<Pending | null>(null), worker = useRef<Worker | null>(null), alive = useRef(false), flight = useRef(false), controller = useRef<AbortController | null>(null), epoch = useRef(0)
    const remember = useCallback((value: Pending | null) => {
        pending.current = value
        try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey) } catch { /* The mounted request still retains its key. */ }
    }, [storageKey])
    const request = useCallback(async (path: string, init: RequestInit = {}) => {
        const response = await fetch(endpoint + path, { ...init, cache: 'no-store', signal: controller.current?.signal,
            headers: { ...Object.fromEntries(new Headers(init.headers)), 'X-LetBuyy-Merchant-Context': actorId } })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
            const failure = new Error(payload?.error?.message || 'The intake outcome needs confirmation. Keep the same request and check its status.')
            Object.assign(failure, { status: response.status, code: payload?.error?.code }); throw failure
        }
        return payload?.data
    }, [endpoint, actorId])
    useEffect(() => {
        alive.current = true; controller.current = new AbortController()
        const captured = ++epoch.current
        try {
            const raw = sessionStorage.getItem(storageKey), value = raw && raw.length <= 8192 ? JSON.parse(raw) : null
            const parsed = ReelUploadBeginSchema.safeParse(value?.command)
            if (parsed.success && (value.id === null || typeof value.id === 'string' && /^[a-f0-9-]{36}$/.test(value.id))) {
                pending.current = { command: parsed.data, id: value.id }; setCommand(parsed.data)
                setNotice('A previous intake needs confirmation. Reselect the same original to retry, or check its status.')
                if (value.id) void request('/' + value.id).then(data => { if (alive.current && captured === epoch.current) setRow(bindPrivateIntakeReadback(data, { command: parsed.data, intentId: value.id })) }).catch(() => { if (alive.current && captured === epoch.current) setError('The previous intake could not be confirmed. Keep the same original and check its status.') })
            } else if (raw) remember(null)
        } catch { remember(null) }
        void request('?capabilities=true').then(data => { if (alive.current && captured === epoch.current) setCapabilities(ReelUploadCapabilitiesSchema.parse(data)) }).catch(() => { if (alive.current) setCapabilities(null) })
        return () => { alive.current = false; epoch.current++; controller.current?.abort(); worker.current?.terminate(); file.current = null }
    }, [request, storageKey, remember])
    const choose = async (selected?: File) => {
        if (!selected || !capabilities?.private_upload_enabled || capabilities.max_bytes === null || flight.current) return
        const captured = ++epoch.current; worker.current?.terminate(); file.current = null; setError('')
        if (selected.size < 16 || selected.size > capabilities.max_bytes || !capabilities.accepted_types.includes(selected.type as 'video/mp4' | 'video/webm')) { setError('Choose an original within the approved file type and size limits.'); return }
        setBusy(true); setNotice('Checking the original checksum…')
        let digestWorker: Worker
        try { digestWorker = new Worker(new URL('./client-file-sha256.worker.ts', import.meta.url), { type: 'module' }); worker.current = digestWorker }
        catch {
            if (alive.current && captured === epoch.current) { setBusy(false); setError('The file checksum worker is unavailable. Reselect the original.'); setNotice('') }
            return
        }
        const requestId = crypto.randomUUID()
        const fail = () => { digestWorker.terminate(); if (alive.current && captured === epoch.current) { setBusy(false); setError('The file checksum is unavailable. Reselect the original.'); setNotice('') } }
        digestWorker.onerror = fail
        digestWorker.onmessage = event => {
            digestWorker.terminate()
            if (!alive.current || captured !== epoch.current) return
            if (event.data.requestId !== requestId || event.data.error || !/^[a-f0-9]{64}$/.test(event.data.sha256 || '') || event.data.bytes !== selected.size) { fail(); return }
            const next = { idempotency_key: pending.current?.command.idempotency_key || crypto.randomUUID(), filename: selected.name.trim(), content_type: selected.type, size_bytes: selected.size, checksum_sha256: event.data.sha256 }
            const parsed = ReelUploadBeginSchema.safeParse(next)
            if (!parsed.success || pending.current && JSON.stringify(pending.current.command) !== JSON.stringify(parsed.data)) { setError('This file differs from the pending original. Reselect the same original; its reservation remains retained.'); setBusy(false); return }
            file.current = selected; setCommand(parsed.data); setBusy(false); setNotice('Original checksum checked. Ready to reserve and transfer privately.')
        }
        try { digestWorker.postMessage({ requestId, file: selected, maxBytes: capabilities.max_bytes }) } catch { fail() }
    }
    const act = async (reconcile: boolean) => {
        if (flight.current || !command || (!reconcile && !file.current)) return
        flight.current = true; setBusy(true); setError(''); const captured = epoch.current
        try {
            if (!pending.current) remember({ command, id: null })
            const retained = pending.current!, expected = retained.command
            let current: ReelUploadReadback
            if (!retained.id) {
                const acknowledged = bindPrivateIntakeReadback(await request('', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': expected.idempotency_key }, body: JSON.stringify(expected) }), { command: expected })
                // BEGIN has no previously known ID. Independently read that ID
                // through the owned BFF before persisting or transferring to it.
                current = bindPrivateIntakeReadback(await request('/' + acknowledged.id), { command: expected, intentId: acknowledged.id })
                if (!alive.current || captured !== epoch.current) return
                remember({ command: expected, id: current.id })
            } else current = bindPrivateIntakeReadback(await request('/' + retained.id), { command: expected, intentId: retained.id })
            if (!alive.current || captured !== epoch.current) return
            setRow(current)
            if (reconcile && current.state === 'reserved') { setNotice('The original has not been transferred. Reselect it and retry this reservation.'); return }
            setNotice(reconcile ? 'Checking private storage and current access…' : 'Transferring the original and verifying stored bytes…')
            const retry = { idempotency_key: expected.idempotency_key, expected_version: current.version }
            const result = bindPrivateIntakeReadback(await request('/' + current.id + (reconcile ? '' : '/content'), {
                method: reconcile ? 'POST' : 'PUT', headers: { 'Content-Type': reconcile ? 'application/json' : expected.content_type, 'X-Idempotency-Key': expected.idempotency_key, 'X-Reel-Upload-Version': String(current.version) },
                body: reconcile ? JSON.stringify(retry) : file.current,
            }), { command: expected, intentId: current.id }, true)
            if (alive.current && captured === epoch.current) { setRow(result); setNotice('Private original received. Processing and reviewer playback remain unavailable.') }
        } catch (cause) {
            if (alive.current && captured === epoch.current) {
                setError(cause instanceof Error ? cause.message : 'Check this same intake before retrying.'); setNotice('The outcome needs confirmation. Keep this same intake and check its status.')
                const failure = cause as { status?: number; code?: string }
                if (failure.status === 401 || failure.status === 403 || failure.code === 'SESSION_CONTEXT_CHANGED') { controller.current?.abort(); worker.current?.terminate(); file.current = null; setRow(null); setCommand(null); setCapabilities(null) }
            }
        } finally { flight.current = false; if (alive.current && captured === epoch.current) setBusy(false) }
    }
    return <Card><Section title="Private original intake">
        {!capabilities?.private_upload_enabled ? <p>Private original upload is unavailable. Saved reel drafts remain available.</p> : <>
            <p>Accepted originals: {capabilities.accepted_types.join(', ')}; up to {capabilities.max_bytes} bytes. Receiving an original does not process, approve, or publish a reel.</p>
            <label>Original video<Input unstyled type="file" accept={capabilities.accepted_types.join(',')} disabled={busy} onChange={event => void choose(event.target.files?.[0])} /></label>
            <Button disabled={busy || !command || !file.current} onClick={() => void act(false)}>Transfer same original</Button>
            <Button disabled={busy || !pending.current?.id} onClick={() => void act(true)}>Check same intake</Button>
            {row?.state === 'received_unprocessed' && <Button disabled={busy} onClick={() => { remember(null); file.current = null; setRow(null); setCommand(null); setNotice('Select a new original when ready.') }}>Start another original</Button>}
        </>}
        {busy && <p role="status">{notice || 'Checking private intake…'}</p>}{!busy && notice && <p role="status">{notice}</p>}
        {error && <Banner title="Private intake needs attention" variant="critical">{error}</Banner>}
        {row && <p>Server state: {row.state} · version {row.version}. Processing unavailable; reviewer playback unavailable.</p>}
    </Section></Card>
}
