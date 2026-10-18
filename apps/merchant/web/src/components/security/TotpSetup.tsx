'use client'

import { useState } from 'react'
import { Banner, Button, Input } from '@letbuyy/ui'
import type { useMerchantTotp } from './useMerchantTotp'

export function TotpSetup({ security }: { security: ReturnType<typeof useMerchantTotp> }) {
    const [code, setCode] = useState('')
    if (security.recoveryCodes.length) return <div className="grid gap-[var(--lb-space-4)]">
        <Banner title="Save your recovery codes" variant="warning">Store these codes somewhere safe. Each code can disable this authenticator while you are signed in. They cannot replace your password or recover a signed-out account.</Banner>
        <div aria-label="Recovery codes" className="grid grid-cols-2 gap-2 font-mono select-all">{security.recoveryCodes.map(value => <span key={value}>{value}</span>)}</div>
        <Button onClick={security.acknowledge}>I saved my recovery codes</Button>
    </div>
    if (security.enrollment || security.recoverActivation) return <form className="grid gap-[var(--lb-space-4)]" onSubmit={event => { event.preventDefault(); void security.verify(code).then(() => setCode('')) }}>
        {security.enrollment ? <div className="break-all rounded border border-[var(--lb-color-border)] p-4"><p>Secret key</p><p aria-label="Authenticator secret" className="font-mono select-all">{security.enrollment.secret}</p><p>Add this key to your authenticator app, then enter its current code.</p></div>
            : <Banner title="Recover your activation result" variant="warning">Your authenticator is active. Enter a current code to recover the original recovery codes from your pending activation within 10 minutes. An expired activation needs review in account security.</Banner>}
        <Input label="Confirm authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} pattern="[0-9]{6}" onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        {security.recoverActivation && security.error && <Button type="button" variant="ghost" onClick={security.reviewActiveFactor}>Continue without recovered codes</Button>}
        <Button type="submit" loading={security.working} disabled={code.length !== 6}>Activate 2FA</Button>
    </form>
    return <Button loading={security.working} onClick={security.enroll}>Set up authenticator app</Button>
}
