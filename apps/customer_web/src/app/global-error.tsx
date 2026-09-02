'use client'

import { useEffect } from 'react'
import { Button } from '@letbuyy/ui'

// global-error replaces the root layout when the layout itself throws, so it
// must render its own <html>/<body> and stay fully self-contained (no
// design-system or CSS dependencies, which may be exactly what failed).
export default function StorefrontGlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <html lang="en">
            <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
                <div
                    style={{
                        minHeight: '100dvh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem',
                        background: 'rgb(255 255 255)',
                        color: 'rgb(15 23 42)',
                    }}
                >
                    <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
                        <p
                            style={{
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: 'rgb(139 92 246)',
                                margin: '0 0 0.75rem',
                            }}
                        >
                            LetBuyy
                        </p>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                            Something went wrong
                        </h1>
                        <p style={{ fontSize: '0.9375rem', opacity: 0.7, margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                            We hit a critical error loading this store. This is usually temporary — please try again.
                        </p>
                        <Button
                            type="button"
                            onClick={reset}
                            unstyled
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '2.75rem',
                                padding: '0 1.5rem',
                                borderRadius: '9999px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                color: 'var(--lb-color-text-inverse, rgb(255 255 255))',
                                background: 'rgb(139 92 246)',
                            }}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            </body>
        </html>
    )
}
