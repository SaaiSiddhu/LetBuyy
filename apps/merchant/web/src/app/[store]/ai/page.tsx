'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import type { AIUsageRecord } from '@letbuyy/shared-types'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Table,
    Activity,
    Badge,
    Banner,
    Card,
    Edit3,
    EmptyState,
    FileText,
    Image as ImageIcon,
    Mail,
    MetricCard,
    Page,
    PageHeader,
    RefreshCw,
    Search,
    Section,
    Share2,
    Skeleton,
    Sparkles,
    type TableColumn,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDayMonthTime as formatDate } from '@letbuyy/ui/formatting'

type AiUsageRow = Pick<AIUsageRecord, 'id' | 'feature' | 'credits_used'> & {
    tokens: number
    created_at: string | null
}

interface Credits {
    total: number
    used: number
    remaining: number
}

const aiFeatures = [
    {
        key: 'product_description',
        icon: FileText,
        label: 'Product descriptions',
        description: 'Auto-generate compelling product descriptions.',
    },
    {
        key: 'seo_content',
        icon: Search,
        label: 'SEO content',
        description: 'Generate meta titles, descriptions, and keywords.',
    },
    {
        key: 'blog_draft',
        icon: Edit3,
        label: 'Blog drafts',
        description: 'Create blog post outlines and first drafts.',
    },
    {
        key: 'social_media',
        icon: Share2,
        label: 'Social posts',
        description: 'Write social media captions and posts.',
    },
    {
        key: 'email_copy',
        icon: Mail,
        label: 'Email copy',
        description: 'Draft marketing emails and newsletters.',
    },
    {
        key: 'image_alt',
        icon: ImageIcon,
        label: 'Image alt text',
        description: 'Generate accessible alt text for product images.',
    },
]

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

function formatFeature(value: string) {
    return value.replace(/_/g, ' ')
}

export default function AiStudioPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [credits, setCredits] = useState<Credits>({ total: 0, used: 0, remaining: 0 })
    const [usage, setUsage] = useState<AIUsageRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    const beginRead = useReadRequest(store)
    const loadAiStudio = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/ai`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load AI Studio'))
            }

            const creditData = payload?.data?.credits
            if (creditData) {
                const total = Number(creditData.plan_credits ?? 0) + Number(creditData.bonus_credits ?? 0) + Number(creditData.total_purchased ?? 0)
                const used = Number(creditData.total_used)
                const remaining = Number(creditData.balance)
                if (![total, used, remaining].every(Number.isFinite)) throw new Error('AI credit information is unavailable')
                setCredits({ total, used, remaining })
            } else {
                throw new Error('AI credit information is unavailable')
            }
            setUsage(Array.isArray(payload?.data?.usage) ? payload.data.usage : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load AI Studio'
            setCredits({ total: 0, used: 0, remaining: 0 })
            setUsage([])
            setLoadError(message)
            notify({
                title: 'AI Studio could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadAiStudio()
    }, [loadAiStudio])

    const percentUsed = credits.total > 0 ? Math.round((credits.used / credits.total) * 100) : 0
    const usageRows = useMemo<AiUsageRow[]>(
        () => usage.map((item) => ({
            id: item.id,
            feature: item.feature,
            tokens: Number(item.tokens_input ?? 0) + Number(item.tokens_output ?? 0),
            credits_used: item.credits_used,
            created_at: item.created_at || null,
        })),
        [usage],
    )
    const usageColumns = useMemo<TableColumn<AiUsageRow>[]>(() => [
        {
            key: 'feature',
            header: 'Feature',
            render: (row) => (
                <span className="capitalize text-[var(--lb-color-text)]">
                    {formatFeature(row.feature || 'unknown')}
                </span>
            ),
        },
        {
            key: 'tokens',
            header: 'Tokens',
            render: (row) => (
                <span className="text-[var(--lb-color-text-subdued)]">
                    {row.tokens.toLocaleString('en-IN')}
                </span>
            ),
        },
        {
            key: 'credits_used',
            header: 'Credits',
            render: (row) => <Badge label={row.credits_used.toLocaleString('en-IN')} variant="default" />,
        },
        {
            key: 'created_at',
            header: 'Date',
            render: (row) => (
                <span className="text-[var(--lb-color-text-subdued)]">
                    {row.created_at ? formatDate(row.created_at) : '—'}
                </span>
            ),
        },
    ], [])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="AI Studio"
                    description="Monitor AI credits and the tools available to speed up merchant content work."
                    breadcrumbs={[{ label: 'Store' }, { label: 'AI Studio' }]}
                />
                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                    <Skeleton variant="card" lines={3} />
                    <Skeleton variant="card" lines={3} />
                    <Skeleton variant="card" lines={3} />
                </div>
                <Card>
                    <Section title="AI tools">
                        <Skeleton variant="card" lines={8} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="AI Studio"
                description="Monitor AI credits and the tools available to speed up merchant content work."
                breadcrumbs={[{ label: 'Store' }, { label: 'AI Studio' }]}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadAiStudio(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="AI Studio could not load"
                    action={<Button variant="secondary" onClick={() => void loadAiStudio()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                <MetricCard
                    label="Credits remaining"
                    value={credits.remaining.toLocaleString('en-IN')}
                    delta={credits.total > 0 ? `${percentUsed}% used` : 'No plan credit data'}
                    deltaTone={percentUsed > 80 ? 'negative' : percentUsed > 50 ? 'neutral' : 'positive'}
                />
                <MetricCard
                    label="Credits used"
                    value={credits.used.toLocaleString('en-IN')}
                    delta={`${credits.total.toLocaleString('en-IN')} total credits`}
                    deltaTone="neutral"
                />
                <MetricCard
                    label="Recent generations"
                    value={usage.length.toLocaleString('en-IN')}
                    delta="Latest 20 AI usage events"
                    deltaTone="neutral"
                />
            </div>

            <Card>
                <Section
                    title="AI credits"
                    description="Track consumption before merchants start generating product, SEO, and campaign copy."
                >
                    <progress
                        value={credits.used}
                        max={credits.total || 1}
                        className="h-[var(--lb-space-3)] w-full overflow-hidden rounded-[var(--lb-radius-full)] accent-[var(--lb-color-primary)]"
                        aria-label="AI credit usage"
                    />
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {percentUsed}% used - {credits.used.toLocaleString('en-IN')} credits consumed.
                    </p>
                </Section>
            </Card>

            <Card>
                <Section
                    title="AI tools"
                    description="Content helpers available to this store through the existing AI Studio surface."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-3">
                        {aiFeatures.map((feature) => {
                            const Icon = feature.icon
                            return (
                                <div
                                    key={feature.key}
                                    className="flex gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                                >
                                    <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                            <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {feature.label}
                                            </h3>
                                            <Badge label="Available" variant="success" />
                                        </div>
                                        <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Recent usage"
                    description="A record of the latest AI generations and credit consumption."
                >
                    {usageRows.length > 0 ? (
                        <Table
                            columns={usageColumns}
                            rows={usageRows}
                            emptyMessage="No AI usage yet"
                        />
                    ) : (
                        <EmptyState
                            icon={<Activity className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No AI usage yet"
                            body="AI generations will appear here after merchants use product copy, SEO, blog, social, email, or image alt text tools."
                            secondaryAction={(
                                <span className="inline-flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    <Sparkles className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Ready for first generation
                                </span>
                            )}
                        />
                    )}
                </Section>
            </Card>
        </Page>
    )
}
