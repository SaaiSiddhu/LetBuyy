"use client";

import { Button, Card, Section } from "@letbuyy/ui";

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
          <Button unstyled className="developer-button developer-button--primary" type="button" onClick={reset}>Retry</Button>
        </Section>
      </Card>
    </main>
  );
}
