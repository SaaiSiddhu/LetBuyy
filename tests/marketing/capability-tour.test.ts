import assert from 'node:assert/strict'
import test from 'node:test'
import { nextCapability, previousCapability, capabilitySwipeDirection, capabilityTourIsDue, TOUR_STEP_MS, TOUR_READING_PAUSE_MS, type CapabilityId } from '../../apps/marketing/web/src/lib/capability-tour'

test('the automatic tour demonstrates storefront, orders, payments and analytics in sequence', () => {
    let selected: CapabilityId = 'storefronts'
    const visited: CapabilityId[] = [selected]
    for (let i = 0; i < 3; i++) { selected = nextCapability(selected); visited.push(selected) }
    assert.deepEqual(visited, ['storefronts', 'orders', 'payments', 'analytics'])
})

test('a full tour visits every existing module once and returns to storefronts', () => {
    let selected: CapabilityId = 'storefronts'
    const visited: CapabilityId[] = []
    for (let i = 0; i < 8; i++) { visited.push(selected); selected = nextCapability(selected) }
    assert.deepEqual([...visited].sort(), ['ai', 'analytics', 'b2b', 'customers', 'inventory', 'orders', 'payments', 'storefronts'])
    assert.equal(selected, 'storefronts')
})

test('resuming after a manual selection continues from that module', () => {
    assert.equal(nextCapability('payments'), 'analytics')
    assert.equal(nextCapability('b2b'), 'storefronts')
})


test('right swipes go backwards and wrap from storefront to B2B', () => {
    assert.equal(previousCapability('storefronts'), 'b2b')
    assert.equal(previousCapability('payments'), 'orders')
    let selected: CapabilityId = 'storefronts'
    for (let i = 0; i < 8; i++) selected = previousCapability(selected)
    assert.equal(selected, 'storefronts')
})

test('a deliberate left or right swipe selects the corresponding direction', () => {
    assert.equal(capabilitySwipeDirection(-65, 5, 320), 1)
    assert.equal(capabilitySwipeDirection(65, -5, 320), -1)
    assert.equal(capabilitySwipeDirection(-90, 12, 1000), 1)
})

test('taps, short drags and vertical or diagonal scrolling do not change cards', () => {
    for (const [dx, dy] of [[0, 0], [15, 2], [-35, 0], [25, 100], [70, 60], [-70, -90]]) {
        assert.equal(capabilitySwipeDirection(dx, dy, 320), 0)
    }
    assert.equal(capabilitySwipeDirection(50, 1, 1000), 0)
})

test('touch holds and the reading interval block fast rotation until the pause expires', () => {
    assert.equal(TOUR_STEP_MS, 3000)
    assert.equal(TOUR_READING_PAUSE_MS, 8000)
    assert.equal(capabilityTourIsDue(3000, 3000, false, 0), true)
    assert.equal(capabilityTourIsDue(20000, 3000, true, 0), false)
    assert.equal(capabilityTourIsDue(7999, 3000, false, 8000), false)
    assert.equal(capabilityTourIsDue(8000, 8000, false, 8000), true)
    assert.equal(capabilityTourIsDue(8000, 11000, false, 8000), false)
})
