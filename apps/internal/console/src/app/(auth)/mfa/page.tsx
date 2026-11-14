import { Button, Input, KeyRound, ShieldAlert } from '@letbuyy/ui';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { consoleStepUpReturnPath } from '@/lib/console-step-up';

type MfaSearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function errorMessage(code: string | undefined) {
    switch (code) {
        case 'mfa_not_configured':
            return 'Authenticator verification is not configured for this account. Contact your platform administrator.';
        case 'administrator_reset_required':
            return 'Administrator recovery and a newly configured authenticator are required. Contact your platform administrator.';
        case 'invalid_code':
            return 'Enter a valid authenticator code.';
        case 'session_secret_not_configured':
            return 'Console session signing is not configured.';
        case 'session_unavailable':
            return 'Your session could not be saved. Retry with a new authenticator code when service is restored.';
        case 'too_many_attempts':
            return 'Too many attempts. Wait before trying a new authenticator code.';
        default:
            return null;
    }
}

export default async function MFAPage({ searchParams }: { searchParams: MfaSearchParams }) {
    await requireConsoleSession();
    const params = await searchParams;
    const error = errorMessage(firstParam(params.error));
    const stepUp = firstParam(params.step_up) === '1';
    const returnTo = consoleStepUpReturnPath(firstParam(params.return_to));

    return (
        <div className="console-auth flex min-h-screen items-center justify-center bg-page">
            <div className="console-auth-card w-full max-w-md space-y-8 rounded-lg border border-line bg-surface p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lb-color-primary-subtle)] text-[var(--lb-color-primary)]">
                        <ShieldAlert size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-default">Two-Factor Authentication</h1>
                    <p className="mt-2 text-sm text-subdued">
                        Enter the 6-digit code from your authenticator app.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
                        {error}
                    </div>
                )}

                <form action="/api/console-auth/mfa" method="post" className="space-y-4">
                    {stepUp && <>
                        <Input unstyled type="hidden" name="step_up" value="1" />
                        <Input unstyled type="hidden" name="return_to" value={returnTo} />
                        <p className="text-sm text-default">Verify a new code for this protected action. Requests tied to your earlier sign-in will need a new approval request.</p>
                    </>}
                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-default">
                            Authenticator code
                        </label>
                        <Input
                            unstyled
                            id="code"
                            name="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            placeholder="123456"
                            className="mt-1 h-12 w-full rounded-lg border border-line bg-surface-subdued px-4 text-center font-mono text-lg text-default outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-primary-subtle)]"
                        />
                    </div>
                    <Button
                        unstyled
                        type="submit"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--lb-color-primary-cta)] px-4 py-2.5 text-sm font-medium text-[var(--lb-color-primary-cta-text)] transition-colors hover:bg-[var(--lb-color-primary-hover)] active:bg-[var(--lb-color-primary-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lb-color-focus-ring)]"
                    >
                        <KeyRound size={16} />
                        Verify
                    </Button>
                </form>

                <p className="text-center text-sm text-subdued">
                    Lost your authenticator? Contact the system administrator.
                </p>
            </div>
        </div>
    );
}
