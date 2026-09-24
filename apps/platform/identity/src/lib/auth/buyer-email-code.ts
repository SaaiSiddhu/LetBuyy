// APPID-P4a — identity-platform's wording for the gateway's buyer email-code outcomes.
//
// The gateway decides whether a code is good (migration 257); identity-platform decides what a buyer
// reads. The mapping is keyed by the gateway's error CODE, never its message: this app owns the words
// on its pages, as getIdentityApiFailureMessage already assumes, and a code is a contract where a
// message is not.

export const BUYER_EMAIL_CODE_PATTERN = /^\d{6}$/
export const BUYER_PASSWORD_MIN = 8
export const BUYER_PASSWORD_MAX = 128

export function gatewayErrorCode(payload: unknown): string | undefined {
    const error = (payload as { error?: { code?: unknown } } | null)?.error
    return typeof error?.code === 'string' ? error.code : undefined
}

const CODE_FAILURES: Record<string, { status: number; error: string }> = {
    CODE_INVALID: { status: 400, error: 'That code is incorrect or has already been used.' },
    CODE_EXPIRED: { status: 400, error: 'That code has expired. Request a new one.' },
    CODE_LOCKED: { status: 429, error: 'Too many incorrect attempts. Request a new code.' },
    ADDRESS_CHANGED: { status: 409, error: 'Your email address changed after this code was sent. Request a new code.' },
    TOO_MANY_CODES: { status: 429, error: 'Too many codes requested. Try again in an hour.' },
    EMAIL_UNAVAILABLE: { status: 503, error: "We couldn't send the code right now. Try again in a few minutes." },
    BUYER_DISABLED: { status: 403, error: 'This account is disabled.' },
}

const SESSION_ENDED = { status: 401, error: 'Your session has ended. Sign in again.' }
const UNAVAILABLE = { status: 503, error: 'Something went wrong. Try again in a moment.' }

/// `signedIn` is true on routes that forwarded the buyer's session, where the gateway's 401 means the
/// session has ended. Elsewhere a 401 can only mean identity-platform's own signature was refused,
/// which is a fault here, not the buyer's.
export function buyerEmailCodeFailure(payload: unknown, options: { signedIn: boolean }): { status: number; error: string } {
    const code = gatewayErrorCode(payload)
    if (code === 'UNAUTHORIZED') return options.signedIn ? SESSION_ENDED : UNAVAILABLE
    return (code && CODE_FAILURES[code]) || UNAVAILABLE
}
