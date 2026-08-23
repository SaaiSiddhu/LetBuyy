# LCIS API Service Governance

Purpose: Internal, read-only HTTP service (Hono) exposing the deterministic LCIS engine (`@letbuyy/lcis-core`) for local development and CI use — the HTTP-shaped sibling of `@letbuyy/lcis-cli` and `@letbuyy/lcis-mcp`.

Runtime boundary: `services/lcis-api`.

Despite living under `services/`, this is NOT one of the canonical 8 production runtimes (root `AGENTS.md` ARCH-R1: `api-gateway`, `queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`, `storefront-runtime`, `merchant-control-plane`, `marketing-site`). Verified at the time of writing:

- No `wrangler.toml` exists under this directory — it is not a Cloudflare Worker deploy target.
- No `.github/workflows/*.yml` deploys it (`lcis-pr-analysis.yml` is the only workflow referencing `lcis`, and it contains no deploy/wrangler/publish/production step — it is a PR-analysis job, not a deployment).
- No `config/runtime/*.json` topology file references it.
- It is started only via the root `package.json` script `"lcis:api": "tsx services/lcis-api/src/server.ts"` — direct `tsx` execution for local/CI use, never a built/published artifact.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this service inside its declared source boundary: `services/lcis-api`.
- Consumes `@letbuyy/lcis-core` only; every response it serves is generated intelligence and is EVIDENCE, NEVER AUTHORITY (root `AGENTS.md` DOC-R2) — never the source of architectural, ownership, commerce, money, tenancy, or identity truth.

## Forbidden Imports

- No imports from `apps/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.
- No provider execution or commerce-domain write access — this service is read-only over `@letbuyy/lcis-core` and must never mutate commerce, money, identity, or tenant state.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- MUST NOT gain a `wrangler.toml`, a deploy workflow step, or a `config/runtime/*.json` entry without a Constitution amendment + ARB approval adding it as a 9th runtime (root `AGENTS.md` ARCH-R2). Adding one silently would be exactly the "reserved service filled by default" failure ARCH-R4/R5 forbid for the six reserved services — this service must not become an unreviewed analog of that.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- This service was added to the repository without an ownership file; this AGENTS.md closes that gap (LetBuyy Phase G1, W1). No source was moved, renamed, or removed to create it.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.
