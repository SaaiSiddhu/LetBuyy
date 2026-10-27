import { isIP } from 'node:net'
import { canUseIdentityDevAuthBypass } from './dev-auth-bypass'
import { getLetbuyyInternalAuthSecret, verifyLetbuyySignedPayload } from '@letbuyy/auth-core'

const MOBILE_TURNSTILE_PROOF_PREFIX = 'lb-mobile-turnstile-v1'

type MobileTurnstileProofPayload = {
    type: 'letbuyy.mobile_turnstile_proof'
    source: 'mobile-bff'
    provider: 'cloudflare_turnstile'
    status: 'verified'
    token_hash: string
    remote_ip_hash: string | null
    iat: number
    exp: number
    jti: string
}

function decodeBase64UrlJson(value: string): unknown {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
        return JSON.parse(new TextDecoder().decode(bytes))
    } catch {
        return null
    }
}

function isMobileTurnstileProofPayload(value: unknown): value is MobileTurnstileProofPayload {
    if (!value || typeof value !== 'object') return false
    const payload = value as MobileTurnstileProofPayload
    return payload.type === 'letbuyy.mobile_turnstile_proof'
        && payload.source === 'mobile-bff'
        && payload.provider === 'cloudflare_turnstile'
        && payload.status === 'verified'
        && typeof payload.token_hash === 'string'
        && /^[a-f0-9]{64}$/i.test(payload.token_hash)
        && (payload.remote_ip_hash === null || /^[a-f0-9]{64}$/i.test(payload.remote_ip_hash))
        && typeof payload.iat === 'number'
        && typeof payload.exp === 'number'
        && typeof payload.jti === 'string'
        && payload.jti.length >= 16
}

export async function verifyMobileTurnstileProof(token: string): Promise<boolean> {
    const parts = token.split('.')
    if (parts.length !== 3 || parts[0] !== MOBILE_TURNSTILE_PROOF_PREFIX) return false

    const [, encodedPayload, signature] = parts
    const secret = getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
        LETBUYY_INTERNAL_API_SECRET: process.env.LETBUYY_INTERNAL_API_SECRET,
    })
    const signatureOk = await verifyLetbuyySignedPayload(secret, `${MOBILE_TURNSTILE_PROOF_PREFIX}.${encodedPayload}`, signature)
    if (!signatureOk) return false

    const payload = decodeBase64UrlJson(encodedPayload)
    if (!isMobileTurnstileProofPayload(payload)) return false

    const nowSeconds = Math.floor(Date.now() / 1000)
    return payload.iat <= nowSeconds + 60 && payload.exp > nowSeconds
}

/**
 * Server-side Cloudflare Turnstile token verification.
 * Call this in API routes before processing form submissions.
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
    if (token.startsWith(`${MOBILE_TURNSTILE_PROOF_PREFIX}.`)) {
        return verifyMobileTurnstileProof(token)
    }

    if (token === 'dev-bypass-token') {
        return canUseIdentityDevAuthBypass(process.env)
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
        console.warn('TURNSTILE_SECRET_KEY not set — bot verification failed closed')
        return false
    }

    const candidateIp=ip?.split(',')[0]?.trim()
    const remoteIp=candidateIp && isIP(candidateIp) ? candidateIp : undefined
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: secretKey,
                response: token,
                ...(remoteIp ? {remoteip:remoteIp} : {}),
            }),
        })

        const data = await response.json()
        return data.success === true
    } catch {
        console.error(JSON.stringify({level:'error',service:'accounts',reason:'turnstile_verification_unavailable'}))
        return false
    }
}
