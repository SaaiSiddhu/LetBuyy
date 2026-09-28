// Extracted from console-mfa.ts (Phase 2 auth hardening, Section 6: console session revocation).
// Zero imports, deliberately: proxy.ts (this app's real Next.js middleware entry -- Next.js renamed
// `middleware.ts` to `proxy.ts`, see tests/launch/lb1-storefront-middleware.test.mjs) must re-check
// this allowlist on every request, and middleware may run in a runtime that cannot load
// console-mfa.ts's `node:crypto` (createHmac/timingSafeEqual, used only by its TOTP verification --
// unrelated to this check). Keeping this predicate in its own file with no further imports means
// proxy.ts can depend on it directly without pulling in TOTP/crypto code at all.
//
// console-mfa.ts re-exports these three so every existing caller of it is unaffected.

export function normalizeConsoleEmail(email: string) {
    return email.trim().toLowerCase();
}

export function getAllowedConsoleEmails() {
    return (process.env.PLATFORM_CONSOLE_ALLOWED_EMAILS || '')
        .split(',')
        .map((email) => normalizeConsoleEmail(email))
        .filter(Boolean);
}

export function isConsoleEmailAllowed(email: string) {
    const allowedEmails = getAllowedConsoleEmails();
    if (allowedEmails.length === 0) return false;
    return allowedEmails.includes(normalizeConsoleEmail(email));
}
