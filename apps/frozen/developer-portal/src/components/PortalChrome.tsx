import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Code2, LayoutDashboard, Puzzle, ShieldCheck } from "@letbuyy/ui";
import { DocsShell, LandingShell } from "@/components/PortalShell";

/**
 * Chrome now lives in `PortalShell` (masthead + section tabs + left rail +
 * footer). These re-exports keep every existing page import working while the
 * shell owns navigation, so nav is defined once in `lib/navigation.ts`.
 */
export { PortalFooter } from "@/components/PortalShell";

/** Docs pages: rail on desktop, drawer on mobile. */
export function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <DocsShell>
      <div className="developer-main">{children}</div>
    </DocsShell>
  );
}

/** The home page: full-bleed hero and grids, no rail. */
export function PortalLandingLayout({ children }: { children: ReactNode }) {
  return <LandingShell>{children}</LandingShell>;
}

/**
 * Defaults to <h2>. This used to hard-code <h1>, which put three or four h1s on
 * every page that had more than one section — a page has exactly one document
 * title. Pages that use this as their own page title pass `as="h1"`.
 */
export function SectionHeading({
  kicker,
  title,
  description,
  as: Heading = "h2",
}: {
  kicker?: string;
  title: string;
  description: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="developer-section-heading">
      {kicker ? <span className="developer-kicker">{kicker}</span> : null}
      <Heading>{title}</Heading>
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
