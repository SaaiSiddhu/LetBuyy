'use client';

import { useState } from 'react';

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

function seededUnit(index: number, salt: number) {
    const value = Math.sin((index + 1) * salt) * 10000;
    return value - Math.floor(value);
}

export default function AnimatedBackground({
    showGrid = false,
    showParticles = true,
    particleCount = 30,
}: AnimatedBackgroundProps) {
    const [particles] = useState(() =>
        Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            top: `${seededUnit(i, 19.19) * 100}%`,
            left: `${seededUnit(i, 47.47) * 100}%`,
            size: 1 + seededUnit(i, 12.9898) * 2,
            delay: seededUnit(i, 53.31) * 8,
            duration: 4 + seededUnit(i, 91.17) * 6,
        }))
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
