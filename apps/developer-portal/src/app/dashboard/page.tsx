import { Badge } from "@letbuyy/ui";
import { PortalLayout, SectionHeading, StatusPill } from "@/components/PortalChrome";
import { dashboardShell } from "@/lib/reference";

export default function DashboardPage() {
  return (
    <PortalLayout>
      <SectionHeading
        as="h1"
        kicker="Developer dashboard shell"
        title="A partner workspace without fabricated data"
        description="The shell shows the expected information architecture for apps, themes, API keys, analytics, and earnings. Each panel is tied to an existing endpoint or marked as a backend skip."
      />

      <section className="developer-grid two">
        {dashboardShell.map((item) => (
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

      <section className="developer-card">
        <div className="developer-icon-line">
          <Badge label="Shell IA" variant="info" />
          <h3>Dashboard navigation</h3>
        </div>
        <div className="developer-route-list">
          <div className="developer-route"><code>Apps</code><p>Existing profile, submitted apps, review records, install counts, ratings, and app status.</p></div>
          <div className="developer-route"><code>Themes</code><p>Theme packages, upload status, review state, releases, and marketplace install readiness.</p></div>
          <div className="developer-route"><code>API keys</code><p>[SKIP - NEEDS BACKEND] Key inventory, reveal, rotation, and revocation.</p></div>
          <div className="developer-route"><code>Analytics</code><p>[SKIP - NEEDS BACKEND] API calls, install funnel, app charge performance, and theme acquisition metrics.</p></div>
          <div className="developer-route"><code>Earnings</code><p>[SKIP - NEEDS BACKEND] Itemized app/theme earnings, payouts, tax invoices, and export controls.</p></div>
        </div>
      </section>
    </PortalLayout>
  );
}
