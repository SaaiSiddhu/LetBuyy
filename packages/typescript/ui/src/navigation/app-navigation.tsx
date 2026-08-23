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
    /** Accessible name for this section's <nav>. Defaults to `title` when it is a string. */
    ariaLabel?: string;
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
    /**
     * Extra DOM props for the sidebar <aside> — id, role, tabIndex, aria-*.
     * Do NOT pass className here; Sidebar spreads these AFTER its own className,
     * so a className in this object would clobber `sidebarClassName`.
     */
    sidebarProps?: React.HTMLAttributes<HTMLElement>;
    /** Override the detected route (defaults to usePathname()). */
    pathname?: string;
    className?: string;
    /** See AppFrameProps.fixedViewport — makes the content region the scroll container. */
    fixedViewport?: boolean;
    /** Extra classes for the scrolling content region. */
    mainClassName?: string;
    /** Extra DOM props (id, data-*, aria-*) for the scrolling content region. */
    mainProps?: React.HTMLAttributes<HTMLElement>;
}

/**
 * Active-route test. Prefix-matching by default so a section stays lit on its
 * own sub-routes.
 *
 * Pass `exact` for an item whose href is a prefix of *sibling* routes that live
 * under a different section — e.g. `/s/products` alongside `/s/products/inventory`
 * filed under Inventory. Without it both sections match and both force open.
 */
export function isNavItemActive(pathname: string, href?: string, exact?: boolean): boolean {
    if (!href) return false;
    if (href === '/') return pathname === '/';
    if (exact) return pathname === href;
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
    sidebarProps,
    pathname: pathnameProp,
    className,
    fixedViewport,
    mainClassName,
    mainProps,
}: AppNavigationProps) {
    const detected = usePathname();
    const pathname = pathnameProp ?? detected ?? '/';

    const sidebar = (
        <Sidebar header={brand} footer={footer} width={width} className={sidebarClassName} {...sidebarProps}>
            {sections.map((section, index) => (
                <div key={index} className={cx(index > 0 && 'mt-[var(--lb-space-5)]')}>
                    {section.title && (
                        // Sentence case at normal tracking. Shouty all-caps
                        // micro-labels are the fastest way to date an admin UI;
                        // the group is already separated by whitespace.
                        <div className="px-[var(--lb-space-3)] pb-[var(--lb-space-2)] pt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-component-sidebar-section-text)]">
                            {section.title}
                        </div>
                    )}
                    <Navigation
                        ariaLabel={section.ariaLabel ?? (typeof section.title === 'string' ? section.title : 'Primary navigation')}
                        items={section.items.map((item) => ({
                            ...item,
                            active: isNavItemActive(pathname, item.href, item.exact),
                            children: item.children?.map((child) => ({
                                ...child,
                                active: isNavItemActive(pathname, child.href, child.exact),
                            })),
                        }))}
                    />
                </div>
            ))}
        </Sidebar>
    );

    return (
        <AppFrame
            sidebar={sidebar}
            topBar={topBar}
            className={className}
            fixedViewport={fixedViewport}
            mainClassName={mainClassName}
            mainProps={mainProps}
        >
            {children}
        </AppFrame>
    );
}
