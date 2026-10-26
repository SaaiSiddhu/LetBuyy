'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { smoothScrollTo } from '@/lib/smooth-scroll'
import CommerceGlobeCanvas from './CommerceGlobeCanvas'

export default function CommerceGlobe({ placement = 'section' }: { placement?: 'hero' | 'section' }) {
    const { t } = useCopy()
    const rootRef = useRef<HTMLElement>(null)
    const entered = useInView(rootRef, { once: true, margin: '200px' })
    const visible = useInView(rootRef, { amount: 0.15 })
    const reducedMotion = useReducedMotion()
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)
    const [documentVisible, setDocumentVisible] = useState(true)
    const moving = visible && documentVisible && reducedMotion === false && !hovered && !focused

    useEffect(() => {
        const sync = () => setDocumentVisible(!document.hidden)
        sync()
        document.addEventListener('visibilitychange', sync)
        return () => document.removeEventListener('visibilitychange', sync)
    }, [])

    useEffect(() => {
        const align = () => {
            const root = rootRef.current
            if (!root || window.location.hash !== '#commerce-globe') return
            const header = document.querySelector('header')?.getBoundingClientRect().height ?? 80
            smoothScrollTo(window.scrollY + root.getBoundingClientRect().top - header - 24, { immediate: true })
        }
        const timer = window.setTimeout(align, 500)
        window.addEventListener('hashchange', align)
        return () => { window.clearTimeout(timer); window.removeEventListener('hashchange', align) }
    }, [])

    return (
        <figure className={`commerce-globe commerce-globe--cinematic${placement === 'hero' ? ' commerce-globe--hero' : ''}`} ref={rootRef} id="commerce-globe" tabIndex={0} onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} aria-label={t("Illustrative store creation journey from Tamil Nadu across India and the world")}>
            <figcaption className="cg-accessible-caption"><Copy text={"A one-time illustrative journey: a detailed Tamil Nadu map expands to India and fades into a dotted globe. Stores appear across India, then Pakistan, China, Japan and other continents. At the end, the globe’s dots scatter outward and a large “LetBuyy — Sell worldwide” title resolves into place with a brief flicker, then holds still. Reduced-motion visitors see the final title without animation. The journey does not restart. Example activity, not live merchant data. Hover or focus this illustration to pause motion."} /></figcaption>
            <CommerceGlobeCanvas moving={moving} enabled={entered} staticFinal={reducedMotion === true} />
        </figure>
    )
}
