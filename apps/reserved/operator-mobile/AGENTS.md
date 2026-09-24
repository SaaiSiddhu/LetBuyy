# apps / admin_app AGENTS.md

Purpose: Local operating rules for `apps/reserved/operator-mobile`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Status: RESERVED — manifest-only

This root holds no source. Its former Flutter/Firestore implementation was deleted in phase **FB-1 (2026-09-05)** under the owner's decision to retire Firebase completely. The app had never shipped a signed release: its release `signingConfig` pointed at a debug keystore (`config/governance/android-identity-registry.json`), and every screen read Firestore directly with no canonical gateway client, so it could not have survived the Firebase project's deletion in any case.

`apps/internal/console` is the one admin surface (D-4). The operator APIs behind it live in `services/api-gateway` (`/operations/marketplace-listings`, PHASE-ADM-1). The deleted implementation remains readable in git history at the parent of the FB-1 branch and is a **behavioural reference only** — it must never be restored, because it is Firestore-backed.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this runtime inside its declared source boundary: `apps/reserved/operator-mobile`.
- Prefer completing the canonical owner over adding a parallel implementation.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.
- **No Firebase SDK of any kind**, in this root or anywhere else in the repository.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved roots must stay manifest-only, and `no-reserved-service-activation-validator` enforces that here: any file added under `apps/reserved/operator-mobile` other than this file and `runtime.manifest.json` is a hard gate failure.
- Reactivation requires a **named trigger plus human approval** — the `admin_web` moderation port (CAP-ADM-2) complete, measured demand for a mobile operator surface, and gateway-wired source with tests, deployment config and an ARB-approved governance update.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Migration Notes

- The previous scan-generated repository-intelligence content was removed because generated drift is not law.
- Do not rerun or restore `scripts/generate-repository-intelligence.mjs` output into this file.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.
