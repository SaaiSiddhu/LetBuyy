export default function StoresPage() {
    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Stores</h1>
                    <p className="mt-1 text-sm text-zinc-400">All platform stores</p>
                </div>
                <input
                    type="search"
                    placeholder="Search stores..."
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-red-500"
                />
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <p className="text-zinc-400">Store management table will appear here.</p>
            </div>
            {/* TODO: Store table with status, site type, actions (suspend/delete) */}
        </div>
    );
}
