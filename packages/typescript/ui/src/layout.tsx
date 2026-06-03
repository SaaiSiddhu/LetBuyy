import React from 'react';
import { MaterialIcon, type MaterialIconName } from './icons';
import { cx } from './utils';

export interface PageProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
}

export function Page({ children, className = '', ...props }: PageProps) {
    return (
        <main
            className={cx(
                'mx-auto flex w-full max-w-[var(--lb-size-page-max)] flex-col gap-[var(--lb-density-page-gap)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[color:var(--lb-color-text)] sm:px-[var(--lb-density-card-padding)] sm:py-[var(--lb-density-page-gap)]',
                className,
            )}
            {...props}
        >
            {children}
        </main>
    );
}

export const letbuyyPageHeaderDefaults = {
    showBreadcrumb: false,
    showEyebrow: false,
    showDescription: false,
} as const;

export type PageIdentity =
    | 'dashboard'
    | 'products'
    | 'orders'
    | 'collections'
    | 'inventory'
    | 'customers'
    | 'analytics'
    | 'marketing'
    | 'discounts'
    | 'content'
    | 'settings'
    | 'apps'
    | 'themes'
    | 'payments'
    | 'domains';

const pageIconMap: Record<PageIdentity, MaterialIconName> = {
    dashboard: 'home',
    products: 'inventory_2',
    orders: 'shopping_bag',
    collections: 'folder_special',
    inventory: 'inventory',
    customers: 'group',
    analytics: 'bar_chart',
    marketing: 'marketing',
    discounts: 'sell',
    content: 'pages',
    settings: 'settings',
    apps: 'add_circle',
    themes: 'palette',
    payments: 'payments',
    domains: 'domains',
};

const titleIconMatchers: Array<[RegExp, PageIdentity]> = [
    [/dashboard|home/i, 'dashboard'],
    [/product|catalog|gift card/i, 'products'],
    [/order|fulfillment/i, 'orders'],
    [/collection|categor/i, 'collections'],
    [/inventory|transfer|purchase/i, 'inventory'],
    [/customer|lead|relationship/i, 'customers'],
    [/analytic|report|insight/i, 'analytics'],
    [/marketing|coupon|discount/i, 'marketing'],
    [/content|page|post|blog|comment|review|testimonial|gallery/i, 'content'],
    [/setting|billing|checkout|shipping|tax|policy|notification|user|permission|plan/i, 'settings'],
    [/app|extension/i, 'apps'],
    [/theme|appearance|online store/i, 'themes'],
    [/payment/i, 'payments'],
    [/domain/i, 'domains'],
];

export function getPageIconName(title: string, identity?: PageIdentity): MaterialIconName {
    if (identity) return pageIconMap[identity];
    const match = titleIconMatchers.find(([pattern]) => pattern.test(title));
    return match ? pageIconMap[match[1]] : 'page';
}

export interface PageShellProps extends PageProps {}

export function PageShell(props: PageShellProps) {
    return <Page {...props} />;
}

export interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function PageContent({ children, className = '', ...props }: PageContentProps) {
    return (
        <div className={cx('flex flex-col gap-[var(--lb-density-section-gap)]', className)} {...props}>
            {children}
        </div>
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
    identity?: PageIdentity;
    icon?: React.ReactNode;
    iconName?: MaterialIconName;
    showIcon?: boolean;
    showBreadcrumb?: boolean;
    showBreadcrumbs?: boolean;
    showEyebrow?: boolean;
    showSectionLabel?: boolean;
    showDescription?: boolean;
    primaryAction?: PageHeaderAction;
    secondaryActions?: PageHeaderAction[];
    renderAction?: (action: PageHeaderAction, variant: 'primary' | 'secondary') => React.ReactNode;
}

export interface PageHeaderActionsProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function PageHeaderActions({ children, className = '', ...props }: PageHeaderActionsProps) {
    return (
        <div className={cx('flex w-full shrink-0 flex-wrap items-center justify-stretch gap-[var(--lb-space-2)] [&>*]:max-sm:flex-1 sm:w-auto sm:justify-end', className)} {...props}>
            {children}
        </div>
    );
}

export const PageActions = PageHeaderActions;

export function PageHeader({
    title,
    description,
    eyebrow,
    breadcrumbs = [],
    identity,
    icon,
    iconName,
    showIcon = true,
    showBreadcrumb,
    showBreadcrumbs,
    showEyebrow,
    showSectionLabel,
    showDescription,
    primaryAction,
    secondaryActions = [],
    renderAction,
    className = '',
    ...props
}: PageHeaderProps) {
    const renderDefaultAction = (action: PageHeaderAction, variant: 'primary' | 'secondary') => {
        const buttonClassName = cx(
            'inline-flex h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:pointer-events-none disabled:opacity-50 [&_.letbuyy-icon]:h-[var(--lb-density-button-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-button-icon-size)]',
            variant === 'primary'
                ? 'border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] text-[color:var(--lb-component-button-primary-text)] hover:bg-[var(--lb-component-button-primary-hover)] active:bg-[var(--lb-component-button-primary-active)]'
                : 'border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] text-[color:var(--lb-component-button-secondary-text)] hover:bg-[var(--lb-component-button-secondary-hover)]',
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

    const shouldShowBreadcrumbs = showBreadcrumbs ?? showBreadcrumb ?? letbuyyPageHeaderDefaults.showBreadcrumb;
    const shouldShowEyebrow = showEyebrow ?? showSectionLabel ?? letbuyyPageHeaderDefaults.showEyebrow;
    const shouldShowDescription = showDescription ?? letbuyyPageHeaderDefaults.showDescription;
    const resolvedIconName = iconName ?? getPageIconName(title, identity);
    const resolvedIcon = icon ?? <MaterialIcon name={resolvedIconName} />;

    return (
        <header className={cx('flex flex-col gap-[var(--lb-space-2)]', className)} {...props}>
            {shouldShowBreadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    <ol className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        {breadcrumbs.map((breadcrumb, index) => (
                            <li key={`${breadcrumb.label}-${index}`} className="flex items-center gap-[var(--lb-space-2)]">
                                {breadcrumb.href ? (
                                    <a className="hover:text-[color:var(--lb-color-text)]" href={breadcrumb.href}>
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
            <div className="flex min-h-[var(--lb-density-header-height)] flex-col gap-[var(--lb-space-2)] md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-[var(--lb-space-2)]">
                    {showIcon && (
                        <span data-lb-page-header-icon="true" className="inline-flex shrink-0 items-center justify-center text-[length:var(--lb-component-page-header-icon-size)] leading-none text-[color:var(--lb-component-page-header-icon-text)] [&_.letbuyy-icon]:h-[var(--lb-component-page-header-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-component-page-header-icon-size)] [&_.letbuyy-icon]:[fill:var(--lb-component-page-header-icon-fill)] [&_.letbuyy-icon]:[stroke-width:var(--lb-component-page-header-icon-stroke-width)] [&_.letbuyy-icon]:stroke-current">
                            {resolvedIcon}
                        </span>
                    )}
                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                        {shouldShowEyebrow && eyebrow && (
                            <p className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-primary)]">
                                {eyebrow}
                            </p>
                        )}
                        <h1 data-lb-page-header-title="true" className="m-0 truncate text-[length:var(--lb-component-page-header-title-size)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-component-page-header-title-line-height)] text-[color:var(--lb-color-text)]">
                            {title}
                        </h1>
                        {shouldShowDescription && description && (
                            <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-small)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {(primaryAction || secondaryActions.length > 0) && (
                    <PageHeaderActions>
                        {secondaryActions.map((action) => renderAction?.(action, 'secondary') ?? renderDefaultAction(action, 'secondary'))}
                        {primaryAction && (renderAction?.(primaryAction, 'primary') ?? renderDefaultAction(primaryAction, 'primary'))}
                    </PageHeaderActions>
                )}
            </div>
        </header>
    );
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    layout?: 'default' | 'stack' | 'split';
}

const cardLayoutClasses: Record<NonNullable<CardProps['layout']>, string> = {
    default: '',
    stack: 'grid gap-[var(--lb-density-card-gap)]',
    split: 'grid gap-[var(--lb-density-card-gap)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
};

export function Card({ children, layout = 'default', className = '', ...props }: CardProps) {
    return (
        <section
            className={cx(
                'min-w-0 overflow-hidden rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] text-[color:var(--lb-component-card-text)] shadow-[var(--lb-component-card-shadow)]',
                cardLayoutClasses[layout],
                className,
            )}
            data-lb-card-layout={layout}
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
    columns?: 1 | 2 | 3;
}

const sectionColumnClasses: Record<NonNullable<SectionProps['columns']>, string> = {
    1: '',
    2: 'md:grid md:grid-cols-2',
    3: 'md:grid md:grid-cols-2 xl:grid-cols-3',
};

export function Section({ title, description, action, children, columns = 1, className = '', ...props }: SectionProps) {
    return (
        <section className={cx('flex flex-col gap-[var(--lb-density-section-gap)] p-[var(--lb-density-card-padding)]', className)} {...props}>
            {(title || description || action) && (
                <div className="flex flex-col gap-[var(--lb-space-3)] md:flex-row md:items-start md:justify-between">
                    <div className="space-y-[var(--lb-space-1)]">
                        {title && (
                            <h2 className="m-0 text-[length:var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[color:var(--lb-color-text)]">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="m-0 text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {action}
                </div>
            )}
            {columns === 1 ? children : <div className={cx('grid gap-[var(--lb-density-card-gap)]', sectionColumnClasses[columns])}>{children}</div>}
        </section>
    );
}
