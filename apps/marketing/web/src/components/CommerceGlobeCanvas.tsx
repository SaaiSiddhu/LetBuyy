'use client'

import Copy from '@/components/i18n/Copy'
import Image from 'next/image'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Store } from '@letbuyy/ui'
import { COMMERCE_STOPS, STORE_MOMENTS, createGlobeProjector, frameElapsed, globePlaybackAt, GLOBE_PRESENTATION_END_MS, globeFrameAt, globeLayersAt, locationVector, routeVector, storeVisibility } from '@/lib/commerce-globe'
import { GLOBE_CLOSING_BRAND, GLOBE_FINALE_DURATION_MS, globeFinaleAt, globeParticleAt, globeParticleSeed } from '@/lib/globe-finale'

const ORIGIN = COMMERCE_STOPS[0]
const STORES = STORE_MOMENTS.map(moment => ({ ...moment, stop: COMMERCE_STOPS.find(stop => stop.id === moment.id)! }))
const ROUTES = STORES.map(({ stop }) => Array.from({ length: 81 }, (_, i) => routeVector(ORIGIN, stop, i / 80)))
const GRID: ReturnType<typeof locationVector>[][] = []
for (let lat = -60; lat <= 60; lat += 30) GRID.push(Array.from({ length: 121 }, (_, i) => locationVector({ lat, lon: i * 3 - 180 })))
for (let lon = -180; lon < 180; lon += 30) GRID.push(Array.from({ length: 61 }, (_, i) => locationVector({ lat: i * 3 - 90, lon })))

type GlobeColors = Record<'ocean' | 'surface' | 'coast' | 'light', [number, number, number]>
type Palette = GlobeColors & { opaque: boolean }
type Camera = ReturnType<typeof globeFrameAt>
interface Region { name: string; rings: Array<Array<[number, number]>> }
interface Renderer {
    resize: (width: number, height: number) => void
    draw: (camera: Camera, palette: Palette) => void
    shatter: (target: CanvasRenderingContext2D, palette: Palette, elapsed: number, opacity: number) => void
    dispose: () => void
    animated: boolean
}

/** Keep light-mode's opaque silhouette inside the canvas; all layers share this projection. */
function globeRadius(width: number, height: number, camera: Camera, palette: Palette) {
    const radius = Math.min(width * .475, height * .65)
    if (!palette.opaque) return radius * camera.zoom
    const fitted = Math.min(width * .475, height * .455)
    const zoomed = radius * camera.zoom
    return zoomed + (Math.min(zoomed, fitted) - zoomed) * globeLayersAt(camera.time).world
}

/** The original geographic point cloud, with a dark glass sphere underneath. */
function createRenderer(canvas: HTMLCanvasElement, land: ReturnType<typeof locationVector>[], regions: Region[]): Renderer | null {
    const context = canvas.getContext('2d')
    if (!context) return null
    const boundaries = regions.map(region => ({ name: region.name, rings: region.rings.map(ring => ring.map(([lon, lat]) => locationVector({ lat, lon }))) }))
    const tile = document.createElement('canvas')
    tile.width = 7; tile.height = 7
    const tileContext = tile.getContext('2d')!
    let width = 0, height = 0
    const color = (rgb: number[], alpha = 1) => `#${[...rgb, alpha].map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`
    const finalCamera = globeFrameAt(GLOBE_PRESENTATION_END_MS)
    const finalProjection = createGlobeProjector(finalCamera)
    // The same front-facing land points as the last globe frame, not a separate confetti cloud.
    const particles = land.map((point, index) => ({ ...finalProjection(point), seed: globeParticleSeed(index), index })).filter(point => point.depth > 0)
    return {
        animated: true,
        resize(w, h) {
            width = w; height = h
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
            context.setTransform(dpr, 0, 0, dpr, 0, 0)
        },
        draw(camera, palette) {
            const regionalRadius = globeRadius(width, height, camera, palette)
            // The sphere fades in at its complete silhouette while the regional map zooms out.
            const radius = palette.opaque ? Math.min(regionalRadius, width * .475, height * .455) : regionalRadius
            const cx = width / 2, cy = height / 2
            const project = createGlobeProjector(camera)
            const position = (point: ReturnType<typeof locationVector>) => {
                const p = project(point)
                return { x: cx + p.x * radius, y: cy + p.y * radius, depth: p.depth }
            }
            context.clearRect(0, 0, width, height)
            const layers = globeLayersAt(camera.time)
            context.globalAlpha = layers.world
            if (layers.world > 0) {
                const halo = context.createRadialGradient(cx, cy, radius * .97, cx, cy, radius * 1.09)
                halo.addColorStop(0, color(palette.coast, 0))
                halo.addColorStop(.3, color(palette.coast, .1))
                halo.addColorStop(1, color(palette.coast, 0))
                context.fillStyle = halo
                context.beginPath(); context.arc(cx, cy, radius * 1.09, 0, Math.PI * 2); context.fill()
                const body = context.createRadialGradient(cx - radius * .34, cy - radius * .4, radius * .05, cx, cy, radius)
                body.addColorStop(0, color(palette.ocean, palette.opaque ? 1 : .94))
                body.addColorStop(.65, color(palette.ocean, palette.opaque ? 1 : .8))
                body.addColorStop(1, color(palette.ocean, palette.opaque ? 1 : .46))
                context.fillStyle = body
                context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.fill()
                context.save()
                context.clip()
                const sheen = context.createRadialGradient(cx - radius * .45, cy - radius * .65, 0, cx - radius * .25, cy - radius * .35, radius * 1.3)
                sheen.addColorStop(0, color(palette.light, .095))
                sheen.addColorStop(.5, color(palette.coast, .025))
                sheen.addColorStop(1, color(palette.light, 0))
                context.fillStyle = sheen
                context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
                context.strokeStyle = color(palette.coast, .11)
                context.lineWidth = .6
                for (const line of GRID) {
                    context.beginPath()
                    let pen = false
                    for (const point of line) {
                        const p = position(point)
                        if (p.depth <= 0) { pen = false; continue }
                        if (pen) context.lineTo(p.x, p.y)
                        else context.moveTo(p.x, p.y)
                        pen = true
                    }
                    context.stroke()
                }
                const bands: Array<Array<{ x: number; y: number }>> = Array.from({ length: 6 }, () => [])
                for (const point of land) {
                    const p = position(point)
                    if (p.depth > 0 && p.x > -5 && p.x < width + 5 && p.y > -5 && p.y < height + 5) bands[Math.min(5, Math.floor(p.depth * 6))].push(p)
                }
                bands.forEach((points, depth) => {
                    const dot = Math.max(.6, Math.min(1.9, radius / 250)) * (.65 + depth * .07)
                    context.fillStyle = color(palette.surface, .22 + depth * .11)
                    context.beginPath()
                    for (const point of points) { context.moveTo(point.x + dot, point.y); context.arc(point.x, point.y, dot, 0, Math.PI * 2) }
                    context.fill()
                })
                context.restore()
                const rim = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
                rim.addColorStop(0, color(palette.light, .55))
                rim.addColorStop(.4, color(palette.coast, .13))
                rim.addColorStop(.7, color(palette.coast, .04))
                rim.addColorStop(1, color(palette.coast, .25))
                context.strokeStyle = rim; context.lineWidth = 1
                context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke()
            }
            tileContext.clearRect(0, 0, 7, 7)
            tileContext.fillStyle = color(palette.surface, .6)
            tileContext.beginPath(); tileContext.arc(3.5, 3.5, .75, 0, Math.PI * 2); tileContext.fill()
            const pattern = context.createPattern(tile, 'repeat')!
            for (const region of boundaries) {
                const tamilNadu = region.name === 'Tamil Nadu'
                const alpha = Math.max(layers.india, tamilNadu ? layers.tamilNadu : 0)
                if (alpha <= 0) continue
                context.globalAlpha = alpha
                context.beginPath()
                for (const ring of region.rings) {
                    let first = true
                    for (const point of ring) {
                        const projected = project(point)
                        const p = { x: cx + projected.x * regionalRadius, y: cy + projected.y * regionalRadius }
                        if (first) context.moveTo(p.x, p.y)
                        else context.lineTo(p.x, p.y)
                        first = false
                    }
                    context.closePath()
                }
                context.fillStyle = color(palette.ocean, palette.opaque ? 1 : .55)
                context.fill('evenodd')
                context.fillStyle = pattern
                context.fill('evenodd')
                context.strokeStyle = color(tamilNadu ? palette.light : palette.surface, tamilNadu ? .9 : .42)
                context.lineWidth = tamilNadu ? 1.7 : .65
                context.stroke()
            }
            context.globalAlpha = 1
        },
        shatter(target, palette, elapsed, opacity) {
            target.clearRect(0, 0, width, height)
            if (opacity <= 0) return
            const radius = globeRadius(width, height, finalCamera, palette)
            const dotRadius = Math.max(.6, Math.min(1.9, radius / 250))
            // Six depth bands preserve the original globe's foreground/background hierarchy.
            for (let band = 0; band < 6; band++) {
                target.fillStyle = color(palette.opaque ? palette.coast : palette.surface, (.3 + band * .1) * opacity)
                target.beginPath()
                for (const particle of particles) {
                    if (Math.min(5, Math.floor(particle.depth * 6)) !== band) continue
                    const p = globeParticleAt(particle.x, particle.y, particle.seed, elapsed)
                    const x = width / 2 + p.x * radius, y = height / 2 + p.y * radius
                    if (x < -8 || y < -8 || x > width + 8 || y > height + 8) continue
                    const size = dotRadius * (.65 + band * .07) * p.size
                    target.moveTo(x + size, y); target.arc(x, y, size, 0, Math.PI * 2)
                }
                target.fill()
            }
            // A few longer fragments give the burst direction without expensive blur filters.
            target.strokeStyle = color(palette.opaque ? palette.coast : palette.light, opacity * .4)
            target.lineWidth = .8
            target.beginPath()
            for (const particle of particles) {
                if (particle.index % 23) continue
                const head = globeParticleAt(particle.x, particle.y, particle.seed, elapsed)
                const tail = globeParticleAt(particle.x, particle.y, particle.seed, Math.max(0, elapsed - 32))
                target.moveTo(width / 2 + tail.x * radius, height / 2 + tail.y * radius)
                target.lineTo(width / 2 + head.x * radius, height / 2 + head.y * radius)
            }
            target.stroke()
        },
        dispose() { context.clearRect(0, 0, width, height) },
    }
}

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

    useEffect(() => { movingRef.current = moving; staticFinalRef.current = staticFinal; controlRef.current?.() }, [moving, staticFinal])

    useEffect(() => {
        const scene = sceneRef.current, canvas = canvasRef.current, overlay = overlayRef.current, particleCanvas = particlesRef.current
        if (!enabled || !scene || !canvas || !overlay || !particleCanvas) return
        const context = overlay.getContext('2d')
        const particleContext = particleCanvas.getContext('2d')
        if (!context || !particleContext) return
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
            })) as GlobeColors
            palette = { ...colors, opaque: style.getPropertyValue('--cg-opaque').trim() === '1' }
            routeColor = style.getPropertyValue('--cg-route').trim()
        }
        function draw() {
            if (disposed || !renderer || !width || !height) return
            if (staticFinalRef.current) clockRef.current = GLOBE_PRESENTATION_END_MS + GLOBE_FINALE_DURATION_MS
            const playback = globePlaybackAt(clockRef.current)
            const finale = globeFinaleAt(clockRef.current, GLOBE_PRESENTATION_END_MS)
            globeLayers.style.opacity = String(finale.sphereOpacity)
            globeLayers.style.visibility = finale.sphereOpacity === 0 ? 'hidden' : 'visible'
            title.style.setProperty('--cg-title-opacity', String(finale.titleOpacity))
            title.style.setProperty('--cg-title-reveal', String(finale.reveal))
            title.style.setProperty('--cg-message-reveal', String(finale.messageReveal))
            letters.forEach((letter, index) => letter.style.setProperty('--cg-letter-reveal', String(finale.letters[index])))
            if (finale.finished && !completedRef.current) {
                completedRef.current = true
                setCompleted(true)
            }
            const camera = globeFrameAt(!movingRef.current && clockRef.current === 0 ? 650 : playback.milliseconds)
            // Reduced-motion and initial paused visits still show the origin store.
            const time = !movingRef.current && clockRef.current === 0 ? .65 : camera.time
            if (finale.sphereOpacity > 0) renderer.draw(camera, palette)
            renderer.shatter(particleContext!, palette, finale.elapsed, finale.particleOpacity)
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
                pin.style.left = `${p.x}px`; pin.style.top = `${p.y}px`
                pin.style.opacity = String(inBounds ? visible : 0)
                pin.style.transform = `translate(-50%,-50%) scale(${.65 + visibility * .35})`
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
            labels.forEach((label, index) => { label.hidden = index !== active })
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
            particleCanvas!.width = Math.round(width * dpr); particleCanvas!.height = Math.round(height * dpr)
            particleContext!.setTransform(dpr, 0, 0, dpr, 0, 0)
            renderer?.resize(width, height)
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
        Promise.all([load('/maps/earth-land-dots-v1.json'), load('/maps/india-states-v1.json')])
            .then(([data, maps]) => {
                if (disposed) return
                if (!Array.isArray(data) || data.length > 10000 || !data.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) throw new Error('Invalid geography')
                if (!Array.isArray(maps) || !maps.every(region => typeof region.name === 'string' && Array.isArray(region.rings) && region.rings.every((ring: unknown) => Array.isArray(ring) && ring.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))))) throw new Error('Invalid regional geometry')
                renderer = createRenderer(canvas, data.map(([lat, lon]: [number, number]) => locationVector({ lat, lon })), maps as Region[])
                if (!renderer) { fail(); return }
                setMapFailed(false)
                scene.dataset.renderer = 'dotted-canvas'
                resize(); sync()
            })
            .catch(() => { if (!controller.signal.aborted) fail() })
        return () => {
            disposed = true
            cancelAnimationFrame(frame)
            controlRef.current = null
            controller.abort()
            resizeObserver.disconnect(); themeObserver.disconnect()
            renderer?.dispose()
            particleContext.clearRect(0, 0, width, height)
        }
    }, [enabled, retry])

    return (
        <div className="cg-scene" ref={sceneRef}>
            <div className="cg-globe-layers">
                <canvas className="cg-canvas cg-surface" ref={canvasRef} aria-hidden="true" />
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
            <canvas className="cg-canvas cg-particles" ref={particlesRef} aria-hidden="true" />
            <div className="cg-closing-title" aria-hidden="true">
                <div className="cg-closing-lockup">
                    <Image className="cg-closing-mark" src="/icons/letbuyy-store-mark-v3.svg" alt="" width={176} height={180} unoptimized />
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
