import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * The platform wordmark, identical to the marketing site's.
 *
 * Both variants are rendered and swapped with CSS rather than picking one in
 * JS: the theme is resolved by a blocking script before paint, and choosing in
 * React would flash the wrong logo on first render.
 */
type BrandLogoProps = {
    className?: string;
    height?: number;
    label?: string;
    priority?: boolean;
    width?: number;
};

export default function BrandLogo({
    className = '',
    height = 68,
    label = 'LetBuyy Themes',
    priority = false,
    width = 210,
}: BrandLogoProps) {
    const style = {
        '--brand-logo-width': `${width}px`,
        '--brand-logo-height': `${height}px`,
    } as CSSProperties;

    return (
        <span className={`brand-logo ${className}`.trim()} role="img" aria-label={label} style={style}>
            <Image
                src="/icons/letbuyy-logo-light.svg"
                alt=""
                width={680}
                height={220}
                className="brand-logo-image brand-logo-image-light"
                priority={priority}
                unoptimized
                aria-hidden="true"
            />
            <Image
                src="/icons/letbuyy-logo-dark.svg"
                alt=""
                width={680}
                height={220}
                className="brand-logo-image brand-logo-image-dark"
                priority={priority}
                unoptimized
                aria-hidden="true"
            />
        </span>
    );
}
