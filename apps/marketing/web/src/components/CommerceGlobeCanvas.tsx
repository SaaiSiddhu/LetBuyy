'use client'

import Copy from '@/components/i18n/Copy'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Store } from '@letbuyy/ui'
import { COMMERCE_STOPS, STORE_MOMENTS, createGlobeProjector, frameElapsed, globePlaybackAt, GLOBE_PRESENTATION_END_MS, globeFrameAt, globeRadius, locationVector, routeVector, storeVisibility } from '@/lib/commerce-globe'
import { createWorkerRenderer } from '@/lib/create-globe-worker'
import type { GlobePalette as Palette, SceneRenderer as Renderer } from '@/lib/globe-renderer-types'
import { GLOBE_CLOSING_BRAND, GLOBE_FINALE_DURATION_MS, globeFinaleAt } from '@/lib/globe-finale'

const ORIGIN = COMMERCE_STOPS[0]
const STORES = STORE_MOMENTS.map(moment => ({ ...moment, stop: COMMERCE_STOPS.find(stop => stop.id === moment.id)! }))
const ROUTES = STORES.map(({ stop }) => Array.from({ length: 81 }, (_, i) => routeVector(ORIGIN, stop, i / 80)))
export default function CommerceGlobeCanvas({ moving, enabled, staticFinal = false }: { moving: boolean; enabled: boolean; staticFinal?: boolean }) {
    const sceneRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<HTMLCanvasElement>(null)
    const movingRef = useRef(moving)
    const staticFinalRef = useRef(staticFinal)
    const completedRef = useRef(false)
    const [completed, setCompleted] = useState(false)
    const clockRef = useRef(0)
    const controlRef = useRef<(() => void) | null>(null)
    const [mapFailed, setMapFailed] = useState(false)
    const [retry, setRetry] = useState(0)
    const [workerFailed, setWorkerFailed] = useState(false)

    useEffect(() => { movingRef.current = moving; staticFinalRef.current = staticFinal; controlRef.current?.() }, [moving, staticFinal])

    useEffect(() => {
        const scene = sceneRef.current, canvas = canvasRef.current, overlay = overlayRef.current, particleCanvas = particlesRef.current
        if (!enabled || !scene || !canvas || !overlay || !particleCanvas) return
        const context = overlay.getContext('2d')
        if (!context) return
        const globeLayers = scene.querySelector<HTMLElement>('.cg-globe-layers')!
        const title = scene.querySelector<HTMLElement>('.cg-closing-title')!
        const letters = Array.from(title.querySelectorAll<HTMLElement>('.cg-closing-letter'))
        const pins = Array.from(scene.querySelectorAll<HTMLElement>('.cg-store-pin'))
        const labels = Array.from(scene.querySelectorAll<HTMLElement>('.cg-store-label'))
        let renderer: Renderer | null = null
        let frame = 0, previous = 0, width = 0, height = 0, disposed = false
        let palette: Palette
        let routeColor = ''
        const controller = new AbortController()
        const colorCanvas = document.createElement('canvas')
        colorCanvas.width = 1; colorCanvas.height = 1
        const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true })!

        function readColors() {
            const style = getComputedStyle(scene!)
            const colors = Object.fromEntries(['ocean', 'surface', 'coast', 'light'].map(role => {
                colorContext.fillStyle = style.getPropertyValue(`--cg-${role}`).trim()
                colorContext.fillRect(0, 0, 1, 1)
                const pixel = colorContext.getImageData(0, 0, 1, 1).data
                return [role, [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255]]
            })) as Pick<Palette, 'ocean' | 'surface' | 'coast' | 'light'>
            palette = { ...colors, opaque: style.getPropertyValue('--cg-opaque').trim() === '1' }
            routeColor = style.getPropertyValue('--cg-route').trim()
        }
        function draw() {
            if (disposed || !renderer || !width || !height) return
            if (staticFinalRef.current) clockRef.current = GLOBE_PRESENTATION_END_MS + GLOBE_FINALE_DURATION_MS
            const playback = globePlaybackAt(clockRef.current)
            const finale = globeFinaleAt(clockRef.current, GLOBE_PRESENTATION_END_MS)
            const opacity = String(finale.sphereOpacity)
            const visibility = finale.sphereOpacity === 0 ? 'hidden' : 'visible'
            if (globeLayers.style.opacity !== opacity) globeLayers.style.opacity = opacity
            if (globeLayers.style.visibility !== visibility) globeLayers.style.visibility = visibility
            const property = (element: HTMLElement, name: string, value: number) => {
                const text = String(value)
                if (element.style.getPropertyValue(name) !== text) element.style.setProperty(name, text)
            }
            property(title, '--cg-title-opacity', finale.titleOpacity)
            property(title, '--cg-title-reveal', finale.reveal)
            property(title, '--cg-message-reveal', finale.messageReveal)
            letters.forEach((letter, index) => property(letter, '--cg-letter-reveal', finale.letters[index]))
            if (finale.finished && !completedRef.current) {
                completedRef.current = true
                setCompleted(true)
            }
            const camera = globeFrameAt(!movingRef.current && clockRef.current === 0 ? 650 : playback.milliseconds)
            // Reduced-motion and initial paused visits still show the origin store.
            const time = !movingRef.current && clockRef.current === 0 ? .65 : camera.time
            renderer.paint({ camera, palette, finale })
            if (finale.started) { scene!.dataset.phase = finale.finished ? 'complete' : 'finale'; return }
            const project = createGlobeProjector(camera)
            const radius = globeRadius(width, height, camera, palette)
            const position = (point: ReturnType<typeof locationVector>) => {
                const p = project(point)
                return { x: width / 2 + p.x * radius, y: height / 2 + p.y * radius, depth: p.depth }
            }
            context!.clearRect(0, 0, width, height)
            let active = -1
            for (let i = 0; i < STORES.length; i++) {
                const { at, stop } = STORES[i]
                const visibility = storeVisibility(at, time, i === 0)
                const p = position(locationVector(stop))
                const visible = visibility * Math.min(1, Math.max(0, (p.depth - .08) / .18))
                const inBounds = p.x > 24 && p.x < width - 24 && p.y > 28 && p.y < height - 65
                const pin = pins[i]
                pin.style.opacity = String(inBounds ? visible : 0)
                pin.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${.65 + visibility * .35})`
                if (visible > .6 && inBounds && p.x > 95 && p.x < width - 95 && p.y < height - 100) active = i
                if (!i || !visibility) continue
                const progress = Math.min(1, Math.max(0, (time - at) / .7))
                context!.beginPath()
                let pen = false
                for (let j = 0; j <= Math.floor(progress * 80); j++) {
                    const point = position(ROUTES[i][j])
                    if (point.depth < .03) { pen = false; continue }
                    if (pen) context!.lineTo(point.x, point.y)
                    else context!.moveTo(point.x, point.y)
                    pen = true
                }
                context!.strokeStyle = routeColor
                context!.globalAlpha = visibility * (progress < 1 ? .85 : .26)
                context!.lineWidth = progress < 1 ? 1.7 : .8
                context!.stroke()
                if (progress < 1) {
                    const head = position(routeVector(ORIGIN, stop, progress))
                    if (head.depth > .03) {
                        context!.globalAlpha = visibility
                        context!.fillStyle = routeColor
                        context!.beginPath(); context!.arc(head.x, head.y, 3, 0, Math.PI * 2); context!.fill()
                    }
                }
            }
            context!.globalAlpha = 1
            labels.forEach((label, index) => { if (label.hidden !== (index !== active)) label.hidden = index !== active })
            scene!.dataset.phase = time < .9 ? 'tamil-nadu' : time < 2.6 ? 'india' : time < 3.4 ? 'reveal' : time < 5.05 ? 'asia' : 'world'
        }
        function tick(now: number) {
            clockRef.current = Math.min(GLOBE_PRESENTATION_END_MS + GLOBE_FINALE_DURATION_MS, clockRef.current + frameElapsed(previous, now) * 1000)
            previous = now
            draw()
            if (!globeFinaleAt(clockRef.current, GLOBE_PRESENTATION_END_MS).finished && movingRef.current) frame = requestAnimationFrame(tick)
        }
        function sync() {
            cancelAnimationFrame(frame)
            previous = 0
            draw()
            if (movingRef.current && renderer?.animated && !globeFinaleAt(clockRef.current, GLOBE_PRESENTATION_END_MS).finished) frame = requestAnimationFrame(tick)
        }
        function resize() {
            const rect = scene!.getBoundingClientRect()
            width = rect.width; height = rect.height
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            overlay!.width = Math.round(width * dpr); overlay!.height = Math.round(height * dpr)
            context!.setTransform(dpr, 0, 0, dpr, 0, 0)
            renderer?.resize(width, height, dpr)
            readColors(); draw()
        }
        function fail() { if (!disposed) { cancelAnimationFrame(frame); setMapFailed(true) } }
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(scene)
        const themeObserver = new MutationObserver(() => { readColors(); draw() })
        const themeOptions = { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] }
        themeObserver.observe(document.documentElement, themeOptions)
        const themeRoot = scene.closest('[data-theme]')
        if (themeRoot && themeRoot !== document.documentElement) themeObserver.observe(themeRoot, themeOptions)
        controlRef.current = sync
        const load = async (url: string): Promise<unknown> => {
            const response = await fetch(url, { signal: controller.signal })
            if (!response.ok) throw new Error('Map unavailable')
            return response.json()
        }
        const useWorker = !workerFailed && typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function'
        Promise.all([load('/maps/earth-land-dots-v1.json'), load('/maps/india-states-v1.json')])
            .then(async ([data, maps]) => {
                if (disposed) return
                const ready = useWorker
                    ? await createWorkerRenderer(canvas, particleCanvas, data, maps, controller.signal, () => { if (!disposed) setWorkerFailed(true) })
                    : await import('@/lib/commerce-globe-renderer').then(module => module.createMainThreadRenderer(canvas, particleCanvas, data, maps))
                if (disposed) { ready.dispose(); return }
                renderer = ready
                setMapFailed(false)
                scene.dataset.renderer = useWorker ? 'dotted-canvas-worker' : 'dotted-canvas'
                resize(); sync()
            })
            .catch(() => {
                if (controller.signal.aborted || disposed) return
                if (useWorker) setWorkerFailed(true)
                else fail()
            })
        return () => {
            disposed = true
            cancelAnimationFrame(frame)
            controlRef.current = null
            controller.abort()
            resizeObserver.disconnect(); themeObserver.disconnect()
            renderer?.dispose()
        }
    }, [enabled, retry, workerFailed])

    return (
        <div className="cg-scene" ref={sceneRef}>
            <div className="cg-globe-layers">
                <canvas key={`surface-${workerFailed}`} className="cg-canvas cg-surface" ref={canvasRef} aria-hidden="true" />
                <canvas className="cg-canvas cg-connections" ref={overlayRef} aria-hidden="true" />
                <div className="cg-stores" aria-hidden="true">
                    {STORES.map(({ stop }, index) => (
                        <div className={`cg-store-pin${index === 0 ? ' cg-store-pin--origin' : ''}`} key={stop.id}>
                            <span className="cg-store-symbol"><Store width={16} height={16} strokeWidth={1.6} /></span>
                            <span className="cg-store-label" hidden><strong><Copy text={"Store created"} /></strong><small>{stop.id === 'tamil-nadu' ? 'Tamil Nadu, India' : `${stop.city}, ${stop.country}`}</small></span>
                        </div>
                    ))}
                </div>
            </div>
            <canvas key={`particles-${workerFailed}`} className="cg-canvas cg-particles" ref={particlesRef} aria-hidden="true" />
            <div className="cg-closing-title" aria-hidden="true">
                <div className="cg-closing-lockup">
                    <svg className="cg-closing-mark" width={176} height={180} viewBox="0 0 176 180" aria-hidden="true" focusable="false">
                        <use href="/icons/letbuyy-store-mark-v3.svg#lb-store-mark" />
                    </svg>
                    <p className="cg-closing-brand">{Array.from(GLOBE_CLOSING_BRAND, (letter, index) => <span className={`cg-closing-letter${index > 2 ? ' cg-closing-letter--accent' : ''}`} key={index} style={{ '--cg-letter-index': index - 3 } as CSSProperties}>{letter}</span>)}</p>
                    <p className="cg-closing-message"><Copy text={"Sell worldwide"} /></p>
                    <span className="cg-closing-rule" />
                </div>
            </div>
            <span className="sr-only" role="status">{completed && !mapFailed ? 'LetBuyy — Sell worldwide' : ''}</span>
            {mapFailed && <div className="cg-map-status" role="status"><Copy text={"Globe unavailable."} />{' '}<Button unstyled onClick={() => { setMapFailed(false); setRetry(value => value + 1) }}><Copy text={"Retry"} /></Button></div>}
        </div>
    )
}
