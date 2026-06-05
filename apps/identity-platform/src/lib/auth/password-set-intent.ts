import { identityApiRequest } from '@/lib/api/client'

export const PASSWORD_SET_INTENT_COOKIE = 'lb_password_set_intent'
export const PASSWORD_SET_INTENT_TTL_SECONDS = 15 * 60

export interface PasswordSetIntent {
    id: string
    user_id: string
    email: string
    expires_at: string
}

interface PasswordSetIntentResponse {
    data?: PasswordSetIntent | null
    error?: {
        message?: string
    }
}

export async function createPasswordSetIntent(userId: string, email: string): Promise<PasswordSetIntent> {
    const response = await identityApiRequest('/auth/custom/password-set-intents/create', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            email,
        }),
    })
    const payload = await response.json().catch(() => null) as PasswordSetIntentResponse | null

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message || 'Unable to create password set intent')
    }

    return payload.data
}

export async function consumePasswordSetIntent(intentId: string): Promise<PasswordSetIntent> {
    const response = await identityApiRequest('/auth/custom/password-set-intents/consume', {
        method: 'POST',
        body: JSON.stringify({
            intent_id: intentId,
        }),
    })
    const payload = await response.json().catch(() => null) as PasswordSetIntentResponse | null

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message || 'Password set intent is invalid or expired')
    }

    return payload.data
}
