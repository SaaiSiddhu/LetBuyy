import { canUseIdentityDevAuthBypass } from './dev-auth-bypass'

/**
 * Server-side Cloudflare Turnstile token verification.
 * Call this in API routes before processing form submissions.
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
    if (token === 'dev-bypass-token') {
        return canUseIdentityDevAuthBypass(process.env)
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
        console.warn('TURNSTILE_SECRET_KEY not set — bot verification failed closed')
        return false
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: secretKey,
                response: token,
                remoteip: ip,
            }),
        })

        const data = await response.json()
        return data.success === true
    } catch (error) {
        console.error('Turnstile verification failed:', error)
        return false
    }
}
