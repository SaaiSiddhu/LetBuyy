'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Coupon as SharedCoupon } from '@letbuyy/shared-types'
import { Button, Input, Table,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    EmptyState,
    IndianRupee,
    Page,
    PageHeader,
    Pencil,
    Plus,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Tag,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

type CouponDiscountKind = SharedCoupon['type'] | 'fixed_amount'
type SaveState = 'saved' | 'unsaved' | 'saving'

type CouponRow = Omit<
    Pick<SharedCoupon, 'id' | 'code' | 'value' | 'used_count' | 'starts_at' | 'expires_at' | 'is_active' | 'created_at'>,
    'starts_at' | 'expires_at'
> & {
    type: CouponDiscountKind
    min_purchase: number | null
    max_uses: number | null
    starts_at: string | null
    expires_at: string | null
}

interface CouponFormData {
    code: string
    type: CouponRow['type']
    value: string
    min_purchase: string
    max_uses: string
    starts_at: string
    expires_at: string
    is_active: boolean
}

const blankForm: CouponFormData = {
    code: '',
    type: 'percentage',
    value: '',
    min_purchase: '',
    max_uses: '',
    starts_at: '',
    expires_at: '',
    is_active: true,
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

function formatDiscount(coupon: CouponRow) {
    if (coupon.type === 'percentage') return `${coupon.value}%`
    if (coupon.type === 'fixed_amount') return `Rs. ${coupon.value}`
    return 'Free shipping'
}

function isExpired(coupon: CouponRow) {
    return Boolean(coupon.expires_at && new Date(coupon.expires_at) < new Date())
}

function statusLabel(coupon: CouponRow) {
    if (isExpired(coupon)) return 'Expired'
    return coupon.is_active ? 'Active' : 'Inactive'
}

function statusVariant(coupon: CouponRow) {
    if (isExpired(coupon)) return 'critical'
    return coupon.is_active ? 'success' : 'default'
}

export default function CouponsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [coupons, setCoupons] = useState<CouponRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSaveState, setFormSaveState] = useState<SaveState>('saved')
    const [couponToDelete, setCouponToDelete] = useState<CouponRow | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<CouponFormData>(blankForm)

    const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.is_active && !isExpired(coupon)).length, [coupons])
    const expiredCoupons = useMemo(() => coupons.filter((coupon) => isExpired(coupon)).length, [coupons])
    const totalUses = useMemo(() => coupons.reduce((total, coupon) => total + (coupon.used_count || 0), 0), [coupons])

    const loadCoupons = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/coupons?status=all&limit=100`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load coupons'))
            }

            setCoupons(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load coupons'
            setLoadError(message)
            notify({
                title: 'Coupons could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadCoupons()
    }, [loadCoupons])

    const updateForm = useCallback(<Key extends keyof CouponFormData>(key: Key, value: CouponFormData[Key]) => {
        setFormData((current) => ({ ...current, [key]: value }))
        setFormSaveState('unsaved')
        setFormError(null)
    }, [])

    const closeForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        setFormError(null)
        setFormData(blankForm)
        setFormSaveState('saved')
    }, [])

    const startCreate = useCallback(() => {
        setShowForm(true)
        setEditingId(null)
        setFormError(null)
        setFormData(blankForm)
        setFormSaveState('unsaved')
    }, [])

    const startEdit = useCallback((coupon: CouponRow) => {
        setEditingId(coupon.id)
        setFormError(null)
        setFormData({
            code: coupon.code,
            type: coupon.type,
            value: String(coupon.value),
            min_purchase: coupon.min_purchase ? String(coupon.min_purchase) : '',
            max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
            starts_at: coupon.starts_at ? coupon.starts_at.split('T')[0] : '',
            expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
            is_active: coupon.is_active,
        })
        setFormSaveState('saved')
        setShowForm(true)
    }, [])

    const handleSave = useCallback(async () => {
        if (!formData.code || (formData.type !== 'free_shipping' && !formData.value)) {
            setFormError('Enter a coupon code and discount value before saving.')
            setFormSaveState('unsaved')
            return
        }

        setSaving(true)
        setFormSaveState('saving')
        setFormError(null)

        const payload = {
            code: formData.code.toUpperCase().trim(),
            type: formData.type,
            value: formData.type === 'free_shipping' ? 0 : parseFloat(formData.value),
            min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : null,
            max_uses: formData.max_uses ? parseInt(formData.max_uses, 10) : null,
            starts_at: formData.starts_at || null,
            expires_at: formData.expires_at || null,
            is_active: formData.is_active,
        }

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/coupons`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            )
            const result = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(result, 'Unable to save coupon'))
            }

            notify({
                title: editingId ? 'Coupon updated' : 'Coupon created',
                description: `${payload.code} is ready for checkout promotions.`,
                variant: 'success',
            })
            closeForm()
            await loadCoupons({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save coupon'
            setFormError(message)
            setFormSaveState('unsaved')
            notify({
                title: 'Could not save coupon',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [closeForm, editingId, formData, loadCoupons, notify, store])

    const handleDelete = useCallback(async () => {
        if (!couponToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(couponToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete coupon'))
            }

            notify({
                title: 'Coupon deleted',
                description: `${couponToDelete.code} was removed from promotions.`,
                variant: 'success',
            })
            setCouponToDelete(null)
            await loadCoupons({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete coupon'
            notify({
                title: 'Could not delete coupon',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [couponToDelete, deleting, loadCoupons, notify, store])

    const toggleActive = useCallback(async (coupon: CouponRow) => {
        setTogglingId(coupon.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/coupons/${encodeURIComponent(coupon.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !coupon.is_active }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to update coupon status'))
            }

            notify({
                title: coupon.is_active ? 'Coupon deactivated' : 'Coupon activated',
                description: `${coupon.code} is now ${coupon.is_active ? 'inactive' : 'active'}.`,
                variant: 'success',
            })
            await loadCoupons({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update coupon status'
            notify({
                title: 'Could not update coupon',
                description: message,
                variant: 'critical',
            })
        } finally {
            setTogglingId(null)
        }
    }, [loadCoupons, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Coupons"
                    description="Create and manage discount codes for checkout promotions."
                    breadcrumbs={[{ label: 'Marketing' }, { label: 'Coupons' }]}
                />
                <Card>
                    <Section title="Coupon list">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Coupons"
                description="Create and manage discount codes for checkout promotions."
                breadcrumbs={[{ label: 'Marketing' }, { label: 'Coupons' }]}
                primaryAction={{
                    label: 'Create coupon',
                    onClick: startCreate,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Coupons could not load"
                    action={<Button variant="secondary" onClick={() => void loadCoupons()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Active coupons</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{activeCoupons}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total uses</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{totalUses}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Expired coupons</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{expiredCoupons}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit coupon' : 'New coupon'}
                        description="Configure the code, discount type, eligibility, and availability window."
                    >
                        {formError && (
                            <Banner variant="critical" title="Coupon could not be saved">
                                {formError}
                            </Banner>
                        )}

                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Input
                                    label="Code"
                                    placeholder="SUMMER20"
                                    value={formData.code}
                                    onChange={(event) => updateForm('code', event.target.value)}
                                    className="font-mono uppercase"
                                />
                            </div>
                            <Select
                                label="Type"
                                value={formData.type}
                                onChange={(event) => updateForm('type', event.target.value as CouponRow['type'])}
                                options={[
                                    { label: 'Percentage (%)', value: 'percentage' },
                                    { label: 'Fixed amount (Rs.)', value: 'fixed_amount' },
                                    { label: 'Free shipping', value: 'free_shipping' },
                                ]}
                            />
                            <Input
                                label={formData.type === 'percentage' ? 'Discount %' : formData.type === 'free_shipping' ? 'Discount' : 'Discount Rs.'}
                                type="number"
                                placeholder="20"
                                value={formData.value}
                                onChange={(event) => updateForm('value', event.target.value)}
                                disabled={formData.type === 'free_shipping'}
                                helperText={formData.type === 'free_shipping' ? 'Free shipping coupons do not need a discount value.' : undefined}
                            />
                            <Input
                                label="Min purchase (Rs.)"
                                type="number"
                                placeholder="Optional"
                                value={formData.min_purchase}
                                onChange={(event) => updateForm('min_purchase', event.target.value)}
                            />
                            <Input
                                label="Max uses"
                                type="number"
                                placeholder="Unlimited"
                                value={formData.max_uses}
                                onChange={(event) => updateForm('max_uses', event.target.value)}
                            />
                            <Input
                                label="Start date"
                                type="date"
                                value={formData.starts_at}
                                onChange={(event) => updateForm('starts_at', event.target.value)}
                            />
                            <Input
                                label="Expiry date"
                                type="date"
                                value={formData.expires_at}
                                onChange={(event) => updateForm('expires_at', event.target.value)}
                            />
                            <label className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] md:col-span-2">
                                <Input unstyled
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(event) => updateForm('is_active', event.target.checked)}
                                    className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] accent-[var(--lb-color-primary)]"
                                />
                                <span className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">Active at checkout</span>
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                loading={saving}
                                disabled={!formData.code || (formData.type !== 'free_shipping' && !formData.value)}
                                onClick={() => void handleSave()}
                            >
                                {editingId ? 'Update coupon' : 'Create coupon'}
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
                    title="Coupon list"
                    description="Toggle status, edit eligibility, or remove expired discounts."
                >
                    {coupons.length === 0 && !showForm ? (
                        <EmptyState
                            icon={<Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No coupons yet"
                            body="Create discount codes to offer promotions to your customers."
                            primaryAction={<Button onClick={startCreate}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Create coupon</Button>}
                        />
                    ) : coupons.length > 0 ? (
                        <div className="overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            <Table tableClassName="w-full text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                                <thead className="bg-[var(--lb-color-surface-subdued)]">
                                    <tr>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Code</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Discount</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Uses</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Expires</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Status</th>
                                        <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--lb-color-border)]">
                                    {coupons.map((coupon) => (
                                        <tr key={coupon.id} className="hover:bg-[var(--lb-color-surface-subdued)]">
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                                    {coupon.code}
                                                </code>
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">{formatDiscount(coupon)}</td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">
                                                {coupon.used_count || 0}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">{formatIndiaDate(coupon.expires_at, { emptyValue: 'No expiry' })}</td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    loading={togglingId === coupon.id}
                                                    onClick={() => void toggleActive(coupon)}
                                                >
                                                    <Badge label={statusLabel(coupon)} variant={statusVariant(coupon)} />
                                                </Button>
                                            </td>
                                            <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                <div className="flex justify-end gap-[var(--lb-space-2)]">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => startEdit(coupon)}
                                                        aria-label={`Edit coupon ${coupon.code}`}
                                                    >
                                                        <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setCouponToDelete(coupon)}
                                                        aria-label={`Delete coupon ${coupon.code}`}
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
                saveLabel={editingId ? 'Update coupon' : 'Create coupon'}
                discardLabel="Discard"
            />

            <ConfirmDialog
                open={Boolean(couponToDelete)}
                title="Delete coupon?"
                description={couponToDelete ? `Delete ${couponToDelete.code}? This removes the discount from checkout promotions.` : 'Delete this coupon?'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete coupon'}
                cancelLabel="Keep coupon"
                destructive
                onConfirm={() => void handleDelete()}
                onClose={() => {
                    if (!deleting) setCouponToDelete(null)
                }}
            />
        </Page>
    )
}
