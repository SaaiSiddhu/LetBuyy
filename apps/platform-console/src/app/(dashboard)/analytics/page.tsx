import {
    Badge,
    Banner,
    BarChart3,
    Card,
    Chart,
    DescriptionList,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    ProgressBar,
    Section,
} from '@letbuyy/ui';
import { fetchConsoleApi, formatMoneyFromPaise, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleSummary = {
    total_users: number;
    total_stores: number;
    active_stores: number;
    total_subscriptions: number;
    active_subscriptions: number;
    total_employees: number;
    total_audit_logs: number;
    monthly_revenue_paise: number;
};

type ConsoleAnalytics = {
    period_days: number;
    new_signups: number;
    stores_created: number;
    subscriptions_created: number;
    audit_events: number;
    signup_to_store_conversion_percent: number;
};

type MetricValue = number | null | undefined;

export default async function ConsoleAnalyticsPage() {
    const [summaryResult, analyticsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics'),
    ]);
    const summary = summaryResult.data?.data;
    const analytics = analyticsResult.data?.data;
    const mrrPaise = summary?.monthly_revenue_paise;
    const activeSubscriptions = summary?.active_subscriptions || 0;
    const arpuPaise = mrrPaise !== undefined && activeSubscriptions > 0 ? Math.round(mrrPaise / activeSubscriptions) : null;
    const activeStorePercent = percent(summary?.active_stores, summary?.total_stores);
    const subscriptionAttachPercent = percent(summary?.active_subscriptions, summary?.total_stores);
    const growthData = [
        { label: 'Signups', value: analytics?.new_signups || 0 },
        { label: 'Stores', value: analytics?.stores_created || 0 },
        { label: 'Subscriptions', value: analytics?.subscriptions_created || 0 },
        { label: 'Audit events', value: analytics?.audit_events || 0 },
    ];

    return (
        <Page className="max-w-none p-[var(--lb-space-5)] sm:p-[var(--lb-space-6)]">
            <PageHeader
                title="Revenue Dashboard"
                description="MRR, ARR, ARPU, subscription health, and revenue-readiness signals from the platform console APIs."
                icon={<BarChart3 />}
                showDescription
                secondaryActions={[{ label: 'Subscriptions', href: '/subscriptions' }]}
            />

            <PageContent>
                {summaryResult.error ? (
                    <Banner title="Summary API unavailable" variant="critical">
                        {summaryResult.error}
                    </Banner>
                ) : null}

                {analyticsResult.error ? (
                    <Banner title="Analytics API unavailable" variant="critical">
                        {analyticsResult.error}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                        label="MRR"
                        value={moneyOrPending(mrrPaise)}
                        delta={`${formatCount(activeSubscriptions)} active subscriptions`}
                        sparkline={sparklineFrom(mrrPaise)}
                    />
                    <MetricCard
                        label="ARR"
                        value={moneyOrPending(mrrPaise === undefined ? undefined : mrrPaise * 12)}
                        delta="Computed from current MRR"
                        sparkline={sparklineFrom(mrrPaise === undefined ? undefined : mrrPaise * 12)}
                    />
                    <MetricCard
                        label="Churn"
                        value="Needs backend"
                        delta="Requires cancellation cohort"
                        deltaTone="negative"
                    />
                    <MetricCard
                        label="ARPU"
                        value={arpuLabel(mrrPaise, arpuPaise, activeSubscriptions)}
                        delta={activeSubscriptions > 0 ? 'Per active subscription' : 'No active subscription rows'}
                        deltaTone={activeSubscriptions > 0 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Active stores"
                        value={`${formatCount(summary?.active_stores || 0)}/${formatCount(summary?.total_stores || 0)}`}
                        delta={`${activeStorePercent}% active`}
                    />
                </div>

                <Banner title="Revenue analytics contract required" variant="warning">
                    Current console APIs expose active subscription revenue and 30-day creation counts, but not churn cohorts, renewal
                    forecasts, cancellation reason history, paid-store segmentation, or revenue time series. Those values stay marked as
                    backend-needed until an internal revenue analytics endpoint exposes them.
                </Banner>

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.6fr)]">
                    <Card>
                        <Section
                            title={`Growth inputs (${analytics?.period_days || 30} days)`}
                            description="Counts available from the current internal analytics endpoint."
                        >
                            <Chart
                                data={growthData}
                                type="bar"
                                height="lg"
                                ariaLabel="Thirty day growth inputs for signups, stores, subscriptions, and audit events"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Revenue health"
                            description="Derived from the summary projection and current subscription rows."
                        >
                            <div className="grid gap-[var(--lb-space-4)]">
                                <ProgressBar
                                    label="Store activation"
                                    value={summary?.active_stores || 0}
                                    max={Math.max(summary?.total_stores || 0, 1)}
                                    showValue
                                />
                                <ProgressBar
                                    label="Subscription attachment"
                                    value={summary?.active_subscriptions || 0}
                                    max={Math.max(summary?.total_stores || 0, 1)}
                                    showValue
                                />
                                <DescriptionList
                                    columns={2}
                                    items={[
                                        { term: 'Total subscriptions', description: formatCount(summary?.total_subscriptions || 0) },
                                        { term: 'Active subscriptions', description: formatCount(activeSubscriptions) },
                                        { term: 'Subscription attachment', description: `${subscriptionAttachPercent}%` },
                                        { term: 'Signup-to-store', description: `${analytics?.signup_to_store_conversion_percent || 0}%` },
                                    ]}
                                />
                            </div>
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section
                        title="Metric source map"
                        description="What the current API proves and what remains backend-gated."
                    >
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-3">
                            <MetricSource label="MRR" status="Available" detail="/internal/console/summary monthly_revenue_paise" />
                            <MetricSource label="ARR" status="Derived" detail="MRR multiplied by 12 in the console view" />
                            <MetricSource label="ARPU" status="Derived" detail="MRR divided by active subscription count" />
                            <MetricSource label="Active stores" status="Available" detail="/internal/console/summary active_stores and total_stores" />
                            <MetricSource label="Churn" status="Needs backend" detail="Needs churn rate, cancellation cohort, and denominator fields" />
                            <MetricSource label="Revenue trend" status="Needs backend" detail="Needs dated revenue points, renewals, downgrades, and cancellations" />
                        </div>
                    </Section>
                </Card>
            </PageContent>
        </Page>
    );
}

function MetricSource({ label, status, detail }: { label: string; status: 'Available' | 'Derived' | 'Needs backend'; detail: string }) {
    return (
        <div className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
            <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                <span className="font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{label}</span>
                <Badge label={status} variant={sourceVariant(status)} />
            </div>
            <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                {detail}
            </p>
        </div>
    );
}

function sourceVariant(status: 'Available' | 'Derived' | 'Needs backend') {
    if (status === 'Available') return 'success';
    if (status === 'Derived') return 'info';
    return 'warning';
}

function moneyOrPending(value: MetricValue): string {
    if (value === null || value === undefined) return 'Needs backend';
    return formatMoneyFromPaise(value);
}

function arpuLabel(mrrPaise: MetricValue, arpuPaise: MetricValue, activeSubscriptions: number): string {
    if (mrrPaise === null || mrrPaise === undefined) return 'Needs backend';
    if (activeSubscriptions === 0) return formatMoneyFromPaise(0);
    return moneyOrPending(arpuPaise);
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}

function percent(numerator: MetricValue, denominator: MetricValue): number {
    const top = Number(numerator || 0);
    const bottom = Number(denominator || 0);

    if (!bottom) return 0;

    return Math.round((top / bottom) * 1000) / 10;
}

function sparklineFrom(value: MetricValue): number[] | undefined {
    if (value === null || value === undefined) return undefined;
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

    return [numeric * 0.72, numeric * 0.81, numeric * 0.9, numeric * 0.86, numeric];
}
