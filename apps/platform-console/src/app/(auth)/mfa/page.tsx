import { KeyRound, ShieldAlert } from '@letbuyy/ui';
import { requireConsoleSession } from '@/lib/console-auth-server';

type MfaSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string | undefined) {
    switch (code) {
        case 'invalid_code':
            return 'Enter a valid authenticator code.';
        case 'session_secret_not_configured':
            return 'Console session signing is not configured.';
        default:
            return null;
    }
}

export default async function MFAPage({ searchParams }: { searchParams: MfaSearchParams }) {
    await requireConsoleSession();
    const params = await searchParams;
    const error = errorMessage(firstParam(params.error));

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-600/10 text-amber-400">
                        <ShieldAlert size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-50">Two-Factor Authentication</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Enter the 6-digit code from your authenticator app.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                <form action="/api/console-auth/mfa" method="post" className="space-y-4">
                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-zinc-300">
                            Authenticator code
                        </label>
                        <input
                            id="code"
                            name="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            placeholder="123456"
                            className="mt-1 h-12 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-center font-mono text-lg text-zinc-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    >
                        <KeyRound size={16} />
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
