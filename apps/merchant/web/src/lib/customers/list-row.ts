import type { Customer as SharedCustomer } from '@letbuyy/shared-types'

export type CustomerRow = Omit<Pick<SharedCustomer, 'id' | 'email' | 'phone' | 'status' | 'created_at' | 'total_spent' | 'last_order_at'>, 'email' | 'phone' | 'last_order_at'> & {
    full_name: string
    email: string
    phone: string | null
    total_orders: SharedCustomer['order_count']
    first_order_at: string | null
    last_order_at: string | null
    last_order_id: string | null
}

function readString(row: Record<string, unknown>, key: string) {
    const value = row[key]
    return typeof value === 'string' ? value : ''
}

function readNullableString(row: Record<string, unknown>, key: string) {
    const value = row[key]
    return typeof value === 'string' && value.trim() ? value : null
}

function normalizeCustomerStatus(value: string): CustomerRow['status'] {
    const normalized = value.toLowerCase()
    if (normalized === 'disabled' || normalized === 'invited') return normalized
    return 'active'
}

export function mapCustomer(row: Record<string, unknown>): CustomerRow {
    const email = readString(row, 'email') || readString(row, 'customer_email')

    return {
        id: readString(row, 'id') || email,
        full_name: readString(row, 'display_name') || [readString(row, 'first_name'), readString(row, 'last_name')].filter(Boolean).join(' ') || readString(row, 'full_name') || readString(row, 'customer_name'),
        email,
        phone: readNullableString(row, 'phone') || readNullableString(row, 'customer_phone'),
        total_orders: Number(row.order_count ?? row.total_orders ?? 0),
        total_spent: Number(row.total_spent || 0),
        status: normalizeCustomerStatus(readString(row, 'status')),
        created_at: readString(row, 'created_at'),
        first_order_at: readNullableString(row, 'first_order_at'),
        last_order_at: readNullableString(row, 'last_order_at'),
        last_order_id: readNullableString(row, 'last_order_id'),
    }
}

