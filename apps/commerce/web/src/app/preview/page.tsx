import PreviewContent, { type PreviewSearchParams } from './preview-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PreviewPage({ searchParams }: { searchParams?: Promise<PreviewSearchParams> }) {
    return <PreviewContent searchParams={searchParams} />;
}
