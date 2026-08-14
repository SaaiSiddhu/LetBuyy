'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Button } from '@letbuyy/ui';
import {
    EDITOR_SECTION_SELECT_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    INSPECTOR_SECTION_HOVERED,
    INSPECTOR_HOVER_CLEARED,
    INSPECTOR_ADD_SECTION_INTENT,
    INSPECTOR_SECTION_SCROLLED_TO,
} from '@letbuyy/theme-engine/editor-bridge-protocol';

// Alias to local names for readability within this file; the shared module is the source of truth.
const SELECT_MESSAGE = EDITOR_SECTION_SELECT_MESSAGE;
const SELECTED_MESSAGE = EDITOR_SELECTION_MESSAGE;
const HOVERED_MESSAGE = INSPECTOR_SECTION_HOVERED;
const HOVER_CLEARED_MESSAGE = INSPECTOR_HOVER_CLEARED;
const ADD_INTENT_MESSAGE = INSPECTOR_ADD_SECTION_INTENT;
const SCROLLED_TO_MESSAGE = INSPECTOR_SECTION_SCROLLED_TO;

// Must match the CSS animation duration on .storefront-editor-section-frame--flash.
const FLASH_DURATION_MS = 700;

type EditorPreviewSectionFrameProps = {
    children: ReactNode;
    rendererKey: string;
    sectionId: string;
    sectionType: string;
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
 * document.referrer is used as a fallback only when the env var is absent.
 * Returns empty string when neither is determinable — callers MUST check and skip sending
 * rather than falling back to '*'.  Sending inspector messages to '*' would leak section
 * selections and hover state to any origin that can embed the preview.
 */
function getEditorOrigin(): string {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
    if (adminUrl) {
        try {
            return new URL(adminUrl).origin;
        } catch { /* malformed, fall through */ }
    }
    if (typeof document !== 'undefined' && document.referrer) {
        try {
            return new URL(document.referrer).origin;
        } catch { /* malformed, fall through */ }
    }
    return '';
}

export default function EditorPreviewSectionFrame({
    children,
    rendererKey,
    sectionId,
    sectionType,
}: EditorPreviewSectionFrameProps) {
    const [isSelected, setIsSelected] = useState(false);
    const frameRef = useRef<HTMLDivElement>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            // Prevent state updates / DOM mutations after unmount.
            if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
        };
    }, []);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            // SECURITY: Only accept same-window messages.
            // SELECTED_MESSAGE and INSPECTOR_SECTION_SCROLLED_TO are both dispatched by
            // StorefrontPreviewBridge via window.postMessage(..., window.location.origin).
            // Any cross-origin sender (event.origin !== window.location.origin) is silently ignored.
            if (event.origin !== window.location.origin) return;

            const data = asRecord(event.data);
            const type = data.type;

            if (type === SELECTED_MESSAGE) {
                setIsSelected(typeof data.sectionId === 'string' && data.sectionId === sectionId);
                return;
            }

            if (
                type === SCROLLED_TO_MESSAGE &&
                typeof data.sectionId === 'string' &&
                data.sectionId === sectionId
            ) {
                triggerFlash();
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sectionId]);

    /**
     * Apply a transient flash CSS class to the frame element without relying on React
     * state re-renders for the CSS animation restart.  Using the DOM ref directly lets
     * us remove + force-reflow + re-add in one synchronous cycle so the animation
     * re-triggers correctly even when the same section is scrolled to repeatedly.
     */
    const triggerFlash = () => {
        const el = frameRef.current;
        if (!el) return;
        el.classList.remove('storefront-editor-section-frame--flash');
        // Force browser reflow so the animation restarts from the beginning.
        void el.offsetWidth;
        el.classList.add('storefront-editor-section-frame--flash');
        if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
            el.classList.remove('storefront-editor-section-frame--flash');
        }, FLASH_DURATION_MS);
    };

    const notifySelection = useCallback(() => {
        const editorOrigin = getEditorOrigin();
        // Skip if the editor origin is unknown rather than using '*'.
        if (!editorOrigin) return;
        window.parent?.postMessage({
            type: SELECT_MESSAGE,
            sectionId,
            sectionType,
            rendererKey,
        }, editorOrigin);
    }, [sectionId, sectionType, rendererKey]);

    const notifyHover = useCallback((hovered: boolean) => {
        const editorOrigin = getEditorOrigin();
        if (!editorOrigin) return;
        window.parent?.postMessage(
            hovered
                ? { type: HOVERED_MESSAGE, sectionId, sectionType }
                : { type: HOVER_CLEARED_MESSAGE, sectionId },
            editorOrigin,
        );
    }, [sectionId, sectionType]);

    const sendAddIntent = useCallback((position: 'before' | 'after') => {
        const editorOrigin = getEditorOrigin();
        if (!editorOrigin) return;
        // RISK-DUAL-N01: sends an intent only — the editor panel handles any section mutation.
        // This component never modifies the template document.
        window.parent?.postMessage({
            type: ADD_INTENT_MESSAGE,
            adjacentSectionId: sectionId,
            position,
        }, editorOrigin);
    }, [sectionId]);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        notifySelection();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        notifySelection();
    };

    const classNames = [
        'storefront-editor-section-frame',
        isSelected ? 'storefront-editor-section-frame--selected' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={frameRef}
            className={classNames}
            data-section-id={sectionId}
            data-letbuyy-editor-section-id={sectionId}
            data-letbuyy-editor-section-type={sectionType}
            data-renderer-key={rendererKey}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Select ${sectionType} section`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => notifyHover(true)}
            onMouseLeave={() => notifyHover(false)}
        >
            {/* Insert-before affordance — pointer-enhancement only, not in tab order.
                Keyboard users add sections via the section tree in the editor panel. */}
            <Button
                unstyled
                type="button"
                className="storefront-editor-section-insert storefront-editor-section-insert--before"
                aria-label={`Add section before ${sectionType}`}
                tabIndex={-1}
                onClick={(e) => {
                    // Must stop propagation so the outer role="button" div does not also
                    // fire a section-select on what is an add-intent click.
                    e.stopPropagation();
                    sendAddIntent('before');
                }}
            >
                <span aria-hidden="true">+</span>
            </Button>

            <span className="storefront-editor-section-frame__label" aria-hidden="true">
                {sectionType}
            </span>

            {children}

            {/* Insert-after affordance */}
            <Button
                unstyled
                type="button"
                className="storefront-editor-section-insert storefront-editor-section-insert--after"
                aria-label={`Add section after ${sectionType}`}
                tabIndex={-1}
                onClick={(e) => {
                    e.stopPropagation();
                    sendAddIntent('after');
                }}
            >
                <span aria-hidden="true">+</span>
            </Button>
        </div>
    );
}
