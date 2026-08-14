import {
  BookOpen,
  Card,
  Code2,
  FileJson,
  Page,
  Section
} from "@letbuyy/ui";
import {
  AppQualityGateMatrix,
  ContractCards,
  EndpointTable,
  FactList,
  PaymentSafetyMatrix,
  ResponseContractMatrix,
  RouteGroupMatrix,
  SchemaFacadeMatrix
} from "@/components/_local-ui/developer-docs";
import {
  appQualityGateChecks,
  appStoreEndpoints,
  commerceEndpoints,
  contractCards,
  gatewayFacts,
  gatewayResponseContracts,
  gatewayRouteGroups,
  paymentSafetyContracts,
  schemaFacades,
  storefrontEndpoints,
  themeEndpoints,
  webhookEndpoints
} from "@/lib/developer-surface";
import { DocsShell } from "@/components/PortalShell";

export default function ApiReferencePage() {
  return (
    <DocsShell>
      <Page className="developer-main">
        <section className="docs-page-hero">
          <div>
            <BookOpen size={24} aria-hidden="true" />
            <h1>API reference</h1>
            <p>
              Current source-backed gateway, commerce, app marketplace, theme package, and webhook surfaces.
              Missing OpenAPI generation remains explicitly skipped.
            </p>
          </div>
        </section>

        <Card className="docs-card">
          <Section title="Gateway Rules" description="Current gateway behavior from services/api-gateway/src/index.ts.">
            <FactList facts={gatewayFacts} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Gateway Response Contracts" description="Common success, pagination, error, and correlation header behavior from the current gateway helpers.">
            <ResponseContractMatrix contracts={gatewayResponseContracts} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Gateway Route Groups" description="Mounted /v1 route groups and Hono route counts from the current worker source. Counts are router declarations, not generated OpenAPI operations.">
            <RouteGroupMatrix groups={gatewayRouteGroups} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Schema Facades" description="Gateway schema modules and their canonical package sources. These are source exports, not generated OpenAPI definitions.">
            <SchemaFacadeMatrix facades={schemaFacades} />
          </Section>
        </Card>

        <EndpointTable
          title="Commerce Endpoint Highlights"
          description="Protected merchant-session commerce, inventory, customer, order, and payment routes."
          endpoints={commerceEndpoints}
        />
        <EndpointTable
          title="Storefront Endpoint Highlights"
          description="Public storefront lookup, catalog, checkout, payment, content, and review routes."
          endpoints={storefrontEndpoints}
        />

        <Card className="docs-card">
          <Section title="Payment and Idempotency Contracts" description="Implemented order, payment, amount verification, provider verification, and retry behavior from the current gateway.">
            <PaymentSafetyMatrix contracts={paymentSafetyContracts} />
          </Section>
        </Card>

        <EndpointTable
          title="App Platform Endpoints"
          description="Marketplace, install, OAuth, app bridge, developer, and dashboard routes."
          endpoints={appStoreEndpoints}
        />
        <EndpointTable
          title="Theme Platform Endpoints"
          description="Theme catalog, editor, package upload, preview, and install routes."
          endpoints={themeEndpoints}
        />
        <EndpointTable
          title="Webhook Service Endpoints"
          description="Developer-facing callback contract plus internal dispatch routes."
          endpoints={webhookEndpoints}
        />

        <section id="contracts" className="anchor-section">
          <div className="section-kicker">
            <FileJson size={18} aria-hidden="true" />
            Validation Contracts
          </div>
          <Card className="docs-card">
            <Section title="Request Shape Notes" description="Route helper and package schema facts that are currently implemented.">
              <ContractCards contracts={contractCards} />
            </Section>
          </Card>
          <Card className="docs-card">
            <Section title="App Submission Quality Gate" description="Built-for-LetBuyy evidence rules, draft behavior, and review-record automation from the current app engine and gateway route.">
              <AppQualityGateMatrix checks={appQualityGateChecks} />
            </Section>
          </Card>
        </section>

        <footer className="developer-footer">
          <span>OpenAPI export is not present in this branch.</span>
          <a href="/oauth">
            <Code2 size={14} aria-hidden="true" />
            OAuth docs
          </a>
        </footer>
      </Page>
    </DocsShell>
  );
}
