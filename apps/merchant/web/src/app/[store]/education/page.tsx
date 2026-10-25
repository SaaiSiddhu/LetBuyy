'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    BookOpen,
    Calendar,
    Card,
    ConfirmDialog,
    EmptyState,
    GraduationCap,
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

interface Education {
    id: string
    institution: string
    degree: string
    field_of_study: string | null
    start_date: string | null
    end_date: string | null
    grade: string | null
    description: string | null
    display_order: number
    created_at: string
}

interface EducationFormState {
    institution: string
    degree: string
    field_of_study: string
    start_date: string
    end_date: string
    grade: string
    description: string
}

const emptyForm: EducationFormState = {
    institution: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    grade: '',
    description: '',
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

function formFromEducation(education: Education): EducationFormState {
    return {
        institution: education.institution,
        degree: education.degree,
        field_of_study: education.field_of_study || '',
        start_date: education.start_date || '',
        end_date: education.end_date || '',
        grade: education.grade || '',
        description: education.description || '',
    }
}

function formsEqual(a: EducationFormState, b: EducationFormState) {
    return a.institution === b.institution
        && a.degree === b.degree
        && a.field_of_study === b.field_of_study
        && a.start_date === b.start_date
        && a.end_date === b.end_date
        && a.grade === b.grade
        && a.description === b.description
}

function periodLabel(education: Education) {
    const start = formatMonth(education.start_date)
    const end = formatMonth(education.end_date)
    if (!start && !end) return 'Dates not set'
    return [start, end || 'Present'].filter(Boolean).join(' - ')
}

export default function EducationPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Education[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<EducationFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<EducationFormState>(emptyForm)
    const [educationToDelete, setEducationToDelete] = useState<Education | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadEducation = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/education`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load education'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load education'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Education could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadEducation()
    }, [loadEducation])

    const stats = useMemo(() => ({
        total: items.length,
        withField: items.filter((item) => Boolean(item.field_of_study)).length,
        withGrade: items.filter((item) => Boolean(item.grade)).length,
    }), [items])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const resetForm = useCallback((nextForm: EducationFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((education: Education) => {
        const nextForm = formFromEducation(education)
        setEditingId(education.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.institution.trim() || !formData.degree.trim()) return
        setSaving(true)

        const payload = {
            institution: formData.institution.trim(),
            degree: formData.degree.trim(),
            field_of_study: formData.field_of_study.trim() || null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            grade: formData.grade.trim() || null,
            description: formData.description.trim() || null,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/education/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/education`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save education'))
            }

            notify({
                title: editingId ? 'Education updated' : 'Education created',
                description: `${payload.degree} at ${payload.institution} is ready for your resume.`,
                variant: 'success',
            })
            closeForm()
            await loadEducation({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save education'
            notify({
                title: 'Could not save education',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadEducation, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!educationToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/education/${encodeURIComponent(educationToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete education'))
            }

            notify({
                title: 'Education deleted',
                description: `${educationToDelete.degree} at ${educationToDelete.institution} was removed.`,
                variant: 'success',
            })
            if (editingId === educationToDelete.id) closeForm()
            setEducationToDelete(null)
            await loadEducation({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete education'
            notify({
                title: 'Could not delete education',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [closeForm, deleting, editingId, educationToDelete, loadEducation, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader identity="content"
                    recipe="index"
                    title="Education"
                    description="Add academic history and credentials to strengthen your resume."
                    breadcrumbs={[{ label: 'Resume' }, { label: 'Education' }]}
                />
                <Card>
                    <Section title="Education">
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
                title="Education"
                description="Add academic history and credentials to strengthen your resume."
                breadcrumbs={[{ label: 'Resume' }, { label: 'Education' }]}
                primaryAction={{
                    label: 'Add education',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadEducation(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Education could not load"
                    action={<Button variant="secondary" onClick={() => void loadEducation()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total entries</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">With field</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.withField}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">With grade</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.withGrade}</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit education' : 'New education'}
                        description="Add degrees, institutions, and highlights exactly as you want them shown publicly."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Input
                                    label="Institution"
                                    value={formData.institution}
                                    onChange={(event) => setFormData((current) => ({ ...current, institution: event.target.value }))}
                                    error={!formData.institution.trim() && hasUnsavedChanges ? 'Institution is required' : undefined}
                                />
                            </div>
                            <Input
                                label="Degree"
                                value={formData.degree}
                                onChange={(event) => setFormData((current) => ({ ...current, degree: event.target.value }))}
                                error={!formData.degree.trim() && hasUnsavedChanges ? 'Degree is required' : undefined}
                            />
                            <Input
                                label="Field of study"
                                value={formData.field_of_study}
                                onChange={(event) => setFormData((current) => ({ ...current, field_of_study: event.target.value }))}
                            />
                            <Input
                                label="Start date"
                                type="month"
                                value={formData.start_date}
                                onChange={(event) => setFormData((current) => ({ ...current, start_date: event.target.value }))}
                            />
                            <Input
                                label="End date"
                                type="month"
                                value={formData.end_date}
                                onChange={(event) => setFormData((current) => ({ ...current, end_date: event.target.value }))}
                            />
                            <Input
                                label="Grade or GPA"
                                value={formData.grade}
                                onChange={(event) => setFormData((current) => ({ ...current, grade: event.target.value }))}
                            />
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Description"
                                    rows={4}
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
                    <Section title="Education">
                        <EmptyState
                            icon={<GraduationCap className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No education yet"
                            body="Add degrees, institutions, dates, grades, and achievements to complete your professional profile."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add education</Button>}
                        />
                    </Section>
                </Card>
            ) : items.length > 0 && (
                <Card>
                    <Section title="Education" description="Keep this section concise so visitors can scan credentials quickly.">
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                            {items.map((education) => (
                                <article key={education.id} className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)] md:flex-row md:items-start">
                                    <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                        <GraduationCap className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                            <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                {education.degree}{education.field_of_study ? ` in ${education.field_of_study}` : ''}
                                            </h2>
                                            {education.grade && <Badge label={education.grade} variant="info" />}
                                        </div>
                                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                            {education.institution}
                                        </p>
                                        <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                <Calendar className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                {periodLabel(education)}
                                            </span>
                                            {education.field_of_study && (
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                    <BookOpen className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    {education.field_of_study}
                                                </span>
                                            )}
                                        </div>
                                        {education.description && (
                                            <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {education.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 gap-[var(--lb-space-1)]">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit ${education.degree} at ${education.institution}`}
                                            onClick={() => startEdit(education)}
                                        >
                                            <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Delete ${education.degree} at ${education.institution}`}
                                            onClick={() => setEducationToDelete(education)}
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
                    saveLabel={editingId ? 'Update education' : 'Create education'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(educationToDelete)}
                title="Delete education?"
                description={educationToDelete ? `Delete ${educationToDelete.degree} at ${educationToDelete.institution}? This cannot be undone.` : 'Delete this education?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete education'}
                cancelLabel="Keep education"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setEducationToDelete(null)
                }}
            />
        </Page>
    )
}
