'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    Gauge,
    ListChecks,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Skeleton,
    Tag,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import type { StatusVariant } from '@letbuyy/ui'

interface Skill {
    id: string
    name: string
    category: string | null
    proficiency: number
    display_order: number
}

interface SkillFormState {
    name: string
    category: string
    proficiency: string
}

const emptyForm: SkillFormState = {
    name: '',
    category: '',
    proficiency: '80',
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

function formFromSkill(skill: Skill): SkillFormState {
    return {
        name: skill.name,
        category: skill.category || '',
        proficiency: String(skill.proficiency),
    }
}

function formsEqual(a: SkillFormState, b: SkillFormState) {
    return a.name === b.name
        && a.category === b.category
        && a.proficiency === b.proficiency
}

function normalizeProficiency(value: string) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return 80
    return Math.min(100, Math.max(0, parsed))
}

function proficiencyVariant(proficiency: number): StatusVariant {
    if (proficiency >= 80) return 'success'
    if (proficiency >= 60) return 'info'
    if (proficiency >= 40) return 'warning'
    return 'critical'
}

export default function SkillsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Skill[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<SkillFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<SkillFormState>(emptyForm)
    const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadSkills = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/skills`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load skills'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load skills'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Skills could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadSkills()
    }, [loadSkills])

    const grouped = useMemo(() => {
        return items.reduce<Record<string, Skill[]>>((groups, skill) => {
            const category = skill.category || 'Other'
            groups[category] = groups[category] || []
            groups[category].push(skill)
            return groups
        }, {})
    }, [items])

    const stats = useMemo(() => {
        const categoryCount = Object.keys(grouped).length
        const average = items.length
            ? Math.round(items.reduce((total, skill) => total + skill.proficiency, 0) / items.length)
            : 0

        return {
            total: items.length,
            categories: categoryCount,
            average,
        }
    }, [grouped, items])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const normalizedFormProficiency = normalizeProficiency(formData.proficiency)

    const resetForm = useCallback((nextForm: SkillFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((skill: Skill) => {
        const nextForm = formFromSkill(skill)
        setEditingId(skill.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.name.trim()) return
        setSaving(true)

        const payload = {
            name: formData.name.trim(),
            category: formData.category.trim() || null,
            proficiency: normalizeProficiency(formData.proficiency),
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/skills/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/skills`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save skill'))
            }

            notify({
                title: editingId ? 'Skill updated' : 'Skill created',
                description: `${payload.name} is listed at ${payload.proficiency}% proficiency.`,
                variant: 'success',
            })
            closeForm()
            await loadSkills({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save skill'
            notify({
                title: 'Could not save skill',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadSkills, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!skillToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/skills/${encodeURIComponent(skillToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete skill'))
            }

            notify({
                title: 'Skill deleted',
                description: `${skillToDelete.name} was removed from your resume.`,
                variant: 'success',
            })
            if (editingId === skillToDelete.id) closeForm()
            setSkillToDelete(null)
            await loadSkills({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete skill'
            notify({
                title: 'Could not delete skill',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [closeForm, deleting, editingId, loadSkills, notify, skillToDelete, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    recipe="index"
                    title="Skills"
                    description="List professional strengths and proficiency levels for your public resume."
                    breadcrumbs={[{ label: 'Resume' }, { label: 'Skills' }]}
                />
                <Card>
                    <Section title="Skills">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                recipe="index"
                title="Skills"
                description="List professional strengths and proficiency levels for your public resume."
                breadcrumbs={[{ label: 'Resume' }, { label: 'Skills' }]}
                primaryAction={{
                    label: 'Add skill',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadSkills(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Skills could not load"
                    action={<Button variant="secondary" onClick={() => void loadSkills()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total skills</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Categories</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.categories}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Average level</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.average}%</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit skill' : 'New skill'}
                        description="Group skills into categories and set a confidence level that matches your public resume."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Skill name"
                                value={formData.name}
                                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                                error={!formData.name.trim() && hasUnsavedChanges ? 'Skill name is required' : undefined}
                            />
                            <Input
                                label="Category"
                                value={formData.category}
                                onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                                placeholder="Operations, design, engineering..."
                            />
                            <div className="md:col-span-2">
                                <div className="mb-[var(--lb-space-2)] flex items-center justify-between gap-[var(--lb-space-3)]">
                                    <label htmlFor="skill-proficiency" className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        Proficiency
                                    </label>
                                    <Badge label={`${normalizedFormProficiency}%`} variant={proficiencyVariant(normalizedFormProficiency)} />
                                </div>
                                <Input unstyled
                                    id="skill-proficiency"
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={formData.proficiency}
                                    onChange={(event) => setFormData((current) => ({ ...current, proficiency: event.target.value }))}
                                    className="h-[var(--lb-size-control-sm)] w-full accent-[var(--lb-color-primary)]"
                                />
                            </div>
                        </div>
                    </Section>
                </Card>
            )}

            {items.length === 0 && !showForm ? (
                <Card>
                    <Section title="Skills">
                        <EmptyState scene="skills"
                            icon={<ListChecks className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No skills yet"
                            body="Add the skills, tools, and strengths that help visitors understand what you can do."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add skill</Button>}
                        />
                    </Section>
                </Card>
            ) : items.length > 0 && (
                <div className="flex flex-col gap-[var(--lb-space-4)]">
                    {Object.entries(grouped).map(([category, skills]) => (
                        <Card key={category}>
                            <Section
                                title={category}
                                description={`${skills.length} skill${skills.length === 1 ? '' : 's'} in this category.`}
                            >
                                <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                                    {skills.map((skill) => (
                                        <article key={skill.id} className="flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-space-4)] md:flex-row md:items-center">
                                            <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                                <Gauge className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                    <h2 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                        {skill.name}
                                                    </h2>
                                                    <Badge label={`${skill.proficiency}%`} variant={proficiencyVariant(skill.proficiency)} />
                                                </div>
                                                <div className="mt-[var(--lb-space-2)] flex items-center gap-[var(--lb-space-3)]">
                                                    <progress
                                                        value={skill.proficiency}
                                                        max={100}
                                                        aria-label={`${skill.name} proficiency`}
                                                        className="h-[var(--lb-space-2)] w-full overflow-hidden rounded-[var(--lb-radius-full)] accent-[var(--lb-color-primary)]"
                                                    />
                                                    <span className="inline-flex shrink-0 items-center gap-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                        <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        {category}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 gap-[var(--lb-space-1)]">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Edit ${skill.name}`}
                                                    onClick={() => startEdit(skill)}
                                                >
                                                    <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Delete ${skill.name}`}
                                                    onClick={() => setSkillToDelete(skill)}
                                                >
                                                    <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
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
                    saveLabel={editingId ? 'Update skill' : 'Create skill'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(skillToDelete)}
                title="Delete skill?"
                description={skillToDelete ? `Delete ${skillToDelete.name}? This cannot be undone.` : 'Delete this skill?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete skill'}
                cancelLabel="Keep skill"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setSkillToDelete(null)
                }}
            />
        </Page>
    )
}
