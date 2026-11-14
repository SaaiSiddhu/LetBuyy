import { createOffscreenRenderer } from './commerce-globe-renderer'
import type { GlobeWorkerRequest, GlobeWorkerResponse, SceneRenderer } from './globe-renderer-types'

const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<GlobeWorkerRequest>) => void) | null
    postMessage: (message: GlobeWorkerResponse) => void
}
let renderer: SceneRenderer | null = null
scope.onmessage = event => {
    try {
        const message = event.data
        if (message.kind === 'init') {
            renderer = createOffscreenRenderer(message.canvas, message.particles, message.data, message.regions)
            scope.postMessage({ kind: 'ready' })
        } else if (message.kind === 'resize') {
            renderer?.resize(message.width, message.height, message.pixelRatio)
        } else if (message.kind === 'paint') {
            renderer?.paint(message.frame)
            scope.postMessage({ kind: 'painted' })
        }
    } catch {
        scope.postMessage({ kind: 'error' })
    }
}
