'use client'

import { useRef, useState } from 'react'
import { Button, Input, Banner } from '@letbuyy/ui'
import { useMerchantSecurityContext } from './MerchantSecurityContext'
import { TotpSetup } from './TotpSetup'
import { useMerchantTotp } from './useMerchantTotp'

export type StepUpAction = 'refund.approve' | 'payout.release'
export interface StepUpResult { token: string; verifiedAt: string; actorId: string }
interface Props { store: string; action: StepUpAction; open: boolean; onSuccess: (result: StepUpResult) => void; onClose: () => void }

export function StepUpDialog(props: Props) {
    const { actorId } = useMerchantSecurityContext(props.store)
    return props.open ? <OpenStepUpDialog key={`${actorId}:${props.store}:${props.action}`} {...props} /> : null
}
function OpenStepUpDialog({ store, action, onSuccess, onClose }: Props) {
    const security = useMerchantTotp(store)
    const [code, setCode] = useState('')
    const challengeKey = useRef<string | null>(null)
    const actionLabel = action === 'refund.approve' ? 'Approve Refund' : 'Release Payout'
    const setup = !security.factor || !!security.enrollment || security.recoverActivation || !!security.recoveryCodes.length
    return <div role="dialog" aria-modal="true" aria-labelledby="step-up-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-[460px] rounded-xl bg-[var(--lb-color-surface)] p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 id="step-up-title">Verify identity</h2>
            {security.contextChanged ? <Banner title="Account or store access changed" variant="critical">Close this dialog and reload the page before continuing.</Banner> : <>
                {security.error && <Banner title="Verification needs attention" variant="critical">{security.error}</Banner>}
                {security.loading ? <p role="status">Checking account security…</p> : security.error && !security.factor && !security.enrollment ? <Button onClick={security.load}>Retry loading security</Button> : setup ? <TotpSetup security={security} /> : <form className="grid gap-4" onSubmit={event => {
                    event.preventDefault()
                    void security.run(async () => {
                        challengeKey.current ??= crypto.randomUUID()
                        const data = await security.request('/step-up', { action, idempotency_key: challengeKey.current, factor_id: security.factor!.id, code }, challengeKey.current)
                        if (!data) return
                        if (typeof data.step_up_token !== 'string' || typeof data.verified_at !== 'string') throw new Error('Approval was incomplete. Retry the same verification.')
                        onSuccess({ token: data.step_up_token, verifiedAt: data.verified_at, actorId: security.actorId })
                    }).then(() => setCode(''))
                }}>
                    <p>Enter your current authenticator code to {actionLabel.toLowerCase()}.</p>
                    <Input label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} pattern="[0-9]{6}" onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    <Button type="submit" loading={security.working} disabled={code.length !== 6}>{actionLabel}</Button>
                    {security.error && <Button type="button" variant="ghost" onClick={() => { challengeKey.current = null; setCode(''); void security.load() }}>Start a new verification</Button>}
                </form>}
            </>}
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
    </div>
}
