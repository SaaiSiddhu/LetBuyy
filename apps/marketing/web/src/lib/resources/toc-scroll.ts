/** Reveal an item inside its own scroll container without scrolling ancestors. */
export function getTocScrollTop({
  scrollTop,
  viewportTop,
  viewportHeight,
  contentHeight,
  itemTop,
  itemBottom,
}: {
  scrollTop: number
  viewportTop: number
  viewportHeight: number
  contentHeight: number
  itemTop: number
  itemBottom: number
}): number {
  if (viewportHeight <= 0) return scrollTop
  let next = scrollTop
  if (itemTop < viewportTop) next += itemTop - viewportTop
  else if (itemBottom > viewportTop + viewportHeight) next += itemBottom - viewportTop - viewportHeight
  return Math.min(Math.max(0, next), Math.max(0, contentHeight - viewportHeight))
}

/** Recompute from position so fast scrolling in either direction cannot leave a stale section. */
export function getActiveTocHeading(headings: readonly { id: string; top: number }[], activationLine: number): string {
  let active = ''
  for (const heading of headings) {
    if (heading.top <= activationLine) active = heading.id
  }
  return active
}
