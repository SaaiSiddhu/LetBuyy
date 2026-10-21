import ComingSoonPreviewContent from './coming-soon-client';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ComingSoonPreview({ searchParams }: Props) {
    // A rewrite keeps the browser URL unchanged. Resolve its destination query
    // on the server; a client useSearchParams() sees the original browser URL.
    const query = await searchParams;
    const scalar = (key: string) => typeof query[key] === 'string' ? query[key] as string : null;
    return <ComingSoonPreviewContent reason={scalar('reason')} message={scalar('message')} storeName={scalar('store')} />;
}
