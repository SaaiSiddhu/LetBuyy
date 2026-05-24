export default function ConsoleLoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/10">
                        <span className="text-xl">🔒</span>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-50">Console Access</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Authorized personnel only. VPN required.
                    </p>
                </div>

                {/* TODO: Email allowlist check + Supabase Auth */}
                <form className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="admin@letbuyy.store"
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                        Sign in to Console
                    </button>
                </form>

                <p className="text-center text-xs text-zinc-600">
                    Access is logged and monitored. Unauthorized access will be reported.
                </p>
            </div>
        </div>
    );
}
