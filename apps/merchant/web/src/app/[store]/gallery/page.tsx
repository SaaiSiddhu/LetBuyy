'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button,
    Badge,
    Banner,
    Card,
    ConfirmDialog,
    EmptyState,
    FileText,
    Image as ImageIcon,
    Page,
    PageHeader,
    RefreshCw,
    Section,
    Skeleton,
    Trash2,
    Upload,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'

interface MediaItem {
    id: string
    filename?: string | null
    original_name?: string | null
    url?: string | null
    mime_type?: string | null
    size_bytes?: number | null
    file_name?: string | null
    file_url?: string | null
    file_type?: string | null
    file_size?: number | null
    alt_text: string | null
    created_at: string
}

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

function fileNameFor(item: MediaItem) {
    return item.filename || item.original_name || item.file_name || 'Untitled file'
}

function fileUrlFor(item: MediaItem) {
    return item.url || item.file_url || ''
}

function fileTypeFor(item: MediaItem) {
    return item.mime_type || item.file_type || 'application/octet-stream'
}

function fileSizeFor(item: MediaItem) {
    return item.size_bytes ?? item.file_size ?? 0
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
}

function isImageType(type: string) {
    return type.startsWith('image/')
}

function mediaTypeLabel(type: string) {
    if (type.startsWith('image/')) return 'Image'
    if (type.startsWith('video/')) return 'Video'
    if (type.includes('pdf')) return 'PDF'
    if (type.startsWith('audio/')) return 'Audio'
    return 'File'
}

export default function GalleryPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [items, setItems] = useState<MediaItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [mediaToDelete, setMediaToDelete] = useState<MediaItem | null>(null)
    const [deleting, setDeleting] = useState(false)

    const beginRead = useReadRequest(store)
    const load = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/media?limit=100`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load media'))
            }

            setItems(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load media'
            setItems([])
            setLoadError(message)
            notify({
                title: 'Media could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void load()
    }, [load])

    const stats = useMemo(() => {
        const imageCount = items.filter((item) => isImageType(fileTypeFor(item))).length
        const totalBytes = items.reduce((total, item) => total + fileSizeFor(item), 0)
        return {
            total: items.length,
            images: imageCount,
            files: items.length - imageCount,
            storage: formatSize(totalBytes),
        }
    }, [items])

    const handleDelete = useCallback(async () => {
        if (!mediaToDelete || deleting) return

        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/media/${encodeURIComponent(mediaToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to delete media'))
            }

            notify({
                title: 'File deleted',
                description: `${fileNameFor(mediaToDelete)} was removed from the media library.`,
                variant: 'success',
            })
            setMediaToDelete(null)
            await load({ quiet: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete media'
            notify({
                title: 'Could not delete file',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeleting(false)
        }
    }, [deleting, load, mediaToDelete, notify, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Gallery"
                    description="Manage media assets used across products, content, and storefront sections."
                    breadcrumbs={[{ label: 'Content' }, { label: 'Gallery' }]}
                />
                <Card>
                    <Section title="Media library">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Gallery"
                description="Manage media assets used across products, content, and storefront sections."
                breadcrumbs={[{ label: 'Content' }, { label: 'Gallery' }]}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void load(),
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Media could not load"
                    action={<Button variant="secondary" onClick={() => void load()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Total files</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.total}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]">
                                <ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Images</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.images}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-info-soft)] text-[var(--lb-color-info)]">
                                <FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Other files</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.files}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section>
                        <div className="flex items-start gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]">
                                <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Storage listed</p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{stats.storage}</p>
                            </div>
                        </div>
                    </Section>
                </Card>
            </div>

            <Card>
                <Section
                    title="Media library"
                    description="Files uploaded through products, blog posts, and other sections appear here for review and cleanup."
                >
                    {items.length === 0 ? (
                        <EmptyState
                            icon={<ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No media yet"
                            body="Upload images, videos, and documents through products, posts, pages, or theme settings. They will appear in this library."
                            primaryAction={<Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Refresh</Button>}
                        />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {items.map((item) => {
                                const fileName = fileNameFor(item)
                                const fileUrl = fileUrlFor(item)
                                const fileType = fileTypeFor(item)
                                const fileSize = fileSizeFor(item)
                                const isImage = fileUrl && isImageType(fileType)

                                return (
                                    <article
                                        key={item.id}
                                        className="overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]"
                                    >
                                        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--lb-color-surface-subdued)]">
                                            {isImage ? (
                                                <Image
                                                    src={fileUrl}
                                                    alt={item.alt_text || fileName}
                                                    fill
                                                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <FileText className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-text-subdued)]" aria-hidden="true" />
                                            )}
                                        </div>
                                        <div className="space-y-[var(--lb-space-3)] p-[var(--lb-space-3)]">
                                            <div className="min-w-0 space-y-[var(--lb-space-1)]">
                                                <h3 className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]" title={fileName}>
                                                    {fileName}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    <span>{formatSize(fileSize)}</span>
                                                    <span aria-hidden="true">/</span>
                                                    <span>{formatDate(item.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                                                <Badge label={mediaTypeLabel(fileType)} variant={isImageType(fileType) ? 'success' : 'default'} />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setMediaToDelete(item)}
                                                    disabled={deleting}
                                                >
                                                    <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </Section>
            </Card>

            <ConfirmDialog
                open={Boolean(mediaToDelete)}
                title="Delete file?"
                description={mediaToDelete ? `This permanently removes ${fileNameFor(mediaToDelete)} from the media library.` : 'This permanently removes the selected file from the media library.'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete file'}
                destructive
                onClose={() => {
                    if (!deleting) setMediaToDelete(null)
                }}
                onConfirm={() => void handleDelete()}
            />
        </Page>
    )
}
