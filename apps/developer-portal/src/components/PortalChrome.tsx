import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Code2, LayoutDashboard, Puzzle, ShieldCheck, ThemeToggleButton } from "@letbuyy/ui";

const navItems = [
  { href: "/docs", label: "Docs" },
  { href: "/api", label: "API" },
  { href: "/sdk", label: "SDKs" },
  { href: "/dashboard", label: "Dashboard" },
];

export function PortalHeader() {
  return (
    <header className="developer-topbar">
      <div className="developer-container developer-topbar-inner">
        <Link href="/" className="developer-brand" aria-label="LetBuyy Developers home">
          <span className="developer-brand-mark">LB</span>
          <span>LetBuyy Developers</span>
        </Link>
        <nav className="developer-nav" aria-label="Developer portal navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggleButton label="Toggle developer theme" />
      </div>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="developer-footer">
      <div className="developer-container">
        Accurate to the tracked LetBuyy gateway, app-platform shared contract, theme-engine, auth-core, and webhook-service contracts. Planned or absent surfaces are marked as skips.
      </div>
    </footer>
  );
}

export function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalHeader />
      <main className="developer-container developer-main">{children}</main>
      <PortalFooter />
    </>
  );
}

export function SectionHeading({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="developer-section-heading">
      {kicker ? <span className="developer-kicker">{kicker}</span> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const className = value.includes("SKIP") ? "developer-status skip" : value.includes("Live") ? "developer-status live" : "developer-status";
  return <span className={className}>{value}</span>;
}

export function CodePanel({ label, code }: { label: string; code: string }) {
  return (
    <figure className="developer-console" aria-label={label}>
      <div className="developer-console-header">
        <span className="developer-dot" />
        <span className="developer-dot" />
        <span className="developer-dot" />
      </div>
      <pre className="developer-code">{code}</pre>
    </figure>
  );
}

export const portalHighlights = [
  {
    icon: BookOpen,
    title: "API reference",
    body: "Curated from the Hono gateway routes, schemas, auth middleware, and query-cost rate limiter.",
    href: "/api",
  },
  {
    icon: ShieldCheck,
    title: "OAuth and webhooks",
    body: "Authorization-code install, token exchange, app bridge tokens, HMAC signatures, and compliance webhook topics.",
    href: "/docs",
  },
  {
    icon: Puzzle,
    title: "Theme and app SDK starts",
    body: "JSON-contract theme bundles, app manifests, extensions, scopes, app blocks, and honest SDK/CLI gaps.",
    href: "/sdk",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard shell",
    body: "Developer apps, themes, API keys, installs, analytics, and earnings surfaced as real contracts or backend skips.",
    href: "/dashboard",
  },
];

export function HighlightGrid() {
  return (
    <section className="developer-grid four" aria-label="Developer portal highlights">
      {portalHighlights.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className="developer-card">
            <div className="developer-icon-line">
              <span className="developer-icon"><Icon aria-hidden="true" /></span>
              <h3>{item.title}</h3>
            </div>
            <p>{item.body}</p>
            <span className="developer-icon-line">
              Open <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </section>
  );
}

export function ContractStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="developer-card">
      <span className="developer-status live">{label}</span>
      <h3>{value}</h3>
    </div>
  );
}

export function SourceBadgeList({ files }: { files: string[] }) {
  return (
    <div className="developer-status-row">
      {files.map((file) => (
        <span key={file} className="developer-status">
          {file}
        </span>
      ))}
    </div>
  );
}

export function InlineCodeIcon() {
  return <Code2 aria-hidden="true" />;
}
