import { Button } from '@letbuyy/ui';

export default function TeamLoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-200 bg-[var(--lb-color-surface)] p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Team Portal</h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Sign in with your employee credentials
                    </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    This frozen portal is not the active ops login. The survivor fold-in remains recorded under
                    SKIP-GATE-OPS-SURVIVOR-ARB, and per-operator identity remains recorded under SKIP-OPS-SSO-IDP.
                </div>
                <div className="space-y-4">
                    <Button
                        unstyled
                        disabled
                        className="w-full cursor-not-allowed rounded-lg bg-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                        Sign in unavailable
                    </Button>
                </div>
            </div>
        </div>
    );
}
