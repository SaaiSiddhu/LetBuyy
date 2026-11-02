import { NextResponse } from 'next/server'
import { verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core'

interface SessionReadDependencies {
    getSessionCookie(): Promise<string | undefined | null>
    requestSession(token: string): Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>
    setSessionCookie(token: string): Promise<void>
}

const record = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null

/** Preserve the canonical reader's denial versus outage distinction at the Next boundary. */
export function createMerchantSessionRead(dependencies: SessionReadDependencies) {
    const reply = (body: Record<string, unknown>, status = 200) =>
        NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
    const unavailable = () => reply({ error: { code: 'SESSION_UNAVAILABLE', message: 'Sign-in could not be confirmed. Please retry.' } }, 503)
    return async function readSession() {
        try {
            const token = await dependencies.getSessionCookie()
            if (!token || !verifyLetbuyySessionCookieValue('merchant', token).accepted) return reply({ authenticated: false })
            const response = await dependencies.requestSession(token)
            const payload = record(await response.json())
            if ([200, 401, 403].includes(response.status) && payload?.authenticated === false) {
                return reply({ authenticated: false })
            }
            // A rejected internal signature or a database/transport failure is
            // not evidence that this user's previously issued token expired.
            if (!response.ok || payload?.authenticated !== true) return unavailable()
            const user = record(payload.user)
            if (typeof user?.id !== 'string' || !user.id.trim() || typeof user.email !== 'string' || !user.email.trim()) return unavailable()
            const { rotated_session_token: rotatedToken, ...session } = payload
            if (rotatedToken !== undefined) {
                if (typeof rotatedToken !== 'string' || !verifyLetbuyySessionCookieValue('merchant', rotatedToken).accepted) return unavailable()
                await dependencies.setSessionCookie(rotatedToken)
            }
            return reply(session)
        } catch {
            return unavailable()
        }
    }
}
