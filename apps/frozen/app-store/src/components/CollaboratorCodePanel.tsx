'use client';

import { useState } from 'react';
import { Button, Copy, Loader2 } from '@letbuyy/ui';
import type { PartnerDashboard } from '@letbuyy/shared-types';

type CollaboratorAccess = PartnerDashboard['collaborator_access'];

interface CollaboratorCodePanelProps {
    initialAccess: CollaboratorAccess;
}

interface CollaboratorCodeResponse {
    data?: CollaboratorAccess;
    error?: { message?: string };
}

export function CollaboratorCodePanel({ initialAccess }: CollaboratorCodePanelProps) {
    const [access, setAccess] = useState(initialAccess);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestCode = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/developers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'collaborator_code' }),
            });
            const payload = await response.json().catch(() => null) as CollaboratorCodeResponse | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'Could not request a collaborator code.');
            }
            setAccess(payload.data);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not request a collaborator code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="collaborator-panel">
            <div className="collaborator-panel__code">
                <Copy size={14} aria-hidden="true" />
                <code>{access.has_active_code ? access.request_code : 'No active code'}</code>
            </div>
            {access.has_active_code ? (
                <p>
                    Expires {new Date(access.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
            ) : (
                <p>Generate a short-lived code when a merchant is ready to grant access.</p>
            )}
            <Button
                unstyled
                type="button"
                className="appstore-header-btn"
                onClick={requestCode}
                disabled={loading}
            >
                {loading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                Request new code
            </Button>
            {error && (
                <div className="marketplace-banner marketplace-banner--critical" role="alert">
                    <strong>Collaborator request failed</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
