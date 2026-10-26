import { Eye, Page, PageContent, PageHeader } from '@letbuyy/ui';
import ThemeDemo from './theme-demo';
import type { Theme } from '@letbuyy/theme-engine';
import { ThemeBundlePackageMetadataSchema } from '@letbuyy/theme-engine';
import { getStorefrontUrl } from '@/lib/public-urls';

interface AnonymousPreviewShellProps {
    token: string;
    theme?: Pick<Theme, 'slug' | 'name' | 'description' | 'demo_url' | 'preview_url' | 'version'> & { demoAvailable?: boolean } | null;
}

export function getAnonymousPreviewFrameSrc(_token: string, theme?: AnonymousPreviewShellProps['theme']) {
    // Current anonymous links carry a catalog slug, not draft-preview authority.
    // Never echo/use a caller token or accept an arbitrary catalog-controlled frame origin.
    if (theme?.demoAvailable === false) return null;
    if (!theme?.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme.slug) || theme.slug.length > 120) return null;
    const version = ThemeBundlePackageMetadataSchema.shape.version.safeParse(theme.version);
    if (!version.success || version.data !== version.data.trim() || /[\u0000-\u001f\u007f]/.test(version.data)) return null;
    return getStorefrontUrl(`/theme-preview/${encodeURIComponent(theme.slug)}?version=${encodeURIComponent(version.data)}&embedded=1`);
}

export default function AnonymousPreviewShell({ token, theme }: AnonymousPreviewShellProps) {
    const frameSrc = getAnonymousPreviewFrameSrc(token, theme);
    const themeName = theme?.name || 'Sandbox theme preview';
    const detailsHref = theme?.slug ? `/themes/${encodeURIComponent(theme.slug)}` : '/themes';

    return (
        <Page className="theme-marketplace-page marketplace">
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
                <ThemeDemo src={frameSrc} name={themeName} anonymous />
            </PageContent>
        </Page>
    );
}
