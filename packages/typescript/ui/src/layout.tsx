import React from 'react';
import { cx } from './utils';

export interface PageProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

export function Page({ children, className = '', ...props }: PageProps) {
    return (
        <main
            className={cx(
                'mx-auto flex w-full max-w-[var(--lb-size-page-max)] flex-col gap-[var(--lb-space-5)] px-[var(--lb-space-5)] py-[var(--lb-space-5)] text-[var(--lb-color-text)]',
                className,
            )}
            {...props}
        >
            {children}
        </main>
    );
}

export interface PageHeaderAction {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
    title: string;
    description?: string;
    eyebrow?: string;
    breadcrumbs?: Array<{ label: string; href?: string }>;
    primaryAction?: PageHeaderAction;
    secondaryActions?: PageHeaderAction[];
    renderAction?: (action: PageHeaderAction, variant: 'primary' | 'secondary') => React.ReactNode;
}

export function PageHeader({
    title,
    description,
    eyebrow,
    breadcrumbs = [],
    primaryAction,
    secondaryActions = [],
    renderAction,
    className = '',
    ...props
}: PageHeaderProps) {
    const renderDefaultAction = (action: PageHeaderAction, variant: 'primary' | 'secondary') => {
        const buttonClassName = cx(
            'inline-flex h-[var(--lb-size-control-md)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:pointer-events-none disabled:opacity-50',
            variant === 'primary'
                ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary)] text-[var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-primary-hover)]'
                : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
        );
        const content = (
            <>
                {action.icon}
                {action.label}
            </>
        );

        if (action.href) {
            return (
                <a key={action.label} className={buttonClassName} href={action.href} aria-disabled={action.disabled}>
                    {content}
                </a>
            );
        }

        return (
            <button key={action.label} className={buttonClassName} type="button" onClick={action.onClick} disabled={action.disabled}>
                {content}
            </button>
        );
    };

    return (
        <header className={cx('flex flex-col gap-[var(--lb-space-4)]', className)} {...props}>
            {breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    <ol className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        {breadcrumbs.map((breadcrumb, index) => (
                            <li key={`${breadcrumb.label}-${index}`} className="flex items-center gap-[var(--lb-space-2)]">
                                {breadcrumb.href ? (
                                    <a className="hover:text-[var(--lb-color-text)]" href={breadcrumb.href}>
                                        {breadcrumb.label}
                                    </a>
                                ) : (
                                    <span>{breadcrumb.label}</span>
                                )}
                                {index < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}
            <div className="flex flex-col gap-[var(--lb-space-4)] md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-[var(--lb-space-1)]">
                    {eyebrow && (
                        <p className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-primary)]">
                            {eyebrow}
                        </p>
                    )}
                    <h1 className="m-0 font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)] text-[length:var(--lb-font-size-display)]">
                        {title}
                    </h1>
                    {description && (
                        <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                            {description}
                        </p>
                    )}
                </div>
                {(primaryAction || secondaryActions.length > 0) && (
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        {secondaryActions.map((action) => renderAction?.(action, 'secondary') ?? renderDefaultAction(action, 'secondary'))}
                        {primaryAction && (renderAction?.(primaryAction, 'primary') ?? renderDefaultAction(primaryAction, 'primary'))}
                    </div>
                )}
            </div>
        </header>
    );
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
    return (
        <section
            className={cx(
                'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-sm)]',
                className,
            )}
            {...props}
        >
            {children}
        </section>
    );
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
    title?: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export function Section({ title, description, action, children, className = '', ...props }: SectionProps) {
    return (
        <section className={cx('flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-5)]', className)} {...props}>
            {(title || description || action) && (
                <div className="flex flex-col gap-[var(--lb-space-3)] md:flex-row md:items-start md:justify-between">
                    <div className="space-y-[var(--lb-space-1)]">
                        {title && (
                            <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}
