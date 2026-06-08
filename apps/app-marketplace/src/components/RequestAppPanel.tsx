'use client';

import { useState } from 'react';
import { Button, Input, Send, Textarea } from '@letbuyy/ui';
import { sanitizeMarketplaceSearchQuery } from '@/lib/marketplace-display';

interface RequestAppPanelProps {
    query?: string;
    categorySlug?: string | null;
    compact?: boolean;
}

export function RequestAppPanel({ query = '', categorySlug = null, compact = false }: RequestAppPanelProps) {
    const [requestedAppName, setRequestedAppName] = useState('');
    const [useCase, setUseCase] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');

    async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!useCase.trim()) return;
        setStatus('submitting');

        const response = await fetch('/api/apps/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'request_app',
                request: {
                    query: sanitizeMarketplaceSearchQuery(query) || null,
                    category_slug: categorySlug || null,
                    requested_app_name: requestedAppName.trim() || null,
                    use_case: useCase.trim(),
                    contact_email: contactEmail.trim() || null,
                    metadata: { source: compact ? 'compact_empty_state' : 'empty_state' },
                },
            }),
        }).catch(() => null);

        if (response?.ok) {
            setRequestedAppName('');
            setUseCase('');
            setContactEmail('');
            setStatus('sent');
            return;
        }

        setStatus('error');
    }

    return (
        <form className={`request-app-panel${compact ? ' request-app-panel--compact' : ''}`} onSubmit={submitRequest}>
            <div>
                <h3>Request an app</h3>
                <p>Tell us what workflow you need. Marketplace demand signals are reviewed by the app ecosystem team.</p>
            </div>
            <label>
                <span>App or workflow</span>
                <Input
                    value={requestedAppName}
                    onChange={(event) => setRequestedAppName(event.target.value)}
                    maxLength={200}
                    placeholder="Inventory forecasting, returns automation..."
                />
            </label>
            <label>
                <span>Use case</span>
                <Textarea
                    value={useCase}
                    onChange={(event) => setUseCase(event.target.value)}
                    maxLength={2000}
                    required
                    placeholder="What should this app help your store do?"
                />
            </label>
            <label>
                <span>Email for follow-up</span>
                <Input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    maxLength={254}
                    placeholder="you@example.com"
                />
            </label>
            <div className="request-app-panel__footer">
                <Button type="submit" disabled={status === 'submitting' || !useCase.trim()}>
                    <Send size={15} aria-hidden="true" />
                    {status === 'submitting' ? 'Sending' : 'Submit request'}
                </Button>
                {status === 'sent' && <span className="request-app-panel__status">Request captured.</span>}
                {status === 'error' && <span className="request-app-panel__status request-app-panel__status--error">Request could not be saved.</span>}
            </div>
        </form>
    );
}
