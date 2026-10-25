import assert from 'node:assert/strict'
import test from 'node:test'
import { getActiveTocHeading, getTocScrollTop } from '../../apps/marketing/web/src/lib/resources/toc-scroll'

const rail = { scrollTop: 100, viewportTop: 88, viewportHeight: 300, contentHeight: 900 }

test('an already visible contents item never changes the rail position', () => {
  assert.equal(getTocScrollTop({ ...rail, itemTop: 100, itemBottom: 150 }), 100)
  assert.equal(getTocScrollTop({ ...rail, itemTop: 88, itemBottom: 388 }), 100)
})

test('items above and below the rail move only as far as needed', () => {
  assert.equal(getTocScrollTop({ ...rail, itemTop: 68, itemBottom: 108 }), 80)
  assert.equal(getTocScrollTop({ ...rail, itemTop: 368, itemBottom: 408 }), 120)
})

test('hidden mobile contents and non-overflowing rails do not invent scrolling', () => {
  assert.equal(getTocScrollTop({ ...rail, viewportHeight: 0, itemTop: 0, itemBottom: 0 }), 100)
  assert.equal(getTocScrollTop({ ...rail, scrollTop: 0, contentHeight: 200, itemTop: 100, itemBottom: 150 }), 0)
})

test('computed rail scrolling is clamped to its own content bounds', () => {
  for (let itemTop = -1000; itemTop <= 2000; itemTop += 23) {
    const next = getTocScrollTop({ ...rail, itemTop, itemBottom: itemTop + 40 })
    assert.ok(next >= 0 && next <= rail.contentHeight - rail.viewportHeight)
  }
})


test('scrolling down and back up selects the current section from its actual position', () => {
  const positions = [500, 1000, 1500]
  const at = (scrollTop: number) => positions.map((top, i) => ({ id: `section-${i}`, top: top - scrollTop }))
  assert.equal(getActiveTocHeading(at(1500), 112), 'section-2')
  assert.equal(getActiveTocHeading(at(900), 112), 'section-1')
  assert.equal(getActiveTocHeading(at(600), 112), 'section-0')
  assert.equal(getActiveTocHeading(at(0), 112), '')
})

test('a fast jump across several headings does not require intermediate intersection events', () => {
  assert.equal(getActiveTocHeading([{ id: 'a', top: -1000 }, { id: 'b', top: -500 }, { id: 'c', top: 100 }], 112), 'c')
  assert.equal(getActiveTocHeading([], 112), '')
})
