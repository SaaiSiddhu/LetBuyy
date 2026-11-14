import { Card, ExternalLink, Eye, Page, PageContent, PageHeader } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';

interface AnonymousPreviewShellProps {
    token: string;
    theme?: Pick<Theme, 'slug' | 'name' | 'description' | 'demo_url' | 'preview_url'> | null;
}

export function getAnonymousPreviewFrameSrc(token: string, theme?: AnonymousPreviewShellProps['theme']) {
    if (theme?.demo_url) return theme.demo_url;
    if (theme?.preview_url) return theme.preview_url;
    return `/api/preview/sandbox?token=${encodeURIComponent(token)}`;
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
                                Token: {token}
                            </p>
                        </div>
                        <a
                            href={frameSrc}
                            className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                        >
                            <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Open frame
                        </a>
                    </div>
                    <iframe
                        title={`${themeName} anonymous sandbox preview`}
                        src={frameSrc}
                        className="h-[calc(100dvh-260px)] min-h-[520px] w-full border-0 bg-[var(--lb-color-surface-subdued)]"
                        loading="lazy"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        data-testid="anonymous-preview-iframe"
                    />
                </Card>
            </PageContent>
        </Page>
    );
}
