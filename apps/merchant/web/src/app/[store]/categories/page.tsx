'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input, Table,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    EmptyState,
    LayoutGrid,
    Package,
    Page,
    PageHeader,
    Pencil,
    Plus,
    SaveBar,
    Section,
    Skeleton,
    Tag,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'

type SaveState = 'saved' | 'unsaved' | 'saving'

interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    image_url: string | null
    parent_id: string | null
    display_order: number
    is_visible: boolean
    product_count: number
    created_at: string
}

interface CategoryFormData {
    name: string
    slug: string
    description: string
}

const blankCategoryForm: CategoryFormData = {
    name: '',
    slug: '',
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

function generateSlug(name: string) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

export default function CategoriesPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<CategoryFormData>(blankCategoryForm)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSaveState, setFormSaveState] = useState<SaveState>('saved')
    const [saving, setSaving] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const loadCategories = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/categories`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load categories'))
            }

            setCategories(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load categories'
            setCategories([])
            setLoadError(message)
            notify({
                title: 'Categories could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadCategories()
    }, [loadCategories])

    const categoryStats = useMemo(() => ({
        total: categories.length,
        visible: categories.filter((category) => category.is_visible).length,
        products: categories.reduce((total, category) => total + (category.product_count || 0), 0),
    }), [categories])

    const updateForm = useCallback(<Key extends keyof CategoryFormData>(key: Key, value: CategoryFormData[Key]) => {
        setFormData((current) => ({
            ...current,
            [key]: value,
            ...(key === 'name' && !current.slug ? { slug: generateSlug(value) } : {}),
        }))
        setFormSaveState('unsaved')
        setFormError(null)
    }, [])

    const startCreate = useCallback(() => {
        setShowForm(true)
        setEditingId(null)
        setFormData(blankCategoryForm)
        setFormError(null)
        setFormSaveState('unsaved')
    }, [])

    const startEdit = useCallback((category: Category) => {
        setShowForm(true)
        setEditingId(category.id)
        setFormData({
            name: category.name,
            slug: category.slug,
            description: category.description || '',
        })
        setFormError(null)
        setFormSaveState('saved')
    }, [])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        setFormData(blankCategoryForm)
        setFormError(null)
        setFormSaveState('saved')
    }, [])

    const handleSave = useCallback(async () => {
        const name = formData.name.trim()
        const slug = formData.slug.trim() || generateSlug(name)

        if (!name) {
            setFormError('Enter a category name before saving.')
            setFormSaveState('unsaved')
            return
        }

        setSaving(true)
        setFormSaveState('saving')
        setFormError(null)

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/categories/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/categories`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        slug,
                        description: formData.description.trim() || null,
                    }),
                },
            )
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to save category'))
            }

            notify({
                title: editingId ? 'Category updated' : 'Category created',
                description: `${name} is ready for product organization.`,
                variant: 'success',
            })
            closeForm()
            await loadCategories({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save category'
            setFormError(message)
            setFormSaveState('unsaved')
            notify({
                title: 'Could not save category',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadCategories, notify, store])

    const handleDelete = useCallback(async () => {
        if (!categoryToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/categories/${encodeURIComponent(categoryToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete category'))
            }

            notify({
                title: 'Category deleted',
                description: `${categoryToDelete.name} was removed from your catalog taxonomy.`,
                variant: 'success',
            })
            setCategoryToDelete(null)
            await loadCategories({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete category'
            notify({
                title: 'Could not delete category',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [categoryToDelete, deleting, loadCategories, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Categories"
                    description="Organize products into shopper-friendly catalog groups."
                    breadcrumbs={[{ label: 'Products' }, { label: 'Categories' }]}
                />
                <Card>
                    <Section title="Category list">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Categories"
                description="Organize products into shopper-friendly catalog groups."
                breadcrumbs={[{ label: 'Products' }, { label: 'Categories' }]}
                primaryAction={{
                    label: 'Add category',
                    onClick: startCreate,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Categories could not load"
                    action={<Button variant="secondary" onClick={() => void loadCategories()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <LayoutGrid className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total categories</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{categoryStats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Visible categories</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{categoryStats.visible}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Assigned products</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{categoryStats.products}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit category' : 'New category'}
                        description="Name the collection, confirm its URL slug, and add optional internal context."
                    >
                        {formError && (
                            <Banner variant="critical" title="Category could not be saved">
                                {formError}
                            </Banner>
                        )}

                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Name"
                                placeholder="Sneakers"
                                value={formData.name}
                                onChange={(event) => updateForm('name', event.target.value)}
                            />
                            <Input
                                label="Slug"
                                placeholder="sneakers"
                                value={formData.slug || generateSlug(formData.name)}
                                onChange={(event) => updateForm('slug', event.target.value)}
                                helperText="Used in storefront category URLs."
                            />
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Description"
                                    placeholder="Optional shopper-facing summary"
                                    value={formData.description}
                                    onChange={(event) => updateForm('description', event.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                loading={saving}
                                disabled={!formData.name.trim()}
                                onClick={() => void handleSave()}
                            >
                                {editingId ? 'Update category' : 'Create category'}
                            </Button>
                            <Button variant="secondary" onClick={closeForm} disabled={saving}>
                                Cancel
                            </Button>
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Category list"
                    description="Review storefront visibility, product counts, and URL slugs."
                >
                    {categories.length === 0 && !showForm ? (
                        <EmptyState
                            icon={<LayoutGrid className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No categories yet"
                            body="Create categories to help shoppers browse your product catalog by intent, season, or collection."
                            primaryAction={<Button onClick={startCreate}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Add category</Button>}
                        />
                    ) : categories.length > 0 ? (
                        <div className="overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            <Table tableClassName="w-full text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                                <thead className="bg-[var(--lb-color-surface-subdued)]">
                                    <tr>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Name</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Slug</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Products</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Visibility</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--lb-color-border)]">
                                    {categories.map((category) => (
                                        <tr key={category.id} className="hover:bg-[var(--lb-color-surface-subdued)]">
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <div className="flex items-center gap-[var(--lb-space-3)]">
                                                    <span className="flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] shrink-0 items-center justify-center rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                                        <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    </span>
                                                    <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">{category.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">/{category.slug}</td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">{category.product_count || 0}</td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <Badge
                                                    label={category.is_visible ? 'Visible' : 'Hidden'}
                                                    variant={category.is_visible ? 'success' : 'default'}
                                                />
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <div className="flex justify-end gap-[var(--lb-space-2)]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => startEdit(category)}
                                                        aria-label={`Edit category ${category.name}`}
                                                    >
                                                        <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setCategoryToDelete(category)}
                                                        aria-label={`Delete category ${category.name}`}
                                                        className="text-[var(--lb-color-critical)]"
                                                    >
                                                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : null}
                </Section>
            </Card>

            <SaveBar
                state={formSaveState}
                onSave={() => void handleSave()}
                onDiscard={closeForm}
                saveLabel={editingId ? 'Update category' : 'Create category'}
                discardLabel="Discard"
            />

            <ConfirmDialog
                open={Boolean(categoryToDelete)}
                title="Delete category?"
                description={categoryToDelete ? `Delete ${categoryToDelete.name}? Products keep existing data, but shoppers will lose this catalog grouping.` : 'Delete this category?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete category'}
                cancelLabel="Keep category"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setCategoryToDelete(null)
                }}
            />
        </Page>
    )
}
