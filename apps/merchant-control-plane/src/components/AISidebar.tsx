'use client'

import { useState, useEffect } from 'react'
import type { StoreData } from './AdminShell'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'

interface AISidebarProps {
    store: string
    storeData: StoreData
    onClose: () => void
}

interface AiMessage {
    role: 'assistant' | 'user'
    content: string
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
    const [messages, setMessages] = useState<AiMessage[]>([
        {
            role: 'assistant',
            content:
                "Hi! I'm your LetBuyy AI assistant. AI-powered suggestions are coming soon! For now, check your setup to-dos to get your site ready.",
        },
    ])
    const [input, setInput] = useState('')
    const [activeTab, setActiveTab] = useState<'chat' | 'todos'>('todos')

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

    const handleSend = () => {
        if (!input.trim()) return
        const userMsg: AiMessage = { role: 'user', content: input.trim() }
        setMessages((prev) => [...prev, userMsg])
        setInput('')

        // Coming soon response
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content:
                        "AI-powered responses are coming soon. We're building an intelligent assistant that will help you manage your store, write product descriptions, and optimize your setup. Stay tuned.",
                },
            ])
        }, 500)
    }

    const completedCount = todos.filter((t) => t.done).length

    return (
        <div className="admin-ai-panel">
            {/* Header */}
            <div className="admin-ai-panel-header">
                <div className="admin-ai-panel-title">
                    <MaterialIcon name="assistant" className="admin-ai-panel-title-icon" size={18} />
                    LetBuyy AI
                </div>
                <div className="admin-ai-panel-actions">
                    <Button unstyled type="button" onClick={onClose} title="Close" aria-label="Close AI panel">
                        <MaterialIcon name="close" size={18} />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="admin-ai-tabs" role="tablist" aria-label="AI assistant panels">
                <Button unstyled
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'chat'}
                    className={`admin-ai-tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    Chat
                    <span className="admin-ai-tab-badge">Soon</span>
                </Button>
                <Button unstyled
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'todos'}
                    className={`admin-ai-tab ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                >
                    To-dos ({completedCount}/{todos.length})
                </Button>
            </div>

            {/* Body */}
            <div className="admin-ai-panel-body">
                {activeTab === 'chat' ? (
                    <>
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`admin-ai-message ${msg.role}`}
                            >
                                {msg.content}
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="admin-ai-todos">
                        <div className="admin-ai-todos-header">
                            <span className="admin-ai-todos-title">Your setup to-dos</span>
                            <span className="admin-ai-todos-count">{completedCount}/{todos.length}</span>
                        </div>

                        {/* Progress bar */}
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
                                Loading your setup progress...
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

                        {/* Celebration message when all done */}
                        {!loading && completedCount === todos.length && todos.length > 0 && (
                            <div className="admin-ai-complete" role="status">
                                <MaterialIcon name="check_circle" size={16} />
                                <span>All setup tasks complete. Your site is ready.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer — only for chat tab */}
            {activeTab === 'chat' && (
                <div className="admin-ai-panel-footer">
                    <div className="admin-ai-input-wrapper">
                        <Input unstyled
                            className="admin-ai-input"
                            type="text"
                            placeholder="Ask LetBuyy AI..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSend()
                            }}
                        />
                        <Button unstyled
                            type="button"
                            className="admin-ai-send-btn"
                            onClick={handleSend}
                            disabled={!input.trim()}
                            aria-label="Send AI message"
                        >
                            <MaterialIcon name="arrow_upward" size={16} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
