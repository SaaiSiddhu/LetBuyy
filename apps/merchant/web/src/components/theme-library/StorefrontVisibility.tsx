'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Button, Lock, Modal, Input, Select, Textarea, useToast } from '@letbuyy/ui';
import styles from './theme-workspace.module.css';
import { useReadRequest } from '@/lib/api/use-read-request';
type AccessMode = 'public' | 'password' | 'preview_only' | 'offline';
interface AccessState {
    access_mode: AccessMode;
    access_message: string | null;
    has_password: boolean;
    published: boolean;
    status: string;
}
export function StorefrontVisibility({ store, inline = false, onChanged, onLoaded }: {
    store: string;
    inline?: boolean;
    onChanged?: () => void;
    onLoaded?: (store: string, publicPreview: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<AccessState | null>(null);
    const [mode, setMode] = useState<AccessMode>('public');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const { notify } = useToast();
    const beginRead = useReadRequest(store);
    const onLoadedRef = useRef(onLoaded);
    onLoadedRef.current = onLoaded;
    const intent = useRef<{
        fingerprint: string;
        key: string;
    } | null>(null);
    const load = useCallback(async () => {
        const request = beginRead();
        setLoading(true);
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/access`, { cache: 'no-store', signal: request.signal });
            const payload = await response.json();
            if (!request.isCurrent()) return;
            if (!response.ok)
                throw new Error(payload.error?.message || 'Storefront access could not load.');
            setState(payload.data);
            onLoadedRef.current?.(store, payload.data.published === true && payload.data.status === 'published' && payload.data.access_mode === 'public');
            setMode(payload.data.access_mode);
            setMessage(payload.data.access_message || '');
            setError('');
        }
        catch (cause) {
            if (!request.isCurrent()) return;
            onLoadedRef.current?.(store, false);
            setError(cause instanceof Error ? cause.message : 'Storefront access could not load.');
        }
        finally {
            if (request.isCurrent()) setLoading(false);
        }
    }, [beginRead, store]);
    useEffect(() => { void load(); }, [load]);
    async function save() {
        setBusy(true);
        setError('');
        try {
            const fingerprint = JSON.stringify({ store, mode, message, password });
            if (intent.current?.fingerprint !== fingerprint)
                intent.current = { fingerprint, key: crypto.randomUUID() };
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/access`, { method: 'PUT',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: intent.current.key, access_mode: mode, access_message: message, ...(password ? { password } : {}) }) });
            const payload = await response.json();
            if (!response.ok)
                throw new Error(payload.error?.message || 'Storefront access could not be saved.');
            setPassword('');
            intent.current = null;
            await load();
            setOpen(false);
            onChanged?.();
            notify({ title: 'Storefront visibility updated', variant: 'success' });
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Storefront access could not be saved.');
        }
        finally {
            setBusy(false);
        }
    }
    const form = <div className={styles.accessForm}>
        {error && <Banner variant="critical" title="Visibility needs attention">{error}<Button variant="secondary" onClick={() => void load()}>Retry</Button></Banner>}
        <label htmlFor="storefront-access-mode">Storefront visibility</label>
        <Select unstyled id="storefront-access-mode" value={mode} onChange={e => setMode(e.target.value as AccessMode)} disabled={busy || !state} options={[{ value: 'public', label: 'Public' }, { value: 'password', label: 'Password protected' }, { value: 'preview_only', label: 'Private — preview links only' }, { value: 'offline', label: 'Offline' }]}/>
        <p>Public visitors see your published theme. Adding or saving a theme does not publish it.</p>
        {state && (!state.published || state.status !== 'published') && <Banner variant="info">Your storefront is unpublished. Publish a theme when you are ready to launch.</Banner>}
        {mode === 'password' && <><label htmlFor="storefront-new-password">{state?.has_password ? 'New password (optional)' : 'Password'}</label>
            <Input unstyled id="storefront-new-password" type="password" minLength={4} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
            <p>{state?.has_password ? 'Leave blank to keep the current password. The saved password is never displayed.' : 'Use 4–128 characters. Share this password only with people who should access your storefront.'}</p></>}
        <label htmlFor="storefront-access-message">Message to visitors</label>
        <Textarea unstyled id="storefront-access-message" maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} disabled={busy}/>
        <p>Shown on your storefront access screen. Merchants can preview saved themes securely while the store is restricted.</p>
        <div className={styles.actions}><Button variant="secondary" onClick={() => { setOpen(false); setPassword(''); if (state) {
        setMode(state.access_mode);
        setMessage(state.access_message || '');
    } }} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy || !state || (mode === 'password' && !password && !state.has_password)}>{busy ? 'Saving…' : 'Save visibility'}</Button></div>
    </div>;
    const label = state ? state.access_mode === 'password' ? 'Password protected' : state.access_mode === 'offline' ? 'Offline' : state.access_mode === 'public' && state.published && state.status === 'published' ? 'Public' : 'Private' : loading ? 'Loading visibility…' : 'Visibility unavailable';
    return <>
        {inline ? <section className={styles.visibility}><h2>Password protection and visibility</h2>{form}</section> : <Button variant="secondary" onClick={() => setOpen(true)} disabled={loading && !state} aria-label={`Storefront visibility: ${label}`}><Lock size={14} aria-hidden="true"/>{label}</Button>}
        {!inline && <Modal open={open} onClose={() => { if (!busy) {
        setOpen(false);
        setPassword('');
    } }} title="Storefront visibility">{form}</Modal>}
    </>;
}
