'use client';

import React, { useId, useRef } from 'react';
import { X } from './icons';
import { Button } from './button';
import { cx } from './utils';
import { useDismiss, useFocusTrap } from './overlay-hooks';

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

    useFocusTrap(overlayRef, { active: open });
    useDismiss(dialogRef, { active: open, onDismiss: onClose });

    if (!open) return null;

    return (
        <div ref={overlayRef} className="fixed inset-0 z-[var(--lb-z-modal)] flex items-stretch justify-stretch p-[var(--lb-space-0)] sm:items-center sm:justify-center sm:p-[var(--lb-space-4)]" role="presentation">
            <button
                type="button"
                tabIndex={-1}
                className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                onClick={onClose}
                aria-label="Close modal"
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
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
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
            <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                This action can affect merchant data. Review it before continuing.
            </p>
        </Modal>
    );
}

export interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
    return (
        <span className="group relative inline-flex">
            {children}
            <span
                role="tooltip"
                className={cx(
                    'pointer-events-none absolute left-1/2 z-[var(--lb-z-tooltip)] w-max max-w-[var(--lb-size-tooltip-max-width)] -translate-x-1/2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-text)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-inverse)] opacity-0 shadow-[var(--lb-shadow-md)] transition-opacity duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] group-focus-within:opacity-100 group-hover:opacity-100',
                    side === 'top' ? 'bottom-[calc(100%+var(--lb-space-2))]' : 'top-[calc(100%+var(--lb-space-2))]',
                )}
            >
                {content}
            </span>
        </span>
    );
}
