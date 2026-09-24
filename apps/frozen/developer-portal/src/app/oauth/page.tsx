import {
  Card,
  KeyRound,
  Page,
  Section
} from "@letbuyy/ui";
import {
  AppBridgeFetchRuleMatrix,
  ExampleCards,
  FactList,
  OAuthTokenLifecycleMatrix,
  OAuthScopeMatrix
} from "@/components/_local-ui/developer-docs";
import {
  appBridgeFetchRules,
  contractCards,
  oauthExamples,
  oauthScopeMatrix,
  oauthSteps,
  oauthTokenLifecycle,
  realScopes
} from "@/lib/developer-surface";
import { DocsShell } from "@/components/PortalShell";

const oauthContracts = contractCards.filter((contract) =>
  contract.title === "OAuth and app token lifetimes"
  || contract.title === "App bridge fetch limits"
);

export default function OAuthPage() {
  return (
    <DocsShell>
      <Page className="developer-main">
        <section className="docs-page-hero">
          <div>
            <KeyRound size={24} aria-hidden="true" />
            <h1>OAuth and app bridge</h1>
            <p>
              Auth-code install, token exchange, embedded bridge tokens, known scopes,
              and current GET-only bridge limits from the real app-store route.
            </p>
          </div>
        </section>

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
            <Section title="Known Scopes" description="Scopes currently visible from the app platform surface.">
              <div className="scope-cloud" aria-label="Known scopes">
                {realScopes.map((scope) => (
                  <code key={scope}>{scope}</code>
                ))}
              </div>
            </Section>
          </Card>
        </div>

        <Card className="docs-card">
          <Section title="Token Lifecycle Matrix" description="Current code, bearer token, embedded session, and bridge token behavior from the app-store route.">
            <OAuthTokenLifecycleMatrix tokens={oauthTokenLifecycle} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Scope Matrix" description="Real install/OAuth scopes and the bridge paths they currently unlock. Write-capable bridge behavior remains skipped.">
            <OAuthScopeMatrix scopes={oauthScopeMatrix} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="App Bridge Fetch Rules" description="Current GET-only proxy rules, path normalization, store binding, and response shape.">
            <AppBridgeFetchRuleMatrix rules={appBridgeFetchRules} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Source-backed Examples" description="Accepted request keys and response envelopes from the current app-store route.">
            <ExampleCards examples={oauthExamples} />
          </Section>
        </Card>

        <div className="docs-grid docs-grid--two">
          <Card className="docs-card">
            <Section title="Token Request" description="Auth-code exchange shape documented from route validation logic.">
              <pre className="code-sample"><code>{`POST /v1/app-store/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "app_authorization_code",
  "client_id": "marketplace_app_client_id",
  "redirect_uri": "https://partner.example/oauth/callback"
}`}</code></pre>
            </Section>
          </Card>
          <Card className="docs-card">
            <Section title="Bridge Fetch Request" description="Current app bridge only proxies scoped GET reads.">
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

        <Card className="docs-card">
          <Section title="Implemented Limits" description="OAuth and bridge facts from source.">
            {oauthContracts.map((contract) => (
              <article className="contract-card contract-card--stacked" key={contract.title}>
                <div className="contract-card__header">
                  <div>
                    <h3>{contract.title}</h3>
                    <span className="source-ref">{contract.source}</span>
                  </div>
                </div>
                <FactList facts={contract.points} />
              </article>
            ))}
          </Section>
        </Card>
      </Page>
    </DocsShell>
  );
}
