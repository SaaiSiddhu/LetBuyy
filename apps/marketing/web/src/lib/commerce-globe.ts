/** Presentation-only geography and example activity. No merchant telemetry. */
export interface GeoLocation {
    lat: number
    lon: number
}

export interface CommerceStop extends GeoLocation {
    id: string
    city: string
    region: string
    country: string
    activity: 'store' | 'order' | 'publish'
    title: string
    detail: string
}

export const COMMERCE_STOPS: readonly CommerceStop[] = [
    { id: 'tamil-nadu', city: 'Chennai', region: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707, activity: 'store', title: 'A new store begins.', detail: 'A merchant in Chennai creates a storefront and starts bringing their brand to life.' },
    { id: 'karnataka', city: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, activity: 'publish', title: 'A storefront goes live.', detail: 'A Bengaluru maker finishes building their store and publishes a first collection.' },
    { id: 'telangana', city: 'Hyderabad', region: 'Telangana', country: 'India', lat: 17.385, lon: 78.4867, activity: 'order', title: 'The first order arrives.', detail: 'A customer in Hyderabad discovers a Tamil Nadu brand and places an order.' },
    { id: 'delhi', city: 'New Delhi', region: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209, activity: 'store', title: 'Another idea becomes a store.', detail: 'An independent business in Delhi creates a storefront for its next chapter.' },
    { id: 'mumbai', city: 'Mumbai', region: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.8777, activity: 'order', title: 'A new customer connects.', detail: 'A shopper in Mumbai places an order with a storefront that began in Tamil Nadu.' },
    { id: 'jammu-kashmir', city: 'Srinagar', region: 'Jammu & Kashmir', country: 'India', lat: 34.0837, lon: 74.7973, activity: 'publish', title: 'Local craft finds a new home.', detail: 'An artisan in Srinagar builds a storefront to share a collection with more people.' },
    { id: 'pakistan', city: 'Karachi', region: 'Sindh', country: 'Pakistan', lat: 24.8607, lon: 67.0011, activity: 'store', title: 'A new store takes shape.', detail: 'Illustrative store creation in Karachi.' },
    { id: 'china', city: 'Shanghai', region: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737, activity: 'order', title: 'Discovery crosses borders.', detail: 'An illustrative order from Shanghai connects a customer with a Tamil Nadu storefront.' },
    { id: 'japan', city: 'Tokyo', region: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, activity: 'store', title: 'Another storefront begins.', detail: 'Illustrative store creation in Tokyo.' },
    { id: 'singapore', city: 'Singapore', region: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, activity: 'publish', title: 'A brand reaches further.', detail: 'A storefront is built for a new audience in this illustrative Singapore activity.' },
    { id: 'egypt', city: 'Cairo', region: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357, activity: 'store', title: 'The story reaches Africa.', detail: 'Illustrative store creation in Cairo.' },
    { id: 'united-kingdom', city: 'London', region: 'England', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, activity: 'order', title: 'A local story travels.', detail: 'A customer in London discovers the collection and places an illustrative order.' },
    { id: 'united-states', city: 'New York', region: 'New York', country: 'United States', lat: 40.7128, lon: -74.006, activity: 'store', title: 'A fresh storefront takes shape.', detail: 'A new store is created in New York in this example of connected commerce.' },
    { id: 'brazil', city: 'São Paulo', region: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333, activity: 'store', title: 'The story reaches South America.', detail: 'Illustrative store creation in São Paulo.' },
    { id: 'australia', city: 'Sydney', region: 'New South Wales', country: 'Australia', lat: -33.8688, lon: 151.2093, activity: 'order', title: 'The journey keeps growing.', detail: 'An illustrative order from Sydney completes the journey before it returns to Tamil Nadu.' },
]

export const GLOBE_LOOP_MS = 9600
// Stop immediately before the existing return-to-origin transition; preserve all preceding frames.
export const GLOBE_PRESENTATION_END_MS = 9000

export function globePlaybackAt(milliseconds: number) {
    const elapsed = Math.max(0, milliseconds)
    return { milliseconds: Math.min(elapsed, GLOBE_PRESENTATION_END_MS), complete: elapsed >= GLOBE_PRESENTATION_END_MS }
}

export const STORE_MOMENTS = [
    { id: 'tamil-nadu', at: 0.18 },
    { id: 'karnataka', at: 1.35 },
    { id: 'telangana', at: 1.62 },
    { id: 'delhi', at: 1.95 },
    { id: 'mumbai', at: 2.18 },
    { id: 'jammu-kashmir', at: 2.48 },
    { id: 'pakistan', at: 3.05 },
    { id: 'china', at: 3.55 },
    { id: 'japan', at: 4.08 },
    { id: 'singapore', at: 4.5 },
    { id: 'egypt', at: 5.05 },
    { id: 'united-kingdom', at: 5.5 },
    { id: 'united-states', at: 6.2 },
    { id: 'brazil', at: 6.7 },
    { id: 'australia', at: 7.75 },
] as const

const CAMERA_KEYS = [
    { at: 0, lat: 11.1, lon: 78.6, zoom: 12 },
    { at: .9, lat: 11.1, lon: 78.6, zoom: 12 },
    { at: 2.6, lat: 22, lon: 80.5, zoom: 2.1 },
    { at: 4.5, lat: 27, lon: 123, zoom: 1.03 },
    { at: 5.8, lat: 25, lon: 45, zoom: 0.96 },
    { at: 7.05, lat: 15, lon: -75, zoom: 0.96 },
    { at: 8.35, lat: -5, lon: -205, zoom: 0.96 },
    { at: 9, lat: 11.1, lon: -281.4, zoom: 0.96 },
    { at: GLOBE_LOOP_MS / 1000, lat: 11.1, lon: -281.4, zoom: 12 },
] as const

export function globeFrameAt(milliseconds: number) {
    const time = ((Math.max(0, milliseconds) % GLOBE_LOOP_MS) + GLOBE_LOOP_MS) % GLOBE_LOOP_MS / 1000
    const end = CAMERA_KEYS.findIndex(key => key.at > time)
    const a = CAMERA_KEYS[Math.max(0, end - 1)]
    const b = CAMERA_KEYS[Math.max(1, end)]
    const fraction = Math.min(1, Math.max(0, (time - a.at) / (b.at - a.at)))
    const ease = fraction * fraction * (3 - 2 * fraction)
    return { time, lat: a.lat + (b.lat - a.lat) * ease, lon: a.lon + (b.lon - a.lon) * ease, zoom: a.zoom + (b.zoom - a.zoom) * ease }
}

/** Crossfades share the same geographic camera, so maps never jump position. */
export function globeLayersAt(time: number) {
    const ramp = (start: number, end: number) => Math.min(1, Math.max(0, (time - start) / (end - start)))
    const world = ramp(2.6, 3.4) * (1 - ramp(9, 9.45))
    const tamilNadu = (1 - ramp(.9, 1.6)) + ramp(9, 9.45)
    const india = ramp(.9, 1.6) * (1 - ramp(2.6, 3.4))
    return { world, tamilNadu: Math.min(1, tamilNadu), india }
}

export function storeVisibility(appearsAt: number, time: number, origin = false) {
    const enter = Math.min(1, Math.max(0, (time - appearsAt) / 0.32))
    const exit = origin ? 1 : Math.min(1, Math.max(0, (9.05 - time) / 0.45))
    return enter * exit
}

export type GlobeVector = readonly [number, number, number]
const RAD = Math.PI / 180

/** Resize/theme paints must not advance the animation with a negative delta. */
export function frameElapsed(previous: number, now: number): number {
    return previous > 0 && now >= previous ? Math.min((now - previous) / 1000, 0.08) : 0
}

export function locationVector({ lat, lon }: GeoLocation): GlobeVector {
    const latitude = lat * RAD
    const longitude = lon * RAD
    return [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)]
}

export function longitudeDelta(from: number, to: number): number {
    return ((to - from + 540) % 360 + 360) % 360 - 180
}

/** Orthographic projection; depth <= 0 is hidden behind the globe. */
export function createGlobeProjector(camera: GeoLocation) {
    const longitude = camera.lon * RAD
    const latitude = camera.lat * RAD
    const cosLon = Math.cos(longitude), sinLon = Math.sin(longitude)
    const cosLat = Math.cos(latitude), sinLat = Math.sin(latitude)
    return (point: GlobeVector) => {
        const x = point[0] * cosLon - point[2] * sinLon
        const z = point[0] * sinLon + point[2] * cosLon
        return { x, y: -(point[1] * cosLat - z * sinLat), depth: point[1] * sinLat + z * cosLat }
    }
}

export function projectGlobe(point: GlobeVector, camera: GeoLocation) {
    return createGlobeProjector(camera)(point)
}

/** Great-circle route with a raised arc; endpoints remain on the surface. */
export function routeVector(from: GeoLocation, to: GeoLocation, fraction: number): GlobeVector {
    const t = Math.min(1, Math.max(0, fraction))
    const a = locationVector(from)
    const b = locationVector(to)
    const dot = Math.min(1, Math.max(-1, a.reduce((sum, value, i) => sum + value * b[i], 0)))
    const angle = Math.acos(dot)
    const sin = Math.sin(angle)
    const fallback = locationVector({ lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + longitudeDelta(from.lon, to.lon) * t })
    const point = Math.abs(sin) < 0.00001
        ? fallback
        : a.map((value, i) => (value * Math.sin((1 - t) * angle) + b[i] * Math.sin(t * angle)) / sin)
    const lift = 1 + Math.sin(Math.PI * t) * Math.min(0.32, 0.08 + angle * 0.12)
    return [point[0] * lift, point[1] * lift, point[2] * lift]
}

/** Keep light-mode's opaque silhouette inside the canvas; all layers share this projection. */
export function globeRadius(width: number, height: number, camera: ReturnType<typeof globeFrameAt>, palette: { opaque: boolean }) {
    const radius = Math.min(width * .475, height * .65)
    if (!palette.opaque) return radius * camera.zoom
    const fitted = Math.min(width * .475, height * .455)
    const zoomed = radius * camera.zoom
    return zoomed + (Math.min(zoomed, fitted) - zoomed) * globeLayersAt(camera.time).world
}

