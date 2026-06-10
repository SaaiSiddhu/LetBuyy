import { CodePanel, PortalLayout, SectionHeading, StatusPill } from "@/components/PortalChrome";
import { oauthGuide, webhookGuide } from "@/lib/reference";

const verifySnippet = `const payload = timestamp + "." + rawBody;
const expected = hmacSha256Hex(signingSecret, payload);
const actual = header.replace(/^v1=/, "");
return timingSafeEqual(expected, actual);`;

export default function DocsPage() {
  return (
    <PortalLayout>
      <SectionHeading
        kicker="OAuth and webhooks"
        title="Install apps and trust lifecycle events"
        description="These docs match the active app-store routes, app-platform scope contracts, auth-core token contracts, and webhook-service HMAC dispatcher."
      />

      <section className="developer-grid three">
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
      </section>

      <section className="developer-two-column">
        <div className="developer-band">
          <SectionHeading
            kicker="Webhook verification"
            title="HMAC over timestamp and raw body"
            description="The dispatcher sends `X-LetBuyy-Timestamp`, `X-LetBuyy-Hmac-SHA256`, event id, event type, request id, and trace id."
          />
          <CodePanel label="Webhook verification pseudo-code" code={verifySnippet} />
        </div>
        <div className="developer-grid">
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
    </PortalLayout>
  );
}
