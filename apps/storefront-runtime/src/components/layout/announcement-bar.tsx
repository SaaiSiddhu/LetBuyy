// ============================================================
// ANNOUNCEMENT BAR — slim promotional bar above the storefront header
// ------------------------------------------------------------
// Rendered as the `core.announcement-bar` registry entry (LB-8). It lives in
// components/layout/ alongside DynamicHeader / DynamicFooter — it is intentionally
// NOT a frozen components/sections/*.tsx React section, so the post-Liquid
// React-section freeze (no-new-react-sections-validator) is preserved.
//
// Driven by the merchant-configurable `announcementBar` theme section settings
// (packages/theme-engine theme-registry). Merchant colors are applied via inline
// style (runtime values cannot be tokenized); layout uses standard utilities only.
// ============================================================

import type { CSSProperties } from 'react';

export interface AnnouncementBarSettings {
    /** Promotional message. Empty/absent => the bar does not render. */
    text?: string;
    /** Optional call-to-action label, paired with linkHref. */
    linkLabel?: string;
    /** Optional call-to-action destination, paired with linkLabel. */
    linkHref?: string;
    /** Horizontal alignment of the bar content. */
    alignment?: 'left' | 'center' | 'right';
    /** Merchant background color (hex or CSS color). Falls back to the brand primary. */
    backgroundColor?: string;
    /** Merchant text color (hex or CSS color). Falls back to white. */
    textColor?: string;
    /** Hide below the `sm` breakpoint when false. Defaults to shown on mobile. */
    visibleOnMobile?: boolean;
    /** Explicit show/hide switch. Only `false` hides the bar (default = shown). */
    enabled?: boolean;
    /** Schedule-ready: ISO start of the display window (gated server-side when provided). */
    startsAt?: string;
    /** Schedule-ready: ISO end of the display window (gated server-side when provided). */
    endsAt?: string;
}

/**
 * Pure, hydration-safe visibility decision. `nowMs` is INJECTED (the component holds
 * no internal clock) so the same logic is unit-testable and can be evaluated server-side
 * for the optional schedule window without risking a server/client hydration mismatch.
 */
export function shouldDisplayAnnouncement(
    settings: AnnouncementBarSettings | null | undefined,
    nowMs?: number,
): boolean {
    if (!settings) return false;
    if (settings.enabled === false) return false;
    if (!settings.text || !settings.text.trim()) return false;
    if (typeof nowMs === 'number') {
        if (settings.startsAt) {
            const start = Date.parse(settings.startsAt);
            if (Number.isFinite(start) && nowMs < start) return false;
        }
        if (settings.endsAt) {
            const end = Date.parse(settings.endsAt);
            if (Number.isFinite(end) && nowMs > end) return false;
        }
    }
    return true;
}

interface Props {
    settings: AnnouncementBarSettings;
    /** Optional injected clock for schedule gating (server-side). Omitted => no time gate. */
    now?: number;
}

export default function AnnouncementBar({ settings, now }: Props) {
    if (!shouldDisplayAnnouncement(settings, now)) return null;

    const text = (settings.text as string).trim();
    const justify =
        settings.alignment === 'left' ? 'flex-start'
        : settings.alignment === 'right' ? 'flex-end'
        : 'center';

    const barStyle: CSSProperties = {
        // Merchant-chosen colors arrive as section data (settings.*); the fallbacks mirror the
        // storefront's established `var(--token, rgb(...))` pattern (no raw hex literals in source).
        backgroundColor: settings.backgroundColor || 'var(--primary, rgb(15 23 42))',
        color: settings.textColor || 'rgb(255 255 255)',
        justifyContent: justify,
    };

    // visibleOnMobile === false hides the bar below the `sm` breakpoint.
    const visibility = settings.visibleOnMobile === false ? 'hidden sm:flex' : 'flex';

    return (
        <div
            role="region"
            aria-label="Store announcement"
            data-section-type="announcementBar"
            className={`w-full ${visibility} flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-center text-sm font-medium`}
            style={barStyle}
        >
            <span>{text}</span>
            {settings.linkHref && settings.linkLabel ? (
                <a
                    href={settings.linkHref}
                    className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
                    style={{ color: 'inherit' }}
                >
                    {settings.linkLabel}
                </a>
            ) : null}
        </div>
    );
}
