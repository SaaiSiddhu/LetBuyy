import { createHash } from 'crypto'
import { createServerClient } from '../supabase/server'

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
 * Returns the device ID.
 */
export async function getOrCreateDevice(
    userId: string,
    fingerprint: string,
    userAgent: string
): Promise<string> {
    const supabase = await createServerClient()
    const deviceName = parseDeviceName(userAgent)

    // Try to find existing device
    const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .single()

    if (existing) {
        // Update last_used
        await supabase
            .from('devices')
            .update({ last_used: new Date().toISOString(), name: deviceName })
            .eq('id', existing.id)
        return existing.id
    }

    // Create new device
    const { data: newDevice, error } = await supabase
        .from('devices')
        .insert({
            user_id: userId,
            fingerprint,
            name: deviceName,
        })
        .select('id')
        .single()

    if (error || !newDevice) {
        throw new Error(`Failed to create device: ${error?.message}`)
    }

    return newDevice.id
}

/**
 * Check if a device is trusted for a user.
 */
export async function isDeviceTrusted(
    userId: string,
    fingerprint: string
): Promise<boolean> {
    const supabase = await createServerClient()

    const { data } = await supabase
        .from('devices')
        .select('trusted')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .single()

    return data?.trusted ?? false
}
