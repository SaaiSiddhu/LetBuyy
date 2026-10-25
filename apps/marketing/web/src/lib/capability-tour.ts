// Clockwise order in the existing Commerce OS graph.
export const CAPABILITY_TOUR = ['storefronts', 'orders', 'payments', 'analytics', 'inventory', 'customers', 'ai', 'b2b'] as const
export type CapabilityId = typeof CAPABILITY_TOUR[number]
export const TOUR_STEP_MS = 3000

export function nextCapability(current: CapabilityId): CapabilityId {
    return CAPABILITY_TOUR[(CAPABILITY_TOUR.indexOf(current) + 1) % CAPABILITY_TOUR.length]
}

export const TOUR_READING_PAUSE_MS = 8000

export function previousCapability(current: CapabilityId): CapabilityId {
    return CAPABILITY_TOUR[(CAPABILITY_TOUR.indexOf(current) + CAPABILITY_TOUR.length - 1) % CAPABILITY_TOUR.length]
}

/** A deliberate horizontal swipe, not a tap, diagonal movement or vertical page scroll. */
export function capabilitySwipeDirection(deltaX: number, deltaY: number, width: number): -1 | 0 | 1 {
    const threshold = Math.max(40, Math.min(72, width * 0.12))
    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.4) return 0
    return deltaX < 0 ? 1 : -1
}

export function capabilityTourIsDue(now: number, nextAt: number, touching: boolean, pausedUntil: number): boolean {
    return !touching && now >= pausedUntil && now >= nextAt
}
