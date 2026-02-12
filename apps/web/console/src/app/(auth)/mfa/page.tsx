export default function MFAPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-600/10">
                        <span className="text-xl">🔐</span>
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-50">Two-Factor Authentication</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Enter the 6-digit code from your authenticator app.
                    </p>
                </div>

                {/* TODO: TOTP verification with Supabase MFA */}
                <form className="space-y-4">
                    <div className="flex justify-center gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <input
                                key={i}
                                type="text"
                                maxLength={1}
                                className="h-12 w-12 rounded-lg border border-zinc-700 bg-zinc-800 text-center text-lg font-mono text-zinc-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            />
                        ))}
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
                    >
                        Verify
                    </button>
                </form>

                <p className="text-center text-sm text-zinc-500">
                    Lost your authenticator? Contact the system administrator.
                </p>
            </div>
        </div>
    );
}
