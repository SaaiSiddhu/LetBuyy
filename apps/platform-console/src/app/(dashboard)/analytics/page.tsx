import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleAnalytics = {
    period_days: number;
    new_signups: number;
    stores_created: number;
    subscriptions_created: number;
    audit_events: number;
    signup_to_store_conversion_percent: number;
};

export default async function ConsoleAnalyticsPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<ConsoleAnalytics>>('/internal/console/analytics');
    const analytics = result.data?.data;

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-zinc-50">Platform Analytics</h1>
                <p className="mt-1 text-sm text-zinc-400">Growth metrics from the last {analytics?.period_days || 30} days.</p>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Analytics API unavailable" message={result.error} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <AnalyticsTile label="New Signups" value={String(analytics?.new_signups || 0)} />
                    <AnalyticsTile label="Stores Created" value={String(analytics?.stores_created || 0)} />
                    <AnalyticsTile label="New Subscriptions" value={String(analytics?.subscriptions_created || 0)} />
                    <AnalyticsTile label="Audit Events" value={String(analytics?.audit_events || 0)} />
                    <AnalyticsTile
                        label="Signup To Store"
                        value={`${analytics?.signup_to_store_conversion_percent || 0}%`}
                    />
                </div>
            )}
        </div>
    );
}

function AnalyticsTile({ label, value }: { label: string; value: string }) {
    return (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-50">{value}</p>
        </section>
    );
}
