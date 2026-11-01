'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { COMMENT_MODERATION_STATUS_PRESENTATION, presentStatus } from '@letbuyy/shared-types'
import { AlertTriangle, Avatar, Badge, Banner, Button, Card, Check, ConfirmDialog, Mail, MessageSquare, Page, PageHeader, RefreshCw, Section, Skeleton, StatusPresentationBadge, Tabs, Trash2, useToast } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'

type CommentStatus = 'pending' | 'approved' | 'spam'

interface BlogComment {
    id: string
    post_id: string
    post_title?: string
    author_name: string
    author_email: string
    content: string
    status: CommentStatus
    created_at: string
}

const tabLabels: Array<{ value: 'all' | CommentStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'spam', label: 'Spam' },
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

function statusLabel(status: CommentStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function CommentsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [comments, setComments] = useState<BlogComment[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | CommentStatus>('all')
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [commentToDelete, setCommentToDelete] = useState<BlogComment | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadComments = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments?limit=100`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load comments'))
            }

            setComments(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load comments'
            setComments([])
            setLoadError(message)
            notify({
                title: 'Comments could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadComments()
    }, [loadComments])

    const stats = useMemo(() => ({
        total: comments.length,
        pending: comments.filter((comment) => comment.status === 'pending').length,
        approved: comments.filter((comment) => comment.status === 'approved').length,
        spam: comments.filter((comment) => comment.status === 'spam').length,
    }), [comments])

    const updateStatus = useCallback(async (comment: BlogComment, status: CommentStatus) => {
        setUpdatingId(comment.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments/${encodeURIComponent(comment.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update comment'))
            }

            notify({
                title: status === 'approved' ? 'Comment approved' : 'Comment marked as spam',
                description: `${comment.author_name}'s comment is now ${status}.`,
                variant: 'success',
            })
            await loadComments({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update comment'
            notify({
                title: 'Could not update comment',
                description: message,
                variant: 'critical',
            })
        } finally {
            setUpdatingId(null)
        }
    }, [loadComments, notify, store])

    const handleDelete = useCallback(async () => {
        if (!commentToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/blog-comments/${encodeURIComponent(commentToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete comment'))
            }

            notify({
                title: 'Comment deleted',
                description: `${commentToDelete.author_name}'s comment was removed.`,
                variant: 'success',
            })
            setCommentToDelete(null)
            await loadComments({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete comment'
            notify({
                title: 'Could not delete comment',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [commentToDelete, deleting, loadComments, notify, store])

    const renderComments = useCallback((items: BlogComment[]) => (
        items.length === 0 ? (
            <EmptyState scene="comments"
                icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                title="No comments in this view"
                body="Switch moderation views or wait for readers to comment on published posts."
            />
        ) : (
            <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                {items.map((comment) => (
                    <article key={comment.id} className="grid gap-[var(--lb-space-3)] p-[var(--lb-space-4)]">
                        <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-3)]">
                            <div className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                                <Avatar name={comment.author_name || comment.author_email} size="md" />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                        <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{comment.author_name}</p>
                                        <StatusPresentationBadge presentation={presentStatus(COMMENT_MODERATION_STATUS_PRESENTATION, comment.status)} />
                                    </div>
                                    <p className="m-0 flex items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        <Mail className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        {comment.author_email}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                {formatDate(comment.created_at)}
                            </span>
                        </div>

                        {comment.post_title && (
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                On <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{comment.post_title}</span>
                            </p>
                        )}

                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {comment.content}
                        </p>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            {comment.status !== 'approved' && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    loading={updatingId === comment.id}
                                    onClick={() => void updateStatus(comment, 'approved')}
                                >
                                    <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Approve
                                </Button>
                            )}
                            {comment.status !== 'spam' && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    loading={updatingId === comment.id}
                                    onClick={() => void updateStatus(comment, 'spam')}
                                >
                                    <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Mark spam
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={deleting}
                                onClick={() => setCommentToDelete(comment)}
                            >
                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Delete
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        )
    ), [deleting, updateStatus, updatingId])

    const tabs = useMemo(() => (
        tabLabels.map((tab) => {
            const items = tab.value === 'all' ? comments : comments.filter((comment) => comment.status === tab.value)
            return {
                value: tab.value,
                label: tab.label,
                badge: String(items.length),
                content: renderComments(items),
            }
        })
    ), [comments, renderComments])

    if (loading) {
        return (
            <Page>
                <PageHeader identity="content"
                    recipe="index"
                    title="Comments"
                    description="Moderate blog comments before they appear on your site."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Comments' }]}
                />
                <Card>
                    <Section title="Moderation queue">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader identity="content"
                recipe="index"
                title="Comments"
                description="Moderate blog comments before they appear on your site."
                breadcrumbs={[{ label: 'Content' }, { label: 'Comments' }]}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadComments(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Comments could not load"
                    action={<Button variant="secondary" onClick={() => void loadComments()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total comments</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
                                <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Pending</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.pending}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                                <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Approved</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.approved}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-critical-soft)] text-[var(--lb-color-critical)]">
                                <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Spam</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.spam}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            <Card>
                <Section
                    title="Moderation queue"
                    description="Approve useful comments, mark spam, or delete comments that should not appear on your blog."
                >
                    {comments.length === 0 ? (
                        <EmptyState scene="comments"
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No comments yet"
                            body="When readers comment on your blog posts, they will appear here for moderation."
                        />
                    ) : (
                        <Tabs
                            items={tabs}
                            value={filter}
                            onValueChange={(value) => setFilter(value as 'all' | CommentStatus)}
                        />
                    )}
                </Section>
            </Card>

            <ConfirmDialog
                open={Boolean(commentToDelete)}
                title="Delete comment?"
                description={commentToDelete ? `This permanently removes ${commentToDelete.author_name}'s comment from the moderation queue.` : 'This permanently removes the selected comment.'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete comment'}
                destructive
                onClose={() => {
                    if (!deleting) setCommentToDelete(null)
                }}
                onConfirm={() => void handleDelete()}
            />
        </Page>
    )
}
