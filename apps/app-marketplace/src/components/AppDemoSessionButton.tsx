'use client';

import { useState } from 'react';
import { Button, ExternalLink, Loader2, Rocket } from '@letbuyy/ui';
import type { AppDemoSession } from '@letbuyy/shared-types';

interface AppDemoSessionButtonProps {
    appId: string;
}

interface DemoSessionResponse {
    data?: { session?: AppDemoSession };
    error?: { message?: string };
}

export function AppDemoSessionButton({ appId }: AppDemoSessionButtonProps) {
    const [loading, setLoading] = useState(false);
    const [demoUrl, setDemoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startDemo = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${encodeURIComponent(appId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'demo_session' }),
            });
            const payload = await response.json().catch(() => null) as DemoSessionResponse | null;
            const session = payload?.data?.session;
            if (!response.ok || !session?.demo_url) {
                throw new Error(payload?.error?.message || 'Demo session is not available for this app.');
            }
            setDemoUrl(session.demo_url);
            window.open(session.demo_url, '_blank', 'noopener,noreferrer');
        } catch (demoError) {
            setError(demoError instanceof Error ? demoError.message : 'Demo session is not available for this app.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-demo-session">
            <Button unstyled className="appstore-header-btn app-demo-session__button" type="button" onClick={() => { void startDemo(); }} disabled={loading}>
                {loading ? <Loader2 size={14} aria-hidden="true" /> : <Rocket size={14} aria-hidden="true" />}
                Test drive
            </Button>
            {demoUrl && (
                <a className="app-install-secondary-link" href={demoUrl} target="_blank" rel="noreferrer">
                    Open demo
                    <ExternalLink size={13} aria-hidden="true" />
                </a>
            )}
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
        </div>
    );
}
