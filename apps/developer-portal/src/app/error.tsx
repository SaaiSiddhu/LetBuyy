"use client";

import { Card, Section } from "@letbuyy/ui";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="developer-main">
      <Card>
        <Section title="Developer portal failed to render" description="Retry the static docs surface. No backend mutation was attempted.">
          <button className="developer-button developer-button--primary" type="button" onClick={reset}>Retry</button>
        </Section>
      </Card>
    </main>
  );
}
