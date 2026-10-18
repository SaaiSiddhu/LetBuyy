'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Banner, Button, Card, EmptyState, Input, MaterialIcon, Section } from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { useMerchantTotp } from '@/components/security/useMerchantTotp'
import { TotpSetup } from '@/components/security/TotpSetup'

export default function SecuritySettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { actorId } = useMerchantSecurityContext(store)
    return <AccountSecurity key={`${actorId}:${store}`} store={store} />
}
function AccountSecurity({ store }: { store: string }) {
    const security = useMerchantTotp(store)
    const [showDisable, setShowDisable] = useState(false), [recovery, setRecovery] = useState(false), [code, setCode] = useState('')
    const setup = !security.factor || !!security.enrollment || security.recoverActivation || !!security.recoveryCodes.length
    return <SettingsPane store={store} title="Security" description="Set up two-factor authentication so you can approve refunds and release payouts.">
        {security.contextChanged ? <Banner title="Account or store access changed" variant="critical">Reload this page before continuing.</Banner> : <Card><Section title="Two-factor authentication" description="Sensitive actions require an active authenticator.">
            {security.error && <Banner title="Security needs attention" variant="critical">{security.error}</Banner>}
            {security.loading ? <p role="status">Checking account security…</p> : security.error && !security.factor && !security.enrollment ? <Button onClick={security.load}>Retry loading security</Button> : setup ? <div className="grid gap-4">
                {!security.enrollment && !security.recoverActivation && !security.recoveryCodes.length && <EmptyState icon={<MaterialIcon name="lock" />} title="2FA not configured" body="Add an authenticator app to protect sensitive actions." />}
                <TotpSetup security={security} />
            </div> : <div className="grid gap-4">
                <p>Authenticator app active</p>
                {!showDisable ? <Button variant="destructive" onClick={() => setShowDisable(true)}>Disable 2FA</Button> : <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void security.disable(code, recovery).then(() => setCode('')) }}>
                    <label><input type="checkbox" checked={recovery} onChange={event => { setRecovery(event.target.checked); setCode('') }} /> Use a recovery code</label>
                    <Input label={recovery ? 'Recovery code' : 'Authenticator code'} autoComplete="off" value={code} maxLength={recovery ? 64 : 6} onChange={event => setCode(recovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    <Button type="submit" variant="destructive" loading={security.working} disabled={recovery ? code.trim().length < 8 : code.length !== 6}>Confirm disable</Button>
                    <Button type="button" variant="ghost" onClick={() => { setShowDisable(false); setCode('') }}>Cancel</Button>
                </form>}
            </div>}
        </Section></Card>}
    </SettingsPane>
}
