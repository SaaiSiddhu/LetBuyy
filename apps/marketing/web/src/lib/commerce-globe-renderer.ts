import { createGlobeProjector, GLOBE_PRESENTATION_END_MS, globeFrameAt, globeLayersAt, globeRadius, locationVector } from './commerce-globe'
import { globeParticleAt, globeParticleSeed } from './globe-finale'
import type { GlobeContext, GlobePalette as Palette, GlobeRegion as Region, SceneRenderer } from './globe-renderer-types'

type GlobeCanvas = HTMLCanvasElement | OffscreenCanvas
interface Renderer {
    resize: (width: number, height: number, pixelRatio?: number) => void
    draw: (camera: ReturnType<typeof globeFrameAt>, palette: Palette) => void
    shatter: (target: GlobeContext, palette: Palette, elapsed: number, opacity: number) => void
    dispose: () => void
    animated: boolean
}
const GRID: ReturnType<typeof locationVector>[][] = []
for (let lat = -60; lat <= 60; lat += 30) GRID.push(Array.from({ length: 121 }, (_, i) => locationVector({ lat, lon: i * 3 - 180 })))
for (let lon = -180; lon < 180; lon += 30) GRID.push(Array.from({ length: 61 }, (_, i) => locationVector({ lat: i * 3 - 90, lon })))

/** Both rendering paths enforce the same bounded, finite geographic input. */
export function parseGlobeGeography(data: unknown, maps: unknown) {
    const coordinate = (point: unknown): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every(value => typeof value === 'number' && Number.isFinite(value))
    const region = (value: unknown): value is Region => {
        if (!value || typeof value !== 'object') return false
        const candidate = value as Record<string, unknown>
        return typeof candidate.name === 'string' && Array.isArray(candidate.rings) && candidate.rings.length <= 1000 && candidate.rings.every((ring: unknown) => Array.isArray(ring) && ring.length <= 100000 && ring.every(coordinate))
    }
    if (!Array.isArray(data) || data.length > 10000 || !data.every(coordinate)) throw new Error('Invalid geography')
    if (!Array.isArray(maps) || maps.length > 1000 || !maps.every(region)) throw new Error('Invalid regional geometry')
    return { land: data.map(([lat, lon]) => locationVector({ lat, lon })), regions: maps }
}

/** The original geographic point cloud, with a dark glass sphere underneath. */
export function createRenderer(canvas: GlobeCanvas, land: ReturnType<typeof locationVector>[], regions: Region[], makeCanvas: () => GlobeCanvas): Renderer | null {
    const context = canvas.getContext('2d') as GlobeContext | null
    if (!context) return null
    const boundaries = regions.map(region => ({ name: region.name, rings: region.rings.map(ring => ring.map(([lon, lat]) => locationVector({ lat, lon }))) }))
    const tile = makeCanvas()
    tile.width = 7; tile.height = 7
    const tileContext = tile.getContext('2d')! as GlobeContext
    let width = 0, height = 0
    const color = (rgb: number[], alpha = 1) => `#${[...rgb, alpha].map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`
    const finalCamera = globeFrameAt(GLOBE_PRESENTATION_END_MS)
    const finalProjection = createGlobeProjector(finalCamera)
    // The same front-facing land points as the last globe frame, not a separate confetti cloud.
    const particles = land.map((point, index) => ({ ...finalProjection(point), seed: globeParticleSeed(index), index })).filter(point => point.depth > 0)
    return {
        animated: true,
        resize(w, h, dpr = 1) {
            width = w; height = h
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

function createSceneRenderer(canvas: GlobeCanvas, particles: GlobeCanvas, data: unknown, maps: unknown, makeCanvas: () => GlobeCanvas): SceneRenderer {
    const geography = parseGlobeGeography(data, maps)
    const renderer = createRenderer(canvas, geography.land, geography.regions, makeCanvas)
    const context = particles.getContext('2d') as GlobeContext | null
    if (!renderer || !context) throw new Error('Globe canvas unavailable')
    let width = 0, height = 0
    return {
        animated: renderer.animated,
        resize(w, h, pixelRatio) {
            width = w; height = h
            particles.width = Math.round(w * pixelRatio)
            particles.height = Math.round(h * pixelRatio)
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
            renderer.resize(w, h, pixelRatio)
        },
        paint({ camera, palette, finale }) {
            if (finale.sphereOpacity > 0) renderer.draw(camera, palette)
            renderer.shatter(context, palette, finale.elapsed, finale.particleOpacity)
        },
        dispose() {
            renderer.dispose()
            context.clearRect(0, 0, width, height)
        },
    }
}

export function createMainThreadRenderer(canvas: HTMLCanvasElement, particles: HTMLCanvasElement, data: unknown, maps: unknown) {
    return createSceneRenderer(canvas, particles, data, maps, () => document.createElement('canvas'))
}

export function createOffscreenRenderer(canvas: OffscreenCanvas, particles: OffscreenCanvas, data: unknown, maps: unknown) {
    return createSceneRenderer(canvas, particles, data, maps, () => new OffscreenCanvas(1, 1))
}

