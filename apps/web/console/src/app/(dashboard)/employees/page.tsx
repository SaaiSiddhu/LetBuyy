export default function EmployeesPage() {
    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Employees</h1>
                    <p className="mt-1 text-sm text-zinc-400">Manage team members and roles</p>
                </div>
                <button className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700">
                    Invite Employee
                </button>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <p className="text-zinc-400">No employees invited yet.</p>
            </div>
            {/* TODO: Employee table, invite modal, role assignment, deactivation */}
        </div>
    );
}
