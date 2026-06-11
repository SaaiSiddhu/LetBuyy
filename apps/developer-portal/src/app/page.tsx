import Link from "next/link";
import { Badge } from "@letbuyy/ui";
import { CodePanel, ContractStat, HighlightGrid, PortalLayout, SectionHeading, SourceBadgeList } from "@/components/PortalChrome";
import { appInstallExample, sourceFiles } from "@/lib/reference";

export default function HomePage() {
  return (
    <PortalLayout>
      <section className="developer-hero">
        <div className="developer-hero-grid">
          <div className="developer-band">
            <span className="developer-kicker">developers.letbuyy.com</span>
            <h1 className="developer-title">Review LetBuyy platform contracts.</h1>
            <p className="developer-lede">
              The developer portal is a docs-first workbench for the current `/v1` gateway, app OAuth seams, lifecycle webhooks, Liquid plus JSON-contract themes, recorded GraphQL/extension seams, and partner dashboard contracts.
            </p>
            <div className="developer-actions">
              <Link className="developer-action primary" href="/api">Read API reference</Link>
              <Link className="developer-action" href="/sdk">Review SDK contracts</Link>
            </div>
          </div>
          <CodePanel label="App OAuth install request" code={appInstallExample} />
        </div>
      </section>

      <HighlightGrid />

      <section className="developer-band">
        <SectionHeading
          kicker="Contract status"
          title="Truth source, not aspirational docs"
          description="Every page in this portal is backed by the tracked gateway, webhook service, auth-core, app-platform shared contract, or theme-engine source. Missing data and tooling are visible as skips."
        />
        <div className="developer-grid three">
          <ContractStat label="Gateway" value="/v1 Hono API" />
          <ContractStat label="OAuth" value="Authorization code + token exchange" />
          <ContractStat label="Webhooks" value="HMAC signed app lifecycle events" />
        </div>
        <SourceBadgeList files={sourceFiles} />
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Build path"
          title="Ship against stable contracts first"
          description="The active path is marketplace app registration, scoped install OAuth, lifecycle webhooks, theme package upload, and dashboard visibility. SDK and backend gaps are marked before they surprise a partner."
        />
        <div className="developer-grid two">
          <article className="developer-card">
            <div className="developer-icon-line">
              <Badge label="Live contract" variant="success" />
              <h3>App installation</h3>
            </div>
            <p>Authorize a published marketplace app, persist an active installation, mint a short-lived authorization code, then exchange it for a scoped app access token.</p>
          </article>
          <article className="developer-card">
            <div className="developer-icon-line">
              <Badge label="Live contract" variant="success" />
              <h3>Storefront GraphQL cart</h3>
            </div>
            <p>Storefront GraphQL `cart` reads use a persisted cart token backed by the storefront cart REST contract. Cart mutations stay on REST so clients share the same server-side cart before checkout.</p>
          </article>
          <article className="developer-card">
            <div className="developer-icon-line">
              <Badge label="SKIP - NEEDS SDK/CLI" variant="warning" />
              <h3>Local generator CLI</h3>
            </div>
            <p>No active `@letbuyy/cli`, app SDK package, theme CLI, or `create-letbuyy` package exists yet. The portal documents the contract and keeps CLI commands planned.</p>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
