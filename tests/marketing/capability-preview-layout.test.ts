import assert from 'node:assert/strict'
import test from 'node:test'
import { fitCapabilityPreview } from '../../apps/marketing/web/src/lib/capability-preview-layout'

test('all mock proportions stay inside the same phone frame without cropping', () => {
    for (const sourceHeight of [180, 360, 620, 900]) {
        const scale = fitCapabilityPreview(320, 240, 600, sourceHeight)
        assert.ok(600 * scale <= 312)
        assert.ok(sourceHeight * scale <= 232)
        assert.ok(scale > 0 && scale <= 1)
    }
})

test('wide and tall previews use whichever frame dimension constrains them', () => {
    assert.equal(fitCapabilityPreview(608, 308, 600, 300), 1)
    assert.equal(fitCapabilityPreview(308, 608, 600, 300), 0.5)
    assert.equal(fitCapabilityPreview(608, 308, 600, 600), 0.5)
})

test('invalid or not-yet-measured geometry never produces an overflowing transform', () => {
    for (const bad of [0, -1, NaN, Infinity]) assert.equal(fitCapabilityPreview(320, 240, 600, bad), 0)
    assert.equal(fitCapabilityPreview(6, 6, 600, 300), 0)
})


test('the preview uses more of the same frame while retaining a small safe inset', () => {
    const scale = fitCapabilityPreview(320, 240, 600, 300)
    assert.equal(scale, 312 / 600)
    assert.ok(scale > 296 / 600)
    assert.ok(600 * scale < 320)
})
