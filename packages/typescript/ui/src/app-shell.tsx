'use client';

import React from 'react';
import { cx } from './utils';

export interface NavigationItem {
    id: string;
    label: React.ReactNode;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
}

export interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
    items: NavigationItem[];
    ariaLabel?: string;
}

export function Navigation({ items, ariaLabel = 'Primary navigation', className = '', ...props }: NavigationProps) {
    return (
        <nav aria-label={ariaLabel} className={cx('min-w-0', className)} {...props}>
            <ul className="m-0 grid list-none gap-[var(--lb-space-1)] p-0">
                {items.map((item) => {
                    const itemClassName = cx(
                        'flex min-h-[var(--lb-density-sidebar-row-height)] w-full items-center gap-[var(--lb-space-2)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-left text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-sidebar)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                        item.active
                            ? 'bg-[var(--lb-component-sidebar-active-bg)] text-[color:var(--lb-component-sidebar-active-text)]'
                            : 'text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-color-text)]',
                        item.disabled && 'pointer-events-none opacity-50',
                    );
                    const content = (
                        <>
                            {item.icon && <span className="inline-flex shrink-0 [&_.letbuyy-icon]:h-[var(--lb-density-sidebar-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-sidebar-icon-size)]" aria-hidden="true">{item.icon}</span>}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.badge && (
                                <span className="shrink-0 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {item.badge}
                                </span>
                            )}
                        </>
                    );

                    return (
                        <li key={item.id}>
                            {item.href ? (
                                <a className={itemClassName} href={item.disabled ? undefined : item.href} aria-current={item.active ? 'page' : undefined} aria-disabled={item.disabled || undefined}>
                                    {content}
                                </a>
                            ) : (
                                <button type="button" className={itemClassName} onClick={item.onClick} disabled={item.disabled} aria-current={item.active ? 'page' : undefined}>
                                    {content}
                                </button>
                            )}
                        </li>
                    );
                })}
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
            <div className="min-h-0 flex-1 overflow-auto p-[var(--lb-space-3)]">{children}</div>
            {footer && <div className="border-t border-[var(--lb-component-sidebar-border)] p-[var(--lb-space-3)]">{footer}</div>}
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
