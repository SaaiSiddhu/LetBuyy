# Web V1 Scope Perimeter Governance

**This document is not governance authority.** It documents an enforcement mechanism. Authority order is unchanged: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (supreme) → root `AGENTS.md` → nested `AGENTS.md` → `LETBUYY_CANONICAL_SYSTEMS.md`. Where the registry described here disagrees with any of those, they win and the registry is defective.

- Registry (data): `config/governance/web-v1-scope-registry.json`
- Enforcement (executable): `scripts/validators/web-v1-scope-perimeter-validator.mjs`
- Gate lane wiring: `scripts/validate-governance.mjs`
- Standalone: `pnpm validate:web-v1-perimeter` · read-only listing: `pnpm validate:web-v1-perimeter:report`
- Recorded baseline SHA: `ee3711829d857e986014c5811bb94d86ebc3d343`

## What this mechanism does

It freezes the Web V1 capability perimeter as data and fails the check when an **excluded, forbidden or unratified** capability gains a **new** activation signal.

## What it does not do

- It does not remove, disable, gate or flag any capability.
- It does not implement the Wave 1 removal or cutover.
- It does not classify `apps/mobile/merchant-app` as deferred. The governance chain calls that runtime CANONICAL and no ARB amendment authorises a V1.1 deferral, so it is registered `HUMAN_DECISION_REQUIRED`.
- It does not touch App Bridge, app-store or marketplace code. That surface is owned by a separate urgent security task; this registry records it as an open escalation only.

## The baseline is not a clean state

`knownActivationsBaseline` records **32 activation signals that were already live** at the baseline SHA — including nine capabilities the Web V1 brief lists as deferred, which are built, unflagged and navigation-reachable today. The list exists so the set cannot grow. It is not permission and it is not evidence of compliance.

## Ratchet semantics

| Situation | Result |
|---|---|
| Probe active, signal in baseline | pass (pre-existing, recorded) |
| Probe active, signal **not** in baseline | **hard failure** — new activation |
| Probe inactive, signal in baseline, `expectedRemoval: false` | **hard failure** — tighten the baseline in the same change |
| Probe inactive, signal in baseline, `expectedRemoval: true` | informational note (removal is already owned by another workstream) |
| Probe inactive, signal not in baseline | pass |

There is deliberately no `--update` flag. Absorbing a new activation requires a human edit to the registry, so it is always a reviewable diff.

## Probe kinds

- `path` — active if any listed repo-relative path exists.
- `content` — active if a regex matches any listed file that exists.
- `scan` — active if a regex matches any source file under the listed roots.

Signals are addressed as `<capabilityId>::<probeId>` so that refactors inside an already-active capability do not churn the baseline, while a genuinely new surface (for example storefront gift-card redemption at checkout, or a new PSP router) trips its own probe.

## Delegation instead of alias validators

Capabilities already enforced elsewhere (`self_custody_payout_rail`, `gmv_take_rate_fee`, `reserved_service_activation`) are registered with `enforcement: "delegated"`. The validator asserts that each named delegate exists and stays wired into the gate lane, and does not re-implement its logic. This avoids adding one-line alias validators that inflate the validator count without adding checks.

## Known limitation — the check does not run inside the gate today

`scripts/validate-governance.mjs` executes validators sequentially and exits on the first non-zero status. The gate currently fails at validator index 6 (`validate-design-system.mjs`), so every validator after it — including this one — does not execute during `pnpm validate:governance`. This validator is therefore also exposed as a standalone script so it is runnable and CI-wireable independently. Restoring full-gate execution is a separate Wave 0 workstream.
