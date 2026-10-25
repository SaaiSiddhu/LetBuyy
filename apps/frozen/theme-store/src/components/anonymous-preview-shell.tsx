import { Card, ExternalLink, Eye, Page, PageContent, PageHeader } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { ThemeBundlePackageMetadataSchema } from '@letbuyy/theme-engine';
import { getStorefrontUrl } from '@/lib/public-urls';

interface AnonymousPreviewShellProps {
    token: string;
    theme?: Pick<Theme, 'slug' | 'name' | 'description' | 'demo_url' | 'preview_url' | 'version'> | null;
}

export function getAnonymousPreviewFrameSrc(_token: string, theme?: AnonymousPreviewShellProps['theme']) {
    // Current anonymous links carry a catalog slug, not draft-preview authority.
    // Never echo/use a caller token or accept an arbitrary catalog-controlled frame origin.
    if (!theme?.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme.slug) || theme.slug.length > 120) return null;
    const version = ThemeBundlePackageMetadataSchema.shape.version.safeParse(theme.version);
    if (!version.success || version.data !== version.data.trim() || /[\u0000-\u001f\u007f]/.test(version.data)) return null;
    return getStorefrontUrl(`/theme-preview/${encodeURIComponent(theme.slug)}?version=${encodeURIComponent(version.data)}`);
}

export default function AnonymousPreviewShell({ token, theme }: AnonymousPreviewShellProps) {
    const frameSrc = getAnonymousPreviewFrameSrc(token, theme);
    const themeName = theme?.name || 'Sandbox theme preview';
    const detailsHref = theme?.slug ? `/themes/${encodeURIComponent(theme.slug)}` : '/themes';

    return (
        <Page className="theme-marketplace-page">
            <PageHeader
                title={themeName}
                eyebrow="Anonymous sandbox"
                description={theme?.description || 'Preview a marketplace theme without selecting or owning a store.'}
                identity="themes"
                showEyebrow
                showDescription
                showBreadcrumbs
                breadcrumbs={[
                    { label: 'Themes', href: '/themes' },
                    { label: 'Sandbox preview' },
                ]}
                primaryAction={{
                    label: 'View listing',
                    href: detailsHref,
                    icon: <Eye aria-hidden="true" />,
                }}
            />
            <PageContent>
                <Card className="overflow-hidden">
                    <div className="flex items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        <div>
                            <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                Sandbox store preview
                            </p>
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                Public sample content. Your store is unchanged.
                            </p>
                        </div>
                        {frameSrc && <a
                            href={frameSrc}
                            referrerPolicy="no-referrer"
                            className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                        >
                            <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Open frame
                        </a>}
                    </div>
                    {frameSrc ? <iframe
                        title={`${themeName} anonymous sandbox preview`}
                        src={frameSrc}
                        className="h-[calc(100dvh-260px)] min-h-[520px] w-full border-0 bg-[var(--lb-color-surface-subdued)]"
                        loading="lazy"
                        sandbox="allow-same-origin allow-scripts allow-forms"
                        referrerPolicy="no-referrer"
                        data-testid="anonymous-preview-iframe"
                    /> : <div role="status" className="p-[var(--lb-space-5)]"><h2>Demo unavailable</h2><p>Choose an available theme listing to open its public sample store.</p></div>}
                </Card>
            </PageContent>
        </Page>
    );
}
