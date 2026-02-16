import { randomBytes, randomInt } from 'crypto'
import { createServerClient } from '../supabase/server'

type TokenType = 'email_verify' | 'magic_link' | 'password_reset'

const TOKEN_EXPIRY: Record<TokenType, number> = {
    email_verify: 60 * 60 * 1000,       // 1 hour
    magic_link: 15 * 60 * 1000,         // 15 minutes
    password_reset: 60 * 60 * 1000,     // 1 hour
}

const OTP_EXPIRY = 10 * 60 * 1000 // 10 minutes
const OTP_MAX_ATTEMPTS = 3

/**
 * Generate a cryptographically secure random token (64 hex chars).
 */
export function generateToken(): string {
    return randomBytes(32).toString('hex')
}

/**
 * Generate a 6-digit OTP code.
 */
export function generateOTP(): string {
    return randomInt(100000, 999999).toString()
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
    const supabase = await createServerClient()
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY).toISOString()

    // Invalidate existing unused OTP tokens for this email
    await supabase
        .from('verification_tokens')
        .update({ used: true })
        .eq('email', email)
        .eq('type', 'email_verify')
        .eq('used', false)

    // Create new OTP token
    const { error } = await supabase.from('verification_tokens').insert({
        email,
        token: otp,
        type: 'email_verify',
        user_id: userId || null,
        expires_at: expiresAt,
    })

    if (error) {
        throw new Error(`Failed to create OTP token: ${error.message}`)
    }

    return otp
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
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('verification_tokens')
        .select('id, email, user_id, expires_at, used')
        .eq('email', email)
        .eq('token', otp)
        .eq('type', 'email_verify')
        .eq('used', false)
        .single()

    if (error || !data) return null
    if (new Date(data.expires_at) < new Date()) return null

    // Mark as used
    await supabase
        .from('verification_tokens')
        .update({ used: true })
        .eq('id', data.id)

    return {
        email: data.email,
        user_id: data.user_id,
    }
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
    const supabase = await createServerClient()
    const token = generateToken()
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY[type]).toISOString()

    // Invalidate existing unused tokens of the same type for this email
    await supabase
        .from('verification_tokens')
        .update({ used: true })
        .eq('email', email)
        .eq('type', type)
        .eq('used', false)

    // Create new token
    const { error } = await supabase.from('verification_tokens').insert({
        email,
        token,
        type,
        user_id: userId || null,
        expires_at: expiresAt,
    })

    if (error) {
        throw new Error(`Failed to create verification token: ${error.message}`)
    }

    return token
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
    const supabase = await createServerClient()

    const { data, error } = await supabase
        .from('verification_tokens')
        .select('id, email, user_id, expires_at, used')
        .eq('token', token)
        .eq('type', type)
        .single()

    if (error || !data) return null
    if (data.used) return null
    if (new Date(data.expires_at) < new Date()) return null

    // Mark as used (single-use token)
    await supabase
        .from('verification_tokens')
        .update({ used: true })
        .eq('id', data.id)

    return {
        email: data.email,
        user_id: data.user_id,
    }
}
