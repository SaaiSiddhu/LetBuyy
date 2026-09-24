import { identityApiRequest } from '@/lib/api/client'

type TokenType = 'email_verify' | 'magic_link' | 'password_reset'

interface TokenResponse {
    data?: {
        token: string
    } | null
    error?: {
        message?: string
    }
}

interface TokenValidationResponse {
    data?: {
        email: string
        user_id: string | null
    } | null
}

/**
 * Create an OTP token and store it in the database.
 * The OTP is stored as the `token` field in verification_tokens.
 * Invalidates any existing OTPs for this email.
 */
export async function createOTPToken(
    email: string,
    userId?: string
): Promise<string> {
    const response = await identityApiRequest('/auth/custom/tokens/create', {
        method: 'POST',
        body: JSON.stringify({
            email,
            type: 'email_verify',
            user_id: userId || null,
            otp: true,
        }),
    })
    const payload = await response.json().catch(() => null) as TokenResponse | null

    if (!response.ok || !payload?.data?.token) {
        throw new Error(`Failed to create OTP token: ${payload?.error?.message || response.statusText}`)
    }

    return payload.data.token
}

/**
 * Validate an OTP code for a given email.
 * Marks the token as used upon successful validation.
 * Returns the token record or null if invalid.
 */
export async function validateOTPToken(
    email: string,
    otp: string
): Promise<{
    email: string
    user_id: string | null
} | null> {
    const response = await identityApiRequest('/auth/custom/tokens/validate', {
        method: 'POST',
        body: JSON.stringify({
            email,
            token: otp,
            type: 'email_verify',
        }),
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null) as TokenValidationResponse | null
    return payload?.data || null
}

/**
 * Create a verification token and store it in the database.
 * Invalidates any existing unused tokens of the same type for this email.
 */
export async function createVerificationToken(
    email: string,
    type: TokenType,
    userId?: string
): Promise<string> {
    const response = await identityApiRequest('/auth/custom/tokens/create', {
        method: 'POST',
        body: JSON.stringify({
            email,
            type,
            user_id: userId || null,
        }),
    })
    const payload = await response.json().catch(() => null) as TokenResponse | null

    if (!response.ok || !payload?.data?.token) {
        throw new Error(`Failed to create verification token: ${payload?.error?.message || response.statusText}`)
    }

    return payload.data.token
}

/**
 * Validate a token: check it exists, is unused, and hasn't expired.
 * Marks the token as used upon successful validation (single-use).
 * Returns the token record or null if invalid.
 */
export async function validateToken(
    token: string,
    type: TokenType
): Promise<{
    email: string
    user_id: string | null
} | null> {
    const response = await identityApiRequest('/auth/custom/tokens/validate', {
        method: 'POST',
        body: JSON.stringify({
            token,
            type,
        }),
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null) as TokenValidationResponse | null
    return payload?.data || null
}
