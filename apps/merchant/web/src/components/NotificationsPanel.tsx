'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Banner, Button, Bell, EmptyState, MaterialIcon, Skeleton } from '@letbuyy/ui'
import { useReadRequest } from '@/lib/api/use-read-request'

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
    const [loadedStore, setLoadedStore] = useState<string | null>(null)
    const [error, setError] = useState(false)
    const beginRead = useReadRequest(store)

    const load = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(false)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/notifications`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json()
            if (!request.isCurrent()) return
            if (!response.ok) throw new Error('Notifications unavailable')
            setNotifications(Array.isArray(payload.data) ? payload.data : [])
            setError(payload.meta?.partial === true)
        } catch {
            if (!request.isCurrent()) return
            setNotifications([])
            setError(true)
        } finally {
            if (request.isCurrent()) { setLoadedStore(store); setLoading(false) }
        }
    }, [store, beginRead])
    useEffect(() => { void load() }, [load])

    const unreadCount = notifications.filter((n) => n.unread).length

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    }

    if (loading || loadedStore !== store) {
        return (
            <div className="admin-notifications-dropdown">
                <div className="admin-notifications-header">
                    <h3>Notifications</h3>
                </div>
                <div className="admin-notifications-loading" aria-label="Loading notifications">
                    <Skeleton variant="text" lines={2} />
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
                        <span className="ml-[var(--lb-space-2)] inline-flex min-w-[var(--lb-size-icon-inline)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] px-[var(--lb-space-2)] py-[1px] align-middle text-[11px] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-inverse)]">
                            {unreadCount}
                        </span>
                    )}
                </h3>
                {unreadCount > 0 && (
                    <Button unstyled onClick={markAllRead}>Mark all read</Button>
                )}
            </div>

            {error && (
                <Banner variant="warning" title="Notifications could not be fully loaded" action={<Button variant="secondary" onClick={() => void load()}>Retry</Button>}>
                    Try loading notifications again.
                </Banner>
            )}

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
                                    <MaterialIcon name={notif.icon} />
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
                        <Button unstyled>View all notifications</Button>
                    </div>
                </>
            ) : !error ? (
                <EmptyState
                    icon={<Bell className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                    title="All caught up"
                    body="New orders, customer activity, and store alerts will appear here."
                />
            ) : null}
        </div>
    )
}
