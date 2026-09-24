import { createHash } from 'crypto'
import { identityApiRequest } from '@/lib/api/client'

/**
 * Generate a device fingerprint from request headers.
 * Combines User-Agent + Accept-Language + IP prefix for a stable fingerprint.
 */
export function generateDeviceFingerprint(headers: Headers, ip?: string): string {
    const ua = headers.get('user-agent') || 'unknown'
    const lang = headers.get('accept-language') || 'unknown'
    // Use IP prefix (first 3 octets) for partial IP stability
    const ipPrefix = ip ? ip.split('.').slice(0, 3).join('.') : 'unknown'

    const raw = `${ua}|${lang}|${ipPrefix}`
    return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * Parse User-Agent into a human-readable device name.
 * e.g., "Chrome on macOS", "Safari on iPhone"
 */
export function parseDeviceName(userAgent: string): string {
    const ua = userAgent.toLowerCase()

    // Detect browser
    let browser = 'Unknown Browser'
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
    else if (ua.includes('firefox')) browser = 'Firefox'
    else if (ua.includes('edg')) browser = 'Edge'

    // Detect OS
    let os = 'Unknown OS'
    if (ua.includes('iphone')) os = 'iPhone'
    else if (ua.includes('ipad')) os = 'iPad'
    else if (ua.includes('android')) os = 'Android'
    else if (ua.includes('mac')) os = 'macOS'
    else if (ua.includes('windows')) os = 'Windows'
    else if (ua.includes('linux')) os = 'Linux'

    return `${browser} on ${os}`
}

/**
 * Get or create a device record for a user.
 * Returns the device ID and whether the device is new.
 */
export async function getOrCreateDevice(
    userId: string,
    fingerprint: string,
    userAgent: string
): Promise<{ deviceId: string; isNew: boolean }> {
    const response = await identityApiRequest('/auth/custom/devices/get-or-create', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            fingerprint,
            user_agent: userAgent,
        }),
    })
    const payload = await response.json().catch(() => null) as {
        data?: {
            device_id: string
            is_new: boolean
        }
        error?: {
            message?: string
        }
    } | null

    if (!response.ok || !payload?.data) {
        throw new Error(`Failed to create device: ${payload?.error?.message || response.statusText}`)
    }

    return { deviceId: payload.data.device_id, isNew: payload.data.is_new }
}

/**
 * Check if a device is trusted for a user.
 */
export async function isDeviceTrusted(
    userId: string,
    fingerprint: string
): Promise<boolean> {
    const response = await identityApiRequest('/auth/custom/devices/trusted', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            fingerprint,
        }),
    })
    if (!response.ok) return false

    const payload = await response.json().catch(() => null) as {
        data?: {
            trusted?: boolean
        }
    } | null

    return Boolean(payload?.data?.trusted)
}
