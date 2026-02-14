'use client';

import { useEffect, useState } from 'react';

interface ComingSoonProps {
    storeName: string;
    tagline?: string;
    logoUrl?: string;
}

export default function ComingSoon({ storeName, tagline, logoUrl }: ComingSoonProps) {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
            color: '#ffffff',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            padding: '2rem',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Animated background orbs */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '10%',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 8s ease-in-out infinite',
            }} />
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '15%',
                width: '250px',
                height: '250px',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 10s ease-in-out infinite reverse',
            }} />
            <div style={{
                position: 'absolute',
                top: '60%',
                left: '60%',
                width: '200px',
                height: '200px',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'float 12s ease-in-out infinite',
            }} />

            {/* Content */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                maxWidth: '600px',
            }}>
                {/* Logo */}
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={storeName}
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '20px',
                            objectFit: 'cover',
                            marginBottom: '2rem',
                            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                        }}
                    />
                ) : (
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        fontWeight: 700,
                        marginBottom: '2rem',
                        margin: '0 auto 2rem',
                        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                    }}>
                        {storeName.charAt(0).toUpperCase()}
                    </div>
                )}

                {/* Badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1.25rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: '#a5b4fc',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '2rem',
                }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#6366f1',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    Setting up
                </div>

                {/* Store Name */}
                <h1 style={{
                    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 50%, #c4b5fd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '1rem',
                    lineHeight: 1.1,
                }}>
                    {storeName}
                </h1>

                {/* Tagline or default */}
                <p style={{
                    fontSize: '1.2rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '3rem',
                    lineHeight: 1.6,
                }}>
                    {tagline || 'Something amazing is on its way. Stay tuned!'}
                </p>

                {/* Building indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    padding: '1rem 2rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    marginBottom: '3rem',
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem' }}>
                        Building store{dots}
                    </span>
                </div>

                {/* Powered by */}
                <p style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.3)',
                }}>
                    Powered by{' '}
                    <a
                        href="https://letbuyy.store"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: 'rgba(165, 180, 252, 0.6)',
                            textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        LetBuyy
                    </a>
                </p>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-30px) scale(1.05); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
            `}</style>
        </div>
    );
}
