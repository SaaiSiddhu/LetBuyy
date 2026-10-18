'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MerchantLoyaltySnapshot } from '@letbuyy/api-client'
import { Banner, Button, Card, Checkbox, Input, Section, Skeleton } from '@letbuyy/ui'
import { SettingsPane } from './SettingsPane'
import { bpsToPercentage, completeLoyaltySave, formatLoyaltyPaise, isLoyaltySnapshot, loyaltyPendingName, percentageToBps,
    prepareLoyaltySave, readPendingLoyaltySave, validPointValue, type PendingLoyaltySave } from '@/lib/loyalty/pending-save'

type Draft = { active: boolean; earn: string; cap: string; value: string }
const initial: Draft = { active: false, earn: '0', cap: '50', value: '100' }
const draftFor = (snapshot: MerchantLoyaltySnapshot): Draft => snapshot.program ? {
    active: snapshot.program.is_active, earn: bpsToPercentage(snapshot.program.earn_rate_bps),
    cap: bpsToPercentage(snapshot.program.redeem_cap_bps), value: snapshot.program.point_value_minor,
} : initial

class LoyaltyRequestError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) { super(message) }
}
async function readReply(response: Response) {
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new LoyaltyRequestError(payload?.error?.message || 'Loyalty settings are unavailable. Retry this request.', payload?.error?.code || 'LOYALTY_UNAVAILABLE', response.status)
    return payload.data as unknown
}

export function LoyaltySettings({ store, actorId }: { store: string; actorId: string }) {
    const [snapshot, setSnapshot] = useState<MerchantLoyaltySnapshot | null>(null)
    const [draft, setDraft] = useState<Draft>(initial)
    const [pending, setPending] = useState<PendingLoyaltySave | null>(null)
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
    const [error, setError] = useState(''), [notice, setNotice] = useState('')
    const [conflict, setConflict] = useState(false), [blocked, setBlocked] = useState(false), [storageFailed, setStorageFailed] = useState(false)
    const generation = useRef(0), busy = useRef(false), mounted = useRef(true)
    const context = `${actorId}:${store}`, currentContext = useRef(context)
    currentContext.current = context
    const endpoint = `/api/stores/${encodeURIComponent(store)}/loyalty`
    const headers = useCallback(() => ({ 'X-LetBuyy-Merchant-Context': actorId }), [actorId])
    const alive = (token: number, captured: string) => mounted.current && generation.current === token && currentContext.current === captured
    const invalidate = useCallback(() => { generation.current++; setBlocked(true); setSnapshot(null); setPending(null); setNotice(''); setError('The account or store access changed. Reload this page before continuing.') }, [])

    const load = useCallback(async (discardPending = false) => {
        const token = ++generation.current, captured = `${actorId}:${store}`
        let capturedPending: string | null = null
        try { capturedPending = localStorage.getItem(loyaltyPendingName(actorId, store)) } catch { /* storage failure is rendered after the read */ }
        setLoading(true); setError(''); setNotice(''); setSnapshot(null); setConflict(false); setStorageFailed(false)
        try {
            const data = await readReply(await fetch(endpoint, { headers: headers(), cache: 'no-store' }))
            if (generation.current !== token || currentContext.current !== captured) return
            if (!isLoyaltySnapshot(data)) throw new Error('Loyalty settings returned an incomplete response. Retry loading.')
            setSnapshot(data); setDraft(draftFor(data))
            try {
                const name = loyaltyPendingName(actorId, store)
                if (discardPending && localStorage.getItem(name) === capturedPending) localStorage.removeItem(name)
                setPending(readPendingLoyaltySave(actorId, store))
            } catch (failure) { setStorageFailed(true); setError(failure instanceof Error ? failure.message : 'Browser storage is unavailable. Enable storage before saving.') }
        } catch (failure) {
            if (generation.current !== token || currentContext.current !== captured) return
            if (failure instanceof LoyaltyRequestError && (failure.code === 'SESSION_CONTEXT_CHANGED' || [401,403,404].includes(failure.status))) setBlocked(true)
            setError(failure instanceof Error ? failure.message : 'Unable to load loyalty settings.')
        } finally { if (generation.current === token && currentContext.current === captured) setLoading(false) }
    }, [actorId, store, endpoint, headers])
    useEffect(() => {
        const lifetime = mounted, counter = generation
        lifetime.current = true
        void load()
        return () => { lifetime.current = false; counter.current++ }
    }, [load])
    useEffect(() => {
        // A tab returning after another account signed in must not send its old
        // form under the replacement cookie. The server checks the same binding.
        const check = async () => {
            try {
                const response = await fetch(endpoint, { headers: headers(), cache: 'no-store' })
                const payload = await response.json().catch(() => null)
                if (mounted.current && currentContext.current === context && (payload?.error?.code === 'SESSION_CONTEXT_CHANGED' || [401,403,404].includes(response.status))) invalidate()
            } catch { /* A network failure grants no new authority; save remains server fenced. */ }
        }
        window.addEventListener('focus', check)
        return () => window.removeEventListener('focus', check)
    }, [context, endpoint, headers, invalidate])

    const earn = percentageToBps(draft.earn), cap = percentageToBps(draft.cap), valueValid = validPointValue(draft.value)
    const decrease = Boolean(snapshot?.program && valueValid && !snapshot.value_decrease_allowed && BigInt(draft.value) < BigInt(snapshot.program.point_value_minor))
    const valid = earn !== null && cap !== null && valueValid && !decrease
    const original = snapshot ? draftFor(snapshot) : initial
    const dirty = Boolean(snapshot && (!snapshot.enrolled || draft.active !== original.active || earn !== percentageToBps(original.earn) || cap !== percentageToBps(original.cap) || draft.value !== original.value))
    const disabled = loading || saving || Boolean(pending) || conflict || blocked || storageFailed

    const save = async () => {
        if (busy.current || blocked || loading || !snapshot || (!pending && (!valid || !dirty || conflict || storageFailed))) return
        const token = generation.current, captured = context
        busy.current = true; setSaving(true); setError(''); setNotice('')
        let command = pending
        try {
            command ??= prepareLoyaltySave(actorId, store, { expected_updated_at: snapshot.program?.updated_at ?? null,
                is_active: draft.active, earn_rate_bps: earn!, redeem_cap_bps: cap!, point_value_minor: draft.value })
            if (!alive(token, captured)) return
            setPending(command)
            const response = await fetch(endpoint, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json', 'X-Idempotency-Key': command.key }, body: JSON.stringify(command.intent) })
            await readReply(response)
            completeLoyaltySave(command)
            if (!alive(token, captured)) return
            setPending(null)
            await load()
            if (mounted.current && currentContext.current === captured) setNotice('Loyalty settings saved.')
        } catch (failure) {
            if (!alive(token, captured)) return
            if (failure instanceof LoyaltyRequestError && (failure.code === 'SESSION_CONTEXT_CHANGED' || [401,403,404].includes(failure.status))) { invalidate(); return }
            if (failure instanceof LoyaltyRequestError && [400,409,422].includes(failure.status)) {
                if (command) completeLoyaltySave(command)
                setPending(null); setConflict(true)
            }
            setError(failure instanceof Error ? failure.message : 'The save outcome is unknown. Retry the same save.')
        } finally { busy.current = false; if (mounted.current && currentContext.current === captured) setSaving(false) }
    }

    return <SettingsPane title="Loyalty" description="Set the rewards your store funds for its customers." store={store}>
        {loading && <Card><Section title="Loading loyalty settings"><Skeleton variant="text" lines={4} /></Section></Card>}
        {error && <Banner variant="critical" title={blocked ? 'Account or store access changed' : 'Loyalty settings need attention'}>{error}</Banner>}
        {notice && <div role="status"><Banner variant="success" title="Saved">{notice}</Banner></div>}
        {blocked ? <Button onClick={() => window.location.reload()}>Reload this page</Button> : <>
            {pending && <Banner variant="warning" title="A previous save needs confirmation">Retry the same save to confirm its outcome. Reloading this page keeps that request available.</Banner>}
            {snapshot && <Card><Section title={snapshot.enrolled ? (snapshot.program?.is_active ? 'Programme active' : 'Programme paused') : 'Loyalty is not set up'}
                description={snapshot.enrolled ? 'Your store funds these rewards. Points stay with this store.' : 'Choose your settings and save to create this store’s loyalty programme.'}>
                <p>Outstanding points: <strong>{BigInt(snapshot.outstanding_points).toLocaleString('en-IN')}</strong></p>
                {snapshot.program && <p>Current reward value: <strong>{formatLoyaltyPaise(BigInt(snapshot.outstanding_points) * BigInt(snapshot.program.point_value_minor))}</strong></p>}
                <p>Point value cannot decrease while customers hold points. Allowed changes are recorded with their reward liability.</p>
            </Section></Card>}
            {snapshot && <form onSubmit={event => { event.preventDefault(); void save() }}>
                <Card><Section title="Reward settings">
                    <fieldset disabled={disabled} className="m-0 space-y-[var(--lb-space-4)] border-0 p-0">
                        <legend className="sr-only">Loyalty programme settings</legend>
                        <Checkbox label="Allow customers to earn and use points" aria-label="Allow customers to earn and use points" checked={draft.active} onCheckedChange={active => setDraft(current => ({ ...current, active }))}
                            description="Pausing keeps existing points and their history. Refunds can still restore spent points." />
                        <Input label="Earn rate (%)" inputMode="decimal" value={draft.earn} onChange={event => setDraft(current => ({ ...current, earn: event.target.value }))}
                            error={earn === null ? 'Enter 0 to 100 with up to two decimal places.' : undefined}
                            helperText="At 10%, an eligible ₹1,000 order earns 100 whole points. Their value depends on your point value." />
                        <Input label="Maximum order value paid with points (%)" inputMode="decimal" value={draft.cap} onChange={event => setDraft(current => ({ ...current, cap: event.target.value }))}
                            error={cap === null ? 'Enter 0 to 100 with up to two decimal places.' : undefined} helperText="This caps the share of an eligible order that points can pay for." />
                        <Input label="Value per point (paise)" inputMode="numeric" value={draft.value} onChange={event => setDraft(current => ({ ...current, value: event.target.value }))}
                            error={!valueValid ? 'Enter a positive whole-paise value within the supported range.' : decrease ? 'Point value cannot decrease while customers hold points.' : undefined}
                            helperText={valueValid ? `One point is worth ${formatLoyaltyPaise(draft.value)}.` : '100 paise = ₹1.00.'} />
                        {snapshot.program && valueValid && BigInt(draft.value) !== BigInt(snapshot.program.point_value_minor) && <p role="status">Change in outstanding reward value: {formatLoyaltyPaise(BigInt(snapshot.outstanding_points) * (BigInt(draft.value) - BigInt(snapshot.program.point_value_minor)))}</p>}
                    </fieldset>
                    <div className="mt-[var(--lb-space-4)] flex flex-wrap gap-[var(--lb-space-3)]">
                        <Button type="submit" loading={saving} disabled={loading || blocked || (!pending && (!valid || !dirty || conflict || storageFailed))}>{pending ? 'Retry same save' : 'Save loyalty'}</Button>
                        <Button type="button" variant="secondary" disabled={saving || loading} onClick={() => void load(true)}>{pending || storageFailed ? 'Discard pending save and reload' : 'Reload current saved settings'}</Button>
                    </div>
                </Section></Card>
            </form>}
            {!snapshot && !loading && <Button onClick={() => void load()}>Retry loading loyalty</Button>}
        </>}
    </SettingsPane>
}
