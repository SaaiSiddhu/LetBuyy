import Link from 'next/link';
import { MerchantReadinessPanel } from '@/components/MerchantReadinessPanel';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Button, Input, Select } from '@letbuyy/ui';
import {
    OrderStatusSchema,
    ProductStatusSchema,
    ORDER_STATUS_PRESENTATION,
} from '@letbuyy/shared-types';
import type {
    InternalMerchantOperationsSnapshot,
    InternalMerchantCatalogRow,
    InternalMerchantOrderRow,
    InternalMerchantOrderLine,
    StoreHealth,
} from '@letbuyy/shared-types';
import {
    ConsoleWorkspace,
    Panel,
    MetricGrid,
    LeadershipMetric,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import {
    ConsoleDataTable,
    ConsoleApiErrorPanel,
    type ConsoleDataColumn,
} from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    readPageParam,
    readSearchParam,
    formatDateTime,
    formatMoneyFromPaise,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
    type ConsolePagination,
} from '@/lib/console-api';

type Props = {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Detail = {
    order: InternalMerchantOrderRow;
    items: InternalMerchantOrderLine[];
    item_meta: ConsolePagination;
};
export default async function MerchantOperationsPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) notFound();
    const query = await searchParams,
        view =
            readSearchParam(query, 'view') === 'orders' ? 'orders' : 'products';
    const q = readSearchParam(query, 'q'),
        status = readSearchParam(query, 'status'),
        page = readPageParam(query);
    const orderId = readSearchParam(query, 'order');
    if (orderId && !z.string().uuid().safeParse(orderId).success) notFound();
    const base = `/merchants/${id}/operations`,
        api = `/internal/console/merchants/${id}/operations`;
    const [snapshot, list, detail, health] = await Promise.all([
        fetchConsoleApi<
            ConsoleDataResponse<InternalMerchantOperationsSnapshot>
        >(api),
        fetchConsoleApi<
            ConsolePaginatedResponse<
                InternalMerchantCatalogRow | InternalMerchantOrderRow
            >
        >(api + '/' + view, { query: { q, status, page, limit: 25 } }),
        orderId
            ? fetchConsoleApi<ConsoleDataResponse<Detail>>(
                  api + '/orders/' + orderId,
                  {
                      query: {
                          page: readPageParam({
                              page: readSearchParam(query, 'item_page'),
                          }),
                          limit: 25,
                      },
                  },
              )
            : Promise.resolve(null),
        fetchConsoleApi<ConsoleDataResponse<StoreHealth>>(api + '/health'),
    ]);
    const data = snapshot.data?.data;
    const columns: ConsoleDataColumn<
        InternalMerchantCatalogRow | InternalMerchantOrderRow
    >[] =
        view === 'products'
            ? [
                  {
                      key: 'name',
                      header: 'Product',
                      cell: (r) => (
                          <>
                              <strong>
                                  {(r as InternalMerchantCatalogRow).name}
                              </strong>
                              <p className="text-xs text-subdued">{r.id}</p>
                          </>
                      ),
                  },
                  {
                      key: 'sku',
                      header: 'SKU',
                      cell: (r) => (r as InternalMerchantCatalogRow).sku || '—',
                  },
                  {
                      key: 'price',
                      header: 'Catalog price',
                      cell: (r) =>
                          formatMoneyFromPaise(
                              (r as InternalMerchantCatalogRow).price * 100,
                              data?.site.currency || 'INR',
                          ),
                  },
                  {
                      key: 'status',
                      header: 'Status',
                      cell: (r) => (
                          <StatusPill
                              value={(r as InternalMerchantCatalogRow).status}
                          />
                      ),
                  },
                  {
                      key: 'updated',
                      header: 'Updated',
                      cell: (r) => formatDateTime(r.updated_at),
                  },
              ]
            : [
                  {
                      key: 'order',
                      header: 'Order',
                      cell: (r) => (
                          <Link
                              className="font-medium underline underline-offset-4"
                              href={
                                  base +
                                  '?' +
                                  new URLSearchParams({
                                      view: 'orders',
                                      q,
                                      status,
                                      page: String(page),
                                      order: r.id,
                                  })
                              }
                          >
                              {(r as InternalMerchantOrderRow).order_number ||
                                  r.id}
                          </Link>
                      ),
                  },
                  {
                      key: 'status',
                      header: 'Status',
                      cell: (r) => (
                          <StatusPill
                              value={(r as InternalMerchantOrderRow).status}
                          />
                      ),
                  },
                  {
                      key: 'payment',
                      header: 'Payment',
                      cell: (r) => (
                          <StatusPill
                              value={
                                  (r as InternalMerchantOrderRow).payment_status
                              }
                          />
                      ),
                  },
                  {
                      key: 'total',
                      header: 'Order total',
                      cell: (r) => {
                          const o = r as InternalMerchantOrderRow;
                          return formatMoneyFromPaise(
                              o.total * 100,
                              o.currency,
                          );
                      },
                  },
                  {
                      key: 'created',
                      header: 'Placed',
                      cell: (r) =>
                          formatDateTime(
                              (r as InternalMerchantOrderRow).created_at,
                          ),
                  },
              ];
    return (
        <ConsoleWorkspace
            eyebrow="Merchant operations"
            title={
                data?.site.store_name || data?.site.name || 'Merchant workspace'
            }
            description="Review store readiness, effective SaaS limits, catalog and order evidence."
        >
            <nav
                aria-label="Merchant workspaces"
                className="flex flex-wrap gap-[var(--lb-space-3)]"
            >
                <Link className="underline" href={`/merchants/${id}`}>
                    Owner and protected controls
                </Link>
                <Link className="underline" href={`/support?site_id=${id}`}>
                    Support tickets
                </Link>
                <Link
                    className="underline"
                    href={`/trust-safety?site_id=${id}`}
                >
                    Safety cases
                </Link>
            </nav>
            <MerchantReadinessPanel id={id} health={health.data?.data || null} error={health.error} />
            {snapshot.error && (
                <ConsoleApiErrorPanel
                    title="Merchant summary unavailable"
                    message={snapshot.error}
                />
            )}
            {data && (
                <>
                    <MetricGrid>
                        <LeadershipMetric
                            label="Store status"
                            value={data.site.status}
                            detail={
                                data.site.published
                                    ? 'Published flag on'
                                    : 'Published flag off'
                            }
                            tone={
                                data.site.status === 'suspended'
                                    ? 'critical'
                                    : 'neutral'
                            }
                        />
                        <LeadershipMetric
                            label="Products"
                            value={
                                data.counts.products === null
                                    ? 'Unavailable'
                                    : String(data.counts.products)
                            }
                            detail="All undeleted products"
                        />
                        <LeadershipMetric
                            label="Orders"
                            value={
                                data.counts.orders === null
                                    ? 'Unavailable'
                                    : String(data.counts.orders)
                            }
                            detail="All undeleted orders"
                        />
                        <LeadershipMetric
                            label="Effective plan"
                            value={
                                data.saas.authority === 'persisted'
                                    ? data.saas.plan
                                    : 'Unavailable'
                            }
                            detail={data.site.site_type}
                        />
                    </MetricGrid>
                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                        <Panel
                            title="SaaS access and limits"
                            description={`Observed ${formatDateTime(data.observed_at)}. Limits come from the same authority used by merchant creation checks.`}
                        >
                            {data.saas.authority === 'unavailable' ? (
                                <p role="status">
                                    Effective SaaS permissions are unavailable.
                                    No plan grant is inferred.
                                </p>
                            ) : (
                                <>
                                    <p>
                                        Plan: <strong>{data.saas.plan}</strong>
                                    </p>
                                    <p>
                                        Trial:{' '}
                                        {data.site.trial_status ||
                                            'Not recorded'}{' '}
                                        · ends{' '}
                                        {formatDateTime(
                                            data.site.trial_ends_at,
                                        )}
                                    </p>
                                    <dl className="mt-[var(--lb-space-3)] grid gap-[var(--lb-space-2)] sm:grid-cols-2">
                                        {Object.entries(data.saas.limits).map(
                                            ([key, value]) => (
                                                <div key={key}>
                                                    <dt className="text-sm text-subdued">
                                                        {key.replace(/_/g, ' ')}
                                                    </dt>
                                                    <dd className="font-medium">
                                                        {value === null
                                                            ? 'No limit'
                                                            : typeof value ===
                                                                'object'
                                                              ? JSON.stringify(
                                                                    value,
                                                                )
                                                              : String(value)}
                                                    </dd>
                                                </div>
                                            ),
                                        )}
                                    </dl>
                                    <p className="mt-[var(--lb-space-3)] text-sm">
                                        Enabled features:{' '}
                                        {data.saas.features.join(', ') ||
                                            'None returned'}
                                    </p>
                                </>
                            )}
                            <p className="mt-[var(--lb-space-4)] text-sm text-subdued">
                                Paid access follows verified subscription
                                payments. This workspace does not grant plans or
                                change invoices.
                            </p>
                            {data.counts.products !== null &&
                                typeof data.saas.limits.products === 'number' &&
                                data.counts.products >
                                    data.saas.limits.products && (
                                    <p
                                        role="status"
                                        className="mt-[var(--lb-space-3)] text-sm"
                                    >
                                        Catalog count exceeds the effective
                                        product limit. Review this with the
                                        merchant.
                                    </p>
                                )}
                        </Panel>
                        <Panel
                            title="Verification and current usage"
                            description="Up to 25 recent KYC status records and 50 current-period usage meters. Private documents are excluded."
                        >
                            {data.unavailable.includes('verification') ? (
                                <p>Verification status unavailable.</p>
                            ) : data.verification.length ? (
                                <ul className="space-y-[var(--lb-space-2)]">
                                    {data.verification.map((v, i) => (
                                        <li key={i}>
                                            {v.document_type.replace(/_/g, ' ')}{' '}
                                            · <strong>{v.status}</strong> ·{' '}
                                            {v.provider_mode} ·{' '}
                                            {formatDateTime(v.updated_at)}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No KYC document status recorded.</p>
                            )}
                            {data.unavailable.includes('usage') ? (
                                <p>Current usage unavailable.</p>
                            ) : data.usage.length ? (
                                <ul className="mt-[var(--lb-space-4)] space-y-[var(--lb-space-2)]">
                                    {data.usage.map((u) => (
                                        <li key={u.id}>
                                            {u.meter_name}:{' '}
                                            <strong>{u.quantity}</strong>
                                            {u.limit_quantity !== null
                                                ? ` / ${u.limit_quantity}`
                                                : ''}
                                            <p className="text-xs text-subdued">
                                                {formatDateTime(u.period_start)}{' '}
                                                – {formatDateTime(u.period_end)}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-[var(--lb-space-4)]">
                                    No current-period usage meter recorded.
                                </p>
                            )}
                        </Panel>
                    </section>
                </>
            )}
            <Panel
                title="Commerce evidence"
                description="Store-scoped records. Orders retain their original item snapshots; customer contact and address data are excluded."
            >
                <nav
                    aria-label="Commerce records"
                    className="console-view-tabs mb-[var(--lb-space-4)] flex gap-[var(--lb-space-3)]"
                >
                    <Link
                        className="underline"
                        aria-current={view === 'products' ? 'page' : undefined}
                        href={base + '?view=products'}
                    >
                        Products
                    </Link>
                    <Link
                        className="underline"
                        aria-current={view === 'orders' ? 'page' : undefined}
                        href={base + '?view=orders'}
                    >
                        Orders
                    </Link>
                </nav>
                <form className="console-filterbar mb-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] sm:grid-cols-[1fr_1fr_auto]">
                    <Input unstyled type="hidden" name="view" value={view} />
                    <Input
                        name="q"
                        label={
                            view === 'products'
                                ? 'Product name'
                                : 'Order number'
                        }
                        defaultValue={q}
                        maxLength={100}
                    />
                    <Select
                        name="status"
                        label="Status"
                        defaultValue={status}
                        options={[
                            { value: '', label: 'All statuses' },
                            ...(view === 'products'
                                ? ProductStatusSchema.options.map((value) => ({
                                      value,
                                      label: value.charAt(0).toUpperCase() + value.slice(1),
                                  }))
                                : OrderStatusSchema.options.map((value) => ({
                                      value,
                                      label: ORDER_STATUS_PRESENTATION[value].label,
                                  }))),
                        ]}
                    />
                    <Button type="submit" className="self-end">
                        Apply filters
                    </Button>
                </form>
                {list.error ? (
                    <ConsoleApiErrorPanel
                        title="Commerce records unavailable"
                        message={list.error}
                    />
                ) : (
                    list.data && (
                        <ConsoleDataTable
                            columns={columns}
                            rows={list.data.data}
                            meta={list.data.meta}
                            basePath={base}
                            query={{ view, q, status }}
                            emptyLabel="No records match this store and the applied filters."
                            getRowKey={(r) => r.id}
                        />
                    )
                )}
            </Panel>
            {detail?.error && (
                <ConsoleApiErrorPanel
                    title="Order snapshot unavailable"
                    message={detail.error}
                />
            )}
            {detail?.data?.data && (
                <Panel
                    title={`Order ${detail.data.data.order.order_number || orderId}`}
                    description="Original order item snapshot. Catalog edits do not change these values."
                >
                    <ConsoleDataTable<InternalMerchantOrderLine>
                        columns={[
                            {
                                key: 'name',
                                header: 'Item',
                                cell: (r) => r.name,
                            },
                            {
                                key: 'sku',
                                header: 'SKU',
                                cell: (r) => r.sku || '—',
                            },
                            {
                                key: 'quantity',
                                header: 'Quantity',
                                cell: (r) => r.quantity,
                            },
                            {
                                key: 'unit',
                                header: 'Unit price',
                                cell: (r) =>
                                    formatMoneyFromPaise(
                                        r.unit_price * 100,
                                        detail.data!.data.order.currency,
                                    ),
                            },
                            {
                                key: 'total',
                                header: 'Line total',
                                cell: (r) =>
                                    formatMoneyFromPaise(
                                        r.total * 100,
                                        detail.data!.data.order.currency,
                                    ),
                            },
                        ]}
                        rows={detail.data.data.items}
                        basePath={base}
                        query={{ view: 'orders', order: orderId }}
                        getRowKey={(r) => r.id || r.name}
                        emptyLabel="No item snapshot rows were returned."
                    />
                    <div className="mt-[var(--lb-space-3)] flex flex-wrap gap-[var(--lb-space-3)]">
                        {detail.data.data.item_meta.has_prev && (
                            <Link
                                className="underline"
                                href={
                                    base +
                                    '?' +
                                    new URLSearchParams({
                                        view: 'orders',
                                        q,
                                        status,
                                        page: String(page),
                                        order: orderId,
                                        item_page: String(
                                            detail.data.data.item_meta.page - 1,
                                        ),
                                    })
                                }
                            >
                                Previous item page
                            </Link>
                        )}
                        {detail.data.data.item_meta.has_next && (
                            <Link
                                className="underline"
                                href={
                                    base +
                                    '?' +
                                    new URLSearchParams({
                                        view: 'orders',
                                        q,
                                        status,
                                        page: String(page),
                                        order: orderId,
                                        item_page: String(
                                            detail.data.data.item_meta.page + 1,
                                        ),
                                    })
                                }
                            >
                                Next item page
                            </Link>
                        )}
                    </div>
                </Panel>
            )}
        </ConsoleWorkspace>
    );
}
