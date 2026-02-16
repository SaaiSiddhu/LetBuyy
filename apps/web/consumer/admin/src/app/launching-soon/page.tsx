import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Launching Soon — LetBuyy',
    description: 'This store is being set up. Check back soon!',
}

/**
 * /launching-soon
 * Publicly visible placeholder for stores still in draft mode.
 * Shown when a user visits a subdomain whose store.status === 'draft'.
 *
 * The storefront middleware should redirect here when the store isn't published.
 */
export default function LaunchingSoonPage() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily:
                    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                background: 'linear-gradient(145deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)',
                color: '#fff',
                textAlign: 'center',
                padding: '40px 20px',
            }}
        >
            {/* Animated gradient orb */}
            <div
                style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background:
                        'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0.1) 50%, transparent 70%)',
                    marginBottom: 40,
                    animation: 'pulse 3s ease-in-out infinite',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                }}
            >
                🚀
            </div>

            <h1
                style={{
                    fontSize: 'clamp(28px, 5vw, 44px)',
                    fontWeight: 800,
                    margin: '0 0 12px',
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #fff, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}
            >
                Launching Soon
            </h1>

            <p
                style={{
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.6)',
                    maxWidth: 420,
                    lineHeight: 1.6,
                    margin: '0 0 40px',
                }}
            >
                This store is currently being set up. Check back soon for something amazing.
            </p>

            {/* Powered by badge */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.4)',
                }}
            >
                Powered by{' '}
                <span style={{ fontWeight: 700, color: '#a78bfa' }}>LetBuyy</span>
            </div>

            {/* CSS animation */}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); opacity: 0.8; }
                            50% { transform: scale(1.08); opacity: 1; }
                        }
                    `,
                }}
            />
        </div>
    )
}
