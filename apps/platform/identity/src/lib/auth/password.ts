import { PasswordUpdateSchema } from '@letbuyy/auth-core'

/** Show the same requirements that the canonical Merchant credential owner enforces. */
export function validatePasswordStrength(password: string) {
    const rules = {
        minLength: password.length >= 8,
        maxLength: password.length <= 128,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password),
    }
    return { isValid: PasswordUpdateSchema.safeParse({ password }).success, rules }
}
