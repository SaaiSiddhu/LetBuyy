export default function SubscriptionsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-50">Subscriptions & Billing</h1>
                <p className="mt-1 text-sm text-zinc-400">Revenue, invoices, and plan management</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">Monthly Revenue</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">₹0.00</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">Active Plans</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">0</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <p className="text-sm text-zinc-400">Churn Rate</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-50">0%</p>
                </div>
            </div>
            {/* TODO: Subscription table, revenue charts, invoice lookup */}
        </div>
    );
}
