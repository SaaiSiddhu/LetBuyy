import Link from "next/link";
import {
  Badge,
  Card,
  Code2,
  Section,
  ShieldCheck,
  Table,
  Zap,
  type StatusVariant
} from "@letbuyy/ui";
import type {
  AppBridgeFetchRuleDoc,
  AppQualityGateDoc,
  CapabilityStatus,
  ContractCard,
  DashboardSurfaceDoc,
  DocumentationExample,
  EndpointDoc,
  GatewayResponseContract,
  GatewayRouteGroup,
  OAuthTokenLifecycleDoc,
  OAuthScopeDoc,
  PaymentSafetyDoc,
  SchemaFacade,
  SdkContractRow,
  SkipItem,
  ToolingGapDoc,
  WebhookDeliveryRuleDoc,
  WebhookTopicDoc
} from "@/lib/developer-surface";

const docsNavItems = [
  { href: "/", label: "Home" },
  { href: "/api-reference", label: "API" },
  { href: "/oauth", label: "OAuth" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/sdks", label: "SDKs" },
  { href: "/dashboard", label: "Dashboard" }
];

export function DeveloperHeader({ subtitle = "Source-backed docs" }: { subtitle?: string }) {
  return (
    <header className="developer-nav">
      <Link href="/" className="developer-brand" aria-label="LetBuyy Developer Portal home">
        <span className="developer-brand-mark">LB</span>
        <span>
          <strong>LetBuyy Developers</strong>
          <small>{subtitle}</small>
        </span>
      </Link>
      <nav aria-label="Developer portal navigation">
        {docsNavItems.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function statusVariant(status: CapabilityStatus): StatusVariant {
  if (status === "available") return "success";
  if (status === "partial") return "warning";
  if (status === "planned") return "info";
  return "warning";
}

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  const label = status === "skip" ? "SKIP" : status.toUpperCase();
  return <Badge label={label} variant={statusVariant(status)} />;
}

export function FactList({ facts }: { facts: string[] }) {
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

export function EndpointTable({
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
          <Table tableClassName="endpoint-table">
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
                  <td><code>{endpoint.path}</code></td>
                  <td>{endpoint.auth}</td>
                  <td><StatusBadge status={endpoint.status} /></td>
                  <td>{endpoint.summary}</td>
                  <td><span className="source-ref">{endpoint.source}</span></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Section>
    </Card>
  );
}

export function RouteGroupMatrix({ groups }: { groups: GatewayRouteGroup[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="route-matrix">
        <thead>
          <tr>
            <th>Surface</th>
            <th>Mount</th>
            <th>Access</th>
            <th>Routes</th>
            <th>Current scope</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.mount}>
              <td><strong>{group.surface}</strong></td>
              <td><code>{group.mount}</code></td>
              <td>{group.access}</td>
              <td>{group.routeCount}</td>
              <td>{group.scope}</td>
              <td><span className="source-ref">{group.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function SchemaFacadeMatrix({ facades }: { facades: SchemaFacade[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="schema-matrix">
        <thead>
          <tr>
            <th>Facade</th>
            <th>Route surface</th>
            <th>Canonical source</th>
            <th>Current exports</th>
            <th>Portal guidance</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {facades.map((facade) => (
            <tr key={facade.module}>
              <td><strong>{facade.module}</strong></td>
              <td><code>{facade.routeSurface}</code></td>
              <td>{facade.canonicalSource}</td>
              <td>{facade.currentExports}</td>
              <td>{facade.developerMeaning}</td>
              <td><span className="source-ref">{facade.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function ResponseContractMatrix({ contracts }: { contracts: GatewayResponseContract[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="response-contract-matrix">
        <thead>
          <tr>
            <th>Response case</th>
            <th>Current shape</th>
            <th>Developer handling</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.responseCase}>
              <td><strong>{contract.responseCase}</strong></td>
              <td><code>{contract.currentShape}</code></td>
              <td>{contract.developerHandling}</td>
              <td><span className="source-ref">{contract.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function PaymentSafetyMatrix({ contracts }: { contracts: PaymentSafetyDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="payment-safety-matrix">
        <thead>
          <tr>
            <th>Surface</th>
            <th>Current contract</th>
            <th>Developer handling</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.surface}>
              <td><strong>{contract.surface}</strong></td>
              <td>{contract.currentContract}</td>
              <td>{contract.developerHandling}</td>
              <td><span className="source-ref">{contract.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function AppQualityGateMatrix({ checks }: { checks: AppQualityGateDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="app-quality-gate-matrix">
        <thead>
          <tr>
            <th>Check</th>
            <th>Current rule</th>
            <th>Evidence fields</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.check}>
              <td><strong>{check.check}</strong></td>
              <td>{check.currentRule}</td>
              <td>{check.evidenceFields}</td>
              <td><span className="source-ref">{check.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function WebhookTopicMatrix({ topics }: { topics: WebhookTopicDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="webhook-topic-matrix">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Category</th>
            <th>Delivery rule</th>
            <th>Partner action</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr key={topic.topic}>
              <td><code>{topic.topic}</code></td>
              <td><span className="category-pill">{topic.category}</span></td>
              <td>{topic.deliveryRule}</td>
              <td>{topic.partnerAction}</td>
              <td><span className="source-ref">{topic.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function WebhookDeliveryRuleMatrix({ rules }: { rules: WebhookDeliveryRuleDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="webhook-delivery-rule-matrix">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Current behavior</th>
            <th>Developer action</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.rule}>
              <td><strong>{rule.rule}</strong></td>
              <td>{rule.currentBehavior}</td>
              <td>{rule.developerAction}</td>
              <td><span className="source-ref">{rule.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function OAuthScopeMatrix({ scopes }: { scopes: OAuthScopeDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="scope-matrix">
        <thead>
          <tr>
            <th>Scope</th>
            <th>Current use</th>
            <th>Bridge access</th>
            <th>Notes</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {scopes.map((scope) => (
            <tr key={scope.scope}>
              <td><code>{scope.scope}</code></td>
              <td>{scope.currentUse}</td>
              <td>{scope.bridgeAccess}</td>
              <td>{scope.notes}</td>
              <td><span className="source-ref">{scope.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function OAuthTokenLifecycleMatrix({ tokens }: { tokens: OAuthTokenLifecycleDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="oauth-token-lifecycle-matrix">
        <thead>
          <tr>
            <th>Surface</th>
            <th>Current contract</th>
            <th>Developer action</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.surface}>
              <td><strong>{token.surface}</strong></td>
              <td>{token.currentContract}</td>
              <td>{token.developerAction}</td>
              <td><span className="source-ref">{token.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function AppBridgeFetchRuleMatrix({ rules }: { rules: AppBridgeFetchRuleDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="app-bridge-fetch-matrix">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Current contract</th>
            <th>Developer action</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.rule}>
              <td><strong>{rule.rule}</strong></td>
              <td>{rule.currentContract}</td>
              <td>{rule.developerAction}</td>
              <td><span className="source-ref">{rule.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function DashboardSurfaceMatrix({ surfaces }: { surfaces: DashboardSurfaceDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="dashboard-surface-matrix">
        <thead>
          <tr>
            <th>Surface</th>
            <th>Route</th>
            <th>Auth</th>
            <th>Status</th>
            <th>Current payload</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {surfaces.map((surface) => (
            <tr key={surface.label}>
              <td><strong>{surface.label}</strong></td>
              <td><code>{surface.route}</code></td>
              <td>{surface.auth}</td>
              <td><StatusBadge status={surface.status} /></td>
              <td>{surface.currentPayload}</td>
              <td><span className="source-ref">{surface.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function SdkContractMatrix({ rows }: { rows: SdkContractRow[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="sdk-contract-matrix">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Current shape</th>
            <th>Notes</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item}>
              <td><strong>{row.item}</strong></td>
              <td>{row.currentContract}</td>
              <td>{row.notes}</td>
              <td><span className="source-ref">{row.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function ToolingGapMatrix({ gaps }: { gaps: ToolingGapDoc[] }) {
  return (
    <div className="endpoint-table-wrap">
      <Table tableClassName="tooling-gap-matrix">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Current status</th>
            <th>Blocked until</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr key={gap.capability}>
              <td><strong>{gap.capability}</strong></td>
              <td>{gap.currentStatus}</td>
              <td>{gap.blockedUntil}</td>
              <td><span className="source-ref">{gap.source}</span></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function ContractCards({ contracts }: { contracts: ContractCard[] }) {
  return (
    <div className="contract-grid">
      {contracts.map((contract) => (
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

export function ExampleCards({ examples }: { examples: DocumentationExample[] }) {
  return (
    <div className="example-grid">
      {examples.map((example) => (
        <article className="example-card" key={example.title}>
          <div className="example-card__header">
            <Code2 size={18} aria-hidden="true" />
            <div>
              <h3>{example.title}</h3>
              <p>{example.description}</p>
              <span className="source-ref">{example.source}</span>
            </div>
          </div>
          <pre className="code-sample"><code>{example.code}</code></pre>
        </article>
      ))}
    </div>
  );
}

export function SkipLedger({ items }: { items: SkipItem[] }) {
  return (
    <div className="skip-list">
      {items.map((item) => (
        <article key={item.title}>
          <Zap size={16} aria-hidden="true" />
          <div>
            <h3>{item.title}</h3>
            <p>{item.reason}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
