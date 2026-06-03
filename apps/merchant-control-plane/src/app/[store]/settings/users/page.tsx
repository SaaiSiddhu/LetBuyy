'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Avatar,
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    IndexTable,
    Input,
    Mail,
    Plus,
    Section,
    Select,
    ShieldCheck,
    Skeleton,
    Trash2,
    Users,
    type IndexTableColumn,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface Employee {
    id: string
    email: string
    role: string
    status: string
    created_at: string
}

type StaffPayload = {
    data?: Employee[] | Employee
    error?: string | { message?: string }
}

type SaveState = 'saved' | 'unsaved' | 'saving'

const ROLES = [
    { value: 'manager', label: 'Manager', desc: 'Full access to store management' },
    { value: 'editor', label: 'Editor', desc: 'Can manage products, pages, and blog' },
    { value: 'viewer', label: 'Viewer', desc: 'Read-only access to all data' },
    { value: 'fulfillment', label: 'Fulfillment', desc: 'Can manage orders and shipping' },
]

const ROLE_OPTIONS = ROLES.map((role) => ({
    value: role.value,
    label: `${role.label} - ${role.desc}`,
}))

function getPayloadError(payload: StaffPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function getRoleLabel(role: string) {
    return ROLES.find((item) => item.value === role)?.label || role
}

function formatStatus(status: string) {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Invited'
}

function formatDate(value: string) {
    if (!value) return 'Recently'
    return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

export default function UsersSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [showAdd, setShowAdd] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newRole, setNewRole] = useState('editor')
    const [formError, setFormError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
    const [employeeToRemove, setEmployeeToRemove] = useState<Employee | null>(null)
    const [removingId, setRemovingId] = useState<string | null>(null)

    const activeSaveState: SaveState = showAdd ? (saveState === 'saving' ? 'saving' : 'unsaved') : 'saved'
    const activeStaff = useMemo(() => employees.filter((employee) => employee.status === 'active').length, [employees])
    const invitedStaff = useMemo(() => employees.filter((employee) => employee.status !== 'active').length, [employees])

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load staff members'))
            }

            setEmployees(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load staff members'
            setLoadError(message)
            notify({
                title: 'Staff could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const resetInviteForm = useCallback(() => {
        setShowAdd(false)
        setNewEmail('')
        setNewRole('editor')
        setFormError(null)
        setSaveState('saved')
    }, [])

    const startAdd = useCallback(() => {
        setShowAdd(true)
        setFormError(null)
        setSaveState('unsaved')
    }, [])

    const handleAdd = useCallback(async () => {
        if (saveState === 'saving') return

        const email = newEmail.trim().toLowerCase()
        if (!email || !email.includes('@')) {
            const message = 'Enter a valid staff email address.'
            setFormError(message)
            notify({
                title: 'Staff invite needs an email',
                description: message,
                variant: 'warning',
            })
            return
        }

        setSaveState('saving')
        setFormError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    role: newRole,
                    status: 'invited',
                }),
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to send staff invite'))
            }

            resetInviteForm()
            await loadData({ quiet: true })
            notify({
                title: 'Staff invite sent',
                description: `${email} was invited as ${getRoleLabel(newRole).toLowerCase()}.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to send staff invite'
            setFormError(message)
            setSaveState('unsaved')
            notify({
                title: 'Could not send staff invite',
                description: message,
                variant: 'critical',
            })
        }
    }, [loadData, newEmail, newRole, notify, resetInviteForm, saveState, store])

    const handleRoleChange = useCallback(async (employee: Employee, role: string) => {
        if (employee.role === role || updatingRoleId) return

        setUpdatingRoleId(employee.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(employee.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to update staff role'))
            }

            setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, role } : item))
            notify({
                title: 'Staff role updated',
                description: `${employee.email} is now ${getRoleLabel(role).toLowerCase()}.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to update staff role'
            notify({
                title: 'Could not update staff role',
                description: message,
                variant: 'critical',
            })
        } finally {
            setUpdatingRoleId(null)
        }
    }, [notify, store, updatingRoleId])

    const handleConfirmRemove = useCallback(async () => {
        if (!employeeToRemove || removingId) return

        setRemovingId(employeeToRemove.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/users/${encodeURIComponent(employeeToRemove.id)}`, {
                method: 'DELETE',
            })
            const payload = (await response.json().catch(() => null)) as StaffPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to remove staff member'))
            }

            setEmployees((current) => current.filter((employee) => employee.id !== employeeToRemove.id))
            notify({
                title: 'Staff member removed',
                description: `${employeeToRemove.email} no longer has access to this store.`,
                variant: 'success',
            })
            setEmployeeToRemove(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to remove staff member'
            notify({
                title: 'Could not remove staff member',
                description: message,
                variant: 'critical',
            })
        } finally {
            setRemovingId(null)
        }
    }, [employeeToRemove, notify, removingId, store])

    const staffColumns = useMemo<IndexTableColumn<Employee>[]>(() => [
        {
            key: 'email',
            header: 'Staff member',
            render: (employee) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={employee.email} />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {employee.email}
                        </p>
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            Added {formatDate(employee.created_at)}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'role',
            header: 'Role',
            render: (employee) => (
                <div className="min-w-[180px]">
                    <Select
                        aria-label={`Role for ${employee.email}`}
                        value={employee.role}
                        onChange={(event) => void handleRoleChange(employee, event.target.value)}
                        options={ROLES.map((role) => ({ value: role.value, label: role.label }))}
                        disabled={updatingRoleId === employee.id || Boolean(removingId)}
                    />
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (employee) => (
                <Badge
                    label={formatStatus(employee.status)}
                    variant={employee.status === 'active' ? 'success' : 'warning'}
                />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (employee) => (
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setEmployeeToRemove(employee)}
                    disabled={removingId === employee.id || Boolean(updatingRoleId)}
                >
                    <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    Remove
                </Button>
            ),
        },
    ], [handleRoleChange, removingId, updatingRoleId])

    if (loading) {
        return (
            <SettingsPane
                title="Users and permissions"
                description="Invite staff and control access to this store."
                store={store}
            >
                <Card>
                    <Section title="Staff">
                        <Skeleton variant="table" lines={4} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <>
            <SettingsPane
                title="Users and permissions"
                description="Invite staff and control access to this store."
                store={store}
                guidance={{
                    title: 'Access guidance',
                    body: 'Use manager access for trusted operators, editor access for catalog and content teammates, and fulfillment access for order handling.',
                }}
                primaryAction={{
                    label: 'Add staff',
                    onClick: startAdd,
                    disabled: showAdd,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                saveBar={{
                    state: activeSaveState,
                    onSave: () => void handleAdd(),
                    onDiscard: resetInviteForm,
                    saveLabel: 'Send invite',
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

                {formError && (
                    <Banner variant="critical" title="Staff invite needs attention">
                        {formError}
                    </Banner>
                )}

                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <Card className="p-[var(--lb-space-4)]">
                        <div className="flex items-center gap-[var(--lb-space-3)]">
                            <Users className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Staff members</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{employees.length}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-[var(--lb-space-4)]">
                        <div className="flex items-center gap-[var(--lb-space-3)]">
                            <ShieldCheck className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-success)]" aria-hidden="true" />
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Active access</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{activeStaff}</p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-[var(--lb-space-4)]">
                        <div className="flex items-center gap-[var(--lb-space-3)]">
                            <Mail className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-warning)]" aria-hidden="true" />
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Pending invites</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{invitedStaff}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card>
                    <Section
                        title="Store owner"
                        description="The store owner has full access to every setting, workflow, and billing action."
                    >
                        <div className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                <Avatar name="Owner" />
                                <div>
                                    <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">Owner</p>
                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Full access to all settings</p>
                                </div>
                            </div>
                            <Badge label="Primary owner" variant="success" />
                        </div>
                    </Section>
                </Card>

                {showAdd && (
                    <Card>
                        <Section
                            title="Invite staff"
                            description="Send an invite with the right level of access for day-to-day store operations."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="Email address"
                                    type="email"
                                    value={newEmail}
                                    onChange={(event) => {
                                        setNewEmail(event.target.value)
                                        setSaveState('unsaved')
                                    }}
                                    placeholder="staff@example.com"
                                    helperText="The invite is sent to this email address."
                                />
                                <Select
                                    label="Role"
                                    value={newRole}
                                    onChange={(event) => {
                                        setNewRole(event.target.value)
                                        setSaveState('unsaved')
                                    }}
                                    options={ROLE_OPTIONS}
                                    helperText={ROLES.find((role) => role.value === newRole)?.desc}
                                />
                            </div>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button type="button" onClick={() => void handleAdd()} loading={saveState === 'saving'}>
                                    Send invite
                                </Button>
                                <Button type="button" variant="secondary" onClick={resetInviteForm} disabled={saveState === 'saving'}>
                                    Cancel
                                </Button>
                            </div>
                        </Section>
                    </Card>
                )}

                <Card>
                    <Section
                        title="Staff"
                        description="Staff can help manage store operations based on their assigned role."
                        action={!showAdd && (
                            <Button type="button" variant="secondary" onClick={startAdd}>
                                <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Add staff
                            </Button>
                        )}
                    >
                        <IndexTable
                            columns={staffColumns}
                            rows={employees}
                            emptyState={(
                                <EmptyState
                                    icon={<Users className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                    title="No staff members yet"
                                    body="Invite team members when you are ready to share product, order, or fulfillment work."
                                    primaryAction={!showAdd ? <Button type="button" onClick={startAdd}>Add staff</Button> : undefined}
                                />
                            )}
                            savedViews={[
                                { label: 'All', value: 'all', count: employees.length },
                                { label: 'Active', value: 'active', count: activeStaff },
                                { label: 'Invited', value: 'invited', count: invitedStaff },
                            ]}
                            activeView="all"
                        />
                    </Section>
                </Card>
            </SettingsPane>

            <ConfirmDialog
                open={Boolean(employeeToRemove)}
                title="Remove staff member?"
                description={employeeToRemove ? `Remove ${employeeToRemove.email} from this store.` : 'Remove this staff member from the store.'}
                confirmLabel={removingId ? 'Removing' : 'Remove staff'}
                destructive
                onConfirm={() => void handleConfirmRemove()}
                onClose={() => {
                    if (!removingId) setEmployeeToRemove(null)
                }}
            />
        </>
    )
}
