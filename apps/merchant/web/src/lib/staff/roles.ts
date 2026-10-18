import { permissionsForStoreStaffRole } from '@letbuyy/auth-core'

// Staff roles (RBAC) and the granular permissions each grants (PBAC).
//
// Every `value` here MUST be in the employees.role CHECK constraint
// (support/sales/marketing/operations/manager/admin/editor/viewer/fulfillment/staff).
// A role is a named bundle of permissions; the permission list is what we persist
// on the employee's `permissions` JSON so access is explicit and auditable, and so
// it survives a later role rename. Role bundles come from the shared auth-core owner.

export interface StaffPermission {
    key: string
    label: string
}

export interface StaffRole {
    value: string
    label: string
    description: string
    /** Permission keys this role grants. */
    permissions: string[]
    /** Lucide icon name for the role chip. */
    icon: string
}

// Canonical permission catalog (label lookup for the UI).
export const STAFF_PERMISSIONS: StaffPermission[] = [
    { key: 'products:write', label: 'Manage products & collections' },
    { key: 'products:read', label: 'View products' },
    { key: 'orders:write', label: 'Manage & fulfil orders' },
    { key: 'orders:read', label: 'View orders' },
    { key: 'customers:write', label: 'Manage customers' },
    { key: 'customers:read', label: 'View customers' },
    { key: 'content:write', label: 'Edit pages, blog & theme content' },
    { key: 'marketing:write', label: 'Run campaigns & discounts' },
    { key: 'shipping:write', label: 'Manage shipping & delivery' },
    { key: 'returns:write', label: 'Process returns & refunds' },
    { key: 'reports:read', label: 'View analytics & reports' },
    { key: 'settings:write', label: 'Change store settings' },
]

const PERMISSION_LABELS = new Map(STAFF_PERMISSIONS.map((p) => [p.key, p.label]))

export function permissionLabel(key: string): string {
    return PERMISSION_LABELS.get(key) || key
}

export const STAFF_ROLES: StaffRole[] = [
    {
        value: 'manager',
        label: 'Manager',
        description: 'Full access to store operations, catalog, orders, customers, and settings.',
        icon: 'shield_person',
        permissions: permissionsForStoreStaffRole('manager').granted,
    },
    {
        value: 'editor',
        label: 'Editor',
        description: 'Create and edit products, collections, pages, and blog content.',
        icon: 'edit',
        permissions: permissionsForStoreStaffRole('editor').granted,
    },
    {
        value: 'fulfillment',
        label: 'Fulfilment',
        description: 'Process and fulfil orders, manage shipping and delivery.',
        icon: 'local_shipping',
        permissions: permissionsForStoreStaffRole('fulfillment').granted,
    },
    {
        value: 'marketing',
        label: 'Marketing',
        description: 'Run campaigns and discounts and view customer engagement.',
        icon: 'campaign',
        permissions: permissionsForStoreStaffRole('marketing').granted,
    },
    {
        value: 'support',
        label: 'Customer support',
        description: 'View orders and customers, and process returns and refunds.',
        icon: 'support_agent',
        permissions: permissionsForStoreStaffRole('support').granted,
    },
    {
        value: 'viewer',
        label: 'Viewer',
        description: 'Read-only access to store data, orders, and reports.',
        icon: 'visibility',
        permissions: permissionsForStoreStaffRole('viewer').granted,
    },
]

const ROLE_BY_VALUE = new Map(STAFF_ROLES.map((r) => [r.value, r]))

export const DEFAULT_STAFF_ROLE = 'editor'

export function getStaffRole(value: string | null | undefined): StaffRole {
    return (value && ROLE_BY_VALUE.get(value)) || ROLE_BY_VALUE.get(DEFAULT_STAFF_ROLE)!
}

export function staffRoleLabel(value: string | null | undefined): string {
    return getStaffRole(value).label
}

/** The `permissions` JSON we persist on an employee for a given role. */
export function permissionsForRole(value: string): { granted: string[] } {
    return permissionsForStoreStaffRole(value)
}
