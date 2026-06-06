'use client'

import type { CSSProperties } from 'react'

export interface MarketplaceUnavailableProps {
    title?: string
    body?: string
    buttonLabel?: string
    onRetry?: () => void
    className?: string
    headingClassName?: string
    bodyClassName?: string
    buttonClassName?: string
    style?: CSSProperties
    headingStyle?: CSSProperties
    bodyStyle?: CSSProperties
    buttonStyle?: CSSProperties
}

export function MarketplaceUnavailable({
    title = 'Marketplace temporarily unavailable',
    body = 'We could not reach the marketplace service right now. This is a temporary issue on our side. Please try again.',
    buttonLabel = 'Try again',
    onRetry,
    className,
    headingClassName,
    bodyClassName,
    buttonClassName,
    style,
    headingStyle,
    bodyStyle,
    buttonStyle,
}: MarketplaceUnavailableProps) {
    const handleRetry = onRetry ?? (() => window.location.reload())

    return (
        <div role="alert" aria-live="polite" className={className} style={style}>
            <h3 className={headingClassName} style={headingStyle}>{title}</h3>
            <p className={bodyClassName} style={bodyStyle}>
                {body}
            </p>
            <button type="button" onClick={handleRetry} className={buttonClassName} style={buttonStyle}>
                {buttonLabel}
            </button>
        </div>
    )
}
