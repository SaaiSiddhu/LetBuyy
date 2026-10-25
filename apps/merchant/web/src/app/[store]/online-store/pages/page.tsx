'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { PAGE_STATUS_PRESENTATION, presentStatus } from '@letbuyy/shared-types'
import { Badge, Banner, Button, Card, ConfirmDialog, EmptyState, FileText, Input, ListChecks, Page, PageHeader, Plus, RefreshCw, SaveBar, Section, Select, Skeleton, StatusPresentationBadge, Table, Tabs, Textarea, Trash2, useToast } from '@letbuyy/ui'
import { formatUsShortDate } from '@letbuyy/ui/formatting'
import { slugifyCmsTitle as slugify } from '@letbuyy/cms-core'

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

const EMPTY_PAGE: PageDraft = {
    title: '',
    slug: '',
    body: '',
    status: 'draft',
    page_type: 'page',
    show_in_nav: false,
}

const EMPTY_POLICY: PolicyDraft = {
    policy_type: 'privacy',
    title: '',
    slug: '',
    body: '',
    status: 'draft',
}

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
]

const policyTypeOptions = [
    { label: 'Privacy', value: 'privacy' },
    { label: 'Terms', value: 'terms' },
    { label: 'Shipping', value: 'shipping' },
    { label: 'Refund/returns', value: 'refund' },
    { label: 'Contact', value: 'contact' },
    { label: 'Custom', value: 'custom' },
]

function errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message
    return fallback
}

async function parsePayload<T>(response: Response): Promise<JsonPayload<T>> {
    const payload = await response.json().catch(() => ({})) as JsonPayload<T>
    if (!response.ok) {
        const error = payload.error
        const message = typeof error === 'string' ? error : error?.message || response.statusText
        throw new Error(message)
    }
    return payload
}

function createSignature(value: unknown) {
    return JSON.stringify(value)
}

function createPageSignature(draft: PageDraft) {
    return createSignature({
        id: draft.id || '',
        title: draft.title,
        slug: draft.slug,
        body: draft.body || '',
        status: draft.status,
        page_type: draft.page_type,
        show_in_nav: draft.show_in_nav,
    })
}

function createPolicySignature(draft: PolicyDraft) {
    return createSignature({
        id: draft.id || '',
        policy_type: draft.policy_type,
        title: draft.title,
        slug: draft.slug,
        body: draft.body || '',
        status: draft.status,
    })
}

function createNavigationSignature(items: NavigationItem[]) {
    return createSignature(items.map((item, index) => ({
        id: item.id || '',
        label: item.label,
        url: item.url,
        target_type: item.target_type,
        target_resource_id: item.target_resource_id || null,
        sort_order: index,
        is_visible: item.is_visible,
        open_in_new_tab: item.open_in_new_tab,
    })))
}

function CheckboxControl({
    checked,
    children,
    onChange,
}: {
    checked: boolean
    children: ReactNode
    onChange: (checked: boolean) => void
}) {
    return (
        <label className="flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
            <Input unstyled
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            />
            {children}
        </label>
    )
}

export default function PagesPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [activeTab, setActiveTab] = useState<ActiveTab>('pages')
    const [pages, setPages] = useState<PageItem[]>([])
    const [policies, setPolicies] = useState<PolicyItem[]>([])
    const [navItems, setNavItems] = useState<NavigationItem[]>([])
    const [savedNavItems, setSavedNavItems] = useState<NavigationItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pageDraft, setPageDraft] = useState<PageDraft>(EMPTY_PAGE)
    const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(EMPTY_POLICY)
    const [savedPageSignature, setSavedPageSignature] = useState(createPageSignature(EMPTY_PAGE))
    const [savedPolicySignature, setSavedPolicySignature] = useState(createPolicySignature(EMPTY_POLICY))
    const [savedNavigationSignature, setSavedNavigationSignature] = useState(createNavigationSignature([]))
    const [pageToArchive, setPageToArchive] = useState<PageItem | null>(null)

    const visiblePages = useMemo(() => pages.filter((page) => page.status !== 'archived'), [pages])
    const pageDraftSignature = useMemo(() => createPageSignature(pageDraft), [pageDraft])
    const policyDraftSignature = useMemo(() => createPolicySignature(policyDraft), [policyDraft])
    const navSignature = useMemo(() => createNavigationSignature(navItems), [navItems])
    const pageDirty = pageDraftSignature !== savedPageSignature
    const policyDirty = policyDraftSignature !== savedPolicySignature
    const navigationDirty = navSignature !== savedNavigationSignature
    const activeDirty = activeTab === 'pages' ? pageDirty : activeTab === 'policies' ? policyDirty : navigationDirty
    const saveState = saving ? 'saving' : activeDirty ? 'unsaved' : 'saved'

    const resetPageDraft = useCallback(() => {
        setPageDraft(EMPTY_PAGE)
        setSavedPageSignature(createPageSignature(EMPTY_PAGE))
    }, [])

    const resetPolicyDraft = useCallback(() => {
        setPolicyDraft(EMPTY_POLICY)
        setSavedPolicySignature(createPolicySignature(EMPTY_POLICY))
    }, [])

    const beginContent = useReadRequest(store)
    const loadContent = useCallback(async () => {
        const request = beginContent()
        setLoading(true)
        setError(null)
        try {
            const [pagesResponse, policiesResponse, navigationResponse] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/pages?limit=100`, { cache: 'no-store', signal: request.signal }),
                fetch(`/api/stores/${encodeURIComponent(store)}/policies`, { cache: 'no-store', signal: request.signal }),
                fetch(`/api/stores/${encodeURIComponent(store)}/navigation?location=main`, { cache: 'no-store', signal: request.signal }),
            ])
            const [pagesPayload, policiesPayload, navigationPayload] = await Promise.all([
                parsePayload<PageItem[]>(pagesResponse),
                parsePayload<PolicyItem[]>(policiesResponse),
                parsePayload<{ items?: NavigationItem[] }>(navigationResponse),
            ])
            if (!request.isCurrent()) return
            const nextPages = Array.isArray(pagesPayload.data) ? pagesPayload.data : []
            const nextPolicies = Array.isArray(policiesPayload.data) ? policiesPayload.data : []
            const nextNavItems = Array.isArray(navigationPayload.data?.items) ? navigationPayload.data.items : []
            setPages(nextPages)
            setPolicies(nextPolicies)
            setNavItems(nextNavItems)
            setSavedNavItems(nextNavItems)
            setSavedNavigationSignature(createNavigationSignature(nextNavItems))
        } catch (err) {
            if (!request.isCurrent()) return
            const message = errorMessage(err, 'Unable to load storefront content')
            setError(message)
            notify({
                title: 'Storefront content could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginContent, notify, store])

    useEffect(() => {
        void loadContent()
    }, [loadContent])

    const savePage = useCallback(async () => {
        const title = pageDraft.title.trim()
        if (!title) {
            notify({
                title: 'Page title is required',
                description: 'Add a title before saving this storefront page.',
                variant: 'warning',
            })
            return
        }

        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...pageDraft,
                title,
                slug: pageDraft.slug || slugify(title),
            }
            const response = await fetch(
                pageDraft.id
                    ? `/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(pageDraft.id)}`
                    : `/api/stores/${encodeURIComponent(store)}/pages`,
                {
                    method: pageDraft.id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            )
            await parsePayload<PageItem>(response)
            resetPageDraft()
            notify({
                title: pageDraft.id ? 'Page updated' : 'Page created',
                description: `${title} is saved for the storefront.`,
                variant: 'success',
            })
            await loadContent()
        } catch (err) {
            const message = errorMessage(err, 'Unable to save page')
            setError(message)
            notify({
                title: 'Could not save page',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [loadContent, notify, pageDraft, resetPageDraft, store])

    const archivePage = useCallback(async () => {
        if (!pageToArchive) return

        setSaving(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/pages/${encodeURIComponent(pageToArchive.id)}`, {
                method: 'DELETE',
            })
            await parsePayload<{ deleted: boolean }>(response)
            notify({
                title: 'Page archived',
                description: `${pageToArchive.title} was removed from active storefront pages.`,
                variant: 'success',
            })
            setPageToArchive(null)
            await loadContent()
        } catch (err) {
            const message = errorMessage(err, 'Unable to delete page')
            setError(message)
            notify({
                title: 'Could not archive page',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [loadContent, notify, pageToArchive, store])

    const savePolicy = useCallback(async () => {
        const title = policyDraft.title.trim()
        if (!title) {
            notify({
                title: 'Policy title is required',
                description: 'Add a title before saving this policy.',
                variant: 'warning',
            })
            return
        }

        setSaving(true)
        setError(null)
        try {
            const payload = {
                ...policyDraft,
                title,
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
                },
            )
            await parsePayload<PolicyItem>(response)
            resetPolicyDraft()
            notify({
                title: policyDraft.id ? 'Policy updated' : 'Policy created',
                description: `${title} is saved for the storefront.`,
                variant: 'success',
            })
            await loadContent()
        } catch (err) {
            const message = errorMessage(err, 'Unable to save policy')
            setError(message)
            notify({
                title: 'Could not save policy',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [loadContent, notify, policyDraft, resetPolicyDraft, store])

    const saveNavigation = useCallback(async () => {
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
            notify({
                title: 'Menu saved',
                description: 'Main menu links are ready for the storefront.',
                variant: 'success',
            })
            await loadContent()
        } catch (err) {
            const message = errorMessage(err, 'Unable to save navigation')
            setError(message)
            notify({
                title: 'Could not save menu',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [loadContent, navItems, notify, store])

    const handleSave = useCallback(() => {
        if (activeTab === 'pages') {
            void savePage()
            return
        }

        if (activeTab === 'policies') {
            void savePolicy()
            return
        }

        void saveNavigation()
    }, [activeTab, saveNavigation, savePage, savePolicy])

    const handleDiscard = useCallback(() => {
        if (activeTab === 'pages') {
            resetPageDraft()
            return
        }

        if (activeTab === 'policies') {
            resetPolicyDraft()
            return
        }

        setNavItems(savedNavItems)
        setSavedNavigationSignature(createNavigationSignature(savedNavItems))
    }, [activeTab, resetPageDraft, resetPolicyDraft, savedNavItems])

    const pageColumns = useMemo(() => [
        {
            key: 'title',
            header: 'Title',
            render: (item: PageItem) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {item.title}
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            /{item.slug}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (item: PageItem) => (
                <StatusPresentationBadge presentation={presentStatus(PAGE_STATUS_PRESENTATION, item.status)} />
            ),
        },
        {
            key: 'updated_at',
            header: 'Last updated',
            render: (item: PageItem) => formatUsShortDate(item.updated_at, { emptyValue: 'Not saved' }),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (item: PageItem) => (
                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            const draft = { ...EMPTY_PAGE, ...item }
                            setPageDraft(draft)
                            setSavedPageSignature(createPageSignature(draft))
                        }}
                    >
                        Edit
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setPageToArchive(item)}>
                        Archive
                    </Button>
                </div>
            ),
        },
    ], [])

    const policyColumns = useMemo(() => [
        {
            key: 'title',
            header: 'Title',
            render: (item: PolicyItem) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {item.title}
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {item.policy_type} / {item.slug}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (item: PolicyItem) => (
                <StatusPresentationBadge presentation={presentStatus(PAGE_STATUS_PRESENTATION, item.status)} />
            ),
        },
        {
            key: 'updated_at',
            header: 'Last updated',
            render: (item: PolicyItem) => formatUsShortDate(item.updated_at, { emptyValue: 'Not saved' }),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (item: PolicyItem) => (
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                        const draft = { ...EMPTY_POLICY, ...item }
                        setPolicyDraft(draft)
                        setSavedPolicySignature(createPolicySignature(draft))
                    }}
                >
                    Edit
                </Button>
            ),
        },
    ], [])

    const pageTab = (
        <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <Card>
                <Section title={pageDraft.id ? 'Edit page' : 'Create page'} description="Draft content pages and publish them when ready.">
                    <Input
                        label="Page title"
                        placeholder="About us"
                        value={pageDraft.title}
                        onChange={(event) => setPageDraft((draft) => ({
                            ...draft,
                            title: event.target.value,
                            slug: draft.slug || slugify(event.target.value),
                        }))}
                    />
                    <Input
                        label="URL slug"
                        placeholder="about-us"
                        value={pageDraft.slug}
                        onChange={(event) => setPageDraft((draft) => ({ ...draft, slug: slugify(event.target.value) }))}
                    />
                    <Textarea
                        label="Page body"
                        placeholder="Tell shoppers what this page is about."
                        value={pageDraft.body || ''}
                        onChange={(event) => setPageDraft((draft) => ({ ...draft, body: event.target.value }))}
                    />
                    <Select
                        label="Status"
                        value={pageDraft.status}
                        options={statusOptions}
                        onChange={(event) => setPageDraft((draft) => ({ ...draft, status: event.target.value as PageStatus }))}
                    />
                    <CheckboxControl
                        checked={pageDraft.show_in_nav}
                        onChange={(checked) => setPageDraft((draft) => ({ ...draft, show_in_nav: checked }))}
                    >
                        Show in main menu
                    </CheckboxControl>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <Button type="button" onClick={() => void savePage()} loading={saving}>
                            {pageDraft.id ? 'Save page' : 'Create page'}
                        </Button>
                        {pageDraft.id && (
                            <Button type="button" variant="secondary" onClick={resetPageDraft}>
                                Cancel edit
                            </Button>
                        )}
                    </div>
                </Section>
            </Card>

            <Table
                rows={visiblePages}
                columns={pageColumns}
                emptyState={(
                    <EmptyState
                        icon={<FileText className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="No pages yet"
                        body="Create storefront content pages and publish them when shoppers should see them."
                        primaryAction={<Button type="button" onClick={() => setPageDraft(EMPTY_PAGE)}>Create page</Button>}
                    />
                )}
            />
        </div>
    )

    const policiesTab = (
        <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <Card>
                <Section title={policyDraft.id ? 'Edit policy' : 'Create policy'} description="Prepare legal and service policies for the storefront.">
                    <Select
                        label="Policy type"
                        value={policyDraft.policy_type}
                        options={policyTypeOptions}
                        onChange={(event) => setPolicyDraft((draft) => ({
                            ...draft,
                            policy_type: event.target.value as PolicyItem['policy_type'],
                            slug: draft.slug || event.target.value,
                        }))}
                    />
                    <Input
                        label="Policy title"
                        placeholder="Privacy policy"
                        value={policyDraft.title}
                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, title: event.target.value }))}
                    />
                    <Textarea
                        label="Policy body"
                        placeholder="Write the policy content shoppers can read."
                        value={policyDraft.body || ''}
                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, body: event.target.value }))}
                    />
                    <Select
                        label="Status"
                        value={policyDraft.status}
                        options={statusOptions}
                        onChange={(event) => setPolicyDraft((draft) => ({ ...draft, status: event.target.value as PageStatus }))}
                    />
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <Button type="button" onClick={() => void savePolicy()} loading={saving}>
                            {policyDraft.id ? 'Save policy' : 'Create policy'}
                        </Button>
                        {policyDraft.id && (
                            <Button type="button" variant="secondary" onClick={resetPolicyDraft}>
                                Cancel edit
                            </Button>
                        )}
                    </div>
                </Section>
            </Card>

            <Table
                rows={policies}
                columns={policyColumns}
                emptyState={(
                    <EmptyState
                        icon={<FileText className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="No policies yet"
                        body="Create policies for privacy, refunds, shipping, terms, and support."
                        primaryAction={<Button type="button" onClick={() => setActiveTab('policies')}>Create policy</Button>}
                    />
                )}
            />
        </div>
    )

    const navigationTab = (
        <Card>
            <Section
                title="Main menu"
                description="These links render in storefront headers after publish."
                action={(
                    <Button
                        type="button"
                        variant="secondary"
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
                        <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Add link
                    </Button>
                )}
            >
                {navItems.length === 0 ? (
                    <EmptyState
                        icon={<ListChecks className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                        title="No menu links"
                        body="Add links or publish pages with Show in main menu."
                        primaryAction={<Button type="button" onClick={() => setNavItems([{ label: 'New link', url: '/', target_type: 'url', target_resource_id: null, sort_order: 0, is_visible: true, open_in_new_tab: false }])}>Add link</Button>}
                    />
                ) : (
                    <div className="flex flex-col gap-[var(--lb-space-3)]">
                        {navItems.map((item, index) => (
                            <div key={`${item.id || 'new'}-${index}`} className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                <Input
                                    label="Label"
                                    value={item.label}
                                    onChange={(event) => setNavItems((items) => items.map((current, currentIndex) => (
                                        currentIndex === index ? { ...current, label: event.target.value } : current
                                    )))}
                                />
                                <Input
                                    label="URL"
                                    value={item.url}
                                    onChange={(event) => setNavItems((items) => items.map((current, currentIndex) => (
                                        currentIndex === index ? { ...current, url: event.target.value } : current
                                    )))}
                                />
                                <div className="flex flex-wrap items-end gap-[var(--lb-space-3)]">
                                    <CheckboxControl
                                        checked={item.is_visible}
                                        onChange={(checked) => setNavItems((items) => items.map((current, currentIndex) => (
                                            currentIndex === index ? { ...current, is_visible: checked } : current
                                        )))}
                                    >
                                        Visible
                                    </CheckboxControl>
                                    <CheckboxControl
                                        checked={item.open_in_new_tab}
                                        onChange={(checked) => setNavItems((items) => items.map((current, currentIndex) => (
                                            currentIndex === index ? { ...current, open_in_new_tab: checked } : current
                                        )))}
                                    >
                                        New tab
                                    </CheckboxControl>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setNavItems((items) => items.filter((_, currentIndex) => currentIndex !== index))}
                                    >
                                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                    <Button type="button" onClick={() => void saveNavigation()} loading={saving}>
                        Save menu
                    </Button>
                    {navigationDirty && (
                        <Button type="button" variant="secondary" onClick={handleDiscard}>
                            Discard changes
                        </Button>
                    )}
                </div>
            </Section>
        </Card>
    )

    return (
        <Page>
            <PageHeader identity="themes"
                recipe="index"
                title="Pages"
                description="Manage published storefront content, policies, and navigation menus."
                breadcrumbs={[{ label: 'Online Store' }, { label: 'Pages' }]}
                primaryAction={{
                    label: 'Refresh',
                    onClick: () => void loadContent(),
                    icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    disabled: loading || saving,
                }}
            />

            {error && (
                <Banner variant="critical" title="Storefront content needs attention">
                    {error}
                </Banner>
            )}

            {loading ? (
                <Card>
                    <Section title="Loading storefront content">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            ) : (
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as ActiveTab)}
                    items={[
                        { label: 'Pages', value: 'pages', badge: String(visiblePages.length), content: pageTab },
                        { label: 'Policies', value: 'policies', badge: String(policies.length), content: policiesTab },
                        { label: 'Navigation', value: 'navigation', badge: String(navItems.length), content: navigationTab },
                    ]}
                />
            )}

            <SaveBar
                state={saveState}
                onSave={handleSave}
                onDiscard={handleDiscard}
                saveLabel={activeTab === 'pages' ? 'Save page' : activeTab === 'policies' ? 'Save policy' : 'Save menu'}
            />

            <ConfirmDialog
                open={Boolean(pageToArchive)}
                title="Archive page?"
                description={pageToArchive ? `Archive ${pageToArchive.title}? It will be removed from active storefront pages.` : 'Archive this page?'}
                confirmLabel="Archive page"
                destructive
                onClose={() => setPageToArchive(null)}
                onConfirm={() => void archivePage()}
            />
        </Page>
    )
}
