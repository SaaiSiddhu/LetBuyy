'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Banner, Button, Input } from '@letbuyy/ui'
import type { MediaAsset, MediaMetadataUpdate } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '../security/MerchantSecurityContext'
import { createMediaCommandRecovery, type MediaBrowserIntent } from '@/lib/media/media-command-recovery'

function digest(file: File, signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        let worker: Worker
        try { worker = new Worker(new URL('../reels/client-file-sha256.worker.ts', import.meta.url), { type: 'module' }) }
        catch { reject(new Error('File checksum is unavailable. Keep the original file.')); return }
        const finish = (error?: Error, value?: string) => {
            clearTimeout(timer); signal.removeEventListener('abort', cancel); worker.terminate()
            if (error) reject(error); else resolve(value!)
        }
        const cancel = () => finish(new Error('The media surface changed. Keep the original file.'))
        const timer = setTimeout(() => finish(new Error('File checksum timed out. Reselect the original.')), 90_000)
        signal.addEventListener('abort', cancel, { once: true })
        if (signal.aborted) { cancel(); return }
        const requestId = crypto.randomUUID()
        worker.onerror = () => finish(new Error('File checksum is unavailable.'))
        worker.onmessage = (event: MessageEvent<{ requestId: string; sha256?: string; bytes?: number }>) => {
            if (event.data.requestId !== requestId) return
            if (event.data.bytes !== file.size || !/^[a-f0-9]{64}$/.test(event.data.sha256 ?? '')) finish(new Error('File checksum is unavailable.'))
            else finish(undefined, event.data.sha256)
        }
        worker.postMessage({ requestId, file, maxBytes: 100 * 1024 * 1024 })
    })
}
type Recovery = {
    store: string; busy: boolean; ready: boolean; pending: MediaBrowserIntent | null; error: string; revision: number;
    upload: (file: File) => Promise<MediaAsset>;
    change: (id: string, input?: MediaMetadataUpdate) => Promise<MediaAsset | null>;
    resume: (file?: File) => Promise<void>;
}
const Context = createContext<Recovery | null>(null)
export function MediaRecoveryProvider({ store, children }: { store: string; children: ReactNode }) {
    const { actorId, siteId } = useMerchantSecurityContext(store)
    const identity = `${actorId}:${siteId}:${store}`
    const live = useRef({ identity, mounted: false })
    const cancellation = useRef<AbortController | null>(null)
    const flight = useRef(false)
    const [busy, setBusy] = useState(false), [ready, setReady] = useState(false)
    const [pending, setPending] = useState<MediaBrowserIntent | null>(null)
    const [error, setError] = useState(''), [revision, setRevision] = useState(0)
    useLayoutEffect(() => {
        live.current = { identity, mounted: true }; cancellation.current = new AbortController()
        return () => { live.current.mounted = false; cancellation.current?.abort() }
    }, [identity])
    const engine = useCallback(() => {
        const check = () => { if (!live.current.mounted || live.current.identity !== identity) throw new Error('The account or store changed. Reload this store.') }
        check()
        if (!siteId || !navigator.locks || !window.localStorage) throw new Error('Safe media recovery is unavailable in this browser. Keep browser data and use a supported secure browser.')
        return createMediaCommandRecovery({ scope: { actorId, siteId }, store, storage: window.localStorage,
            locks: navigator.locks, check, fetch: window.fetch.bind(window) })
    }, [actorId, identity, siteId, store])
    const refresh = useCallback(async () => {
        try {
            const saved = await engine().read()
            if (live.current.mounted && live.current.identity === identity) { setPending(saved?.intent ?? null); setReady(true) }
        } catch (cause) {
            if (live.current.mounted && live.current.identity === identity) { setReady(false); setError(cause instanceof Error ? cause.message : 'The original media request needs recovery.') }
        }
    }, [engine, identity])
    useEffect(() => {
        void refresh()
        const changed = (event: StorageEvent) => {
            if (event.key !== `letbuyy:media-command:v1:${actorId}:${siteId}`) return
            void refresh(); setRevision(value => value + 1)
        }
        window.addEventListener('storage', changed)
        return () => window.removeEventListener('storage', changed)
    }, [refresh, actorId, siteId])
    const run = useCallback(async <T,>(work: (e: ReturnType<typeof engine>) => Promise<T>): Promise<T> => {
        if (flight.current) throw new Error('Wait for the current media request.')
        flight.current = true; setBusy(true); setError('')
        try {
            const result = await work(engine())
            if (!live.current.mounted || live.current.identity !== identity) throw new Error('The account or store changed.')
            setRevision(value => value + 1); return result
        } catch (cause) {
            if (live.current.mounted && live.current.identity === identity) setError(cause instanceof Error ? cause.message : 'Media remains unconfirmed.')
            throw cause
        } finally {
            flight.current = false
            if (live.current.mounted && live.current.identity === identity) { await refresh(); setBusy(false) }
        }
    }, [engine, identity, refresh])
    const upload = useCallback((file: File) => run(async e => {
        // No bytes leave the browser until digest, persisted intent and execution lease succeed.
        const sha256 = await digest(file, cancellation.current!.signal)
        const result = await e.upload(file, { name: file.name, type: file.type, size: file.size, sha256 })
        if (!result) throw new Error('Media registration remains unconfirmed.')
        return result
    }), [run])
    const change = useCallback((id: string, input?: MediaMetadataUpdate) => {
        // Capture input synchronously before run yields (including nested tags).
        const captured = input === undefined ? undefined : structuredClone(input)
        return run(e => e.change(id, captured))
    }, [run])
    const resume = useCallback((file?: File) => run(async e => {
        await e.resume(file ? { file, descriptor: { name: file.name, type: file.type, size: file.size,
            sha256: await digest(file, cancellation.current!.signal) } } : undefined)
        // Recovery restores the library; attachment to a particular product/theme
        // is a separate explicit selection, never an old callback after navigation.
    }), [run])
    const value = useMemo(() => ({ store, busy, ready, pending, error, revision, upload, change, resume }), [store, busy, ready, pending, error, revision, upload, change, resume])
    return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useMediaRecovery(store: string) {
    const value = useContext(Context)
    if (!value || value.store !== store) throw new Error('Reload this store before changing media.')
    return value
}
/** Fence a successful upload callback to the field/page that started it. */
export function useMediaUploadTarget(store: string | undefined, binding: string) {
    const context = useContext(Context)
    const recovery = context?.store === store ? context : null
    const uploadMedia = recovery?.upload
    const life = useRef({ binding, current: false })
    useLayoutEffect(() => { life.current = { binding, current: true }; return () => { life.current.current = false } }, [binding])
    const capture = useCallback(() => {
        const captured = life.current
        return () => captured.current && life.current === captured
    }, [])
    const upload = useCallback(async (file: File) => {
        const captured = life.current
        if (!uploadMedia) throw new Error('Reload this store before uploading media.')
        const result = await uploadMedia(file)
        if (!captured.current || life.current !== captured) throw new Error('The media target changed. Select the confirmed file from the library.')
        return result
    }, [uploadMedia])
    return { upload, capture, blocked: !recovery || !recovery.ready || recovery.busy || Boolean(recovery.pending), revision: recovery?.revision ?? 0 }
}
export function MediaRecoveryNotice({ store }: { store: string | undefined }) {
    const r = useContext(Context)
    if (!store) return null
    if (!r || r.store !== store) return <Banner variant="warning" title="Media unavailable">Reload this store before changing media.</Banner>
    if (!r.pending && !r.error) return null
    return <Banner variant="warning" title="Media recovery" action={r.pending ? <Button variant="secondary" disabled={r.busy || !r.ready} onClick={() => { void r.resume().catch(() => undefined) }}>Confirm saved media request</Button> : undefined}>
        <p>{r.error || 'An earlier media request needs confirmation. Keep this browser data. Confirmed uploads appear in the library for you to select.'}</p>
        {r.pending?.operation === 'upload' && !r.pending.acknowledgement && <label>Reselect the original file if receipt recovery cannot confirm it
            <Input type="file" disabled={r.busy || !r.ready} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void r.resume(file).catch(() => undefined) }} />
        </label>}
    </Banner>
}
