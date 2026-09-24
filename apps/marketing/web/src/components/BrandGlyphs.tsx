/**
 * Social brand marks that Lucide — and therefore @letbuyy/ui — does not carry.
 *
 * @letbuyy/ui still exports `Twitter`, which is the old bird. That mark now
 * reads as a different company, so X is inlined here as the current glyph.
 *
 * Drawn in `currentColor` so it inherits the footer's colour like every other
 * icon and needs no token exception, and filled rather than stroked: brand
 * marks are solid shapes, and stroking one produces an outline that reads as
 * a different logo.
 */
type GlyphProps = {
    width?: number
    height?: number
    className?: string
}

function glyphProps({ width = 24, height = 24, className }: GlyphProps) {
    return {
        width,
        height,
        className,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': true as const,
    }
}

export function XMark(props: GlyphProps) {
    return (
        <svg {...glyphProps(props)}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
        </svg>
    )
}


