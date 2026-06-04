'use client';

import { useEffect } from 'react';

const LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION';
const SELECTED_MESSAGE = 'letbuyy:theme-editor:section-selected';
const SCROLL_MESSAGE = 'letbuyy:theme-editor:section-scroll';
const VIEWPORT_MESSAGE = 'letbuyy:theme-editor:viewport';
const LEGACY_VIEWPORT_MESSAGE = 'LETBUYY_THEME_EDITOR_VIEWPORT';
const READY_MESSAGE = 'letbuyy:storefront-preview:ready';

type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

type StorefrontPreviewBridgeProps = {
    initialViewport: PreviewViewport;
    sectionIds: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function getParentTargetOrigin() {
    if (typeof document === 'undefined' || !document.referrer) return '*';

    try {
        return new URL(document.referrer).origin;
    } catch {
        return '*';
    }
}

function normalizeViewport(value: unknown): PreviewViewport | null {
    return value === 'desktop' || value === 'tablet' || value === 'mobile' ? value : null;
}

function applyViewport(viewport: PreviewViewport) {
    document.documentElement.dataset.letbuyyPreviewViewport = viewport;
}

function selectSection(sectionId: string, shouldScroll: boolean) {
    window.postMessage({ type: SELECTED_MESSAGE, sectionId }, window.location.origin);

    if (!shouldScroll) return;

    const target = document.querySelector<HTMLElement>(`[data-letbuyy-editor-section-id="${CSS.escape(sectionId)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export default function StorefrontPreviewBridge({
    initialViewport,
    sectionIds,
}: StorefrontPreviewBridgeProps) {
    useEffect(() => {
        applyViewport(initialViewport);
        window.parent?.postMessage({
            type: READY_MESSAGE,
            viewport: initialViewport,
            sectionIds,
        }, getParentTargetOrigin());
    }, [initialViewport, sectionIds]);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const data = asRecord(event.data);
            const type = data.type;

            if (type === LEGACY_SELECTION_MESSAGE || type === SELECTED_MESSAGE || type === SCROLL_MESSAGE) {
                const sectionId = typeof data.sectionId === 'string'
                    ? data.sectionId
                    : typeof data.selectedSectionId === 'string' ? data.selectedSectionId : '';

                if (sectionId) {
                    selectSection(sectionId, type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE);
                }
                return;
            }

            if (type === VIEWPORT_MESSAGE || type === LEGACY_VIEWPORT_MESSAGE) {
                const viewport = normalizeViewport(data.viewport);
                if (viewport) applyViewport(viewport);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return null;
}
