import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { COMMERCE_STOPS, GLOBE_LOOP_MS, GLOBE_PRESENTATION_END_MS, globePlaybackAt, STORE_MOMENTS, globeFrameAt, globeLayersAt, storeVisibility, frameElapsed, locationVector, longitudeDelta, projectGlobe, routeVector } from '../../apps/marketing/web/src/lib/commerce-globe'

test('the journey starts in Tamil Nadu, reaches the requested Indian locations, then China', () => {
    assert.equal(COMMERCE_STOPS[0].id, 'tamil-nadu')
    const ids = COMMERCE_STOPS.map(stop => stop.id)
    assert.ok(ids.indexOf('delhi') < ids.indexOf('mumbai'))
    assert.ok(ids.indexOf('mumbai') < ids.indexOf('jammu-kashmir'))
    assert.ok(ids.indexOf('jammu-kashmir') < ids.indexOf('china'))
    for (const stop of COMMERCE_STOPS) {
        assert.ok(stop.lat >= -90 && stop.lat <= 90)
        assert.ok(stop.lon >= -180 && stop.lon <= 180)
    }
})

test('projection places the selected geography at the front and hides its antipode', () => {
    for (const camera of COMMERCE_STOPS) {
        const front = projectGlobe(locationVector(camera), camera)
        assert.ok(Math.abs(front.x) < 1e-10 && Math.abs(front.y) < 1e-10)
        assert.ok(Math.abs(front.depth - 1) < 1e-10)
        const back = projectGlobe(locationVector({ lat: -camera.lat, lon: camera.lon + 180 }), camera)
        assert.ok(back.depth < -0.999)
        const north = projectGlobe(locationVector({ lat: Math.min(camera.lat + 5, 89), lon: camera.lon }), camera)
        assert.ok(north.y < front.y)
    }
})

test('route arcs meet both cities exactly and travel above the sphere', () => {
    const origin = COMMERCE_STOPS[0]
    for (const destination of COMMERCE_STOPS.slice(1)) {
        for (const [t, endpoint] of [[0, origin], [1, destination]] as const) {
            const actual = routeVector(origin, destination, t)
            locationVector(endpoint).forEach((value, axis) => assert.ok(Math.abs(actual[axis] - value) < 1e-10))
        }
        const middle = routeVector(origin, destination, 0.5)
        assert.ok(Math.hypot(...middle) > 1)
        assert.ok(middle.every(Number.isFinite))
    }
})

test('date-line camera moves take the short path and degenerate arcs remain finite', () => {
    assert.equal(longitudeDelta(179, -179), 2)
    assert.equal(longitudeDelta(-179, 179), -2)
    const point = { lat: 0, lon: 0 }
    for (const destination of [point, { lat: 0, lon: 180 }]) {
        for (let i = 0; i <= 20; i++) assert.ok(routeVector(point, destination, i / 20).every(Number.isFinite))
    }
})

test('resize, theme and resumed paints cannot reverse or jump the globe clock', () => {
    assert.equal(frameElapsed(0, 24000), 0)
    assert.equal(frameElapsed(24000, 0), 0)
    assert.equal(frameElapsed(24000, 23999), 0)
    assert.equal(frameElapsed(24000, 24033), 0.033)
    assert.equal(frameElapsed(24000, 90000), 0.08)
})


test('the complete camera journey lasts under ten seconds and loops without a camera jump', () => {
    assert.equal(GLOBE_LOOP_MS, 9600)
    const start = globeFrameAt(0), end = globeFrameAt(GLOBE_LOOP_MS - .01)
    assert.deepEqual(globeFrameAt(GLOBE_LOOP_MS), start)
    assert.ok(Math.abs(longitudeDelta(end.lon, start.lon)) < .001)
    assert.ok(Math.abs(end.lat - start.lat) < .001)
    assert.ok(Math.abs(end.zoom - start.zoom) < .001)
    assert.ok(start.zoom > 3)
    assert.ok(globeFrameAt(6000).zoom < 1.1)
    let previous = start
    for (let t = 16; t < GLOBE_LOOP_MS; t += 16) {
        const frame = globeFrameAt(t)
        assert.ok(Object.values(frame).every(Number.isFinite))
        assert.ok(frame.zoom >= .96 && frame.zoom <= 12)
        assert.ok(Math.abs(longitudeDelta(previous.lon, frame.lon)) < 3)
        previous = frame
    }
})

test('stores spread from Tamil Nadu across India, Asia and other continents within one loop', () => {
    const ids = STORE_MOMENTS.map(moment => moment.id)
    assert.equal(ids[0], 'tamil-nadu')
    assert.ok(ids.indexOf('jammu-kashmir') < ids.indexOf('pakistan'))
    assert.ok(ids.indexOf('pakistan') < ids.indexOf('china'))
    assert.ok(ids.indexOf('china') < ids.indexOf('japan'))
    assert.ok(ids.includes('egypt') && ids.includes('brazil') && ids.includes('australia'))
    let previous = -1
    for (const moment of STORE_MOMENTS) {
        assert.ok(COMMERCE_STOPS.some(stop => stop.id === moment.id))
        assert.ok(moment.at > previous && moment.at < GLOBE_LOOP_MS / 1000)
        previous = moment.at
    }
})

test('store reveals enter progressively and fade before the sequence returns to its origin', () => {
    assert.equal(storeVisibility(1.35, 1), 0)
    assert.ok(Math.abs(storeVisibility(1.35, 1.51) - .5) < 1e-10)
    assert.equal(storeVisibility(1.35, 2), 1)
    assert.equal(storeVisibility(1.35, 9.3), 0)
    assert.equal(storeVisibility(.18, 9.3, true), 1)
})


test('Tamil Nadu expands to India before the world fades in, then loops back to the state', () => {
    assert.deepEqual(globeLayersAt(.5), { world: 0, tamilNadu: 1, india: 0 })
    assert.deepEqual(globeLayersAt(2), { world: 0, tamilNadu: 0, india: 1 })
    assert.ok(globeLayersAt(3).world > 0 && globeLayersAt(3).india > 0)
    assert.deepEqual(globeLayersAt(4), { world: 1, tamilNadu: 0, india: 0 })
    assert.deepEqual(globeLayersAt(9.5), { world: 0, tamilNadu: 1, india: 0 })
})


test('regional geometry includes a detailed, finite Tamil Nadu outline and all 36 India regions', () => {
    const regions = JSON.parse(readFileSync(new URL('../../apps/marketing/web/public/maps/india-states-v1.json', import.meta.url), 'utf8')) as Array<{ name: string; rings: number[][][] }>
    assert.equal(regions.length, 36)
    const tamilNadu = regions.find(region => region.name === 'Tamil Nadu')!
    assert.ok(tamilNadu.rings.flat().length > 500)
    for (const region of regions) for (const ring of region.rings) {
        assert.ok(ring.length >= 4)
        assert.deepEqual(ring[0], ring.at(-1))
        for (const [lon, lat] of ring) assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && lon > 65 && lon < 100 && lat > 5 && lat < 40)
    }
})


test('the presentation preserves each existing frame until the worldwide view and never restarts', () => {
    for (const elapsed of [0, 650, 1350, 2600, 3400, 5050, 6700, 8350, 8999]) {
        assert.deepEqual(globeFrameAt(globePlaybackAt(elapsed).milliseconds), globeFrameAt(elapsed))
        assert.equal(globePlaybackAt(elapsed).complete, false)
    }
    const final = globeFrameAt(GLOBE_PRESENTATION_END_MS)
    assert.equal(final.zoom, .96)
    assert.deepEqual(globeLayersAt(final.time), { world: 1, tamilNadu: 0, india: 0 })
    for (const elapsed of [9000, 9600, 19200, 60000, 3600000]) {
        const playback = globePlaybackAt(elapsed)
        assert.equal(playback.complete, true)
        assert.deepEqual(globeFrameAt(playback.milliseconds), final)
    }
})

test('a paused or restarted animation clock cannot advance past its closing worldwide frame', () => {
    assert.deepEqual(globePlaybackAt(-10), { milliseconds: 0, complete: false })
    const end = globePlaybackAt(8990 + frameElapsed(100, 200) * 1000)
    assert.equal(end.milliseconds, GLOBE_PRESENTATION_END_MS)
    assert.equal(end.complete, true)
    assert.deepEqual(globePlaybackAt(end.milliseconds + 80), end)
})
