'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    Globe,
    Input,
    Section,
    Skeleton,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface DomainStoreData {
    id: string
    subdomain: string
    custom_domain: string
}

type SaveState = 'saved' | 'unsaved' | 'saving'

function readString(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

export default function DomainSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [storeData, setStoreData] = useState<DomainStoreData>({
        id: '',
        subdomain: '',
        custom_domain: '',
    })
    const [initialDomain, setInitialDomain] = useState('')
    const [customDomain, setCustomDomain] = useState('')

    const normalizedDomain = customDomain.trim()
    const hasUnsavedChanges = useMemo(() => normalizedDomain !== initialDomain, [initialDomain, normalizedDomain])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    useEffect(() => {
        let mounted = true

        async function load() {
            setLoading(true)
            setLoadError(null)

            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                    cache: 'no-store',
                })
                const payload = await response.json() as { data?: Record<string, unknown>; error?: string }

                if (!response.ok) {
                    throw new Error(payload.error || 'Unable to load domain settings')
                }

                const data = payload.data
                if (!data) {
                    throw new Error('Domain settings were not returned for this store')
                }

                const nextDomain = readString(data, 'custom_domain')
                const nextStoreData: DomainStoreData = {
                    id: readString(data, 'id'),
                    subdomain: readString(data, 'subdomain', readString(data, 'store_name')),
                    custom_domain: nextDomain,
                }

                if (!mounted) return
                setStoreData(nextStoreData)
                setCustomDomain(nextDomain)
                setInitialDomain(nextDomain)
                setSaveState('saved')
            } catch (error) {
                if (!mounted) return
                const message = error instanceof Error ? error.message : 'Unable to load domain settings'
                setLoadError(message)
                notify({
                    title: 'Domain settings could not load',
                    description: message,
                    variant: 'critical',
                })
            } finally {
                if (mounted) setLoading(false)
            }
        }

        void load()

        return () => {
            mounted = false
        }
    }, [notify, store])

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ custom_domain: normalizedDomain || null }),
            })
            const payload = await response.json() as { error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save domain settings')
            }

            setStoreData((current) => ({ ...current, custom_domain: normalizedDomain }))
            setInitialDomain(normalizedDomain)
            setCustomDomain(normalizedDomain)
            setSaveState('saved')
            notify({
                title: 'Domain settings saved',
                description: normalizedDomain
                    ? `${normalizedDomain} is saved as your custom domain.`
                    : 'Custom domain was cleared.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save domain settings'
            setSaveState('unsaved')
            notify({
                title: 'Could not save domain settings',
                description: message,
                variant: 'critical',
            })
        }
    }, [hasUnsavedChanges, normalizedDomain, notify, saveState, store])

    const handleDiscard = useCallback(() => {
        setCustomDomain(initialDomain)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'Domain settings were reset to the last saved version.',
            variant: 'info',
        })
    }, [initialDomain, notify])

    if (loading) {
        return (
            <SettingsPane
                title="Domains"
                description="Manage LetBuyy and custom domains for this store."
                store={store}
            >
                <Card>
                    <Section title="Primary domain">
                        <Skeleton variant="text" lines={3} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Custom domain">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            title="Domains"
            description="Manage LetBuyy and custom domains for this store."
            store={store}
            guidance={{
                title: 'Custom domains need DNS setup',
                body: 'Connect a custom domain to give your store a professional web address. Update DNS before switching traffic.',
            }}
            saveBar={{
                state: activeSaveState,
                onSave: () => void handleSave(),
                onDiscard: handleDiscard,
                saveLabel: 'Save domain',
            }}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Domain settings could not load"
                    action={<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Primary domain"
                    description="The LetBuyy-hosted domain remains available even when a custom domain is connected."
                >
                    <div className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Globe className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <span className="truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                {storeData.subdomain}.letbuyy.store
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Badge label="Primary" variant="success" />
                            <Badge label="Connected" variant="success" />
                        </div>
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Custom domain"
                    description="Point a CNAME record from your domain to the LetBuyy storefront host."
                >
                    <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        CNAME target: <code className="rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]">stores.letbuyy.store</code>
                    </div>
                    <Input
                        label="Domain"
                        value={customDomain}
                        onChange={(event) => setCustomDomain(event.target.value)}
                        placeholder="e.g. shop.yourdomain.com"
                        helperText={storeData.custom_domain ? `Current custom domain: ${storeData.custom_domain}` : 'Leave blank to use only the LetBuyy-hosted domain.'}
                        autoComplete="url"
                    />
                </Section>
            </Card>
        </SettingsPane>
    )
}
