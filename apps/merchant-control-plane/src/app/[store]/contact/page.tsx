'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Avatar,
    Badge,
    Banner,
    Button,
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
    Skeleton,
    Trash2,
    X,
    useToast,
} from '@letbuyy/ui'

interface Submission {
    id: string
    full_name: string
    email: string
    phone: string | null
    subject: string | null
    message: string
    status: string
    created_at: string
}

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

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function statusVariant(status: string) {
    if (status === 'new') return 'info' as const
    if (status === 'read' || status === 'replied') return 'success' as const
    if (status === 'spam') return 'warning' as const
    return 'default' as const
}

function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function ContactPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Submission[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [selected, setSelected] = useState<Submission | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadSubmissions = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions?type=contact&limit=100`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load contact submissions'))
            }

            const nextItems = Array.isArray(payload?.data) ? payload.data : []
            setItems(nextItems)
            setSelected((current) => {
                if (!current) return current
                return nextItems.find((item: Submission) => item.id === current.id) || null
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load contact submissions'
            setItems([])
            setSelected(null)
            setLoadError(message)
            notify({
                title: 'Contact submissions could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadSubmissions()
    }, [loadSubmissions])

    const stats = useMemo(() => ({
        total: items.length,
        unread: items.filter((item) => item.status === 'new').length,
        withPhone: items.filter((item) => Boolean(item.phone)).length,
    }), [items])

    const markRead = useCallback(async (submission: Submission) => {
        if (submission.status !== 'new') return

        setUpdatingId(submission.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(submission.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'read' }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to mark submission as read'))
            }

            notify({
                title: 'Submission marked read',
                description: `${submission.full_name}'s message moved out of unread.`,
                variant: 'success',
            })
            await loadSubmissions({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to mark submission as read'
            notify({
                title: 'Could not update submission',
                description: message,
                variant: 'critical',
            })
        } finally {
            setUpdatingId(null)
        }
    }, [loadSubmissions, notify, store])

    const openSubmission = useCallback((submission: Submission) => {
        setSelected(submission)
        void markRead(submission)
    }, [markRead])

    const handleDelete = useCallback(async () => {
        if (!submissionToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/form-submissions/${encodeURIComponent(submissionToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete contact submission'))
            }

            notify({
                title: 'Submission deleted',
                description: `${submissionToDelete.full_name}'s contact message was removed.`,
                variant: 'success',
            })
            if (selected?.id === submissionToDelete.id) setSelected(null)
            setSubmissionToDelete(null)
            await loadSubmissions({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete contact submission'
            notify({
                title: 'Could not delete submission',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [deleting, loadSubmissions, notify, selected?.id, store, submissionToDelete])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Contact submissions"
                    description="Review customer questions and reply from one focused inbox."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Contact' }]}
                />
                <Card>
                    <Section title="Inbox">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Contact submissions"
                description="Review customer questions and reply from one focused inbox."
                breadcrumbs={[{ label: 'Content' }, { label: 'Contact' }]}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadSubmissions(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Contact submissions could not load"
                    action={<Button variant="secondary" onClick={() => void loadSubmissions()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total messages</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Unread</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.unread}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Phone className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">With phone</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.withPhone}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            {items.length === 0 ? (
                <Card>
                    <Section title="Inbox">
                        <EmptyState
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No contact submissions yet"
                            body="Messages sent through your storefront contact form will appear here with reply and moderation actions."
                            secondaryAction={<Button variant="secondary" onClick={() => void loadSubmissions()}><RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Refresh</Button>}
                        />
                    </Section>
                </Card>
            ) : (
                <div className={selected ? 'grid gap-[var(--lb-space-4)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]' : 'grid gap-[var(--lb-space-4)]'}>
                    <Card>
                        <Section
                            title="Inbox"
                            description="Open a message to mark it read and reveal reply actions."
                        >
                            <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                                {items.map((submission) => {
                                    const isSelected = selected?.id === submission.id
                                    const isUnread = submission.status === 'new'

                                    return (
                                        <button
                                            key={submission.id}
                                            type="button"
                                            className={[
                                                'grid w-full gap-[var(--lb-space-2)] p-[var(--lb-space-4)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                                isSelected ? 'bg-[var(--lb-color-surface-subdued)]' : 'hover:bg-[var(--lb-color-surface-subdued)]',
                                            ].join(' ')}
                                            onClick={() => openSubmission(submission)}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-3)]">
                                                <div className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                                                    <Avatar name={submission.full_name || submission.email} size="md" />
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                            <p className={[
                                                                'm-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]',
                                                                isUnread ? 'font-[var(--lb-font-weight-semibold)]' : 'font-[var(--lb-font-weight-medium)]',
                                                            ].join(' ')}>
                                                                {submission.full_name}
                                                            </p>
                                                            <Badge label={statusLabel(submission.status)} variant={statusVariant(submission.status)} />
                                                        </div>
                                                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                            {submission.subject || 'No subject'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {formatDate(submission.created_at)}
                                                </span>
                                            </div>
                                            <p className="m-0 truncate text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                                {submission.message}
                                            </p>
                                            {updatingId === submission.id && (
                                                <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    Marking as read...
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </Section>
                    </Card>

                    {selected && (
                        <Card>
                            <Section>
                                <div className="grid gap-[var(--lb-space-4)]">
                                    <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                    {selected.subject || 'No subject'}
                                                </h2>
                                                <Badge label={statusLabel(selected.status)} variant={statusVariant(selected.status)} />
                                            </div>
                                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {formatDate(selected.created_at)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Close submission details"
                                            onClick={() => setSelected(null)}
                                        >
                                            <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
                                    </div>

                                    <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                        <Avatar name={selected.full_name || selected.email} size="lg" />
                                        <div className="min-w-0">
                                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{selected.full_name}</p>
                                            <p className="m-0 flex flex-wrap items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                {selected.email}
                                            </p>
                                            {selected.phone && (
                                                <p className="m-0 flex flex-wrap items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    <Phone className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    {selected.phone}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <p className="m-0 whitespace-pre-wrap text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        {selected.message}
                                    </p>

                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                        <a
                                            href={`mailto:${selected.email}`}
                                            className="inline-flex h-[var(--lb-size-control-sm)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-inverse)] shadow-[var(--lb-shadow-sm)] transition-colors hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-color-bg)]"
                                        >
                                            <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            Reply
                                        </a>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setSubmissionToDelete(selected)}
                                            className="text-[var(--lb-color-critical)]"
                                        >
                                            <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </Section>
                        </Card>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={Boolean(submissionToDelete)}
                title="Delete contact submission?"
                description={submissionToDelete ? `Delete ${submissionToDelete.full_name}'s message? This cannot be undone.` : 'Delete this contact submission?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete submission'}
                cancelLabel="Keep submission"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setSubmissionToDelete(null)
                }}
            />
        </Page>
    )
}
