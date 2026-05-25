'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Notification {
    id: string
    icon: string
    title: string
    time: string
    unread: boolean
}

export default function NotificationsPanel() {
    const { store } = useParams<{ store: string }>()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/notifications`, { cache: 'no-store' })
            const payload = await response.json()
            setNotifications(payload.data || [])
            setLoading(false)
        }
        load()
    }, [store])

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
