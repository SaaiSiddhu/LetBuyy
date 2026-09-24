import { marketplaceCapabilityEnabled } from '@/lib/capabilities';

export type MarketplaceTelemetryEvent =
    | 'app_discovered'
    | 'app_detail_viewed'
    | 'install_consent_opened'
    | 'install_started'
    | 'install_completed'
    | 'review_submitted';

const TELEMETRY_ENABLED = marketplaceCapabilityEnabled('appTelemetry');
const SESSION_KEY = 'letbuyy:marketplace-telemetry-session';

function getTelemetrySessionId(): string {
    try {
        const existing = window.sessionStorage.getItem(SESSION_KEY);
        if (existing) return existing;
        const next = typeof window.crypto?.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `mp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(SESSION_KEY, next);
        return next;
    } catch {
        return `mp-${Date.now()}`;
    }
}

export function recordMarketplaceEvent(event: MarketplaceTelemetryEvent, properties: Record<string, unknown> = {}) {
    if (!TELEMETRY_ENABLED) {
        return;
    }

    if (typeof window === 'undefined') {
        return;
    }

    const timestamp = new Date().toISOString();
    const detail = { event, properties, timestamp };
    window.dispatchEvent(new CustomEvent('letbuyy:marketplace-telemetry', { detail }));

    const body = JSON.stringify({
        action: 'telemetry_event',
        event: {
            event_type: event,
            source: 'marketplace-ui',
            session_id: getTelemetrySessionId(),
            metadata: properties,
            occurred_at: timestamp,
        },
    });

    if (typeof navigator.sendBeacon === 'function') {
        const sent = navigator.sendBeacon('/api/apps/search', new Blob([body], { type: 'application/json' }));
        if (sent) return;
    }

    void fetch('/api/apps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
    }).catch(() => undefined);
}
