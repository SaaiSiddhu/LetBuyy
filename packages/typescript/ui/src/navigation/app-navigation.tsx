'use client';

/**
 * AppNavigation — the canonical, data-driven application shell.
 *
 * It composes the design-system AppFrame + Sidebar + Navigation from a `sections`
 * array and computes active state from the current route, so apps stop hand-rolling
 * sidebars (four widths, five active-state strategies — see NAVIGATION_GOVERNANCE_AUDIT.md).
 *
 * Server layouts render it directly: it reads the route via next/navigation
 * (`usePathname`) on the client and accepts server-rendered nodes for `brand`,
 * `topBar`, and `children`.
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppFrame, Navigation, Sidebar, type NavigationItem, type SidebarProps } from '../app-shell';
import { cx } from '../utils';

export interface AppNavigationSection {
    /** Optional section heading. */
    title?: React.ReactNode;
    /** Nav items; `active` is computed for you from the route. */
    items: Array<Omit<NavigationItem, 'active'>>;
}

export interface AppNavigationProps {
    sections: AppNavigationSection[];
    /** Brand/header node for the sidebar. */
    brand?: React.ReactNode;
    /** Footer node for the sidebar. */
    footer?: React.ReactNode;
    /** Top bar node for the frame header. */
    topBar?: React.ReactNode;
    children: React.ReactNode;
    /** Sidebar width on the canonical scale. */
    width?: SidebarProps['width'];
    /** Extra classes for the sidebar (e.g. responsive hiding). */
    sidebarClassName?: string;
    /** Override the detected route (defaults to usePathname()). */
    pathname?: string;
    className?: string;
}

export function isNavItemActive(pathname: string, href?: string): boolean {
    if (!href) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href.endsWith('/') ? href : `${href}/`);
}

export function AppNavigation({
    sections,
    brand,
    footer,
    topBar,
    children,
    width = 'md',
    sidebarClassName,
    pathname: pathnameProp,
    className,
}: AppNavigationProps) {
    const detected = usePathname();
    const pathname = pathnameProp ?? detected ?? '/';

    const sidebar = (
        <Sidebar header={brand} footer={footer} width={width} className={sidebarClassName}>
            {sections.map((section, index) => (
                <div key={index} className={cx(index > 0 && 'mt-[var(--lb-space-4)]')}>
                    {section.title && (
                        <div className="px-[var(--lb-space-3)] pb-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] tracking-wide text-[color:var(--lb-color-text-subdued)]">
                            {section.title}
                        </div>
                    )}
                    <Navigation
                        ariaLabel={typeof section.title === 'string' ? section.title : 'Primary navigation'}
                        items={section.items.map((item) => ({
                            ...item,
                            active: isNavItemActive(pathname, item.href),
                            children: item.children?.map((child) => ({
                                ...child,
                                active: isNavItemActive(pathname, child.href),
                            })),
                        }))}
                    />
                </div>
            ))}
        </Sidebar>
    );

    return (
        <AppFrame sidebar={sidebar} topBar={topBar} className={className}>
            {children}
        </AppFrame>
    );
}
