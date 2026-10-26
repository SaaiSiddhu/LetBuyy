import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

interface Keyframe { t: number; s: number[] }
interface Path { i: number[][]; o: number[][]; v: number[][]; c: boolean }
interface Layer {
    nm: string; ty: number; ip: number; op: number
    ks: { o: { k: Keyframe[] }; p: { k: Keyframe[] } }
    shapes: Array<{ ty: string; ks?: { k: Path } }>
}
const bytes = readFileSync(new URL('../../apps/marketing/web/public/animations/letbuyy-finale-v1.json', import.meta.url), 'utf8')
const animation = JSON.parse(bytes) as { fr: number; w: number; h: number; assets: unknown[]; layers: Layer[]; markers: Array<{ tm: number; dr: number }> }

test('the closing Lottie contains custom vector lettering without images, external fonts or expressions', () => {
    assert.equal(animation.fr, 60)
    assert.equal(animation.w / animation.h, 2.5)
    assert.deepEqual(animation.assets, [])
    assert.equal(animation.layers.length, 8)
    assert.ok(Buffer.byteLength(bytes) < 40_000)
    assert.ok(!/"x"\s*:\s*"/.test(bytes) && !bytes.includes('https:') && !bytes.includes('data:'))
    for (const layer of animation.layers) {
        assert.equal(layer.ty, 4)
        const paths = layer.shapes.filter(shape => shape.ty === 'sh')
        assert.ok(paths.length > 0)
        for (const shape of paths) {
            const path = shape.ks!.k
            assert.equal(path.v.length, path.i.length)
            assert.equal(path.v.length, path.o.length)
            for (const point of [...path.v, ...path.i, ...path.o]) assert.ok(point.length === 2 && point.every(Number.isFinite))
        }
    }
})

test('the Lottie reveals all seven brand letters before Sell worldwide, then loops only the ambient segment', () => {
    const letters = animation.layers.slice(0, 7)
    assert.equal(letters.map(layer => layer.nm.split(': ')[1]).join(''), 'LetBuyy')
    for (let i = 1; i < letters.length; i++) assert.ok(letters[i].ks.o.k[0].t > letters[i - 1].ks.o.k[0].t)
    const lastLetterEnd = letters[6].ks.o.k.at(-1)!.t
    const subtitle = animation.layers[7]
    assert.equal(subtitle.nm, 'Sell worldwide')
    assert.ok(subtitle.ks.o.k[0].t > lastLetterEnd)
    const loop = animation.markers[0]
    assert.equal(loop.tm, 156)
    assert.equal(loop.dr, 480)
    for (const layer of animation.layers) {
        const end = layer.ks.o.k.at(-1)!
        assert.ok(end.t < loop.tm)
        assert.deepEqual(end.s, [100])
        assert.ok(layer.op > loop.tm + loop.dr)
    }
})
