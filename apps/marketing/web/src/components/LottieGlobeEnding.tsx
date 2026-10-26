'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'

export interface LottieGlobeEndingHandle { seek: (milliseconds: number, finished: boolean) => void }
const FPS = 60
const INTRO_END = 156
const LOOP_END = 636

/** SVG-only Lottie, lazily loaded; the globe clock owns the intro, not a second timer. */
const LottieGlobeEnding = forwardRef<LottieGlobeEndingHandle, { enabled: boolean; moving: boolean; reducedMotion: boolean }>(function LottieGlobeEnding({ enabled, moving, reducedMotion }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<AnimationItem | null>(null)
    const timelineRef = useRef({ milliseconds: 0, finished: false })
    const movingRef = useRef(moving)
    const readyRef = useRef(false)
    const loopingRef = useRef(false)
    const lastFrameRef = useRef(-1)

    const paint = useCallback(() => {
        const player = playerRef.current
        if (!player || !readyRef.current) return
        const { milliseconds, finished } = timelineRef.current
        if (!finished) {
            const frame = Math.min(INTRO_END, milliseconds * FPS / 1000)
            if (lastFrameRef.current !== frame) player.goToAndStop(frame, true)
            lastFrameRef.current = frame
            return
        }
        // Loop only the settled gradient segment. Never replay the letters or globe.
        if (!loopingRef.current) {
            loopingRef.current = true
            player.loop = true
            player.playSegments([INTRO_END, LOOP_END], true)
        }
        if (movingRef.current) player.play()
        else player.pause()
    }, [])

    useImperativeHandle(ref, () => ({ seek(milliseconds, finished) {
        timelineRef.current = { milliseconds, finished }
        paint()
    } }), [paint])

    useEffect(() => { movingRef.current = moving; paint() }, [moving, paint])

    useEffect(() => {
        const host = hostRef.current
        // The existing complete, static text is the reduced-motion and loading fallback.
        if (!enabled || reducedMotion || !host) return
        let disposed = false
        const controller = new AbortController()
        const fail = () => {
            readyRef.current = false
            playerRef.current?.destroy()
            playerRef.current = null
            if (host.parentElement) delete host.parentElement.dataset.lottie
        }
        Promise.all([
            import('lottie-web/build/player/lottie_light'),
            fetch('/animations/letbuyy-finale-v1.json', { signal: controller.signal }).then(response => {
                if (!response.ok) throw new Error('Closing animation unavailable')
                return response.json()
            }),
        ]).then(([{ default: lottie }, animationData]) => {
            if (disposed) return
            const player = lottie.loadAnimation({
                container: host, renderer: 'svg', loop: false, autoplay: false, animationData,
                rendererSettings: { preserveAspectRatio: 'xMidYMid meet', hideOnTransparent: true },
            })
            playerRef.current = player
            const ready = () => {
                if (disposed) return
                readyRef.current = true
                paint()
                if (host.parentElement) host.parentElement.dataset.lottie = 'ready'
            }
            player.addEventListener('DOMLoaded', ready)
            player.addEventListener('data_failed', fail)
            player.addEventListener('error', fail)
            if (player.isLoaded) ready()
        }).catch(() => { if (!disposed) fail() })
        return () => {
            disposed = true
            controller.abort()
            readyRef.current = false
            loopingRef.current = false
            lastFrameRef.current = -1
            playerRef.current?.destroy()
            playerRef.current = null
            if (host.parentElement) delete host.parentElement.dataset.lottie
        }
    }, [enabled, reducedMotion, paint])

    return <div className="cg-lottie-ending" ref={hostRef} aria-hidden="true" />
})

export default LottieGlobeEnding
