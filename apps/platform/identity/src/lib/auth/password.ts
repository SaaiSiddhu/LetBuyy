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
