/**
 * Android download destinations for the LetBuyy merchant app.
 *
 * Both are deploy-time configuration — there is no published Play Store
 * listing or hosted APK yet, so the footer renders a "coming soon" state
 * rather than linking somewhere that does not exist. Set these to switch the
 * buttons live; no code change needed.
 */
export interface AppDownloadTargets {
    playStoreUrl: string | null
    apkUrl: string | null
    /** True once at least one destination is configured. */
    available: boolean
}

function readUrl(value: string | undefined): string | null {
    const trimmed = value?.trim()
    if (!trimmed) return null
    // Only accept absolute http(s) targets — a half-set env var should not
    // render as a broken relative link.
    return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

export function getAppDownloadTargets(): AppDownloadTargets {
    const playStoreUrl = readUrl(process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL)
    const apkUrl = readUrl(process.env.NEXT_PUBLIC_ANDROID_APK_URL)

    return {
        playStoreUrl,
        apkUrl,
        available: Boolean(playStoreUrl || apkUrl),
    }
}
