import Image from 'next/image'
import type { CSSProperties } from 'react'

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
                src="/icons/letbuyy-store-logo-light-v3.svg"
                alt=""
                width={636}
                height={180}
                className="brand-logo-image brand-logo-image-light"
                priority={priority}
                unoptimized
                aria-hidden="true"
            />
            <Image
                src="/icons/letbuyy-store-logo-dark-v3.svg"
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
