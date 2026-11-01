'use client';

import React, { useState, useEffect, useId, useRef } from 'react';
import { cx } from './utils';

/** Shortest thumb we will draw, in px, so it stays legible on a long list. */
const MIN_SCROLL_THUMB_PX = 24;

export interface ScrollThumbProps {
    /** The scrollable element this thumb reports on. */
    scrollRef: React.RefObject<HTMLElement | null>;
    /** Override the default rail-tuned appearance. */
    className?: string;
}

/**
 * An always-visible scroll indicator for a scrollable region.
 *
 * Native scrollbars — even styled ones — fade out on idle in macOS
 * Safari/Chrome. That is an OS-level overlay-scrollbar behaviour no CSS
 * property can opt out of, so a nav rail styled with `::-webkit-scrollbar`
 * appears to have no scrollbar until you actually scroll. This draws the thumb
 * as an ordinary positioned node instead, which has no idle-fade behaviour.
 *
 * Geometry is written straight to the DOM rather than through React state: a
 * scroll handler that setState()s would re-render on every frame of every
 * scroll, and these values are pure layout output nothing else reads.
 *
 * Requires a `position: relative` parent (Sidebar supplies one).
 */
export function ScrollThumb({ scrollRef, className }: ScrollThumbProps) {
    const thumbRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollRef.current;
        const thumb = thumbRef.current;
        if (!el || !thumb) return;

        function update() {
            const scroller = el!;
            const node = thumb!;
            const { scrollTop, scrollHeight, clientHeight } = scroller;
            if (scrollHeight <= clientHeight + 1) {
                node.hidden = true;
                return;
            }
            node.hidden = false;
            const height = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_SCROLL_THUMB_PX);
            const scrollable = scrollHeight - clientHeight;
            const top = scrollable > 0 ? (scrollTop / scrollable) * (clientHeight - height) : 0;
            node.style.height = `${height}px`;
            node.style.transform = `translateY(${top}px)`;
        }

        update();
        el.addEventListener('scroll', update, { passive: true });
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(el);
        // Content height changes (expanding a nav group) without the scroller resizing.
        const mutationObserver = new MutationObserver(update);
        mutationObserver.observe(el, { childList: true, subtree: true });

        return () => {
            el.removeEventListener('scroll', update);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [scrollRef]);

    return (
        <div
            ref={thumbRef}
            hidden
            aria-hidden="true"
            className={className ?? cx(
                'pointer-events-none absolute right-0.5 top-0 w-[3px] rounded-[var(--lb-radius-full)]',
                // Keys off the sidebar text token so it is correct on the dark rail
                // in both themes, and falls back to the page ramp off-rail.
                'bg-[color-mix(in_srgb,var(--lb-component-sidebar-text,var(--lb-color-text))_40%,transparent)]',
            )}
        />
    );
}

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
    /** Host router adapter; plain anchors remain the default outside a routed app. */
    linkComponent?: React.ComponentType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
}

const parentCls = (active: boolean, disabled?: boolean) => cx(
    // Optical tightening: -0.01em stops the medium weight from looking loose at
    // sidebar size, which is most of what separates a 2026 admin nav from a 2019 one.
    'relative flex min-h-[var(--lb-density-sidebar-row-height)] w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-left text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-sidebar)] tracking-[-0.01em] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        // Rail + hairline inset ring + tinted icon: an active row should read
        // as a place you are, not a row you happen to be hovering.
        ? 'bg-[var(--lb-component-sidebar-active-bg)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-component-sidebar-active-text)] shadow-[var(--lb-component-sidebar-active-ring)] [&_.letbuyy-icon]:text-[color:var(--lb-component-sidebar-rail-color)] before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-[var(--lb-space-4)] before:w-0.5 before:-translate-y-1/2 before:rounded-[var(--lb-radius-full)] before:bg-[var(--lb-component-sidebar-rail-color)] before:content-[""]'
        // Rest labels sit at 82% of the SIDEBAR text token (which defaults to the page
        // text ramp) — so a surface running a dark rail under a light page stays legible
        // without any subtree re-pointing --lb-color-text.
        : 'text-[color:color-mix(in_srgb,var(--lb-component-sidebar-text,var(--lb-color-text))_82%,transparent)] [&_.letbuyy-icon]:opacity-60 hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-component-sidebar-text,var(--lb-color-text))] hover:[&_.letbuyy-icon]:opacity-100',
    disabled && 'pointer-events-none opacity-50',
);

const childCls = (active: boolean) => cx(
    // --lb-color-text-subdued, not text-muted: muted fails AA at this size on
    // the dark sidebar (~3.6:1).
    'flex min-h-[30px] w-full items-center rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-sidebar)] leading-[var(--lb-line-height-sidebar)] tracking-[-0.01em] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
    active
        ? 'bg-[var(--lb-component-sidebar-active-bg)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-sidebar-active-text)]'
        : 'font-normal text-[color:var(--lb-component-sidebar-text-subdued,var(--lb-color-text-subdued))] hover:bg-[var(--lb-component-sidebar-hover-bg)] hover:text-[color:var(--lb-component-sidebar-text,var(--lb-color-text))]',
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

function NavItem({ item, linkComponent }: { item: NavigationItem; linkComponent?: NavigationProps['linkComponent'] }) {
    const Link = linkComponent ?? 'a';
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
            <li data-navigation-item={item.id}>
                <div className="relative">
                    <Link
                        className={parentCls(!!item.active, item.disabled)}
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
                    </Link>
                    <button
                        type="button"
                        // Chevron sits flush against the row's right padding —
                        // identical to the inline slot above — while the hit
                        // area extends 44px leftwards for touch.
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-end rounded-[var(--lb-component-sidebar-item-radius)] pr-[var(--lb-space-3)] text-[color:var(--lb-component-sidebar-text-subdued,var(--lb-color-text-subdued))] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] motion-reduce:transition-none hover:text-[color:var(--lb-component-sidebar-text,var(--lb-color-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                        onClick={() => setOpen((o) => !o)}
                        disabled={item.disabled}
                        aria-expanded={open}
                        aria-controls={open ? submenuId : undefined}
                        aria-label={`Toggle ${typeof item.label === 'string' ? item.label : 'section'} section`}
                    >
                        <Chevron open={open} />
                    </button>
                </div>

                {open && <NavChildren id={submenuId} items={item.children!} linkComponent={linkComponent} />}
            </li>
        );
    }

    return (
        <li data-navigation-item={item.id}>
            {item.href && !hasChildren ? (
                <Link
                    className={parentCls(!!item.active, item.disabled)}
                    href={item.disabled ? undefined : item.href}
                    aria-current={item.active ? 'page' : undefined}
                    aria-disabled={item.disabled || undefined}
                >
                    {content}
                </Link>
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

            {hasChildren && open && <NavChildren items={item.children!} linkComponent={linkComponent} />}
        </li>
    );
}

function NavChildren({ items, id, linkComponent }: { items: NavigationChildItem[]; id?: string; linkComponent?: NavigationProps['linkComponent'] }) {
    const Link = linkComponent ?? 'a';
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
                        <Link
                            className={childCls(!!child.active)}
                            href={child.disabled ? undefined : child.href}
                            aria-current={child.active ? 'page' : undefined}
                            aria-disabled={child.disabled || undefined}
                        >
                            {child.label}
                        </Link>
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

export function Navigation({ items, ariaLabel = 'Primary navigation', linkComponent, className = '', ...props }: NavigationProps) {
    return (
        <nav aria-label={ariaLabel} className={cx('min-w-0', className)} {...props}>
            <ul className="m-0 grid list-none gap-0.5 p-0">
                {items.map((item) => (
                    <NavItem key={item.id} item={item} linkComponent={linkComponent} />
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
    const bodyRef = useRef<HTMLDivElement>(null);

    return (
        <aside
            className={cx('flex min-h-0 shrink-0 flex-col border-r border-[var(--lb-component-sidebar-border)] bg-[var(--lb-component-sidebar-bg)] text-[color:var(--lb-component-sidebar-text,var(--lb-color-text))]', sidebarWidthStyles[width], className)}
            {...props}
        >
            {header && <div className="border-b border-[var(--lb-component-sidebar-border)] p-[var(--lb-space-3)]">{header}</div>}
            {/* `relative` anchors the ScrollThumb; the native bar is hidden because
                it fades out on idle on macOS and reads as "no scrollbar". */}
            <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                    ref={bodyRef}
                    className="min-h-0 flex-1 overflow-auto p-[var(--lb-space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {children}
                </div>
                <ScrollThumb scrollRef={bodyRef} />
            </div>
            {footer && <div className="border-t border-[var(--lb-component-sidebar-border)] p-[var(--lb-space-2)]">{footer}</div>}
        </aside>
    );
}

export interface AppFrameProps extends React.HTMLAttributes<HTMLDivElement> {
    sidebar?: React.ReactNode;
    topBar?: React.ReactNode;
    children: React.ReactNode;
    /**
     * Fill the viewport instead of growing with the page.
     *
     * Default (`false`) is the historical behaviour: the frame is `min-h-screen`,
     * so the DOCUMENT scrolls and the content `<main>` — although it already
     * carries `overflow-auto` — never actually engages, because nothing caps its
     * height. That also makes every `position: sticky` inside a page inert.
     *
     * With `fixedViewport`, the frame is exactly one viewport tall and `<main>`
     * becomes the real scroll container. The rail, the top bar and anything the
     * app paints on the frame itself then stay put while only the page scrolls —
     * which is what lets a shell keep a rounded page top permanently visible
     * instead of having it scroll up out of view.
     *
     * Opt-in, because switching an existing surface over ACTIVATES its sticky
     * descendants for the first time and moves the scrollbar from the document
     * into the frame.
     */
    fixedViewport?: boolean;
    /** Extra classes for the scrolling content region. */
    mainClassName?: string;
    /** Extra DOM props (id, data-*, aria-*) for the scrolling content region. */
    mainProps?: React.HTMLAttributes<HTMLElement>;
}

export function AppFrame({
    sidebar,
    topBar,
    children,
    className = '',
    fixedViewport = false,
    mainClassName,
    mainProps,
    ...props
}: AppFrameProps) {
    return (
        <div
            className={cx(
                'flex bg-[var(--lb-color-bg)] text-[color:var(--lb-color-text)]',
                // dvh, not vh: on mobile the URL bar collapse would otherwise leave
                // the frame taller than the visible viewport with nothing to scroll.
                fixedViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-screen',
                className,
            )}
            {...props}
        >
            {sidebar}
            <div className="flex min-w-0 flex-1 flex-col">
                {topBar && (
                    <header className="border-b border-[var(--lb-color-border)] bg-[var(--lb-color-header)] px-[var(--lb-density-card-padding)] py-[var(--lb-space-3)]">
                        {topBar}
                    </header>
                )}
                {/* min-h-0 lets this flex child shrink below its content height —
                    without it `overflow-auto` has nothing to overflow against. */}
                <main
                    className={cx('min-w-0 flex-1 overflow-auto', fixedViewport && 'min-h-0', mainClassName)}
                    {...mainProps}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
