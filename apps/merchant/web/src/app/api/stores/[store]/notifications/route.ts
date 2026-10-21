import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

interface AdminNotification {
    id: string
    icon: string
    title: string
    time: string
    unread: boolean
}

function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
    const days = Math.floor(hrs / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        const [ordersPayload, formsPayload] = await Promise.all([
            apiClient.orders.list({ store_id: resolved.storeId, limit: 3 }).catch(() => null),
            apiClient.formSubmissions.list({ store_id: resolved.storeId, limit: 2 }).catch(() => null),
        ])

        const notifications: AdminNotification[] = []

        for (const order of ordersPayload?.data ?? []) {
            notifications.push({
                id: `order-${order.id}`,
                icon: 'shopping_cart',
                title: `New order #${order.order_number} received`,
                time: timeAgo(order.created_at),
                unread: (Date.now() - new Date(order.created_at).getTime()) < 86400000,
            })
        }

        for (const form of formsPayload?.data ?? []) {
            const name = typeof form.data.name === 'string' && form.data.name.trim()
                ? form.data.name
                : 'Someone'
            notifications.push({
                id: `form-${form.id}`,
                icon: form.form_type === 'contact' ? 'mail' : 'campaign',
                title: form.form_type === 'contact' ? `${name} sent a message` : 'New lead form submission',
                time: timeAgo(form.created_at),
                unread: (Date.now() - new Date(form.created_at).getTime()) < 86400000,
            })
        }

        notifications.sort((a, b) => Number(b.unread) - Number(a.unread))
        return NextResponse.json({ data: notifications.slice(0, 5), meta: { partial: ordersPayload === null || formsPayload === null } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load notifications')
    }
}
