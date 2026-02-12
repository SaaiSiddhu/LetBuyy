export default function AuditLogsPage() {
    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Audit Logs</h1>
                    <p className="mt-1 text-sm text-zinc-400">All admin and employee actions</p>
                </div>
                <div className="flex gap-2">
                    <select className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none">
                        <option value="">All Actors</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="employee">Employee</option>
                        <option value="system">System</option>
                    </select>
                    <input
                        type="date"
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none"
                    />
                </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <p className="text-zinc-400">No audit logs recorded yet.</p>
            </div>
            {/* TODO: Audit log table with actor, action, resource, timestamp, IP */}
        </div>
    );
}
