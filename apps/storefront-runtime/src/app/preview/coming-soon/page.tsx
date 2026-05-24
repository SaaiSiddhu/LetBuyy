'use client';

import { useState } from 'react';
import ComingSoonRouter from '@/components/coming-soon';
import type { SiteType } from '@/components/coming-soon';

const SITE_TYPES: { type: SiteType; label: string; color: string }[] = [
    { type: 'store', label: '🛍️ Store', color: '#6366f1' },
    { type: 'portfolio', label: '🎨 Portfolio', color: '#111111' },
    { type: 'resume', label: '📄 Resume', color: '#3b82f6' },
    { type: 'landing', label: '🚀 Landing', color: '#8b5cf6' },
    { type: 'blog', label: '✍️ Blog', color: '#f97316' },
];

export default function ComingSoonPreview() {
    const [active, setActive] = useState<SiteType>('store');

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
            {/* Page */}
            <ComingSoonRouter
                siteType={active}
                storeName="LetBuyy Demo"
                tagline="Preview of the coming soon pages — switch between site types below."
            />

            {/* Switcher Bar */}
            <div style={{
                position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 4, padding: 4, borderRadius: 14, zIndex: 9999,
                background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,.1)',
                boxShadow: '0 12px 40px rgba(0,0,0,.4)',
            }}>
                {SITE_TYPES.map(st => (
                    <button
                        key={st.type}
                        onClick={() => setActive(st.type)}
                        style={{
                            padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            fontFamily: "'Inter',-apple-system,sans-serif",
                            fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                            background: active === st.type ? st.color : 'transparent',
                            color: active === st.type ? '#fff' : 'rgba(255,255,255,.5)',
                            transition: 'all .25s ease',
                        }}
                    >{st.label}</button>
                ))}
            </div>
        </div>
    );
}
