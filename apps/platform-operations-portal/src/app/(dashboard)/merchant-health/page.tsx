import type { LetbuyyApiClient } from '@letbuyy/api-client';
import type {
    Order,
    Product,
    ShippingZone,
    Store,
    StorePaymentConfig,
    StoreSummary,
} from '@letbuyy/shared-types';
import {
    Banner,
    Button,
    Card,
    Chart,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
} from '@letbuyy/ui';
import { createPlatformOperationsApiClient } from '../../../lib/api/client';
import { MerchantHealthIndexTable } from './MerchantHealthIndexTable';

type SearchParamValue = string | string[] | undefined;

interface MerchantHealthPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

type HealthBand = 'healthy' | 'watch' | 'at_risk';

export interface MerchantHealthRow {
    id: string;
    storeName: string;
    subdomain: string;
    siteType: string;
    statusLabel: string;
    score: number;
    band: HealthBand;
    bandLabel: string;
    productLabel: string;
    orderLabel: string;
    themeLabel: string;
    paymentLabel: string;
    shippingLabel: string;
    issues: string[];
}

interface HealthSignal {
    label: string;
    weight: number;
    passed: boolean;
    detail: string;
    issue: string;
}

interface SafeRead<T> {
    data: T | null;
    error: string | null;
}

interface HealthLoadResult {
    rows: MerchantHealthRow[];
    totalStores: number;
    loadError: string | null;
}

const HEALTH_FILTER_OPTIONS = [
    { label: 'All health', value: 'all' },
    { label: 'Healthy', value: 'healthy' },
    { label: 'Watch', value: 'watch' },
    { label: 'At risk', value: 'at_risk' },
];

export default async function MerchantHealthPage({ searchParams }: MerchantHealthPageProps) {
    const params = searchParams ? await searchParams : {};
    const query = firstParam(params.q).trim();
    const healthFilter = normalizeHealthFilter(firstParam(params.health));
    const result = await loadMerchantHealth();
    const visibleRows = applyFilters(result.rows, query, healthFilter);
    const summary = summarizeHealth(result.rows);

    return (
        <Page>
            <PageHeader
                title="Merchant Health"
                description="Derived readiness scores for products, orders, themes, payments, and shipping from the existing merchant-owned APIs."
                iconName="monitoring"
                showDescription
                secondaryActions={[
                    { label: 'Stores', href: '/stores' },
                    { label: 'Operations', href: '/operations' },
                ]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Average health"
                        value={`${summary.averageScore}%`}
                        delta={`${summary.scoredStores} scored stores`}
                        deltaTone={summary.averageScore >= 80 ? 'positive' : summary.averageScore >= 55 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Healthy stores"
                        value={summary.healthy.toLocaleString('en-IN')}
                        delta="80 percent or above"
                        deltaTone="positive"
                    />
                    <MetricCard
                        label="Needs review"
                        value={(summary.watch + summary.atRisk).toLocaleString('en-IN')}
                        delta="Watch plus at-risk"
                        deltaTone={summary.watch + summary.atRisk > 0 ? 'negative' : 'positive'}
                    />
                    <MetricCard
                        label="Payment ready"
                        value={summary.paymentReady.toLocaleString('en-IN')}
                        delta={`${result.totalStores.toLocaleString('en-IN')} stores sampled`}
                        deltaTone={summary.paymentReady === result.totalStores && result.totalStores > 0 ? 'positive' : 'neutral'}
                    />
                </div>

                <Banner title="Merchant Health backend required" variant="warning">
                    Current portal data is derived from the authenticated merchant store list and per-store product, order, theme,
                    payment, and shipping endpoints. Full employee operations queues need a platform-wide health API with all merchants,
                    owner/contact context, SLA state, latest interaction, assigned operator, risk reasons, and server-computed scores.
                </Banner>

                {result.loadError ? (
                    <Banner title="Unable to load merchant health" variant="critical">
                        {result.loadError}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <Card>
                        <Section
                            title="Health distribution"
                            description="Score bands from the currently visible merchant-owned store sample."
                        >
                            <Chart
                                ariaLabel="Merchant health distribution"
                                data={[
                                    { label: 'Healthy', value: summary.healthy },
                                    { label: 'Watch', value: summary.watch },
                                    { label: 'At risk', value: summary.atRisk },
                                ]}
                                type="bar"
                                height="md"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Scoring model"
                            description="Weights stay local until the operations backend exposes authoritative health scores."
                        >
                            <div className="grid gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                <ScoreModelRow label="Products ready" value="25%" />
                                <ScoreModelRow label="Order activity" value="20%" />
                                <ScoreModelRow label="Theme selected or published" value="20%" />
                                <ScoreModelRow label="Payments configured" value="25%" />
                                <ScoreModelRow label="Shipping zones" value="10%" />
                            </div>
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Health filters" description="Filter the locally derived store sample.">
                        <form action="/merchant-health" method="get">
                            <FilterBar
                                search={
                                    <Input
                                        label="Search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Store name or subdomain"
                                    />
                                }
                                filters={
                                    <Select
                                        label="Health"
                                        name="health"
                                        defaultValue={healthFilter}
                                        options={HEALTH_FILTER_OPTIONS}
                                    />
                                }
                                actions={<Button type="submit">Search</Button>}
                            />
                        </form>
                    </Section>
                </Card>

                <MerchantHealthIndexTable rows={visibleRows} />

                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Showing {visibleRows.length.toLocaleString('en-IN')} of {result.rows.length.toLocaleString('en-IN')} scored rows from the first {result.totalStores.toLocaleString('en-IN')} stores available to this session.
                </p>
            </PageContent>
        </Page>
    );
}

function ScoreModelRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
            <span>{label}</span>
            <span className="font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{value}</span>
        </div>
    );
}

async function loadMerchantHealth(): Promise<HealthLoadResult> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const stores = await api.stores.list({ limit: 50 });
        const rows = await Promise.all(stores.data.map((store) => buildHealthRow(api, store)));

        return {
            rows,
            totalStores: stores.total,
            loadError: null,
        };
    } catch (error) {
        return {
            rows: [],
            totalStores: 0,
            loadError: error instanceof Error ? error.message : 'Unable to load merchant health',
        };
    }
}

async function buildHealthRow(api: LetbuyyApiClient, summary: StoreSummary): Promise<MerchantHealthRow> {
    const [detailResult, productResult, orderResult, paymentResult, shippingResult] = await Promise.all([
        safeRead(() => api.stores.get(summary.id)),
        safeRead(() => api.products.list({ store_id: summary.id, limit: 100 })),
        safeRead(() => api.orders.list({ store_id: summary.id, limit: 100 })),
        safeRead(() => api.stores.paymentConfig.get(summary.id)),
        safeRead(() => api.shipping.zones.list({ store_id: summary.id })),
    ]);

    const detail = detailResult.data;
    const products = productResult.data?.data ?? [];
    const orders = orderResult.data?.data ?? [];
    const payment = paymentResult.data;
    const shippingZones = shippingResult.data ?? [];
    const status = detail?.status ?? summary.status;
    const signals = buildSignals({
        detail,
        products,
        productTotal: productResult.data?.total ?? products.length,
        productError: productResult.error,
        orders,
        orderTotal: orderResult.data?.total ?? orders.length,
        orderError: orderResult.error,
        payment,
        paymentError: paymentResult.error,
        shippingZones,
        shippingError: shippingResult.error,
    });
    const rawScore = signals.reduce((score, signal) => score + (signal.passed ? signal.weight : 0), 0);
    const score = status === 'frozen' || status === 'suspended' ? Math.min(rawScore, 35) : rawScore;
    const band = getHealthBand(score);

    return {
        id: summary.id,
        storeName: summary.store_name || detail?.name || summary.name,
        subdomain: summary.subdomain,
        siteType: formatLabel(detail?.site_type ?? summary.site_type),
        statusLabel: formatLabel(status),
        score,
        band,
        bandLabel: band === 'healthy' ? 'Healthy' : band === 'watch' ? 'Watch' : 'At risk',
        productLabel: signals[0]?.detail ?? 'Products unavailable',
        orderLabel: signals[1]?.detail ?? 'Orders unavailable',
        themeLabel: signals[2]?.detail ?? 'Theme unavailable',
        paymentLabel: signals[3]?.detail ?? 'Payments unavailable',
        shippingLabel: signals[4]?.detail ?? 'Shipping unavailable',
        issues: signals.filter((signal) => !signal.passed).map((signal) => signal.issue),
    };
}

function buildSignals(input: {
    detail: Store | null;
    products: Product[];
    productTotal: number;
    productError: string | null;
    orders: Order[];
    orderTotal: number;
    orderError: string | null;
    payment: StorePaymentConfig | null;
    paymentError: string | null;
    shippingZones: ShippingZone[];
    shippingError: string | null;
}): HealthSignal[] {
    const activeProducts = input.products.filter((product) => product.status === 'active' || product.is_active).length;
    const paidOrders = input.orders.filter((order) => order.payment_status === 'paid').length;
    const openOrders = input.orders.filter((order) => ['pending', 'pending_cod', 'confirmed', 'processing'].includes(order.status)).length;
    const hasTheme = Boolean(input.detail?.theme_id || input.detail?.current_theme_release_id || input.detail?.published_at);
    const paymentReady = Boolean(input.payment && (input.payment.online_payment_enabled !== false || input.payment.cod_enabled));
    const shippingReady = input.shippingZones.length > 0;

    return [
        {
            label: 'Products',
            weight: 25,
            passed: !input.productError && activeProducts > 0,
            detail: input.productError || `${activeProducts.toLocaleString('en-IN')} active of ${input.productTotal.toLocaleString('en-IN')} products`,
            issue: input.productError ? 'product data unavailable' : 'no active products',
        },
        {
            label: 'Orders',
            weight: 20,
            passed: !input.orderError && input.orderTotal > 0,
            detail: input.orderError || `${input.orderTotal.toLocaleString('en-IN')} orders, ${paidOrders.toLocaleString('en-IN')} paid, ${openOrders.toLocaleString('en-IN')} open`,
            issue: input.orderError ? 'order data unavailable' : 'no order activity',
        },
        {
            label: 'Theme',
            weight: 20,
            passed: hasTheme,
            detail: hasTheme ? 'Theme selected or published' : 'No active theme signal',
            issue: 'theme not selected',
        },
        {
            label: 'Payments',
            weight: 25,
            passed: !input.paymentError && paymentReady,
            detail: input.paymentError || formatPaymentLabel(input.payment),
            issue: input.paymentError ? 'payment data unavailable' : 'payments not configured',
        },
        {
            label: 'Shipping',
            weight: 10,
            passed: !input.shippingError && shippingReady,
            detail: input.shippingError || `${input.shippingZones.length.toLocaleString('en-IN')} shipping zones`,
            issue: input.shippingError ? 'shipping data unavailable' : 'no shipping zones',
        },
    ];
}

async function safeRead<T>(loader: () => Promise<T>): Promise<SafeRead<T>> {
    try {
        return { data: await loader(), error: null };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Data unavailable',
        };
    }
}

function formatPaymentLabel(payment: StorePaymentConfig | null): string {
    if (!payment) return 'Payment data unavailable';
    const modes: string[] = [];
    if (payment.online_payment_enabled !== false) modes.push('online');
    if (payment.cod_enabled) modes.push('COD');
    if (payment.payment_settings?.razorpay?.verified) modes.push('verified Razorpay');
    return modes.length > 0 ? `${modes.join(', ')} enabled` : 'No payment modes enabled';
}

function getHealthBand(score: number): HealthBand {
    if (score >= 80) return 'healthy';
    if (score >= 55) return 'watch';
    return 'at_risk';
}

function summarizeHealth(rows: MerchantHealthRow[]) {
    const scoredStores = rows.length;
    const totalScore = rows.reduce((sum, row) => sum + row.score, 0);

    return {
        scoredStores,
        averageScore: scoredStores > 0 ? Math.round(totalScore / scoredStores) : 0,
        healthy: rows.filter((row) => row.band === 'healthy').length,
        watch: rows.filter((row) => row.band === 'watch').length,
        atRisk: rows.filter((row) => row.band === 'at_risk').length,
        paymentReady: rows.filter((row) => !row.issues.includes('payments not configured') && !row.issues.includes('payment data unavailable')).length,
    };
}

function applyFilters(rows: MerchantHealthRow[], query: string, healthFilter: string): MerchantHealthRow[] {
    const normalizedQuery = query.toLowerCase();

    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || `${row.storeName} ${row.subdomain}`.toLowerCase().includes(normalizedQuery);
        const matchesHealth = healthFilter === 'all' || row.band === healthFilter;
        return matchesQuery && matchesHealth;
    });
}

function normalizeHealthFilter(value: string): string {
    return HEALTH_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
}

function firstParam(value: SearchParamValue): string {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
}

function formatLabel(value: string): string {
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}
