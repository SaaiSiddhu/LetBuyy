'use client';

import { useState } from 'react';
import { Button, KeyRound, Loader2 } from '@letbuyy/ui';

interface ApiKeyPanelProps {
    appId: string;
}

interface ApiKeyResponse {
    data?: {
        api_key?: string;
        client_secret?: string;
        api_key_prefix?: string;
        oauth_client_id?: string;
    };
    error?: { message?: string };
}

export function ApiKeyPanel({ appId }: ApiKeyPanelProps) {
    const [loading, setLoading] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const rotateKey = async () => {
        setLoading(true);
        setError(null);
        setSecret(null);

        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rotate_api_key', app_id: appId }),
            });
            const payload = await response.json().catch(() => null) as ApiKeyResponse | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'API key rotation failed.');
            }
            setSecret(payload?.data?.api_key || payload?.data?.client_secret || payload?.data?.api_key_prefix || 'Key rotated. Secret is not returned by this backend.');
        } catch (rotateError) {
            setError(rotateError instanceof Error ? rotateError.message : 'API key rotation failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="api-key-panel">
            <Button
                unstyled
                type="button"
                className="installed-app-btn"
                onClick={rotateKey}
                disabled={loading}
                aria-label="Rotate API key"
            >
                {loading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <KeyRound size={12} aria-hidden="true" />}
                Rotate key
            </Button>
            {secret && (
                <div className="marketplace-banner marketplace-banner--warning" role="status">
                    <strong>Reveal once</strong>
                    <code>{secret}</code>
                </div>
            )}
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Key rotation failed</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
