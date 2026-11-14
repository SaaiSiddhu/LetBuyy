import type { GlobePaint, GlobeWorkerRequest, GlobeWorkerResponse, SceneRenderer } from './globe-renderer-types'

/** At most one paint is in flight; slower renderers consume the newest clock frame. */
export function createWorkerRenderer(canvas: HTMLCanvasElement, particles: HTMLCanvasElement, data: unknown, regions: unknown, signal: AbortSignal, onFailure: () => void): Promise<SceneRenderer> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./commerce-globe.worker.ts', import.meta.url), { type: 'module' })
        let pending: GlobePaint | null = null
        let busy = false
        let ready = false
        let disposed = false
        const post = (message: GlobeWorkerRequest, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
        const timer = window.setTimeout(() => fail(), 10000)
        function dispose() {
            if (disposed) return
            disposed = true
            window.clearTimeout(timer)
            signal.removeEventListener('abort', abort)
            worker.terminate()
        }
        function abort() { dispose(); reject(new Error('Globe initialization aborted')) }
        function fail() {
            if (disposed) return
            dispose()
            if (ready) onFailure()
            else reject(new Error('Globe worker unavailable'))
        }
        function flush() {
            if (disposed || !ready || busy || !pending) return
            const frame = pending
            pending = null
            busy = true
            post({ kind: 'paint', frame })
        }
        worker.onerror = event => { event.preventDefault(); fail() }
        worker.onmessage = (event: MessageEvent<GlobeWorkerResponse>) => {
            if (disposed) return
            if (event.data.kind === 'error') { fail(); return }
            if (event.data.kind === 'ready') {
                ready = true
                window.clearTimeout(timer)
                resolve({
                    animated: true,
                    resize: (width, height, pixelRatio) => post({ kind: 'resize', width, height, pixelRatio }),
                    paint: frame => { pending = frame; flush() },
                    dispose,
                })
            } else if (event.data.kind === 'painted') {
                busy = false
                flush()
            }
        }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) { abort(); return }
        try {
            const surface = canvas.transferControlToOffscreen()
            const dots = particles.transferControlToOffscreen()
            post({ kind: 'init', canvas: surface, particles: dots, data, regions }, [surface, dots])
        } catch {
            fail()
        }
    })
}
