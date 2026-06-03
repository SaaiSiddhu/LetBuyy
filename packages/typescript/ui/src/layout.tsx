import React from 'react';
import { cx } from './utils';

type LayoutElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'nav' | 'main' | 'span';
type TextElement = 'p' | 'span' | 'div' | 'strong' | 'em' | 'h1' | 'h2' | 'h3' | 'h4';

type SpaceScale = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

const spaceStyles: Record<SpaceScale, string> = {
    0: 'gap-0',
    1: 'gap-[var(--lb-space-1)]',
    2: 'gap-[var(--lb-space-2)]',
    3: 'gap-[var(--lb-space-3)]',
    4: 'gap-[var(--lb-space-4)]',
    5: 'gap-[var(--lb-space-5)]',
    6: 'gap-[var(--lb-space-6)]',
    7: 'gap-[var(--lb-space-7)]',
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

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
    as?: TextElement;
    children: React.ReactNode;
    variant?: 'display' | 'heading' | 'body' | 'caption';
    tone?: 'default' | 'subdued' | 'critical' | 'success' | 'warning' | 'info' | 'inverse';
    weight?: 'regular' | 'medium' | 'semibold';
    align?: 'start' | 'center' | 'end';
    truncate?: boolean;
}

const textVariantStyles: Record<NonNullable<TextProps['variant']>, string> = {
    display: 'text-[length:var(--lb-font-size-display)] leading-[var(--lb-line-height-display)]',
    heading: 'text-[length:var(--lb-font-size-heading)] leading-[var(--lb-line-height-heading)]',
    body: 'text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]',
    caption: 'text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]',
};

const textToneStyles: Record<NonNullable<TextProps['tone']>, string> = {
    default: 'text-[color:var(--lb-color-text)]',
    subdued: 'text-[color:var(--lb-color-text-subdued)]',
    critical: 'text-[color:var(--lb-color-critical)]',
    success: 'text-[color:var(--lb-color-success)]',
    warning: 'text-[color:var(--lb-color-warning)]',
    info: 'text-[color:var(--lb-color-info)]',
    inverse: 'text-[color:var(--lb-color-text-inverse)]',
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
    as: Element = 'p',
    children,
    variant = 'body',
    tone = 'default',
    weight = 'regular',
    align = 'start',
    truncate = false,
    className = '',
    ...props
}: TextProps) {
    return React.createElement(
        Element,
        {
            className: cx('m-0 min-w-0', textVariantStyles[variant], textToneStyles[tone], textWeightStyles[weight], textAlignStyles[align], truncate && 'truncate', className),
            ...props,
        },
        children,
    );
}

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
    orientation?: 'horizontal' | 'vertical';
    tone?: 'default' | 'subdued';
}

export function Divider({ orientation = 'horizontal', tone = 'default', className = '', ...props }: DividerProps) {
    return (
        <hr
            className={cx(
                'border-0 bg-[var(--lb-color-border)]',
                orientation === 'horizontal' ? 'h-px w-full' : 'h-auto min-h-[var(--lb-size-control-sm)] w-px self-stretch',
                tone === 'subdued' && 'opacity-60',
                className,
            )}
            aria-orientation={orientation}
            {...props}
        />
    );
}

export interface PageProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    width?: 'default' | 'narrow' | 'full';
    gap?: 'sm' | 'md' | 'lg';
}

const pageWidthStyles: Record<NonNullable<PageProps['width']>, string> = {
    default: 'max-w-[var(--lb-size-page-max)]',
    narrow: 'max-w-[960px]',
    full: 'max-w-none',
};

const pageGapStyles: Record<NonNullable<PageProps['gap']>, string> = {
    sm: 'gap-[var(--lb-space-3)]',
    md: 'gap-[var(--lb-space-5)]',
    lg: 'gap-[var(--lb-space-6)]',
};

export function Page({ children, width = 'default', gap = 'md', className = '', ...props }: PageProps) {
    return (
        <main
            className={cx(
                'mx-auto flex w-full flex-col px-[var(--lb-space-5)] py-[var(--lb-space-5)] text-[color:var(--lb-color-text)]',
                pageWidthStyles[width],
                pageGapStyles[gap],
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
    ariaLabel?: string;
    target?: string;
    rel?: string;
    destructive?: boolean;
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
    title: string;
    description?: string;
    subtitle?: React.ReactNode;
    eyebrow?: string;
    breadcrumbs?: Array<{ label: string; href?: string }>;
    backAction?: PageHeaderAction;
    titleMetadata?: React.ReactNode;
    primaryAction?: PageHeaderAction;
    secondaryActions?: PageHeaderAction[];
    actionGroupLabel?: string;
    compact?: boolean;
    renderAction?: (action: PageHeaderAction, variant: 'primary' | 'secondary') => React.ReactNode;
}

export function PageHeader({
    title,
    description,
    subtitle,
    eyebrow,
    breadcrumbs = [],
    backAction,
    titleMetadata,
    primaryAction,
    secondaryActions = [],
    actionGroupLabel = 'Page actions',
    compact = false,
    renderAction,
    className = '',
    ...props
}: PageHeaderProps) {
    const renderDefaultAction = (action: PageHeaderAction, variant: 'primary' | 'secondary') => {
        const buttonClassName = cx(
            'inline-flex h-[var(--lb-size-control-md)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:pointer-events-none disabled:opacity-50',
            action.destructive
                ? 'border-[var(--lb-color-critical)] bg-[var(--lb-color-critical)] text-[color:var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-critical-hover)]'
                : variant === 'primary'
                ? 'border-[var(--lb-color-action-primary)] bg-[var(--lb-color-action-primary)] text-[color:var(--lb-color-action-primary-text)] hover:bg-[var(--lb-color-action-primary-hover)]'
                : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
        );
        const content = (
            <>
                {action.icon}
                {action.label}
            </>
        );

        if (action.href) {
            return (
                <a
                    key={action.label}
                    className={buttonClassName}
                    href={action.disabled ? undefined : action.href}
                    target={action.target}
                    rel={action.rel}
                    aria-label={action.ariaLabel}
                    aria-disabled={action.disabled}
                    tabIndex={action.disabled ? -1 : undefined}
                    onClick={(event) => {
                        if (action.disabled) {
                            event.preventDefault();
                            return;
                        }
                        action.onClick?.();
                    }}
                >
                    {content}
                </a>
            );
        }

        return (
            <button
                key={action.label}
                className={buttonClassName}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.ariaLabel}
            >
                {content}
            </button>
        );
    };

    return (
        <header className={cx('flex flex-col', compact ? 'gap-[var(--lb-space-3)]' : 'gap-[var(--lb-space-4)]', className)} {...props}>
            {(backAction || breadcrumbs.length > 0) && (
                <nav aria-label="Breadcrumb" className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        {backAction && (
                            backAction.href ? (
                                <a
                                    className="inline-flex items-center gap-[var(--lb-space-1)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    href={backAction.disabled ? undefined : backAction.href}
                                    aria-label={backAction.ariaLabel ?? backAction.label}
                                    aria-disabled={backAction.disabled}
                                    tabIndex={backAction.disabled ? -1 : undefined}
                                    onClick={(event) => {
                                        if (backAction.disabled) {
                                            event.preventDefault();
                                            return;
                                        }
                                        backAction.onClick?.();
                                    }}
                                >
                                    {backAction.icon}
                                    {backAction.label}
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-[var(--lb-space-1)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                                    onClick={backAction.onClick}
                                    disabled={backAction.disabled}
                                    aria-label={backAction.ariaLabel ?? backAction.label}
                                >
                                    {backAction.icon}
                                    {backAction.label}
                                </button>
                            )
                        )}
                        {backAction && breadcrumbs.length > 0 && <span aria-hidden="true">/</span>}
                        {breadcrumbs.length > 0 && (
                            <ol className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                {breadcrumbs.map((breadcrumb, index) => (
                                    <li key={`${breadcrumb.label}-${index}`} className="flex items-center gap-[var(--lb-space-2)]">
                                        {breadcrumb.href ? (
                                            <a className="hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]" href={breadcrumb.href}>
                                                {breadcrumb.label}
                                            </a>
                                        ) : (
                                            <span>{breadcrumb.label}</span>
                                        )}
                                        {index < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </nav>
            )}
            <div className="flex flex-col gap-[var(--lb-space-4)] md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-[var(--lb-space-1)]">
                    {eyebrow && (
                        <p className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-primary)]">
                            {eyebrow}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                        <h1 className={cx('m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]', compact ? 'text-[length:var(--lb-font-size-heading)] leading-[var(--lb-line-height-heading)]' : 'text-[length:var(--lb-font-size-display)] leading-[var(--lb-line-height-display)]')}>
                            {title}
                        </h1>
                        {titleMetadata}
                    </div>
                    {subtitle && (
                        <div className="text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                            {subtitle}
                        </div>
                    )}
                    {description && (
                        <p className="m-0 max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                            {description}
                        </p>
                    )}
                </div>
                {(primaryAction || secondaryActions.length > 0) && (
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]" role="group" aria-label={actionGroupLabel}>
                        {secondaryActions.map((action) => renderAction?.(action, 'secondary') ?? renderDefaultAction(action, 'secondary'))}
                        {primaryAction && (renderAction?.(primaryAction, 'primary') ?? renderDefaultAction(primaryAction, 'primary'))}
                    </div>
                )}
            </div>
        </header>
    );
}

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    children: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    footer?: React.ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    tone?: 'default' | 'subdued';
    headerDivider?: boolean;
    footerDivider?: boolean;
}

const cardPaddingStyles: Record<NonNullable<CardProps['padding']>, string> = {
    none: '',
    sm: 'p-[var(--lb-space-3)]',
    md: 'p-[var(--lb-space-5)]',
    lg: 'p-[var(--lb-space-6)]',
};

export function Card({
    children,
    title,
    description,
    action,
    footer,
    padding = 'none',
    tone = 'default',
    headerDivider = false,
    footerDivider = true,
    className = '',
    ...props
}: CardProps) {
    const hasHeader = Boolean(title || description || action);

    return (
        <section
            className={cx(
                'overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] shadow-[var(--lb-shadow-sm)]',
                tone === 'subdued' ? 'bg-[var(--lb-color-surface-subdued)]' : 'bg-[var(--lb-color-surface)]',
                className,
            )}
            {...props}
        >
            {hasHeader && (
                <header className={cx('flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-space-5)] md:flex-row md:items-start md:justify-between', headerDivider && 'border-b border-[var(--lb-color-border)]')}>
                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                        {title && (
                            <h2 className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {action}
                </header>
            )}
            <div className={cardPaddingStyles[padding]}>
                {children}
            </div>
            {footer && (
                <footer className={cx('p-[var(--lb-space-4)]', footerDivider && 'border-t border-[var(--lb-color-border)]')}>
                    {footer}
                </footer>
            )}
        </section>
    );
}

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
    title?: string;
    description?: string;
    action?: React.ReactNode;
    footer?: React.ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    divider?: boolean;
    subdued?: boolean;
    headingLevel?: 2 | 3 | 4;
    children: React.ReactNode;
}

const sectionPaddingStyles: Record<NonNullable<SectionProps['padding']>, string> = {
    none: 'p-0',
    sm: 'p-[var(--lb-space-3)]',
    md: 'p-[var(--lb-space-5)]',
    lg: 'p-[var(--lb-space-6)]',
};

export function Section({
    title,
    description,
    action,
    footer,
    padding = 'md',
    divider = false,
    subdued = false,
    headingLevel = 2,
    children,
    className = '',
    ...props
}: SectionProps) {
    const Heading = `h${headingLevel}` as const;

    return (
        <section
            className={cx(
                'flex flex-col gap-[var(--lb-space-4)]',
                sectionPaddingStyles[padding],
                divider && 'border-t border-[var(--lb-color-border)]',
                subdued && 'bg-[var(--lb-color-surface-subdued)]',
                className,
            )}
            {...props}
        >
            {(title || description || action) && (
                <div className="flex flex-col gap-[var(--lb-space-3)] md:flex-row md:items-start md:justify-between">
                    <div className="space-y-[var(--lb-space-1)]">
                        {title && (
                            <Heading className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                                {title}
                            </Heading>
                        )}
                        {description && (
                            <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {action}
                </div>
            )}
            {children}
            {footer && (
                <footer className="border-t border-[var(--lb-color-border)] pt-[var(--lb-space-4)]">
                    {footer}
                </footer>
            )}
        </section>
    );
}
