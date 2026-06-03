'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from './icons';
import { Button } from './button';
import { cx } from './utils';

export interface ModalProps {
    open: boolean;
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    placement?: 'center' | 'top';
    role?: 'dialog' | 'alertdialog';
    ariaLabel?: string;
    eyebrow?: React.ReactNode;
    titleMetadata?: React.ReactNode;
    headerAction?: React.ReactNode;
    dismissible?: boolean;
    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;
    dismissLabel?: string;
    footerAlign?: 'start' | 'end' | 'between';
    headerDivider?: boolean;
    footerDivider?: boolean;
    preventScroll?: boolean;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    restoreFocus?: boolean;
    overlayClassName?: string;
    headerClassName?: string;
    bodyClassName?: string;
    footerClassName?: string;
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

const modalPlacementStyles: Record<NonNullable<ModalProps['placement']>, string> = {
    center: 'items-center',
    top: 'items-start pt-[var(--lb-space-7)]',
};

export function Modal({
    open,
    title,
    description,
    children,
    onClose,
    footer,
    size = 'md',
    placement = 'center',
    role = 'dialog',
    ariaLabel,
    eyebrow,
    titleMetadata,
    headerAction,
    dismissible = true,
    closeOnEscape = true,
    closeOnOverlayClick = true,
    dismissLabel = 'Close',
    footerAlign = 'end',
    headerDivider = true,
    footerDivider = true,
    preventScroll = true,
    initialFocusRef,
    restoreFocus = true,
    overlayClassName = '',
    headerClassName = '',
    bodyClassName = '',
    footerClassName = '',
    className = '',
}: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        if (preventScroll) document.body.style.overflow = 'hidden';
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
            if (preventScroll) document.body.style.overflow = previousOverflow;
            if (restoreFocus) previouslyFocused?.focus();
        };
    }, [closeOnEscape, initialFocusRef, onClose, open, preventScroll, restoreFocus]);

    if (!open) return null;

    return (
        <div className={cx('fixed inset-0 z-50 flex justify-center p-[var(--lb-space-4)]', modalPlacementStyles[placement])} role="presentation">
            {closeOnOverlayClick ? (
                <button
                    type="button"
                    className={cx('absolute inset-0 bg-[var(--lb-color-overlay)]', overlayClassName)}
                    onClick={onClose}
                    aria-label={dismissLabel}
                />
            ) : (
                <div className={cx('absolute inset-0 bg-[var(--lb-color-overlay)]', overlayClassName)} aria-hidden="true" />
            )}
            <section
                ref={dialogRef}
                className={cx(
                    'relative z-10 flex max-h-[calc(100vh-var(--lb-space-7))] flex-col overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                    modalSizeStyles[size],
                    className,
                )}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-label={ariaLabel}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
            >
                <header className={cx('flex items-start justify-between gap-[var(--lb-space-4)] p-[var(--lb-space-5)]', headerDivider && 'border-b border-[var(--lb-color-border)]', headerClassName)}>
                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                        {eyebrow && (
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-primary)]">
                                {eyebrow}
                            </p>
                        )}
                        <div className="flex min-w-0 flex-wrap items-center gap-[var(--lb-space-2)]">
                            <h2 id={titleId} className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                                {title}
                            </h2>
                            {titleMetadata}
                        </div>
                        {description && (
                            <p id={descriptionId} className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {headerAction && <div className="shrink-0">{headerAction}</div>}
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
                <div className={cx('overflow-auto p-[var(--lb-space-5)]', bodyClassName)}>{children}</div>
                {footer && (
                    <footer className={cx('flex gap-[var(--lb-space-2)] p-[var(--lb-space-4)]', footerDivider && 'border-t border-[var(--lb-color-border)]', modalFooterAlignStyles[footerAlign], footerClassName)}>
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
    icon?: React.ReactNode;
    tone?: 'default' | 'critical' | 'warning';
    confirmLoading?: boolean;
    confirmLoadingLabel?: string;
    confirmDisabled?: boolean;
    cancelDisabled?: boolean;
    closeOnOverlayClick?: boolean;
    dismissLabel?: string;
    footerAlign?: 'start' | 'end' | 'between';
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
    icon,
    tone = destructive ? 'critical' : 'default',
    confirmLoading = false,
    confirmLoadingLabel = 'Confirming',
    confirmDisabled = false,
    cancelDisabled = false,
    closeOnOverlayClick = false,
    dismissLabel = 'Close confirmation dialog',
    footerAlign = 'end',
    className = '',
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const confirmVariant = destructive || tone === 'critical' ? 'destructive' : 'primary';
    const iconToneClassName = tone === 'warning' ? 'text-[color:var(--lb-color-warning)]' : 'text-[color:var(--lb-color-critical)]';

    return (
        <Modal
            open={open}
            title={title}
            description={description}
            onClose={onClose}
            size="sm"
            role="alertdialog"
            closeOnOverlayClick={closeOnOverlayClick}
            dismissLabel={dismissLabel}
            footerAlign={footerAlign}
            className={className}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={cancelDisabled || confirmLoading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={confirmVariant}
                        onClick={onConfirm}
                        loading={confirmLoading}
                        loadingLabel={confirmLoadingLabel}
                        disabled={confirmDisabled}
                    >
                        {confirmLabel}
                    </Button>
                </>
            )}
        >
            <div className="flex gap-[var(--lb-space-3)]">
                {icon && <div className={cx('mt-[var(--lb-space-1)] shrink-0', iconToneClassName)} aria-hidden="true">{icon}</div>}
                <div className="min-w-0">
                    {children ?? (
                        <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                            This action can affect merchant data. Review it before continuing.
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
    tone?: 'default' | 'inverse';
    maxWidth?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    triggerClassName?: string;
    className?: string;
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

const tooltipToneStyles: Record<NonNullable<TooltipProps['tone']>, string> = {
    default: 'bg-[var(--lb-color-text)] text-[color:var(--lb-color-text-inverse)]',
    inverse: 'border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)]',
};

const tooltipMaxWidthStyles: Record<NonNullable<TooltipProps['maxWidth']>, string> = {
    sm: 'max-w-[180px]',
    md: 'max-w-[var(--lb-size-tooltip-max-width)]',
    lg: 'max-w-[360px]',
};

export function Tooltip({ content, children, side = 'top', align = 'center', tone = 'default', maxWidth = 'md', disabled = false, triggerClassName = '', className = '', id }: TooltipProps) {
    const generatedId = useId();
    const tooltipId = id ?? generatedId;

    if (disabled) {
        if (React.isValidElement(children)) {
            const child = children as React.ReactElement<{ className?: string }>;
            return React.cloneElement(child, {
                className: cx(child.props.className, triggerClassName),
            });
        }

        return triggerClassName ? <span className={triggerClassName}>{children}</span> : <>{children}</>;
    }

    let trigger: React.ReactNode;
    if (React.isValidElement(children)) {
        const child = children as React.ReactElement<{ 'aria-describedby'?: string; className?: string }>;
        trigger = React.cloneElement(child, {
            'aria-describedby': [child.props['aria-describedby'], tooltipId].filter(Boolean).join(' '),
            className: cx(child.props.className, triggerClassName),
        });
    } else {
        trigger = <span className={triggerClassName} aria-describedby={tooltipId}>{children}</span>;
    }

    return (
        <span className="group relative inline-flex">
            {trigger}
            <span
                id={tooltipId}
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute z-50 w-max rounded-[var(--lb-radius-md)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] opacity-0 shadow-[var(--lb-shadow-md)] transition-opacity duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] group-focus-within:opacity-100 group-hover:opacity-100',
                    tooltipToneStyles[tone],
                    tooltipMaxWidthStyles[maxWidth],
                    tooltipPositionStyles[side],
                    tooltipAlignStyles[side][align],
                    className,
                )}
            >
                {content}
            </span>
        </span>
    );
}
