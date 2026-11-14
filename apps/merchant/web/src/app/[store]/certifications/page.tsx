'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Award,
    Badge,
    BadgeCheck,
    Banner,
    Calendar,
    Card,
    ConfirmDialog,
    EmptyState,
    ExternalLink,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    ShieldCheck,
    Skeleton,
    Trash2,
    useToast,
} from '@letbuyy/ui'

interface Certification {
    id: string
    name: string
    issuer: string
    credential_id: string | null
    credential_url: string | null
    issue_date: string | null
    expiry_date: string | null
    display_order: number
}

interface CertificationFormState {
    name: string
    issuer: string
    credential_id: string
    credential_url: string
    issue_date: string
    expiry_date: string
}

const emptyForm: CertificationFormState = {
    name: '',
    issuer: '',
    credential_id: '',
    credential_url: '',
    issue_date: '',
    expiry_date: '',
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

function toMonthValue(value: string | null) {
    if (!value) return ''
    return value.slice(0, 7)
}

function formFromCertification(certification: Certification): CertificationFormState {
    return {
        name: certification.name,
        issuer: certification.issuer,
        credential_id: certification.credential_id || '',
        credential_url: certification.credential_url || '',
        issue_date: toMonthValue(certification.issue_date),
        expiry_date: toMonthValue(certification.expiry_date),
    }
}

function formsEqual(a: CertificationFormState, b: CertificationFormState) {
    return a.name === b.name
        && a.issuer === b.issuer
        && a.credential_id === b.credential_id
        && a.credential_url === b.credential_url
        && a.issue_date === b.issue_date
        && a.expiry_date === b.expiry_date
}

function periodLabel(certification: Certification) {
    const issue = formatMonth(certification.issue_date)
    const expiry = formatMonth(certification.expiry_date)
    if (!issue && !expiry) return 'Dates not set'
    if (!expiry) return `Issued ${issue}`
    return `Issued ${issue || 'not set'} - expires ${expiry}`
}

function isActiveCertification(certification: Certification) {
    if (!certification.expiry_date) return true
    return new Date(certification.expiry_date) >= new Date()
}

export default function CertificationsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<Certification[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<CertificationFormState>(emptyForm)
    const [initialFormData, setInitialFormData] = useState<CertificationFormState>(emptyForm)
    const [certificationToDelete, setCertificationToDelete] = useState<Certification | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadCertifications = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/certifications`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load certifications'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load certifications'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Certifications could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadCertifications()
    }, [loadCertifications])

    const stats = useMemo(() => ({
        total: items.length,
        withCredential: items.filter((item) => Boolean(item.credential_id || item.credential_url)).length,
        active: items.filter(isActiveCertification).length,
    }), [items])

    const hasUnsavedChanges = showForm && !formsEqual(formData, initialFormData)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const resetForm = useCallback((nextForm: CertificationFormState = emptyForm) => {
        setFormData(nextForm)
        setInitialFormData(nextForm)
    }, [])

    const openCreateForm = useCallback(() => {
        setEditingId(null)
        resetForm(emptyForm)
        setShowForm(true)
    }, [resetForm])

    const startEdit = useCallback((certification: Certification) => {
        const nextForm = formFromCertification(certification)
        setEditingId(certification.id)
        resetForm(nextForm)
        setShowForm(true)
    }, [resetForm])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        resetForm(emptyForm)
    }, [resetForm])

    const handleSave = useCallback(async () => {
        if (saving || !formData.name.trim() || !formData.issuer.trim()) return
        setSaving(true)

        const payload = {
            name: formData.name.trim(),
            issuer: formData.issuer.trim(),
            credential_id: formData.credential_id.trim() || null,
            credential_url: formData.credential_url.trim() || null,
            issue_date: formData.issue_date || null,
            expiry_date: formData.expiry_date || null,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/content/certifications/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/content/certifications`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            const responsePayload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(responsePayload, 'Unable to save certification'))
            }

            notify({
                title: editingId ? 'Certification updated' : 'Certification created',
                description: `${payload.name} from ${payload.issuer} is ready for your resume.`,
                variant: 'success',
            })
            closeForm()
            await loadCertifications({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save certification'
            notify({
                title: 'Could not save certification',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadCertifications, notify, saving, store])

    const handleDelete = useCallback(async () => {
        if (!certificationToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/content/certifications/${encodeURIComponent(certificationToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete certification'))
            }

            notify({
                title: 'Certification deleted',
                description: `${certificationToDelete.name} from ${certificationToDelete.issuer} was removed.`,
                variant: 'success',
            })
            if (editingId === certificationToDelete.id) closeForm()
            setCertificationToDelete(null)
            await loadCertifications({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete certification'
            notify({
                title: 'Could not delete certification',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [certificationToDelete, closeForm, deleting, editingId, loadCertifications, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Certifications"
                    description="Show verified credentials and professional certificates on your resume."
                    breadcrumbs={[{ label: 'Resume' }, { label: 'Certifications' }]}
                />
                <Card>
                    <Section title="Certifications">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Certifications"
                description="Show verified credentials and professional certificates on your resume."
                breadcrumbs={[{ label: 'Resume' }, { label: 'Certifications' }]}
                primaryAction={{
                    label: 'Add certification',
                    onClick: openCreateForm,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadCertifications(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Certifications could not load"
                    action={<Button variant="secondary" onClick={() => void loadCertifications()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total credentials</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Credential proof</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.withCredential}</p>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Active</p>
                        <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.active}</p>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit certification' : 'New certification'}
                        description="Add the credential details visitors need to trust and verify your experience."
                    >
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Certification name"
                                value={formData.name}
                                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                                error={!formData.name.trim() && hasUnsavedChanges ? 'Certification name is required' : undefined}
                            />
                            <Input
                                label="Issuing organization"
                                value={formData.issuer}
                                onChange={(event) => setFormData((current) => ({ ...current, issuer: event.target.value }))}
                                error={!formData.issuer.trim() && hasUnsavedChanges ? 'Issuer is required' : undefined}
                            />
                            <Input
                                label="Credential ID"
                                value={formData.credential_id}
                                onChange={(event) => setFormData((current) => ({ ...current, credential_id: event.target.value }))}
                            />
                            <Input
                                label="Credential URL"
                                type="url"
                                value={formData.credential_url}
                                onChange={(event) => setFormData((current) => ({ ...current, credential_url: event.target.value }))}
                            />
                            <Input
                                label="Issued"
                                type="month"
                                value={formData.issue_date}
                                onChange={(event) => setFormData((current) => ({ ...current, issue_date: event.target.value }))}
                            />
                            <Input
                                label="Expires"
                                type="month"
                                value={formData.expiry_date}
                                onChange={(event) => setFormData((current) => ({ ...current, expiry_date: event.target.value }))}
                            />
                        </div>
                    </Section>
                </Card>
            )}

            {items.length === 0 && !showForm ? (
                <Card>
                    <Section title="Certifications">
                        <EmptyState
                            icon={<Award className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No certifications yet"
                            body="Add certificates, issuers, IDs, and verification links to make your resume more credible."
                            primaryAction={<Button onClick={openCreateForm}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add certification</Button>}
                        />
                    </Section>
                </Card>
            ) : items.length > 0 && (
                <Card>
                    <Section title="Certifications" description="Keep the strongest and most recent credentials near the top.">
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]">
                            {items.map((certification) => {
                                const hasProof = Boolean(certification.credential_id || certification.credential_url)

                                return (
                                    <article key={certification.id} className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)] md:flex-row md:items-start">
                                        <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <BadgeCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                    {certification.name}
                                                </h2>
                                                <Badge label={isActiveCertification(certification) ? 'Active' : 'Expired'} variant={isActiveCertification(certification) ? 'success' : 'warning'} />
                                                {hasProof && <Badge label="Verified details" variant="info" />}
                                            </div>
                                            <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                                {certification.issuer}
                                            </p>
                                            <div className="mt-[var(--lb-space-2)] flex flex-wrap gap-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                    <Calendar className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    {periodLabel(certification)}
                                                </span>
                                                {certification.credential_id && (
                                                    <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                        <ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        ID {certification.credential_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 gap-[var(--lb-space-1)]">
                                            {certification.credential_url && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Open credential for ${certification.name}`}
                                                    onClick={() => {
                                                        if (certification.credential_url) {
                                                            window.open(certification.credential_url, '_blank', 'noopener,noreferrer')
                                                        }
                                                    }}
                                                >
                                                    <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Edit ${certification.name}`}
                                                onClick={() => startEdit(certification)}
                                            >
                                                <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Delete ${certification.name}`}
                                                onClick={() => setCertificationToDelete(certification)}
                                            >
                                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    </Section>
                </Card>
            )}

            {showForm && (
                <SaveBar
                    state={saveState}
                    onSave={() => void handleSave()}
                    onDiscard={closeForm}
                    saveLabel={editingId ? 'Update certification' : 'Create certification'}
                    discardLabel="Discard"
                />
            )}

            <ConfirmDialog
                open={Boolean(certificationToDelete)}
                title="Delete certification?"
                description={certificationToDelete ? `Delete ${certificationToDelete.name} from ${certificationToDelete.issuer}? This cannot be undone.` : 'Delete this certification?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete certification'}
                cancelLabel="Keep certification"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setCertificationToDelete(null)
                }}
            />
        </Page>
    )
}
