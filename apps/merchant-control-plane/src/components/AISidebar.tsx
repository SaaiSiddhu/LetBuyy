'use client'

import { useState, useEffect } from 'react'
import type { StoreData } from './AdminShell'
import { Button, MaterialIcon } from '@letbuyy/ui'

interface AISidebarProps {
    store: string
    storeData: StoreData
    onClose: () => void
}

interface TodoItem {
    id: string
    text: string
    done: boolean
    link?: string
}

/**
 * Derive dynamic todos from the store's actual setup state.
 * Each todo checks a real condition from storeData or makes a
 * lightweight fetch to verify progress.
 */
function buildDynamicTodos(storeData: StoreData, store: string, productCount: number, hasPayment: boolean): TodoItem[] {
    const siteType = storeData.site_type || 'store'
    const todos: TodoItem[] = []

    // Common todos for all site types
    todos.push({
        id: 'theme',
        text: 'Customize your site theme',
        done: !!(storeData.theme_id && storeData.theme_settings),
        link: `/${store}/settings/appearance`,
    })

    todos.push({
        id: 'domain',
        text: 'Set up a custom domain',
        done: !!storeData.custom_domain,
        link: `/${store}/settings/domains`,
    })

    todos.push({
        id: 'publish',
        text: 'Publish your site',
        done: storeData.status === 'published',
        link: `/${store}/settings/general`,
    })

    // Site-type specific todos
    if (siteType === 'store') {
        todos.push({
            id: 'product',
            text: 'Add your first product',
            done: productCount > 0,
            link: `/${store}/products/new`,
        })
        todos.push({
            id: 'payment',
            text: 'Set up your payment provider',
            done: hasPayment,
            link: `/${store}/settings/payments`,
        })
        todos.push({
            id: 'shipping',
            text: 'Configure shipping rates',
            done: false, // Checked via API if needed
            link: `/${store}/settings/shipping`,
        })
    } else if (siteType === 'portfolio') {
        todos.push({
            id: 'project',
            text: 'Add your first project',
            done: false,
            link: `/${store}/projects`,
        })
        todos.push({
            id: 'skills',
            text: 'Add your skills',
            done: false,
            link: `/${store}/skills`,
        })
    } else if (siteType === 'resume') {
        todos.push({
            id: 'experience',
            text: 'Add work experience',
            done: false,
            link: `/${store}/experience`,
        })
        todos.push({
            id: 'education',
            text: 'Add education history',
            done: false,
            link: `/${store}/education`,
        })
    } else if (siteType === 'blog') {
        todos.push({
            id: 'post',
            text: 'Write your first post',
            done: false,
            link: `/${store}/posts`,
        })
    }

    return todos
}

export default function AISidebar({ store, storeData, onClose }: AISidebarProps) {
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch setup progress on mount
    useEffect(() => {
        async function checkProgress() {
            setLoading(true)
            let productCount = 0
            let hasPayment = false

            try {
                // Check products count
                const prodRes = await fetch(`/api/store-data?store=${store}&type=product_count`)
                if (prodRes.ok) {
                    const data = await prodRes.json()
                    productCount = data.count || 0
                }
            } catch { /* fallback = 0 */ }

            try {
                // Check payment setup
                const payRes = await fetch(`/api/store-data?store=${store}&type=payment_check`)
                if (payRes.ok) {
                    const data = await payRes.json()
                    hasPayment = data.configured || false
                }
            } catch { /* fallback = false */ }

            const dynamicTodos = buildDynamicTodos(storeData, store, productCount, hasPayment)
            setTodos(dynamicTodos)
            setLoading(false)
        }

        checkProgress()
    }, [store, storeData])

    const toggleTodo = (id: string) => {
        setTodos((prev) =>
            prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
        )
    }

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

                    {loading ? (
                        <div className="admin-ai-loading">
                            Loading setup progress...
                        </div>
                    ) : (
                        todos.map((todo) => (
                            <div
                                key={todo.id}
                                className="admin-ai-todo-item"
                            >
                                <Button unstyled
                                    type="button"
                                    className="admin-ai-todo-check"
                                    onClick={() => toggleTodo(todo.id)}
                                    aria-pressed={todo.done}
                                >
                                    <span className={`admin-ai-todo-checkbox ${todo.done ? 'checked' : ''}`} />
                                    <span className={`admin-ai-todo-text ${todo.done ? 'complete' : ''}`}>
                                        {todo.text}
                                    </span>
                                </Button>
                                {todo.link && !todo.done && (
                                    <a
                                        href={todo.link}
                                        className="admin-ai-todo-link"
                                    >
                                        Go
                                        <MaterialIcon name="arrow_right" size={12} />
                                    </a>
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
