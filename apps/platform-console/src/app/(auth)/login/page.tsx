import { Mail, ShieldCheck } from 'lucide-react';

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string | undefined) {
    switch (code) {
        case 'access_denied':
            return 'Access denied.';
        case 'invalid_email':
            return 'Enter a valid email address.';
        case 'send_failed':
            return 'Unable to send the magic link.';
        case 'supabase_not_configured':
            return 'Supabase Auth is not configured.';
        case 'session_secret_not_configured':
            return 'Console session signing is not configured.';
        case 'invalid_magic_link':
            return 'This magic link is invalid or expired.';
        case 'callback_failed':
            return 'Unable to verify the magic link.';
        case 'missing_code':
            return 'The authentication callback is missing a code.';
        default:
            return null;
    }
}

export default async function ConsoleLoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
    const params = await searchParams;
    const error = errorMessage(firstParam(params.error));
    const sent = firstParam(params.sent) === '1';
    const loggedOut = firstParam(params.loggedOut) === '1';
    const devMagicLink = firstParam(params.devMagicLink);

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/10 text-red-400">
                        <ShieldCheck size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-50">Console Access</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Authorized personnel only.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {sent && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        Magic link sent to the allowlisted email.
                    </div>
                )}

                {loggedOut && (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200">
                        Signed out.
                    </div>
                )}

                {devMagicLink && process.env.NODE_ENV !== 'production' && (
                    <a
                        href={devMagicLink}
                        className="block rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                    >
                        Open local development magic link
                    </a>
                )}

                <form action="/api/console-auth/login" method="post" className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="admin@letbuyy.store"
                            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                    >
                        <Mail size={16} />
                        Send magic link
                    </button>
                </form>

                <p className="text-center text-xs text-zinc-600">
                    Access is logged and monitored. Unauthorized access will be reported.
                </p>
            </div>
        </div>
    );
}
