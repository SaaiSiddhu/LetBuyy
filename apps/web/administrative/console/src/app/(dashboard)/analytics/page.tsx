export default function ConsoleAnalyticsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-50">Platform Analytics</h1>
                <p className="mt-1 text-sm text-zinc-400">Growth metrics, funnels, and trends</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">New Signups (30d)</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">0</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">Stores Created (30d)</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">0</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">Conversion Rate</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">0%</p>
                </div>
            </div>
            {/* TODO: Charts, funnels, cohort analysis, churn metrics */}
        </div>
    );
}
