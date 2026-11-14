import Image from 'next/image'
import type { CSSProperties } from 'react'
import { BRAND_ASSETS } from '@/lib/brand-assets'

type BrandLogoProps = {
    className?: string
    height?: number
    label?: string
    priority?: boolean
    width?: number
}

export default function BrandLogo({
    className = '',
    height = 68,
    label = 'LetBuyy',
    priority = false,
    width = 210,
}: BrandLogoProps) {
    const style = {
        '--brand-logo-width': `${width}px`,
        '--brand-logo-height': `${height}px`,
    } as CSSProperties

    return (
        <span className={`brand-logo ${className}`.trim()} role="img" aria-label={label} style={style}>
            <Image
                src={BRAND_ASSETS.light}
                alt=""
                width={636}
                height={180}
                className="brand-logo-image brand-logo-image-light"
                priority={priority}
                unoptimized
                aria-hidden="true"
            />
            <Image
                src={BRAND_ASSETS.dark}
                alt=""
                width={636}
                height={180}
                className="brand-logo-image brand-logo-image-dark"
                priority={priority}
                unoptimized
                aria-hidden="true"
            />
        </span>
    )
}
