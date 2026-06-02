'use client';

import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

const SELECT_MESSAGE = 'letbuyy:theme-editor:section-select';
const SELECTED_MESSAGE = 'letbuyy:theme-editor:section-selected';

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

function getParentTargetOrigin() {
    if (typeof document === 'undefined' || !document.referrer) return '*';

    try {
        return new URL(document.referrer).origin;
    } catch {
        return '*';
    }
}

export default function EditorPreviewSectionFrame({
    children,
    rendererKey,
    sectionId,
    sectionType,
}: EditorPreviewSectionFrameProps) {
    const [isSelected, setIsSelected] = useState(false);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const data = asRecord(event.data);
            if (data.type !== SELECTED_MESSAGE) return;

            setIsSelected(typeof data.sectionId === 'string' && data.sectionId === sectionId);
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sectionId]);

    const notifySelection = () => {
        window.parent?.postMessage({
            type: SELECT_MESSAGE,
            sectionId,
            sectionType,
            rendererKey,
        }, getParentTargetOrigin());
    };

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

    return (
        <div
            className={`storefront-editor-section-frame ${isSelected ? 'storefront-editor-section-frame--selected' : ''}`}
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
        >
            <span className="storefront-editor-section-frame__label" aria-hidden="true">
                {sectionType}
            </span>
            {children}
        </div>
    );
}
