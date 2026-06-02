'use client';

import React, { useEffect, useId } from 'react';
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
    className?: string;
}

export function Modal({ open, title, description, children, onClose, footer, className = '' }: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--lb-space-4)]" role="presentation">
            <button
                type="button"
                className="absolute inset-0 bg-[var(--lb-color-overlay)]"
                onClick={onClose}
                aria-label="Close modal"
            />
            <section
                className={cx(
                    'relative z-10 flex max-h-[calc(100vh-var(--lb-space-7))] w-[min(640px,calc(100vw-var(--lb-space-6)))] flex-col overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]',
                    className,
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
            >
                <header className="flex items-start justify-between gap-[var(--lb-space-4)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-5)]">
                    <div className="space-y-[var(--lb-space-1)]">
                        <h2 id={titleId} className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                            {title}
                        </h2>
                        {description && (
                            <p id={descriptionId} className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="h-[1em] w-[1em]" aria-hidden="true" />
                    </button>
                </header>
                <div className="overflow-auto p-[var(--lb-space-5)]">{children}</div>
                {footer && (
                    <footer className="flex justify-end gap-[var(--lb-space-2)] border-t border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
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
            <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
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
                    'pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-text)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-inverse)] opacity-0 shadow-[var(--lb-shadow-md)] transition-opacity duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] group-focus-within:opacity-100 group-hover:opacity-100',
                    side === 'top' ? 'bottom-[calc(100%+var(--lb-space-2))]' : 'top-[calc(100%+var(--lb-space-2))]',
                )}
            >
                {content}
            </span>
        </span>
    );
}

