import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt with 12 salt rounds.
 * ~250ms per hash — intentionally slow to resist brute-force.
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a plain-text password against a bcrypt hash.
 * Uses timing-safe comparison internally.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

/**
 * Validate password strength requirements.
 * Returns an object with pass/fail for each rule.
 */
export function validatePasswordStrength(password: string): {
    isValid: boolean
    rules: {
        minLength: boolean
        hasUppercase: boolean
        hasNumber: boolean
    }
} {
    const rules = {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    }

    return {
        isValid: Object.values(rules).every(Boolean),
        rules,
    }
}
