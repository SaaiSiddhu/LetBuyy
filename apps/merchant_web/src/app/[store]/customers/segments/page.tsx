'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    Drawer,
    EmptyState,
    Input,
    MaterialIcon,
    NumberField,
    Page,
    PageHeader,
    Section,
    Select,
    Skeleton,
    Switch,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

// ---------------------------------------------------------------------------
// Local types (mirrors gateway CustomerSegment / CustomerSegmentRules shapes)
// ---------------------------------------------------------------------------

interface SegmentRules {
    status?: 'active' | 'blocked' | null
    accepts_marketing?: boolean | null
    tags_any?: string[]
    min_order_count?: number | null
    min_total_spent?: number | null
    last_order_after?: string | null
    last_order_before?: string | null
}

interface Segment {
    id: string
    store_id: string
    name: string
    description: string | null
    rules: SegmentRules
    customer_count: number
    created_at: string
    updated_at: string
}

interface SegmentPreview {
    store_id: string
    rules: SegmentRules
    customer_count: number
    sample_customers: Array<{ id: string; email: string; display_name: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    return typeof v === 'string' ? v : ''
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
    const v = row[key]
    return typeof v === 'string' && v.trim() ? v : null
}

function readNumber(row: Record<string, unknown>, key: string): number {
    return Number(row[key] ?? 0)
}

function readRules(raw: unknown): SegmentRules {
    if (!raw || typeof raw !== 'object') return { tags_any: [] }
    const r = raw as Record<string, unknown>
    return {
        status: (r.status as SegmentRules['status']) ?? undefined,
        accepts_marketing: typeof r.accepts_marketing === 'boolean' ? r.accepts_marketing : undefined,
        tags_any: Array.isArray(r.tags_any) ? (r.tags_any as string[]) : [],
        min_order_count: typeof r.min_order_count === 'number' ? r.min_order_count : undefined,
        min_total_spent: typeof r.min_total_spent === 'number' ? r.min_total_spent : undefined,
        last_order_after: readNullableString(r, 'last_order_after') ?? undefined,
        last_order_before: readNullableString(r, 'last_order_before') ?? undefined,
    }
}

function mapSegment(raw: Record<string, unknown>): Segment {
    return {
        id: readString(raw, 'id'),
        store_id: readString(raw, 'store_id'),
        name: readString(raw, 'name') || 'Unnamed segment',
        description: readNullableString(raw, 'description'),
        rules: readRules(raw.rules),
        customer_count: readNumber(raw, 'customer_count'),
        created_at: readString(raw, 'created_at'),
        updated_at: readString(raw, 'updated_at'),
    }
}

function mapPreview(raw: Record<string, unknown>): SegmentPreview {
    return {
        store_id: readString(raw, 'store_id'),
        rules: readRules(raw.rules),
        customer_count: readNumber(raw, 'customer_count'),
        sample_customers: Array.isArray(raw.sample_customers)
            ? (raw.sample_customers as Array<Record<string, unknown>>).map((c) => ({
                id: readString(c, 'id'),
                email: readString(c, 'email'),
                display_name: readString(c, 'display_name') || readString(c, 'email'),
            }))
            : [],
    }
}

function rulesHaveFilters(rules: SegmentRules): boolean {
    return !!(
        rules.status ||
        rules.accepts_marketing !== undefined && rules.accepts_marketing !== null ||
        (rules.tags_any ?? []).length > 0 ||
        rules.min_order_count ||
        rules.min_total_spent ||
        rules.last_order_after ||
        rules.last_order_before
    )
}

// ---------------------------------------------------------------------------
// Rule summary chip for the segment list
// ---------------------------------------------------------------------------

function RuleChips({ rules }: { rules: SegmentRules }) {
    const chips: string[] = []
    if (rules.status) chips.push(`Status: ${rules.status}`)
    if (rules.accepts_marketing === true) chips.push('Accepts marketing')
    if (rules.accepts_marketing === false) chips.push('No marketing')
    if ((rules.tags_any ?? []).length > 0) chips.push(`Tags: ${rules.tags_any!.join(', ')}`)
    if (rules.min_order_count) chips.push(`≥ ${rules.min_order_count} orders`)
    if (rules.min_total_spent) chips.push(`Spent ≥ ₹${(rules.min_total_spent / 100).toLocaleString('en-IN')}`)
    if (rules.last_order_after) chips.push(`Ordered after ${formatIndiaDate(rules.last_order_after, { emptyValue: '' })}`)
    if (rules.last_order_before) chips.push(`Ordered before ${formatIndiaDate(rules.last_order_before, { emptyValue: '' })}`)

    if (chips.length === 0) return (
        <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">No filters — matches all customers</span>
    )
    return (
        <div className="flex flex-wrap gap-[var(--lb-space-1)]">
            {chips.map((chip) => (
                <Badge key={chip} label={chip} variant="default" />
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Segment form (create / edit) — used inside the Drawer
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
    { label: 'Any', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Blocked', value: 'blocked' },
]

const MARKETING_OPTIONS = [
    { label: 'Any', value: '' },
    { label: 'Accepts marketing', value: 'yes' },
    { label: 'Does not accept marketing', value: 'no' },
]

function buildEmptyRules(): SegmentRules {
    return { tags_any: [] }
}

interface SegmentFormState {
    name: string
    description: string
    rules: SegmentRules
    // transient form fields (before they go into rules)
    tagsInput: string
    minOrders: string
    minSpentRupees: string
    lastOrderAfter: string
    lastOrderBefore: string
}

function buildFormState(segment?: Segment): SegmentFormState {
    const rules = segment?.rules ?? buildEmptyRules()
    return {
        name: segment?.name ?? '',
        description: segment?.description ?? '',
        rules,
        tagsInput: (rules.tags_any ?? []).join(', '),
        minOrders: rules.min_order_count != null ? String(rules.min_order_count) : '',
        minSpentRupees: rules.min_total_spent != null ? String(rules.min_total_spent / 100) : '',
        lastOrderAfter: rules.last_order_after
            ? rules.last_order_after.slice(0, 10)  // yyyy-mm-dd for <input type="date">
            : '',
        lastOrderBefore: rules.last_order_before
            ? rules.last_order_before.slice(0, 10)
            : '',
    }
}

function formStateToRules(form: SegmentFormState): SegmentRules {
    const tags = form.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    const minOrders = form.minOrders.trim() ? parseInt(form.minOrders, 10) : undefined
    const minSpent = form.minSpentRupees.trim() ? Math.round(parseFloat(form.minSpentRupees) * 100) : undefined
    const afterDate = form.lastOrderAfter ? `${form.lastOrderAfter}T00:00:00.000Z` : undefined
    const beforeDate = form.lastOrderBefore ? `${form.lastOrderBefore}T23:59:59.999Z` : undefined

    return {
        ...(form.rules.status ? { status: form.rules.status } : {}),
        ...(form.rules.accepts_marketing !== undefined && form.rules.accepts_marketing !== null
            ? { accepts_marketing: form.rules.accepts_marketing }
            : {}),
        tags_any: tags,
        ...(minOrders != null && !isNaN(minOrders) ? { min_order_count: minOrders } : {}),
        ...(minSpent != null && !isNaN(minSpent) ? { min_total_spent: minSpent } : {}),
        ...(afterDate ? { last_order_after: afterDate } : {}),
        ...(beforeDate ? { last_order_before: beforeDate } : {}),
    }
}

interface SegmentFormProps {
    form: SegmentFormState
    onChange: (next: SegmentFormState) => void
    preview: SegmentPreview | null
    previewLoading: boolean
    onPreview: () => void
}

function SegmentForm({ form, onChange, preview, previewLoading, onPreview }: SegmentFormProps) {
    const set = useCallback(<K extends keyof SegmentFormState>(key: K, value: SegmentFormState[K]) => {
        onChange({ ...form, [key]: value })
    }, [form, onChange])

    const setRule = useCallback(<K extends keyof SegmentRules>(key: K, value: SegmentRules[K]) => {
        onChange({ ...form, rules: { ...form.rules, [key]: value } })
    }, [form, onChange])

    return (
        <div className="flex flex-col gap-[var(--lb-space-5)]">
            {/* Name & description */}
            <div className="flex flex-col gap-[var(--lb-space-3)]">
                <Input
                    label="Segment name"
                    placeholder="e.g. VIP customers"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    required
                />
                <Input
                    label="Description"
                    placeholder="Optional description"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                />
            </div>

            {/* Filter rules */}
            <div className="flex flex-col gap-[var(--lb-space-3)]">
                <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">
                    Filter rules
                </span>
                <p className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                    Customers must match ALL conditions below. Leave empty to match everyone.
                </p>

                <Select
                    label="Customer status"
                    value={form.rules.status ?? ''}
                    options={STATUS_OPTIONS}
                    onChange={(e) => setRule('status', (e.target.value as SegmentRules['status']) || undefined)}
                />

                <Select
                    label="Marketing consent"
                    value={
                        form.rules.accepts_marketing === true
                            ? 'yes'
                            : form.rules.accepts_marketing === false
                                ? 'no'
                                : ''
                    }
                    options={MARKETING_OPTIONS}
                    onChange={(e) => {
                        const v = e.target.value
                        setRule(
                            'accepts_marketing',
                            v === 'yes' ? true : v === 'no' ? false : undefined,
                        )
                    }}
                />

                <Input
                    label="Has any of these tags (comma-separated)"
                    placeholder="e.g. vip, wholesale, repeat"
                    value={form.tagsInput}
                    onChange={(e) => set('tagsInput', e.target.value)}
                    helperText="Matches customers that have at least one of these tags"
                />

                <NumberField
                    label="Minimum order count"
                    placeholder="e.g. 3"
                    value={form.minOrders}
                    min={0}
                    step={1}
                    onValueChange={(_, raw) => set('minOrders', raw)}
                    helperText="Customers with at least this many orders"
                />

                <NumberField
                    label="Minimum total spent (₹)"
                    placeholder="e.g. 5000"
                    value={form.minSpentRupees}
                    min={0}
                    step={0.01}
                    onValueChange={(_, raw) => set('minSpentRupees', raw)}
                    helperText="Amount in rupees (fractions allowed for paise)"
                />

                <div className="flex flex-col gap-[var(--lb-space-1)]">
                    <label className="text-[var(--lb-color-text)] text-[var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)]">
                        Last ordered after
                    </label>
                    <Input
                        unstyled
                        type="date"
                        value={form.lastOrderAfter}
                        onChange={(e) => set('lastOrderAfter', e.target.value)}
                        className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[var(--lb-color-text)] text-[var(--lb-font-size-base)] focus:outline-2 focus:outline-[var(--lb-color-focus-ring)] w-full"
                    />
                </div>

                <div className="flex flex-col gap-[var(--lb-space-1)]">
                    <label className="text-[var(--lb-color-text)] text-[var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)]">
                        Last ordered before
                    </label>
                    <Input
                        unstyled
                        type="date"
                        value={form.lastOrderBefore}
                        onChange={(e) => set('lastOrderBefore', e.target.value)}
                        className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[var(--lb-color-text)] text-[var(--lb-font-size-base)] focus:outline-2 focus:outline-[var(--lb-color-focus-ring)] w-full"
                    />
                </div>
            </div>

            {/* Preview */}
            <div className="flex flex-col gap-[var(--lb-space-3)]">
                <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                    <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">
                        Preview
                    </span>
                    <Button variant="secondary" onClick={onPreview} disabled={previewLoading}>
                        {previewLoading ? (
                            <>
                                <MaterialIcon name="hourglass_top" />
                                Previewing…
                            </>
                        ) : (
                            <>
                                <MaterialIcon name="visibility" />
                                Preview count
                            </>
                        )}
                    </Button>
                </div>

                {preview && (
                    <div className="lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)] bg-[var(--lb-color-surface-raised)] flex flex-col gap-[var(--lb-space-2)]">
                        <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                            {preview.customer_count} matching {preview.customer_count === 1 ? 'customer' : 'customers'}
                        </span>
                        {preview.sample_customers.length > 0 && (
                            <div className="flex flex-col gap-[var(--lb-space-1)]">
                                <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                    Sample (up to 10):
                                </span>
                                {preview.sample_customers.slice(0, 10).map((c) => (
                                    <span key={c.id} className="text-[var(--lb-color-text)] text-[var(--lb-font-size-sm)]">
                                        {c.display_name !== c.email ? `${c.display_name} (${c.email})` : c.email}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Segment card row in the list
// ---------------------------------------------------------------------------

function SegmentCard({
    segment,
    store,
    onEdit,
}: {
    segment: Segment
    store: string
    onEdit: (segment: Segment) => void
}) {
    const router = useRouter()

    return (
        <div className="lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-4)] flex flex-col gap-[var(--lb-space-3)] bg-[var(--lb-color-surface)]">
            <div className="flex flex-col gap-[var(--lb-space-1)] sm:flex-row sm:items-start sm:justify-between sm:gap-[var(--lb-space-4)]">
                <div className="flex flex-col gap-[var(--lb-space-1)]">
                    <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">
                        {segment.name}
                    </span>
                    {segment.description && (
                        <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                            {segment.description}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-[var(--lb-space-2)] shrink-0">
                    <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)] whitespace-nowrap">
                        {segment.customer_count} {segment.customer_count === 1 ? 'customer' : 'customers'}
                    </span>
                    <Button
                        variant="secondary"
                        onClick={() => onEdit(segment)}
                    >
                        <MaterialIcon name="edit" />
                        Edit
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => router.push(`/${store}/customers?segment=${encodeURIComponent(segment.id)}`)}
                    >
                        <MaterialIcon name="group" />
                        View customers
                    </Button>
                </div>
            </div>
            <RuleChips rules={segment.rules} />
            <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                Updated {formatIndiaDate(segment.updated_at, { emptyValue: '—' })}
            </span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomerSegmentsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    // list state
    const [segments, setSegments] = useState<Segment[]>([])
    const [loading, setLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)

    // drawer state
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
    const [form, setForm] = useState<SegmentFormState>(buildFormState())
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    // preview state
    const [preview, setPreview] = useState<SegmentPreview | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // -----------------------------------------------------------------------
    // Load segments
    // -----------------------------------------------------------------------

    const loadSegments = useCallback(async () => {
        setLoading(true)
        setListError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/customers/segments`,
                { cache: 'no-store' },
            )
            const payload = await response.json().catch(() => null) as { data?: unknown[]; error?: unknown } | null

            if (!response.ok) {
                const msg = payload?.error
                    ? (typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error))
                    : 'Unable to load customer segments.'
                setListError(msg)
                return
            }

            const rows = Array.isArray(payload?.data)
                ? (payload.data as Array<Record<string, unknown>>).map(mapSegment)
                : []
            setSegments(rows)
        } catch {
            setListError('Unable to load customer segments.')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        void loadSegments()
    }, [loadSegments])

    // -----------------------------------------------------------------------
    // Preview
    // -----------------------------------------------------------------------

    const runPreview = useCallback(async (currentForm: SegmentFormState) => {
        setPreviewLoading(true)
        setPreview(null)
        try {
            const rules = formStateToRules(currentForm)
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/customers/segments/preview`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rules }),
                },
            )
            const payload = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null
            if (response.ok && payload?.data) {
                setPreview(mapPreview(payload.data as Record<string, unknown>))
            }
        } catch {
            // preview failure is non-fatal; just leave preview null
        } finally {
            setPreviewLoading(false)
        }
    }, [store])

    const handlePreview = useCallback(() => {
        void runPreview(form)
    }, [form, runPreview])

    // Auto-preview on form changes with debounce
    useEffect(() => {
        if (!drawerOpen) return
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
        previewTimeoutRef.current = setTimeout(() => {
            void runPreview(form)
        }, 800)
        return () => {
            if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, drawerOpen])

    // -----------------------------------------------------------------------
    // Open drawer
    // -----------------------------------------------------------------------

    const openCreateDrawer = useCallback(() => {
        setEditingSegment(null)
        setForm(buildFormState())
        setPreview(null)
        setSaveError(null)
        setDrawerOpen(true)
    }, [])

    const openEditDrawer = useCallback((segment: Segment) => {
        setEditingSegment(segment)
        setForm(buildFormState(segment))
        setPreview(null)
        setSaveError(null)
        setDrawerOpen(true)
    }, [])

    const closeDrawer = useCallback(() => {
        setDrawerOpen(false)
        setEditingSegment(null)
        setPreview(null)
        setSaveError(null)
    }, [])

    // -----------------------------------------------------------------------
    // Save (create or update)
    // -----------------------------------------------------------------------

    const handleSave = useCallback(async () => {
        const name = form.name.trim()
        if (!name) {
            setSaveError('Segment name is required.')
            return
        }

        setSaving(true)
        setSaveError(null)
        try {
            const rules = formStateToRules(form)
            const isEdit = editingSegment !== null

            const url = isEdit
                ? `/api/stores/${encodeURIComponent(store)}/customers/segments/${encodeURIComponent(editingSegment!.id)}`
                : `/api/stores/${encodeURIComponent(store)}/customers/segments`

            const response = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: form.description.trim() || null,
                    rules,
                }),
            })

            const payload = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: unknown } | null

            if (!response.ok) {
                const msg = payload?.error
                    ? (typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error))
                    : isEdit ? 'Unable to update segment.' : 'Unable to create segment.'
                setSaveError(msg)
                return
            }

            notify({
                title: isEdit ? 'Segment updated' : 'Segment created',
                variant: 'success',
            })
            closeDrawer()
            void loadSegments()
        } catch {
            setSaveError('A network error occurred. Please try again.')
        } finally {
            setSaving(false)
        }
    }, [closeDrawer, editingSegment, form, loadSegments, notify, store])

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    const drawerTitle = editingSegment ? `Edit "${editingSegment.name}"` : 'New customer segment'

    return (
        <Page>
            <PageHeader
                eyebrow="Relationships"
                title="Customer segments"
                description="Group customers by shared attributes to target campaigns and understand your audience."
                breadcrumbs={[
                    { label: 'Home', href: `/${store}/dashboard` },
                    { label: 'Customers', href: `/${store}/customers` },
                    { label: 'Segments' },
                ]}
                primaryAction={{ label: 'New segment', onClick: openCreateDrawer }}
                secondaryActions={[
                    { label: 'Refresh', onClick: () => void loadSegments() },
                    { label: 'All customers', href: `/${store}/customers` },
                ]}
            />

            {listError && (
                <Banner title="Unable to load segments" variant="critical">
                    {listError}
                </Banner>
            )}

            {loading ? (
                <Card>
                    <Section>
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            <Skeleton variant="text" lines={3} />
                            <Skeleton variant="text" lines={3} />
                        </div>
                    </Section>
                </Card>
            ) : segments.length === 0 ? (
                <Card>
                    <Section>
                        <EmptyState
                            icon={<MaterialIcon name="group_work" />}
                            title="No segments yet"
                            body="Create a segment to group customers by status, tags, spend, order count, or last order date."
                            primaryAction={
                                <Button onClick={openCreateDrawer}>
                                    <MaterialIcon name="add" />
                                    Create first segment
                                </Button>
                            }
                        />
                    </Section>
                </Card>
            ) : (
                <Card>
                    <Section
                        title="Saved segments"
                        description={`${segments.length} ${segments.length === 1 ? 'segment' : 'segments'}`}
                    >
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {segments.map((segment) => (
                                <SegmentCard
                                    key={segment.id}
                                    segment={segment}
                                    store={store}
                                    onEdit={openEditDrawer}
                                />
                            ))}
                        </div>
                    </Section>
                </Card>
            )}

            <Drawer
                open={drawerOpen}
                title={drawerTitle}
                description="Define filter rules. Customers matching all active rules will be in this segment."
                onClose={closeDrawer}
                side="right"
                size="md"
                footer={
                    <div className="flex flex-col gap-[var(--lb-space-2)]">
                        {saveError && (
                            <Banner title="Save failed" variant="critical">
                                {saveError}
                            </Banner>
                        )}
                        <div className="flex items-center justify-end gap-[var(--lb-space-2)]">
                            <Button variant="secondary" onClick={closeDrawer} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                                {saving ? 'Saving…' : editingSegment ? 'Update segment' : 'Create segment'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <SegmentForm
                    form={form}
                    onChange={setForm}
                    preview={preview}
                    previewLoading={previewLoading}
                    onPreview={handlePreview}
                />
            </Drawer>
        </Page>
    )
}
