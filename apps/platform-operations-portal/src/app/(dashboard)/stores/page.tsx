export default function TeamStoresPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Store Lookup</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">View and moderate stores</p>
            </div>
            <input
                type="search"
                placeholder="Search by store name or subdomain..."
                className="mb-6 w-full max-w-md rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-zinc-600 dark:text-zinc-400">Search for a store to view or moderate.</p>
            </div>
            {/* TODO: Store search results, moderation actions (flag, freeze) */}
        </div>
    );
}
