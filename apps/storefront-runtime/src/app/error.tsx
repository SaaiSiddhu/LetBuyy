'use client'

import { useEffect } from 'react'
import { Button } from '@letbuyy/ui'

export default function StorefrontError({
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
        <main
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                background: 'var(--background, rgb(255 255 255))',
                color: 'var(--foreground, rgb(15 23 42))',
            }}
        >
            <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
                <p
                    style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--primary, rgb(139 92 246))',
                        margin: '0 0 0.75rem',
                    }}
                >
                    LetBuyy
                </p>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                    Something went wrong
                </h1>
                <p style={{ fontSize: '0.9375rem', opacity: 0.7, margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                    We couldn&apos;t load this page right now. This is usually temporary — please try again.
                </p>
                {error?.digest ? (
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: '0 0 1.5rem', fontFamily: 'var(--font-letbuyy-mono, ui-monospace, monospace)' }}>
                        Reference: {error.digest}
                    </p>
                ) : null}
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
                        background: 'var(--primary, rgb(139 92 246))',
                    }}
                >
                    Try again
                </Button>
            </div>
        </main>
    )
}
