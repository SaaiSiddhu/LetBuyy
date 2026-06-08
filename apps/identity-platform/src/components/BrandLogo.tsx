'use client'

type BrandLogoProps = {
    className?: string
}

export function BrandLogo({ className = '' }: BrandLogoProps) {
    return (
        <span className={['auth-brand-logo', className].filter(Boolean).join(' ')} role="img" aria-label="LetBuyy">
            <img
                src="/icons/letbuyy-logo-light.svg"
                alt=""
                width={680}
                height={220}
                className="auth-brand-logo-image auth-brand-logo-image-light"
                aria-hidden="true"
            />
            <img
                src="/icons/letbuyy-logo-dark.svg"
                alt=""
                width={680}
                height={220}
                className="auth-brand-logo-image auth-brand-logo-image-dark"
                aria-hidden="true"
            />
        </span>
    )
}
