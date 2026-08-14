const POSITIVE = new Set(['1', 'true', 'on', 'enabled', 'yes'])

/**
 * ART-22 / ART-16 / NEVER-R3 fail-closed gate, mirroring the api-gateway kill switch
 * at services/api-gateway/src/middleware/appPlatformKillSwitch.ts and the merchant
 * mirror at apps/merchant-control-plane/src/lib/app-platform-flag.ts.
 *
 * Guards the OPERATOR plane of the frozen seam: marketplace listing review/approval
 * and the developer back office (moderation, payouts, disputes).
 *
 * Absent, empty, or malformed value => DISABLED. FEATURE_APP_PLATFORM is intentionally
 * not declared in any deploy workflow env block, so every deploy shape is off.
 * Re-enabling is a human-approved constitutional act. Do NOT set this variable.
 */
export function isAppPlatformEnabled(): boolean {
    const value = process.env.FEATURE_APP_PLATFORM?.trim().toLowerCase()
    return value ? POSITIVE.has(value) : false
}
