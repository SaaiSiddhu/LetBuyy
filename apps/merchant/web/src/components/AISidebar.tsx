'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StoreData } from './AdminShell'
import { Banner, Button, MaterialIcon, Skeleton } from '@letbuyy/ui'
import { useReadRequest } from '@/lib/api/use-read-request'
import { MerchantNavigationLink } from './MerchantNavigationLink'

interface AISidebarProps {
    store: string
    storeData: StoreData
    onClose: () => void
}

interface TodoItem {
    id: string
    text: string
    done: boolean | null
    link?: string
}

interface SetupProgress {
    productsCount: number | null
    shippingZonesCount: number | null
    pagesCount: number | null
    paymentConfigured: boolean | null
    themeCustomized: boolean | null
    domainConfigured: boolean | null
    published: boolean | null
}

/**
 * Derive dynamic todos from the store's actual setup state.
 * Each todo checks a real condition from storeData or makes a
 * lightweight fetch to verify progress.
 */
function buildDynamicTodos(storeData: StoreData, store: string, progress: SetupProgress): TodoItem[] {
    const siteType = storeData.site_type || 'store'
    const todos: TodoItem[] = []

    // Common todos for all site types
    todos.push({
        id: 'theme',
        text: 'Customize your site theme',
        done: progress.themeCustomized,
        link: `/${store}/appearance`,
    })

    todos.push({
        id: 'domain',
        text: 'Set up your storefront domain',
        done: progress.domainConfigured,
        link: `/${store}/settings/domains`,
    })

    todos.push({
        id: 'publish',
        text: 'Publish your site',
        done: progress.published,
        link: `/${store}/settings/general`,
    })

    // Site-type specific todos
    if (siteType === 'store') {
        todos.push({
            id: 'product',
            text: 'Add your first product',
            done: progress.productsCount === null ? null : progress.productsCount > 0,
            link: `/${store}/products/new`,
        })
        todos.push({
            id: 'payment',
            text: 'Set up your payment provider',
            done: progress.paymentConfigured,
            link: `/${store}/settings/payments`,
        })
        todos.push({
            id: 'shipping',
            text: 'Configure shipping rates',
            done: progress.shippingZonesCount === null ? null : progress.shippingZonesCount > 0,
            link: `/${store}/settings/shipping`,
        })
    } else if (siteType === 'portfolio') {
        todos.push({
            id: 'project',
            text: 'Add your first project',
            done: null,
            link: `/${store}/projects`,
        })
        todos.push({
            id: 'skills',
            text: 'Add your skills',
            done: null,
            link: `/${store}/skills`,
        })
    } else if (siteType === 'resume') {
        todos.push({
            id: 'experience',
            text: 'Add work experience',
            done: null,
            link: `/${store}/experience`,
        })
        todos.push({
            id: 'education',
            text: 'Add education history',
            done: null,
            link: `/${store}/education`,
        })
    } else if (siteType === 'blog') {
        todos.push({
            id: 'post',
            text: 'Write your first post',
            done: null,
            link: `/${store}/posts`,
        })
    }

    return todos
}

export default function AISidebar({ store, storeData, onClose }: AISidebarProps) {
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadedStore, setLoadedStore] = useState<string | null>(null)
    const [error, setError] = useState(false)
    const beginRead = useReadRequest(store)

    // Fetch setup progress on mount
    const checkProgress = useCallback(async () => {
            const request = beginRead()
            setLoading(true)
            setError(false)
            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/dashboard/setup`, { cache: 'no-store', signal: request.signal })
                const payload = await response.json()
                if (!request.isCurrent()) return
                if (!response.ok || !payload?.data) throw new Error('Setup progress unavailable')
                setTodos(buildDynamicTodos(storeData, store, payload.data as SetupProgress))
            } catch {
                if (request.isCurrent()) { setTodos([]); setError(true) }
            } finally {
                if (request.isCurrent()) { setLoadedStore(store); setLoading(false) }
            }
    }, [store, storeData, beginRead])
    useEffect(() => { void checkProgress() }, [checkProgress])

    const completedCount = todos.filter((t) => t.done).length

    return (
        <div className="admin-ai-panel">
            {/* Header */}
            <div className="admin-ai-panel-header">
                <div className="admin-ai-panel-title">
                    <MaterialIcon name="assistant" className="admin-ai-panel-title-icon" size={18} />
                    Setup assistant
                </div>
                <div className="admin-ai-panel-actions">
                    <Button unstyled type="button" onClick={onClose} title="Close" aria-label="Close setup assistant">
                        <MaterialIcon name="close" size={18} />
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="admin-ai-panel-body">
                <div className="admin-ai-todos">
                    <div className="admin-ai-todos-header">
                        <span className="admin-ai-todos-title">Setup to-dos</span>
                        <span className="admin-ai-todos-count">{completedCount}/{todos.length}</span>
                    </div>

                    {todos.length > 0 && (
                        <progress
                            className="admin-ai-progress"
                            value={completedCount}
                            max={todos.length}
                            aria-label="Setup progress"
                        />
                    )}

                    {error && <Banner variant="warning" title="Setup progress is unavailable" action={<Button variant="secondary" onClick={() => void checkProgress()}>Retry</Button>}>Try loading the setup checks again.</Banner>}

                    {loading || loadedStore !== store ? (
                        <div className="admin-ai-loading">
                            <Skeleton variant="text" lines={3} />
                        </div>
                    ) : (
                        todos.map((todo) => (
                            <div
                                key={todo.id}
                                className="admin-ai-todo-item"
                            >
                                <div
                                    className="admin-ai-todo-check"
                                >
                                    <span className={`admin-ai-todo-checkbox ${todo.done ? 'checked' : ''}`} />
                                    <span className={`admin-ai-todo-text ${todo.done ? 'complete' : ''}`}>
                                        {todo.text}
                                        {todo.done === null && <span> — Status unavailable</span>}
                                    </span>
                                </div>
                                {todo.link && !todo.done && (
                                    <MerchantNavigationLink
                                        href={todo.link}
                                        className="admin-ai-todo-link"
                                    >
                                        Go
                                        <MaterialIcon name="arrow_right" size={12} />
                                    </MerchantNavigationLink>
                                )}
                            </div>
                        ))
                    )}

                    {!loading && completedCount === todos.length && todos.length > 0 && (
                        <div className="admin-ai-complete" role="status">
                            <MaterialIcon name="check_circle" size={16} />
                            <span>All setup tasks complete. Your site is ready.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
