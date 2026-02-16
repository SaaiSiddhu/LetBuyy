'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface Notification {
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

function iconForType(type: string): string {
    switch (type) {
        case 'order': return 'shopping_cart'
        case 'customer': return 'person_add'
        case 'inventory': return 'inventory_2'
        case 'review': return 'rate_review'
        case 'form': return 'mail'
        default: return 'notifications'
    }
}

export default function NotificationsPanel() {
    const { store } = useParams<{ store: string }>()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function load() {
            // Get store to find site_id
            const { data: storeData } = await supabase
                .from('sites')
                .select('id')
                .or(`store_name.eq.${store},subdomain.eq.${store}`)
                .single()

            if (!storeData) { setLoading(false); return }

            // Try to fetch from notifications table if it exists
            // Falls back to recent orders/form submissions as notifications
            const notifs: Notification[] = []

            // Recent orders as notifications
            const { data: orders } = await supabase
                .from('orders')
                .select('id, order_number, created_at')
                .eq('site_id', storeData.id)
                .order('created_at', { ascending: false })
                .limit(3)

            if (orders) {
                orders.forEach(o => {
                    notifs.push({
                        id: `order-${o.id}`,
                        icon: 'shopping_cart',
                        title: `New order #${o.order_number} received`,
                        time: timeAgo(o.created_at),
                        unread: (Date.now() - new Date(o.created_at).getTime()) < 86400000, // unread if < 24h
                    })
                })
            }

            // Recent form submissions as notifications
            const { data: forms } = await supabase
                .from('form_submissions')
                .select('id, form_type, data, created_at')
                .eq('site_id', storeData.id)
                .order('created_at', { ascending: false })
                .limit(2)

            if (forms) {
                forms.forEach(f => {
                    const name = (f.data as Record<string, string>)?.name || 'Someone'
                    notifs.push({
                        id: `form-${f.id}`,
                        icon: f.form_type === 'contact' ? 'mail' : 'campaign',
                        title: f.form_type === 'contact' ? `${name} sent a message` : `New lead form submission`,
                        time: timeAgo(f.created_at),
                        unread: (Date.now() - new Date(f.created_at).getTime()) < 86400000,
                    })
                })
            }

            // Sort by most recent
            notifs.sort((a, b) => {
                // Approximate: unread ones first, then by time string (not perfect but good enough for display)
                if (a.unread && !b.unread) return -1
                if (!a.unread && b.unread) return 1
                return 0
            })

            setNotifications(notifs.slice(0, 5))
            setLoading(false)
        }
        load()
    }, [store, supabase])

    const unreadCount = notifications.filter((n) => n.unread).length

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    }

    if (loading) {
        return (
            <div className="admin-notifications-dropdown">
                <div className="admin-notifications-header">
                    <h3>Notifications</h3>
                </div>
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-hint)', fontSize: 13 }}>
                    Loading...
                </div>
            </div>
        )
    }

    return (
        <div className="admin-notifications-dropdown">
            {/* Header */}
            <div className="admin-notifications-header">
                <h3>
                    Notifications
                    {unreadCount > 0 && (
                        <span
                            style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'white',
                                background: 'var(--primary)',
                                borderRadius: '10px',
                                padding: '1px 6px',
                                marginLeft: '8px',
                                verticalAlign: 'middle',
                            }}
                        >
                            {unreadCount}
                        </span>
                    )}
                </h3>
                {unreadCount > 0 && (
                    <button onClick={markAllRead}>Mark all read</button>
                )}
            </div>

            {/* List */}
            {notifications.length > 0 ? (
                <>
                    <div className="admin-notifications-list">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`admin-notification-item ${notif.unread ? 'unread' : ''}`}
                            >
                                <div className="admin-notification-icon">
                                    <span className="material-symbols-outlined">
                                        {notif.icon}
                                    </span>
                                </div>
                                <div className="admin-notification-content">
                                    <div className="admin-notification-title">
                                        {notif.title}
                                    </div>
                                    <div className="admin-notification-time">
                                        {notif.time}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="admin-notifications-footer">
                        <button>View all notifications</button>
                    </div>
                </>
            ) : (
                <div className="admin-notifications-empty">
                    <span className="material-symbols-outlined">
                        notifications_none
                    </span>
                    <p>All caught up!</p>
                </div>
            )}
        </div>
    )
}
