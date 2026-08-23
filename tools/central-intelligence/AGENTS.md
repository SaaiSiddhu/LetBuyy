# tools / central-intelligence AGENTS.md

Purpose: LCIS V2 — Autonomous Commerce Intelligence Platform. The LCIS operator surface layered on top of the structural LCIS V1 graph (`tools/graph-server`, port 3333): semantic memory, relationship reasoning, autonomous operations assessment, and (V3) a read-only Execution Engine, served locally on port 3334 (`intelligence-api/server.mjs`). Not part of the canonical 8-runtime production topology (root `AGENTS.md` ARCH-R1).

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this tool inside its declared source boundary: `tools/central-intelligence`.
- Started locally via `npm start` (`node intelligence-api/server.mjs`) after `bash setup.sh`; it is not deployed to any Cloudflare Worker or Vercel target.
- Its output (assessments, recommendations, briefs, synthesized answers) is generated intelligence and is EVIDENCE, NEVER AUTHORITY (root `AGENTS.md` DOC-R2, DOC-R1). It must never be cited as the source of architectural, ownership, commerce, money, tenancy, or identity truth, and it must not become a second authority for those domains — those stay governed exclusively by the canonical ledger, `identity-platform`, the RLS+GUC tenancy boundary, and the 108-validator governance gate.

## Forbidden Imports

- No imports from `apps/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.
- No provider execution or commerce-domain write access — this tool is read-only observation/reasoning over structural and (where wired) live signals, and must never mutate commerce, money, identity, or tenant state.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- The V3 Execution Engine (`execution-engine/SafetyGuard.mjs`, `execution-engine/ExecutionEngine.mjs`) is read-only by design: `SafetyGuard` default-denies and rejects any mutating verb (deploy/write/insert/update/delete/pay/refund/push/merge). This tool MUST NOT gain a mutating execution path, a production deploy target, or a `config/runtime/*.json` entry without a Constitution amendment + ARB approval.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- This tool was added to the repository without an ownership file; this AGENTS.md closes that gap (LetBuyy Phase G1, W1). No source was moved, renamed, or removed to create it.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.
