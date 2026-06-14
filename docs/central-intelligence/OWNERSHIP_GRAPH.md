# LCIS v2 — Ownership Graph (Phase 4)

Source: `.github/CODEOWNERS` (26 rules) — authoritative. Query: `pnpm graph:intel owner "<symbol|path>"` / `/api/owner?q=`.

## Code ownership (CODEOWNERS)
The repository is single-owner: **`@saai-sidd`** owns `*` and all 26 path rules (apps, services, packages, database, infrastructure, workflows, validators, `payments.ts` specifically). So *code* ownership resolves to one owner; the useful dimension is **domain/capability ownership** (which subsystem owns which capability) — derived from the runtime map.

## Domain / capability ownership (derived from the runtime map + graph)
| Capability | Owning runtime | Blast (graph) |
|------------|----------------|---------------|
| Money / orders / checkout / refunds / payouts | `services/api-gateway` (the only DB writer) | `getSupabaseAdmin` 115 files |
| Async / email / notifications | `services/queue-workers` | — |
| Provider webhooks | `services/webhook-service` | — |
| Customer storefront | `apps/storefront-runtime` | — |
| Merchant dashboard | `apps/merchant-control-plane` | — |
| Merchant identity (ES256) | `apps/identity-platform` | — |
| Shared contracts | `packages/{shared-types, api-client, ui}` | shared-types 806 · api-client 669 |
| Mobile | `apps/mobile/merchant-app` + `packages/dart/*` | api_client.dart 358 |
| Schema / money RPCs | `database/supabase/migrations` (`/database/` rule) | — |

## How ownership answers questions
- *Who owns `payments.ts`?* → `/api/owner?q=payments.ts` → rule `/services/api-gateway/src/routes/payments.ts` → `@saai-sidd`.
- *Who owns a migration?* → `/database/supabase/migrations/` → `@saai-sidd`.
- *Who owns the gateway?* → `/services/` → `@saai-sidd`.

## Recommendation
When the team grows, expand CODEOWNERS per subsystem; LCIS `owner` queries will then return real per-domain owners with no code change.
