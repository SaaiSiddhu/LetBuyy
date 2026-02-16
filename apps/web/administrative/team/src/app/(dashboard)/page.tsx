export default function TeamDashboardPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Employee Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Welcome back! Here&apos;s your activity overview.
                </p>
            </div>

            {/* Quick Stats — based on role */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Open Tickets</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">0</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Resolved Today</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">0</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Pending Actions</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">0</p>
                </div>
            </div>

            {/* TODO: Recent activity feed, assigned tasks */}
        </div>
    );
}
