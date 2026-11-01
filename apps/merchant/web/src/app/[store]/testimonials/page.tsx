'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Avatar,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    MessageSquare,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Star,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'

interface Testimonial {
    id: string
    author_name: string
    author_title: string | null
    author_company: string | null
    author_avatar: string | null
    content: string
    rating: number | null
    is_featured: boolean
    is_visible: boolean
    display_order: number
    created_at: string
}

interface TestimonialFormState {
    author_name: string
    author_title: string
    author_company: string
    content: string
    rating: string
}

const emptyForm: TestimonialFormState = {
    author_name: '',
    author_title: '',
    author_company: '',
    content: '',
    rating: '5',
}

const ratingOptions = [
    { label: '5 stars', value: '5' },
    { label: '4 stars', value: '4' },
    { label: '3 stars', value: '3' },
    { label: '2 stars', value: '2' },
    { label: '1 star', value: '1' },
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

function formFromTestimonial(testimonial: Testimonial): TestimonialFormState {
    return {
        author_name: testimonial.author_name,
        author_title: testimonial.author_title || '',
        author_company: testimonial.author_company || '',
        content: testimonial.content,
        rating: testimonial.rating ? String(testimonial.rating) : '5',
    }
}

function formsEqual(a: TestimonialFormState, b: TestimonialFormState) {
    return a.author_name === b.author_name
        && a.author_title === b.author_title
        && a.author_company === b.author_company
        && a.content === b.content
        && a.rating === b.rating
}

function renderStars(rating: number | null) {
    const safeRating = rating || 0
    return Array.from({ length: 5 }, (_, index) => {
        const active = index < safeRating
        return (
            <Star
                key={index}
                className={[
                    'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]',
                    active ? 'text-[var(--lb-color-warning)]' : 'text-[var(--lb-color-border)]',
                ].join(' ')}
                fill={active ? 'currentColor' : 'none'}
                aria-hidden="true"
            />
        )
    })
}

export default function TestimonialsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<TestimonialFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<TestimonialFormState>(emptyForm)
    const [testimonialToDelete, setTestimonialToDelete] = useState<Testimonial | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadTestimonials = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/testimonials`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load testimonials'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load testimonials'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Testimonials could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadTestimonials()
    }, [loadTestimonials])

    const stats = useMemo(() => ({
        total: items.length,
        featured: items.filter((item) => item.is_featured).length,
        visible: items.filter((item) => item.is_visible).length,
    }), [items])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const resetForm = useCallback((nextForm: TestimonialFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((testimonial: Testimonial) => {
        const nextForm = formFromTestimonial(testimonial)
        setEditingId(testimonial.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.author_name.trim() || !formData.content.trim()) return
        setSaving(true)

        const payload = {
            author_name: formData.author_name.trim(),
            content: formData.content.trim(),
            author_title: formData.author_title.trim() || null,
            author_company: formData.author_company.trim() || null,
            rating: formData.rating ? Number.parseInt(formData.rating, 10) : null,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/testimonials/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/testimonials`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save testimonial'))
            }

            notify({
                title: editingId ? 'Testimonial updated' : 'Testimonial created',
                description: `${payload.author_name}'s testimonial is ready for your portfolio.`,
                variant: 'success',
            })
            closeForm()
            await loadTestimonials({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save testimonial'
            notify({
                title: 'Could not save testimonial',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadTestimonials, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!testimonialToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/testimonials/${encodeURIComponent(testimonialToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete testimonial'))
            }

            notify({
                title: 'Testimonial deleted',
                description: `${testimonialToDelete.author_name}'s testimonial was removed.`,
                variant: 'success',
            })
            if (editingId === testimonialToDelete.id) closeForm()
            setTestimonialToDelete(null)
            await loadTestimonials({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete testimonial'
            notify({
                title: 'Could not delete testimonial',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [closeForm, deleting, editingId, loadTestimonials, notify, store, testimonialToDelete])

    if (loading) {
        return (
            <Page>
                <PageHeader identity="content"
                    recipe="index"
                    title="Testimonials"
                    description="Collect and curate customer quotes for your portfolio pages."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Testimonials' }]}
                />
                <Card>
                    <Section title="Testimonials">
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
                title="Testimonials"
                description="Collect and curate customer quotes for your portfolio pages."
                breadcrumbs={[{ label: 'Content' }, { label: 'Testimonials' }]}
                primaryAction={{
                    label: 'Add testimonial',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadTestimonials(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Testimonials could not load"
                    action={<Button variant="secondary" onClick={() => void loadTestimonials()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total testimonials</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Featured</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.featured}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Visible</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.visible}</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit testimonial' : 'New testimonial'}
                        description="Keep quotes short, specific, and easy to scan on your public profile."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Author name"
                                value={formData.author_name}
                                onChange={(event) => setFormData((current) => ({ ...current, author_name: event.target.value }))}
                                error={!formData.author_name.trim() && hasUnsavedChanges ? 'Author name is required' : undefined}
                            />
                            <Input
                                label="Title or role"
                                value={formData.author_title}
                                onChange={(event) => setFormData((current) => ({ ...current, author_title: event.target.value }))}
                            />
                            <Input
                                label="Company"
                                value={formData.author_company}
                                onChange={(event) => setFormData((current) => ({ ...current, author_company: event.target.value }))}
                            />
                            <Select
                                label="Rating"
                                value={formData.rating}
                                options={ratingOptions}
                                onChange={(event) => setFormData((current) => ({ ...current, rating: event.target.value }))}
                            />
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Testimonial"
                                    rows={5}
                                    value={formData.content}
                                    onChange={(event) => setFormData((current) => ({ ...current, content: event.target.value }))}
                                    error={!formData.content.trim() && hasUnsavedChanges ? 'Testimonial content is required' : undefined}
                                />
                            </div>
                        </div>
                    </Section>
                </Card>
            )}

            {items.length === 0 && !showForm ? (
                <Card>
                    <Section title="Testimonials">
                        <EmptyState scene="testimonials"
                            icon={<MessageSquare className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No testimonials yet"
                            body="Add quotes from customers, clients, or collaborators to make your portfolio more credible."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add testimonial</Button>}
                        />
                    </Section>
                </Card>
            ) : items.length > 0 && (
                <Card>
                    <Section title="Published testimonials" description="Edit, refresh, or remove quotes as your portfolio evolves.">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            {items.map((testimonial) => (
                                <article
                                    key={testimonial.id}
                                    className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
                                        <div className="flex items-center gap-[var(--lb-space-1)] text-[var(--lb-color-warning)]">
                                            {renderStars(testimonial.rating)}
                                        </div>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            {testimonial.is_featured && <Badge label="Featured" variant="info" />}
                                            <Badge label={testimonial.is_visible ? 'Visible' : 'Hidden'} variant={testimonial.is_visible ? 'success' : 'default'} />
                                        </div>
                                    </div>

                                    <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        &ldquo;{testimonial.content}&rdquo;
                                    </p>

                                    <div className="flex items-center gap-[var(--lb-space-3)]">
                                        <Avatar name={testimonial.author_name} imageUrl={testimonial.author_avatar || undefined} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{testimonial.author_name}</p>
                                            <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {[testimonial.author_title, testimonial.author_company].filter(Boolean).join(' - ') || `Added ${formatDate(testimonial.created_at)}`}
                                            </p>
                                        </div>
                                        <div className="flex gap-[var(--lb-space-1)]">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Edit testimonial from ${testimonial.author_name}`}
                                                onClick={() => startEdit(testimonial)}
                                            >
                                                <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Delete testimonial from ${testimonial.author_name}`}
                                                onClick={() => setTestimonialToDelete(testimonial)}
                                            >
                                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </Section>
                </Card>
            )}

            {showForm && (
                <SaveBar
                    state={saveState}
                    onSave={() => void handleSave()}
                    onDiscard={closeForm}
                    saveLabel={editingId ? 'Update testimonial' : 'Create testimonial'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(testimonialToDelete)}
                title="Delete testimonial?"
                description={testimonialToDelete ? `Delete ${testimonialToDelete.author_name}'s testimonial? This cannot be undone.` : 'Delete this testimonial?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete testimonial'}
                cancelLabel="Keep testimonial"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setTestimonialToDelete(null)
                }}
            />
        </Page>
    )
}
