export default function ConsoleDashboardPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-50">Platform Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-400">Real-time platform overview</p>
            </div>

            {/* Platform Stats */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <PlatformStatCard title="Total Users" value="0" trend="+0%" />
                <PlatformStatCard title="Active Stores" value="0" trend="+0%" />
                <PlatformStatCard title="Total Revenue" value="₹0.00" trend="+0%" />
                <PlatformStatCard title="Active Subscriptions" value="0" trend="+0%" />
            </div>

            {/* TODO: Revenue charts, recent signups, system health, alerts */}
        </div>
    );
}

function PlatformStatCard({ title, value, trend }: { title: string; value: string; trend: string }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-medium text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-50">{value}</p>
            <p className="mt-1 text-sm text-emerald-400">{trend}</p>
        </div>
    );
}
