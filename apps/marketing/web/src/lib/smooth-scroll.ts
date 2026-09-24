import type Lenis from 'lenis'

/**
 * The landing page drives scrolling through Lenis. Its rAF loop reclaims the
 * scroll position every frame, so `scrollIntoView` / `window.scrollTo` are
 * silently undone. Components that need to scroll must go through the running
 * instance — this module holds the reference the page registers on mount.
 */
let lenis: Lenis | null = null

export function registerSmoothScroll(instance: Lenis | null): void {
    lenis = instance
}

/** Scroll to an absolute document Y, honouring Lenis when it is active. */
export function smoothScrollTo(top: number, options?: { immediate?: boolean }): void {
    const y = Math.max(0, Math.round(top))
    const immediate = options?.immediate ?? false

    if (lenis) {
        lenis.scrollTo(y, { duration: immediate ? 0 : 0.7 })
        return
    }

    window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
}
