'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    Eye,
    EyeOff,
    FileText,
    Input,
    Page,
    PageHeader,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'

type PageStatus = 'draft' | 'published' | 'archived'
type SaveState = 'saved' | 'unsaved' | 'saving'

interface StorePage {
    id: string
    title: string
    slug: string
    status: PageStatus | string
    updated_at: string
}

interface PageFormData {
    title: string
    slug: string
    body: string
}

const blankPage: PageFormData = {
    title: '',
    slug: '',
    body: '',
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

function slugify(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusVariant(status: string) {
    if (status === 'published') return 'success' as const
    if (status === 'archived') return 'critical' as const
    return 'default' as const
}

function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function PagesPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [pages, setPages] = useState<StorePage[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState<PageFormData>(blankPage)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSaveState, setFormSaveState] = useState<SaveState>('saved')
    const [saving, setSaving] = useState(false)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [pageToDelete, setPageToDelete] = useState<StorePage | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadPages = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages?limit=100`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load pages'))
            }

            setPages(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load pages'
            setPages([])
            setLoadError(message)
            notify({
                title: 'Pages could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadPages()
    }, [loadPages])

    const stats = useMemo(() => ({
        total: pages.length,
        published: pages.filter((page) => page.status === 'published').length,
        drafts: pages.filter((page) => page.status !== 'published').length,
    }), [pages])

    const updateForm = useCallback(<Key extends keyof PageFormData>(key: Key, value: PageFormData[Key]) => {
        setFormData((current) => ({
            ...current,
            [key]: value,
            ...(key === 'title' && !current.slug ? { slug: slugify(value) } : {}),
        }))
        setFormSaveState('unsaved')
        setFormError(null)
    }, [])

    const startCreate = useCallback(() => {
        setShowForm(true)
        setFormData(blankPage)
        setFormError(null)
        setFormSaveState('unsaved')
    }, [])

    const discardForm = useCallback(() => {
        setShowForm(false)
        setFormData(blankPage)
        setFormError(null)
        setFormSaveState('saved')
    }, [])

    const handleSave = useCallback(async () => {
        const title = formData.title.trim()
        const slug = formData.slug.trim() || slugify(title)

        if (!title) {
            setFormError('Enter a page title before saving.')
            setFormSaveState('unsaved')
            return
        }

        setSaving(true)
        setFormSaveState('saving')
        setFormError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    slug,
                    body: formData.body,
                    status: 'draft',
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to create page'))
            }

            notify({
                title: 'Page created',
                description: `${title} was saved as a draft.`,
                variant: 'success',
            })
            setFormSaveState('saved')
            setFormData(blankPage)
            setShowForm(false)
            await loadPages({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to create page'
            setFormError(message)
            setFormSaveState('unsaved')
            notify({
                title: 'Could not create page',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [formData, loadPages, notify, store])

    const handleTogglePublish = useCallback(async (page: StorePage) => {
        const nextStatus = page.status === 'published' ? 'draft' : 'published'
        setTogglingId(page.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(page.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update page status'))
            }

            notify({
                title: nextStatus === 'published' ? 'Page published' : 'Page unpublished',
                description: `${page.title} is now ${nextStatus}.`,
                variant: 'success',
            })
            await loadPages({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update page status'
            notify({
                title: 'Could not update page',
                description: message,
                variant: 'critical',
            })
        } finally {
            setTogglingId(null)
        }
    }, [loadPages, notify, store])

    const handleDelete = useCallback(async () => {
        if (!pageToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(pageToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete page'))
            }

            notify({
                title: 'Page deleted',
                description: `${pageToDelete.title} was removed from storefront content.`,
                variant: 'success',
            })
            setPageToDelete(null)
            await loadPages({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete page'
            notify({
                title: 'Could not delete page',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [deleting, loadPages, notify, pageToDelete, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Pages"
                    description="Create and publish informational pages for this site."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Pages' }]}
                />
                <Card>
                    <Section title="Page list">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Pages"
                description="Create and publish informational pages for this site."
                breadcrumbs={[{ label: 'Content' }, { label: 'Pages' }]}
                primaryAction={{
                    label: 'Create page',
                    onClick: startCreate,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadPages(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Pages could not load"
                    action={<Button variant="secondary" onClick={() => void loadPages()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total pages</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                                <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Published</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.published}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
                                <EyeOff className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Drafts</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.drafts}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title="New page"
                        description="Draft a page title, URL slug, and content. New pages are created as drafts."
                    >
                        {formError && (
                            <Banner variant="critical" title="Page could not be saved">
                                {formError}
                            </Banner>
                        )}

                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Page title"
                                placeholder="About us"
                                value={formData.title}
                                onChange={(event) => updateForm('title', event.target.value)}
                            />
                            <Input
                                label="Slug"
                                placeholder="about-us"
                                value={formData.slug}
                                onChange={(event) => updateForm('slug', slugify(event.target.value))}
                                helperText={`Preview: /${formData.slug || slugify(formData.title) || 'page-slug'}`}
                            />
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Body"
                                    placeholder="Write page content..."
                                    value={formData.body}
                                    onChange={(event) => updateForm('body', event.target.value)}
                                    rows={8}
                                    className="font-mono"
                                />
                            </div>
                            <Select
                                label="Initial status"
                                value="draft"
                                disabled
                                options={[{ label: 'Draft', value: 'draft' }]}
                                helperText="Publish the page after it has been created."
                            />
                        </div>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                loading={saving}
                                disabled={!formData.title.trim()}
                                onClick={() => void handleSave()}
                            >
                                Create draft
                            </Button>
                            <Button variant="secondary" onClick={discardForm} disabled={saving}>
                                Cancel
                            </Button>
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Page list"
                    description="Publish, unpublish, or remove storefront pages."
                >
                    {pages.length === 0 ? (
                        <EmptyState
                            icon={<FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No pages yet"
                            body="Create pages like About, Contact, FAQ, portfolio details, or service pages for your site."
                            primaryAction={<Button onClick={startCreate}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Create page</Button>}
                        />
                    ) : (
                        <div className="overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            <table className="w-full text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                                <thead className="bg-[var(--lb-color-surface-subdued)]">
                                    <tr>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Page</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Status</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Updated</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--lb-color-border)]">
                                    {pages.map((page) => (
                                        <tr key={page.id}>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                                                    <span className="flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                                        <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{page.title}</p>
                                                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">/{page.slug}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <Badge label={statusLabel(page.status)} variant={statusVariant(page.status)} />
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">
                                                {formatDate(page.updated_at)}
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <div className="flex flex-wrap justify-end gap-[var(--lb-space-2)]">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        loading={togglingId === page.id}
                                                        onClick={() => void handleTogglePublish(page)}
                                                    >
                                                        {page.status === 'published' ? (
                                                            <EyeOff className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        ) : (
                                                            <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        )}
                                                        {page.status === 'published' ? 'Unpublish' : 'Publish'}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={deleting}
                                                        onClick={() => setPageToDelete(page)}
                                                    >
                                                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>
            </Card>

            {showForm && (
                <SaveBar
                    state={formSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={discardForm}
                    saveLabel="Create draft"
                />
            )}

            <ConfirmDialog
                open={Boolean(pageToDelete)}
                title="Delete page?"
                description={pageToDelete ? `This permanently removes ${pageToDelete.title} from storefront pages.` : 'This permanently removes the selected page.'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete page'}
                destructive
                onClose={() => {
                    if (!deleting) setPageToDelete(null)
                }}
                onConfirm={() => void handleDelete()}
            />
        </Page>
    )
}
