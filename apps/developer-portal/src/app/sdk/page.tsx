import { CodePanel, PortalLayout, SectionHeading, StatusPill } from "@/components/PortalChrome";
import { sdkGuides, themeBundleExample } from "@/lib/reference";

export default function SdkPage() {
  return (
    <PortalLayout>
      <SectionHeading
        kicker="Theme SDK and App SDK"
        title="Quick-starts for the contracts that exist now"
        description="Theme packages use the theme-engine JSON-contract bundle. Apps use app-engine registration, app extension, app block, OAuth scope, and webhook contracts. CLI and package SDKs are marked planned until they exist in the active workspace."
      />

      <section className="developer-two-column">
        <CodePanel label="Minimal theme bundle" code={themeBundleExample} />
        <div className="developer-grid">
          {sdkGuides.map((item) => (
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
          kicker="Build your first integration"
          title="The current manual path"
          description="Until a real CLI ships, the safe path is to author JSON against the package-owned schemas, submit through the versioned gateway, and verify install OAuth against the app-store routes."
        />
        <div className="developer-grid three">
          <article className="developer-card">
            <h3>1. Theme</h3>
            <p>Create a JSON-contract bundle with package metadata, settings schema/data, templates, sections, blocks, locales, and renderer manifest.</p>
          </article>
          <article className="developer-card">
            <h3>2. App</h3>
            <p>Register a developer profile, submit a marketplace app with scopes and extension config, then install through app OAuth authorization code flow.</p>
          </article>
          <article className="developer-card">
            <h3>3. Webhooks</h3>
            <p>Use HTTPS webhook targets, verify the HMAC signature, dedupe by event id, and handle mandatory compliance topics.</p>
          </article>
        </div>
      </section>
    </PortalLayout>
  );
}
