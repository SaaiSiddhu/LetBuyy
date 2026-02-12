export default function SupportPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Support Tickets</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View and respond to customer support tickets</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-600 dark:text-zinc-400">No open tickets.</p>
            </div>
            {/* TODO: Ticket list with status, priority, assignee, thread view */}
        </div>
    );
}
