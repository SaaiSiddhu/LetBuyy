import { Card, Skeleton } from "@letbuyy/ui";

export default function Loading() {
  return (
    <main className="developer-main" aria-label="Loading developer portal">
      <div className="loading-stack">
        <Skeleton lines={2} />
        <div className="docs-grid docs-grid--three">
          <Card className="loading-card"><Skeleton variant="card" /></Card>
          <Card className="loading-card"><Skeleton variant="card" /></Card>
          <Card className="loading-card"><Skeleton variant="card" /></Card>
        </div>
      </div>
    </main>
  );
}

