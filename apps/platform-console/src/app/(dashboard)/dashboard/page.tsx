import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
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

export default async function ConsoleDashboardRoutePage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<ConsoleSummary>>('/internal/console/summary');
    const summary = result.data?.data;

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-zinc-50">Platform Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-400">Live platform overview from service-role console projections.</p>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Summary API unavailable" message={result.error} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <PlatformStatCard title="Total Users" value={String(summary?.total_users || 0)} />
                    <PlatformStatCard title="Active Stores" value={`${summary?.active_stores || 0}/${summary?.total_stores || 0}`} />
                    <PlatformStatCard title="Monthly Revenue" value={formatMoneyFromPaise(summary?.monthly_revenue_paise || 0)} />
                    <PlatformStatCard title="Active Subscriptions" value={`${summary?.active_subscriptions || 0}/${summary?.total_subscriptions || 0}`} />
                    <PlatformStatCard title="Employees" value={String(summary?.total_employees || 0)} />
                    <PlatformStatCard title="Audit Events" value={String(summary?.total_audit_logs || 0)} />
                </div>
            )}
        </div>
    );
}

function PlatformStatCard({ title, value }: { title: string; value: string }) {
    return (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-50">{value}</p>
        </section>
    );
}
