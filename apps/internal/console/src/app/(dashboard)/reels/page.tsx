import Link from 'next/link';
import type { ReelReviewPage } from '@letbuyy/api-client';
import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';
import { fetchConsoleApi } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

export default async function ReelQueue({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    await requireConsoleSession();
    const raw = Number((await searchParams).page ?? 1), page = Number.isInteger(raw) && raw > 0 && raw <= 10000 ? raw : 1;
    const result = await fetchConsoleApi<{ data: ReelReviewPage }>('/internal/console/reels', { query: { page } });
    const data = result.data?.data;
    return <ConsoleWorkspace eyebrow="Marketplace" title="Private reel reviews" description="Review exact private revisions. Processing completion is not human approval.">
        <Panel title="Review queue">
            {result.error || !data ? <><p role="alert">{result.error || 'Queue unavailable.'}</p><Link href={`/reels?page=${page}`}>Retry queue</Link></>
                : <>{data.items.length === 0 ? <p>No reel submissions.</p> : data.items.slice(0, 20).map((item: ReelReviewPage['items'][number]) => <p key={item.id}><Link href={`/reels/${item.id}`}>{item.status} · version {item.version} · {item.id}</Link></p>)}
                    {page > 1 && <Link href={`/reels?page=${page - 1}`}>Previous page</Link>}{data.has_more && <Link href={`/reels?page=${page + 1}`}>Next page</Link>}</>}
        </Panel>
    </ConsoleWorkspace>;
}
