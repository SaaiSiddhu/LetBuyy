import Link from "next/link";
import {
  AppWindow,
  Badge,
  Card,
  CheckCircle2,
  Code2,
  Gauge,
  KeyRound,
  Link2,
  Lock,
  Page,
  RadioTower,
  Section,
  ShieldCheck,
  Zap,
  type StatusVariant
} from "@letbuyy/ui";
import {
  DashboardSurfaceMatrix
} from "@/components/_local-ui/developer-docs";
import {
  contractCards,
  dashboardShell,
  dashboardSurfaces,
  skipItems,
  type CapabilityStatus
} from "@/lib/developer-surface";

const dashboardStats = [
  {
    label: "Developer profile",
    value: "API ready",
    detail: "GET /v1/app-store/developers/me",
    icon: KeyRound
  },
  {
    label: "Submitted apps",
    value: "API ready",
    detail: "GET /v1/app-store/developers/apps",
    icon: AppWindow
  },
  {
    label: "Review records",
    value: "API ready",
    detail: "Returned with submitted apps and partner dashboard payloads.",
    icon: CheckCircle2
  },
  {
    label: "Webhook delivery UI",
    value: "Internal only",
    detail: "[SKIP — NEEDS BACKEND/SDK] Dispatch routes are not public developer tools.",
    icon: RadioTower
  }
];

const launchChecklist = [
  "Register developer profile with company_name and support_email.",
  "Submit app with name, tagline, description, category_id, app_url, and privacy URL.",
  "Configure OAuth redirect URIs before requesting auth-code exchange.",
  "Expose HTTPS webhook targets for app lifecycle plus mandatory compliance topics.",
  "Use app bridge only for scoped GET reads until write bridge support lands.",
  "Upload JSON-contract theme bundles through the existing package upload route."
];

function badgeVariant(status: string | CapabilityStatus): StatusVariant {
  const normalized = status.toLowerCase();
  if (normalized.includes("ready") || normalized === "available") return "success";
  if (normalized.includes("planned") || normalized === "planned") return "info";
  return "warning";
}

export default function DeveloperDashboardPage() {
  return (
    <>
      <header className="developer-nav">
        <Link href="/" className="developer-brand" aria-label="LetBuyy Developer Portal home">
          <span className="developer-brand-mark">LB</span>
          <span>
            <strong>LetBuyy Developers</strong>
            <small>Dashboard shell</small>
          </span>
        </Link>
        <nav aria-label="Developer dashboard navigation">
          <Link href="/">Docs</Link>
          <Link href="/#contracts">Contracts</Link>
          <Link href="/#webhooks">Webhooks</Link>
        </nav>
      </header>

      <Page className="developer-main">
        <section className="dashboard-hero">
          <div>
            <Badge label="Dashboard shell" variant="info" />
            <h1>Developer workspace</h1>
            <p>
              Static cockpit for the real developer APIs already present in the gateway.
              Live data adapters, credential management, and delivery testing remain explicitly skipped.
            </p>
          </div>
          <div className="dashboard-hero__actions">
            <Link className="developer-button developer-button--primary" href="/#api-reference">
              <Code2 size={16} aria-hidden="true" />
              API reference
            </Link>
            <Link className="developer-button developer-button--secondary" href="/#sdks">
              <Link2 size={16} aria-hidden="true" />
              SDK notes
            </Link>
          </div>
        </section>

        <section className="dashboard-metric-grid" aria-label="Dashboard API readiness">
          {dashboardStats.map((item) => {
            const Icon = item.icon;
            return (
              <Card className="dashboard-metric-card" key={item.label}>
                <Icon size={20} aria-hidden="true" />
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </div>
              </Card>
            );
          })}
        </section>

        <div className="docs-grid docs-grid--two">
          <Card className="docs-card">
            <Section title="Launch Checklist" description="Source-backed steps a developer can complete when the real backend surface is available.">
              <ul className="fact-list">
                {launchChecklist.map((item) => (
                  <li key={item}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </Card>

          <Card className="docs-card">
            <Section title="API Tiles" description="Dashboard entry points that map to existing gateway routes.">
              <div className="dashboard-list">
                {dashboardShell.map((item) => (
                  <article key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <Badge label={item.status} variant={badgeVariant(item.status)} />
                  </article>
                ))}
              </div>
            </Section>
          </Card>
        </div>

        <Card className="docs-card">
          <Section title="Dashboard API Map" description="Real gateway surfaces that a future authenticated developer dashboard adapter can call.">
            <DashboardSurfaceMatrix surfaces={dashboardSurfaces} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Contract Readiness" description="The dashboard shell mirrors the D1 contract notes instead of inventing a credential console.">
            <div className="dashboard-contract-strip">
              {contractCards.map((contract) => (
                <article key={contract.title}>
                  <Gauge size={18} aria-hidden="true" />
                  <div>
                    <strong>{contract.title}</strong>
                    <span>{contract.source}</span>
                  </div>
                  <Badge label={contract.status.toUpperCase()} variant={badgeVariant(contract.status)} />
                </article>
              ))}
            </div>
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Skipped Dashboard Controls" description="These controls are intentionally visible as blocked capabilities.">
            <div className="skip-list">
              {skipItems.slice(0, 4).map((item) => (
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

        <footer className="developer-footer">
          <span>No secrets, OAuth tokens, or merchant data are stored by this shell.</span>
          <Link href="/">
            <Lock size={14} aria-hidden="true" />
            Back to docs
          </Link>
        </footer>
      </Page>
    </>
  );
}
