'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from './icons';
import { Button } from './button';
import { cx } from './utils';

export interface ModalProps {
    open: boolean;
    title: string;
    description?: string;
    children: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    dismissible?: boolean;
    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;
    dismissLabel?: string;
    footerAlign?: 'start' | 'end' | 'between';
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    restoreFocus?: boolean;
    className?: string;
}

const modalSizeStyles: Record<NonNullable<ModalProps['size']>, string> = {
    sm: 'w-[min(480px,calc(100vw-var(--lb-space-6)))]',
    md: 'w-[min(640px,calc(100vw-var(--lb-space-6)))]',
    lg: 'w-[min(840px,calc(100vw-var(--lb-space-6)))]',
    xl: 'w-[min(1040px,calc(100vw-var(--lb-space-6)))]',
};

const modalFooterAlignStyles: Record<NonNullable<ModalProps['footerAlign']>, string> = {
    start: 'justify-start',
    end: 'justify-end',
    between: 'justify-between',
};

export function Modal({
    open,
    title,
    description,
    children,
    onClose,
    footer,
    size = 'md',
    dismissible = true,
    closeOnEscape = true,
    closeOnOverlayClick = true,
    dismissLabel = 'Close',
    footerAlign = 'end',
    initialFocusRef,
    restoreFocus = true,
    className = '',
}: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusTimer = window.setTimeout(() => {
            const focusTarget = initialFocusRef?.current ?? closeButtonRef.current ?? dialogRef.current;
            focusTarget?.focus();
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && closeOnEscape) onClose();
            if (event.key !== 'Tab') return;

            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable || focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            if (restoreFocus) previouslyFocused?.focus();
        };
    }, [closeOnEscape, initialFocusRef, onClose, open, restoreFocus]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--lb-space-4)]" role="presentation">
            {closeOnOverlayClick ? (
                <button
                    type="button"
                    className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                    onClick={onClose}
                    aria-label={dismissLabel}
                />
            ) : (
                <div className="absolute inset-0 bg-[var(--lb-color-overlay)]" aria-hidden="true" />
            )}
            <section
                ref={dialogRef}
                className={cx(
                    'relative z-10 flex max-h-[calc(100vh-var(--lb-space-7))] flex-col overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                    modalSizeStyles[size],
                    className,
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
            >
                <header className="flex items-start justify-between gap-[var(--lb-space-4)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-5)]">
                    <div className="space-y-[var(--lb-space-1)]">
                        <h2 id={titleId} className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {dismissible && (
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            onClick={onClose}
                            aria-label={dismissLabel}
                        >
                            <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        </button>
                    )}
                </header>
                <div className="overflow-auto p-[var(--lb-space-5)]">{children}</div>
                {footer && (
                    <footer className={cx('flex gap-[var(--lb-space-2)] border-t border-[var(--lb-color-border)] p-[var(--lb-space-4)]', modalFooterAlignStyles[footerAlign])}>
                        {footer}
                    </footer>
                )}
            </section>
        </div>
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
    confirmLoading?: boolean;
    confirmDisabled?: boolean;
    cancelDisabled?: boolean;
    closeOnOverlayClick?: boolean;
    className?: string;
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
    confirmLoading = false,
    confirmDisabled = false,
    cancelDisabled = false,
    closeOnOverlayClick = false,
    className = '',
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    return (
        <Modal
            open={open}
            title={title}
            description={description}
            onClose={onClose}
            size="sm"
            closeOnOverlayClick={closeOnOverlayClick}
            className={className}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={cancelDisabled || confirmLoading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={destructive ? 'destructive' : 'primary'}
                        onClick={onConfirm}
                        loading={confirmLoading}
                        disabled={confirmDisabled}
                    >
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
    content: React.ReactNode;
    children: React.ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
    id?: string;
}

const tooltipPositionStyles: Record<NonNullable<TooltipProps['side']>, string> = {
    top: 'bottom-[calc(100%+var(--lb-space-2))]',
    bottom: 'top-[calc(100%+var(--lb-space-2))]',
    left: 'right-[calc(100%+var(--lb-space-2))]',
    right: 'left-[calc(100%+var(--lb-space-2))]',
};

const tooltipAlignStyles: Record<NonNullable<TooltipProps['side']>, Record<NonNullable<TooltipProps['align']>, string>> = {
    top: {
        start: 'left-0 translate-x-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0 translate-x-0',
    },
    bottom: {
        start: 'left-0 translate-x-0',
        center: 'left-1/2 -translate-x-1/2',
        end: 'right-0 translate-x-0',
    },
    left: {
        start: 'top-0 translate-y-0',
        center: 'top-1/2 -translate-y-1/2',
        end: 'bottom-0 translate-y-0',
    },
    right: {
        start: 'top-0 translate-y-0',
        center: 'top-1/2 -translate-y-1/2',
        end: 'bottom-0 translate-y-0',
    },
};

export function Tooltip({ content, children, side = 'top', align = 'center', id }: TooltipProps) {
    const generatedId = useId();
    const tooltipId = id ?? generatedId;
    const trigger = React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ 'aria-describedby'?: string }>, {
            'aria-describedby': tooltipId,
        })
        : <span aria-describedby={tooltipId}>{children}</span>;

    return (
        <span className="group relative inline-flex">
            {trigger}
            <span
                id={tooltipId}
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute z-50 w-max max-w-[var(--lb-size-tooltip-max-width)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-text)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-inverse)] opacity-0 shadow-[var(--lb-shadow-md)] transition-opacity duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] group-focus-within:opacity-100 group-hover:opacity-100',
                    tooltipPositionStyles[side],
                    tooltipAlignStyles[side][align],
                )}
            >
                {content}
            </span>
        </span>
    );
}
