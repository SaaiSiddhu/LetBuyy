import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { parseGlobeGeography } from '../../apps/marketing/web/src/lib/commerce-globe-renderer'
import { locationVector } from '../../apps/marketing/web/src/lib/commerce-globe'

test('worker and fallback geography retain the actual geographic points and regions', () => {
    const data = JSON.parse(fs.readFileSync('apps/marketing/web/public/maps/earth-land-dots-v1.json', 'utf8')) as [number, number][]
    const maps: unknown = JSON.parse(fs.readFileSync('apps/marketing/web/public/maps/india-states-v1.json', 'utf8'))
    const result = parseGlobeGeography(data, maps)
    assert.equal(result.land.length, data.length)
    assert.equal(result.regions, maps)
    for (let index = 0; index < data.length; index++) assert.deepEqual(result.land[index], locationVector({ lat: data[index][0], lon: data[index][1] }))
})

test('both canvas paths reject malformed, nonfinite and unbounded geographic input', () => {
    for (const bad of [null, {}, [[NaN, 0]], [[0]], [[0, 0, 0]], Array.from({ length: 10001 }, () => [0, 0])]) {
        assert.throws(() => parseGlobeGeography(bad, []), /Invalid geography/)
    }
    for (const bad of [null, {}, [{ name: 'Region', rings: [[[0, Infinity]]] }], [{ rings: [] }]]) {
        assert.throws(() => parseGlobeGeography([], bad), /Invalid regional geometry/)
    }
})
