'use client'

import { useCallback, useMemo, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Button,
    CheckCircle2,
    ExternalLink,
    Globe,
    Info,
    Input,
    Loader2,
    Sparkles,
    useToast,
} from '@letbuyy/ui'
import type { DomainConnectResult, DomainVerifyResult } from '@letbuyy/api-client'
import { domainsClient } from '@/lib/domains/client'
import { WIZARD_STEPS, type WizardStep } from '@/lib/domains/domain-model'
import { providerDnsUrl } from '@/lib/domains/providers'
import { DnsRecordRow, StepDots } from './parts'

interface ConnectDomainWizardProps {
    store: string
    onClose: () => void
    onConnected: () => void
}

const DOMAIN_RE = /^(?!:\/\/)([a-z0-9-]+\.)+[a-z]{2,}$/i

export function ConnectDomainWizard({ store, onClose, onConnected }: ConnectDomainWizardProps) {
    const { notify } = useToast()
    const [step, setStep] = useState<WizardStep>('enter')
    const [domain, setDomain] = useState('')
    const [busy, setBusy] = useState(false)
    const [connectResult, setConnectResult] = useState<DomainConnectResult | null>(null)
    const [verifyResult, setVerifyResult] = useState<DomainVerifyResult | null>(null)

    const cleanedDomain = useMemo(() => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), [domain])
    const domainValid = DOMAIN_RE.test(cleanedDomain)
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === step)

    const provider = connectResult?.provider || null
    const records = connectResult?.records
    const providerLink = providerDnsUrl(provider, cleanedDomain)

    const handleConnect = useCallback(async () => {
        if (!domainValid || busy) return
        setBusy(true)
        try {
            const result = await domainsClient.connect(store, cleanedDomain)
            setConnectResult(result)
            setStep('instructions')
            notify({ title: 'Domain added', description: 'Add the DNS records below, then verify.', variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not add domain', description: error instanceof Error ? error.message : 'Unable to add this domain', variant: 'critical' })
        } finally {
            setBusy(false)
        }
    }, [busy, cleanedDomain, domainValid, notify, store])

    const handleVerify = useCallback(async () => {
        if (busy) return
        setBusy(true)
        setStep('verify')
        try {
            const result = await domainsClient.verify(store, cleanedDomain)
            setVerifyResult(result)
            if (result.status === 'active') {
                setStep('activate')
                notify({ title: 'Domain connected', description: `${cleanedDomain} is live and secure.`, variant: 'success' })
                onConnected()
            } else {
                notify({ title: 'Still verifying', description: 'DNS changes can take time. We re-check automatically.', variant: 'info' })
            }
        } catch (error) {
            notify({ title: 'Verification failed', description: error instanceof Error ? error.message : 'Unable to verify this domain', variant: 'critical' })
        } finally {
            setBusy(false)
        }
    }, [busy, cleanedDomain, notify, onConnected, store])

    return (
        <div className="domains-wizard">
            <div className="domains-wizard-head">
                <button type="button" className="domains-back" onClick={onClose}>
                    <ArrowLeft className="letbuyy-icon" aria-hidden="true" />
                    Domains
                </button>
                <StepDots steps={WIZARD_STEPS} current={Math.max(0, currentIndex)} />
            </div>

            {/* Step 1 — enter domain */}
            {step === 'enter' && (
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Connect a domain you own</div>
                    <div className="settings-form-body">
                        <div className="settings-general-hint">
                            Enter a domain you already own. We&apos;ll detect your provider and give you the exact records to add — no DNS expertise needed.
                        </div>
                        <Input
                            label="Domain"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="example.com, shop.example.com"
                            autoComplete="url"
                            helperText={domain && !domainValid ? 'Enter a valid domain like example.com or shop.example.com' : 'Use your root domain or a subdomain.'}
                        />
                        <div className="domains-wizard-actions">
                            <Button variant="secondary" onClick={onClose}>Cancel</Button>
                            <Button onClick={() => void handleConnect()} loading={busy} disabled={!domainValid}>
                                Continue
                                <ArrowRight className="letbuyy-icon" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Steps 2+3 — provider + DNS instructions */}
            {step === 'instructions' && records && (
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Add these DNS records</div>
                    <div className="settings-form-body">
                        <div className="domains-provider-banner">
                            <span className="domains-provider-icon"><Globe className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="domains-provider-copy">
                                <span className="domains-provider-title">{cleanedDomain}</span>
                                <span className="domains-provider-sub">
                                    {provider ? <>Managed by <strong>{provider}</strong></> : 'DNS provider not detected'} · Add the records below at your provider
                                </span>
                            </div>
                            {providerLink && (
                                <a className="domains-provider-cta" href={providerLink} target="_blank" rel="noopener noreferrer">
                                    Open {provider} DNS
                                    <ExternalLink className="letbuyy-icon" aria-hidden="true" />
                                </a>
                            )}
                        </div>

                        <div className="domains-manual-hint">
                            <strong>Manual setup</strong> — LetBuyy can&apos;t edit your provider&apos;s DNS for you, so add these records yourself{provider ? ` at ${provider}` : ''}. {providerLink ? 'Use the button above to jump straight there.' : 'Open your DNS provider in another tab.'}
                        </div>

                        {connectResult?.apex_mx_warning && (
                            <div className="domains-note domains-note--warn">
                                <AlertTriangle className="letbuyy-icon" aria-hidden="true" />
                                <span>This domain receives email. Use <strong>www</strong> as primary, or an ALIAS/CNAME-flattening record at the root, so email keeps working.</span>
                            </div>
                        )}

                        {records.txt && <DnsRecordRow type="TXT" host={records.txt.name} value={records.txt.value} state="pending" message="Proves you own the domain." />}
                        {records.cname && <DnsRecordRow type="CNAME" host={records.cname.name} value={records.cname.value} state="pending" message="Points your storefront traffic to LetBuyy." />}

                        <div className="domains-note">
                            <Info className="letbuyy-icon" aria-hidden="true" />
                            <span>After saving the records at your provider, come back and verify. DNS can take a few minutes to a few hours to update.</span>
                        </div>

                        <div className="domains-wizard-actions">
                            <Button variant="secondary" onClick={onClose}>I&apos;ll finish later</Button>
                            <Button onClick={() => void handleVerify()} loading={busy}>
                                I&apos;ve added the records — Verify
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4 — verify result (still pending) */}
            {step === 'verify' && (
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Verifying</div>
                    <div className="settings-form-body">
                        <div className="domains-verify-state">
                            <span className="domains-verify-icon">
                                {busy ? <Loader2 className="letbuyy-icon domains-spin" aria-hidden="true" /> : <AlertTriangle className="letbuyy-icon" aria-hidden="true" />}
                            </span>
                            <div>
                                <p className="domains-verify-title">{busy ? 'Checking your DNS…' : 'Not visible yet'}</p>
                                <p className="domains-verify-sub">
                                    {verifyResult
                                        ? `Ownership ${verifyResult.txt_verified ? 'verified' : 'not found'} · Routing ${verifyResult.cname_verified ? 'verified' : 'not found'}. DNS changes can take time.`
                                        : 'We are checking the records across global DNS.'}
                                </p>
                            </div>
                        </div>
                        <div className="domains-wizard-actions">
                            <Button variant="secondary" onClick={() => setStep('instructions')}>Back to records</Button>
                            <Button onClick={() => void handleVerify()} loading={busy}>Check again</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5 — activated */}
            {step === 'activate' && (
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Connected</div>
                    <div className="settings-form-body">
                        <div className="domains-success">
                            <span className="domains-success-icon"><CheckCircle2 className="letbuyy-icon" aria-hidden="true" /></span>
                            <p className="domains-success-title">{cleanedDomain} is connected</p>
                            <p className="domains-success-sub">Your store is live and secure on this domain. You can make it your primary domain from the overview.</p>
                            <Button onClick={onClose}>
                                <Sparkles className="letbuyy-icon" aria-hidden="true" />
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
