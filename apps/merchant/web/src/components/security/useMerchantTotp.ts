'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useMerchantSecurityContext } from './MerchantSecurityContext'

export interface TotpFactor { id: string; status: string; factor_type: string }
type Enrollment = { factorId: string; secret: string }
export class MerchantSecurityError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

/** Only opaque command keys survive reload; seeds, codes and approvals stay in memory. */
export function useMerchantTotp(store: string) {
    const { actorId } = useMerchantSecurityContext(store)
    const endpoint = `/api/stores/${encodeURIComponent(store)}/security`
    const namespace = `letbuyy.merchant-security.v1:${actorId}:${store}:`
    const alive = useRef(true), busy = useRef(false), epoch = useRef(0)
    const [loading, setLoading] = useState(true), [working, setWorking] = useState(false)
    const [error, setError] = useState<string | null>(null), [contextChanged, setContextChanged] = useState(false)
    const [factor, setFactor] = useState<TotpFactor | null>(null)
    const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
    const [recoverActivation, setRecoverActivation] = useState(false)
    const headers = useCallback(() => ({ 'X-LetBuyy-Merchant-Context': actorId, 'Content-Type': 'application/json' }), [actorId])
    const key = useCallback((command: string) => {
        const name = namespace + command, saved = sessionStorage.getItem(name)
        if (saved && !/^[a-zA-Z0-9-]{8,200}$/.test(saved)) throw new Error('The saved security request is unreadable. Reload this page and review account security.')
        const value = saved || crypto.randomUUID()
        sessionStorage.setItem(name, value)
        return value
    }, [namespace])
    const forget = useCallback((command: string) => sessionStorage.removeItem(namespace + command), [namespace])
    const request = useCallback(async (path: string, body?: Record<string, unknown>, commandKey?: string) => {
        const capturedEpoch = epoch.current
        const response = await fetch(endpoint + path, { method: body ? 'POST' : 'GET', cache: 'no-store', ...(!body ? { signal: AbortSignal.timeout(15_000) } : {}), headers: { ...headers(), ...(commandKey ? { 'X-Idempotency-Key': commandKey } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
        const payload = await response.json().catch(() => null)
        if (!alive.current || capturedEpoch !== epoch.current) return null
        if (!response.ok) {
            if ([401, 403, 404].includes(response.status) || [ 'SESSION_CONTEXT_CHANGED', 'FORBIDDEN' ].includes(payload?.error?.code)) {
                setContextChanged(true); setFactor(null); setEnrollment(null); setRecoveryCodes([]); setRecoverActivation(false)
            }
            throw new MerchantSecurityError(payload?.error?.message || 'Account security is unavailable. Retry the same request.', response.status, payload?.error?.code)
        }
        if (!payload?.data || typeof payload.data !== 'object') throw new Error('Account security returned an incomplete response. Retry the same request.')
        return payload.data
    }, [endpoint, headers])
    const load = useCallback(async () => {
        if (!alive.current || busy.current) return
        setLoading(true); setError(null); setEnrollment(null); setRecoveryCodes([])
        try {
            const data = await request('/two-factor')
            if (!data) return
            if (!Array.isArray(data.factors) || data.factors.some((item: unknown) => !item || typeof item !== 'object' || typeof (item as TotpFactor).id !== 'string' || !(item as TotpFactor).id || typeof (item as TotpFactor).status !== 'string' || typeof (item as TotpFactor).factor_type !== 'string')) throw new Error('Account security returned an incomplete status. Retry loading.')
            const active = data.factors.find((item: TotpFactor) => item.factor_type === 'totp' && item.status === 'active') || null
            setFactor(active)
            setRecoverActivation(!!active && !!sessionStorage.getItem(namespace + 'verify:' + active.id))
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to load account security.') }
        finally { if (alive.current) setLoading(false) }
    }, [request, namespace])
    useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; epoch.current += 1 } }, [load])
    const run = async (operation: () => Promise<void>) => {
        if (!alive.current || busy.current || contextChanged || loading) return
        busy.current = true; setWorking(true); setError(null)
        try { await operation() }
        catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'The outcome is unknown. Retry the same request.') }
        finally { busy.current = false; if (alive.current) setWorking(false) }
    }
    const enroll = () => run(async () => {
        const data = await request('/two-factor/enroll', {}, key('enroll'))
        if (!data) return
        if (!data.factor?.id || typeof data.secret !== 'string' || !data.secret) throw new Error('Enrollment returned an incomplete response. Retry setup.')
        setEnrollment({ factorId: data.factor.id, secret: data.secret })
    })
    const verify = (code: string) => run(async () => {
        const id = enrollment?.factorId || (recoverActivation ? factor?.id : null)
        if (!id) throw new Error('Reload security status before activating your authenticator.')
        const data = await request('/two-factor/verify', { factor_id: id, code }, key('verify:' + id))
        if (!data) return
        if (data.factor?.status !== 'active' || !Array.isArray(data.recovery_codes) || !data.recovery_codes.length || !data.recovery_codes.every((item: unknown) => typeof item === 'string')) throw new Error('Recovery codes were not received. Retry activation with a current authenticator code.')
        setFactor(data.factor); setEnrollment(null); setRecoverActivation(false); setRecoveryCodes(data.recovery_codes)
    })
    const acknowledge = () => {
        try { if (factor) forget('verify:' + factor.id); forget('enroll'); setRecoveryCodes([]) }
        catch { setError('Unable to clear the saved activation request. Keep your recovery codes safe and retry.') }
    }
    const reviewActiveFactor = () => {
        try { if (factor) forget('verify:' + factor.id); forget('enroll'); setRecoverActivation(false); setError(null) }
        catch { setError('Unable to clear the saved activation request. Reload this page.') }
    }
    const disable = (code: string, recovery: boolean) => run(async () => {
        if (!factor) return
        const data = await request('/two-factor/disable', { factor_id: factor.id, ...(recovery ? { recovery_code: code } : { code }) }, key('disable:' + factor.id))
        if (!data) return
        if (data.factor?.status !== 'disabled') throw new Error('Disable returned an incomplete response. Retry the same request.')
        forget('disable:' + factor.id); forget('verify:' + factor.id); forget('enroll')
        setFactor(null); setEnrollment(null); setRecoveryCodes([]); setRecoverActivation(false)
    })
    return { actorId, factor, enrollment, recoveryCodes, recoverActivation, loading, working, error, contextChanged, load, enroll, verify, acknowledge, reviewActiveFactor, disable, request, run }
}
