import type { LetbuyyApiClient } from '@letbuyy/api-client';
import type {
    Product,
    ShippingZone,
    Store,
    StorePaymentConfig,
    StoreSummary,
} from '@letbuyy/shared-types';
import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    DescriptionList,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
} from '@letbuyy/ui';
import { formatDisplayDate } from '@letbuyy/ui/formatting';
import { createPlatformOperationsApiClient } from '../../../../lib/api/client';
import { OnboardingQueueIndexTable } from './OnboardingQueueIndexTable';

type SearchParamValue = string | string[] | undefined;
type OnboardingBand = 'ready' | 'needs_help' | 'blocked';

interface OnboardingSupportPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

interface SafeRead<T> {
    data: T | null;
    error: string | null;
}

interface OnboardingStatusPayload {
    onboarding_completed?: boolean;
    attempt?: unknown;
}

interface OnboardingSignal {
    key: string;
    label: string;
    complete: boolean;
    detail: string;
    action: string;
}

export interface OnboardingQueueRow {
    id: string;
    merchantName: string;
    storeHandle: string;
    siteType: string;
    band: OnboardingBand;
    bandLabel: string;
    checklistCompleted: number;
    checklistTotal: number;
    progress: number;
    currentStepLabel: string;
    lastActivityLabel: string;
    productsLabel: string;
    paymentLabel: string;
    shippingLabel: string;
    nextAction: string;
    missingSignals: string[];
}

interface OnboardingLoadResult {
    rows: OnboardingQueueRow[];
    totalStores: number;
    onboardingStatus: OnboardingStatusPayload | null;
    onboardingStatusError: string | null;
    loadError: string | null;
}

const QUEUE_FILTER_OPTIONS = [
    { label: 'All readiness', value: 'all' },
    { label: 'Ready', value: 'ready' },
    { label: 'Needs help', value: 'needs_help' },
    { label: 'Blocked', value: 'blocked' },
];

const SIGNAL_LABELS = ['Profile', 'Domain', 'Products', 'Theme', 'Payments', 'Shipping'];

export default async function OnboardingSupportPage({ searchParams }: OnboardingSupportPageProps) {
    const params = searchParams ? await searchParams : {};
    const query = firstParam(params.q).trim();
    const queueFilter = normalizeQueueFilter(firstParam(params.queue));
    const result = await loadOnboardingSupport();
    const visibleRows = applyFilters(result.rows, query, queueFilter);
    const summary = summarizeOnboarding(result.rows);

    return (
        <Page>
            <PageHeader
                title="Onboarding Support"
                description="New merchant readiness queue derived from existing store and onboarding status APIs."
                iconName="steps"
                showDescription
                secondaryActions={[
                    { label: 'Merchant Health', href: '/merchant-health' },
                    { label: 'Support Tickets', href: '/support' },
                ]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="New merchant sample"
                        value={summary.total.toLocaleString('en-IN')}
                        delta={`${result.totalStores.toLocaleString('en-IN')} stores visible to session`}
                        deltaTone={summary.total > 0 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Needs help"
                        value={summary.needsHelp.toLocaleString('en-IN')}
                        delta="Missing one or more checklist signals"
                        deltaTone={summary.needsHelp > 0 ? 'negative' : 'positive'}
                    />
                    <MetricCard
                        label="Average checklist"
                        value={`${summary.averageProgress}%`}
                        delta="Derived readiness score"
                        deltaTone={summary.averageProgress >= 100 ? 'positive' : summary.averageProgress >= 60 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Onboarding backend"
                        value="Needed"
                        delta="No employee-wide queue contract"
                        deltaTone="negative"
                    />
                </div>

                <Banner title="Onboarding support backend required" variant="warning">
                    Current data can only combine the authenticated session&apos;s store list with the current-user onboarding status
                    endpoint. A real operations queue needs all new merchants, onboarding attempts by merchant, owner contact,
                    assigned operator, SLA timers, checklist events, blocker reasons, notes, and support handoff state.
                </Banner>

                {result.onboardingStatusError ? (
                    <Banner title="Onboarding status unavailable" variant="warning">
                        {result.onboardingStatusError}
                    </Banner>
                ) : null}

                {result.loadError ? (
                    <Banner title="Unable to load onboarding queue" variant="critical">
                        {result.loadError}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <Card>
                        <Section
                            title="Checklist coverage"
                            description="Count of visible stores passing each onboarding readiness signal."
                        >
                            <Chart
                                ariaLabel="Onboarding checklist coverage"
                                data={SIGNAL_LABELS.map((label) => ({
                                    label,
                                    value: summary.signalCounts[label] ?? 0,
                                }))}
                                type="bar"
                                height="md"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Queue contract gaps"
                            description="What is visible now versus what operations support needs."
                        >
                            <DescriptionList
                                columns={1}
                                items={[
                                    { term: 'Merchant source', description: 'Authenticated session store list only' },
                                    { term: 'Onboarding status', description: result.onboardingStatus?.attempt ? 'Current user attempt only' : 'No current-user attempt record' },
                                    { term: 'Assignment and SLA', description: <Badge label="Backend needed" variant="warning" /> },
                                    { term: 'Checklist events', description: 'Derived from products, theme, payments, and shipping APIs' },
                                ]}
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Onboarding filters" description="Filter the derived merchant onboarding sample.">
                        <form action="/operations/onboarding" method="get">
                            <FilterBar
                                search={
                                    <Input
                                        label="Search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Merchant, store, or handle"
                                    />
                                }
                                filters={
                                    <Select
                                        label="Readiness"
                                        name="queue"
                                        defaultValue={queueFilter}
                                        options={QUEUE_FILTER_OPTIONS}
                                    />
                                }
                                actions={<Button type="submit">Search</Button>}
                            />
                        </form>
                    </Section>
                </Card>

                <OnboardingQueueIndexTable rows={visibleRows} />

                <div className="grid gap-[var(--lb-density-card-gap)] lg:grid-cols-3">
                    <Button type="button" variant="outline" disabled>
                        Assign operator
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Add blocker note
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Send onboarding message
                    </Button>
                </div>

                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Showing {visibleRows.length.toLocaleString('en-IN')} of {result.rows.length.toLocaleString('en-IN')} onboarding support rows from the first {result.totalStores.toLocaleString('en-IN')} stores visible to this session.
                </p>
            </PageContent>
        </Page>
    );
}

async function loadOnboardingSupport(): Promise<OnboardingLoadResult> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const [stores, onboardingStatus] = await Promise.all([
            api.stores.list({ limit: 50 }),
            safeRead(() => api.requestData<OnboardingStatusPayload>('/onboarding/status')),
        ]);
        const rows = await Promise.all(stores.data.map((store) => buildOnboardingRow(api, store, onboardingStatus.data)));

        return {
            rows,
            totalStores: stores.total,
            onboardingStatus: onboardingStatus.data,
            onboardingStatusError: onboardingStatus.error,
            loadError: null,
        };
    } catch (error) {
        return {
            rows: [],
            totalStores: 0,
            onboardingStatus: null,
            onboardingStatusError: null,
            loadError: error instanceof Error ? error.message : 'Unable to load onboarding support queue',
        };
    }
}

async function buildOnboardingRow(
    api: LetbuyyApiClient,
    summary: StoreSummary,
    onboardingStatus: OnboardingStatusPayload | null,
): Promise<OnboardingQueueRow> {
    const [detailResult, productResult, paymentResult, shippingResult] = await Promise.all([
        safeRead(() => api.stores.get(summary.id)),
        safeRead(() => api.products.list({ store_id: summary.id, limit: 100 })),
        safeRead(() => api.stores.paymentConfig.get(summary.id)),
        safeRead(() => api.shipping.zones.list({ store_id: summary.id })),
    ]);

    const detail = detailResult.data;
    const products = productResult.data?.data ?? [];
    const productTotal = productResult.data?.total ?? products.length;
    const payment = paymentResult.data;
    const shippingZones = shippingResult.data ?? [];
    const attempt = readRecord(onboardingStatus?.attempt);
    const signals = buildSignals({
        detail,
        summary,
        products,
        productTotal,
        productError: productResult.error,
        payment,
        paymentError: paymentResult.error,
        shippingZones,
        shippingError: shippingResult.error,
    });
    const checklistCompleted = signals.filter((signal) => signal.complete).length;
    const progress = Math.round((checklistCompleted / signals.length) * 100);
    const band = getOnboardingBand(checklistCompleted, signals.length, Boolean(detailResult.error));
    const missingSignals = signals.filter((signal) => !signal.complete).map((signal) => signal.label);

    return {
        id: summary.id,
        merchantName: summary.store_name || detail?.name || summary.name,
        storeHandle: summary.subdomain,
        siteType: formatLabel(detail?.site_type ?? summary.site_type),
        band,
        bandLabel: band === 'ready' ? 'Ready' : band === 'needs_help' ? 'Needs help' : 'Blocked',
        checklistCompleted,
        checklistTotal: signals.length,
        progress,
        currentStepLabel: formatAttemptLabel(onboardingStatus, attempt),
        lastActivityLabel: formatLastActivity(attempt, detail),
        productsLabel: signals.find((signal) => signal.label === 'Products')?.detail ?? 'Products unavailable',
        paymentLabel: signals.find((signal) => signal.label === 'Payments')?.detail ?? 'Payments unavailable',
        shippingLabel: signals.find((signal) => signal.label === 'Shipping')?.detail ?? 'Shipping unavailable',
        nextAction: signals.find((signal) => !signal.complete)?.action || 'Review launch readiness when employee queue backend is available',
        missingSignals,
    };
}

function buildSignals(input: {
    detail: Store | null;
    summary: StoreSummary;
    products: Product[];
    productTotal: number;
    productError: string | null;
    payment: StorePaymentConfig | null;
    paymentError: string | null;
    shippingZones: ShippingZone[];
    shippingError: string | null;
}): OnboardingSignal[] {
    const activeProducts = input.products.filter((product) => product.status === 'active' || product.is_active).length;
    const hasProfile = Boolean(input.detail);
    const hasDomain = Boolean(input.summary.subdomain || input.detail?.custom_domain);
    const hasTheme = Boolean(input.detail?.theme_id || input.detail?.current_theme_release_id || input.detail?.published_at);
    const paymentReady = Boolean(input.payment && (input.payment.online_payment_enabled !== false || input.payment.cod_enabled));
    const shippingReady = input.shippingZones.length > 0;

    return [
        {
            key: 'profile',
            label: 'Profile',
            complete: hasProfile,
            detail: hasProfile ? 'Store profile loaded' : 'Store detail unavailable',
            action: 'Confirm owner and profile details when employee onboarding backend is available',
        },
        {
            key: 'domain',
            label: 'Domain',
            complete: hasDomain,
            detail: hasDomain ? input.summary.subdomain : 'No domain signal',
            action: 'Help merchant reserve a store handle or custom domain',
        },
        {
            key: 'products',
            label: 'Products',
            complete: !input.productError && activeProducts > 0,
            detail: input.productError || `${activeProducts.toLocaleString('en-IN')} active of ${input.productTotal.toLocaleString('en-IN')} products`,
            action: 'Guide merchant to add an active product',
        },
        {
            key: 'theme',
            label: 'Theme',
            complete: hasTheme,
            detail: hasTheme ? 'Theme selected or store published' : 'No active theme signal',
            action: 'Help merchant select or publish a theme',
        },
        {
            key: 'payments',
            label: 'Payments',
            complete: !input.paymentError && paymentReady,
            detail: input.paymentError || formatPaymentLabel(input.payment),
            action: 'Help merchant configure COD or online payments',
        },
        {
            key: 'shipping',
            label: 'Shipping',
            complete: !input.shippingError && shippingReady,
            detail: input.shippingError || `${input.shippingZones.length.toLocaleString('en-IN')} shipping zones`,
            action: 'Help merchant add shipping zones',
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

function summarizeOnboarding(rows: OnboardingQueueRow[]) {
    const totalProgress = rows.reduce((sum, row) => sum + row.progress, 0);
    const signalCounts: Record<string, number> = {};

    for (const label of SIGNAL_LABELS) {
        signalCounts[label] = rows.filter((row) => !row.missingSignals.includes(label)).length;
    }

    return {
        total: rows.length,
        ready: rows.filter((row) => row.band === 'ready').length,
        needsHelp: rows.filter((row) => row.band === 'needs_help').length,
        blocked: rows.filter((row) => row.band === 'blocked').length,
        averageProgress: rows.length > 0 ? Math.round(totalProgress / rows.length) : 0,
        signalCounts,
    };
}

function applyFilters(rows: OnboardingQueueRow[], query: string, queueFilter: string): OnboardingQueueRow[] {
    const normalizedQuery = query.toLowerCase();

    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || `${row.merchantName} ${row.storeHandle} ${row.siteType}`.toLowerCase().includes(normalizedQuery);
        const matchesQueue = queueFilter === 'all' || row.band === queueFilter;
        return matchesQuery && matchesQueue;
    });
}

function getOnboardingBand(completed: number, total: number, blocked: boolean): OnboardingBand {
    if (blocked || completed <= 2) return 'blocked';
    if (completed === total) return 'ready';
    return 'needs_help';
}

function formatAttemptLabel(status: OnboardingStatusPayload | null, attempt: Record<string, unknown> | null): string {
    if (status?.onboarding_completed) return 'Completed';
    if (!attempt) return 'No attempt record';

    const rawStatus = readString(attempt, ['status']) || 'in progress';
    const currentStep = readNumber(attempt, ['current_step']);
    if (currentStep) return `${formatLabel(rawStatus)} - step ${currentStep} of 6`;
    return formatLabel(rawStatus);
}

function formatLastActivity(attempt: Record<string, unknown> | null, detail: Store | null): string {
    const value =
        (attempt ? readString(attempt, ['last_activity_at', 'updated_at', 'created_at']) : null) ||
        detail?.updated_at ||
        detail?.created_at;

    return formatDisplayDate(value, {
        emptyValue: 'No activity timestamp',
        invalidValue: 'at an unavailable time',
        options: {
            dateStyle: 'medium',
            timeStyle: 'short',
        },
    });
}

function formatPaymentLabel(payment: StorePaymentConfig | null): string {
    if (!payment) return 'Payment data unavailable';
    const modes: string[] = [];
    if (payment.online_payment_enabled !== false) modes.push('online');
    if (payment.cod_enabled) modes.push('COD');
    if (payment.payment_settings?.razorpay?.verified) modes.push('verified Razorpay');
    return modes.length > 0 ? `${modes.join(', ')} enabled` : 'No payment modes enabled';
}

function normalizeQueueFilter(value: string): string {
    return QUEUE_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
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

function readString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return null;
}

function readNumber(source: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }

    return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
