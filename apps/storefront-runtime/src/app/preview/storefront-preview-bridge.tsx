'use client';

import { useEffect } from 'react';
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SCROLL_MESSAGE,
    EDITOR_VIEWPORT_MESSAGE,
    EDITOR_LEGACY_VIEWPORT_MESSAGE,
    EDITOR_READY_MESSAGE,
    INSPECTOR_SECTION_SCROLLED_TO,
} from '@letbuyy/theme-engine/editor-bridge-protocol';

// Alias to local names for readability within this file; the shared module is the source of truth.
const LEGACY_SELECTION_MESSAGE = EDITOR_LEGACY_SELECTION_MESSAGE;
const SELECTED_MESSAGE = EDITOR_SELECTION_MESSAGE;
const SCROLL_MESSAGE = EDITOR_SCROLL_MESSAGE;
const VIEWPORT_MESSAGE = EDITOR_VIEWPORT_MESSAGE;
const LEGACY_VIEWPORT_MESSAGE = EDITOR_LEGACY_VIEWPORT_MESSAGE;
const READY_MESSAGE = EDITOR_READY_MESSAGE;
const SCROLLED_TO_MESSAGE = INSPECTOR_SECTION_SCROLLED_TO;

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

/**
 * Derive the editor (merchant control-plane) origin for postMessage targeting and validation.
 *
 * NEXT_PUBLIC_ADMIN_URL is baked in at Next.js build time and is the authoritative source:
 *   - dev:  http://localhost:9001
 *   - prod: https://admin.letbuyy.com
 *
 * document.referrer is used as a fallback when the env var is absent.
 * Returns empty string when neither is available — in that case callers must NOT fall back
 * to '*'; the READY_MESSAGE is suppressed and the receive handler rejects all messages
 * (fail-closed).  In a correctly built production deployment NEXT_PUBLIC_ADMIN_URL is always
 * baked in, so the empty-string path should never occur in practice.
 */
function getEditorOrigin(): string {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
    if (adminUrl) {
        try {
            return new URL(adminUrl).origin;
        } catch { /* malformed URL, fall through */ }
    }
    if (typeof document !== 'undefined' && document.referrer) {
        try {
            return new URL(document.referrer).origin;
        } catch { /* malformed URL, fall through */ }
    }
    return '';
}

function normalizeViewport(value: unknown): PreviewViewport | null {
    return value === 'desktop' || value === 'tablet' || value === 'mobile' ? value : null;
}

function applyViewport(viewport: PreviewViewport) {
    document.documentElement.dataset.letbuyyPreviewViewport = viewport;
}

function selectSection(sectionId: string, shouldScroll: boolean) {
    // Re-post SELECTED_MESSAGE same-window so EditorPreviewSectionFrame listeners pick it up.
    // Target is window.location.origin — strictly same-window, never cross-origin.
    window.postMessage({ type: SELECTED_MESSAGE, sectionId }, window.location.origin);

    if (!shouldScroll) return;

    const target = document.querySelector<HTMLElement>(`[data-letbuyy-editor-section-id="${CSS.escape(sectionId)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Dispatch same-window flash trigger after scheduling the scroll.
    // EditorPreviewSectionFrame.handleMessage validates event.origin === window.location.origin,
    // so this is same-window only and cannot be spoofed cross-origin.
    // The bridge's own handleMessage rejects this because event.origin (window.location.origin)
    // !== editorOrigin — no self-loop is possible.
    window.postMessage({ type: SCROLLED_TO_MESSAGE, sectionId }, window.location.origin);
}

export default function StorefrontPreviewBridge({
    initialViewport,
    sectionIds,
}: StorefrontPreviewBridgeProps) {
    useEffect(() => {
        applyViewport(initialViewport);
        // READY_MESSAGE: only send when the editor origin is known.
        // Suppressed (never '*') when NEXT_PUBLIC_ADMIN_URL is absent to avoid broadcasting
        // sectionIds (theme layout metadata) to arbitrary embedders.
        const editorOriginForReady = getEditorOrigin();
        if (editorOriginForReady) {
            window.parent?.postMessage({
                type: READY_MESSAGE,
                viewport: initialViewport,
                sectionIds,
            }, editorOriginForReady);
        } else if (process.env.NODE_ENV !== 'production') {
            console.warn('[StorefrontPreviewBridge] NEXT_PUBLIC_ADMIN_URL not configured — READY_MESSAGE suppressed');
        }
    }, [initialViewport, sectionIds]);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const editorOrigin = getEditorOrigin();

            // SECURITY: Validate the sender's origin against the known editor origin.
            // Fail-closed: when editorOrigin is empty (NEXT_PUBLIC_ADMIN_URL absent and referrer
            // missing) ALL messages are rejected — we must not let an unknown embedder drive
            // preview scroll or selection via this handler.
            if (!editorOrigin || event.origin !== editorOrigin) return;

            const data = asRecord(event.data);
            const type = data.type;

            // Translate ONLY external editor messages (legacy + scroll). SELECTED_MESSAGE must never
            // match here: selectSection() below re-posts SELECTED_MESSAGE to this same window, so
            // matching it re-enters this handler and loops forever. Modern messages posted by the
            // editor reach EditorPreviewSectionFrame listeners on this window directly.
            // INSPECTOR_SECTION_SCROLLED_TO is also excluded: it is a same-window dispatch whose
            // event.origin is window.location.origin (≠ editorOrigin), so the origin guard above
            // already prevents it from entering here.
            if (type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE) {
                const sectionId = typeof data.sectionId === 'string'
                    ? data.sectionId
                    : typeof data.selectedSectionId === 'string' ? data.selectedSectionId : '';

                if (sectionId) {
                    // Only SCROLL_MESSAGE triggers a scroll + flash — LEGACY_SELECTION_MESSAGE
                    // selects (syncs outline) but does not scroll again, preventing the
                    // double-scroll jank when the editor posts all three messages at once.
                    selectSection(sectionId, type === SCROLL_MESSAGE);
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
