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

        // Overlay isolation uses the platform `inert` property. If LetBuyy needs to
        // support a browser without inert, load an inert polyfill before mounting UI.
        const inertElement = element as InertElement;
        changed.push({
            element: inertElement,
            ariaHidden: inertElement.getAttribute('aria-hidden'),
            inert: Boolean(inertElement.inert),
        });
        inertElement.setAttribute('aria-hidden', 'true');
        inertElement.inert = true;
    };

    const hideTree = (element: Element) => {
        hideElement(element);
        if (element instanceof HTMLElement) {
            for (const focusableElement of getFocusableElements(element)) {
                hideElement(focusableElement);
            }
        }
    };

    let current: HTMLElement | null = root;
    while (current?.parentElement) {
        for (const sibling of Array.from(current.parentElement.children)) {
            if (sibling !== current) hideTree(sibling);
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
        returnFocusRef,
    }: {
        active: boolean;
        initialFocusRef?: React.RefObject<HTMLElement | null>;
        returnFocusRef?: React.RefObject<HTMLElement | null>;
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

        focusInitialElement(container, initialFocusRef?.current);

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

            const returnTarget = returnFocusRef?.current ?? previouslyFocused;
            if (returnTarget?.isConnected) returnTarget.focus();
        };
    }, [active, containerRef, initialFocusRef, returnFocusRef]);
}

/** Nesting depth of active scroll locks; the page unfreezes only at zero. */
let scrollLockDepth = 0;
let scrollLockRestore: { overflow: string; paddingRight: string } | null = null;

/**
 * Freeze background scrolling while an overlay is open, and return the release.
 *
 * Two different things scroll in a LetBuyy surface: the DOCUMENT (auth,
 * marketing, and any shell that grows with its content) and, in a shell that
 * fills the viewport, an inner scroll container. Locking `body` alone is a
 * no-op in the second case, so this also marks the document element with
 * `data-lb-scroll-locked`; a shell that owns its own scroller keys off that
 * attribute to freeze it. Surfaces that do not are unaffected — nothing styles
 * the attribute for them.
 *
 * Reference-counted, because overlays nest (a confirm dialog opened from a
 * drawer). Each caller takes a lock and the original body styles are restored
 * exactly once, when the last one is released — call sites that saved and
 * restored `body.style.overflow` independently used to clobber each other.
 */
export function acquireScrollLock(): () => void {
    if (typeof document === 'undefined') return () => {};

    if (scrollLockDepth === 0) {
        const { body } = document;
        scrollLockRestore = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
        // Only meaningful while the DOCUMENT is the scroller. A viewport-filling
        // shell has no document scrollbar to compensate for; it keeps its own
        // gutter reserved with `scrollbar-gutter: stable` instead.
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
        document.documentElement.setAttribute('data-lb-scroll-locked', 'true');
    }
    scrollLockDepth += 1;

    let released = false;
    return () => {
        if (released) return;
        released = true;
        scrollLockDepth -= 1;
        if (scrollLockDepth > 0) return;
        const { body } = document;
        body.style.overflow = scrollLockRestore?.overflow ?? '';
        body.style.paddingRight = scrollLockRestore?.paddingRight ?? '';
        scrollLockRestore = null;
        document.documentElement.removeAttribute('data-lb-scroll-locked');
    };
}

export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return undefined;
        return acquireScrollLock();
    }, [active]);
}

export function useDismiss(
    containerRef: React.RefObject<HTMLElement | null>,
    {
        active,
        onDismiss,
        dismissOnOutsidePointer = true,
        secondaryRef,
    }: {
        active: boolean;
        onDismiss: () => void;
        dismissOnOutsidePointer?: boolean;
        // A second element (e.g. a portaled floating menu) that also counts as
        // "inside" for outside-pointer dismissal.
        secondaryRef?: React.RefObject<HTMLElement | null>;
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
            if (!dismissOnOutsidePointer || !(event.target instanceof Node)) return;
            const target = event.target;
            const container = containerRef.current;
            const inside = Boolean(container?.contains(target)) || Boolean(secondaryRef?.current?.contains(target));
            if (!inside) onDismiss();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [active, containerRef, dismissOnOutsidePointer, onDismiss, secondaryRef]);
}

export type AnchoredPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

/**
 * Compute a fixed-position style anchored to a trigger element's bounding rect,
 * so a portaled floating panel cannot be clipped by `overflow:hidden`/transformed
 * ancestors. Updates on scroll/resize. No positioning library required.
 */
export function useAnchoredPosition(
    anchorRef: React.RefObject<HTMLElement | null>,
    { active, placement = 'bottom-start', gap = 8 }: { active: boolean; placement?: AnchoredPlacement; gap?: number },
) {
    const [style, setStyle] = React.useState<React.CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });

    useEffect(() => {
        if (!active || typeof window === 'undefined') return undefined;

        const update = () => {
            const el = anchorRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const next: React.CSSProperties = { position: 'fixed', minWidth: Math.round(rect.width), visibility: 'visible' };
            if (placement.startsWith('top')) {
                next.bottom = Math.round(window.innerHeight - rect.top + gap);
            } else {
                next.top = Math.round(rect.bottom + gap);
            }
            if (placement.endsWith('end')) {
                next.right = Math.round(window.innerWidth - rect.right);
            } else {
                next.left = Math.round(rect.left);
            }
            setStyle(next);
        };

        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [active, placement, gap, anchorRef]);

    return style;
}
