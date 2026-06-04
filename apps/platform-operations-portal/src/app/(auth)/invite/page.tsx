export default function InvitePage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                        Accept Invitation
                    </h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        You&apos;ve been invited to join the LetBuyy team
                    </p>
                </div>

                {/* TODO: Validate invite token, show role, create password */}
                <form className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Full Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            placeholder="Your full name"
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-primary-subtle)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Create Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-primary-subtle)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-lg bg-[var(--lb-color-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--lb-color-primary-hover)] active:bg-[var(--lb-color-primary-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lb-color-focus-ring)]"
                    >
                        Join Team
                    </button>
                </form>
            </div>
        </div>
    );
}
