import { Button, Input, Mail, ShieldCheck } from '@letbuyy/ui';

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
        case 'magic_link_delivery_not_configured':
            return 'Platform console magic-link delivery is not configured.';
        case 'session_secret_not_configured':
            return 'Console session signing is not configured.';
        case 'session_unavailable':
            return 'Your session is unavailable or has been revoked. Sign in again, or retry when service is restored.';
        case 'logout_unavailable':
            return 'Sign-out could not be saved. Retry sign-out when service is restored.';
        case 'access_revoked':
            return 'Console access has been revoked.';
        case 'invalid_magic_link':
            return 'This magic link is invalid or expired.';
        case 'missing_token':
            return 'The authentication callback is missing a token.';
        default:
            return null;
    }
}

export default async function ConsoleLoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
    const params = await searchParams;
    const error = errorMessage(firstParam(params.error));
    const authenticatorReset=firstParam(params.notice)==='operator_mfa_reset';
    const sent = firstParam(params.sent) === '1';
    const loggedOut = firstParam(params.loggedOut) === '1';
    const devMagicLink = firstParam(params.devMagicLink);

    return (
        <div className="console-auth flex min-h-screen items-center justify-center bg-page">
            <div className="console-auth-card w-full max-w-md space-y-8 rounded-lg border border-line bg-surface p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lb-color-primary-subtle)] text-[var(--lb-color-primary)]">
                        <ShieldCheck size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-default">Welcome to the console</h1>
                    <p className="mt-2 text-sm text-subdued">
                        Sign in to your LetBuyy operations workspace.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
                        {error}
                    </div>
                )}

                {authenticatorReset && <p role="status" className="rounded-lg border border-line p-4 text-default">Your operator authenticator was reset and you were signed out. Sign in after your configuration custodian provides a replacement factor.</p>}

                {sent && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                        {devMagicLink && process.env.NODE_ENV !== 'production'
                            ? 'Local development magic link generated. No email was sent.'
                            : 'Magic link sent to the allowlisted email.'}
                    </div>
                )}

                {loggedOut && (
                    <div className="rounded-lg border border-line bg-surface-subdued px-4 py-3 text-sm text-default">
                        Signed out.
                    </div>
                )}

                {devMagicLink && process.env.NODE_ENV !== 'production' && (
                    <a
                        href={devMagicLink}
                        className="block rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning transition-colors hover:bg-warning/20"
                    >
                        Open local development magic link
                    </a>
                )}

                <form action="/api/console-auth/login" method="post" className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-default">
                            Email
                        </label>
                        <Input
                            unstyled
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="admin@letbuyy.com"
                            className="mt-1 w-full rounded-lg border border-line bg-surface-subdued px-4 py-2.5 text-sm text-default outline-none focus:border-[var(--lb-color-primary)] focus:ring-2 focus:ring-[var(--lb-color-primary-subtle)]"
                        />
                    </div>
                    <Button
                        unstyled
                        type="submit"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--lb-color-primary-cta)] px-4 py-2.5 text-sm font-medium text-[var(--lb-color-primary-cta-text)] transition-colors hover:bg-[var(--lb-color-primary-hover)] active:bg-[var(--lb-color-primary-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lb-color-focus-ring)]"
                    >
                        <Mail size={16} />
                        Send magic link
                    </Button>
                </form>

                <p className="text-center text-xs text-subdued">
                    For authorized LetBuyy team members. Access and actions are recorded.
                </p>
            </div>
        </div>
    );
}
