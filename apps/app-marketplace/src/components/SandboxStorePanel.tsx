'use client';

import { useState } from 'react';
import { Button, Input, Loader2, Plus, Store } from '@letbuyy/ui';
import type { AppSandboxStore } from '@letbuyy/shared-types';

interface SandboxStorePanelProps {
    initialStores: AppSandboxStore[];
    defaultName: string;
}

interface SandboxResponse {
    data?: AppSandboxStore | { stores?: AppSandboxStore[] };
    error?: { message?: string };
}

function statusLabel(value: string): string {
    return value.replace(/_/g, ' ');
}

export function SandboxStorePanel({ initialStores, defaultName }: SandboxStorePanelProps) {
    const [stores, setStores] = useState(initialStores);
    const [name, setName] = useState(defaultName ? `${defaultName} sandbox` : '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestStore = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/developers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'request_sandbox_store',
                    name: name.trim() || undefined,
                    provisioning_mode: 'sandbox',
                }),
            });
            const payload = await response.json().catch(() => null) as SandboxResponse | null;
            if (!response.ok || !payload?.data || 'stores' in payload.data) {
                throw new Error(payload?.error?.message || 'Sandbox store request could not be created.');
            }
            setStores((current) => [payload.data as AppSandboxStore, ...current]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Sandbox store request could not be created.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sandbox-store-panel">
            <div className="developer-usage-panel__header">
                <div>
                    <strong>Sandbox stores</strong>
                    <span>{stores.length} request{stores.length === 1 ? '' : 's'} tracked</span>
                </div>
            </div>
            <div className="sandbox-store-panel__form">
                <Input unstyled className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sandbox store name" />
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void requestStore(); }} disabled={loading}>
                    {loading ? <Loader2 size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                    Request
                </Button>
            </div>
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
            {stores.length === 0 ? (
                <p className="marketplace-panel-copy">No sandbox stores have been requested yet.</p>
            ) : (
                <div className="sandbox-store-panel__list">
                    {stores.slice(0, 4).map((store) => (
                        <div key={store.id} className="dashboard-store-row">
                            <div className="dashboard-store-copy">
                                <div className="dashboard-store-title">
                                    <Store size={14} aria-hidden="true" />
                                    <span className="dashboard-truncate">{store.name}</span>
                                </div>
                                <p className="dashboard-store-subtitle">{store.subdomain || 'Provisioning details pending'}</p>
                            </div>
                            <span className="marketplace-badge marketplace-badge--neutral">{statusLabel(store.status)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
