"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button, ChevronRight, Input, Menu, Search, ThemeToggleButton, X } from "@letbuyy/ui";
import {
  footerGroups,
  portalSections,
  resolveSection,
  utilityLinks,
  type NavLink,
} from "@/lib/navigation";

function isActive(pathname: string, href: string) {
  return pathname === href;
}

/* ------------------------------------------------------------------ masthead */

function BrandLock() {
  return (
    <Link href="/" className="dp-brand" aria-label="LetBuyy Developers home">
      <Image
        src="/icons/letbuyy-mark.svg"
        alt=""
        width={28}
        height={28}
        className="dp-brand-mark"
        priority
      />
      <span className="dp-brand-text">
        <strong>dev</strong> docs
      </span>
    </Link>
  );
}

export function PortalMasthead() {
  const pathname = usePathname();
  const active = resolveSection(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Closing on link click rather than in an effect keyed to the pathname: the
  // effect version fires a second render on every navigation, including the
  // ones where the drawer was never open.
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const headerRef = useRef<HTMLElement>(null);

  /*
   * The drawer is a fixed panel anchored under the masthead, and it needs the
   * masthead's real height to know where to start. It previously sat in normal
   * flow inside the sticky <header> with `max-height: 100dvh - 56px`, which is
   * taller than the masthead actually is (row + section bar), so on a phone the
   * panel ran past the bottom of the screen and its own scroll container never
   * engaged — the lower nav items were simply unreachable.
   */
  useEffect(() => {
    if (!drawerOpen) return;
    const header = headerRef.current;
    if (!header) return;
    const measure = () => {
      const row = header.querySelector(".dp-masthead-row");
      const bar = header.querySelector(".dp-section-bar");
      const height =
        (row?.getBoundingClientRect().height ?? 0) + (bar?.getBoundingClientRect().height ?? 0);
      // Set on <html>, not the header: the drawer is a sibling of the header,
      // so a custom property scoped to the header would never reach it.
      document.documentElement.style.setProperty("--dp-masthead-h", `${Math.round(height)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [drawerOpen]);

  // Lock body scroll only while the drawer owns the screen.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // The drawer is mobile-only chrome. Without this, rotating a phone to
  // landscape (or resizing past 1024px) leaves it mounted with the body scroll
  // lock still applied, and the page can no longer be scrolled.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <header className="dp-masthead" ref={headerRef}>
      <div className="dp-masthead-row">
        <div className="dp-masthead-lead">
          {/* `unstyled` is the documented escape hatch: it keeps this element a
              real @letbuyy/ui Button (tokens, focus, a11y defaults) while the
              shell keeps ownership of the 40px icon-button layout. */}
          <Button
            unstyled
            type="button"
            className="dp-icon-button dp-mobile-only"
            aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
          <BrandLock />
        </div>

        <nav className="dp-primary-nav dp-desktop-only" aria-label="Documentation sections">
          {portalSections.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className="dp-primary-link"
              aria-current={section.key === active.key ? "page" : undefined}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="dp-masthead-trail">
          {utilityLinks.map((link) => (
            <Link key={link.href} href={link.href} className="dp-trail-link dp-desktop-only">
              {link.label}
            </Link>
          ))}
          <ThemeToggleButton label="Toggle developer theme" />
        </div>
      </div>

      <div className="dp-section-bar">
        <div className="dp-section-bar-inner">
          <span className="dp-section-label">{active.label}</span>
          <span className="dp-section-divider" aria-hidden="true" />
          <nav className="dp-section-tabs" aria-label={`${active.label} pages`}>
            {active.tabs.map((tab) => (
              <Link
                key={`${tab.href}-${tab.label}`}
                href={tab.href}
                className="dp-section-tab"
                aria-current={isActive(pathname, tab.href) ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      </header>

      {/* Outside <header> on purpose: the masthead sets `backdrop-filter`, which
          makes it a containing block for fixed-position descendants. Nested, the
          drawer measured itself against the 101px masthead instead of the
          viewport and collapsed to a 56px scroll window. */}
      {drawerOpen ? (
        <div className="dp-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
          <nav className="dp-drawer-primary" aria-label="Documentation sections">
            {portalSections.map((section) => (
              <Link
                key={section.key}
                href={section.href}
                className="dp-drawer-primary-link"
                aria-current={section.key === active.key ? "page" : undefined}
                onClick={closeDrawer}
              >
                {section.label}
                <ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <SidebarNav sectionKey={active.key} variant="drawer" onNavigate={closeDrawer} />
          <div className="dp-drawer-trail">
            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="dp-drawer-primary-link"
                onClick={closeDrawer}
              >
                {link.label}
                <ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- sidebar */

function SidebarNav({
  sectionKey,
  variant,
  onNavigate,
}: {
  sectionKey: string;
  variant: "rail" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const filterId = useId();
  const [query, setQuery] = useState("");
  const section = portalSections.find((entry) => entry.key === sectionKey) ?? portalSections[0];

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return section.sidebar;
    return section.sidebar
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            (item.description?.toLowerCase().includes(needle) ?? false),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, section]);

  const total = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);

  return (
    <div className={variant === "rail" ? "dp-rail-inner" : "dp-drawer-rail"}>
      <div className="dp-filter">
        <Search aria-hidden="true" />
        <Input
          unstyled
          id={filterId}
          type="search"
          className="dp-filter-input"
          placeholder="Filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={`Filter ${section.label} pages`}
        />
      </div>

      {/* Screen-reader feedback for a filter that changes the list below it. */}
      <p className="dp-visually-hidden" role="status">
        {query.trim()
          ? total === 1
            ? `1 page matches ${query.trim()}`
            : `${total} pages match ${query.trim()}`
          : ""}
      </p>

      {groups.length === 0 ? (
        <p className="dp-rail-empty">No pages match “{query.trim()}”.</p>
      ) : (
        groups.map((group) => (
          <div key={group.title} className="dp-rail-group">
            <p className="dp-rail-group-title">{group.title}</p>
            <ul className="dp-rail-list">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="dp-rail-link"
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

export function PortalSidebar() {
  const pathname = usePathname();
  const active = resolveSection(pathname);
  return (
    <aside className="dp-rail dp-desktop-only" aria-label={`${active.label} navigation`}>
      <SidebarNav sectionKey={active.key} variant="rail" />
    </aside>
  );
}

/* -------------------------------------------------------------------- footer */

export function PortalFooter() {
  return (
    <footer className="dp-footer">
      <div className="dp-footer-panel">
        <div className="dp-footer-top">
          <div className="dp-footer-brand">
            <BrandLock />
            <p>
              Documentation for the LetBuyy platform: the versioned <code>/v1</code> gateway, app
              OAuth, lifecycle webhooks, and JSON-contract themes. Pages state what is a live
              contract and what is still a recorded gap.
            </p>
            <span className="dp-footer-stamp">
              <span className="dp-footer-dot" aria-hidden="true" />
              Tracked to source
            </span>
          </div>
          <div className="dp-footer-columns">
            {footerGroups.map((group) => (
              <div key={group.title} className="dp-footer-column">
                <p className="dp-footer-column-title">{group.title}</p>
                <ul>
                  {group.items.map((item: NavLink) => (
                    <li key={`${group.title}-${item.label}`}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="dp-footer-baseline">
          <span>LetBuyy Developers</span>
          <span>
            Accurate to the tracked gateway, webhook-service, auth-core, app-platform shared
            contract, and theme-engine sources.
          </span>
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------------- shell */

/** Docs pages: masthead + left rail + content + footer. */
export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalMasthead />
      {/* The footer sits outside the rail/content grid so it spans the full
          viewport, and so the rail's divider runs all the way to it. */}
      <div className="dp-docs-body">
        <PortalSidebar />
        <main className="dp-docs-main" id="main-content">
          <div className="dp-docs-content">{children}</div>
        </main>
      </div>
      <PortalFooter />
    </>
  );
}

/** Landing pages: masthead + full-bleed content + footer, no rail. */
export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalMasthead />
      <main className="dp-landing-main" id="main-content">
        {children}
      </main>
      <PortalFooter />
    </>
  );
}
