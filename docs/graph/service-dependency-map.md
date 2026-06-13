# Service Dependency Map

Derived from the graph (`/api/domain?key=services` → 4,757 nodes / 324 files; avg degree 3.7 — the most interconnected runtime tier).

```mermaid
flowchart LR
  subgraph apps[Next apps]
    SF[storefront-runtime] & MCP[merchant-control-plane] & IDP[identity-platform] & PC[platform-console]
  end
  apps -->|@letbuyy/api-client| GW[services/api-gateway]
  BFF[services/mobile-bff] --> GW
  GW --> DB[(Supabase)]
  GW -->|NOTIFICATION_QUEUE| QW[services/queue-workers]
  QW --> DB
  PROV[Razorpay] --> WH[services/webhook-service] --> DB
```

| Service | Graph nodes | Depends on | Depended on by |
|---------|------------:|-----------|----------------|
| `api-gateway` | 3,623 | Supabase, Razorpay, Resend adapters, `@letbuyy/*` cores | all apps, mobile-bff |
| `queue-workers` | 393 | Supabase, Resend, `notification-core` | api-gateway (via queue) |
| `webhook-service` | 175 | Supabase, crypto | payment providers |
| `mobile-bff` | — | api-gateway, Turnstile | Flutter merchant app |

**To explore:** `pnpm graph:ui` → search a service entry (e.g. `api-gateway`) → expand neighborhood; or `/graph-dependencies <symbol>` for blast radius. The gateway is the hub — almost every app path terminates there.
