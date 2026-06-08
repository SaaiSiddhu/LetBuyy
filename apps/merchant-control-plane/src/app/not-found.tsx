import Link from 'next/link'

export default function MerchantNotFound() {
    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                background: 'var(--background, rgb(246 247 249))',
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
                <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: '0 0 0.25rem', lineHeight: 1 }}>404</h1>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Page not found</h2>
                <p style={{ fontSize: '0.9375rem', opacity: 0.7, margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                    The page you are looking for does not exist or may have been moved.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '2.75rem',
                        padding: '0 1.5rem',
                        borderRadius: '0.625rem',
                        textDecoration: 'none',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--lb-color-text-inverse, rgb(255 255 255))',
                        background: 'var(--primary, rgb(139 92 246))',
                    }}
                >
                    Back to dashboard
                </Link>
            </div>
        </div>
    )
}
