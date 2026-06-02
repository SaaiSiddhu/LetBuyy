'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

type PageStatus = 'draft' | 'published' | 'archived'
type ActiveTab = 'pages' | 'policies' | 'navigation'

interface PageItem {
    id: string
    title: string
    slug: string
    body?: string
    status: PageStatus
    page_type: string
    show_in_nav: boolean
    updated_at?: string
}

interface PolicyItem {
    id: string
    policy_type: 'privacy' | 'refund' | 'shipping' | 'terms' | 'contact' | 'custom'
    title: string
    slug: string
    body?: string
    status: PageStatus
    updated_at?: string
}

interface NavigationItem {
    id?: string
    label: string
    url: string
    target_type: string
    target_resource_id?: string | null
    sort_order: number
    is_visible: boolean
    open_in_new_tab: boolean
}

interface JsonPayload<T> {
    data?: T
    error?: { message?: string } | string
}

type PageDraft = Omit<PageItem, 'id' | 'updated_at'> & { id?: string }
type PolicyDraft = Omit<PolicyItem, 'id' | 'updated_at'> & { id?: string }

const EMPTY_PAGE: Omit<PageItem, 'id' | 'updated_at'> = {
    title: '',
    slug: '',
    body: '',
    status: 'draft',
    page_type: 'page',
    show_in_nav: false,
}

const EMPTY_POLICY: Omit<PolicyItem, 'id' | 'updated_at'> = {
    policy_type: 'privacy',
    title: '',
    slug: '',
    body: '',
    status: 'draft',
}

function slugify(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 100)
}

function errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message
    return fallback
}

async function parsePayload<T>(response: Response): Promise<JsonPayload<T>> {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        const message = payload?.error?.message || payload?.error || response.statusText
        throw new Error(message)
    }
    return payload
}

export default function PagesPage() {
    const params = useParams()
    const store = params.store as string
    const [activeTab, setActiveTab] = useState<ActiveTab>('pages')
    const [pages, setPages] = useState<PageItem[]>([])
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [navItems, setNavItems] = useState<NavigationItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pageDraft, setPageDraft] = useState<PageDraft>(EMPTY_PAGE)
    const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(EMPTY_POLICY)

    const visiblePages = useMemo(() => pages.filter((page) => page.status !== 'archived'), [pages])

    const loadContent = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [pagesResponse, policiesResponse, navigationResponse] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/pages?limit=100`, { cache: 'no-store' }),
                fetch(`/api/stores/${encodeURIComponent(store)}/policies`, { cache: 'no-store' }),
                fetch(`/api/stores/${encodeURIComponent(store)}/navigation?location=main`, { cache: 'no-store' }),
            ])
            const [pagesPayload, policiesPayload, navigationPayload] = await Promise.all([
                parsePayload<PageItem[]>(pagesResponse),
                parsePayload<PolicyItem[]>(policiesResponse),
                parsePayload<{ items?: NavigationItem[] }>(navigationResponse),
            ])
            setPages(Array.isArray(pagesPayload.data) ? pagesPayload.data : [])
            setPolicies(Array.isArray(policiesPayload.data) ? policiesPayload.data : [])
            setNavItems(Array.isArray(navigationPayload.data?.items) ? navigationPayload.data.items : [])
        } catch (err) {
            setError(errorMessage(err, 'Unable to load storefront content'))
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => {
        loadContent()
    }, [loadContent])

    const savePage = async () => {
        if (!pageDraft.title.trim()) return
        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...pageDraft,
                slug: pageDraft.slug || slugify(pageDraft.title),
            }
            const response = await fetch(
                pageDraft.id
                    ? `/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(pageDraft.id)}`
                    : `/api/stores/${encodeURIComponent(store)}/pages`,
                {
                    method: pageDraft.id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            await parsePayload<PageItem>(response)
            setPageDraft(EMPTY_PAGE)
            await loadContent()
        } catch (err) {
            setError(errorMessage(err, 'Unable to save page'))
        } finally {
            setSaving(false)
        }
    }

    const deletePage = async (pageId: string) => {
        setSaving(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(pageId)}`, {
                method: 'DELETE',
            })
            await parsePayload<{ deleted: boolean }>(response)
            await loadContent()
        } catch (err) {
            setError(errorMessage(err, 'Unable to delete page'))
        } finally {
            setSaving(false)
        }
    }

    const savePolicy = async () => {
        if (!policyDraft.title.trim()) return
        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...policyDraft,
                slug: policyDraft.slug || policyDraft.policy_type,
            }
            const response = await fetch(
                policyDraft.id
                    ? `/api/stores/${encodeURIComponent(store)}/policies/${encodeURIComponent(policyDraft.id)}`
                    : `/api/stores/${encodeURIComponent(store)}/policies`,
                {
                    method: policyDraft.id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )
            await parsePayload<PolicyItem>(response)
            setPolicyDraft(EMPTY_POLICY)
            await loadContent()
        } catch (err) {
            setError(errorMessage(err, 'Unable to save policy'))
        } finally {
            setSaving(false)
        }
    }

    const saveNavigation = async () => {
        setSaving(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/navigation/main`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Main menu',
                    items: navItems.map((item, index) => ({
                        ...item,
                        sort_order: index,
                    })),
                }),
            })
            await parsePayload<{ replaced: boolean }>(response)
            await loadContent()
        } catch (err) {
            setError(errorMessage(err, 'Unable to save navigation'))
        } finally {
            setSaving(false)
        }
    }

    const formatDate = (iso?: string) => {
        if (!iso) return 'Not saved'
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
    }

    return (
        <div className="online-store-page">
            <div className="os-page-header">
                <div>
                    <h1 className="os-page-title">Pages</h1>
                    <p className="os-page-description">Manage published storefront content, policies, and navigation menus.</p>
                </div>
                <button className="os-btn os-btn-outline" onClick={loadContent} disabled={loading || saving}>
                    Refresh
                </button>
            </div>

            <div className="os-tabs" role="tablist" aria-label="Store content">
                {(['pages', 'policies', 'navigation'] as ActiveTab[]).map((tab) => (
                    <button
                        key={tab}
                        className={`os-tab ${activeTab === tab ? 'os-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        type="button"
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {error && <div className="os-error-banner">{error}</div>}

            {loading ? (
                <div className="os-loading">
                    <MaterialIcon name="progress_activity" className="os-spin" />
                    Loading storefront content...
                </div>
            ) : (
                <>
                    {activeTab === 'pages' && (
                        <section className="os-content-grid">
                            <div className="os-inline-form-card">
                                <h3>{pageDraft.id ? 'Edit page' : 'Create page'}</h3>
                                <div className="os-form-stack">
                                    <input
                                        className="os-input"
                                        placeholder="Page title"
                                        value={pageDraft.title}
                                        onChange={(event) => setPageDraft((draft) => ({
                                            ...draft,
                                            title: event.target.value,
                                            slug: draft.slug || slugify(event.target.value),
                                        }))}
                                    />
                                    <input
                                        className="os-input"
                                        placeholder="URL slug"
                                        value={pageDraft.slug}
                                        onChange={(event) => setPageDraft((draft) => ({ ...draft, slug: slugify(event.target.value) }))}
                                    />
                                    <textarea
                                        className="os-textarea"
                                        rows={8}
                                        placeholder="Page body"
                                        value={pageDraft.body || ''}
                                        onChange={(event) => setPageDraft((draft) => ({ ...draft, body: event.target.value }))}
                                    />
                                    <div className="os-inline-form-row">
                                        <select
                                            className="os-input"
                                            value={pageDraft.status}
                                            onChange={(event) => setPageDraft((draft) => ({ ...draft, status: event.target.value as PageStatus }))}
                                        >
                                            <option value="draft">Draft</option>
                                            <option value="published">Published</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                        <label className="os-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={pageDraft.show_in_nav}
                                                onChange={(event) => setPageDraft((draft) => ({ ...draft, show_in_nav: event.target.checked }))}
                                            />
                                            Show in main menu
                                        </label>
                                    </div>
                                    <div className="os-inline-form-row">
                                        <button className="os-btn os-btn-primary" onClick={savePage} disabled={saving || !pageDraft.title.trim()}>
                                            {saving ? 'Saving...' : 'Save page'}
                                        </button>
                                        {pageDraft.id && (
                                            <button className="os-btn os-btn-outline" onClick={() => setPageDraft(EMPTY_PAGE)} type="button">
                                                Cancel edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <ContentTable
                                items={visiblePages}
                                emptyLabel="No pages yet."
                                onEdit={(page) => setPageDraft({ ...EMPTY_PAGE, ...page })}
                                onDelete={(page) => deletePage(page.id)}
                                formatDate={formatDate}
                            />
                        </section>
                    )}

                    {activeTab === 'policies' && (
                        <section className="os-content-grid">
                            <div className="os-inline-form-card">
                                <h3>{policyDraft.id ? 'Edit policy' : 'Create policy'}</h3>
                                <div className="os-form-stack">
                                    <select
                                        className="os-input"
                                        value={policyDraft.policy_type}
                                        onChange={(event) => setPolicyDraft((draft) => ({
                                            ...draft,
                                            policy_type: event.target.value as PolicyItem['policy_type'],
                                            slug: draft.slug || event.target.value,
                                        }))}
                                    >
                                        <option value="privacy">Privacy</option>
                                        <option value="terms">Terms</option>
                                        <option value="shipping">Shipping</option>
                                        <option value="refund">Refund/returns</option>
                                        <option value="contact">Contact</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                    <input
                                        className="os-input"
                                        placeholder="Policy title"
                                        value={policyDraft.title}
                                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, title: event.target.value }))}
                                    />
                                    <textarea
                                        className="os-textarea"
                                        rows={8}
                                        placeholder="Policy body"
                                        value={policyDraft.body || ''}
                                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, body: event.target.value }))}
                                    />
                                    <select
                                        className="os-input"
                                        value={policyDraft.status}
                                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, status: event.target.value as PageStatus }))}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                    <div className="os-inline-form-row">
                                        <button className="os-btn os-btn-primary" onClick={savePolicy} disabled={saving || !policyDraft.title.trim()}>
                                            {saving ? 'Saving...' : 'Save policy'}
                                        </button>
                                        {policyDraft.id && (
                                            <button className="os-btn os-btn-outline" onClick={() => setPolicyDraft(EMPTY_POLICY)} type="button">
                                                Cancel edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <ContentTable
                                items={policies}
                                emptyLabel="No policies yet."
                                onEdit={(policy) => setPolicyDraft({ ...EMPTY_POLICY, ...policy })}
                                onDelete={undefined}
                                formatDate={formatDate}
                            />
                        </section>
                    )}

                    {activeTab === 'navigation' && (
                        <section className="os-inline-form-card">
                            <div className="os-section-header">
                                <div>
                                    <h3>Main menu</h3>
                                    <p className="os-page-description">These links render in storefront headers after publish.</p>
                                </div>
                                <button
                                    className="os-btn os-btn-outline"
                                    onClick={() => setNavItems((items) => [
                                        ...items,
                                        {
                                            label: 'New link',
                                            url: '/',
                                            target_type: 'url',
                                            target_resource_id: null,
                                            sort_order: items.length,
                                            is_visible: true,
                                            open_in_new_tab: false,
                                        },
                                    ])}
                                >
                                    Add link
                                </button>
                            </div>

                            <div className="os-nav-list">
                                {navItems.map((item, index) => (
                                    <div className="os-nav-row" key={`${item.id || 'new'}-${index}`}>
                                        <input
                                            className="os-input"
                                            value={item.label}
                                            onChange={(event) => setNavItems((items) => items.map((current, currentIndex) => (
                                                currentIndex === index ? { ...current, label: event.target.value } : current
                                            )))}
                                        />
                                        <input
                                            className="os-input"
                                            value={item.url}
                                            onChange={(event) => setNavItems((items) => items.map((current, currentIndex) => (
                                                currentIndex === index ? { ...current, url: event.target.value } : current
                                            )))}
                                        />
                                        <label className="os-checkbox-row">
                                            <input
                                                type="checkbox"
                                                checked={item.is_visible}
                                                onChange={(event) => setNavItems((items) => items.map((current, currentIndex) => (
                                                    currentIndex === index ? { ...current, is_visible: event.target.checked } : current
                                                )))}
                                            />
                                            Visible
                                        </label>
                                        <button
                                            className="os-btn os-btn-outline os-btn-sm"
                                            onClick={() => setNavItems((items) => items.filter((_, currentIndex) => currentIndex !== index))}
                                            type="button"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {navItems.length === 0 && (
                                <div className="os-empty-state os-empty-state-compact">
                                    <h3>No menu links</h3>
                                    <p>Add links or publish pages with “Show in main menu”.</p>
                                </div>
                            )}

                            <div className="os-inline-form-row os-actions-row">
                                <button className="os-btn os-btn-primary" onClick={saveNavigation} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save menu'}
                                </button>
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    )
}

function ContentTable<T extends PageItem | PolicyItem>({
    items,
    emptyLabel,
    onEdit,
    onDelete,
    formatDate,
}: {
    items: T[]
    emptyLabel: string
    onEdit: (item: T) => void
    onDelete?: (item: T) => void
    formatDate: (iso?: string) => string
}) {
    if (items.length === 0) {
        return (
            <div className="os-empty-state">
                <MaterialIcon name="article" className="os-empty-icon" />
                <h3>{emptyLabel}</h3>
                <p>Create content and publish it to expose it through the storefront renderer.</p>
            </div>
        )
    }

    return (
        <div className="os-table-card">
            <table className="os-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Slug</th>
                        <th>Last updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr key={item.id}>
                            <td>
                                <div className="os-table-page-title">
                                    <MaterialIcon name="article" className="os-table-icon" />
                                    {item.title}
                                </div>
                            </td>
                            <td>
                                <span className={`os-status-badge os-status-${item.status}`}>
                                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                </span>
                            </td>
                            <td>/{item.slug}</td>
                            <td>{formatDate(item.updated_at)}</td>
                            <td>
                                <div className="os-table-actions">
                                    <button className="os-btn os-btn-outline os-btn-sm" onClick={() => onEdit(item)} type="button">
                                        Edit
                                    </button>
                                    {onDelete && (
                                        <button className="os-btn os-btn-outline os-btn-sm" onClick={() => onDelete(item)} type="button">
                                            Archive
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
