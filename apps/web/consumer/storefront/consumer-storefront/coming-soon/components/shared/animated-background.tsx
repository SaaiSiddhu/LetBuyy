'use client';

import { useMemo } from 'react';

interface AnimatedBackgroundProps {
    /** CSS class for site-type color (e.g. cs-bg-store) */
    variant: 'store' | 'portfolio' | 'resume' | 'landing' | 'blog';
    /** Show subtle grid lines */
    showGrid?: boolean;
    /** Show floating particles */
    showParticles?: boolean;
    /** Number of particles */
    particleCount?: number;
}

export default function AnimatedBackground({
    variant,
    showGrid = false,
    showParticles = true,
    particleCount = 30,
}: AnimatedBackgroundProps) {
    const particles = useMemo(() =>
        Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            size: 1 + Math.random() * 2,
            delay: Math.random() * 8,
            duration: 4 + Math.random() * 6,
        })),
        [particleCount]
    );

    return (
        <>
            {/* Gradient orbs */}
            <div className={`cs-orb cs-orb-1`} />
            <div className={`cs-orb cs-orb-2`} />
            <div className={`cs-orb cs-orb-3`} />

            {/* Grid overlay */}
            {showGrid && <div className="cs-grid-overlay" />}

            {/* Particles */}
            {showParticles && (
                <div className="cs-particles">
                    {particles.map(p => (
                        <div
                            key={p.id}
                            className="cs-particle"
                            style={{
                                top: p.top,
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                animation: `cs-float-particle ${p.duration}s ease-in-out ${p.delay}s infinite`,
                            }}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
