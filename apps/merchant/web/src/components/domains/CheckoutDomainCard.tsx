'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CheckoutDomainSetup } from '@letbuyy/api-client'
import { Badge, Banner, Button, Card, Section, Skeleton } from '@letbuyy/ui'
import { domainsClient } from '@/lib/domains/client'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { useReadRequest } from '@/lib/api/use-read-request'

type Props = { store: string; onResume?: (domain: string) => void }
export function CheckoutDomainCard(props: Props) {
    const { actorId } = useMerchantSecurityContext(props.store)
    return <CheckoutAddress key={`${actorId}:${props.store}`} {...props} actorId={actorId} />
}
function CheckoutAddress({ store, onResume, actorId }: Props & { actorId: string }) {
    const [setup, setSetup] = useState<CheckoutDomainSetup | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const beginRead = useReadRequest(`${actorId}:${store}`)
    const load = useCallback(async (prepare = false) => {
        const request = beginRead()
        setBusy(true); setError('')
        try {
            const next = await (prepare ? domainsClient.prepareCheckout(store) : domainsClient.checkout(store, request.signal))
            if (request.isCurrent()) setSetup(next)
        } catch (failure) {
            if (request.isCurrent()) { setSetup(null); setError(failure instanceof Error ? failure.message : 'Checkout address could not be loaded.') }
        } finally { if (request.isCurrent()) setBusy(false) }
    }, [beginRead, store])
    useEffect(() => { void load() }, [load])
    const ready = setup?.status === 'active'
    const custom = setup?.source === 'custom' && setup.parent_hostname
    return <Card><Section title="Secure checkout">
        {error && <Banner variant="critical" title="Checkout address unavailable">{error}</Banner>}
        {busy && !setup && <Skeleton variant="text" lines={2} />}
        {setup && <div className="settings-general-stack">
            <div className="domains-row-top"><strong className="domains-address-host">{setup.hostname || 'Address unavailable'}</strong><Badge label={ready ? 'HTTPS ready' : 'Preparing'} variant={ready ? 'success' : 'info'} /></div>
            <p className="settings-general-hint">{ready ? 'Checkout links use this verified address and follow your published theme.' : custom ? 'Complete storefront and checkout DNS together. Your current secure checkout stays available while certificates are prepared.' : 'LetBuyy provisions this address automatically. No DNS changes are needed for your LetBuyy subdomain.'}</p>
            {setup.reason === 'NOT_CONFIGURED' && <Banner variant="warning" title="Provisioning unavailable">Your current secure checkout remains available. Contact support if this status continues.</Banner>}
        </div>}
        <div className="domains-wizard-actions">
            {custom && onResume && <Button variant={ready ? 'secondary' : 'primary'} disabled={busy} onClick={() => onResume(String(custom))}>{ready ? 'Manage domain setup' : 'Continue domain setup'}</Button>}
            <Button variant="secondary" disabled={busy} onClick={() => void load(Boolean(setup))}>{busy ? 'Checking…' : error ? 'Retry' : 'Check status'}</Button>
        </div>
    </Section></Card>
}
