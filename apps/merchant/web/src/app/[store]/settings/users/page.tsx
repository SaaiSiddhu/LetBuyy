'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Section,
    Card,
    Avatar,
    Badge,
    Banner,
    Button,
    Crown,
    Eye,
    Headphones,
    Info,
    Input,
    Mail,
    Megaphone,
    Modal,
    Pencil,
    Plus,
    Select,
    ShieldCheck,
    Skeleton,
    Trash2,
    Truck,
    Users,
    ConfirmDialog,
    useToast,
    type LucideIcon,
} from '@letbuyy/ui'
import { formatUsShortDate } from '@letbuyy/ui/formatting'
import { staffMutationKey } from '@/lib/staff/mutation-key'
import { SettingsPane } from '@/components/settings/SettingsPane'
import {
    DEFAULT_STAFF_ROLE,
    STAFF_ROLES,
    getStaffRole,
    permissionLabel,
    permissionsForRole,
    staffRoleLabel,
} from '@/lib/staff/roles'

interface Employee {
    id: string
    email: string
    full_name: string | null
    role: string
    status: string
    created_at: string
    updated_at: string
    permissions: { granted: string[] }
}

interface StaffLimit {
    staff_limit: number | null
    staff_used: number
    plan_slug: string
    plan_name: string
}

type StaffPayload = { data?: unknown; error?: string | { message?: string } }

const ROLE_ICON: Record<string, LucideIcon> = {
    manager: ShieldCheck,
    editor: Pencil,
    fulfillment: Truck,
    marketing: Megaphone,
    support: Headphones,
    viewer: Eye,
}

function roleIcon(role: string): LucideIcon {
    return ROLE_ICON[role] || Users
}

function getPayloadError(payload: StaffPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function normalizeEmployees(value: unknown): Employee[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((employee) => {
        if (!isRecord(employee) || typeof employee.id !== 'string' || typeof employee.email !== 'string' || !employee.email) return []
        const status = readString(employee.status, 'invited').toLowerCase()
        if (status === 'removed') return []
        return [{
            id: employee.id,
            email: employee.email,
            full_name: typeof employee.full_name === 'string' ? employee.full_name : null,
            role: readString(employee.role, DEFAULT_STAFF_ROLE).toLowerCase(),
            status,
            created_at: readString(employee.created_at),
            updated_at: readString(employee.updated_at),
            permissions: { granted: isRecord(employee.permissions) && Array.isArray(employee.permissions.granted)
                ? employee.permissions.granted.filter((key): key is string => typeof key === 'string') : [] },
        }]
    })
}

function normalizeLimit(value: unknown): StaffLimit | null {
    if (!isRecord(value)) return null
    const rawLimit = value.staff_limit
    if (rawLimit !== null && (typeof rawLimit !== 'number' || !Number.isSafeInteger(rawLimit) || rawLimit < 0)) return null
    if (typeof value.staff_used !== 'number' || !Number.isSafeInteger(value.staff_used) || value.staff_used < 0) return null
    return {
        staff_limit: typeof rawLimit === 'number' ? rawLimit : null,
        staff_used: typeof value.staff_used === 'number' ? value.staff_used : 0,
        plan_slug: readString(value.plan_slug, 'free'),
        plan_name: readString(value.plan_name, 'your plan'),
    }
}

function formatStatus(status: string) {
    if (status === 'active') return 'Active'
    if (status === 'disabled') return 'Disabled'
    return 'Awaiting acceptance'
}

function statusVariant(status: string): 'success' | 'warning' | 'critical' {
    if (status === 'active') return 'success'
    if (status === 'disabled') return 'critical'
    return 'warning'
}

const ROLE_OPTIONS = STAFF_ROLES.map((role) => ({ value: role.value, label: role.label }))

export default function UsersSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [limit, setLimit] = useState<StaffLimit | null>(null)

    const [addOpen, setAddOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newName, setNewName] = useState('')
    const [newRole, setNewRole] = useState(DEFAULT_STAFF_ROLE)
    const [invitationLink, setInvitationLink] = useState<string | null>(null)

    const [reissuingId, setReissuingId] = useState<string | null>(null)
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
    const [employeeToRemove, setEmployeeToRemove] = useState<Employee | null>(null)
    const [removingId, setRemovingId] = useState<string | null>(null)

    const beginRead = useReadRequest(store)
    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, { cache: 'no-store', signal: request.signal })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null
            if (!request.isCurrent()) return
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load staff members'))
            const data = isRecord(payload?.data) ? payload.data : {}
            setEmployees(normalizeEmployees(data.employees))
            setLimit(normalizeLimit(data.limit))
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load staff members'
            setLoadError(message)
            notify({ title: 'Staff could not load', description: message, variant: 'critical' })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const staffUsed = limit?.staff_used ?? employees.length
    const staffLimit = limit?.staff_limit ?? null
    const isUnlimited = limit !== null && staffLimit === null
    const atLimit = limit !== null && !isUnlimited && staffUsed >= (staffLimit ?? 0)
    const activeStaff = useMemo(() => employees.filter((e) => e.status === 'active').length, [employees])
    const pendingStaff = useMemo(() => employees.filter((e) => e.status !== 'active').length, [employees])
    const seatLabel = !limit ? 'Unavailable' : isUnlimited ? `${staffUsed}` : `${staffUsed} / ${staffLimit}`

    const openAdd = useCallback(() => {
        setNewEmail('')
        setNewName('')
        setNewRole(DEFAULT_STAFF_ROLE)
        setAddOpen(true)
    }, [])

    const handleAdd = useCallback(async (direct = false) => {
        if (submitting) return
        const email = newEmail.trim().toLowerCase()
        if (!email || !email.includes('@')) {
            notify({ title: 'Enter a valid email', description: 'A staff record needs a valid email address.', variant: 'warning' })
            return
        }
        setSubmitting(true)
        try {
            const intent = { email, full_name: newName.trim() || undefined, role: newRole, permissions: permissionsForRole(newRole), invitation: !direct }
            const retry = await staffMutationKey(store, direct ? 'create' : 'invite', intent)
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': retry.key },
                body: JSON.stringify(intent),
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to add staff'))
            retry.complete()
            const invitation = isRecord(payload?.data) && isRecord(payload.data.invitation) ? payload.data.invitation : null
            setInvitationLink(invitation && typeof invitation.accept_url === 'string' ? invitation.accept_url : null)
            setAddOpen(false)
            await loadData({ quiet: true })
            notify({
                title: direct ? 'Staff record saved' : 'Staff invitation created',
                description: isRecord(payload?.data) && payload.data.status === 'active'
                    ? `${email} can sign in with their verified account.`
                    : 'Delivery is queued. The invited verified account must accept before access starts.',
                variant: 'success',
            })
        } catch (error) {
            notify({
                title: 'Could not add staff',
                description: error instanceof Error ? error.message : 'Unable to add staff',
                variant: 'critical',
            })
        } finally {
            setSubmitting(false)
        }
    }, [loadData, newEmail, newName, newRole, notify, store, submitting])

    const handleReissue = useCallback(async (employee: Employee) => {
        if (reissuingId) return
        setReissuingId(employee.id)
        try {
            const intent = { invitation: true, employee_id: employee.id, expected_updated_at: employee.updated_at,
                email: employee.email, full_name: employee.full_name || employee.email, role: employee.role, permissions: employee.permissions }
            const retry = await staffMutationKey(store, 'reissue:' + employee.id, intent)
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': retry.key }, body: JSON.stringify(intent) })
            const payload = await response.json()
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to renew invitation'))
            retry.complete(); setInvitationLink(payload.data.invitation.accept_url)
            await loadData({ quiet: true })
            notify({ title: 'Invitation renewed', description: 'The previous link is revoked. Delivery of the new invitation is queued.', variant: 'success' })
        } catch (error) { notify({ title: 'Could not renew invitation', description: error instanceof Error ? error.message : 'Retry this action.', variant: 'critical' }) }
        finally { setReissuingId(null) }
    }, [loadData, notify, reissuingId, store])

    const handleRoleChange = useCallback(async (employee: Employee, role: string) => {
        if (employee.role === role || updatingRoleId) return
        setUpdatingRoleId(employee.id)
        try {
            const intent = { role, permissions: permissionsForRole(role), expected_updated_at: employee.updated_at }
            const retry = await staffMutationKey(store, 'update:' + employee.id, intent)
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(employee.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': retry.key },
                body: JSON.stringify(intent),
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to update staff role'))
            retry.complete()
            await loadData({ quiet: true })
            notify({ title: 'Role updated', description: `${employee.email} is now ${staffRoleLabel(role).toLowerCase()}.`, variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not update role', description: error instanceof Error ? error.message : 'Unable to update staff role', variant: 'critical' })
        } finally {
            setUpdatingRoleId(null)
        }
    }, [loadData, notify, store, updatingRoleId])

    const handleConfirmRemove = useCallback(async () => {
        if (!employeeToRemove || removingId) return
        setRemovingId(employeeToRemove.id)
        try {
            const intent = { expected_updated_at: employeeToRemove.updated_at }
            const retry = await staffMutationKey(store, 'remove:' + employeeToRemove.id, intent)
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(employeeToRemove.id)}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': retry.key },
                body: JSON.stringify(intent),
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to remove staff member'))
            retry.complete()
            const removed = employeeToRemove
            setEmployees((current) => current.filter((e) => e.id !== removed.id))
            setLimit((current) => current ? { ...current, staff_used: Math.max(0, current.staff_used - 1) } : current)
            setEmployeeToRemove(null)
            notify({ title: 'Staff removed', description: `${removed.email} no longer has access to this store.`, variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not remove staff', description: error instanceof Error ? error.message : 'Unable to remove staff member', variant: 'critical' })
        } finally {
            setRemovingId(null)
        }
    }, [employeeToRemove, notify, removingId, store])

    if (loading) {
        return (
            <SettingsPane navigationKey="users" title="Users and permissions" description="Add staff and control who can access this store." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <Section><Skeleton variant="text" lines={1} /></Section>
                            <div className="settings-form-body"><Skeleton variant="text" lines={2} /></div>
                        </Card>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    const selectedRole = getStaffRole(newRole)

    return (
        <>
            <SettingsPane
                navigationKey="users"
                title="Users and permissions"
                description="Add staff and control who can access this store."
                store={store}
                primaryAction={{
                    label: 'Add staff',
                    onClick: openAdd,
                    disabled: !limit || atLimit,
                    icon: <Plus className="letbuyy-icon" aria-hidden="true" />,
                }}
                guidance={{
                    title: 'Access guidance',
                    body: 'Each role grants a specific set of permissions. Use Manager for trusted operators, Editor for catalog and content, and Fulfilment for order handling.',
                }}
            >
                {loadError && (
                    <Banner
                        variant="critical"
                        title="Staff could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                {!limit && !loadError && (
                    <Banner variant="warning" title="Staff plan is unavailable"
                        action={<Button variant="secondary" onClick={() => void loadData({ quiet: true })}>Reload staff plan</Button>}>
                        Retry before adding staff. Existing records are still shown.
                    </Banner>
                )}

                {invitationLink && <Banner variant="info" title="Staff invitation created">
                    <p>The invited verified account must accept before access starts. Delivery is queued.</p>
                    <Input label="Invitation link" type="password" value={invitationLink} readOnly />
                    <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(invitationLink).then(() => notify({ title: 'Invitation link copied', variant: 'success' }))}>Copy invitation link</Button>
                </Banner>}
                {atLimit && (
                    <Banner
                        variant="warning"
                        title="You've reached your staff limit"
                        action={<Button onClick={() => router.push(`/${store}/settings/plan`)}>Upgrade plan</Button>}
                    >
                        Your {limit?.plan_name || 'current plan'} includes {staffLimit} staff {staffLimit === 1 ? 'account' : 'accounts'}.
                        Upgrade your plan to add more team members.
                    </Banner>
                )}

                {/* ── Stats ─────────────────────────────────────────────────── */}
                <div className="billing-stat-grid">
                    <div className="billing-stat-card">
                        <span className="billing-stat-icon"><Users className="letbuyy-icon" aria-hidden="true" /></span>
                        <div className="billing-stat-body">
                            <span className="billing-stat-label">Staff members</span>
                            <span className="billing-stat-value">{seatLabel}</span>
                        </div>
                    </div>
                    <div className="billing-stat-card">
                        <span className="billing-stat-icon billing-stat-icon--ok"><ShieldCheck className="letbuyy-icon" aria-hidden="true" /></span>
                        <div className="billing-stat-body">
                            <span className="billing-stat-label">Active access</span>
                            <span className="billing-stat-value">{activeStaff}</span>
                        </div>
                    </div>
                    <div className="billing-stat-card">
                        <span className="billing-stat-icon billing-stat-icon--info"><Mail className="letbuyy-icon" aria-hidden="true" /></span>
                        <div className="billing-stat-body">
                            <span className="billing-stat-label">Pending invitations</span>
                            <span className="billing-stat-value">{pendingStaff}</span>
                        </div>
                    </div>
                </div>

                {/* ── Store owner ───────────────────────────────────────────── */}
                <Section variant="grouped" title="Store owner" >

                        <div className="settings-general-hint">The store owner has full access to every setting, workflow, and billing action.</div>
                        <div className="users-staff-row">
                            <span className="users-staff-avatar"><Crown className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="users-staff-meta">
                                <span className="users-staff-name">Owner</span>
                                <span className="users-staff-sub">Full access to all settings</span>
                            </div>
                            <Badge label="Primary owner" variant="success" />
                        </div>

                </Section>

                {/* ── Staff ─────────────────────────────────────────────────── */}
                <Section variant="grouped" title="Staff" >

                        <div className="settings-general-hint">
                            Staff help manage store operations based on their assigned role.{' '}
                            {!limit ? 'Staff plan capacity is temporarily unavailable.' : isUnlimited ? 'Your plan includes unlimited staff.' : `Your ${limit?.plan_name || 'plan'} includes ${staffLimit} staff ${staffLimit === 1 ? 'account' : 'accounts'}.`}
                        </div>

                        {employees.length === 0 ? (
                            <div className="users-empty">
                                <MerchantEmptyArtwork scene="staff" compact />
                                <div className="users-empty-copy">
                                    <span className="users-empty-title">No staff members yet</span>
                                    <span className="users-empty-desc">Add team members when you are ready to share product, order, or fulfilment work.</span>
                                </div>
                                <Button onClick={openAdd} disabled={!limit || atLimit}>
                                    <Plus className="letbuyy-icon" aria-hidden="true" />
                                    Add staff
                                </Button>
                            </div>
                        ) : (
                            <div className="users-staff-list">
                                {employees.map((employee) => {
                                    const RoleIcon = roleIcon(employee.role)
                                    const busy = updatingRoleId === employee.id || removingId === employee.id || reissuingId === employee.id
                                    return (
                                        <div key={employee.id} className="users-staff-row">
                                            <Avatar name={employee.full_name || employee.email} />
                                            <div className="users-staff-meta">
                                                <span className="users-staff-name">{employee.full_name || employee.email}</span>
                                                <span className="users-staff-sub">
                                                    {employee.full_name ? `${employee.email} · ` : ''}Added {formatUsShortDate(employee.created_at, { emptyValue: 'recently' })}
                                                </span>
                                            </div>
                                            <span className="users-staff-rolechip">
                                                <RoleIcon className="letbuyy-icon" aria-hidden="true" />
                                            </span>
                                            <div className="users-staff-role">
                                                <Select
                                                    aria-label={`Role for ${employee.email}`}
                                                    value={employee.role}
                                                    onChange={(e) => void handleRoleChange(employee, e.target.value)}
                                                    options={ROLE_OPTIONS}
                                                    disabled={busy}
                                                />
                                            </div>
                                            {employee.status === 'invited' && <Button variant="secondary" onClick={() => void handleReissue(employee)} disabled={busy}>Renew invitation</Button>}
                                            <Badge label={formatStatus(employee.status)} variant={statusVariant(employee.status)} />
                                            <Button
                                                variant="ghost"
                                                onClick={() => setEmployeeToRemove(employee)}
                                                disabled={busy}
                                                aria-label={`Remove ${employee.email}`}
                                            >
                                                <Trash2 className="letbuyy-icon" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    )
                                })}
                                <div className="users-staff-add-row">
                                    <Button variant="secondary" onClick={openAdd} disabled={!limit || atLimit}>
                                        <Plus className="letbuyy-icon" aria-hidden="true" />
                                        Add staff
                                    </Button>
                                </div>
                            </div>
                        )}

                </Section>

                {/* ── Roles & permissions reference ─────────────────────────── */}
                <Section variant="grouped" title="Roles &amp; permissions" >

                        <div className="settings-general-hint">
                            Each role is a preset bundle of permissions. Assign the role that matches what a teammate needs to do.
                        </div>
                        <div className="users-role-grid">
                            {STAFF_ROLES.map((role) => {
                                const RoleIcon = roleIcon(role.value)
                                return (
                                    <div key={role.value} className="users-role-card">
                                        <div className="users-role-head">
                                            <span className="users-role-icon"><RoleIcon className="letbuyy-icon" aria-hidden="true" /></span>
                                            <span className="users-role-name">{role.label}</span>
                                        </div>
                                        <span className="users-role-desc">{role.description}</span>
                                        <div className="users-role-perms">
                                            {role.permissions.map((perm) => (
                                                <span key={perm} className="users-perm-chip">{permissionLabel(perm)}</span>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                </Section>
            </SettingsPane>

            {/* ── Add staff modal ───────────────────────────────────────────── */}
            <Modal
                open={addOpen}
                title="Add staff"
                description="Invite a teammate by email and choose their store permissions."
                onClose={() => { if (!submitting) setAddOpen(false) }}
                footer={(
                    <div className="billing-modal-footer">
                        <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
                        <Button variant="secondary" onClick={() => void handleAdd(true)} disabled={submitting}>Add verified account directly</Button>
                        <Button onClick={() => void handleAdd(false)} loading={submitting}>
                            <Mail className="letbuyy-icon" aria-hidden="true" />
                            Send staff invitation
                        </Button>
                    </div>
                )}
            >
                <div className="billing-modal-body">
                    <div className="settings-form-grid">
                        <Input
                            label="Email address"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="teammate@example.com"
                            autoComplete="email"
                        />
                        <Input
                            label="Full name (optional)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Priya Sharma"
                            autoComplete="name"
                        />
                    </div>
                    <Select
                        label="Role"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        options={ROLE_OPTIONS}
                        helperText={selectedRole.description}
                    />
                    <div className="users-perm-preview">
                        <span className="users-perm-preview-label">This role can</span>
                        <div className="users-role-perms">
                            {selectedRole.permissions.map((perm) => (
                                <span key={perm} className="users-perm-chip">{permissionLabel(perm)}</span>
                            ))}
                        </div>
                    </div>
                    <div className="billing-modal-note">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>Invitations queue delivery and require the invited verified account to accept. Direct addition is available only for an already verified account. Staff use their own account credentials.</span>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={Boolean(employeeToRemove)}
                title="Remove staff member?"
                description={employeeToRemove ? `Remove ${employeeToRemove.email} from this store. They will lose access immediately.` : 'Remove this staff member from the store.'}
                confirmLabel={removingId ? 'Removing…' : 'Remove staff'}
                cancelLabel="Keep staff"
                destructive
                onConfirm={() => void handleConfirmRemove()}
                onClose={() => { if (!removingId) setEmployeeToRemove(null) }}
            />
        </>
    )
}
