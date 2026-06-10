import Link from 'next/link';
import type { InternalMerchantSearchResponse, InternalMerchantSearchResult } from '@letbuyy/api-client';
import {
    ConsoleWorkspace,
    EmptyDataState,
    Panel,
} from '@/components/_local-ui/console-workspace';
import {
    ConsoleApiErrorPanel,
    ConsoleDataTable,
    ConsoleSearchForm,
    StatusBadge,
    type ConsoleDataColumn,
} from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    readPageParam,
    readSearchParam,
    type ConsoleDataResponse,
} from '@/lib/console-api';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const columns: Array<ConsoleDataColumn<InternalMerchantSearchResult>> = [
    {
        key: 'merchant',
        header: 'Merchant',
        cell: (row) => (
            <div className="min-w-0">
                <Link
                    href={`/merchants/${row.id}`}
                    className="font-medium text-zinc-100 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                >
                    {row.store_name || row.name || row.subdomain || row.id}
                </Link>
                <p className="mt-1 truncate text-xs text-zinc-500">
                    {row.custom_domain || (row.subdomain ? `${row.subdomain}.letbuyy.com` : row.id)}
                </p>
            </div>
        ),
    },
    {
        key: 'type',
        header: 'Type',
        cell: (row) => row.site_type || 'ecommerce',
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge value={row.status || 'draft'} />,
    },
    {
        key: 'views',
        header: 'Views',
        cell: (row) => Number(row.views_count || 0).toLocaleString('en-IN'),
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function MerchantsPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q').trim();
    const page = readPageParam(params);
    const result = q
        ? await fetchConsoleApi<ConsoleDataResponse<InternalMerchantSearchResponse>>('/internal/console/merchants/search', {
            q,
            page,
            limit: 25,
        })
        : null;
    const rows = result?.data?.data.results || [];

    return (
        <ConsoleWorkspace
            eyebrow="Merchant operations"
            title="Merchant 360"
            description="Find a merchant by store id, merchant id, owner email, name, subdomain, or custom domain."
        >
            <Panel title="Search" description="Search returns governed site records and opens the audited Merchant 360 view.">
                <ConsoleSearchForm placeholder="Search merchant, email, domain, or store id..." defaultValue={q} />
            </Panel>

            {!q ? (
                <EmptyDataState message="Enter a merchant, email, domain, or store id to begin." />
            ) : result?.error ? (
                <ConsoleApiErrorPanel title="Merchant search API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={rows}
                    basePath="/merchants"
                    query={{ q }}
                    emptyLabel="No merchants matched that search."
                    getRowKey={(row) => row.id}
                />
            )}
        </ConsoleWorkspace>
    );
}
