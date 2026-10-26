import assert from 'node:assert/strict'
import test from 'node:test'
import { GLOBE_PRESENTATION_END_MS, globeFrameAt, globePlaybackAt, frameElapsed } from '../../apps/marketing/web/src/lib/commerce-globe'
import { GLOBE_FINALE_DURATION_MS, globeFinaleAt, globeParticleAt, globeParticleSeed } from '../../apps/marketing/web/src/lib/globe-finale'

const end = GLOBE_PRESENTATION_END_MS

test('LetBuyy reveals from left to right and the subtitle waits for the complete brand', () => {
    const first = globeFinaleAt(end + 450, end)
    assert.ok(first.letters[0] > 0)
    assert.ok(first.letters.slice(1).every(value => value === 0))
    for (let elapsed = 0; elapsed < 1500; elapsed += 10) {
        const state = globeFinaleAt(end + elapsed, end)
        for (let i = 1; i < state.letters.length; i++) assert.ok(state.letters[i] <= state.letters[i - 1])
        assert.equal(state.messageReveal, 0)
    }
    const completeBrand = globeFinaleAt(end + 1400, end)
    assert.ok(completeBrand.letters.every(value => value === 1))
    assert.equal(completeBrand.messageReveal, 0)
    const subtitle = globeFinaleAt(end + 1700, end)
    assert.equal(subtitle.brandComplete, true)
    assert.ok(subtitle.messageReveal > 0)
    assert.equal(globeFinaleAt(end + GLOBE_FINALE_DURATION_MS, end).messageReveal, 1)
})

test('the finale leaves every geographic frame intact and only starts after the worldwide view', () => {
    for (let elapsed = 0; elapsed < end; elapsed += 80) {
        const state = globeFinaleAt(elapsed, end)
        assert.equal(state.started, false)
        assert.equal(state.sphereOpacity, 1)
        assert.equal(state.particleOpacity, 0)
        assert.equal(state.titleOpacity, 0)
        assert.deepEqual(globeFrameAt(globePlaybackAt(elapsed).milliseconds), globeFrameAt(elapsed))
    }
    assert.equal(globeFinaleAt(end, end).started, true)
})

test('particles and title hand off to a completely vanished globe and a stable closing wordmark', () => {
    const burst = globeFinaleAt(end + 700, end)
    assert.equal(burst.sphereOpacity, 0)
    assert.ok(burst.particleOpacity > .9)
    assert.ok(burst.titleOpacity > 0)
    const final = globeFinaleAt(end + GLOBE_FINALE_DURATION_MS, end)
    assert.equal(final.finished, true)
    assert.equal(final.sphereOpacity, 0)
    assert.equal(final.particleOpacity, 0)
    assert.equal(final.titleOpacity, 1)
    assert.equal(final.messageReveal, 1)
    for (const later of [20_000, 60_000, 3_600_000]) assert.deepEqual(globeFinaleAt(later, end), final)
})

test('the brief lettering flicker remains bounded and never becomes a repeating flash', () => {
    for (let elapsed = 0; elapsed <= GLOBE_FINALE_DURATION_MS; elapsed += 10) {
        const state = globeFinaleAt(end + elapsed, end)
        assert.ok(state.titleOpacity >= 0 && state.titleOpacity <= 1)
        assert.ok(state.titleOpacity + 1e-12 >= state.reveal * .68)
        if (elapsed >= 1330) assert.equal(state.titleOpacity, 1)
    }
    assert.ok(globeFinaleAt(end + 930, end).titleOpacity < globeFinaleAt(end + 885, end).titleOpacity)
})

test('the burst starts at the real land points and remains deterministic across resize and resume', () => {
    for (let index = 0; index < 1000; index++) {
        const seed = globeParticleSeed(index)
        const angle = index * 2.399963
        const x = Math.cos(angle) * .8, y = Math.sin(angle) * .8
        assert.deepEqual(globeParticleAt(x, y, seed, 0), { x, y, size: seed.size, travel: 0 })
        const a = globeParticleAt(x, y, seed, 1000)
        assert.deepEqual(a, globeParticleAt(x, y, globeParticleSeed(index), 1000))
        assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y))
        assert.ok(Math.hypot(a.x, a.y) > Math.hypot(x, y))
    }
})

test('pausing the shared clock freezes the burst and a resume does not jump to wall-clock time', () => {
    const paused = end + 850
    const snapshot = globeFinaleAt(paused, end)
    assert.deepEqual(globeFinaleAt(paused + frameElapsed(0, 50_000) * 1000, end), snapshot)
    assert.ok(frameElapsed(100, 50_000) <= .08)
})
