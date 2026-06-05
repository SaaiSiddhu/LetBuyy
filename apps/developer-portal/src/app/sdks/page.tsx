import {
  AppWindow,
  Card,
  FileJson,
  Page,
  Rocket,
  Section
} from "@letbuyy/ui";
import {
  DeveloperHeader,
  ExampleCards,
  FactList,
  SdkContractMatrix,
  SkipLedger,
  ToolingGapMatrix
} from "@/components/_local-ui/developer-docs";
import {
  appBridgeCapabilities,
  appSdkFacts,
  appSdkExamples,
  sdkToolingGaps,
  skipItems,
  themeBundleAreas,
  themeSdkExamples,
  themeSdkFacts,
  themeUploadGatewayContracts,
  themeValidationRules
} from "@/lib/developer-surface";

export default function SdksPage() {
  return (
    <>
      <DeveloperHeader subtitle="SDK quick-starts" />
      <Page className="developer-main">
        <section className="docs-page-hero">
          <div>
            <Rocket size={24} aria-hidden="true" />
            <h1>SDK quick-starts</h1>
            <p>
              Current package contracts for themes and apps. Published JavaScript SDKs,
              CLIs, scaffolds, and test tools are not present in this branch.
            </p>
          </div>
        </section>

        <div className="docs-grid docs-grid--two">
          <Card className="docs-card">
            <Section title="Theme SDK: JSON Contract" description="Real current theme package contract.">
              <FileJson size={20} aria-hidden="true" />
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
              <AppWindow size={20} aria-hidden="true" />
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

        <div className="docs-grid docs-grid--two">
          <Card className="docs-card">
            <Section title="Theme Bundle Areas" description="Portable JSON-contract bundle areas currently validated by @letbuyy/theme-engine.">
              <SdkContractMatrix rows={themeBundleAreas} />
            </Section>
          </Card>
          <Card className="docs-card">
            <Section title="App Bridge Capabilities" description="Capabilities normalized by @letbuyy/app-engine. This is not a published SDK package.">
              <SdkContractMatrix rows={appBridgeCapabilities} />
            </Section>
          </Card>
        </div>

        <Card className="docs-card">
          <Section title="Theme Validation Rules" description="Rule-level JSON-contract constraints enforced by @letbuyy/theme-engine today.">
            <SdkContractMatrix rows={themeValidationRules} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Theme Upload Gateway Contract" description="Current package upload modes, review behavior, persistence result, and install boundary.">
            <SdkContractMatrix rows={themeUploadGatewayContracts} />
          </Section>
        </Card>

        <div className="docs-grid docs-grid--two">
          <Card className="docs-card">
            <Section title="Theme Upload Examples" description="Request and response shapes from @letbuyy/theme-engine and the gateway upload route.">
              <ExampleCards examples={themeSdkExamples} />
            </Section>
          </Card>
          <Card className="docs-card">
            <Section title="App Bridge Examples" description="Current bridge request and response envelope from the app-store route.">
              <ExampleCards examples={appSdkExamples} />
            </Section>
          </Card>
        </div>

        <Card className="docs-card">
          <Section title="SDK Gaps" description="Capabilities intentionally blocked instead of described as built.">
            <ToolingGapMatrix gaps={sdkToolingGaps} />
            <SkipLedger items={skipItems} />
          </Section>
        </Card>
      </Page>
    </>
  );
}
