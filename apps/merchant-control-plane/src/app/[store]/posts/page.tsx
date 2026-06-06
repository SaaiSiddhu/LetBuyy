'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    BookOpen,
    Button,
    Card,
    ConfirmDialog,
    Table,
    EmptyState,
    FileText,
    Input,
    Page,
    PageHeader,
    Pencil,
    Plus,
    RefreshCw,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Tabs,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'
import type { TableColumn } from '@letbuyy/ui'
import { slugifyCmsTitle as slugify } from '@letbuyy/cms-core'

type PostStatus = 'draft' | 'published' | 'archived'
type SaveState = 'saved' | 'unsaved' | 'saving'

interface Post extends Record<string, unknown> {
    id: string
    title: string
    slug: string
    status: PostStatus
    excerpt: string | null
    content: string | null
    featured_image: string | null
    published_at: string | null
    created_at: string
}

interface PostFormData {
    title: string
    slug: string
    excerpt: string
    content: string
    status: PostStatus
}

const blankPost: PostFormData = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
}

const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' },
]

const tabLabels: Array<{ value: 'all' | PostStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
]

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

function statusVariant(status: PostStatus) {
    if (status === 'published') return 'success' as const
    if (status === 'archived') return 'critical' as const
    return 'default' as const
}

function statusLabel(status: PostStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function PostsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState<'all' | PostStatus>('all')
    const [formData, setFormData] = useState<PostFormData>(blankPost)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSaveState, setFormSaveState] = useState<SaveState>('saved')
    const [postToDelete, setPostToDelete] = useState<Post | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadPosts = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/posts?limit=100`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load blog posts'))
            }

            setPosts(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load blog posts'
            setPosts([])
            setLoadError(message)
            notify({
                title: 'Blog posts could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadPosts()
    }, [loadPosts])

    const stats = useMemo(() => ({
        total: posts.length,
        published: posts.filter((post) => post.status === 'published').length,
        drafts: posts.filter((post) => post.status === 'draft').length,
        archived: posts.filter((post) => post.status === 'archived').length,
    }), [posts])

    const updateForm = useCallback(<Key extends keyof PostFormData>(key: Key, value: PostFormData[Key]) => {
        setFormData((current) => ({
            ...current,
            [key]: value,
            ...(key === 'title' && !current.slug ? { slug: slugify(value) } : {}),
        }))
        setFormSaveState('unsaved')
        setFormError(null)
    }, [])

    const startCreate = useCallback(() => {
        setEditingId(null)
        setFormData(blankPost)
        setFormError(null)
        setFormSaveState('unsaved')
        setShowForm(true)
    }, [])

    const startEdit = useCallback((post: Post) => {
        setEditingId(post.id)
        setFormData({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt || '',
            content: post.content || '',
            status: post.status,
        })
        setFormError(null)
        setFormSaveState('saved')
        setShowForm(true)
    }, [])

    const discardForm = useCallback(() => {
        setShowForm(false)
        setEditingId(null)
        setFormData(blankPost)
        setFormError(null)
        setFormSaveState('saved')
    }, [])

    const handleSave = useCallback(async () => {
        const title = formData.title.trim()
        const slug = formData.slug.trim() || slugify(title)

        if (!title) {
            setFormError('Enter a post title before saving.')
            setFormSaveState('unsaved')
            return
        }

        setSaving(true)
        setFormSaveState('saving')
        setFormError(null)

        try {
            const response = await fetch(
                editingId
                    ? `/api/stores/${encodeURIComponent(store)}/posts/${encodeURIComponent(editingId)}`
                    : `/api/stores/${encodeURIComponent(store)}/posts`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        slug,
                        excerpt: formData.excerpt || null,
                        content: formData.content || null,
                        status: formData.status,
                    }),
                },
            )
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, editingId ? 'Unable to update post' : 'Unable to create post'))
            }

            notify({
                title: editingId ? 'Post updated' : 'Post created',
                description: `${title} was ${editingId ? 'updated' : 'saved'}.`,
                variant: 'success',
            })
            setFormSaveState('saved')
            setFormData(blankPost)
            setShowForm(false)
            setEditingId(null)
            await loadPosts({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : (editingId ? 'Unable to update post' : 'Unable to create post')
            setFormError(message)
            setFormSaveState('unsaved')
            notify({
                title: editingId ? 'Could not update post' : 'Could not create post',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [editingId, formData, loadPosts, notify, store])

    const handleDelete = useCallback(async () => {
        if (!postToDelete || deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/posts/${encodeURIComponent(postToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to archive post'))
            }

            notify({
                title: 'Post archived',
                description: `${postToDelete.title} was archived.`,
                variant: 'success',
            })
            setPostToDelete(null)
            await loadPosts({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to archive post'
            notify({
                title: 'Could not archive post',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [deleting, loadPosts, notify, postToDelete, store])

    const columns = useMemo<Array<TableColumn<Post>>>(() => [
        {
            key: 'title',
            header: 'Post',
            render: (post) => (
                <div className="min-w-0">
                    <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{post.title}</p>
                    {post.excerpt && (
                        <p className="m-0 max-w-[36rem] truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {post.excerpt}
                        </p>
                    )}
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">/{post.slug}</p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (post) => <Badge label={statusLabel(post.status)} variant={statusVariant(post.status)} />,
        },
        {
            key: 'published_at',
            header: 'Date',
            render: (post) => (
                <span className="text-[var(--lb-color-text-subdued)]">
                    {formatIndiaDate(post.published_at || post.created_at, { emptyValue: 'Not published' })}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (post) => (
                <div className="flex flex-wrap justify-end gap-[var(--lb-space-2)]">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(post)}>
                        <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Edit
                    </Button>
                    <Button variant="outline" size="sm" disabled={deleting} onClick={() => setPostToDelete(post)}>
                        <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Archive
                    </Button>
                </div>
            ),
        },
    ], [deleting, startEdit])

    const renderPostTable = useCallback((items: Post[]) => (
        items.length === 0 ? (
            <EmptyState
                icon={<BookOpen className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                title="No posts in this view"
                body="Switch views or create a new post to start building your blog."
                primaryAction={<Button onClick={startCreate}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />New post</Button>}
            />
        ) : (
            <Table columns={columns} rows={items} />
        )
    ), [columns, startCreate])

    const tabs = useMemo(() => (
        tabLabels.map((tab) => {
            const items = tab.value === 'all' ? posts : posts.filter((post) => post.status === tab.value)
            return {
                value: tab.value,
                label: tab.label,
                badge: String(items.length),
                content: renderPostTable(items),
            }
        })
    ), [posts, renderPostTable])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Blog posts"
                    description="Create, edit, and publish articles for your site."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Blog posts' }]}
                />
                <Card>
                    <Section title="Post list">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Blog posts"
                description="Create, edit, and publish articles for your site."
                breadcrumbs={[{ label: 'Content' }, { label: 'Blog posts' }]}
                primaryAction={{
                    label: 'New post',
                    onClick: startCreate,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadPosts(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Blog posts could not load"
                    action={<Button variant="secondary" onClick={() => void loadPosts()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <BookOpen className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total posts</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Published</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.published}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Drafts</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.drafts}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-critical-soft)] text-[var(--lb-color-critical)]">
                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Archived</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.archived}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            {showForm && (
                <Card>
                    <Section
                        title={editingId ? 'Edit post' : 'New post'}
                        description="Write the title, URL slug, excerpt, content, and publishing status."
                    >
                        {formError && (
                            <Banner variant="critical" title="Post could not be saved">
                                {formError}
                            </Banner>
                        )}

                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Post title"
                                placeholder="Launch notes"
                                value={formData.title}
                                onChange={(event) => updateForm('title', event.target.value)}
                            />
                            <Input
                                label="Slug"
                                placeholder="launch-notes"
                                value={formData.slug}
                                onChange={(event) => updateForm('slug', slugify(event.target.value))}
                                helperText={`Preview: /blog/${formData.slug || slugify(formData.title) || 'post-slug'}`}
                            />
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Excerpt"
                                    placeholder="A short summary shown on listing pages."
                                    value={formData.excerpt}
                                    onChange={(event) => updateForm('excerpt', event.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Textarea
                                    label="Content"
                                    placeholder="Write post content..."
                                    value={formData.content}
                                    onChange={(event) => updateForm('content', event.target.value)}
                                    rows={10}
                                    className="font-mono"
                                />
                            </div>
                            <Select
                                label="Status"
                                value={formData.status}
                                onChange={(event) => updateForm('status', event.target.value as PostStatus)}
                                options={statusOptions}
                            />
                        </div>

                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                loading={saving}
                                disabled={!formData.title.trim()}
                                onClick={() => void handleSave()}
                            >
                                {editingId ? 'Update post' : 'Create post'}
                            </Button>
                            <Button variant="secondary" onClick={discardForm} disabled={saving}>
                                Cancel
                            </Button>
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Post list"
                    description="Filter, edit, and archive blog content."
                >
                    {posts.length === 0 ? (
                        <EmptyState
                            icon={<BookOpen className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No blog posts yet"
                            body="Publish announcements, product stories, guides, or portfolio updates from one place."
                            primaryAction={<Button onClick={startCreate}><Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />New post</Button>}
                        />
                    ) : (
                        <Tabs
                            items={tabs}
                            value={filter}
                            onValueChange={(value) => setFilter(value as 'all' | PostStatus)}
                        />
                    )}
                </Section>
            </Card>

            {showForm && (
                <SaveBar
                    state={formSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={discardForm}
                    saveLabel={editingId ? 'Update post' : 'Create post'}
                />
            )}

            <ConfirmDialog
                open={Boolean(postToDelete)}
                title="Archive post?"
                description={postToDelete ? `This archives ${postToDelete.title} and removes it from active blog workflows.` : 'This archives the selected post.'}
                confirmLabel={deleting ? 'Archiving...' : 'Archive post'}
                destructive
                onClose={() => {
                    if (!deleting) setPostToDelete(null)
                }}
                onConfirm={() => void handleDelete()}
            />
        </Page>
    )
}
