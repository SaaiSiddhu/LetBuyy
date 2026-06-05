import Link from "next/link";
import {
  Badge,
  Banner,
  BookOpen,
  Card,
  Code2,
  FileJson,
  Gauge,
  GitBranch,
  KeyRound,
  Link2,
  Lock,
  Page,
  Palette,
  AppWindow,
  RadioTower,
  Rocket,
  Section,
  ShieldCheck,
  Store,
  Zap,
  type StatusVariant
} from "@letbuyy/ui";
import {
  appSdkFacts,
  appStoreEndpoints,
  contractCards,
  dashboardShell,
  evidenceSources,
  gatewayFacts,
  oauthSteps,
  realScopes,
  skipItems,
  themeEndpoints,
  themeSdkFacts,
  webhookEndpoints,
  webhookFacts,
  type CapabilityStatus,
  type EndpointDoc
} from "@/lib/developer-surface";

const navItems = [
  { href: "/api-reference", label: "API" },
  { href: "/api-reference#contracts", label: "Contracts" },
  { href: "/oauth", label: "OAuth" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/sdks", label: "SDKs" },
  { href: "/dashboard", label: "Dashboard" }
];

function statusVariant(status: CapabilityStatus): StatusVariant {
  if (status === "available") return "success";
  if (status === "partial") return "warning";
  if (status === "planned") return "info";
  return "warning";
}

function StatusBadge({ status }: { status: CapabilityStatus }) {
  const label = status === "skip" ? "SKIP" : status.toUpperCase();
  return <Badge label={label} variant={statusVariant(status)} />;
}

function EndpointTable({
  title,
  description,
  endpoints
}: {
  title: string;
  description: string;
  endpoints: EndpointDoc[];
}) {
  return (
    <Card className="docs-card">
      <Section title={title} description={description}>
        <div className="endpoint-table-wrap">
          <table className="endpoint-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Route</th>
                <th>Auth</th>
                <th>Status</th>
                <th>Current behavior</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`}>
                  <td>
                    <span className={`method-pill method-pill--${endpoint.method.toLowerCase()}`}>
                      {endpoint.method}
                    </span>
                  </td>
                  <td>
                    <code>{endpoint.path}</code>
                  </td>
                  <td>{endpoint.auth}</td>
                  <td><StatusBadge status={endpoint.status} /></td>
                  <td>{endpoint.summary}</td>
                  <td>
                    <span className="source-ref">{endpoint.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Card>
  );
}

function FactList({ facts }: { facts: string[] }) {
  return (
    <ul className="fact-list">
      {facts.map((fact) => (
        <li key={fact}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );
}

function ContractCards() {
  return (
    <div className="contract-grid">
      {contractCards.map((contract) => (
        <article className="contract-card" key={contract.title}>
          <div className="contract-card__header">
            <div>
              <h3>{contract.title}</h3>
              <span className="source-ref">{contract.source}</span>
            </div>
            <StatusBadge status={contract.status} />
          </div>
          <FactList facts={contract.points} />
        </article>
      ))}
    </div>
  );
}

export default function DeveloperPortalPage() {
  return (
    <>
      <header className="developer-nav">
        <Link href="/" className="developer-brand" aria-label="LetBuyy Developer Portal home">
          <span className="developer-brand-mark">LB</span>
          <span>
            <strong>LetBuyy Developers</strong>
            <small>Source-backed D0 portal</small>
          </span>
        </Link>
        <nav aria-label="Developer portal sections">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>

      <Page className="developer-main">
        <section className="hero-band">
          <div className="hero-copy">
            <Badge label="Wave 1 / D0" variant="info" />
            <h1><span>developers.letbuyy</span><span>.store</span></h1>
            <p>
              Developer ecosystem shell for the real LetBuyy gateway, OAuth, app webhooks,
              JSON-contract themes, app blocks, and dashboard entry points.
            </p>
            <div className="hero-actions" aria-label="Primary developer portal actions">
              <a className="developer-button developer-button--primary" href="/api-reference">
                <BookOpen size={16} aria-hidden="true" />
                Browse API reference
              </a>
              <a className="developer-button developer-button--secondary" href="/dashboard">
                <Gauge size={16} aria-hidden="true" />
                Open dashboard shell
              </a>
            </div>
          </div>
          <div className="protocol-map" aria-label="LetBuyy developer protocol map">
            <div className="protocol-node protocol-node--primary">
              <Code2 size={18} aria-hidden="true" />
              Developer app
            </div>
            <div className="protocol-rail" aria-hidden="true" />
            <div className="protocol-node">
              <KeyRound size={18} aria-hidden="true" />
              OAuth code
            </div>
            <div className="protocol-node">
              <RadioTower size={18} aria-hidden="true" />
              HMAC webhooks
            </div>
            <div className="protocol-node">
              <FileJson size={18} aria-hidden="true" />
              Theme bundle
            </div>
            <div className="protocol-node protocol-node--accent">
              <Store size={18} aria-hidden="true" />
              Store runtime
            </div>
          </div>
        </section>

        <Banner title="Source truth only" variant="warning">
          Missing APIs, SDKs, CLI tools, and live dashboard metrics are marked
          <strong> [SKIP — NEEDS BACKEND/SDK]</strong>. The requested wave mission file is absent from this branch, so the pasted WS10 goal is recorded in the local ledger as the active mission.
        </Banner>

        <section className="docs-grid docs-grid--five" aria-label="Developer surface status">
          <Card className="status-card">
            <Code2 size={20} aria-hidden="true" />
            <h2>Gateway</h2>
            <p>/v1 Hono worker with public app-store and theme surfaces.</p>
            <Badge label="AVAILABLE" variant="success" />
          </Card>
          <Card className="status-card">
            <KeyRound size={20} aria-hidden="true" />
            <h2>OAuth</h2>
            <p>Authorization code, token exchange, and bridge session tokens.</p>
            <Badge label="AVAILABLE" variant="success" />
          </Card>
          <Card className="status-card">
            <RadioTower size={20} aria-hidden="true" />
            <h2>Webhooks</h2>
            <p>Signed app lifecycle callbacks and queued delivery retries.</p>
            <Badge label="AVAILABLE" variant="success" />
          </Card>
          <Card className="status-card">
            <Palette size={20} aria-hidden="true" />
            <h2>Theme SDK</h2>
            <p>JSON-contract schemas exist; CLI tooling is not present.</p>
            <Badge label="PARTIAL" variant="warning" />
          </Card>
          <Card className="status-card">
            <AppWindow size={20} aria-hidden="true" />
            <h2>App SDK</h2>
            <p>App bridge contracts exist; packaged SDK is planned.</p>
            <Badge label="PARTIAL" variant="warning" />
          </Card>
        </section>

        <Card className="docs-card">
          <Section title="Evidence Map" description="Every D0 document claim is backed by one of these files.">
            <div className="evidence-grid">
              {evidenceSources.map((source) => (
                <div className="evidence-item" key={source.path}>
                  <GitBranch size={16} aria-hidden="true" />
                  <div>
                    <strong>{source.label}</strong>
                    <code>{source.path}</code>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </Card>

        <section id="contracts" className="anchor-section">
          <div className="section-kicker">
            <FileJson size={18} aria-hidden="true" />
            Contract Notes
          </div>
          <Card className="docs-card">
            <Section title="Real Request And Validation Contracts" description="D1 source-backed request shapes, lifetimes, and limits from route helpers and package schemas.">
              <ContractCards />
            </Section>
          </Card>
        </section>

        <section id="api-reference" className="anchor-section">
          <div className="section-kicker">
            <Code2 size={18} aria-hidden="true" />
            API Reference
          </div>
          <Card className="docs-card">
            <Section title="Gateway Rules" description="Current gateway behavior from services/api-gateway/src/index.ts.">
              <FactList facts={gatewayFacts} />
            </Section>
          </Card>
          <EndpointTable
            title="App Platform Endpoints"
            description="Current app marketplace, install, OAuth, app bridge, developer, and dashboard routes."
            endpoints={appStoreEndpoints}
          />
          <EndpointTable
            title="Theme Platform Endpoints"
            description="Current theme catalog, editor, package upload, preview, and install routes."
            endpoints={themeEndpoints}
          />
          <EndpointTable
            title="Webhook Service Endpoints"
            description="Developer-facing callback contract plus internal dispatch routes that power delivery."
            endpoints={webhookEndpoints}
          />
        </section>

        <section id="oauth" className="anchor-section">
          <div className="section-kicker">
            <KeyRound size={18} aria-hidden="true" />
            OAuth And App Bridge
          </div>
          <div className="docs-grid docs-grid--two">
            <Card className="docs-card">
              <Section title="Authorization Flow" description="Real flow implemented in app-store routes.">
                <ol className="step-list">
                  {oauthSteps.map((step) => (
                    <li key={step.title}>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                      <span className="source-ref">{step.source}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </Card>
            <Card className="docs-card">
              <Section title="Token Request" description="Auth-code exchange shape documented from the route validator logic.">
                <pre className="code-sample"><code>{`POST /v1/app-store/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "app_authorization_code",
  "client_id": "marketplace_app_client_id",
  "redirect_uri": "https://partner.example/oauth/callback"
}`}</code></pre>
                <div className="scope-cloud" aria-label="Known scopes">
                  {realScopes.map((scope) => (
                    <code key={scope}>{scope}</code>
                  ))}
                </div>
              </Section>
            </Card>
          </div>
        </section>

        <section id="webhooks" className="anchor-section">
          <div className="section-kicker">
            <RadioTower size={18} aria-hidden="true" />
            Webhooks
          </div>
          <div className="docs-grid docs-grid--two">
            <Card className="docs-card">
              <Section title="Signed Delivery Contract" description="Current outbound app webhook signature behavior.">
                <FactList facts={webhookFacts} />
              </Section>
            </Card>
            <Card className="docs-card">
              <Section title="Verification Sketch" description="Use the exact timestamp and raw request body bytes.">
                <pre className="code-sample"><code>{`const payload = \`\${timestamp}.\${rawBody}\`;
const expected = hmacSha256Hex(signingSecret, payload);
const received = hmacHeader.replace(/^v1=/, "");
const valid = timingSafeEqualHex(expected, received);`}</code></pre>
                <p className="subtle-copy">
                  LetBuyy sends <code>X-LetBuyy-Hmac-SHA256</code>, <code>X-LetBuyy-Timestamp</code>,
                  <code> X-LetBuyy-Event-ID</code>, and <code>X-LetBuyy-Event-Type</code>.
                </p>
              </Section>
            </Card>
          </div>
        </section>

        <section id="sdks" className="anchor-section">
          <div className="section-kicker">
            <Rocket size={18} aria-hidden="true" />
            SDK Quick-Starts
          </div>
          <div className="docs-grid docs-grid--two">
            <Card className="docs-card">
              <Section title="Theme SDK: JSON Contract" description="Real current theme package contract.">
                <FactList facts={themeSdkFacts} />
                <pre className="code-sample"><code>{`{
  "schema_version": "2026-05-json-contract",
  "package": { "slug": "example-theme", "version": "1.0.0" },
  "config": { "settings_schema": { "settings": {} } },
  "templates": {},
  "sections": {},
  "blocks": {},
  "locales": {},
  "renderer": { "engine": "json-contract" }
}`}</code></pre>
              </Section>
            </Card>
            <Card className="docs-card">
              <Section title="App SDK: Bridge Contract" description="Real current contracts, without pretending a package exists.">
                <FactList facts={appSdkFacts} />
                <pre className="code-sample"><code>{`POST /v1/app-store/bridge/fetch
Authorization: Bearer <app_token>

{
  "method": "GET",
  "path": "/products",
  "store_id": "site_id"
}`}</code></pre>
              </Section>
            </Card>
          </div>
        </section>

        <section id="dashboard" className="anchor-section">
          <div className="section-kicker">
            <Gauge size={18} aria-hidden="true" />
            Developer Dashboard Shell
          </div>
          <Card className="docs-card">
            <Section title="Dashboard Entry Points" description="Shell only. Live API adapter is intentionally not invented on D0.">
              <div className="dashboard-grid">
                {dashboardShell.map((item) => (
                  <div className="dashboard-tile" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <Badge label={item.status} variant={item.status.includes("ready") ? "success" : "warning"} />
                  </div>
                ))}
              </div>
            </Section>
          </Card>
        </section>

        <section className="anchor-section">
          <div className="section-kicker">
            <Lock size={18} aria-hidden="true" />
            SKIP Ledger
          </div>
          <Card className="docs-card">
            <Section title="Not Implemented Yet" description="Missing capabilities are explicitly blocked instead of described as built.">
              <div className="skip-list">
                {skipItems.map((item) => (
                  <article key={item.title}>
                    <Zap size={16} aria-hidden="true" />
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.reason}</p>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          </Card>
        </section>

        <footer className="developer-footer">
          <span>D0 shell built from real source routes and package contracts.</span>
          <a href="/api-reference">
            <Link2 size={14} aria-hidden="true" />
            Back to API
          </a>
        </footer>
      </Page>
    </>
  );
}
