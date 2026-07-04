'use client';

import { useEffect } from 'react';
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SCROLL_MESSAGE,
    EDITOR_VIEWPORT_MESSAGE,
    EDITOR_LEGACY_VIEWPORT_MESSAGE,
    EDITOR_READY_MESSAGE,
} from '@letbuyy/theme-engine/editor-bridge-protocol';

// Alias to local names for readability within this file; the shared module is the source of truth.
const LEGACY_SELECTION_MESSAGE = EDITOR_LEGACY_SELECTION_MESSAGE;
const SELECTED_MESSAGE = EDITOR_SELECTION_MESSAGE;
const SCROLL_MESSAGE = EDITOR_SCROLL_MESSAGE;
const VIEWPORT_MESSAGE = EDITOR_VIEWPORT_MESSAGE;
const LEGACY_VIEWPORT_MESSAGE = EDITOR_LEGACY_VIEWPORT_MESSAGE;
const READY_MESSAGE = EDITOR_READY_MESSAGE;

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

            // Translate ONLY external editor messages (legacy + scroll). SELECTED_MESSAGE must never
            // match here: selectSection() below re-posts SELECTED_MESSAGE to this same window, so
            // matching it re-enters this handler and loops forever. Modern messages posted by the
            // editor reach EditorPreviewSectionFrame listeners on this window directly.
            if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE) {
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
