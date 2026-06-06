import React from 'react';
import { Breadcrumbs } from './breadcrumbs';
import { Button } from './button';
import { MaterialIcon, type MaterialIconName } from './icons';
import { cx } from './utils';

type LayoutElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'nav' | 'main' | 'span';
type TextElement = 'p' | 'span' | 'div' | 'strong' | 'em' | 'code' | 'h1' | 'h2' | 'h3' | 'h4';
export type SpaceScale = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

const spaceStyles: Record<SpaceScale, string> = {
    0: 'gap-0',
    1: 'gap-[var(--lb-space-1)]',
    2: 'gap-[var(--lb-space-2)]',
    3: 'gap-[var(--lb-space-3)]',
    4: 'gap-[var(--lb-space-4)]',
    5: 'gap-[var(--lb-space-5)]',
    6: 'gap-[var(--lb-space-6)]',
    7: 'gap-[var(--lb-space-7)]',
    8: 'gap-[var(--lb-space-8)]',
};

const paddingStyles: Record<SpaceScale, string> = {
    0: 'p-0',
    1: 'p-[var(--lb-space-1)]',
    2: 'p-[var(--lb-space-2)]',
    3: 'p-[var(--lb-space-3)]',
    4: 'p-[var(--lb-space-4)]',
    5: 'p-[var(--lb-space-5)]',
    6: 'p-[var(--lb-space-6)]',
    7: 'p-[var(--lb-space-7)]',
    8: 'p-[var(--lb-space-8)]',
};

const paddingBlockStyles: Record<SpaceScale, string> = {
    0: 'py-0',
    1: 'py-[var(--lb-space-1)]',
    2: 'py-[var(--lb-space-2)]',
    3: 'py-[var(--lb-space-3)]',
    4: 'py-[var(--lb-space-4)]',
    5: 'py-[var(--lb-space-5)]',
    6: 'py-[var(--lb-space-6)]',
    7: 'py-[var(--lb-space-7)]',
    8: 'py-[var(--lb-space-8)]',
};

const paddingInlineStyles: Record<SpaceScale, string> = {
    0: 'px-0',
    1: 'px-[var(--lb-space-1)]',
    2: 'px-[var(--lb-space-2)]',
    3: 'px-[var(--lb-space-3)]',
    4: 'px-[var(--lb-space-4)]',
    5: 'px-[var(--lb-space-5)]',
    6: 'px-[var(--lb-space-6)]',
    7: 'px-[var(--lb-space-7)]',
    8: 'px-[var(--lb-space-8)]',
};

const stackAlignStyles = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
} as const;

const stackJustifyStyles = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
} as const;

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
    as?: LayoutElement;
    children: React.ReactNode;
    padding?: SpaceScale;
    paddingBlock?: SpaceScale;
    paddingInline?: SpaceScale;
    tone?: 'default' | 'subdued' | 'raised' | 'info' | 'success' | 'warning' | 'critical';
    border?: boolean;
    radius?: 'none' | 'sm' | 'md' | 'lg';
    shadow?: 'none' | 'sm' | 'md' | 'lg';
}

const boxToneStyles: Record<NonNullable<BoxProps['tone']>, string> = {
    default: 'bg-transparent text-[color:var(--lb-color-text)]',
    subdued: 'bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text)]',
    raised: 'bg-[var(--lb-color-surface-raised)] text-[color:var(--lb-color-text)]',
    info: 'bg-[var(--lb-color-info-soft)] text-[color:var(--lb-color-text)]',
    success: 'bg-[var(--lb-color-success-soft)] text-[color:var(--lb-color-text)]',
    warning: 'bg-[var(--lb-color-warning-soft)] text-[color:var(--lb-color-text)]',
    critical: 'bg-[var(--lb-color-critical-soft)] text-[color:var(--lb-color-text)]',
};

const boxRadiusStyles: Record<NonNullable<BoxProps['radius']>, string> = {
    none: 'rounded-none',
    sm: 'rounded-[var(--lb-radius-sm)]',
    md: 'rounded-[var(--lb-radius-md)]',
    lg: 'rounded-[var(--lb-radius-lg)]',
};

const boxShadowStyles: Record<NonNullable<BoxProps['shadow']>, string> = {
    none: 'shadow-none',
    sm: 'shadow-[var(--lb-shadow-sm)]',
    md: 'shadow-[var(--lb-shadow-md)]',
    lg: 'shadow-[var(--lb-shadow-lg)]',
};

export function Box({
    as: Element = 'div',
    children,
    padding,
    paddingBlock,
    paddingInline,
    tone = 'default',
    border = false,
    radius = 'none',
    shadow = 'none',
    className = '',
    ...props
}: BoxProps) {
    return React.createElement(
        Element,
        {
            className: cx(
                padding && paddingStyles[padding],
                paddingBlock && paddingBlockStyles[paddingBlock],
                paddingInline && paddingInlineStyles[paddingInline],
                boxToneStyles[tone],
                border && 'border border-[var(--lb-color-border)]',
                boxRadiusStyles[radius],
                boxShadowStyles[shadow],
                className,
            ),
            ...props,
        },
        children,
    );
}

export interface BlockStackProps extends React.HTMLAttributes<HTMLElement> {
    as?: LayoutElement;
    children: React.ReactNode;
    gap?: SpaceScale;
    align?: keyof typeof stackAlignStyles;
    justify?: keyof typeof stackJustifyStyles;
}

export function BlockStack({
    as: Element = 'div',
    children,
    gap = '4',
    align = 'stretch',
    justify = 'start',
    className = '',
    ...props
}: BlockStackProps) {
    return React.createElement(
        Element,
        {
            className: cx('flex min-w-0 flex-col', spaceStyles[gap], stackAlignStyles[align], stackJustifyStyles[justify], className),
            ...props,
        },
        children,
    );
}

export interface InlineStackProps extends React.HTMLAttributes<HTMLElement> {
    as?: LayoutElement;
    children: React.ReactNode;
    gap?: SpaceScale;
    align?: keyof typeof stackAlignStyles;
    justify?: keyof typeof stackJustifyStyles;
    wrap?: boolean;
}

export function InlineStack({
    as: Element = 'div',
    children,
    gap = '3',
    align = 'center',
    justify = 'start',
    wrap = true,
    className = '',
    ...props
}: InlineStackProps) {
    return React.createElement(
        Element,
        {
            className: cx('flex min-w-0', wrap ? 'flex-wrap' : 'flex-nowrap', spaceStyles[gap], stackAlignStyles[align], stackJustifyStyles[justify], className),
            ...props,
        },
        children,
    );
}

type GridColumnCount = 1 | 2 | 3 | 4 | 5 | 6;
type ResponsiveColumns = Partial<Record<'base' | 'sm' | 'md' | 'lg' | 'xl', GridColumnCount>>;

const gridColumnStyles: Record<GridColumnCount, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
};

const responsiveGridColumnStyles = {
    sm: {
        1: 'sm:grid-cols-1',
        2: 'sm:grid-cols-2',
        3: 'sm:grid-cols-3',
        4: 'sm:grid-cols-4',
        5: 'sm:grid-cols-5',
        6: 'sm:grid-cols-6',
    },
    md: {
        1: 'md:grid-cols-1',
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
        5: 'md:grid-cols-5',
        6: 'md:grid-cols-6',
    },
    lg: {
        1: 'lg:grid-cols-1',
        2: 'lg:grid-cols-2',
        3: 'lg:grid-cols-3',
        4: 'lg:grid-cols-4',
        5: 'lg:grid-cols-5',
        6: 'lg:grid-cols-6',
    },
    xl: {
        1: 'xl:grid-cols-1',
        2: 'xl:grid-cols-2',
        3: 'xl:grid-cols-3',
        4: 'xl:grid-cols-4',
        5: 'xl:grid-cols-5',
        6: 'xl:grid-cols-6',
    },
} as const;

function gridColumnsClass(columns: GridColumnCount | ResponsiveColumns) {
    if (typeof columns === 'number') return gridColumnStyles[columns];
    return cx(
        gridColumnStyles[columns.base ?? 1],
        columns.sm && responsiveGridColumnStyles.sm[columns.sm],
        columns.md && responsiveGridColumnStyles.md[columns.md],
        columns.lg && responsiveGridColumnStyles.lg[columns.lg],
        columns.xl && responsiveGridColumnStyles.xl[columns.xl],
    );
}

export interface GridProps extends React.HTMLAttributes<HTMLElement> {
    as?: LayoutElement;
    children: React.ReactNode;
    columns?: GridColumnCount | ResponsiveColumns;
    gap?: SpaceScale;
    align?: 'start' | 'center' | 'end' | 'stretch';
}

const gridAlignStyles: Record<NonNullable<GridProps['align']>, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
};

export function Grid({ as: Element = 'div', children, columns = 1, gap = '4', align = 'stretch', className = '', ...props }: GridProps) {
    return React.createElement(
        Element,
        {
            className: cx('grid min-w-0', gridColumnsClass(columns), spaceStyles[gap], gridAlignStyles[align], className),
            ...props,
        },
        children,
    );
}

export interface ColumnsProps extends GridProps {}

export function Columns(props: ColumnsProps) {
    return <Grid {...props} />;
}

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
    as?: LayoutElement;
    children: React.ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl' | 'page' | 'measure' | 'full';
    paddingInline?: SpaceScale;
}

const containerWidthStyles: Record<NonNullable<ContainerProps['width']>, string> = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    page: 'max-w-[var(--lb-size-page-max)]',
    measure: 'max-w-[var(--lb-size-content-measure)]',
    full: 'max-w-none',
};

export function Container({ as: Element = 'div', children, width = 'page', paddingInline = '4', className = '', ...props }: ContainerProps) {
    return React.createElement(
        Element,
        {
            className: cx('mx-auto w-full min-w-0', containerWidthStyles[width], paddingInlineStyles[paddingInline], className),
            ...props,
        },
        children,
    );
}

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    as?: TextElement;
    children: React.ReactNode;
    variant?: 'display' | 'heading' | 'body' | 'caption' | 'subdued' | 'strong' | 'positive' | 'negative' | 'code';
    tone?: 'default' | 'subdued' | 'critical' | 'success' | 'warning' | 'info' | 'inverse' | 'positive' | 'negative';
    weight?: 'regular' | 'medium' | 'semibold';
    align?: 'start' | 'center' | 'end';
    truncate?: boolean;
    reset?: boolean;
}

const textVariantStyles: Record<NonNullable<TextProps['variant']>, string> = {
    display: 'text-[length:var(--lb-font-size-display)] leading-[var(--lb-line-height-display)]',
    heading: 'text-[length:var(--lb-font-size-heading)] leading-[var(--lb-line-height-heading)]',
    body: 'text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]',
    caption: 'text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]',
    subdued: 'text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]',
    strong: 'font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]',
    positive: 'font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-success)]',
    negative: 'font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-critical)]',
    code: 'rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-1)] py-[var(--lb-space-0)] font-mono text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text)]',
};

const textToneStyles: Record<NonNullable<TextProps['tone']>, string> = {
    default: 'text-[color:var(--lb-color-text)]',
    subdued: 'text-[color:var(--lb-color-text-subdued)]',
    critical: 'text-[color:var(--lb-color-critical)]',
    success: 'text-[color:var(--lb-color-success)]',
    warning: 'text-[color:var(--lb-color-warning)]',
    info: 'text-[color:var(--lb-color-info)]',
    inverse: 'text-[color:var(--lb-color-text-inverse)]',
    positive: 'text-[color:var(--lb-color-success)]',
    negative: 'text-[color:var(--lb-color-critical)]',
};

const textWeightStyles: Record<NonNullable<TextProps['weight']>, string> = {
    regular: 'font-[var(--lb-font-weight-regular)]',
    medium: 'font-[var(--lb-font-weight-medium)]',
    semibold: 'font-[var(--lb-font-weight-semibold)]',
};

const textAlignStyles: Record<NonNullable<TextProps['align']>, string> = {
    start: 'text-left',
    center: 'text-center',
    end: 'text-right',
};

export function Text({
    as,
    children,
    variant = 'body',
    tone,
    weight,
    align,
    truncate = false,
    reset = true,
    className = '',
    ...props
}: TextProps) {
    const textStyleVariant = variant === 'subdued' || variant === 'strong' || variant === 'positive' || variant === 'negative' || variant === 'code';
    const Element = as ?? (variant === 'code' ? 'code' : 'p');
    const effectiveTone = tone ?? (reset && !textStyleVariant ? 'default' : undefined);
    const effectiveWeight = weight ?? (reset && !textStyleVariant ? 'regular' : undefined);
    const effectiveAlign = align ?? (reset ? 'start' : undefined);

    return React.createElement(
        Element,
        {
            className: cx(
                reset && 'm-0 min-w-0',
                textVariantStyles[variant],
                effectiveTone && textToneStyles[effectiveTone],
                effectiveWeight && textWeightStyles[effectiveWeight],
                effectiveAlign && textAlignStyles[effectiveAlign],
                truncate && 'truncate',
                className,
            ),
            ...props,
        },
        children,
    );
}

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

/**
 * @deprecated since 0.0.2. Use `Page` instead. This alias remains for backward compatibility.
 */
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

/**
 * @deprecated since 0.0.2. Use `PageHeaderActions` instead. This alias remains for backward compatibility.
 */
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
                <Button key={action.label} unstyled as="a" className={buttonClassName} href={action.href} disabled={action.disabled}>
                    {content}
                </Button>
            );
        }

        return (
            <Button key={action.label} unstyled className={buttonClassName} type="button" onClick={action.onClick} disabled={action.disabled}>
                {content}
            </Button>
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
                <Breadcrumbs items={breadcrumbs} separator="slash" currentTone="inherit" />
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
                            <p className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-primary-text)]">
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
