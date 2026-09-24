import {
  Card,
  Page,
  RadioTower,
  Section
} from "@letbuyy/ui";
import {
  EndpointTable,
  ExampleCards,
  FactList,
  WebhookDeliveryRuleMatrix,
  WebhookTopicMatrix
} from "@/components/_local-ui/developer-docs";
import {
  webhookDeliveryRules,
  webhookEndpoints,
  webhookExamples,
  webhookFacts,
  webhookTopics
} from "@/lib/developer-surface";
import { DocsShell } from "@/components/PortalShell";

export default function WebhooksPage() {
  return (
    <DocsShell>
      <Page className="developer-main">
        <section className="docs-page-hero">
          <div>
            <RadioTower size={24} aria-hidden="true" />
            <h1>Webhooks</h1>
            <p>
              HMAC signing, outbound headers, mandatory compliance topics, and queued retry
              behavior from the current webhook service.
            </p>
          </div>
        </section>

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

        <Card className="docs-card">
          <Section title="Topic Requirements" description="Lifecycle topics and mandatory compliance topics attached to app webhook subscriptions.">
            <WebhookTopicMatrix topics={webhookTopics} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Delivery, Retry, and Failure Rules" description="Current dispatch, retry, and endpoint behavior from the webhook worker.">
            <WebhookDeliveryRuleMatrix rules={webhookDeliveryRules} />
          </Section>
        </Card>

        <Card className="docs-card">
          <Section title="Delivery Examples" description="Headers, body shape, and signing input from the current webhook dispatcher.">
            <ExampleCards examples={webhookExamples} />
          </Section>
        </Card>

        <EndpointTable
          title="Webhook Service Endpoints"
          description="Developer-facing callback contract plus internal dispatch routes that power delivery."
          endpoints={webhookEndpoints}
        />
      </Page>
    </DocsShell>
  );
}
