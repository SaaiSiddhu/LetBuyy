'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import {
    Avatar,
    Badge,
    BadgeCheck,
    Banner,
    Button,
    Card,
    CheckCircle2,
    ConfirmDialog,
    EmptyState,
    MessageSquare,
    Page,
    PageHeader,
    RefreshCw,
    Section,
    ShieldCheck,
    Skeleton,
    Star,
    Table,
    Trash2,
    XCircle,
    useToast,
    type TableColumn,
} from '@letbuyy/ui'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'

interface Review {
    id: string
    product_id: string
    product_name?: string
    customer_name: string
    customer_email: string
    rating: number
    title: string
    body: string
    status: 'pending' | 'approved' | 'rejected'
    is_verified: boolean
    created_at: string
}

type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected'

const reviewViews = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
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

function reviewStatusVariant(status: Review['status']) {
    if (status === 'approved') return 'success' as const
    if (status === 'pending') return 'warning' as const
    return 'critical' as const
}

function reviewStatusLabel(status: Review['status']) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

function ReviewStars({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-[var(--lb-space-1)]" aria-label={`${rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => (
                <Star
                    key={index}
                    className={
                        index < rating
                            ? 'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] fill-[var(--lb-color-warning)] text-[var(--lb-color-warning)]'
                            : 'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-border-strong)]'
                    }
                    aria-hidden="true"
                />
            ))}
        </div>
    )
}

export default function ReviewsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [reviews, setReviews] = useState<Review[]>([])
    const [filter, setFilter] = useState<ReviewFilter>('all')
    const [updating, setUpdating] = useState<string | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null)

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        setActionError(null)

        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/reviews?status=${encodeURIComponent(filter)}&limit=100`,
                { cache: 'no-store' },
            )
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load reviews'))
            }

            setReviews(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load reviews'
            setReviews([])
            setLoadError(message)
            notify({ title: 'Reviews could not load', description: message, variant: 'critical' })
        } finally {
            setLoading(false)
        }
    }, [filter, notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const updateStatus = useCallback(async (id: string, status: 'approved' | 'rejected') => {
        setUpdating(id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/reviews/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update review'))
            }

            const updatedReview = payload?.data as Partial<Review> | undefined
            setReviews((current) => current.map((r) => (r.id === id ? { ...r, ...updatedReview, status } : r)))
            notify({
                title: status === 'approved' ? 'Review approved' : 'Review rejected',
                description: 'The storefront review status was updated.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update review'
            setActionError(message)
            notify({ title: 'Could not update review', description: message, variant: 'critical' })
        } finally {
            setUpdating(null)
        }
    }, [notify, store])

    const deleteReview = useCallback(async () => {
        if (!reviewToDelete || updating === reviewToDelete.id) return
        setUpdating(reviewToDelete.id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/reviews/${encodeURIComponent(reviewToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete review'))
            }

            notify({
                title: 'Review deleted',
                description: `The review from ${reviewToDelete.customer_name} was removed.`,
                variant: 'success',
            })
            setReviews((current) => current.filter((r) => r.id !== reviewToDelete.id))
            setReviewToDelete(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete review'
            setActionError(message)
            notify({ title: 'Could not delete review', description: message, variant: 'critical' })
        } finally {
            setUpdating(null)
        }
    }, [notify, reviewToDelete, store, updating])

    const visibleCounts = useMemo(() => ({
        approved: reviews.filter((r) => r.status === 'approved').length,
        pending: reviews.filter((r) => r.status === 'pending').length,
        rejected: reviews.filter((r) => r.status === 'rejected').length,
        verified: reviews.filter((r) => r.is_verified).length,
    }), [reviews])

    const averageRating = useMemo(() => {
        if (reviews.length === 0) return '0.0'
        const total = reviews.reduce((sum, r) => sum + r.rating, 0)
        return (total / reviews.length).toFixed(1)
    }, [reviews])

    const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

    const columns = useMemo<Array<TableColumn<Review>>>(() => [
        {
            key: 'customer',
            header: 'Customer',
            render: (review) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={review.customer_name} size="sm" />
                    <span className="min-w-0">
                        <span className="block truncate font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                            {review.customer_name}
                        </span>
                        <span className="block truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                            {review.customer_email}
                        </span>
                    </span>
                </div>
            ),
            cardRender: (review) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={review.customer_name} size="sm" />
                    <span className="min-w-0">
                        <span className="block truncate font-[var(--lb-font-weight-medium)]">{review.customer_name}</span>
                        <span className="block truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                            {review.product_name || review.customer_email}
                        </span>
                    </span>
                </div>
            ),
        },
        {
            key: 'review',
            header: 'Review',
            render: (review) => (
                <div className="max-w-[260px] space-y-[var(--lb-space-1)]">
                    <ReviewStars rating={review.rating} />
                    {review.title && (
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                            {review.title}
                        </p>
                    )}
                    <p className="m-0 line-clamp-2 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {review.body}
                    </p>
                </div>
            ),
            cardLabel: 'Review',
            cardRender: (review) => (
                <div className="space-y-[var(--lb-space-1)]">
                    <ReviewStars rating={review.rating} />
                    {review.title && (
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                            {review.title}
                        </p>
                    )}
                    <p className="m-0 line-clamp-2 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {review.body}
                    </p>
                </div>
            ),
        },
        {
            key: 'product',
            header: 'Product',
            shrink: true,
            render: (review) => (
                <span className="text-[var(--lb-color-text)]">{review.product_name || '-'}</span>
            ),
        },
        {
            key: 'date',
            header: 'Date',
            shrink: true,
            render: (review) => (
                <span className="whitespace-nowrap text-[var(--lb-color-text-subdued)]">{formatDate(review.created_at)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            shrink: true,
            render: (review) => (
                <div className="flex items-center gap-[var(--lb-space-2)]">
                    <Badge label={reviewStatusLabel(review.status)} variant={reviewStatusVariant(review.status)} />
                    {review.is_verified && (
                        <BadgeCheck
                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]"
                            aria-label="Verified purchase"
                        />
                    )}
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            shrink: true,
            render: (review) => (
                <div className="flex items-center gap-[var(--lb-space-2)]" onClick={stopPropagation}>
                    {review.status !== 'approved' && (
                        <Button
                            size="sm"
                            loading={updating === review.id}
                            onClick={() => void updateStatus(review.id, 'approved')}
                        >
                            <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Approve
                        </Button>
                    )}
                    {review.status !== 'rejected' && (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={updating === review.id}
                            onClick={() => void updateStatus(review.id, 'rejected')}
                        >
                            <XCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Reject
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={updating === review.id}
                        onClick={() => setReviewToDelete(review)}
                    >
                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Delete
                    </Button>
                </div>
            ),
        },
    ], [updating, updateStatus, stopPropagation])

    const isMainEmpty = !loadError && filter === 'all'
    const emptyState = (
        <EmptyState
            illustration={isMainEmpty ? (
                <Image
                    src="/Emptystate Illustration/Product-Review.png"
                    alt=""
                    width={200}
                    height={200}
                    aria-hidden="true"
                />
            ) : undefined}
            icon={!isMainEmpty ? (
                <MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            ) : undefined}
            title={loadError ? 'Unable to load reviews' : filter === 'all' ? 'No reviews yet' : `No ${filter} reviews`}
            body={loadError || (filter === 'all'
                ? 'Customer product reviews will appear here when shoppers submit feedback.'
                : 'Switch to a different filter or wait for more customer feedback to moderate.')}
            primaryAction={loadError ? (
                <Button variant="secondary" onClick={() => void loadData()}>
                    <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    Retry
                </Button>
            ) : undefined}
        />
    )

    return (
        <Page>
            <PageHeader
                title="Product reviews"
                description={visibleCounts.pending > 0
                    ? `${visibleCounts.pending} review${visibleCounts.pending > 1 ? 's' : ''} awaiting moderation.`
                    : 'All visible reviews are moderated.'}
                breadcrumbs={[{ label: 'Store' }, { label: 'Reviews' }]}
                secondaryActions={[{
                    label: 'Refresh',
                    onClick: () => void loadData(),
                    icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Reviews could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {actionError && !loadError && (
                <Banner variant="critical" title="Review action failed">
                    {actionError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Star className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Average rating</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{averageRating}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
                                <ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Pending</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{visibleCounts.pending}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                                <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Approved</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{visibleCounts.approved}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-info-soft)] text-[var(--lb-color-info)]">
                                <BadgeCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Verified buyers</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{visibleCounts.verified}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            <Card>
                <Section
                    title="Review moderation queue"
                    description="Approve helpful customer reviews, reject content that should not appear publicly, or remove records when required."
                >
                    {loading ? (
                        <Skeleton variant="table" lines={5} />
                    ) : (
                        <Table
                            rows={reviews}
                            columns={columns}
                            emptyState={emptyState}
                            savedViews={reviewViews}
                            activeView={filter}
                            onViewChange={(value) => setFilter(value as ReviewFilter)}
                        />
                    )}
                </Section>
            </Card>

            <ConfirmDialog
                open={Boolean(reviewToDelete)}
                title="Delete review?"
                description={reviewToDelete
                    ? `This permanently removes the review from ${reviewToDelete.customer_name}.`
                    : 'This permanently removes the selected review.'}
                confirmLabel={updating === reviewToDelete?.id ? 'Deleting...' : 'Delete review'}
                destructive
                onClose={() => { if (updating !== reviewToDelete?.id) setReviewToDelete(null) }}
                onConfirm={() => void deleteReview()}
            />
        </Page>
    )
}
