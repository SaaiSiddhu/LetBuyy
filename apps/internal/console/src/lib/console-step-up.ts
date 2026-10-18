/** Restrict post-MFA navigation to the maintained protected-action surfaces. */
export function consoleStepUpReturnPath(value: unknown): string {
    if (typeof value !== 'string') return '/approvals';
    return /^\/(?:approvals(?:\/[0-9a-f-]{36})?|merchants\/[0-9a-f-]{36}|money-reconciliation|trust-safety(?:\/[0-9a-f-]{36})?)$/i.test(value) ? value : '/approvals';
}
