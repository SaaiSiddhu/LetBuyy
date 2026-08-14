'use client';

import React, { useState, useEffect, useId } from 'react';
import { cx } from './utils';

export interface NavigationChildItem {
    id: string;
    label: React.ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    /** Match this href exactly instead of by prefix. See isNavItemActive. */
    exact?: boolean;
}

export interface NavigationItem {
    id: string;
    label: React.ReactNode;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
    /** Match this href exactly instead of by prefix. See isNavItemActive. */
    exact?: boolean;
    children?: NavigationChildItem[];
}

export interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
    items: NavigationItem[];
    ariaLabel?: string;
}

const parentCls = (active: boolean, disabled?: boolean) => cx(
    // Optical tightening: -0.01em stops the medium weight from looking loose at
    // sidebar size, which is most of what separates a 2026 admin nav from a 2019 one.
    'relative flex min-h-[var(--lb-density-sidebar-row-height)] w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-left text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-sidebar)] tracking-[-0.01em] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        // Rail + hairline inset ring + tinted icon: an active row should read
        // as a place you are, not a row you happen to be hovering.
        ? 'bg-[var(--lb-component-sidebar-active-bg)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-component-sidebar-active-text)] shadow-[var(--lb-component-sidebar-active-ring)] [&_.letbuyy-icon]:text-[color:var(--lb-component-sidebar-rail-color)] before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[var(--lb-space-4)] before:w-0.5 before:-translate-y-1/2 before:rounded-[var(--lb-radius-full)] before:bg-[var(--lb-component-sidebar-rail-color)] before:content-[""]'
        // Rest labels sit at 82% of text, not the washed-out subdued ramp —
        // crisper than the old grey while staying quieter than active.
        : 'text-[color:color-mix(in_srgb,var(--lb-color-text)_82%,transparent)] [&_.letbuyy-icon]:opacity-60 hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-color-text)] hover:[&_.letbuyy-icon]:opacity-100',
    disabled && 'pointer-events-none opacity-50',
);

const childCls = (active: boolean) => cx(
    // --lb-color-text-subdued, not text-muted: muted fails AA at this size on
    // the dark sidebar (~3.6:1).
    'flex min-h-[30px] w-full items-center rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-sidebar)] leading-[var(--lb-line-height-sidebar)] tracking-[-0.01em] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        ? 'bg-[var(--lb-component-sidebar-active-bg)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-sidebar-active-text)]'
        : 'font-normal text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-color-text)]',
);

const chevronCls = (open: boolean) => cx(
    'h-3 w-3 shrink-0 opacity-45 transition-transform duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none',
    open && 'rotate-90',
);

const Chevron = ({ open }: { open: boolean }) => (
    <svg className={chevronCls(open)} viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M4.5 2.5l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

function NavItem({ item }: { item: NavigationItem }) {
    const hasChildren = (item.children?.length ?? 0) > 0;
    const anyChildActive = hasChildren && item.children!.some((c) => c.active);

    // A parent that carries its own href is a real destination, not just a
    // disclosure. Clicking the row navigates; only the chevron toggles.
    const isLinkedParent = hasChildren && !!item.href;
    const parentRouteActive = isLinkedParent && !!item.active;

    // Open when a child is active OR when we are on the parent's own route —
    // without the second term, clicking a linked parent would collapse the
    // group it just navigated into.
    const shouldBeOpen = anyChildActive || parentRouteActive;
    const [open, setOpen] = useState(shouldBeOpen);
    const submenuId = useId();

    useEffect(() => {
        if (shouldBeOpen) setOpen(true);
    }, [shouldBeOpen]);

    const isParentActive = item.active || (anyChildActive && !open);

    const leading = (
        <>
            {item.icon && (
                <span className="inline-flex shrink-0 [&_.letbuyy-icon]:h-[var(--lb-density-sidebar-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-sidebar-icon-size)]" aria-hidden="true">
                    {item.icon}
                </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </>
    );

    // One trailing slot for every row, so the chevron lands on the same x
    // whether the parent is a link or a plain disclosure.
    const content = (
        <>
            {leading}
            {hasChildren ? (
                <span className="inline-flex w-3 shrink-0 justify-end" aria-hidden="true">
                    <Chevron open={open} />
                </span>
            ) : item.badge ? (
                <span className="shrink-0 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {item.badge}
                </span>
            ) : null}
        </>
    );

    // Linked parent: sibling <a> + <button>, never nested — a button inside an
    // anchor is invalid HTML. The relative wrapper must contain ONLY the row;
    // if it also wrapped the submenu, inset-y-0 would centre the chevron across
    // the whole expanded block instead of on its own row.
    if (isLinkedParent) {
        return (
            <li>
                <div className="relative">
                    <a
                        className={parentCls(!!item.active && !anyChildActive, item.disabled)}
                        href={item.disabled ? undefined : item.href}
                        aria-current={item.active && !anyChildActive ? 'page' : undefined}
                        aria-disabled={item.disabled || undefined}
                        // Expand immediately on click so the section opens with
                        // the navigation rather than a page-load later.
                        onClick={() => setOpen(true)}
                    >
                        {leading}
                        {/* Reserves the trailing slot so the label never runs under the toggle. */}
                        <span aria-hidden="true" className="w-3 shrink-0" />
                    </a>
                    <button
                        type="button"
                        // Chevron sits flush against the row's right padding —
                        // identical to the inline slot above — while the hit
                        // area extends 44px leftwards for touch.
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-end rounded-[var(--lb-component-sidebar-item-radius)] pr-[var(--lb-space-3)] text-[color:var(--lb-color-text-subdued)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        onClick={() => setOpen((o) => !o)}
                        disabled={item.disabled}
                        aria-expanded={open}
                        aria-controls={open ? submenuId : undefined}
                        aria-label={`Toggle ${typeof item.label === 'string' ? item.label : 'section'} section`}
                    >
                        <Chevron open={open} />
                    </button>
                </div>

                {open && <NavChildren id={submenuId} items={item.children!} />}
            </li>
        );
    }

    return (
        <li>
            {item.href && !hasChildren ? (
                <a
                    className={parentCls(!!item.active, item.disabled)}
                    href={item.disabled ? undefined : item.href}
                    aria-current={item.active ? 'page' : undefined}
                    aria-disabled={item.disabled || undefined}
                >
                    {content}
                </a>
            ) : (
                <button
                    type="button"
                    className={parentCls(isParentActive, item.disabled)}
                    onClick={hasChildren ? () => setOpen((o) => !o) : item.onClick}
                    disabled={item.disabled}
                    aria-current={item.active && !hasChildren ? 'page' : undefined}
                    aria-expanded={hasChildren ? open : undefined}
                >
                    {content}
                </button>
            )}

            {hasChildren && open && <NavChildren items={item.children!} />}
        </li>
    );
}

function NavChildren({ items, id }: { items: NavigationChildItem[]; id?: string }) {
    return (
        <ul
            id={id}
            // Hairline rail down the indent, so children read as belonging to
            // the parent rather than floating at an arbitrary offset.
            className='relative m-0 mt-0.5 mb-1 list-none p-0 pl-[calc(var(--lb-space-3)+var(--lb-density-sidebar-icon-size,18px)+var(--lb-space-2))] before:pointer-events-none before:absolute before:bottom-[var(--lb-space-1)] before:left-[calc(var(--lb-space-3)+(var(--lb-density-sidebar-icon-size,18px)/2))] before:top-0 before:w-px before:-translate-x-1/2 before:bg-[var(--lb-component-sidebar-child-rail)] before:content-[""]'
        >
            {items.map((child) => (
                <li key={child.id} className="mb-px">
                    {child.href ? (
                        <a
                            className={childCls(!!child.active)}
                            href={child.disabled ? undefined : child.href}
                            aria-current={child.active ? 'page' : undefined}
                        >
                            {child.label}
                        </a>
                    ) : (
                        <button
                            type="button"
                            className={childCls(!!child.active)}
                            onClick={child.onClick}
                            aria-current={child.active ? 'page' : undefined}
                        >
                            {child.label}
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

export function Navigation({ items, ariaLabel = 'Primary navigation', className = '', ...props }: NavigationProps) {
    return (
        <nav aria-label={ariaLabel} className={cx('min-w-0', className)} {...props}>
            <ul className="m-0 grid list-none gap-0.5 p-0">
                {items.map((item) => (
                    <NavItem key={item.id} item={item} />
                ))}
            </ul>
        </nav>
    );
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    width?: 'sm' | 'md' | 'lg';
}

const sidebarWidthStyles: Record<NonNullable<SidebarProps['width']>, string> = {
    sm: 'w-[220px]',
    md: 'w-[260px]',
    lg: 'w-[320px]',
};

export function Sidebar({ children, header, footer, width = 'md', className = '', ...props }: SidebarProps) {
    return (
        <aside
            className={cx('flex min-h-0 shrink-0 flex-col border-r border-[var(--lb-component-sidebar-border)] bg-[var(--lb-component-sidebar-bg)] text-[color:var(--lb-color-text)]', sidebarWidthStyles[width], className)}
            {...props}
        >
            {header && <div className="border-b border-[var(--lb-component-sidebar-border)] p-[var(--lb-space-3)]">{header}</div>}
            <div className="min-h-0 flex-1 overflow-auto p-[var(--lb-space-2)]">{children}</div>
            {footer && <div className="border-t border-[var(--lb-component-sidebar-border)] p-[var(--lb-space-2)]">{footer}</div>}
        </aside>
    );
}

export interface AppFrameProps extends React.HTMLAttributes<HTMLDivElement> {
    sidebar?: React.ReactNode;
    topBar?: React.ReactNode;
    children: React.ReactNode;
}

export function AppFrame({ sidebar, topBar, children, className = '', ...props }: AppFrameProps) {
    return (
        <div className={cx('flex min-h-screen bg-[var(--lb-color-bg)] text-[color:var(--lb-color-text)]', className)} {...props}>
            {sidebar}
            <div className="flex min-w-0 flex-1 flex-col">
                {topBar && (
                    <header className="border-b border-[var(--lb-color-border)] bg-[var(--lb-color-header)] px-[var(--lb-density-card-padding)] py-[var(--lb-space-3)]">
                        {topBar}
                    </header>
                )}
                <main className="min-w-0 flex-1 overflow-auto">{children}</main>
            </div>
        </div>
    );
}
