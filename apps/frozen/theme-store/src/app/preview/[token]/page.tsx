import type { Metadata } from 'next';
import AnonymousPreviewShell from '@/components/anonymous-preview-shell';
import { ThemeService } from '@/lib/theme-service';
import { getStorefrontUrl } from '@/lib/public-urls';

interface PreviewPageProps {
    params: Promise<{ token: string }>;
    searchParams?: Promise<{ theme?: string }>;
}

export const metadata: Metadata = {
    title: 'Theme sandbox preview',
    robots: { index: false, follow: false },
};

function stringValue(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

export default async function AnonymousPreviewPage({ params, searchParams }: PreviewPageProps) {
    const { token } = await params;
    const query = await searchParams;
    const slug = typeof query?.theme === 'string' ? query.theme : token;
    const record = slug ? await ThemeService.getThemeBySlug(slug) : null;
    const theme = record ? {
        slug: stringValue(record, 'slug', slug),
        name: stringValue(record, 'name', 'Sandbox theme preview'),
        description: stringValue(record, 'description', 'Preview a marketplace theme without selecting or owning a store.'),
        demo_url: Array.isArray(record.tags) && record.tags.includes('first-party')
            ? getStorefrontUrl(`/theme-preview/${encodeURIComponent(slug)}`) : stringValue(record, 'demo_url'),
        preview_url: stringValue(record, 'preview_url'),
    } : null;

    return <AnonymousPreviewShell token={token} theme={theme} />;
}
