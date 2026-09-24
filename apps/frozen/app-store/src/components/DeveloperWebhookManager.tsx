'use client';

import { useState } from 'react';
import { Button, Input, Loader2, Plus, RadioTower, RefreshCw, Trash2 } from '@letbuyy/ui';
import type { AppWebhookEndpoint } from '@letbuyy/shared-types';

interface DeveloperWebhookManagerProps {
    appId: string;
}

interface WebhookListResponse {
    data?: { webhooks?: AppWebhookEndpoint[] };
    error?: { message?: string };
}

interface WebhookResponse {
    data?: AppWebhookEndpoint;
    error?: { message?: string };
}

function defaultEvent(value: string): string {
    return value.trim() || 'app.installed';
}

export function DeveloperWebhookManager({ appId }: DeveloperWebhookManagerProps) {
    const [webhooks, setWebhooks] = useState<AppWebhookEndpoint[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [name, setName] = useState('');
    const [event, setEvent] = useState('app.installed');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWebhooks = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list_webhooks', app_id: appId }),
            });
            const payload = await response.json().catch(() => null) as WebhookListResponse | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'Webhook endpoints could not be loaded.');
            }
            setWebhooks(payload.data.webhooks || []);
            setLoaded(true);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Webhook endpoints could not be loaded.');
        } finally {
            setLoading(false);
        }
    };

    const createWebhook = async () => {
        if (loading || !url.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const eventName = defaultEvent(event);
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_webhook',
                    app_id: appId,
                    webhook: {
                        name: name.trim() || eventName,
                        event: eventName,
                        event_types: [eventName],
                        url: url.trim(),
                        status: 'active',
                    },
                }),
            });
            const payload = await response.json().catch(() => null) as WebhookResponse | null;
            if (!response.ok || !payload?.data) {
                throw new Error(payload?.error?.message || 'Webhook endpoint could not be created.');
            }
            setWebhooks((current) => [payload.data as AppWebhookEndpoint, ...current]);
            setName('');
            setUrl('');
            setLoaded(true);
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : 'Webhook endpoint could not be created.');
        } finally {
            setLoading(false);
        }
    };

    const archiveWebhook = async (webhookId: string) => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/developers/apps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive_webhook', app_id: appId, webhook_id: webhookId }),
            });
            const payload = await response.json().catch(() => null) as WebhookResponse | null;
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Webhook endpoint could not be archived.');
            }
            setWebhooks((current) => current.filter((item) => item.id !== webhookId));
        } catch (archiveError) {
            setError(archiveError instanceof Error ? archiveError.message : 'Webhook endpoint could not be archived.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="developer-webhook-manager">
            <div className="developer-usage-panel__header">
                <div>
                    <strong>Webhooks</strong>
                    <span>{loaded ? `${webhooks.length} endpoint${webhooks.length === 1 ? '' : 's'}` : 'Delivery endpoints for app events'}</span>
                </div>
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void loadWebhooks(); }} disabled={loading}>
                    {loading ? <Loader2 size={13} aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
                    {loaded ? 'Refresh' : 'Load'}
                </Button>
            </div>
            <div className="developer-webhook-manager__form">
                <Input unstyled className="form-input" value={name} onChange={(inputEvent) => setName(inputEvent.target.value)} placeholder="Name" />
                <Input unstyled className="form-input" value={event} onChange={(inputEvent) => setEvent(inputEvent.target.value)} placeholder="Event type" />
                <Input unstyled className="form-input" value={url} onChange={(inputEvent) => setUrl(inputEvent.target.value)} placeholder="https://example.com/webhooks/letbuyy" />
                <Button unstyled className="dashboard-link-button" type="button" onClick={() => { void createWebhook(); }} disabled={loading || !url.trim()}>
                    <Plus size={13} aria-hidden="true" />
                    Add
                </Button>
            </div>
            {error && <p className="billing-charge-panel__error" role="alert">{error}</p>}
            {loaded && webhooks.length === 0 && <p className="marketplace-panel-copy">No webhook endpoints are registered for this app.</p>}
            {webhooks.length > 0 && (
                <div className="developer-webhook-manager__list">
                    {webhooks.map((item) => (
                        <div key={item.id} className="developer-webhook-row">
                            <RadioTower size={14} aria-hidden="true" />
                            <div>
                                <strong>{item.name || item.event}</strong>
                                <span>{item.event} · {item.status}</span>
                            </div>
                            <Button
                                unstyled
                                className="installed-app-btn danger"
                                type="button"
                                onClick={() => { void archiveWebhook(item.id); }}
                                disabled={loading}
                                aria-label={`Archive webhook ${item.name || item.event}`}
                            >
                                <Trash2 size={13} aria-hidden="true" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
