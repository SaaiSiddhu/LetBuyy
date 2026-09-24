import Link from "next/link";
import { Card, Section } from "@letbuyy/ui";

export default function NotFound() {
  return (
    <main className="developer-main">
      <Card>
        <Section title="Developer page not found" description="Return to the source-backed D0 portal shell.">
          <Link className="developer-button developer-button--primary" href="/">Back to portal</Link>
        </Section>
      </Card>
    </main>
  );
}
