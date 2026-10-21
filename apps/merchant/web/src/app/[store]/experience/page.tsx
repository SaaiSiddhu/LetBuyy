'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    Briefcase,
    Calendar,
    Card,
    ConfirmDialog,
    EmptyState,
    MapPin,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Skeleton,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'

interface Experience {
    id: string
    company: string
    role: string
    description: string | null
    location: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
    display_order: number
    created_at: string
}

interface ExperienceFormState {
    company: string
    role: string
    description: string
    location: string
    start_date: string
    end_date: string
    is_current: boolean
}

const emptyForm: ExperienceFormState = {
    company: '',
    role: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
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

function formatMonth(value: string | null) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
    })
}

function formFromExperience(experience: Experience): ExperienceFormState {
    return {
        company: experience.company,
        role: experience.role,
        description: experience.description || '',
        location: experience.location || '',
        start_date: experience.start_date || '',
        end_date: experience.end_date || '',
        is_current: experience.is_current,
    }
}

function formsEqual(a: ExperienceFormState, b: ExperienceFormState) {
    return a.company === b.company
        && a.role === b.role
        && a.description === b.description
        && a.location === b.location
        && a.start_date === b.start_date
        && a.end_date === b.end_date
        && a.is_current === b.is_current
}

function periodLabel(experience: Experience) {
    const start = formatMonth(experience.start_date)
    const end = experience.is_current ? 'Present' : formatMonth(experience.end_date)
    if (!start && !end) return 'Dates not set'
    return [start, end].filter(Boolean).join(' - ')
}

export default function ExperiencePage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Experience[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<ExperienceFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<ExperienceFormState>(emptyForm)
    const [experienceToDelete, setExperienceToDelete] = useState<Experience | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadExperience = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/work_experience`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load work experience'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load work experience'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Experience could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadExperience()
    }, [loadExperience])

    const stats = useMemo(() => ({
        total: items.length,
        current: items.filter((item) => item.is_current).length,
        withLocation: items.filter((item) => Boolean(item.location)).length,
    }), [items])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const resetForm = useCallback((nextForm: ExperienceFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((experience: Experience) => {
        const nextForm = formFromExperience(experience)
        setEditingId(experience.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.company.trim() || !formData.role.trim()) return
        setSaving(true)

        const payload = {
            company: formData.company.trim(),
            role: formData.role.trim(),
            description: formData.description.trim() || null,
            location: formData.location.trim() || null,
            start_date: formData.start_date || null,
            end_date: formData.is_current ? null : (formData.end_date || null),
            is_current: formData.is_current,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/work_experience/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/work_experience`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save work experience'))
            }

            notify({
                title: editingId ? 'Experience updated' : 'Experience created',
                description: `${payload.role} at ${payload.company} is ready for your resume.`,
                variant: 'success',
            })
            closeForm()
            await loadExperience({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save work experience'
            notify({
                title: 'Could not save experience',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadExperience, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!experienceToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/work_experience/${encodeURIComponent(experienceToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete work experience'))
            }

            notify({
                title: 'Experience deleted',
                description: `${experienceToDelete.role} at ${experienceToDelete.company} was removed.`,
                variant: 'success',
            })
            if (editingId === experienceToDelete.id) closeForm()
            setExperienceToDelete(null)
            await loadExperience({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete work experience'
            notify({
                title: 'Could not delete experience',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [closeForm, deleting, editingId, experienceToDelete, loadExperience, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Experience"
                    description="Build a clean work-history timeline for your resume or portfolio."
                    breadcrumbs={[{ label: 'Resume' }, { label: 'Experience' }]}
                />
                <Card>
                    <Section title="Work history">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Experience"
                description="Build a clean work-history timeline for your resume or portfolio."
                breadcrumbs={[{ label: 'Resume' }, { label: 'Experience' }]}
                primaryAction={{
                    label: 'Add experience',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadExperience(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Experience could not load"
                    action={<Button variant="secondary" onClick={() => void loadExperience()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total roles</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Current roles</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.current}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">With location</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.withLocation}</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit experience' : 'New experience'}
                        description="Use concise role names and achievements that read well in a timeline."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Company"
                                value={formData.company}
                                onChange={(event) => setFormData((current) => ({ ...current, company: event.target.value }))}
                                error={!formData.company.trim() && hasUnsavedChanges ? 'Company is required' : undefined}
                            />
                            <Input
                                label="Role or title"
                                value={formData.role}
                                onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
                                error={!formData.role.trim() && hasUnsavedChanges ? 'Role is required' : undefined}
                            />
                            <Input
                                label="Location"
                                value={formData.location}
                                onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
                            />
                            <label className="flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] self-end rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                <Input unstyled
                                    type="checkbox"
                                    className="h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)]"
                                    checked={formData.is_current}
                                    onChange={(event) => setFormData((current) => ({ ...current, is_current: event.target.checked, end_date: event.target.checked ? '' : current.end_date }))}
                                />
                                Currently working here
                            </label>
                            <Input
                                label="Start date"
                                type="month"
                                value={formData.start_date}
                                onChange={(event) => setFormData((current) => ({ ...current, start_date: event.target.value }))}
                            />
                            {!formData.is_current && (
                                <Input
                                    label="End date"
                                    type="month"
                                    value={formData.end_date}
                                    onChange={(event) => setFormData((current) => ({ ...current, end_date: event.target.value }))}
                                />
                            )}
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Description and achievements"
                                    rows={5}
                                    value={formData.description}
                                    onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                                />
                            </div>
                        </div>
                    </Section>
                </Card>
            )}

            {items.length === 0 && !showForm ? (
                <Card>
                    <Section title="Work history">
                        <EmptyState
                            icon={<Briefcase className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No experience yet"
                            body="Add roles, companies, dates, and achievements to create a trustworthy professional timeline."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add experience</Button>}
                        />
                    </Section>
                </Card>
            ) : items.length > 0 && (
                <Card>
                    <Section title="Work history" description="Keep roles ordered and concise so visitors can scan your career quickly.">
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                            {items.map((experience) => (
                                <article key={experience.id} className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)] md:flex-row md:items-start">
                                    <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <Briefcase className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                            <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                {experience.role}
                                            </h2>
                                            {experience.is_current && <Badge label="Current" variant="success" />}
                                        </div>
                                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                            {experience.company}
                                        </p>
                                        <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                <Calendar className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                {periodLabel(experience)}
                                            </span>
                                            {experience.location && (
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                    <MapPin className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    {experience.location}
                                                </span>
                                            )}
                                        </div>
                                        {experience.description && (
                                            <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {experience.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 gap-[var(--lb-space-1)]">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit ${experience.role} at ${experience.company}`}
                                            onClick={() => startEdit(experience)}
                                        >
                                            <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Delete ${experience.role} at ${experience.company}`}
                                            onClick={() => setExperienceToDelete(experience)}
                                        >
                                            <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
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
                    saveLabel={editingId ? 'Update experience' : 'Create experience'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(experienceToDelete)}
                title="Delete experience?"
                description={experienceToDelete ? `Delete ${experienceToDelete.role} at ${experienceToDelete.company}? This cannot be undone.` : 'Delete this experience?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete experience'}
                cancelLabel="Keep experience"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setExperienceToDelete(null)
                }}
            />
        </Page>
    )
}
