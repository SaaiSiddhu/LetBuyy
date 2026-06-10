'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Check, FileText, Input, MaterialIcon, Palette, Rocket, Store, X } from '@letbuyy/ui'
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
    const [step, setStep] = useState(1)
    const [siteType, setSiteType] = useState('')
    const [storeName, setStoreName] = useState('')
    const [subdomain, setSubdomain] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)

    const handleSubdomainChange = (value: string) => {
        const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
        setSubdomain(cleaned)
        setSubdomainAvailable(null) // Reset check
    }

    const checkSubdomain = async () => {
        if (!subdomain) return
        try {
            const res = await fetch(`${marketingApiBaseUrl()}/stores/public/${subdomain}`)
            setSubdomainAvailable(res.status === 404) // 404 = available
        } catch {
            setSubdomainAvailable(true) // Assume available on error
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
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
            <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-zinc-200 bg-[var(--lb-color-surface)] p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Create Your Site</h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Choose your site type and get started in minutes
                    </p>
                </div>

                {/* Progress */}
                <div className="flex gap-2">
                    {[1, 2].map((s) => (
                        <div
                            key={s}
                            className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Step 1: Site Type */}
                {step === 1 && (
                    <>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            What are you building?
                        </h2>
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
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-zinc-200 bg-zinc-50 hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600'
                                            }`}
                                    >
                                        <Icon className="h-8 w-8" aria-hidden="true" />
                                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{type.title}</h3>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{type.description}</p>
                                    </Button>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                    <>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            Site Details
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="store-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    Site Name
                                </label>
                                <Input unstyled
                                    id="store-name"
                                    type="text"
                                    value={storeName}
                                    onChange={(e) => {
                                        setStoreName(e.target.value)
                                        handleSubdomainChange(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                                    }}
                                    placeholder="My Awesome Store"
                                    className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label htmlFor="subdomain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    Subdomain
                                </label>
                                <div className="mt-1 flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                                    <Input unstyled
                                        id="subdomain"
                                        type="text"
                                        value={subdomain}
                                        onChange={(e) => handleSubdomainChange(e.target.value)}
                                        onBlur={checkSubdomain}
                                        placeholder="my-store"
                                        className="w-full border-none px-4 py-2.5 text-sm outline-none dark:bg-zinc-800 dark:text-zinc-100"
                                    />
                                    <span className="whitespace-nowrap bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                                        .letbuyy.com
                                    </span>
                                </div>
                                {subdomainAvailable === true && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600">
                                        <Check className="h-3 w-3" aria-hidden="true" />
                                        Available
                                    </p>
                                )}
                                {subdomainAvailable === false && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-red-600">
                                        <X className="h-3 w-3" aria-hidden="true" />
                                        Already taken
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button unstyled
                                onClick={() => setStep(1)}
                                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                                Back
                            </Button>
                            <Button unstyled
                                onClick={handleCreate}
                                disabled={!storeName || !subdomain || subdomainAvailable === false || loading}
                                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : (
                                    <span className="inline-flex items-center justify-center gap-1">
                                        Create Site
                                        <MaterialIcon name="arrow_forward" />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </>
                )}

                {/* Login link */}
                <p className="text-center text-sm text-zinc-500">
                    Already have an account?{' '}
                    <Link href="/signup" className="text-blue-600 hover:underline dark:text-blue-400">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
