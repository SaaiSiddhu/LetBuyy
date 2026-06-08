'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';
import { Button } from './button';
import { cx } from './utils';
import { useAnchoredPosition, useDismiss, useFocusTrap, useScrollLock } from './overlay-hooks';

function OverlayPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(children, document.body);
}

export type OverlayTriggerProps = {
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    className?: string;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
    'aria-controls'?: string;
};

export type OverlayTrigger = React.ReactElement<OverlayTriggerProps>;

function cloneOverlayTrigger(trigger: OverlayTrigger, props: OverlayTriggerProps) {
    const triggerOnClick = trigger.props.onClick;
    const triggerOnKeyDown = trigger.props.onKeyDown;

    return React.cloneElement(trigger, {
        ...props,
        className: cx(trigger.props.className, props.className),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
            triggerOnClick?.(event);
            props.onClick?.(event);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
            triggerOnKeyDown?.(event);
            props.onKeyDown?.(event);
        },
    });
}

export interface DrawerProps {
    open: boolean;
    title: string;
    description?: string;
    children: React.ReactNode;
    onClose: () => void;
    side?: 'left' | 'right' | 'top' | 'bottom';
    size?: 'sm' | 'md' | 'lg' | 'full';
    footer?: React.ReactNode;
    className?: string;
}

const drawerSideStyles: Record<NonNullable<DrawerProps['side']>, string> = {
    left: 'left-0 top-0 h-full border-r',
    right: 'right-0 top-0 h-full border-l',
    top: 'left-0 top-0 w-full border-b',
    bottom: 'bottom-0 left-0 w-full border-t',
};

const drawerSizeStyles: Record<NonNullable<DrawerProps['size']>, Record<NonNullable<DrawerProps['side']>, string>> = {
    sm: {
        left: 'w-[min(360px,100vw)]',
        right: 'w-[min(360px,100vw)]',
        top: 'max-h-[min(320px,100vh)]',
        bottom: 'max-h-[min(320px,100vh)]',
    },
    md: {
        left: 'w-[min(440px,100vw)]',
        right: 'w-[min(440px,100vw)]',
        top: 'max-h-[min(420px,100vh)]',
        bottom: 'max-h-[min(420px,100vh)]',
    },
    lg: {
        left: 'w-[min(560px,100vw)]',
        right: 'w-[min(560px,100vw)]',
        top: 'max-h-[min(560px,100vh)]',
        bottom: 'max-h-[min(560px,100vh)]',
    },
    full: {
        left: 'w-full',
        right: 'w-full',
        top: 'max-h-screen',
        bottom: 'max-h-screen',
    },
};

export function Drawer({ open, title, description, children, onClose, side = 'right', size = 'md', footer, className = '' }: DrawerProps) {
    const titleId = useId();
    const descriptionId = useId();
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);
    const setOverlayNode = React.useCallback((node: HTMLDivElement | null) => {
        overlayRef.current = node;
        setOverlayElement(node);
    }, []);

    useFocusTrap(overlayRef, { active: open && overlayElement !== null });
    useDismiss(panelRef, { active: open, onDismiss: onClose });
    useScrollLock(open);

    if (!open) return null;

    return (
        <OverlayPortal>
        <div ref={setOverlayNode} className="fixed inset-0 z-[var(--lb-z-modal)]" role="presentation">
            <button
                type="button"
                tabIndex={-1}
                className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                onClick={onClose}
                aria-label="Close drawer"
            />
            <section
                ref={panelRef}
                className={cx(
                    'fixed z-[var(--lb-z-base)] flex max-w-full flex-col overflow-hidden border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]',
                    drawerSideStyles[side],
                    drawerSizeStyles[size][side],
                    className,
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
            >
                <header className="flex items-start justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-density-modal-padding)]">
                    <div className="space-y-[var(--lb-space-1)]">
                        <h2 id={titleId} className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                        <X aria-hidden="true" />
                    </Button>
                </header>
                <div className="min-h-0 flex-1 overflow-auto p-[var(--lb-density-modal-padding)]">{children}</div>
                {footer && (
                    <footer className="flex flex-col-reverse justify-end gap-[var(--lb-space-2)] border-t border-[var(--lb-color-border)] p-[var(--lb-space-4)] sm:flex-row">
                        {footer}
                    </footer>
                )}
            </section>
        </div>
        </OverlayPortal>
    );
}

export interface PopoverProps {
    trigger: OverlayTrigger;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
    ariaLabel?: string;
    className?: string;
}

// Popover/Dropdown panels are portaled to <body> and positioned via
// useAnchoredPosition so they cannot be clipped by overflow/transform ancestors.

export function Popover({ trigger, open, defaultOpen = false, onOpenChange, children, placement = 'bottom-start', ariaLabel = 'Popover', className = '' }: PopoverProps) {
    const popoverId = useId();
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const floatingRef = useRef<HTMLDivElement>(null);
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const actualOpen = open ?? internalOpen;
    const setOpen = (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };
    const position = useAnchoredPosition(wrapperRef, { active: actualOpen, placement });

    useDismiss(wrapperRef, { active: actualOpen, onDismiss: () => setOpen(false), secondaryRef: floatingRef });

    return (
        <span ref={wrapperRef} className="relative inline-flex">
            {cloneOverlayTrigger(trigger, {
                'aria-expanded': actualOpen,
                'aria-haspopup': 'dialog',
                'aria-controls': actualOpen ? popoverId : undefined,
                onClick: () => setOpen(!actualOpen),
                onKeyDown: (event) => {
                    if (event.key === 'Escape') setOpen(false);
                },
            })}
            {actualOpen && (
                <OverlayPortal>
                    <div
                        ref={floatingRef}
                        id={popoverId}
                        role="dialog"
                        aria-label={ariaLabel}
                        style={position}
                        className={cx(
                            'z-[var(--lb-z-dropdown)] w-[min(320px,calc(100vw-var(--lb-space-6)))] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] text-[color:var(--lb-color-text)] shadow-[var(--lb-shadow-lg)]',
                            className,
                        )}
                    >
                        {children}
                    </div>
                </OverlayPortal>
            )}
        </span>
    );
}

export interface DropdownItem {
    id: string;
    label: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    disabled?: boolean;
    destructive?: boolean;
    onSelect?: () => void;
}

export interface DropdownProps {
    trigger: OverlayTrigger;
    items: DropdownItem[];
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    align?: 'start' | 'end';
    ariaLabel?: string;
    className?: string;
}

export function Dropdown({ trigger, items, open, defaultOpen = false, onOpenChange, align = 'start', ariaLabel = 'Menu', className = '' }: DropdownProps) {
    const menuId = useId();
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const floatingRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const actualOpen = open ?? internalOpen;
    const setOpen = (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
    };
    const enabledItems = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled);

    const position = useAnchoredPosition(wrapperRef, { active: actualOpen, placement: align === 'end' ? 'bottom-end' : 'bottom-start' });

    useDismiss(wrapperRef, { active: actualOpen, onDismiss: () => setOpen(false), secondaryRef: floatingRef });

    const focusItem = (index: number) => {
        itemRefs.current[index]?.focus();
    };

    const focusFirst = () => {
        const first = enabledItems[0];
        if (first) requestAnimationFrame(() => focusItem(first.index));
    };

    const moveFocus = (currentIndex: number, direction: 1 | -1) => {
        const enabledIndex = enabledItems.findIndex(({ index }) => index === currentIndex);
        if (enabledIndex < 0) return;
        const next = enabledItems[(enabledIndex + direction + enabledItems.length) % enabledItems.length];
        if (next) focusItem(next.index);
    };

    const openMenu = () => {
        setOpen(true);
        focusFirst();
    };

    return (
        <span ref={wrapperRef} className="relative inline-flex">
            {cloneOverlayTrigger(trigger, {
                'aria-expanded': actualOpen,
                'aria-haspopup': 'menu',
                'aria-controls': actualOpen ? menuId : undefined,
                onClick: () => {
                    const nextOpen = !actualOpen;
                    setOpen(nextOpen);
                    if (nextOpen) focusFirst();
                },
                onKeyDown: (event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMenu();
                    }
                    if (event.key === 'Escape') setOpen(false);
                },
            })}
            {actualOpen && (
                <OverlayPortal>
                <div
                    ref={floatingRef}
                    id={menuId}
                    role="menu"
                    aria-label={ariaLabel}
                    style={position}
                    className={cx(
                        'z-[var(--lb-z-dropdown)] min-w-[220px] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-1)] text-[color:var(--lb-color-text)] shadow-[var(--lb-shadow-lg)]',
                        className,
                    )}
                >
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            ref={(node) => {
                                itemRefs.current[index] = node;
                            }}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            tabIndex={index === enabledItems[0]?.index ? 0 : -1}
                            className={cx(
                                'flex w-full items-start gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                                item.destructive ? 'text-[color:var(--lb-color-critical)]' : 'text-[color:var(--lb-color-text)]',
                            )}
                            onClick={() => {
                                if (item.disabled) return;
                                item.onSelect?.();
                                setOpen(false);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    moveFocus(index, 1);
                                }
                                if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    moveFocus(index, -1);
                                }
                                if (event.key === 'Home') {
                                    event.preventDefault();
                                    focusItem(enabledItems[0]?.index ?? index);
                                }
                                if (event.key === 'End') {
                                    event.preventDefault();
                                    focusItem(enabledItems[enabledItems.length - 1]?.index ?? index);
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setOpen(false);
                                }
                            }}
                        >
                            {item.icon && <span className="mt-[2px] inline-flex shrink-0 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true">{item.icon}</span>}
                            <span className="grid min-w-0 gap-[var(--lb-space-1)]">
                                <span>{item.label}</span>
                                {item.description && (
                                    <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        {item.description}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
                </OverlayPortal>
            )}
        </span>
    );
}

export const DropdownMenu = Dropdown;

export interface ModalProps {
    open: boolean;
    title: string;
    description?: string;
    children: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    className?: string;
}

export function Modal({ open, title, description, children, onClose, footer, className = '' }: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLElement>(null);
    const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);
    const setOverlayNode = React.useCallback((node: HTMLDivElement | null) => {
        overlayRef.current = node;
        setOverlayElement(node);
    }, []);

    useFocusTrap(overlayRef, { active: open && overlayElement !== null });
    useDismiss(dialogRef, { active: open, onDismiss: onClose });
    useScrollLock(open);

    if (!open) return null;

    return (
        <OverlayPortal>
        <div ref={setOverlayNode} className="fixed inset-0 z-[var(--lb-z-modal)] flex items-stretch justify-stretch p-[var(--lb-space-0)] sm:items-center sm:justify-center sm:p-[var(--lb-space-4)]" role="presentation">
            <div
                className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                onClick={onClose}
                aria-hidden="true"
            />
            <section
                ref={dialogRef}
                className={cx(
                    'relative z-[var(--lb-z-base)] flex h-full max-h-none w-full flex-col overflow-hidden rounded-none border-0 bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)] sm:h-auto sm:max-h-[calc(100vh-var(--lb-space-7))] sm:w-[min(640px,calc(100vw-var(--lb-space-6)))] sm:rounded-[var(--lb-radius-lg)] sm:border sm:border-[var(--lb-color-border)]',
                    className,
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
            >
                <header className="flex items-start justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-density-modal-padding)]">
                    <div className="space-y-[var(--lb-space-1)]">
                        <h2 id={titleId} className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    </button>
                </header>
                <div className="overflow-auto p-[var(--lb-density-modal-padding)]">{children}</div>
                {footer && (
                    <footer className="flex flex-col-reverse justify-end gap-[var(--lb-space-2)] border-t border-[var(--lb-color-border)] p-[var(--lb-space-4)] [&>button]:w-full sm:flex-row sm:[&>button]:w-auto">
                        {footer}
                    </footer>
                )}
            </section>
        </div>
        </OverlayPortal>
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    children?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export function ConfirmDialog({
    open,
    title,
    description,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Modal
            open={open}
            title={title}
            description={description}
            onClose={onClose}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </>
            )}
        >
            {children ?? (
                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                    This action can affect merchant data. Review it before continuing.
                </p>
            )}
        </Modal>
    );
}

export interface TooltipProps {
    id?: string;
    content: React.ReactNode;
    children: React.ReactNode;
    side?: 'top' | 'bottom';
}

export function Tooltip({ id, content, children, side = 'top' }: TooltipProps) {
    const generatedId = useId();
    const tooltipId = id ?? generatedId;
    const [touchVisible, setTouchVisible] = useState(false);
    const trigger = React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)
        ? React.cloneElement(children, {
            'aria-describedby': [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ') || undefined,
        })
        : <span aria-describedby={tooltipId}>{children}</span>;

    return (
        <span
            className="group relative inline-flex"
            onPointerDown={(event) => {
                if (event.pointerType !== 'mouse') setTouchVisible((visible) => !visible);
            }}
            onPointerLeave={() => setTouchVisible(false)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setTouchVisible(false);
            }}
        >
            {trigger}
            <span
                id={tooltipId}
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute left-1/2 z-[var(--lb-z-tooltip)] w-max max-w-[var(--lb-size-tooltip-max-width)] -translate-x-1/2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-text)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-inverse)] opacity-0 shadow-[var(--lb-shadow-md)] transition-opacity duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] group-focus-within:opacity-100 group-hover:opacity-100',
                    touchVisible && 'opacity-100',
                    side === 'top' ? 'bottom-[calc(100%+var(--lb-space-2))]' : 'top-[calc(100%+var(--lb-space-2))]',
                )}
            >
                {content}
            </span>
        </span>
    );
}
