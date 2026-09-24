'use client';

import { useState } from 'react';
import { Button, Loader2, Settings } from '@letbuyy/ui';
import type {
    AppExtensionRegistration,
    AppExtensionRegistryResponse,
    AppFunctionRegistration,
} from '@letbuyy/shared-types';

interface ExtensionConfigPanelProps {
    appId: string;
    installationId: string;
    storeId: string;
}

interface RegistryResponse {
    data?: AppExtensionRegistryResponse;
    error?: { message?: string };
}

function registrationTitle(registration: AppExtensionRegistration | AppFunctionRegistration): string {
    if ('extension_handle' in registration) return String(registration.extension_handle || 'Extension');
    return String(registration.name || registration.function_handle || 'Function');
}

function registrationDetail(registration: AppExtensionRegistration | AppFunctionRegistration): string {
    if ('extension_type' in registration) return `${registration.surface} / ${registration.target}`;
    return `${registration.runtime} / ${registration.hooks.join(', ') || 'no hooks declared'}`;
}

export function ExtensionConfigPanel({ appId, installationId, storeId }: ExtensionConfigPanelProps) {
    const [open, setOpen] = useState(false);
    const [registry, setRegistry] = useState<AppExtensionRegistryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadRegistry = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_extension_registry',
                    installation_id: installationId,
                    store_id: storeId,
                }),
            });
            const payload = await response.json().catch(() => null) as RegistryResponse | null;
            if (!response.ok) throw new Error(payload?.error?.message || 'Extension registry could not be loaded.');
            setRegistry(payload?.data || null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Extension registry could not be loaded.');
        } finally {
            setLoading(false);
        }
    };

    const toggleRegistration = async (
        kind: 'extension' | 'function',
        registration: AppExtensionRegistration | AppFunctionRegistration,
    ) => {
        const nextStatus = registration.status === 'enabled' ? 'disabled' : 'enabled';
        setUpdatingId(registration.id);
        setError(null);
        try {
            const response = await fetch(`/api/apps/${appId}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: kind === 'extension' ? 'update_extension_registration' : 'update_function_registration',
                    installation_id: installationId,
                    registration_id: registration.id,
                    status: nextStatus,
                }),
            });
            const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
            if (!response.ok) throw new Error(payload?.error?.message || 'Registration could not be updated.');
            await loadRegistry();
        } catch (toggleError) {
            setError(toggleError instanceof Error ? toggleError.message : 'Registration could not be updated.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleOpen = () => {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen && !registry && !loading) {
            void loadRegistry();
        }
    };

    const extensionCount = (registry?.extensions.length || 0) + (registry?.functions.length || 0);

    return (
        <div className="extension-config-panel">
            <Button unstyled type="button" className="installed-app-btn" onClick={handleOpen}>
                <Settings size={14} aria-hidden="true" />
                Extensions
            </Button>
            {open && (
                <div className="extension-config-panel__body">
                    <div className="extension-config-panel__header">
                        <strong>Extension registry</strong>
                        <Button unstyled type="button" className="marketplace-inline-action" onClick={() => { void loadRegistry(); }} disabled={loading}>
                            {loading ? <Loader2 size={14} aria-hidden="true" /> : null}
                            Refresh
                        </Button>
                    </div>
                    {error && (
                        <div className="marketplace-banner marketplace-banner--critical" role="alert">
                            <strong>Registry unavailable</strong>
                            <span>{error}</span>
                        </div>
                    )}
                    {loading && !registry ? (
                        <p className="extension-config-panel__muted">Loading extension registry...</p>
                    ) : extensionCount === 0 ? (
                        <p className="extension-config-panel__muted">This installation has no registered extensions or functions.</p>
                    ) : (
                        <div className="extension-config-list">
                            {registry?.extensions.map((registration) => (
                                <div key={registration.id} className="extension-config-row">
                                    <div>
                                        <strong>{registrationTitle(registration)}</strong>
                                        <span>{registrationDetail(registration)}</span>
                                    </div>
                                    <Button
                                        unstyled
                                        type="button"
                                        className="marketplace-inline-action"
                                        onClick={() => { void toggleRegistration('extension', registration); }}
                                        disabled={updatingId === registration.id}
                                    >
                                        {registration.status === 'enabled' ? 'Disable' : 'Enable'}
                                    </Button>
                                </div>
                            ))}
                            {registry?.functions.map((registration) => (
                                <div key={registration.id} className="extension-config-row">
                                    <div>
                                        <strong>{registrationTitle(registration)}</strong>
                                        <span>{registrationDetail(registration)}</span>
                                    </div>
                                    <Button
                                        unstyled
                                        type="button"
                                        className="marketplace-inline-action"
                                        onClick={() => { void toggleRegistration('function', registration); }}
                                        disabled={updatingId === registration.id}
                                    >
                                        {registration.status === 'enabled' ? 'Disable' : 'Enable'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
