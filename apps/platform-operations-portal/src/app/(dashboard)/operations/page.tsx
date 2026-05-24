export default function OperationsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Operations</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Disputes, platform health, and seller verification</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Order Disputes</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">0 active disputes</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Platform Health</h3>
                    <p className="mt-1 text-sm text-emerald-600">All systems operational</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Seller Verification</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">0 pending verifications</p>
                </div>
            </div>
            {/* TODO: Dispute resolution, health monitoring, verification queue */}
        </div>
    );
}
