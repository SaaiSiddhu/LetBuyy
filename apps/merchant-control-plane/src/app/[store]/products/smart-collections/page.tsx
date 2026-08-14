'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    Input,
    MaterialIcon,
    Modal,
    Page,
    PageHeader,
    Section,
    Select,
    Skeleton,
    Spinner,
    useToast,
    type SelectOption,
} from '@letbuyy/ui'
import { slugifyCmsTitle as slugify } from '@letbuyy/cms-core'
import type {
    SmartCollection,
    SmartCondition,
    SmartConditionField,
    SmartConditionOp,
    SmartMatchType,
    SmartCollectionPreviewResult,
} from '@letbuyy/api-client'

// ── Vocabulary ────────────────────────────────────────────────────────────────

const FIELD_OPTIONS: SelectOption[] = [
    { label: 'Title', value: 'title' },
    { label: 'Product type', value: 'product_type' },
    { label: 'Vendor', value: 'vendor' },
    { label: 'Tag', value: 'tag' },
    { label: 'Price (₹)', value: 'price' },
    { label: 'Inventory quantity', value: 'inventory_quantity' },
]

const OP_OPTIONS: SelectOption[] = [
    { label: 'equals', value: 'equals' },
    { label: 'does not equal', value: 'not_equals' },
    { label: 'contains', value: 'contains' },
    { label: 'starts with', value: 'starts_with' },
    { label: 'ends with', value: 'ends_with' },
    { label: 'is greater than', value: 'gt' },
    { label: 'is less than', value: 'lt' },
]

const MATCH_TYPE_OPTIONS: SelectOption[] = [
    { label: 'All conditions (AND)', value: 'all' },
    { label: 'Any condition (OR)', value: 'any' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyCondition(): SmartCondition {
    return { field: 'title', op: 'contains', value: '' }
}

interface CollectionForm {
    name: string
    slug: string
    description: string
    match_type: SmartMatchType
    conditions: SmartCondition[]
}

function emptyForm(): CollectionForm {
    return { name: '', slug: '', description: '', match_type: 'all', conditions: [emptyCondition()] }
}

// ── Rule builder ──────────────────────────────────────────────────────────────

interface RuleBuilderProps {
    conditions: SmartCondition[]
    matchType: SmartMatchType
    onChange: (conditions: SmartCondition[]) => void
    onMatchTypeChange: (mt: SmartMatchType) => void
    disabled?: boolean
}

function RuleBuilder({ conditions, matchType, onChange, onMatchTypeChange, disabled }: RuleBuilderProps) {
    function updateCondition(index: number, patch: Partial<SmartCondition>) {
        onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)))
    }

    function addCondition() {
        onChange([...conditions, emptyCondition()])
    }

    function removeCondition(index: number) {
        onChange(conditions.filter((_, i) => i !== index))
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lb-space-3)' }}>
            {/* Match type toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lb-space-2)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--lb-font-size-body)', color: 'var(--lb-color-text-secondary)' }}>
                    Products must match
                </span>
                <div style={{ minWidth: '10rem' }}>
                    <Select
                        label="Match type"
                        hideLabel
                        options={MATCH_TYPE_OPTIONS}
                        value={matchType}
                        onChange={(e) => onMatchTypeChange(e.currentTarget.value as SmartMatchType)}
                        disabled={disabled}
                    />
                </div>
                <span style={{ fontSize: 'var(--lb-font-size-body)', color: 'var(--lb-color-text-secondary)' }}>
                    of the following conditions:
                </span>
            </div>

            {conditions.length === 0 && (
                <p style={{ margin: 0, fontSize: 'var(--lb-font-size-body)', color: 'var(--lb-color-text-subdued)' }}>
                    No conditions — all active products will be included.
                </p>
            )}

            {/* Condition rows */}
            {conditions.map((cond, i) => (
                <div
                    key={i}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr auto',
                        gap: 'var(--lb-space-2)',
                        alignItems: 'end',
                    }}
                >
                    <Select
                        label="Field"
                        hideLabel
                        options={FIELD_OPTIONS}
                        value={cond.field}
                        onChange={(e) => updateCondition(i, { field: e.currentTarget.value as SmartConditionField })}
                        disabled={disabled}
                    />
                    <Select
                        label="Operator"
                        hideLabel
                        options={OP_OPTIONS}
                        value={cond.op}
                        onChange={(e) => updateCondition(i, { op: e.currentTarget.value as SmartConditionOp })}
                        disabled={disabled}
                    />
                    <Input
                        label="Value"
                        aria-label="Condition value"
                        placeholder="Value"
                        value={cond.value}
                        onChange={(e) => updateCondition(i, { value: e.currentTarget.value })}
                        disabled={disabled}
                    />
                    <Button
                        unstyled
                        type="button"
                        onClick={() => removeCondition(i)}
                        disabled={disabled}
                        aria-label="Remove condition"
                        style={{
                            background: 'none',
                            border: '1px solid var(--lb-color-border)',
                            borderRadius: 'var(--lb-radius-md)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            color: 'var(--lb-color-critical)',
                            padding: 'var(--lb-space-2)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 'var(--lb-size-control-md)',
                            width: 'var(--lb-size-control-md)',
                        }}
                    >
                        <MaterialIcon name="delete_outline" size={18} />
                    </Button>
                </div>
            ))}

            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={addCondition}
                    disabled={disabled}
                    type="button"
                >
                    <MaterialIcon name="add" size={16} style={{ marginRight: 'var(--lb-space-1)' }} />
                    Add condition
                </Button>
            </div>
        </div>
    )
}

// ── Collection form modal ─────────────────────────────────────────────────────

interface CollectionModalProps {
    open: boolean
    onClose: () => void
    onSaved: (collection: SmartCollection) => void
    store: string
    editing?: SmartCollection | null
}

function CollectionModal({ open, onClose, onSaved, store, editing }: CollectionModalProps) {
    const [form, setForm] = useState<CollectionForm>(emptyForm())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<SmartCollectionPreviewResult | null>(null)
    const [previewing, setPreviewing] = useState(false)
    const { notify } = useToast()

    useEffect(() => {
        if (editing) {
            setForm({
                name: editing.name,
                slug: editing.slug,
                description: editing.description ?? '',
                match_type: editing.match_type,
                conditions: editing.conditions?.length ? editing.conditions : [emptyCondition()],
            })
        } else {
            setForm(emptyForm())
        }
        setError(null)
        setPreview(null)
    }, [editing, open])

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const name = e.currentTarget.value
        setForm((f) => ({
            ...f,
            name,
            ...(editing ? {} : { slug: slugify(name) }),
        }))
    }

    async function handlePreview() {
        if (!editing) {
            notify({ title: 'Save the collection first to preview matching products.', variant: 'info' })
            return
        }
        setPreviewing(true)
        setPreview(null)
        try {
            const res = await fetch(
                `/api/stores/${encodeURIComponent(store)}/smart-collections/${editing.id}/preview`
            )
            if (!res.ok) throw new Error('Preview failed')
            const json = await res.json() as { data?: SmartCollectionPreviewResult }
            setPreview(json.data ?? null)
        } catch {
            setError('Unable to load preview. Please try again.')
        } finally {
            setPreviewing(false)
        }
    }

    async function handleSave() {
        setError(null)
        if (!form.name.trim()) { setError('Name is required.'); return }
        if (!form.slug.trim()) { setError('Slug is required.'); return }

        setSaving(true)
        try {
            const url = editing
                ? `/api/stores/${encodeURIComponent(store)}/smart-collections/${editing.id}`
                : `/api/stores/${encodeURIComponent(store)}/smart-collections`

            const method = editing ? 'PATCH' : 'POST'
            const payload = {
                name: form.name,
                slug: form.slug,
                description: form.description || null,
                match_type: form.match_type,
                conditions: form.conditions,
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (res.status === 409) {
                setError('A collection with this slug already exists. Please choose a different slug.')
                return
            }

            if (!res.ok) {
                const json = await res.json() as { error?: string }
                throw new Error(json.error ?? 'Failed to save')
            }

            const json = await res.json() as { data: SmartCollection }
            notify({ title: editing ? 'Collection updated.' : 'Collection created.', variant: 'success' })
            onSaved(json.data)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const footer = (
        <div style={{ display: 'flex', gap: 'var(--lb-space-2)', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={onClose} disabled={saving} type="button">
                Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving} type="button">
                {saving ? 'Saving…' : 'Save'}
            </Button>
        </div>
    )

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? 'Edit smart collection' : 'Create smart collection'}
            footer={footer}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lb-space-4)' }}>
                {error && (
                    <Banner variant="critical" title="Error">
                        {error}
                    </Banner>
                )}

                <Input
                    label="Collection name"
                    value={form.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Summer Sale"
                    disabled={saving}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                />
                <Input
                    label="Slug"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.currentTarget.value }))}
                    placeholder="e.g. summer-sale"
                    helperText="Used in the storefront URL. Lowercase letters, numbers, and hyphens only."
                    disabled={saving}
                />
                <Input
                    label="Description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
                    placeholder="Optional description"
                    disabled={saving}
                />

                {/* Conditions block */}
                <div
                    style={{
                        padding: 'var(--lb-space-3)',
                        borderRadius: 'var(--lb-radius-md)',
                        border: '1px solid var(--lb-color-border)',
                        background: 'var(--lb-color-surface-subdued)',
                    }}
                >
                    <p style={{ margin: '0 0 var(--lb-space-3) 0', fontWeight: 600, fontSize: 'var(--lb-font-size-body)' }}>
                        Conditions
                    </p>
                    <RuleBuilder
                        conditions={form.conditions}
                        matchType={form.match_type}
                        onChange={(conditions) => setForm((f) => ({ ...f, conditions }))}
                        onMatchTypeChange={(mt) => setForm((f) => ({ ...f, match_type: mt }))}
                        disabled={saving}
                    />
                </div>

                {/* Preview (only for saved collections) */}
                {editing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lb-space-2)' }}>
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePreview}
                                disabled={previewing || saving}
                                type="button"
                            >
                                {previewing
                                    ? <><Spinner size="sm" />&nbsp;Loading preview…</>
                                    : <><MaterialIcon name="visibility" size={16} style={{ marginRight: 'var(--lb-space-1)' }} />Preview matching products</>
                                }
                            </Button>
                        </div>

                        {preview && (
                            <div
                                style={{
                                    padding: 'var(--lb-space-3)',
                                    borderRadius: 'var(--lb-radius-md)',
                                    background: 'var(--lb-color-surface-subdued)',
                                    fontSize: 'var(--lb-font-size-body)',
                                    border: '1px solid var(--lb-color-border)',
                                }}
                            >
                                <strong>{preview.count}</strong> product{preview.count !== 1 ? 's' : ''} match
                                {' '}(evaluated {preview.evaluated_of} active products
                                {preview.evaluated_of >= preview.capped_at ? `, showing top ${preview.capped_at}` : ''}).
                                {preview.sample_product_ids.length > 0 && (
                                    <p style={{ marginTop: 'var(--lb-space-1)', color: 'var(--lb-color-text-subdued)', fontSize: 'var(--lb-font-size-caption)' }}>
                                        Sample IDs: {preview.sample_product_ids.slice(0, 5).join(', ')}
                                        {preview.sample_product_ids.length > 5 && ` and ${preview.sample_product_ids.length - 5} more`}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SmartCollectionsPage() {
    const params = useParams<{ store: string }>()
    const store = params.store ?? ''

    const [collections, setCollections] = useState<SmartCollection[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState<SmartCollection | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/smart-collections`)
            if (!res.ok) throw new Error('Failed to load')
            const json = await res.json() as { data: SmartCollection[] }
            setCollections(json.data ?? [])
        } catch {
            setLoadError('Unable to load smart collections. Please refresh the page.')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => { void load() }, [load])

    function openCreate() {
        setEditing(null)
        setModalOpen(true)
    }

    function openEdit(collection: SmartCollection) {
        setEditing(collection)
        setModalOpen(true)
    }

    function handleSaved(collection: SmartCollection) {
        setCollections((prev) => {
            const idx = prev.findIndex((c) => c.id === collection.id)
            return idx >= 0
                ? prev.map((c, i) => (i === idx ? collection : c))
                : [collection, ...prev]
        })
    }

    return (
        <Page>
            <PageHeader
                title="Smart collections"
                description="Collections that automatically include products matching your rules."
                breadcrumbs={[
                    { label: 'Products', href: `/${store}/products` },
                    { label: 'Smart collections' },
                ]}
                showBreadcrumbs
                primaryAction={{
                    label: 'Create collection',
                    icon: <MaterialIcon name="add" size={16} />,
                    onClick: openCreate,
                    disabled: loading,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load">
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Collections"
                    description="Rules evaluate against your active products when you use the Preview button."
                >
                    {loading ? (
                        <Skeleton variant="table" lines={4} />
                    ) : collections.length === 0 ? (
                        <EmptyState
                            kind="collections"
                            title="No smart collections yet"
                            body="Smart collections automatically include products that match the conditions you define — no manual curation needed."
                            primaryAction={
                                <Button variant="primary" onClick={openCreate} type="button">
                                    Create collection
                                </Button>
                            }
                        />
                    ) : (
                        <div role="table" aria-label="Smart collections" style={{ width: '100%' }}>
                            {/* Header */}
                            <div
                                role="row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr auto',
                                    gap: 'var(--lb-space-3)',
                                    padding: 'var(--lb-space-2) var(--lb-space-3)',
                                    borderBottom: '1px solid var(--lb-color-border)',
                                    fontSize: 'var(--lb-font-size-caption)',
                                    fontWeight: 600,
                                    color: 'var(--lb-color-text-subdued)',
                                    textTransform: 'uppercase' as const,
                                    letterSpacing: '0.05em',
                                }}
                            >
                                <span role="columnheader">Collection</span>
                                <span role="columnheader">Match type</span>
                                <span role="columnheader">Rules</span>
                                <span role="columnheader" />
                            </div>

                            {/* Rows */}
                            {collections.map((collection) => (
                                <div
                                    key={collection.id}
                                    role="row"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 1fr 1fr auto',
                                        gap: 'var(--lb-space-3)',
                                        padding: 'var(--lb-space-3)',
                                        borderBottom: '1px solid var(--lb-color-border)',
                                        alignItems: 'center',
                                    }}
                                >
                                    <div role="cell">
                                        <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--lb-font-size-body)' }}>
                                            {collection.name}
                                        </p>
                                        <p style={{ margin: 0, fontSize: 'var(--lb-font-size-caption)', color: 'var(--lb-color-text-subdued)' }}>
                                            /{collection.slug}
                                        </p>
                                    </div>
                                    <div role="cell">
                                        <Badge
                                            label={collection.match_type === 'all' ? 'All (AND)' : 'Any (OR)'}
                                            variant={collection.match_type === 'all' ? 'info' : 'default'}
                                        />
                                    </div>
                                    <div role="cell" style={{ fontSize: 'var(--lb-font-size-body)', color: 'var(--lb-color-text-subdued)' }}>
                                        {(collection.conditions ?? []).length} rule{(collection.conditions ?? []).length !== 1 ? 's' : ''}
                                    </div>
                                    <div role="cell">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openEdit(collection)}
                                            type="button"
                                        >
                                            <MaterialIcon name="edit" size={16} style={{ marginRight: 'var(--lb-space-1)' }} />
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </Card>

            <CollectionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={handleSaved}
                store={store}
                editing={editing}
            />
        </Page>
    )
}
