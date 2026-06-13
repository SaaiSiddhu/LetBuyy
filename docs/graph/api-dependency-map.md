# API Dependency Map

Graph view of the API surface. The graph indexes **400 `route.ts` symbol-nodes** and **1,512 `page.tsx` symbol-nodes** (file + handler symbols). The governed app-API route inventory is **129 route files** (`domain-boundary-validator`).

## Pattern
```mermaid
flowchart LR
  PAGE[app page/component] --> PROXY[app /api/* route] -->|@letbuyy/api-client| GW[/v1 gateway route/]
  GW --> RPC[(SECURITY DEFINER RPC / table read)]
```

- **App API routes are gateway-proxies** — they translate session/shape and call `/v1`; they never write the DB or mutate providers locally (`route-ownership-validator`).
- **Adding a route** is a lockstep change: `domain-boundary-validator` count (129) + `tests/federation/app-api-route-ownership.test.mjs` + `tests/launch/lb6-collections.test.mjs` + `docs/governance/app-api-route-ownership.md`.
- **Route files ≤ 1500 lines** (`route-line-count-validator`).

## Gateway route groups (hubs)
`orders.ts`, `storefront/checkout-payment-routes.ts`, `products.ts` + `gift-cards.ts`, `storefront/customer-*`, `payments.ts`, `coupons.ts`, `themes.ts`, `graphql/*`.

**Explore:** UI → search `route.ts` or a specific handler (`GET()`, `POST()`); or `/graph-dependencies <route>` to see which pages/clients depend on it (blast radius before a route change).
