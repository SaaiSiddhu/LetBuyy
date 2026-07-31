'use client';

import React, { useState, useEffect } from 'react';
import { cx } from './utils';

export interface NavigationChildItem {
    id: string;
    label: React.ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
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
    children?: NavigationChildItem[];
}

export interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
    items: NavigationItem[];
    ariaLabel?: string;
}

const parentCls = (active: boolean, disabled?: boolean) => cx(
    'flex min-h-[var(--lb-density-sidebar-row-height)] w-full items-center gap-[var(--lb-space-2)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-left text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-sidebar)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        ? 'bg-[var(--lb-component-sidebar-active-bg)] text-[color:var(--lb-component-sidebar-active-text)]'
        : 'text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-color-text)]',
    disabled && 'pointer-events-none opacity-50',
);

const childCls = (active: boolean) => cx(
    'flex min-h-[28px] w-full items-center rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-sidebar)] leading-[var(--lb-line-height-sidebar)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        ? 'bg-[var(--lb-component-sidebar-active-bg)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-sidebar-active-text)]'
        : 'font-normal text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-color-text)]',
);

function NavItem({ item }: { item: NavigationItem }) {
    const hasChildren = (item.children?.length ?? 0) > 0;
    const anyChildActive = hasChildren && item.children!.some((c) => c.active);
    const [open, setOpen] = useState(anyChildActive);

    useEffect(() => {
        if (anyChildActive) setOpen(true);
    }, [anyChildActive]);

    const isParentActive = item.active || (anyChildActive && !open);

    const content = (
        <>
            {item.icon && (
                <span className="inline-flex shrink-0 [&_.letbuyy-icon]:h-[var(--lb-density-sidebar-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-sidebar-icon-size)]" aria-hidden="true">
                    {item.icon}
                </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {hasChildren ? (
                <svg
                    className={cx('h-3 w-3 shrink-0 opacity-50 transition-transform duration-150', open && 'rotate-90')}
                    viewBox="0 0 12 12" fill="none" aria-hidden="true"
                >
                    <path d="M4.5 2.5l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : item.badge ? (
                <span className="shrink-0 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {item.badge}
                </span>
            ) : null}
        </>
    );

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

            {hasChildren && open && (
                <ul className="m-0 mt-0.5 mb-1 list-none p-0 pl-[calc(var(--lb-space-3)+var(--lb-density-sidebar-icon-size,18px)+var(--lb-space-2))]">
                    {item.children!.map((child) => (
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
            )}
        </li>
    );
}

export function Navigation({ items, ariaLabel = 'Primary navigation', className = '', ...props }: NavigationProps) {
    return (
        <nav aria-label={ariaLabel} className={cx('min-w-0', className)} {...props}>
            <ul className="m-0 grid list-none gap-px p-0">
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
