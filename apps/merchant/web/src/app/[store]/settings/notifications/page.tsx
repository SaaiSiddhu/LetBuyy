'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Bell,
    Button,
    EmptyState,
    Input,
    Mail,
    MessageSquare,
    Package,
    Pagination,
    RefreshCw,
    Section,
    Select,
    ShoppingBag,
    Skeleton,
    StatusBadge,
    Switch,
    Table,
    User,
    AlertTriangle,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
import { formatIndiaDateWithTime } from '@letbuyy/ui/formatting'
import { SettingsPane } from '@/components/settings/SettingsPane'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationPreference {
    id: string
    user_id: string
    store_id: string | null
    channel: string
    category: string
    enabled: boolean
    created_at: string
}

interface DeliveryLog {
    id: string
    channel: string
    category: string
    template_key: string
    event_type: string | null
    status: string
    provider: string | null
    attempt_count: number | null
    error_message: string | null
    created_at: string
}

interface DeliveryMeta {
    total: number
    page: number
    per_page: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
}

// ---------------------------------------------------------------------------
// Static channel × category matrix
// The backend allows any channel/category pair; we surface the meaningful ones.
// ---------------------------------------------------------------------------

type NotificationChannel = 'email' | 'in_app' | 'sms' | 'push'

interface PrefDef {
    channel: NotificationChannel
    category: string
    label: string
    description: string
    icon: React.ReactNode
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
    email: 'Email',
    in_app: 'In-app',
    sms: 'SMS',
    push: 'Push',
}

const PREF_MATRIX: PrefDef[] = [
    {
        channel: 'email',
        category: 'orders',
        label: 'Order emails',
        description: 'New order, cancellation, and fulfilment confirmation emails',
        icon: <ShoppingBag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'in_app',
        category: 'orders',
        label: 'Order alerts',
        description: 'New orders and payment events in the notification panel',
        icon: <Bell className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'email',
        category: 'inventory',
        label: 'Low-stock emails',
        description: 'Email alert when a product variant drops below its reorder threshold',
        icon: <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'in_app',
        category: 'inventory',
        label: 'Low-stock alerts',
        description: 'In-app notification panel alert for low-stock variants',
        icon: <Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'email',
        category: 'customers',
        label: 'New customer emails',
        description: 'Email when a new customer account is created in your store',
        icon: <User className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'in_app',
        category: 'reviews',
        label: 'Review alerts',
        description: 'In-app notification when a customer submits a product review',
        icon: <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
    {
        channel: 'email',
        category: 'marketing',
        label: 'Marketing campaign emails',
        description: 'Send and delivery reports for email campaigns you publish',
        icon: <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />,
    },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(status: string): StatusVariant {
    if (status === 'sent' || status === 'delivered') return 'success'
    if (status === 'suppressed') return 'warning'
    if (status === 'failed' || status === 'bounced') return 'critical'
    return 'default'
}

function channelLabel(ch: string): string {
    return CHANNEL_LABELS[ch as NotificationChannel] ?? ch
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v && typeof v === 'object' && !Array.isArray(v))
}

function normalizePreference(raw: Record<string, unknown>): NotificationPreference {
    return {
        id: String(raw.id ?? ''),
        user_id: String(raw.user_id ?? ''),
        store_id: typeof raw.store_id === 'string' ? raw.store_id : null,
        channel: String(raw.channel ?? ''),
        category: String(raw.category ?? ''),
        enabled: raw.enabled !== false,
        created_at: String(raw.created_at ?? ''),
    }
}

function normalizeLog(raw: Record<string, unknown>): DeliveryLog {
    return {
        id: String(raw.id ?? ''),
        channel: String(raw.channel ?? ''),
        category: String(raw.category ?? ''),
        template_key: String(raw.template_key ?? ''),
        event_type: typeof raw.event_type === 'string' ? raw.event_type : null,
        status: String(raw.status ?? ''),
        provider: typeof raw.provider === 'string' ? raw.provider : null,
        attempt_count: typeof raw.attempt_count === 'number' ? raw.attempt_count : null,
        error_message: typeof raw.error_message === 'string' ? raw.error_message : null,
        created_at: String(raw.created_at ?? ''),
    }
}

// Build a key identifying a preference row in the matrix
function prefKey(channel: string, category: string) {
    return `${channel}::${category}`
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const CHANNEL_OPTIONS = [
    { value: '', label: 'All channels' },
    { value: 'email', label: 'Email' },
    { value: 'in_app', label: 'In-app' },
    { value: 'sms', label: 'SMS' },
    { value: 'push', label: 'Push' },
]

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'suppressed', label: 'Suppressed' },
    { value: 'failed', label: 'Failed' },
    { value: 'bounced', label: 'Bounced' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    // ── Preferences state ────────────────────────────────────────────────────
    const [prefsLoading, setPrefsLoading] = useState(true)
    const [prefsError, setPrefsError] = useState<string | null>(null)
    // Map of "channel::category" → enabled boolean (from DB)
    const [prefMap, setPrefMap] = useState<Map<string, boolean>>(new Map())
    // Track in-flight toggles to show optimistic state without double-fire
    const savingRef = useRef<Set<string>>(new Set())

    // ── Delivery log state ───────────────────────────────────────────────────
    const [logsLoading, setLogsLoading] = useState(true)
    const [logsError, setLogsError] = useState<string | null>(null)
    const [logs, setLogs] = useState<DeliveryLog[]>([])
    const [logsMeta, setLogsMeta] = useState<DeliveryMeta>({
        total: 0,
        page: 1,
        per_page: 25,
        total_pages: 1,
        has_next: false,
        has_prev: false,
    })
    const [channelFilter, setChannelFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [logsPage, setLogsPage] = useState(1)

    // ── Load preferences ─────────────────────────────────────────────────────

    const beginPreferences = useReadRequest(store)
    const beginLogs = useReadRequest(store)
    const loadPreferences = useCallback(async (signal?: AbortSignal) => {
        const request = beginPreferences()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        setPrefsLoading(true)
        setPrefsError(null)
        try {
            const res = await fetch(
                `/api/stores/${encodeURIComponent(store)}/notifications/preferences`,
                { cache: 'no-store', signal: readSignal },
            )
            if (signal?.aborted || !request.isCurrent()) return
            const json = (await res.json()) as { data?: unknown[]; error?: unknown }
            if (signal?.aborted || !request.isCurrent()) return
            if (!res.ok) {
                const msg = isRecord(json.error) && typeof json.error.message === 'string'
                    ? json.error.message
                    : typeof json.error === 'string'
                        ? json.error
                        : 'Unable to load preferences'
                throw new Error(msg)
            }
            const rows = (json.data ?? [])
                .filter(isRecord)
                .map(normalizePreference)
            const nextMap = new Map<string, boolean>()
            rows.forEach((r) => nextMap.set(prefKey(r.channel, r.category), r.enabled))
            setPrefMap(nextMap)
        } catch (err) {
            if (signal?.aborted || !request.isCurrent()) return
            const msg = err instanceof Error ? err.message : 'Unable to load preferences'
            setPrefsError(msg)
        } finally {
            if (!signal?.aborted && request.isCurrent()) setPrefsLoading(false)
        }
    }, [beginPreferences, store])

    // ── Load delivery logs ───────────────────────────────────────────────────

    const loadLogs = useCallback(async (
        page: number,
        channel: string,
        status: string,
        signal?: AbortSignal,
    ) => {
        const request = beginLogs()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        setLogsLoading(true)
        setLogsError(null)
        try {
            const url = new URL(
                `/api/stores/${encodeURIComponent(store)}/notifications/delivery-logs`,
                window.location.origin,
            )
            url.searchParams.set('page', String(page))
            url.searchParams.set('limit', '25')
            if (channel) url.searchParams.set('channel', channel)
            if (status) url.searchParams.set('status', status)

            const res = await fetch(url.toString(), { cache: 'no-store', signal: readSignal })
            if (signal?.aborted || !request.isCurrent()) return
            const json = (await res.json()) as {
                data?: unknown[]
                meta?: DeliveryMeta
                error?: unknown
            }
            if (signal?.aborted || !request.isCurrent()) return
            if (!res.ok) {
                const msg = isRecord(json.error) && typeof json.error.message === 'string'
                    ? json.error.message
                    : 'Unable to load delivery logs'
                throw new Error(msg)
            }
            const normalized = (json.data ?? []).filter(isRecord).map(normalizeLog)
            setLogs(normalized)
            setLogsMeta(json.meta ?? {
                total: normalized.length,
                page,
                per_page: 25,
                total_pages: 1,
                has_next: false,
                has_prev: false,
            })
        } catch (err) {
            if (signal?.aborted || !request.isCurrent()) return
            const msg = err instanceof Error ? err.message : 'Unable to load delivery logs'
            setLogsError(msg)
        } finally {
            if (!signal?.aborted && request.isCurrent()) setLogsLoading(false)
        }
    }, [beginLogs, store])

    // ── Initial load ─────────────────────────────────────────────────────────

    useEffect(() => {
        const ac = new AbortController()
        void loadPreferences(ac.signal)
        void loadLogs(1, '', '', ac.signal)
        return () => ac.abort()
    }, [loadPreferences, loadLogs])

    // ── Toggle a preference ──────────────────────────────────────────────────

    const handleToggle = useCallback(async (def: PrefDef) => {
        const key = prefKey(def.channel, def.category)
        if (savingRef.current.has(key)) return

        const currentEnabled = prefMap.get(key) ?? true
        const nextEnabled = !currentEnabled

        // Optimistic update
        setPrefMap((prev) => new Map(prev).set(key, nextEnabled))
        savingRef.current.add(key)

        try {
            const res = await fetch(
                `/api/stores/${encodeURIComponent(store)}/notifications/preferences`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel: def.channel,
                        category: def.category,
                        enabled: nextEnabled,
                    }),
                },
            )
            if (!res.ok) {
                // Revert optimistic
                setPrefMap((prev) => new Map(prev).set(key, currentEnabled))
                const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
                const msg = isRecord(json?.error) && typeof json?.error.message === 'string'
                    ? json.error.message
                    : 'Could not save preference'
                throw new Error(msg)
            }
            notify({
                title: nextEnabled ? 'Notification enabled' : 'Notification disabled',
                description: `${def.label} turned ${nextEnabled ? 'on' : 'off'}.`,
                variant: 'success',
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not save preference'
            notify({ title: 'Error', description: msg, variant: 'critical' })
        } finally {
            savingRef.current.delete(key)
        }
    }, [prefMap, store, notify])

    // ── Log filters ──────────────────────────────────────────────────────────

    function applyFilters() {
        setLogsPage(1)
        void loadLogs(1, channelFilter, statusFilter)
    }

    function clearFilters() {
        setChannelFilter('')
        setStatusFilter('')
        setLogsPage(1)
        void loadLogs(1, '', '')
    }

    function handleLogsPageChange(newPage: number) {
        setLogsPage(newPage)
        void loadLogs(newPage, channelFilter, statusFilter)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <SettingsPane
                navigationKey="notifications"
            title="Notifications"
            description="Control which channel and category alerts are active for this store, and review past delivery evidence."
            store={store}
        >
            {/* ── Preferences section ───────────────────────────────────────── */}
            <Section
                variant="grouped"
                title="Notification preferences"
                action={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void loadPreferences()}
                        disabled={prefsLoading}
                        aria-label="Refresh preferences"
                    >
                        <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />
                        Refresh
                    </Button>
                }
            >
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        Toggle individual channel and category pairs. Changes save immediately.
                    </p>

                    {prefsError && (
                        <Banner
                            variant="critical"
                            title="Could not load preferences"
                            action={
                                <Button variant="secondary" size="sm" onClick={() => void loadPreferences()}>
                                    Retry
                                </Button>
                            }
                        >
                            {prefsError}
                        </Banner>
                    )}

                    {prefsLoading ? (
                        <Skeleton variant="text" lines={7} />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {PREF_MATRIX.map((def) => {
                                const key = prefKey(def.channel, def.category)
                                const enabled = prefMap.get(key) ?? true
                                const isSaving = savingRef.current.has(key)
                                const inputId = `notif-pref-${key}`
                                return (
                                    <div
                                        key={key}
                                        className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <label
                                            htmlFor={inputId}
                                            className="flex min-w-0 flex-1 cursor-pointer items-start gap-[var(--lb-space-3)]"
                                        >
                                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                                {def.icon}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                        {def.label}
                                                    </span>
                                                    <Badge label={channelLabel(def.channel)} variant="default" />
                                                </span>
                                                <span className="mt-[var(--lb-space-1)] block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {def.description}
                                                </span>
                                            </span>
                                        </label>
                                        <div className="flex shrink-0 items-center gap-[var(--lb-space-3)] self-start sm:self-center">
                                            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {enabled ? 'On' : 'Off'}
                                            </span>
                                            <Switch
                                                id={inputId}
                                                checked={enabled}
                                                disabled={isSaving}
                                                onCheckedChange={() => void handleToggle(def)}
                                                aria-label={`Toggle ${def.label}`}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
            </Section>

            {/* ── Delivery logs section ─────────────────────────────────────── */}
            <Section variant="grouped" title="Delivery logs">
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        Evidence of every notification routed through the platform for this store.
                    </p>

                    {/* Filters */}
                    <div className="flex flex-col gap-[var(--lb-space-3)] sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Select
                                id="log-channel-filter"
                                label="Channel"
                                value={channelFilter}
                                onChange={(e) => setChannelFilter(e.target.value)}
                                options={CHANNEL_OPTIONS}
                            />
                        </div>
                        <div className="flex-1">
                            <Select
                                id="log-status-filter"
                                label="Status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                options={STATUS_OPTIONS}
                            />
                        </div>
                        <div className="flex flex-wrap gap-[var(--lb-space-2)] sm:self-end">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={applyFilters}
                                disabled={logsLoading}
                            >
                                Apply
                            </Button>
                            {(channelFilter || statusFilter) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    disabled={logsLoading}
                                >
                                    Clear
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void loadLogs(logsPage, channelFilter, statusFilter)}
                                disabled={logsLoading}
                                aria-label="Refresh delivery logs"
                            >
                                <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden />
                            </Button>
                        </div>
                    </div>

                    {logsError && (
                        <Banner
                            variant="critical"
                            title="Could not load delivery logs"
                            action={
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void loadLogs(logsPage, channelFilter, statusFilter)}
                                >
                                    Retry
                                </Button>
                            }
                            className="mb-[var(--lb-space-4)]"
                        >
                            {logsError}
                        </Banner>
                    )}

                    {logsLoading ? (
                        <Skeleton variant="text" lines={6} />
                    ) : logs.length === 0 ? (
                        <EmptyState
                            kind="generic"
                            title="No delivery logs"
                            body={
                                channelFilter || statusFilter
                                    ? 'No logs match the current filters. Try clearing them.'
                                    : 'Notifications sent through this store will appear here.'
                            }
                            primaryAction={
                                channelFilter || statusFilter ? (
                                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <>
                            {/* Log table */}
                            <div className="overflow-x-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                                <Table className="w-full min-w-[640px] border-collapse text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                                    <thead>
                                        <tr className="bg-[var(--lb-color-surface-subdued)] text-left text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Template</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Channel</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Category</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Status</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Provider</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">Sent at</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--lb-color-border)]">
                                        {logs.map((log) => (
                                            <tr
                                                key={log.id}
                                                className="bg-[var(--lb-color-surface)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)]"
                                            >
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                    <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                                                        {log.template_key}
                                                    </span>
                                                    {log.error_message && (
                                                        <span className="mt-[var(--lb-space-1)] block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-critical)]">
                                                            {log.error_message}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                                    {channelLabel(log.channel)}
                                                </td>
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                                    {log.category}
                                                </td>
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                    <StatusBadge
                                                        status={log.status}
                                                        label={log.status}
                                                        variant={statusVariant(log.status)}
                                                    />
                                                </td>
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                                    {log.provider ?? '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                                    {formatIndiaDateWithTime(log.created_at)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {logsMeta.total_pages > 1 && (
                                <div className="mt-[var(--lb-space-4)] flex items-center justify-between gap-[var(--lb-space-4)]">
                                    <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {logsMeta.total} log{logsMeta.total === 1 ? '' : 's'} · page {logsMeta.page} of {logsMeta.total_pages}
                                    </span>
                                    <Pagination
                                        page={logsMeta.page}
                                        totalPages={logsMeta.total_pages}
                                        onPageChange={handleLogsPageChange}
                                    />
                                </div>
                            )}
                        </>
                    )}
            </Section>
        </SettingsPane>
    )
}
