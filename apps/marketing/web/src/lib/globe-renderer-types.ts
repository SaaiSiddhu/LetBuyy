import type { globeFrameAt } from './commerce-globe'
import type { globeFinaleAt } from './globe-finale'

export type GlobePalette = Record<'ocean' | 'surface' | 'coast' | 'light', [number, number, number]> & { opaque: boolean }
export interface GlobeRegion { name: string; rings: Array<Array<[number, number]>> }
export type GlobeContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export interface GlobePaint {
    camera: ReturnType<typeof globeFrameAt>
    palette: GlobePalette
    finale: ReturnType<typeof globeFinaleAt>
}
export interface SceneRenderer {
    animated: boolean
    resize: (width: number, height: number, pixelRatio: number) => void
    paint: (frame: GlobePaint) => void
    dispose: () => void
}
export type GlobeWorkerRequest =
    | { kind: 'init'; canvas: OffscreenCanvas; particles: OffscreenCanvas; data: unknown; regions: unknown }
    | { kind: 'resize'; width: number; height: number; pixelRatio: number }
    | { kind: 'paint'; frame: GlobePaint }
export type GlobeWorkerResponse = { kind: 'ready' | 'painted' | 'error' }
