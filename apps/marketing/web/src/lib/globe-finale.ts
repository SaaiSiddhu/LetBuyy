/** One continuous clock owns the globe exit, particle burst and wordmark reveal. */
export const GLOBE_FINALE_DURATION_MS = 2600
export const GLOBE_CLOSING_BRAND = 'LetBuyy'

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

export function globeFinaleAt(milliseconds: number, journeyEnd: number) {
    const elapsed = Math.max(0, Math.min(GLOBE_FINALE_DURATION_MS, milliseconds - journeyEnd))
    const reveal = smooth((elapsed - 380) / 950)
    // Two small, one-time dimming notches; never a repeating or full-screen strobe.
    const notch = (center: number, halfWidth: number) => Math.max(0, 1 - Math.abs(elapsed - center) / halfWidth)
    const flicker = 1 - .32 * notch(930, 45) - .2 * notch(1120, 38)
    const letters = Array.from(GLOBE_CLOSING_BRAND, (_, index) => smooth((elapsed - 380 - index * 135) / 180))
    const brandComplete = letters.every(value => value === 1)
    return {
        elapsed,
        started: milliseconds >= journeyEnd,
        finished: elapsed === GLOBE_FINALE_DURATION_MS,
        sphereOpacity: 1 - smooth(elapsed / 540),
        particleOpacity: smooth(elapsed / 80) * (1 - smooth((elapsed - 1150) / 1250)),
        reveal,
        titleOpacity: reveal * flicker,
        letters,
        brandComplete,
        messageReveal: brandComplete ? smooth((elapsed - 1500) / 700) : 0,
        // A single soft light pass across the lettering, then a motionless hold.
        sheen: smooth((elapsed - 1250) / 1200),
    }
}

/** Stable seeds prevent particle jumps when resizing, pausing or changing theme. */
export function globeParticleSeed(index: number) {
    const hash = (salt: number) => {
        const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453
        return value - Math.floor(value)
    }
    return { spread: hash(1), twist: hash(2) - .5, speed: .65 + hash(3) * 1.3, size: .75 + hash(4) * .8 }
}

/** Coordinates stay normalized to the original sphere, independent of viewport size. */
export function globeParticleAt(x: number, y: number, seed: ReturnType<typeof globeParticleSeed>, milliseconds: number) {
    const seconds = Math.max(0, milliseconds) / 1000
    const delay = seed.spread * .2
    const age = Math.max(0, seconds - delay)
    const travel = Math.pow(age, 1.18) * seed.speed
    const angle = Math.atan2(y, x) + seed.twist * .8
    return {
        x: x + Math.cos(angle) * travel,
        y: y + Math.sin(angle) * travel + age * age * .07,
        size: seed.size,
        travel,
    }
}
