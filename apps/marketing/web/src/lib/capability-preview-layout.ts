/** Contain a complete decorative mock in its shared frame without cropping or upscaling. */
export function fitCapabilityPreview(frameWidth: number, frameHeight: number, sourceWidth: number, sourceHeight: number): number {
    if (![frameWidth, frameHeight, sourceWidth, sourceHeight].every(value => Number.isFinite(value) && value > 0)) return 0
    const gutter = 8
    return Math.max(0, Math.min(1, (frameWidth - gutter) / sourceWidth, (frameHeight - gutter) / sourceHeight))
}
