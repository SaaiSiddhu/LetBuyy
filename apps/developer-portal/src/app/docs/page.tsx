import Link from "next/link";
import { ArrowRight, Check, KeyRound, Lock, Zap } from "@letbuyy/ui";
import { CodePanel, PortalLayout, SectionHeading, StatusPill } from "@/components/PortalChrome";
import { oauthGuide, rateLimitFacts, webhookGuide } from "@/lib/reference";
import { gatewayFacts, realScopes, webhookFacts } from "@/lib/developer-surface";

const verifySnippet = `const payload = timestamp + "." + rawBody;
const expected = hmacSha256Hex(signingSecret, payload);
const actual = header.replace(/^v1=/, "");
return timingSafeEqual(expected, actual);`;

/**
 * The install sequence is derived from `oauthGuide`, which is tracked to the
 * app-store OAuth routes — so the numbered flow cannot drift away from the
 * contract cards rendered below it.
 */
const installSteps = oauthGuide.map((entry, index) => ({
  step: index + 1,
  title: entry.title,
  body: entry.body,
}));

const nextSteps = [
  {
    icon: KeyRound,
    title: "OAuth and app bridge",
    body: "Scope matrix, token lifetimes, and the GET-only app bridge fetch rules.",
    href: "/oauth",
  },
  {
    icon: Zap,
    title: "Webhook contract",
    body: "Signed delivery headers, topic list, and a verification sketch.",
    href: "/webhooks",
  },
  {
    icon: Lock,
    title: "App Platform API",
    body: "Every /v1/app-store route the gateway mounts, with response contracts.",
    href: "/api-reference",
  },
];

function FactPanel({ title, facts }: { title: string; facts: string[] }) {
  return (
    <section className="dp-facts">
      <h3>{title}</h3>
      <ul>
        {facts.map((fact) => (
          <li key={fact}>
            <Check aria-hidden="true" />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DocsPage() {
  return (
    <PortalLayout>
      <div className="dp-page-head">
        <span className="developer-kicker">Apps · Build</span>
        <h1>Install apps and trust lifecycle events</h1>
        <p>
          These docs match the active app-store routes, app-platform scope contracts, auth-core
          token contracts, and the webhook-service HMAC dispatcher. Anything not yet implemented is
          marked rather than described as if it shipped.
        </p>
      </div>

      <section className="developer-band">
        <SectionHeading
          kicker="Sequence"
          title="How an install actually runs"
          description="Three exchanges, in order. Each one is a live gateway contract today."
        />
        <ol className="dp-steps">
          {installSteps.map((item) => (
            <li key={item.title}>
              <span className="dp-step-index" aria-hidden="true">
                {item.step}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="OAuth"
          title="Token contracts in detail"
          description="What the gateway verifies, what it returns, and what it stores as a hash rather than a value."
        />
        <div className="developer-grid three">
          {oauthGuide.map((item) => (
            <article key={item.title} className="developer-card">
              <div className="developer-icon-line">
                <StatusPill value={item.status} />
                <h3>{item.title}</h3>
              </div>
              <p>{item.body}</p>
              <ul>
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Scopes"
          title="What an app can ask for"
          description="The scopes the app platform recognises today. Requesting anything outside this set fails authorization."
        />
        <div className="developer-status-row">
          {realScopes.map((scope) => (
            <span key={scope} className="developer-status live">
              {scope}
            </span>
          ))}
        </div>
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Webhook verification"
          title="HMAC over timestamp and raw body"
          description="Compute the signature over the timestamp, a literal dot, and the unparsed body — then compare in constant time."
        />
        <CodePanel label="Webhook verification pseudo-code" code={verifySnippet} />
        <FactPanel title="Dispatcher behaviour" facts={webhookFacts} />
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Webhooks"
          title="Delivery, compliance, and retries"
          description="Signing, the headers you can correlate on, the compliance topics that are always subscribed, and what retry control exists."
        />
        <div className="developer-grid two">
          {webhookGuide.map((item) => (
            <article key={item.title} className="developer-card">
              <div className="developer-icon-line">
                <StatusPill value={item.status} />
                <h3>{item.title}</h3>
              </div>
              <p>{item.body}</p>
              <ul>
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Gateway"
          title="What every request passes through"
          description="Middleware, versioning, and the headers the gateway exposes to your client."
        />
        <div className="dp-facts-grid">
          <FactPanel title="Gateway behaviour" facts={gatewayFacts} />
          <FactPanel title="Rate limits" facts={rateLimitFacts} />
        </div>
      </section>

      <section className="developer-band">
        <SectionHeading
          kicker="Next"
          title="Go deeper"
          description="The reference pages behind each contract on this page."
        />
        <div className="developer-grid three">
          {nextSteps.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="developer-card">
                <div className="developer-icon-line">
                  <span className="developer-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <p>{item.body}</p>
                <span className="dp-pillar-cta">
                  Read <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </PortalLayout>
  );
}
