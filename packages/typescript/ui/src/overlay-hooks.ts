'use client';

import React, { useEffect } from 'react';

type FocusableElement = HTMLElement & { disabled?: boolean };
type InertElement = HTMLElement & { inert?: boolean };

const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(',');

function getFocusableElements(container: HTMLElement) {
    return Array.from(container.querySelectorAll<FocusableElement>(focusableSelector))
        .filter((element) => !element.hasAttribute('aria-hidden') && !element.disabled);
}

function focusInitialElement(container: HTMLElement, initialFocus?: HTMLElement | null) {
    const target = initialFocus ?? getFocusableElements(container)[0] ?? container;
    if (!container.contains(document.activeElement)) {
        target.focus();
    }
}

function setOutsideTreeInert(root: HTMLElement) {
    const changed: Array<{ element: InertElement; ariaHidden: string | null; inert: boolean }> = [];

    const hideElement = (element: Element) => {
        if (!(element instanceof HTMLElement) || element.contains(root)) return;

        const inertElement = element as InertElement;
        changed.push({
            element: inertElement,
            ariaHidden: inertElement.getAttribute('aria-hidden'),
            inert: Boolean(inertElement.inert),
        });
        inertElement.setAttribute('aria-hidden', 'true');
        inertElement.inert = true;
    };

    let current: HTMLElement | null = root;
    while (current?.parentElement) {
        for (const sibling of Array.from(current.parentElement.children)) {
            if (sibling !== current) hideElement(sibling);
        }

        if (current.parentElement === document.body) break;
        current = current.parentElement;
    }

    return () => {
        for (const { element, ariaHidden, inert } of changed) {
            if (ariaHidden === null) {
                element.removeAttribute('aria-hidden');
            } else {
                element.setAttribute('aria-hidden', ariaHidden);
            }
            element.inert = inert;
        }
    };
}

export function useFocusTrap(
    containerRef: React.RefObject<HTMLElement | null>,
    {
        active,
        initialFocusRef,
    }: {
        active: boolean;
        initialFocusRef?: React.RefObject<HTMLElement | null>;
    },
) {
    useEffect(() => {
        const container = containerRef.current;
        if (!active || !container) return undefined;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const restoreInert = setOutsideTreeInert(container);
        const previousTabIndex = container.getAttribute('tabindex');

        if (!container.hasAttribute('tabindex')) {
            container.setAttribute('tabindex', '-1');
        }

        window.requestAnimationFrame(() => focusInitialElement(container, initialFocusRef?.current));

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const focusable = getFocusableElements(container);
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            } else if (!container.contains(activeElement)) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            restoreInert();

            if (previousTabIndex === null) {
                container.removeAttribute('tabindex');
            } else {
                container.setAttribute('tabindex', previousTabIndex);
            }

            previouslyFocused?.focus();
        };
    }, [active, containerRef, initialFocusRef]);
}

export function useDismiss(
    containerRef: React.RefObject<HTMLElement | null>,
    {
        active,
        onDismiss,
        dismissOnOutsidePointer = true,
    }: {
        active: boolean;
        onDismiss: () => void;
        dismissOnOutsidePointer?: boolean;
    },
) {
    useEffect(() => {
        if (!active) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onDismiss();
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            const container = containerRef.current;
            if (!dismissOnOutsidePointer || !container || !(event.target instanceof Node)) return;
            if (!container.contains(event.target)) onDismiss();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [active, containerRef, dismissOnOutsidePointer, onDismiss]);
}
