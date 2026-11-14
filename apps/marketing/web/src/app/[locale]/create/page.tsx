'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import { useEffect, useRef, useState } from 'react'
import Link from '@/components/i18n/LocaleLink'
import { Button, Check, FileText, Input, ArrowRight, Palette, Rocket, Store, X } from '@letbuyy/ui'
import { LETBUYY_PRODUCTION_API_BASE_URL, resolveLetbuyyApiBaseUrl } from '@letbuyy/api-client'
import { getAccountsUrl } from '@/lib/public-urls'

const siteTypes = [
    { id: 'store', title: 'E-commerce Store', description: 'Sell products with cart, checkout, and payments', icon: Store },
    { id: 'landing', title: 'Landing Page', description: 'Marketing page with forms and analytics', icon: Rocket },
    ...(process.env.NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
        ? [
            { id: 'portfolio', title: 'Portfolio', description: 'Legacy portfolio sites for existing cohorts', icon: Palette },
            { id: 'resume', title: 'Resume / CV', description: 'Legacy resume sites for existing cohorts', icon: FileText },
        ]
        : []),
]

function marketingApiBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([process.env.NEXT_PUBLIC_API_URL], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

export default function CreateStorePage() {
    const { t } = useCopy()
    const [step, setStep] = useState(1)
    const [siteType, setSiteType] = useState('')
    const [storeName, setStoreName] = useState('')
    const [subdomain, setSubdomain] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)
    const [availabilityError, setAvailabilityError] = useState(false)
    const availabilityRequest = useRef<AbortController | null>(null)

    useEffect(() => () => availabilityRequest.current?.abort(), [])

    const handleSubdomainChange = (value: string) => {
        availabilityRequest.current?.abort()
        const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
        setSubdomain(cleaned)
        setSubdomainAvailable(null) // Reset check
        setAvailabilityError(false)
    }

    const checkSubdomain = async () => {
        availabilityRequest.current?.abort()
        if (!subdomain) return
        const controller = new AbortController()
        availabilityRequest.current = controller
        setSubdomainAvailable(null)
        setAvailabilityError(false)
        try {
            const res = await fetch(`${marketingApiBaseUrl()}/stores/public/${subdomain}`, { signal: controller.signal })
            if (controller.signal.aborted) return
            if (res.status === 404) setSubdomainAvailable(true)
            else if (res.ok) setSubdomainAvailable(false)
            else setAvailabilityError(true)
        } catch {
            if (!controller.signal.aborted) setAvailabilityError(true)
        }
    }

    const handleCreate = async () => {
        if (!siteType || !storeName || !subdomain) return
        setLoading(true)
        setError(null)

        // Redirect to accounts signup with store creation params
        const params = new URLSearchParams({
            site_type: siteType,
            name: storeName,
            subdomain,
            next: 'onboarding',
        })
        window.location.href = `${getAccountsUrl('/signup')}?${params.toString()}`
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-page p-4">
            <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-line bg-surface p-8 shadow-sm">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-default"><Copy text={"Create Your Site"} /></h1>
                    <p className="mt-2 text-sm text-subdued">
                        <Copy text={"Choose your site type and get started in minutes"} /></p>
                </div>

                {/* Progress */}
                <div className="flex gap-2">
                    {[1, 2].map((s) => (
                        <div
                            key={s}
                            className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-primary-cta' : 'bg-surface-raised'}`}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-lg border border-critical bg-[var(--lb-color-critical-soft)] p-3 text-sm text-[color:var(--lb-semantic-status-text-danger)]">
                        {error}
                    </div>
                )}

                {/* Step 1: Site Type */}
                {step === 1 && (
                    <>
                        <h2 className="text-lg font-semibold text-default">
                            <Copy text={"What are you building?"} /></h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {siteTypes.map((type) => {
                                const Icon = type.icon

                                return (
                                    <Button unstyled
                                        key={type.id}
                                        onClick={() => {
                                            setSiteType(type.id)
                                            setStep(2)
                                        }}
                                        className={`flex flex-col items-center gap-2 rounded-xl border p-6 text-center transition-all
                                            ${siteType === type.id
                                                ? 'border-primary bg-primary-soft'
                                                : 'border-line bg-surface-subdued hover:border-primary'
                                            }`}
                                    >
                                        <Icon className="h-8 w-8" aria-hidden="true" />
                                        <h3 className="font-semibold text-default"><Copy text={type.title} /></h3>
                                        <p className="text-xs text-subdued"><Copy text={type.description} /></p>
                                    </Button>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                    <>
                        <h2 className="text-lg font-semibold text-default">
                            <Copy text={"Site Details"} /></h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="store-name" className="block text-sm font-medium text-default">
                                    <Copy text={"Site Name"} /></label>
                                <Input unstyled
                                    id="store-name"
                                    type="text"
                                    value={storeName}
                                    onChange={(e) => {
                                        setStoreName(e.target.value)
                                        handleSubdomainChange(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                                    }}
                                    placeholder={t("My Awesome Store")}
                                    className="mt-1 w-full rounded-lg border border-line px-4 py-2.5 text-sm outline-none bg-[var(--lb-component-input-bg)] text-default focus:border-primary focus:ring-2 focus:ring-[var(--lb-component-input-focus-ring)]"
                                />
                            </div>
                            <div>
                                <label htmlFor="subdomain" className="block text-sm font-medium text-default">
                                    <Copy text={"Subdomain"} /></label>
                                <div className="mt-1 flex items-center rounded-lg border border-line overflow-hidden">
                                    <Input unstyled
                                        id="subdomain"
                                        type="text"
                                        value={subdomain}
                                        onChange={(e) => handleSubdomainChange(e.target.value)}
                                        onBlur={checkSubdomain}
                                        placeholder="my-store"
                                        className="w-full border-none px-4 py-2.5 text-sm outline-none bg-[var(--lb-component-input-bg)] text-default"
                                    />
                                    <span className="whitespace-nowrap bg-surface-subdued px-4 py-2.5 text-sm text-muted">
                                        .letbuyy.com
                                    </span>
                                </div>
                                {subdomainAvailable === true && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--lb-semantic-status-text-success)]">
                                        <Check className="h-3 w-3" aria-hidden="true" />
                                        <Copy text={"Available"} /></p>
                                )}
                                {subdomainAvailable === false && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--lb-semantic-status-text-danger)]">
                                        <X className="h-3 w-3" aria-hidden="true" />
                                        <Copy text={"Already taken"} /></p>
                                )}
                                {availabilityError && (
                                    <p role="status" className="mt-1 text-xs text-subdued">
                                        <Copy text={"Something went wrong. Please try again."} />
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button unstyled
                                onClick={() => setStep(1)}
                                className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-default transition-colors hover:bg-surface-subdued"
                            >
                                <Copy text={"Back"} /></Button>
                            <Button unstyled
                                onClick={handleCreate}
                                disabled={!storeName || !subdomain || subdomainAvailable === false || loading}
                                className="flex-1 rounded-lg bg-primary-cta px-4 py-2.5 text-sm font-medium text-[color:var(--lb-component-button-primary-text)] transition-colors hover:bg-[var(--lb-component-button-primary-hover)] disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : (
                                    <span className="inline-flex items-center justify-center gap-1">
                                        <Copy text={"Create Site"} /><ArrowRight width={16} height={16} aria-hidden="true" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </>
                )}

                {/* Login link */}
                <p className="text-center text-sm text-muted">
                    <Copy text={"Already have an account?"} />{' '}
                    <Link href={getAccountsUrl('/lookup')} className="text-[color:var(--lb-color-primary-text)] hover:underline">
                        <Copy text={"Sign in"} /></Link>
                </p>
            </div>
        </main>
    )
}
