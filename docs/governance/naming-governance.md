# Naming Governance

## Runtime Names

Runtime names must describe platform responsibility:

- Use `storefront-runtime`, not `storefront app`.
- Use `merchant-control-plane`, not `admin`.
- Use `identity-platform`, not `accounts`.
- Use `api-gateway`, not `api worker`.
- Use `webhook-service`, not `webhooks worker`.

## Domain Names

Domain packages use `*-core` or explicit engine names when they define business contracts. Utility package names must remain narrow and must not become dumping grounds.

## Database Names

- Database table names use system-of-record names such as `sites`.
- UI and URL labels may use merchant language such as `store`.
- Never introduce a `stores` table to mirror UI terminology.

## Legacy Names

Deprecated technology names belong under `legacy/`. Active runtimes must not carry legacy implementation names in their path or package contract.

