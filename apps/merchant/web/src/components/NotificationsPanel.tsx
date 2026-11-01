'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { NotificationInboxItem } from '@letbuyy/api-client'
import { Banner, Bell, Button, Skeleton } from '@letbuyy/ui'
import { MerchantNavigationLink } from './MerchantNavigationLink'
import { MerchantEmptyState } from './empty-states/MerchantEmptyState'
import { useReadRequest } from '../lib/api/use-read-request'

interface InboxResponse {
    data: NotificationInboxItem[]
    meta: { page: number; total: number; has_more: boolean; unread_count: number | null }
}

function timeAgo(date: string): string {
    const timestamp = new Date(date).getTime()
    if (!Number.isFinite(timestamp)) return 'Time unavailable'
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days === 1 ? '' : 's'} ago`
}

/** User-wide inbox: notices are persisted, so read state survives refresh and store switches. */
export default function NotificationsPanel({ fullPage = false }: { fullPage?: boolean }) {
    const { store } = useParams<{ store: string }>()
    const [notifications, setNotifications] = useState<NotificationInboxItem[]>([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [accountUnreadCount, setAccountUnreadCount] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadedScope, setLoadedScope] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [marking, setMarking] = useState(false)
    const scope = `${store}:${page}:${fullPage}`
    const beginRead = useReadRequest(scope)
    const endpoint = `/api/stores/${encodeURIComponent(store)}/notifications`

    const load = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`${endpoint}?page=${page}&limit=${fullPage ? 20 : 5}`, {
                cache: 'no-store', signal: request.signal,
            })
            if (!response.ok) throw new Error('Notifications are temporarily unavailable.')
            const payload = await response.json() as InboxResponse
            if (!request.isCurrent()) return
            if (!Array.isArray(payload.data) || !payload.meta) throw new Error('Invalid inbox response.')
            setNotifications(payload.data)
            setTotal(payload.meta.total)
            setHasMore(payload.meta.has_more)
            setAccountUnreadCount(typeof payload.meta.unread_count === 'number'
                && Number.isSafeInteger(payload.meta.unread_count) && payload.meta.unread_count >= 0
                ? payload.meta.unread_count : null)
        } catch {
            if (!request.isCurrent()) return
            setError('Notifications could not be loaded. Refresh to check their current read state.')
        } finally {
            if (request.isCurrent()) { setLoadedScope(scope); setLoading(false) }
        }
    }, [beginRead, endpoint, fullPage, page, scope])

    useEffect(() => { void load() }, [load])

    const unreadCount = accountUnreadCount ?? notifications.filter(notification => !notification.is_read).length

    const markAllRead = async () => {
        if (marking) return
        setMarking(true)
        setError(null)
        try {
            const response = await fetch(endpoint, { method: 'POST', cache: 'no-store' })
            if (!response.ok) throw new Error('Read state could not be saved.')
            await load()
        } catch {
            setError('The read update could not be confirmed. Refresh notifications before retrying.')
        } finally {
            setMarking(false)
        }
    }

    return (
        <div id={fullPage ? undefined : 'admin-notifications-panel'} className={fullPage ? 'admin-notifications-page' : 'admin-notifications-dropdown'}>
            <div className="admin-notifications-header">
                <div>
                    <h3>Notifications</h3>
                    {fullPage && <p>Alerts for your account across your stores.</p>}
                </div>
                {unreadCount > 0 && !error && (
                    <Button unstyled type="button" disabled={marking || loading} onClick={() => void markAllRead()}>
                        {marking ? 'Saving…' : 'Mark all read'}
                    </Button>
                )}
            </div>

            {error && <Banner variant="warning" title="Notifications unavailable" action={<Button variant="secondary" onClick={() => void load()}>Retry</Button>}>{error}</Banner>}

            {(loading || loadedScope !== scope) ? (
                <div className="admin-notifications-loading" aria-label="Loading notifications"><Skeleton variant="text" lines={2} /></div>
            ) : notifications.length > 0 ? (
                <>
                    <div className="admin-notifications-list">
                        {notifications.map(notification => (
                            <div key={notification.id} className={`admin-notification-item ${notification.is_read ? '' : 'unread'}`}>
                                <div className="admin-notification-icon"><Bell size={16} aria-hidden="true" /></div>
                                <div className="admin-notification-content">
                                    <div className="admin-notification-title">{notification.title}</div>
                                    {notification.message && <div>{notification.message}</div>}
                                    <div className="admin-notification-time">{timeAgo(notification.created_at)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {fullPage ? (
                        <div className="admin-notifications-footer">
                            <span>Page {page} · {total} notifications</span>
                            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
                            <Button variant="secondary" disabled={!hasMore} onClick={() => setPage(value => value + 1)}>Next</Button>
                        </div>
                    ) : null}
                </>
            ) : !error ? (
                <MerchantEmptyState scene="notifications"
                    icon={<Bell className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                    title="All caught up"
                    body="New account alerts will appear here."
                />
            ) : null}
            {!fullPage && !loading && loadedScope === scope && (
                <div className="admin-notifications-footer">
                    <MerchantNavigationLink href={`/${store}/notifications`}>View all notifications</MerchantNavigationLink>
                </div>
            )}
        </div>
    )
}
