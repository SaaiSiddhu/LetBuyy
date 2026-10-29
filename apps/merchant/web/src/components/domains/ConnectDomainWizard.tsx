'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Badge, Banner, Button, Checkbox, CheckCircle2, ExternalLink, Globe, Input, Section, ShieldCheck, useToast } from '@letbuyy/ui'
import type { CheckoutDomainSetup, DomainConnectResult, DomainVerifyResult } from '@letbuyy/api-client'
import { domainsClient } from '@/lib/domains/client'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { useReadRequest } from '@/lib/api/use-read-request'
import { WIZARD_STEPS, type WizardStep } from '@/lib/domains/domain-model'
import { providerDnsUrl } from '@/lib/domains/providers'
import { DnsRecordRow, StepDots } from './parts'

interface Props { store: string; initialDomain?: string; onClose: () => void; onConnected: () => void }
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

export function ConnectDomainWizard(props: Props) {
    const { actorId } = useMerchantSecurityContext(props.store)
    return <DomainWizard key={`${actorId}:${props.store}`} {...props} actorId={actorId} />
}
function DomainWizard({ store, actorId, initialDomain = '', onClose, onConnected }: Props & { actorId: string }) {
    const { notify } = useToast()
    const [step, setStep] = useState<WizardStep>('enter')
    const [domain, setDomain] = useState(initialDomain)
    const [busy, setBusy] = useState(false)
    const inFlight = useRef(false)
    const beginRequest = useReadRequest(`${actorId}:${store}`)
    const [connected, setConnected] = useState<DomainConnectResult | null>(null)
    const [verified, setVerified] = useState<DomainVerifyResult | null>(null)
    const [checkout, setCheckout] = useState<CheckoutDomainSetup | null>(null)
    const [error, setError] = useState('')
    const [makePrimary, setMakePrimary] = useState(true)
    const cleaned = useMemo(() => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), [domain])
    const valid = cleaned.length <= 244 && DOMAIN_RE.test(cleaned)
    const provider = connected?.provider || null
    const providerLink = providerDnsUrl(provider, cleaned)
    const storefrontReady = verified?.status === 'active'
    const checkoutReady = checkout?.status === 'active' && checkout.parent_hostname === cleaned
    const complete = storefrontReady && checkoutReady

    async function connect() {
        if (!valid || inFlight.current) return
        inFlight.current = true; setBusy(true); setError('')
        const request = beginRequest()
        try {
            const result = await domainsClient.connect(store, cleaned)
            if (!request.isCurrent()) return
            setConnected(result); setCheckout(result.checkout ?? null); setVerified(null)
            setMakePrimary(true); setStep('instructions')
        } catch (failure) {
            if (request.isCurrent()) setError(failure instanceof Error ? failure.message : 'Domain setup could not be loaded. Please retry.')
        } finally { inFlight.current = false; if (request.isCurrent()) setBusy(false) }
    }
    async function verify() {
        if (inFlight.current) return
        inFlight.current = true; setBusy(true); setError(''); setStep('verify')
        const request = beginRequest()
        try {
            const result = await domainsClient.verify(store, cleaned)
            if (!request.isCurrent()) return
            setVerified(result); setCheckout(result.checkout ?? null)
            if (result.status !== 'active') return
            if (result.checkout?.reason === 'PRIMARY_REQUIRED') {
                if (!makePrimary) return
                await domainsClient.setPrimary(store, cleaned)
                if (!request.isCurrent()) return
            }
            const next = await domainsClient.prepareCheckout(store)
            if (!request.isCurrent()) return
            setCheckout(next)
            if (next.status === 'active' && next.parent_hostname === cleaned) {
                setStep('activate'); onConnected()
                notify({ title: 'Domain setup complete', description: 'Your storefront and checkout have verified HTTPS addresses.', variant: 'success' })
            }
        } catch (failure) {
            if (request.isCurrent()) setError(failure instanceof Error ? failure.message : 'We could not confirm setup. Check the current status before retrying.')
        } finally { inFlight.current = false; if (request.isCurrent()) setBusy(false) }
    }
    return <div className="domains-wizard">
        <div className="domains-wizard-head">
            <Button unstyled type="button" className="domains-back" onClick={onClose}><ArrowLeft className="letbuyy-icon" aria-hidden="true" />Domains</Button>
            <StepDots steps={WIZARD_STEPS} current={Math.max(0, WIZARD_STEPS.findIndex(item => item.key === step))} />
        </div>
        {error && <Banner variant="critical" title="Setup needs attention">{error}</Banner>}
        {step === 'enter' ? <Section variant="grouped" title="One domain. A secure shopping journey.">
            <p className="settings-general-hint">Connect an address you own. We’ll prepare your storefront and its checkout address together, with HTTPS for both.</p>
            <Input label="Storefront domain" value={domain} onChange={event => setDomain(event.target.value)} placeholder="shop.example.com" autoComplete="url"
                helperText={domain && !valid ? 'Enter a valid domain, such as shop.example.com.' : 'Checkout uses checkout followed by your full storefront domain.'} />
            <div className="domains-wizard-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!valid} onClick={() => void connect()}>Continue<ArrowRight className="letbuyy-icon" aria-hidden="true" /></Button></div>
        </Section> : <>
            <Section variant="grouped" title="Your connected addresses">
                <div className="domains-address-grid" aria-live="polite">
                    <Address title="Storefront" hostname={cleaned} ready={storefrontReady} />
                    <Address title="Secure checkout" hostname={checkout?.hostname || 'Waiting for setup details'} ready={checkoutReady} />
                </div>
                <p className="settings-general-hint">HTTPS certificates are requested automatically after the records are verified. Your existing secure checkout remains available while setup completes. Store visibility stays under your control.</p>
                {connected?.role === 'redirect' && <Checkbox label="Use this as the primary domain after verification" description="Checkout will follow this address." checked={makePrimary} disabled={busy || complete} onCheckedChange={setMakePrimary} />}
            </Section>
            {step !== 'activate' && <Section variant="grouped" title="DNS records for storefront and checkout">
                <div className="domains-provider-banner"><Globe className="letbuyy-icon" aria-hidden="true" /><div className="domains-provider-copy"><strong>{provider || 'Your DNS provider'}</strong><span>Add these records in your domain’s DNS settings.</span></div>{providerLink && <a className="domains-provider-cta" href={providerLink} target="_blank" rel="noopener noreferrer">Open DNS<ExternalLink className="letbuyy-icon" aria-hidden="true" /></a>}</div>
                <p className="settings-general-hint">Keep existing mail and unrelated records. For Cloudflare, use CNAME with DNS only; no separate ALIAS record is needed for a subdomain.</p>
                {connected?.apex_mx_warning && <Banner variant="warning" title="Keep your email working">This domain receives email. Use a storefront subdomain or your provider’s supported root-domain flattening without replacing mail records.</Banner>}
                {connected?.records.txt && <DnsRecordRow type="TXT" host={connected.records.txt.name} value={connected.records.txt.value} state={verified?.txt_verified ? 'verified' : 'pending'} message="Storefront ownership verification" />}
                {connected?.records.cname && <DnsRecordRow type="CNAME" host={connected.records.cname.name} value={connected.records.cname.value} state={verified?.cname_verified ? 'verified' : 'pending'} message="Storefront routing" />}
                {verified?.provider_dns_records?.map(record => <DnsRecordRow key={record.name + record.value} type={record.type} host={record.name} value={record.value} state="pending" message="Hosting ownership verification. Add alongside existing TXT records." />)}
                {checkout?.dns_records.map(record => <DnsRecordRow key={record.name + record.value} type={record.type} host={record.name} value={record.value} state={checkoutReady ? 'verified' : 'pending'} message={record.type === 'TXT' ? 'Checkout hosting ownership verification' : 'Secure checkout routing'} />)}
                {!checkout?.hostname && <Banner variant="warning" title="Checkout instructions unavailable">Retry setup before changing DNS. We have not confirmed the checkout address.</Banner>}
            </Section>}
            {step === 'verify' && <Banner variant={complete ? 'success' : 'info'} title={busy ? 'Checking DNS and HTTPS…' : storefrontReady ? 'Storefront ready · checkout pending' : 'Verification in progress'}>
                {checkout?.reason === 'PRIMARY_REQUIRED' && !makePrimary ? 'This is an additional domain. Select the primary-domain option to finish its matching checkout setup.' : storefrontReady ? 'Keep the checkout CNAME in place. We’ll confirm its hosting ownership, certificate and store routing before using it.' : 'Add all displayed records, then check again. DNS and certificate updates can take time.'}
            </Banner>}
            {step === 'activate' ? <Section variant="grouped" title="Storefront and checkout are ready"><div className="domains-success"><CheckCircle2 className="letbuyy-icon" aria-hidden="true" /><p>Both addresses have verified HTTPS. Your saved store visibility and theme are unchanged.</p><Button onClick={onClose}>Done</Button></div></Section> : <div className="domains-wizard-actions"><Button variant="secondary" onClick={onClose}>Finish later</Button><Button loading={busy} disabled={!checkout?.hostname} onClick={() => void verify()}>Check DNS and HTTPS</Button></div>}
        </>}
    </div>
}
function Address({ title, hostname, ready }: { title: string; hostname: string; ready: boolean }) {
    return <div className="domains-address"><div className="domains-row-top"><ShieldCheck className="letbuyy-icon" aria-hidden="true" /><strong>{title}</strong><Badge label={ready ? 'HTTPS ready' : 'Preparing'} variant={ready ? 'success' : 'info'} /></div><code>{hostname}</code></div>
}
