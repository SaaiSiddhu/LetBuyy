/** Public heading anchors stay identical across translations and existing deep links. */
export function resourceHeadingId(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
