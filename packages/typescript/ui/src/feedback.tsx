'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    Loader2,
    X,
} from './icons';
import { cx } from './utils';

export type StatusVariant = 'default' | 'info' | 'success' | 'warning' | 'critical';

const statusStyles: Record<StatusVariant, { surface: string; text: string; border: string; icon: React.ReactNode }> = {
    default: {
        surface: 'bg-[var(--lb-color-surface-subdued)]',
        text: 'text-[var(--lb-color-text)]',
        border: 'border-[var(--lb-color-border)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    info: {
        surface: 'bg-[var(--lb-color-info-soft)]',
        text: 'text-[var(--lb-color-info)]',
        border: 'border-[var(--lb-color-info)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    success: {
        surface: 'bg-[var(--lb-color-success-soft)]',
        text: 'text-[var(--lb-color-success)]',
        border: 'border-[var(--lb-color-success)]',
        icon: <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    warning: {
        surface: 'bg-[var(--lb-color-warning-soft)]',
        text: 'text-[var(--lb-color-warning)]',
        border: 'border-[var(--lb-color-warning)]',
        icon: <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    critical: {
        surface: 'bg-[var(--lb-color-critical-soft)]',
        text: 'text-[var(--lb-color-critical)]',
        border: 'border-[var(--lb-color-critical)]',
        icon: <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    label: string;
    variant?: StatusVariant | 'danger';
}

export function Badge({ label, variant = 'default', className = '', ...props }: BadgeProps) {
    const normalizedVariant = variant === 'danger' ? 'critical' : variant;
    const style = statusStyles[normalizedVariant];

    return (
        <span
            className={cx(
                'inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)]',
                style.surface,
                style.text,
                style.border,
                className,
            )}
            {...props}
        >
            {style.icon}
            {label}
        </span>
    );
}

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    children: React.ReactNode;
    variant?: Exclude<StatusVariant, 'default'>;
    action?: React.ReactNode;
}

export function Banner({ title, children, variant = 'info', action, className = '', ...props }: BannerProps) {
    const style = statusStyles[variant];

    return (
        <div
            className={cx(
                'flex gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)]',
                style.surface,
                style.border,
                className,
            )}
            role={variant === 'critical' ? 'alert' : 'status'}
            {...props}
        >
            <div className={cx('mt-[var(--lb-space-1)] shrink-0 text-[var(--lb-font-size-heading)]', style.text)}>
                {style.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-[var(--lb-space-1)]">
                {title && (
                    <h3 className={cx('m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]', style.text)}>
                        {title}
                    </h3>
                )}
                <div className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {children}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export type ToastVariant = Exclude<StatusVariant, 'default'>;

export interface ToastMessage {
    id: string;
    title: string;
    description?: string;
    variant?: ToastVariant;
}

interface ToastContextValue {
    notify: (toast: Omit<ToastMessage, 'id'>) => string;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
    children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const notify = useCallback((toast: Omit<ToastMessage, 'id'>) => {
        const id = globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}`;
        setToasts((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => dismiss(id), 5000);
        return id;
    }, [dismiss]);

    const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                className="fixed right-[var(--lb-space-5)] top-[calc(var(--lb-space-7)+var(--lb-space-4))] z-50 flex w-[min(380px,calc(100vw-var(--lb-space-6)))] flex-col gap-[var(--lb-space-3)]"
                aria-live="polite"
                aria-relevant="additions removals"
            >
                {toasts.map((toast) => {
                    const variant = toast.variant ?? 'info';
                    const style = statusStyles[variant];
                    return (
                        <div
                            key={toast.id}
                            className={cx(
                                'flex gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface-raised)] p-[var(--lb-space-4)] shadow-[var(--lb-shadow-lg)]',
                                style.border,
                            )}
                            role={variant === 'critical' ? 'alert' : 'status'}
                        >
                            <div className={cx('mt-[var(--lb-space-1)] text-[var(--lb-font-size-heading)]', style.text)}>
                                {style.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                    {toast.title}
                                </p>
                                {toast.description && (
                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {toast.description}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                onClick={() => dismiss(toast.id)}
                                aria-label="Dismiss notification"
                            >
                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'card' | 'table';
    lines?: number;
}

export function Skeleton({ variant = 'text', lines = 3, className = '', ...props }: SkeletonProps) {
    if (variant === 'table') {
        return (
            <div className={cx('space-y-[var(--lb-space-2)]', className)} aria-hidden="true" {...props}>
                {Array.from({ length: lines }).map((_, index) => (
                    <div key={index} className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)]" />
                ))}
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div
                className={cx('h-[var(--lb-size-skeleton-card-height)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]', className)}
                aria-hidden="true"
                {...props}
            />
        );
    }

    return (
        <div className={cx('space-y-[var(--lb-space-2)]', className)} aria-hidden="true" {...props}>
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    className={cx(
                        'h-[var(--lb-space-3)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)]',
                        index === lines - 1 ? 'w-2/3' : 'w-full',
                    )}
                />
            ))}
        </div>
    );
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode;
    title: string;
    body?: string;
    primaryAction?: React.ReactNode;
    secondaryAction?: React.ReactNode;
}

export function EmptyState({ icon, title, body, primaryAction, secondaryAction, className = '', ...props }: EmptyStateProps) {
    return (
        <div
            className={cx(
                'flex min-h-[var(--lb-size-empty-state-min-height)] flex-col items-center justify-center gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-6)] text-center',
                className,
            )}
            {...props}
        >
            {icon && (
                <div className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                    {icon}
                </div>
            )}
            <div className="max-w-[var(--lb-size-empty-state-measure)] space-y-[var(--lb-space-2)]">
                <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                    {title}
                </h3>
                {body && (
                    <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                        {body}
                    </p>
                )}
            </div>
            {(primaryAction || secondaryAction) && (
                <div className="flex flex-wrap justify-center gap-[var(--lb-space-2)]">
                    {secondaryAction}
                    {primaryAction}
                </div>
            )}
        </div>
    );
}

export interface SaveBarProps extends React.HTMLAttributes<HTMLDivElement> {
    state: 'saved' | 'unsaved' | 'saving';
    onSave?: () => void;
    onDiscard?: () => void;
    saveLabel?: string;
    discardLabel?: string;
}

export function SaveBar({
    state,
    onSave,
    onDiscard,
    saveLabel = 'Save',
    discardLabel = 'Discard',
    className = '',
    ...props
}: SaveBarProps) {
    const isSaved = state === 'saved';

    return (
        <div
            className={cx(
                'sticky bottom-[var(--lb-space-4)] z-40 mx-auto flex w-[min(var(--lb-size-save-bar-width),calc(100vw-var(--lb-space-6)))] items-center justify-between gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-raised)] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-lg)]',
                isSaved ? 'opacity-0 pointer-events-none' : 'opacity-100',
                className,
            )}
            aria-live="polite"
            {...props}
        >
            <div className="flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                {state === 'saving' ? <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" /> : <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                {state === 'saving' ? 'Saving changes' : 'Unsaved changes'}
            </div>
            <div className="flex items-center gap-[var(--lb-space-2)]">
                <button
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                    onClick={onDiscard}
                    disabled={state === 'saving'}
                >
                    {discardLabel}
                </button>
                <button
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                    onClick={onSave}
                    disabled={state === 'saving'}
                >
                    {state === 'saving' ? 'Saving' : saveLabel}
                </button>
            </div>
        </div>
    );
}
