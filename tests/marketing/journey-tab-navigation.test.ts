import assert from 'node:assert/strict'
import test from 'node:test'
import { journeyTabTarget } from '../../apps/marketing/web/src/lib/journey-tab-navigation'

test('the journey tab arrows move in both directions and wrap at either end', () => {
    assert.equal(journeyTabTarget('ArrowRight', 0, 5), 1)
    assert.equal(journeyTabTarget('ArrowRight', 4, 5), 0)
    assert.equal(journeyTabTarget('ArrowLeft', 0, 5), 4)
    assert.equal(journeyTabTarget('ArrowLeft', 3, 5), 2)
})

test('Home and End reach the first and final stages without changing tab count', () => {
    assert.equal(journeyTabTarget('Home', 3, 5), 0)
    assert.equal(journeyTabTarget('End', 1, 5), 4)
    assert.equal(journeyTabTarget('End', 0, 1), 0)
})

test('ordinary reading and vertical scroll keys stay with the browser', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Tab', 'Enter', ' ']) {
        assert.equal(journeyTabTarget(key, 2, 5), null)
    }
    assert.equal(journeyTabTarget('ArrowRight', 0, 0), null)
})
