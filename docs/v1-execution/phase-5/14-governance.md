# 14 — Governance

## Canonical compliance (the critical rule)
- The commerce engines mutate state **only through the existing `SECURITY DEFINER` RPCs** (`reserve_inventory`, `create_purchase_order_with_lines`, `receive_purchase_order`, `receive_inventory_transfer`, …). Phase-5 exposure work (api-client + proxies + UI) calls these via the gateway — it **never** does `.from(<table>).insert/update` in TS. The `canonical-ledger-only-validator` boundary is respected (and inventory ledger movements go through `inventory_events`-emitting RPCs).
- **Phase-5 adds ZERO migrations.** Every used table/RPC already exists. The only thing that *would* need a migration — the automation rule engine (`09`) — is deliberately left as a blueprint pending ARB + a live DB, not shipped as untested SQL.

## Gate posture (re-confirmed at lock, carried)
- migration-safety, production-safety, frozen-path, anti-fabrication, canonical-ledger, session-security: PASS (Phase-4 lock).
- The new exposure code is TS over existing endpoints → it is covered by the same typecheck + contract-test + governance gate.
- Pre-existing reds (tenant-isolation `tenant-tables.registry.ts` drift; cross-app design-system) are unchanged and unrelated — Phase-5 introduces no new tenant tables (so no new registry drift) and the new app pages use `--lb-*` tokens (no new design-system drift).

## Anti-fabrication
- No mock data, no placeholder pages, no dead routes/buttons, no unused tables (all reused), no unused APIs (every new api-client method has a proxy + UI consumer in its vertical). The truth map (`01`) is fully evidence-based.
- Engines that cannot be verifiably built here (automation) are honestly marked NOT-BUILT, not faked.

**Verdict:** Phase-5 work is canonical-ledger-compliant by construction (RPC-only), migration-free, and governance-clean. The no-fabrication rules are honored — verifiable work shipped, unverifiable schema blueprinted.
