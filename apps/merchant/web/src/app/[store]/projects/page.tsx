'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    Briefcase,
    Card,
    ConfirmDialog,
    EmptyState,
    ExternalLink,
    FileText,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Skeleton,
    Tag,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'

interface Project {
    id: string
    title: string
    description: string | null
    url: string | null
    image_url: string | null
    technologies: string[]
    display_order: number
    is_visible: boolean
    start_date: string | null
    end_date: string | null
    created_at: string
}

interface ProjectFormState {
    title: string
    description: string
    url: string
    technologies: string
}

const emptyForm: ProjectFormState = {
    title: '',
    description: '',
    url: '',
    technologies: '',
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

function formFromProject(project: Project): ProjectFormState {
    return {
        title: project.title,
        description: project.description || '',
        url: project.url || '',
        technologies: (project.technologies || []).join(', '),
    }
}

function formsEqual(a: ProjectFormState, b: ProjectFormState) {
    return a.title === b.title
        && a.description === b.description
        && a.url === b.url
        && a.technologies === b.technologies
}

function parseTechnologies(value: string) {
    return value
        .split(',')
        .map((technology) => technology.trim())
        .filter(Boolean)
}

function formatMonth(value: string | null) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
    })
}

function periodLabel(project: Project) {
    const start = formatMonth(project.start_date)
    const end = formatMonth(project.end_date)
    if (!start && !end) return 'Timeline not set'
    return [start, end || 'Present'].filter(Boolean).join(' - ')
}

export default function ProjectsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<ProjectFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<ProjectFormState>(emptyForm)
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadProjects = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/projects`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load projects'))
            }

            setProjects(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load projects'
            setProjects([])
            setLoadError(message)
            notify({
                title: 'Projects could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadProjects()
    }, [loadProjects])

    const stats = useMemo(() => ({
        total: projects.length,
        visible: projects.filter((project) => project.is_visible).length,
        linked: projects.filter((project) => Boolean(project.url)).length,
    }), [projects])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const resetForm = useCallback((nextForm: ProjectFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((project: Project) => {
        const nextForm = formFromProject(project)
        setEditingId(project.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.title.trim()) return
        setSaving(true)

        const payload = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            url: formData.url.trim() || null,
            technologies: parseTechnologies(formData.technologies),
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/projects/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/projects`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save project'))
            }

            notify({
                title: editingId ? 'Project updated' : 'Project created',
                description: `${payload.title} is ready for your portfolio.`,
                variant: 'success',
            })
            closeForm()
            await loadProjects({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save project'
            notify({
                title: 'Could not save project',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadProjects, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!projectToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/projects/${encodeURIComponent(projectToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete project'))
            }

            notify({
                title: 'Project deleted',
                description: `${projectToDelete.title} was removed from your portfolio.`,
                variant: 'success',
            })
            if (editingId === projectToDelete.id) closeForm()
            setProjectToDelete(null)
            await loadProjects({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete project'
            notify({
                title: 'Could not delete project',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [closeForm, deleting, editingId, loadProjects, notify, projectToDelete, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Projects"
                    description="Add portfolio work and case studies to showcase your results."
                    breadcrumbs={[{ label: 'Portfolio' }, { label: 'Projects' }]}
                />
                <Card>
                    <Section title="Projects">
                        <Skeleton variant="card" lines={6} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Projects"
                description="Add portfolio work and case studies to showcase your results."
                breadcrumbs={[{ label: 'Portfolio' }, { label: 'Projects' }]}
                primaryAction={{
                    label: 'Add project',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadProjects(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Projects could not load"
                    action={<Button variant="secondary" onClick={() => void loadProjects()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total projects</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Visible</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.visible}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">With links</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.linked}</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit project' : 'New project'}
                        description="Add the problem, outcome, link, and technologies visitors need to understand the work."
                    >
                        <div className="grid gap-[var(--lb-space-4)]">
                            <Input
                                label="Project title"
                                value={formData.title}
                                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                                error={!formData.title.trim() && hasUnsavedChanges ? 'Project title is required' : undefined}
                            />
                            <Textarea
                                label="Description"
                                rows={4}
                                value={formData.description}
                                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                            />
                            <Input
                                label="Project URL"
                                type="url"
                                value={formData.url}
                                onChange={(event) => setFormData((current) => ({ ...current, url: event.target.value }))}
                            />
                            <Input
                                label="Technologies"
                                value={formData.technologies}
                                onChange={(event) => setFormData((current) => ({ ...current, technologies: event.target.value }))}
                                placeholder="React, Supabase, Cloudflare..."
                            />
                        </div>
                    </Section>
                </Card>
            )}

            {projects.length === 0 && !showForm ? (
                <Card>
                    <Section title="Projects">
                        <EmptyState
                            icon={<Briefcase className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No projects yet"
                            body="Add case studies, portfolio work, and project links to make your profile easier to evaluate."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add project</Button>}
                        />
                    </Section>
                </Card>
            ) : projects.length > 0 && (
                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                    {projects.map((project) => (
                        <Card key={project.id}>
                            <Section>
                                <article className="flex h-full flex-col gap-[var(--lb-space-4)]">
                                    <div className="flex items-start gap-[var(--lb-space-3)]">
                                        <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <Briefcase className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                    {project.title}
                                                </h2>
                                                <Badge label={project.is_visible ? 'Visible' : 'Hidden'} variant={project.is_visible ? 'success' : 'warning'} />
                                            </div>
                                            <p className="m-0 mt-[var(--lb-space-1)] inline-flex items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                {periodLabel(project)}
                                            </p>
                                        </div>
                                    </div>

                                    {project.description && (
                                        <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                            {project.description}
                                        </p>
                                    )}

                                    {project.technologies?.length > 0 && (
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            {project.technologies.map((technology) => (
                                                <Badge key={technology} label={technology} variant="default" />
                                            ))}
                                        </div>
                                    )}

                                    {project.image_url && (
                                        <p className="m-0 inline-flex items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            Image asset attached
                                        </p>
                                    )}

                                    <div className="mt-auto flex justify-end gap-[var(--lb-space-1)]">
                                        {project.url && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Open ${project.title}`}
                                                onClick={() => {
                                                    if (project.url) {
                                                        window.open(project.url, '_blank', 'noopener,noreferrer')
                                                    }
                                                }}
                                            >
                                                <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit ${project.title}`}
                                            onClick={() => startEdit(project)}
                                        >
                                            <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Delete ${project.title}`}
                                            onClick={() => setProjectToDelete(project)}
                                        >
                                            <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </article>
                            </Section>
                        </Card>
                    ))}
                </div>
            )}

            {showForm && (
                <SaveBar
                    state={saveState}
                    onSave={() => void handleSave()}
                    onDiscard={closeForm}
                    saveLabel={editingId ? 'Update project' : 'Create project'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(projectToDelete)}
                title="Delete project?"
                description={projectToDelete ? `Delete ${projectToDelete.title}? This cannot be undone.` : 'Delete this project?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete project'}
                cancelLabel="Keep project"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setProjectToDelete(null)
                }}
            />
        </Page>
    )
}
