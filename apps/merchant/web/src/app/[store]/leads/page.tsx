'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Table,
    Avatar,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    EmptyState,
    Mail,
    MessageSquare,
    Page,
    PageHeader,
    Phone,
    RefreshCw,
    Section,
    Select,
    Skeleton,
    Tabs,
    Trash2,
    User,
    Users,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDateWithTime as formatDate } from '@letbuyy/ui/formatting'

type LeadStatus = 'new' | 'read' | 'contacted' | 'converted'
type LeadFilter = 'all' | LeadStatus

interface Lead {
    id: string
    full_name: string
    email: string
    phone: string | null
    source: string | null
    status: LeadStatus | string
    data: Record<string, unknown> | null
    created_at: string
}

const leadTabs: Array<{ value: LeadFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'read', label: 'Read' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'converted', label: 'Converted' },
]

const statusOptions = [
    { label: 'New', value: 'new' },
    { label: 'Read', value: 'read' },
    { label: 'Contacted', value: 'contacted' },
    { label: 'Converted', value: 'converted' },
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

function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusVariant(status: string) {
    if (status === 'new') return 'info' as const
    if (status === 'contacted') return 'warning' as const
    if (status === 'converted') return 'success' as const
    return 'default' as const
}

function formatSource(source: string | null) {
    if (!source) return 'Unknown source'
    return source
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export default function LeadsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [activeFilter, setActiveFilter] = useState<LeadFilter>('all')
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadLeads = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions?type=lead&limit=100`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load leads'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load leads'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Leads could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadLeads()
    }, [loadLeads])

    const stats = useMemo(() => ({
        total: items.length,
        newLeads: items.filter((item) => item.status === 'new').length,
        converted: items.filter((item) => item.status === 'converted').length,
    }), [items])

    const countsByStatus = useMemo(() => leadTabs.reduce<Record<LeadFilter, number>>((counts, tab) => {
        counts[tab.value] = tab.value === 'all'
            ? items.length
            : items.filter((item) => item.status === tab.value).length
        return counts
    }, {
        all: 0,
        new: 0,
        read: 0,
        contacted: 0,
        converted: 0,
    }), [items])

    const filteredLeads = useMemo(() => {
        if (activeFilter === 'all') return items
        return items.filter((item) => item.status === activeFilter)
    }, [activeFilter, items])

    const updateStatus = useCallback(async (lead: Lead, status: string) => {
        if (lead.status === status || updatingId) return

        setUpdatingId(lead.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(lead.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update lead status'))
            }

            notify({
                title: 'Lead updated',
                description: `${lead.full_name || lead.email} is now ${statusLabel(status).toLowerCase()}.`,
                variant: 'success',
            })
            await loadLeads({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update lead status'
            notify({
                title: 'Could not update lead',
                description: message,
                variant: 'critical',
            })
        } finally {
            setUpdatingId(null)
        }
    }, [loadLeads, notify, store, updatingId])

    const handleDelete = useCallback(async () => {
        if (!leadToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(leadToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete lead'))
            }

            notify({
                title: 'Lead deleted',
                description: `${leadToDelete.full_name || leadToDelete.email} was removed from the pipeline.`,
                variant: 'success',
            })
            setLeadToDelete(null)
            await loadLeads({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete lead'
            notify({
                title: 'Could not delete lead',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [deleting, leadToDelete, loadLeads, notify, store])

    const renderLeads = (leads: Lead[]) => {
        if (items.length === 0) {
            return (
                <EmptyState
                    icon={<Users className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                    title="No leads yet"
                    body="Lead captures and sign-up forms from your storefront will appear here with follow-up status actions."
                    primaryAction={<Button onClick={() => void loadLeads()}><RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Refresh leads</Button>}
                />
            )
        }

        if (leads.length === 0) {
            return (
                <EmptyState
                    icon={<User className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                    title="No leads in this view"
                    body="Switch views or wait for matching lead captures to arrive."
                    secondaryAction={<Button variant="secondary" onClick={() => setActiveFilter('all')}>View all leads</Button>}
                />
            )
        }

        return (
            <div className="overflow-x-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                <Table tableClassName="min-w-full border-collapse bg-[var(--lb-color-surface)] text-left">
                    <thead>
                        <tr className="border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]">
                            <th scope="col" className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Lead</th>
                            <th scope="col" className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Source</th>
                            <th scope="col" className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Captured</th>
                            <th scope="col" className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Status</th>
                            <th scope="col" className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--lb-color-border)]">
                        {leads.map((lead) => (
                            <tr key={lead.id} className="align-top">
                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-4)]">
                                    <div className="flex min-w-[220px] items-start gap-[var(--lb-space-3)]">
                                        <Avatar name={lead.full_name || lead.email} size="md" />
                                        <div className="min-w-0">
                                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{lead.full_name || 'Unnamed lead'}</p>
                                            <p className="m-0 flex items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0" aria-hidden="true" />
                                                <span className="truncate">{lead.email || 'No email'}</span>
                                            </p>
                                            {lead.phone && (
                                                <p className="m-0 flex items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    <Phone className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{lead.phone}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-4)]">
                                    <Badge label={formatSource(lead.source)} variant="default" />
                                </td>
                                <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-4)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                    {formatDate(lead.created_at)}
                                </td>
                                <td className="min-w-[180px] px-[var(--lb-space-4)] py-[var(--lb-space-4)]">
                                    <div className="grid gap-[var(--lb-space-2)]">
                                        <Badge label={statusLabel(lead.status)} variant={statusVariant(lead.status)} />
                                        <Select
                                            aria-label={`Status for ${lead.full_name || lead.email}`}
                                            options={statusOptions}
                                            value={statusOptions.some((option) => option.value === lead.status) ? lead.status : 'read'}
                                            disabled={updatingId === lead.id}
                                            onChange={(event) => void updateStatus(lead, event.target.value)}
                                        />
                                    </div>
                                </td>
                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-4)] text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Delete ${lead.full_name || lead.email}`}
                                        onClick={() => setLeadToDelete(lead)}
                                    >
                                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
        )
    }

    if (loading) {
        return (
            <Page>
                <PageHeader identity="customers"
                    recipe="index"
                    title="Leads"
                    description="Track storefront lead captures and move each prospect through follow-up."
                    breadcrumbs={[{ label: 'Customers' }, { label: 'Leads' }]}
                />
                <Card>
                    <Section title="Lead pipeline">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    const tabs = leadTabs.map((tab) => ({
        value: tab.value,
        label: tab.label,
        badge: String(countsByStatus[tab.value]),
        content: renderLeads(filteredLeads),
    }))

    return (
        <Page>
            <PageHeader identity="customers"
                recipe="index"
                title="Leads"
                description="Track storefront lead captures and move each prospect through follow-up."
                breadcrumbs={[{ label: 'Customers' }, { label: 'Leads' }]}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadLeads(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Leads could not load"
                    action={<Button variant="secondary" onClick={() => void loadLeads()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Users className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total leads</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">New</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.newLeads}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <User className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Converted</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.converted}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            <Card>
                <Section
                    title="Lead pipeline"
                    description="Update status as prospects move from a fresh capture to a converted customer."
                >
                    <Tabs items={tabs} value={activeFilter} onValueChange={(value) => setActiveFilter(value as LeadFilter)} />
                </Section>
            </Card>

            <ConfirmDialog
                open={Boolean(leadToDelete)}
                title="Delete lead?"
                description={leadToDelete ? `Delete ${leadToDelete.full_name || leadToDelete.email}? This cannot be undone.` : 'Delete this lead?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete lead'}
                cancelLabel="Keep lead"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setLeadToDelete(null)
                }}
            />
        </Page>
    )
}
