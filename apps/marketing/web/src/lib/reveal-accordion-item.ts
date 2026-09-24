import { smoothScrollTo } from './smooth-scroll'

/** Breathing room between the fixed site header and the anchored row. */
const HEADER_GAP = 24

/**
 * The site header is fixed and changes height as the page scrolls, so the
 * clearance is measured rather than hardcoded — a stale constant is what lets
 * a card slide underneath it.
 */
function headerClearance(): number {
    const header = document.querySelector('header')
    const height = header ? header.getBoundingClientRect().height : 0
    return Math.round(height) + HEADER_GAP
}

/**
 * Positions a freshly opened accordion item so the reader keeps their bearings:
 * the previous collapsed row stays visible above it and the next collapsed row
 * below, with the open panel in between. When the three cannot fit the viewport
 * the open item is top-aligned instead, so its content wins the space.
 *
 * `item` must be a direct sibling of the other rows.
 */
function scrollAccordionItemToAnchor(item: HTMLElement, immediate: boolean): void {
    const clearance = headerClearance()
    const prev = item.previousElementSibling as HTMLElement | null
    const next = item.nextElementSibling as HTMLElement | null

    const openHeight = item.offsetHeight
    const prevHeight = prev?.offsetHeight ?? 0
    const nextHeight = next?.offsetHeight ?? 0
    const trioFits = clearance + prevHeight + openHeight + nextHeight <= window.innerHeight

    const anchor = trioFits && prev ? prev : item
    smoothScrollTo(window.scrollY + anchor.getBoundingClientRect().top - clearance, { immediate })
}

/**
 * Opening an item also collapses the previously open one, which is usually
 * *above* it — measuring before that collapse finishes would scroll the card up
 * underneath the fixed header. Wait until the item stops moving, then scroll,
 * then verify: if anything shifted during the scroll and the row still ended up
 * beneath the header, nudge it back down.
 *
 * Returns a cleanup function; call it if the item closes or unmounts first.
 */
export function revealAccordionItem(item: HTMLElement, immediate: boolean): () => void {
    let previousTop = Number.NaN
    let frames = 0
    let raf = 0
    let done = false
    let verify = 0

    // Panel transitions here run 0.2s–0.26s. This also covers throttled rAF
    // (background tab), where the settle loop would otherwise never run.
    const fallback = window.setTimeout(() => finish(), 350)

    function finish() {
        if (done) return
        done = true
        cancelAnimationFrame(raf)
        window.clearTimeout(fallback)
        scrollAccordionItemToAnchor(item, immediate)

        // Safety net: the smooth scroll takes ~0.7s, and a late layout shift or
        // a mobile URL bar resize can still leave the row under the header.
        verify = window.setTimeout(() => {
            const clearance = headerClearance()
            const top = item.getBoundingClientRect().top
            if (top < clearance - 4) {
                smoothScrollTo(window.scrollY + top - clearance, { immediate: true })
            }
        }, 900)
    }

    const step = () => {
        if (done) return
        const top = item.getBoundingClientRect().top
        const settled = Math.abs(top - previousTop) < 0.5
        // ~40 frames is a safety net if a transition never reports as still.
        if (settled || frames++ > 40) {
            finish()
            return
        }
        previousTop = top
        raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)

    return () => {
        done = true
        cancelAnimationFrame(raf)
        window.clearTimeout(fallback)
        window.clearTimeout(verify)
    }
}
