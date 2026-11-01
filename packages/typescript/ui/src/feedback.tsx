'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFormProtection } from './navigation/form-protection';
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
import { Button } from './button';
import { cx } from './utils';

export type StatusVariant = 'default' | 'info' | 'success' | 'warning' | 'critical';

const statusStyles: Record<StatusVariant, { bg: string; text: string }> = {
    default: {
        bg: 'bg-[var(--lb-component-badge-accent-bg)]',
        text: 'text-[color:var(--lb-component-badge-accent-text)]',
    },
    info: {
        bg: 'bg-[var(--lb-component-badge-info-bg)]',
        text: 'text-[color:var(--lb-component-badge-info-text)]',
    },
    success: {
        bg: 'bg-[var(--lb-component-badge-success-bg)]',
        text: 'text-[color:var(--lb-component-badge-success-text)]',
    },
    warning: {
        bg: 'bg-[var(--lb-component-badge-warning-bg)]',
        text: 'text-[color:var(--lb-component-badge-warning-text)]',
    },
    critical: {
        bg: 'bg-[var(--lb-component-badge-danger-bg)]',
        text: 'text-[color:var(--lb-component-badge-danger-text)]',
    },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    label: string;
    variant?: StatusVariant;
}

export function Badge({ label, variant = 'default', className = '', ...props }: BadgeProps) {
    const style = statusStyles[variant];

    return (
        <span
            className={cx(
                'inline-flex items-center rounded-[6px] px-[var(--lb-space-2)] py-[2px] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)]',
                style.bg,
                style.text,
                className,
            )}
            {...props}
        >
            {label}
        </span>
    );
}

/**
 * Map an arbitrary status/state string to a canonical Badge variant. This is the
 * single source for status→tone logic (replacing the per-app StatusBadge/StatusPill
 * forks — see COMPONENT_DUPLICATION_REPORT.md DUP-4).
 */
export function statusToBadgeVariant(status: string): StatusVariant {
    const s = status.toLowerCase().trim();
    const has = (...keys: string[]) => keys.some((k) => s.includes(k));
    if (has('success', 'active', 'approved', 'paid', 'complete', 'live', 'healthy', 'resolved', 'online', 'passed', 'published', 'enabled', 'verified', 'connected')) return 'success';
    if (has('fail', 'error', 'critical', 'reject', 'declin', 'block', 'suspend', 'overdue', 'offline', 'ban', 'fraud', 'cancel', 'expired', 'disabled', 'down')) return 'critical';
    if (has('pending', 'review', 'warning', 'processing', 'draft', 'paused', 'degraded', 'partial', 'awaiting', 'hold', 'retry')) return 'warning';
    if (has('info', 'new', 'scheduled', 'queued', 'in progress', 'in-progress')) return 'info';
    return 'default';
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'label'> {
    /** The raw status/state string; tone is derived automatically. */
    status: string;
    /** Display label (defaults to the status string). */
    label?: string;
    /** Explicit variant override; otherwise derived from `status`. */
    variant?: StatusVariant;
}

/**
 * A Badge whose tone is derived from a status string. Use this instead of
 * re-deriving status→color in each app.
 */
export function StatusBadge({ status, label, variant, ...props }: StatusBadgeProps) {
    return <Badge label={label ?? status} variant={variant ?? statusToBadgeVariant(status)} {...props} />;
}

/**
 * The domain layer's semantic tone vocabulary, mirrored STRUCTURALLY.
 *
 * Deliberately not imported from `@letbuyy/shared-types`: the design system must
 * not depend on the domain layer. TypeScript's structural typing means a
 * `StatusPresentation` produced there is assignable here without either package
 * knowing about the other — the coupling stays in the app, which imports both.
 */
export type StatusToneName = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

/** The only difference between the two vocabularies: the domain says `neutral`. */
export function toneToVariant(tone: StatusToneName): StatusVariant {
    return tone === 'neutral' ? 'default' : tone;
}

/** Structural mirror of the domain layer's `StatusPresentation`. */
export interface StatusPresentationLike {
    label: string;
    tone: StatusToneName;
    iconKey?: string;
    a11yLabel?: string;
}

export interface StatusPresentationBadgeProps extends Omit<BadgeProps, 'label' | 'variant'> {
    /** A presentation record from the domain layer's canonical status map. */
    presentation: StatusPresentationLike;
}

/**
 * Render a domain status that has already been resolved to a presentation.
 *
 * This is the ONLY sanctioned way to show a domain status: the domain owns the
 * label and the tone, the design system owns how a tone looks. Apps do not
 * re-derive either.
 */
export function StatusPresentationBadge({ presentation, ...props }: StatusPresentationBadgeProps) {
    return (
        <Badge
            label={presentation.label}
            variant={toneToVariant(presentation.tone)}
            {...(presentation.a11yLabel ? { 'aria-label': presentation.a11yLabel } : {})}
            {...props}
        />
    );
}

/**
 * How a money or fulfilment surface is wired to its payment/shipping provider.
 *
 * Vocabulary is fixed by LETBUYY_CONSTITUTION.md (:73 Principle 3, :276 ART-20)
 * and root AGENTS.md UI-R6 / PAY-R10: `mock | sandbox | live`. DOC 06 UX-R4's
 * `scaffold` is a subordinate-document deviation and is not used.
 *
 * `mock` is deliberately NOT a stored column value — the DB CHECK on the money
 * tables permits only `sandbox | live`. `mock` is what an ABSENT or unresolvable
 * provider_mode resolves to: the Constitution defines mock as the default adapter
 * when nothing real is wired, which is exactly the null case.
 */
export type ProviderMode = 'live' | 'sandbox' | 'mock';

/**
 * Resolve a backend `provider_mode` into a mode that can always be rendered.
 *
 * Never returns null. An unknown or missing value resolves to `mock`, because a
 * money surface that renders NOTHING is indistinguishable from a live one — the
 * precise failure ANTI-R9 / UX-R33 exist to prevent ("a stub MUST NOT read as
 * success"). Silence is not honesty.
 */
export function normalizeProviderMode(value: unknown): ProviderMode {
    // 'test' is the legacy alias migrated away by
    // 167_app_billing_provider_mode_sandbox.sql; still accepted on read.
    if (value === 'test') return 'sandbox';
    if (value === 'live' || value === 'sandbox' || value === 'mock') return value;
    return 'mock';
}

const providerModePresentation: Record<ProviderMode, { label: string; variant: StatusVariant; description: string }> = {
    // A real provider, real money.
    live: { label: 'Live', variant: 'success', description: 'Live provider — real transactions' },
    // A real provider on test credentials.
    sandbox: { label: 'Sandbox', variant: 'warning', description: 'Sandbox provider — test transactions only' },
    // No real adapter wired. Louder than sandbox on purpose: it is the more
    // dangerous state to mistake for live.
    mock: { label: 'Mock', variant: 'critical', description: 'Mock provider — not connected to a real payment provider' },
};

export interface ProviderModeBadgeProps extends Omit<BadgeProps, 'label' | 'variant'> {
    /** The backend `provider_mode`. Missing/unknown resolves to `mock`. */
    mode: ProviderMode | string | null | undefined;
}

/**
 * The provider-mode honesty badge (UX-R4 / PAY-R10 / ART-20).
 *
 * Required on every money and fulfilment surface. Renders label + icon + an
 * accessible description — never colour alone, and never nothing. Tone comes
 * from Badge's accessible 700/800 text ramp, so it does not repeat the raw-500
 * foreground contrast failure the app-local badge shipped (1.93:1 / 2.07:1).
 */
export function ProviderModeBadge({ mode, ...props }: ProviderModeBadgeProps) {
    const resolved = normalizeProviderMode(mode);
    const presentation = providerModePresentation[resolved];

    return (
        <Badge
            label={presentation.label}
            variant={presentation.variant}
            title={presentation.description}
            aria-label={presentation.description}
            data-provider-mode={resolved}
            {...props}
        />
    );
}

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    children: React.ReactNode;
    variant?: Exclude<StatusVariant, 'default'>;
    action?: React.ReactNode;
}

const bannerStyles: Record<Exclude<StatusVariant, 'default'>, { bg: string; text: string; actionText: string; border: string; icon: React.ReactNode }> = {
    info: {
        bg: 'bg-[var(--lb-component-banner-info-bg)]',
        text: 'text-[color:var(--lb-component-banner-info-text)]',
        actionText: '[&_button]:text-[color:var(--lb-component-banner-info-text)]',
        border: 'border-[color:var(--lb-component-banner-info-border)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    success: {
        bg: 'bg-[var(--lb-component-banner-success-bg)]',
        text: 'text-[color:var(--lb-component-banner-success-text)]',
        actionText: '[&_button]:text-[color:var(--lb-component-banner-success-text)]',
        border: 'border-[color:var(--lb-component-banner-success-border)]',
        icon: <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    warning: {
        bg: 'bg-[var(--lb-component-banner-warning-bg)]',
        text: 'text-[color:var(--lb-component-banner-warning-text)]',
        actionText: '[&_button]:text-[color:var(--lb-component-banner-warning-text)]',
        border: 'border-[color:var(--lb-component-banner-warning-border)]',
        icon: <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    critical: {
        bg: 'bg-[var(--lb-component-banner-danger-bg)]',
        text: 'text-[color:var(--lb-component-banner-danger-text)]',
        actionText: '[&_button]:text-[color:var(--lb-component-banner-danger-text)]',
        border: 'border-[color:var(--lb-component-banner-danger-border)]',
        icon: <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
};

export function Banner({ title, children, variant = 'info', action, className = '', ...props }: BannerProps) {
    const style = bannerStyles[variant];

    return (
        <div
            className={cx(
                'flex flex-wrap items-start gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border p-[var(--lb-space-3)] text-[color:var(--lb-color-text)] [&_button]:h-auto [&_button]:min-h-0 [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:py-[var(--lb-space-1)] [&_button]:font-[var(--lb-font-weight-semibold)] [&_button]:shadow-none [&_button]:underline [&_button]:underline-offset-2 [&_button:hover]:bg-transparent [&_button:hover]:opacity-80',
                style.bg,
                style.border,
                style.actionText,
                className,
            )}
            role={variant === 'critical' ? 'alert' : 'status'}
            {...props}
        >
            <div className={cx('mt-[1px] shrink-0 text-[length:var(--lb-density-action-icon-size)]', style.text)}>
                {style.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-[2px]">
                {title && (
                    <h3 className="m-0 text-[length:var(--lb-font-size-secondary)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                        {title}
                    </h3>
                )}
                <div className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]">
                    {children}
                </div>
            </div>
            {action && (
                <div className="ml-auto shrink-0">
                    {action}
                </div>
            )}
        </div>
    );
}

export type ToastVariant = Exclude<StatusVariant, 'default'>;
export type ToastPlacement = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface ToastMessage {
    id: string;
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number | null;
    placement?: ToastPlacement;
}

interface ToastContextValue {
    notify: (toast: Omit<ToastMessage, 'id'>) => string;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
    children: React.ReactNode;
    duration?: number;
    placement?: ToastPlacement;
}

// Top placements are viewport-pinned, so on a surface with a fixed app header
// the default 48px offset lands INSIDE the header. `--lb-toast-offset-block-start`
// is the consumer hook for that: a shell sets it to clear its own chrome, and
// every other surface keeps the historical offset via the fallback.
const TOAST_TOP = 'top-[var(--lb-toast-offset-block-start,calc(var(--lb-space-7)+var(--lb-space-4)))]';

const toastPlacementStyles: Record<ToastPlacement, string> = {
    'top-right': `right-[var(--lb-space-5)] ${TOAST_TOP}`,
    'top-left': `left-[var(--lb-space-5)] ${TOAST_TOP}`,
    'top-center': `left-1/2 ${TOAST_TOP} -translate-x-1/2`,
    'bottom-right': 'bottom-[var(--lb-space-5)] right-[var(--lb-space-5)]',
    'bottom-left': 'bottom-[var(--lb-space-5)] left-[var(--lb-space-5)]',
    'bottom-center': 'bottom-[var(--lb-space-5)] left-1/2 -translate-x-1/2',
};

/**
 * Sonner-style "rich colours": a solid, saturated fill per variant with
 * white text/icon on top. Deliberately a SEPARATE map from `statusStyles`
 * above — Badge and Banner use that one for a soft, low-saturation tint,
 * and must keep looking that way. A toast is a transient, high-attention
 * surface that has to read at a glance, not blend into the page like an
 * inline banner does.
 */
const toastVariantStyles: Record<ToastVariant, { bg: string; icon: React.ReactNode }> = {
    info: {
        bg: 'bg-[var(--lb-component-toast-info-bg)]',
        icon: <Info className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    success: {
        bg: 'bg-[var(--lb-component-toast-success-bg)]',
        icon: <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    warning: {
        bg: 'bg-[var(--lb-component-toast-warning-bg)]',
        icon: <AlertTriangle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
    critical: {
        bg: 'bg-[var(--lb-component-toast-danger-bg)]',
        icon: <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
    },
};

export function ToastProvider({ children, duration = 5000, placement = 'top-right' }: ToastProviderProps) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const notify = useCallback((toast: Omit<ToastMessage, 'id'>) => {
        const id = globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}`;
        setToasts((current) => [...current, { ...toast, id }]);
        const toastDuration = toast.duration ?? duration;
        if (toastDuration !== null && toastDuration > 0) {
            window.setTimeout(() => dismiss(id), toastDuration);
        }
        return id;
    }, [dismiss, duration]);

    const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);
    const activePlacements = Array.from(new Set(toasts.map((toast) => toast.placement ?? placement)));

    return (
        <ToastContext.Provider value={value}>
            {children}
            {activePlacements.map((activePlacement) => (
                <div
                    key={activePlacement}
                    className={cx(
                        'fixed z-[var(--lb-z-toast)] flex w-[min(336px,calc(100vw-var(--lb-space-6)))] flex-col gap-[var(--lb-space-2)]',
                        toastPlacementStyles[activePlacement],
                    )}
                    aria-live="polite"
                    aria-relevant="additions removals"
                >
                    {toasts
                        .filter((toast) => (toast.placement ?? placement) === activePlacement)
                        .map((toast) => {
                            const variant = toast.variant ?? 'info';
                            const style = toastVariantStyles[variant];
                            return (
                                <div
                                    key={toast.id}
                                    className={cx(
                                        'flex items-start gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] p-[var(--lb-space-3)] text-[color:var(--lb-component-toast-text)] shadow-[var(--lb-shadow-md)]',
                                        style.bg,
                                    )}
                                    role={variant === 'critical' ? 'alert' : 'status'}
                                >
                                    <div className="mt-[1px] shrink-0 text-[length:var(--lb-density-action-icon-size)]">
                                        {style.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="m-0 text-[length:var(--lb-font-size-secondary)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)]">
                                            {toast.title}
                                        </p>
                                        {toast.description && (
                                            <p className="m-0 mt-[2px] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] opacity-[var(--lb-component-feedback-description-opacity,0.9)]">
                                                {toast.description}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        unstyled
                                        type="button"
                                        className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] shrink-0 items-center justify-center rounded-[var(--lb-radius-sm)] text-[color:var(--lb-component-toast-text)] hover:bg-[var(--lb-component-toast-close-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                                        onClick={() => dismiss(toast.id)}
                                        aria-label="Dismiss notification"
                                    >
                                        <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </Button>
                                </div>
                            );
                        })}
                </div>
            ))}
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
    illustrationMotifs?: Partial<Record<EmptyStateKind, React.ReactNode>>;
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

export interface EmptyStateIllustrationProps {
    kind?: EmptyStateKind;
    icon?: React.ReactNode;
    motifs?: Partial<Record<EmptyStateKind, React.ReactNode>>;
}

export function EmptyStateIllustration({ kind = 'generic', icon, motifs }: EmptyStateIllustrationProps) {
    const Icon = emptyStateIconMap[kind];
    const motif = motifs?.[kind] ?? renderEmptyStateMotif(kind);

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
                    {motif}
                </g>
            </svg>
            <div className="absolute left-1/2 top-1/2 flex h-[var(--lb-density-button-height-large)] w-[var(--lb-density-button-height-large)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[var(--lb-radius-xl)] border border-[var(--lb-component-empty-state-border)] bg-[var(--lb-component-empty-state-bg)] shadow-[var(--lb-component-card-shadow)]">
                {icon ?? <Icon className="h-[var(--lb-density-page-icon-size)] w-[var(--lb-density-page-icon-size)]" aria-hidden="true" />}
            </div>
        </div>
    );
}

export function EmptyState({ icon, illustration, illustrationMotifs, kind = 'generic', title, body, primaryAction, secondaryAction, className = '', ...props }: EmptyStateProps) {
    return (
        <div
            className={cx(
                'flex min-h-[var(--lb-density-empty-state-min-height)] flex-col items-center justify-center gap-[var(--lb-density-section-gap)] rounded-[var(--lb-component-card-radius)] bg-[var(--lb-component-empty-state-bg)] p-[var(--lb-density-card-padding)] text-center',
                className,
            )}
            {...props}
        >
            {illustration ?? <EmptyStateIllustration kind={kind} icon={icon} motifs={illustrationMotifs} />}
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
    onSave?: () => void | Promise<void>;
    onDiscard?: () => void;
    saveLabel?: string;
    discardLabel?: string;
    /** A domain editor may register a richer guard independently of the visual bar. */
    protectNavigation?: boolean;
    discardDisabled?: boolean;
    saveDisabled?: boolean;
}

export function SaveBar({
    state,
    onSave,
    onDiscard,
    saveLabel = 'Save',
    discardLabel = 'Discard',
    protectNavigation = true,
    discardDisabled = false,
    saveDisabled = false,
    className = '',
    onFocusCapture,
    onBlurCapture,
    ...props
}: SaveBarProps) {
    const isSaved = state === 'saved';
    const focusReturn = useRef<HTMLElement | null>(null);
    useFormProtection(protectNavigation ? { dirty: !isSaved, saving: state === 'saving', onSave, onDiscard, canSave: !saveDisabled && Boolean(onSave), canDiscard: !discardDisabled && Boolean(onDiscard) } : null);
    useEffect(() => {
        if (!isSaved || !focusReturn.current) return;
        const target = focusReturn.current;
        focusReturn.current = null;
        if (target.isConnected && document.activeElement === document.body) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
        }
    }, [isSaved]);
    if (isSaved) return null;

    return (
        <div
            className={cx(
                'sticky bottom-[var(--lb-space-0)] z-[var(--lb-z-sticky)] mx-auto flex w-full flex-col items-stretch justify-between gap-[var(--lb-space-3)] rounded-none border border-x-0 border-[var(--lb-component-save-bar-border,var(--lb-color-border))] bg-[var(--lb-component-save-bar-bg,var(--lb-color-surface-raised))] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-lg)] max-sm:pb-[max(var(--lb-space-3),env(safe-area-inset-bottom))] sm:bottom-[var(--lb-space-4)] sm:w-[min(var(--lb-size-save-bar-width),calc(100vw-var(--lb-space-6)))] sm:flex-row sm:items-center sm:gap-[var(--lb-space-4)] sm:rounded-[var(--lb-radius-lg)] sm:border-x',
                className,
            )}
            aria-live="polite"
            onFocusCapture={event => {
                focusReturn.current = event.currentTarget.closest('main')?.querySelector<HTMLElement>('h1') ?? null;
                onFocusCapture?.(event);
            }}
            onBlurCapture={event => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focusReturn.current = null;
                onBlurCapture?.(event);
            }}
            {...props}
        >
            <div className="flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-save-bar-text,var(--lb-color-text))]">
                {state === 'saving' ? <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" /> : <AlertCircle className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                {state === 'saving' ? 'Saving changes' : 'Unsaved changes'}
            </div>
            <div className="flex items-center gap-[var(--lb-space-2)] [&>button]:flex-1 max-sm:[&>button]:min-h-[var(--lb-size-touch-target)] sm:[&>button]:flex-none">
                <Button
                    unstyled
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-transparent px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-save-bar-text,var(--lb-color-text))] hover:bg-[var(--lb-component-save-bar-discard-hover,var(--lb-color-surface-subdued))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-component-save-bar-focus,var(--lb-color-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-component-save-bar-bg,var(--lb-color-surface-raised))] disabled:opacity-50"
                    onClick={onDiscard}
                    disabled={state === 'saving' || discardDisabled || !onDiscard}
                >
                    {discardLabel}
                </Button>
                <Button
                    unstyled
                    type="button"
                    className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-transparent bg-[var(--lb-component-save-bar-action-bg,var(--lb-component-button-primary-bg))] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-save-bar-action-text,var(--lb-component-button-primary-text))] hover:bg-[var(--lb-component-save-bar-action-hover,var(--lb-component-button-primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-component-save-bar-focus,var(--lb-color-focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-component-save-bar-bg,var(--lb-color-surface-raised))] disabled:opacity-50"
                    onClick={onSave}
                    disabled={state === 'saving' || saveDisabled || !onSave}
                >
                    {state === 'saving' ? 'Saving' : saveLabel}
                </Button>
            </div>
        </div>
    );
}
