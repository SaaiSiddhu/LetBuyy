'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CheckoutDomainSetup } from '@letbuyy/api-client'
import { Badge, Banner, Button, Card, Section } from '@letbuyy/ui'
import { domainsClient } from '@/lib/domains/client'
import { useReadRequest } from '@/lib/api/use-read-request'

export function CheckoutDomainCard({ store }: { store: string }) {
    const [setup, setSetup] = useState<CheckoutDomainSetup | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const beginRead = useReadRequest(store)
    const load = useCallback(async (prepare = false) => {
        const request = beginRead()
        setBusy(true); setError('')
        try {
            const next = await (prepare ? domainsClient.prepareCheckout(store, request.signal) : domainsClient.checkout(store, request.signal))
            if (request.isCurrent()) setSetup(next)
        } catch (failure) {
            if (request.isCurrent()) { setSetup(null); setError(failure instanceof Error ? failure.message : 'Checkout address could not be loaded.') }
        } finally { if (request.isCurrent()) setBusy(false) }
    }, [beginRead, store])
    useEffect(() => { void load() }, [load])
    const ready = setup?.status === 'active'
    return <Card>
        <Section title="Secure checkout address">
            {error && <Banner variant="critical" title="Checkout address unavailable">{error}</Banner>}
            {setup && <div className="settings-general-stack">
                <div className="domains-row-top"><strong className="domains-row-domain">{setup.hostname || 'Address not available'}</strong><Badge label={ready ? 'Ready' : 'Setup pending'} variant={ready ? 'success' : 'info'} /></div>
                <p>{ready ? 'New checkout links use this verified address.' : 'Customers can continue checking out securely at the current checkout address while this address is prepared.'}</p>
                {setup.reason === 'PARENT_NOT_VERIFIED' && <p>Verify the connected store domain before setting up its checkout address.</p>}
                {!!setup.dns_records.length && !ready && <><p>Add these records with your domain provider, then check the address again.</p><div className="overflow-x-auto"><table><caption className="sr-only">Checkout DNS records</caption><thead><tr><th scope="col">Type</th><th scope="col">Name</th><th scope="col">Target</th></tr></thead><tbody>{setup.dns_records.map(record => <tr key={record.name}><td>{record.type}</td><td><code>{record.name}</code></td><td><code>{record.value}</code></td></tr>)}</tbody></table></div></>}
            </div>}
            <Button variant="secondary" disabled={busy || setup?.reason === 'PARENT_NOT_VERIFIED'} onClick={() => void load(Boolean(setup))}>{busy ? 'Checking…' : !setup ? 'Retry' : ready ? 'Check checkout address' : 'Set up checkout address'}</Button>
        </Section>
    </Card>
}
