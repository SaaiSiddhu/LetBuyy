'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    ClipboardList,
    CreditCard,
    FileText,
    Globe,
    Info,
    LayoutGrid,
    Loader2,
    Megaphone,
    Package,
    Palette,
    Puzzle,
    ShoppingBag,
    Sparkles,
    Tag,
    Users,
    X,
} from './icons';
import { cx } from './utils';

export type StatusVariant = 'default' | 'info' | 'success' | 'warning' | 'critical';

const statusStyles: Record<StatusVariant, { surface: string; text: string; border: string; icon: React.ReactNode }> = {
    default: {
        surface: 'bg-[var(--lb-component-badge-accent-bg)]',
        text: 'text-[color:var(--lb-component-badge-accent-text)]',
        border: 'border-[var(--lb-component-badge-accent-border)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    info: {
        surface: 'bg-[var(--lb-component-banner-info-bg)]',
        text: 'text-[color:var(--lb-component-banner-info-text)]',
        border: 'border-[var(--lb-component-banner-info-border)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    success: {
        surface: 'bg-[var(--lb-component-banner-success-bg)]',
        text: 'text-[color:var(--lb-component-banner-success-text)]',
        border: 'border-[var(--lb-component-banner-success-border)]',
        icon: <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    warning: {
        surface: 'bg-[var(--lb-component-banner-warning-bg)]',
        text: 'text-[color:var(--lb-component-banner-warning-text)]',
        border: 'border-[var(--lb-component-banner-warning-border)]',
        icon: <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    critical: {
        surface: 'bg-[var(--lb-component-banner-danger-bg)]',
        text: 'text-[color:var(--lb-component-banner-danger-text)]',
        border: 'border-[var(--lb-component-banner-danger-border)]',
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
                'inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-badge)]',
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
                'flex gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-density-card-padding)]',
                style.surface,
                style.border,
                className,
            )}
            role={variant === 'critical' ? 'alert' : 'status'}
            {...props}
        >
            <div className={cx('mt-[var(--lb-space-1)] shrink-0 text-[length:var(--lb-density-action-icon-size)]', style.text)}>
                {style.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-[var(--lb-space-1)]">
                {title && (
                    <h3 className={cx('m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]', style.text)}>
                        {title}
                    </h3>
                )}
                <div className="text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
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
                className="fixed right-[var(--lb-space-5)] top-[calc(var(--lb-space-7)+var(--lb-space-4))] z-[var(--lb-z-toast)] flex w-[min(380px,calc(100vw-var(--lb-space-6)))] flex-col gap-[var(--lb-space-3)]"
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
                                'flex gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface-raised)] p-[var(--lb-density-card-padding)] shadow-[var(--lb-shadow-lg)]',
                                style.border,
                            )}
                            role={variant === 'critical' ? 'alert' : 'status'}
                        >
                            <div className={cx('mt-[var(--lb-space-1)] text-[length:var(--lb-density-action-icon-size)]', style.text)}>
                                {style.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    {toast.title}
                                </p>
                                {toast.description && (
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        {toast.description}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
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
                    <div key={index} className="h-[var(--lb-density-table-row-height)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)]" />
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
    illustration?: React.ReactNode;
    kind?: EmptyStateKind;
    title: string;
    body?: string;
    primaryAction?: React.ReactNode;
    secondaryAction?: React.ReactNode;
}

export type EmptyStateKind =
    | 'generic'
    | 'products'
    | 'collections'
    | 'inventory'
    | 'orders'
    | 'customers'
    | 'discounts'
    | 'marketing'
    | 'content'
    | 'domains'
    | 'themes'
    | 'analytics'
    | 'apps'
    | 'payments';

const emptyStateIconMap = {
    generic: Sparkles,
    products: Package,
    collections: LayoutGrid,
    inventory: ClipboardList,
    orders: ShoppingBag,
    customers: Users,
    discounts: Tag,
    marketing: Megaphone,
    content: FileText,
    domains: Globe,
    themes: Palette,
    analytics: BarChart3,
    apps: Puzzle,
    payments: CreditCard,
} as const;

function renderEmptyStateMotif(kind: EmptyStateKind) {
    switch (kind) {
        case 'products':
            return (
                <>
                    <rect x="48" y="46" width="34" height="28" rx="8" stroke="currentColor" strokeWidth="2" opacity="0.7" />
                    <path d="M48 57H82" stroke="currentColor" strokeWidth="2" opacity="0.28" />
                    <rect x="92" y="40" width="36" height="40" rx="9" fill="currentColor" opacity="0.1" data-lb-empty-float="secondary" />
                </>
            );
        case 'collections':
            return (
                <>
                    <rect x="46" y="42" width="26" height="26" rx="7" fill="currentColor" opacity="0.16" />
                    <rect x="78" y="42" width="26" height="26" rx="7" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                    <rect x="110" y="42" width="26" height="26" rx="7" fill="currentColor" opacity="0.1" data-lb-empty-float="secondary" />
                </>
            );
        case 'inventory':
            return (
                <>
                    <path d="M50 72H132" stroke="currentColor" strokeWidth="2" opacity="0.45" />
                    <path d="M58 48H126L118 72H66L58 48Z" stroke="currentColor" strokeWidth="2" opacity="0.7" />
                    <circle cx="74" cy="82" r="4" fill="currentColor" opacity="0.28" />
                    <circle cx="110" cy="82" r="4" fill="currentColor" opacity="0.28" />
                </>
            );
        case 'orders':
            return (
                <>
                    <rect x="50" y="40" width="78" height="54" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.65" />
                    <path d="M64 56H112M64 70H100M64 84H92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
                    <circle cx="130" cy="46" r="12" fill="currentColor" opacity="0.1" data-lb-empty-float="secondary" />
                </>
            );
        case 'customers':
            return (
                <>
                    <circle cx="72" cy="54" r="12" stroke="currentColor" strokeWidth="2" opacity="0.7" />
                    <path d="M52 88C56 74 64 68 72 68C80 68 88 74 92 88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
                    <circle cx="112" cy="58" r="10" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary" />
                    <path d="M98 88C102 76 108 72 114 72C120 72 126 76 130 88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.28" />
                </>
            );
        case 'discounts':
        case 'marketing':
            return (
                <>
                    <path d="M52 70L118 42L126 84L52 70Z" stroke="currentColor" strokeWidth="2" opacity="0.68" />
                    <path d="M61 72L66 92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                    <circle cx="136" cy="38" r="5" fill="currentColor" opacity="0.22" data-lb-empty-float="secondary" />
                    <path d="M134 58H150M138 72H152" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.32" />
                </>
            );
        case 'analytics':
            return (
                <>
                    <path d="M48 84H132" stroke="currentColor" strokeWidth="2" opacity="0.36" />
                    <rect x="58" y="60" width="12" height="24" rx="4" fill="currentColor" opacity="0.16" />
                    <rect x="82" y="48" width="12" height="36" rx="4" fill="currentColor" opacity="0.28" data-lb-empty-float="secondary" />
                    <rect x="106" y="36" width="12" height="48" rx="4" fill="currentColor" opacity="0.16" />
                </>
            );
        case 'domains':
            return (
                <>
                    <circle cx="92" cy="64" r="30" stroke="currentColor" strokeWidth="2" opacity="0.58" />
                    <path d="M62 64H122M92 34C102 48 102 80 92 94M92 34C82 48 82 80 92 94" stroke="currentColor" strokeWidth="2" opacity="0.32" />
                    <circle cx="132" cy="48" r="8" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary" />
                </>
            );
        case 'themes':
            return (
                <>
                    <rect x="48" y="42" width="80" height="54" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.62" />
                    <path d="M48 56H128" stroke="currentColor" strokeWidth="2" opacity="0.24" />
                    <circle cx="62" cy="49" r="3" fill="currentColor" opacity="0.35" />
                    <rect x="62" y="68" width="42" height="12" rx="4" fill="currentColor" opacity="0.13" data-lb-empty-float="secondary" />
                </>
            );
        case 'apps':
            return (
                <>
                    <path d="M74 42H96V60H118V82H96V100H74V82H52V60H74V42Z" stroke="currentColor" strokeWidth="2" opacity="0.64" />
                    <circle cx="130" cy="46" r="7" fill="currentColor" opacity="0.16" data-lb-empty-float="secondary" />
                </>
            );
        case 'payments':
            return (
                <>
                    <rect x="48" y="48" width="84" height="52" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.62" />
                    <path d="M48 62H132" stroke="currentColor" strokeWidth="3" opacity="0.22" />
                    <rect x="62" y="78" width="34" height="8" rx="4" fill="currentColor" opacity="0.18" data-lb-empty-float="secondary" />
                </>
            );
        case 'content':
            return (
                <>
                    <rect x="54" y="38" width="68" height="72" rx="10" stroke="currentColor" strokeWidth="2" opacity="0.62" />
                    <path d="M70 58H106M70 72H110M70 86H96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.36" />
                    <rect x="116" y="50" width="18" height="26" rx="6" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary" />
                </>
            );
        case 'generic':
        default:
            return (
                <>
                    <path d="M48 78H92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
                    <path d="M48 88H118" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.28" />
                    <circle cx="136" cy="52" r="10" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary" />
                </>
            );
    }
}

export function EmptyStateIllustration({ kind = 'generic', icon }: { kind?: EmptyStateKind; icon?: React.ReactNode }) {
    const Icon = emptyStateIconMap[kind];

    return (
        <div
            className="relative h-[var(--lb-density-empty-state-illustration-height)] w-[var(--lb-density-empty-state-illustration-width)] text-[color:var(--lb-component-empty-state-illustration-ink)] transition-transform duration-[var(--lb-motion-slow)] ease-[var(--lb-ease-out)] motion-safe:hover:-translate-y-[4px]"
            aria-hidden="true"
        >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 192 128" fill="none">
                <rect x="18" y="18" width="156" height="92" rx="16" fill="var(--lb-component-empty-state-illustration-bg)" />
                <rect x="34" y="32" width="124" height="64" rx="12" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <path d="M40 102C56 90 74 90 96 102C118 114 142 114 162 96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.22" />
                <g data-lb-empty-float="primary">
                    {renderEmptyStateMotif(kind)}
                </g>
            </svg>
            <div className="absolute left-1/2 top-1/2 flex h-[var(--lb-density-button-height-large)] w-[var(--lb-density-button-height-large)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[var(--lb-radius-xl)] border border-[var(--lb-component-empty-state-border)] bg-[var(--lb-component-empty-state-bg)] shadow-[var(--lb-component-card-shadow)]">
                {icon ?? <Icon className="h-[var(--lb-density-page-icon-size)] w-[var(--lb-density-page-icon-size)]" aria-hidden="true" />}
            </div>
        </div>
    );
}

export function EmptyState({ icon, illustration, kind = 'generic', title, body, primaryAction, secondaryAction, className = '', ...props }: EmptyStateProps) {
    return (
        <div
            className={cx(
                'flex min-h-[var(--lb-density-empty-state-min-height)] flex-col items-center justify-center gap-[var(--lb-density-section-gap)] rounded-[var(--lb-component-card-radius)] border border-dashed border-[var(--lb-component-empty-state-border)] bg-[var(--lb-component-empty-state-bg)] p-[var(--lb-density-card-padding)] text-center',
                className,
            )}
            {...props}
        >
            {illustration ?? <EmptyStateIllustration kind={kind} icon={icon} />}
            <div className="max-w-[var(--lb-size-empty-state-measure)] space-y-[var(--lb-space-2)]">
                <h3 className="m-0 text-[length:var(--lb-font-size-card-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-card-title)] text-[color:var(--lb-component-empty-state-title)]">
                    {title}
                </h3>
                {body && (
                    <p className="m-0 text-[length:var(--lb-font-size-empty-state)] leading-[var(--lb-line-height-empty-state)] text-[color:var(--lb-component-empty-state-body)]">
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
                'sticky bottom-[var(--lb-space-0)] z-[var(--lb-z-sticky)] mx-auto flex w-full flex-col items-stretch justify-between gap-[var(--lb-space-3)] rounded-none border border-x-0 border-[var(--lb-color-border)] bg-[var(--lb-color-surface-raised)] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-lg)] sm:bottom-[var(--lb-space-4)] sm:w-[min(var(--lb-size-save-bar-width),calc(100vw-var(--lb-space-6)))] sm:flex-row sm:items-center sm:gap-[var(--lb-space-4)] sm:rounded-[var(--lb-radius-lg)] sm:border-x',
                isSaved ? 'opacity-0 pointer-events-none' : 'opacity-100',
                className,
            )}
            aria-live="polite"
            {...props}
        >
            <div className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                {state === 'saving' ? <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" /> : <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                {state === 'saving' ? 'Saving changes' : 'Unsaved changes'}
            </div>
            <div className="flex items-center gap-[var(--lb-space-2)] [&>button]:flex-1 sm:[&>button]:flex-none">
                <button
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                    onClick={onDiscard}
                    disabled={state === 'saving'}
                >
                    {discardLabel}
                </button>
                <button
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)] hover:bg-[var(--lb-component-button-primary-hover)] active:bg-[var(--lb-component-button-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                    onClick={onSave}
                    disabled={state === 'saving'}
                >
                    {state === 'saving' ? 'Saving' : saveLabel}
                </button>
            </div>
        </div>
    );
}
