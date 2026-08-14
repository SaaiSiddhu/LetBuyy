import Link from "next/link";
import { ArrowRight, Badge, Code2, Palette, Puzzle } from "@letbuyy/ui";
import {
  CodePanel,
  ContractStat,
  HighlightGrid,
  PortalLandingLayout,
  SectionHeading,
  SourceBadgeList,
} from "@/components/PortalChrome";
import { appInstallExample, apiRouteGroups, sourceFiles } from "@/lib/reference";

/**
 * The three pillars mirror the tier-1 nav in `lib/navigation.ts`. Counts are
 * derived from the tracked route groups rather than typed in, so they cannot
 * drift away from what the gateway actually mounts.
 */
const liveGroups = apiRouteGroups.filter((group) => group.status === "Live").length;
const totalRoutes = apiRouteGroups.reduce((sum, group) => sum + group.routes.length, 0);

const pillars = [
  {
    icon: Puzzle,
    title: "Apps",
    href: "/docs",
    body: "Authorize a marketplace app with authorization-code OAuth and PKCE, hold a scoped access token, and receive HMAC-signed lifecycle webhooks.",
    cta: "Build your first app",
  },
  {
    icon: Palette,
    title: "Themes",
    href: "/sdk",
    body: "Ship a JSON-contract theme bundle with grouped settings, per-template editor drafts, and Liquid sections rendered by the tracked theme engine.",
    cta: "Build a theme",
  },
  {
    icon: Code2,
    title: "APIs",
    href: "/api",
    body: `Read the curated /v1 gateway surface — ${apiRouteGroups.length} route groups across commerce, storefront, themes, apps, and operations, with query-cost rate limits.`,
    cta: "Read the API reference",
  },
];

export default function HomePage() {
  return (
    <PortalLandingLayout>
      <section className="dp-hero">
        <div className="dp-shell-container dp-hero-grid">
          <div className="dp-hero-copy">
            <span className="developer-kicker">developers.letbuyy.com</span>
            <h1 className="developer-title">Build on LetBuyy.</h1>
            <p className="developer-lede">
              A docs-first workbench for the platform as it exists today: the versioned{" "}
              <code>/v1</code> gateway, app OAuth and app bridge, lifecycle webhooks, and JSON
              contract themes. Every page states whether a surface is a live contract or a recorded
              gap.
            </p>
            <div className="developer-actions">
              <Link className="developer-action primary" href="/docs">
                Start with apps <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="developer-action" href="/api-reference">
                Browse the API reference
              </Link>
            </div>
          </div>
          <CodePanel label="App OAuth install request" code={appInstallExample} />
        </div>
      </section>

      <div className="dp-shell-container dp-landing-stack">
        <section className="dp-pillars" aria-label="Start building">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Link key={pillar.href} href={pillar.href} className="dp-pillar">
                <span className="dp-pillar-icon">
                  <Icon aria-hidden="true" />
                </span>
                <h2>{pillar.title}</h2>
                <p>{pillar.body}</p>
                <span className="dp-pillar-cta">
                  {pillar.cta} <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </section>

        <section className="developer-band">
          <SectionHeading
            kicker="Get started"
            title="Ship against stable contracts first"
            description="The active path is marketplace app registration, scoped install OAuth, lifecycle webhooks, theme package upload, and dashboard visibility. SDK and backend gaps are marked before they surprise a partner."
          />
          <HighlightGrid />
        </section>

        <section className="developer-band">
          <SectionHeading
            kicker="Contract status"
            title="Truth source, not aspirational docs"
            description="Every page in this portal is backed by tracked gateway, webhook-service, auth-core, app-platform shared contract, or theme-engine source. Missing data and tooling are visible as skips."
          />
          <div className="developer-grid three">
            <ContractStat label="Gateway" value={`${apiRouteGroups.length} route groups`} />
            <ContractStat label="Live" value={`${liveGroups} groups shipping`} />
            <ContractStat label="Documented" value={`${totalRoutes} endpoints`} />
          </div>
          <SourceBadgeList files={sourceFiles} />
        </section>

        <section className="developer-band">
          <SectionHeading
            kicker="Build path"
            title="What works, and what does not"
            description="Three contracts a partner can depend on today, and the one piece of tooling that does not exist yet."
          />
          <div className="developer-grid two">
            <article className="developer-card">
              <div className="developer-icon-line">
                <Badge label="Live contract" variant="success" />
                <h3>App installation</h3>
              </div>
              <p>
                Authorize a published marketplace app, persist an active installation, mint a
                short-lived authorization code, then exchange it for a scoped app access token.
              </p>
            </article>
            <article className="developer-card">
              <div className="developer-icon-line">
                <Badge label="Live contract" variant="success" />
                <h3>Storefront GraphQL cart</h3>
              </div>
              <p>
                Storefront GraphQL <code>cart</code> reads use a persisted cart token backed by the
                storefront cart REST contract. Cart mutations stay on REST so clients share the same
                server-side cart before checkout.
              </p>
            </article>
            <article className="developer-card">
              <div className="developer-icon-line">
                <Badge label="Live contract" variant="success" />
                <h3>Signed lifecycle webhooks</h3>
              </div>
              <p>
                Deliveries are signed <code>v1=&lt;hex-hmac&gt;</code> over timestamp and raw body,
                carry event, request, and trace ids, and must target HTTPS in staging and
                production.
              </p>
            </article>
            <article className="developer-card">
              <div className="developer-icon-line">
                <Badge label="SKIP - NEEDS SDK/CLI" variant="warning" />
                <h3>Local generator CLI</h3>
              </div>
              <p>
                No active <code>@letbuyy/cli</code>, app SDK package, theme CLI, or{" "}
                <code>create-letbuyy</code> package exists yet. The portal documents the contract and
                keeps CLI commands planned.
              </p>
            </article>
          </div>
        </section>
      </div>
    </PortalLandingLayout>
  );
}
