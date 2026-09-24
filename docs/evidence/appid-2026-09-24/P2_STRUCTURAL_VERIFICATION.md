# Structural verification after the application restructuring (APPID-P2, 2026-09-24)

The founder's STRUCTURE checklist, item by item, with the command or check that answers it and the
result measured on branch `letbuyy/appid-p2-reference-isolation` at `a393b3dc` (the gate run) unless a
row names another commit. The moves themselves are APPID-P1 (`19f79bab`…`6b815cda`, merged as
`816aced4`). Anything not measured is labelled.

| Requirement | How it was checked | Result |
|---|---|---|
| Every source root is accounted for | `runtime-validator` walks `apps/` and `reference/` on disk and fails on any directory that is neither a container nor a governed root; its new index check fails if `docs/architecture/APPLICATION_OWNERSHIP.md` omits or invents a root | PASS (17 governed roots; 10 containers under `apps/` plus `reference/apps`) |
| Old active paths are absent, including ignored leftovers | `runtime-validator` in the **primary checkout** after the ignored-file relocation (it reads the disk, so ignored leftovers count) | PASS on 2026-09-24 at `816aced4`; 0 old roots on disk |
| Workspace discovery resolves the intended applications | `pnpm -r ls`; the root `pubspec.yaml` workspace list | 55 pnpm packages, of which the application roots are exactly the 9 web apps (5 maintained, 4 frozen), none under `reference/`; 18 pub members, of which the apps are `apps/merchant/mobile`, `apps/marketplace/mobile` and `apps/deferred/delivery/mobile` |
| Reference code is not a runtime dependency | `reference-isolation-validator` (workspaces, lockfiles, imports, path and link dependencies, CI and deploy config, donor machine paths); its tests inject each violation into a throwaway repository | PASS; 13 of 13 tests, 11 of them negative controls that fail as intended |
| Frozen apps do not start by default | `tests/governance/default-dev-startup.test.mjs` asks turbo's dry run what `dev`, `dev:apps`, `dev:all` and `dev:frozen` start | PASS after APPID-P2 narrowed `dev:all`, which before this phase still started all four frozen apps (the test fails against the old script) |
| Reserved roots remain empty of implementation | `runtime-validator`: each reserved root holds only `AGENTS.md` and `runtime.manifest.json` | PASS |
| Published mobile IDs, deep links and signing references are preserved | blob comparison of every identity-bearing file (Android manifests, Gradle scripts, `settings.gradle`, `Info.plist`, entitlements, `project.pbxproj`, Firebase client configs, ProGuard rules) between `3a7612c6` and `a393b3dc` across the five moved Flutter roots; debug APK badging in APPID-P1 | 54 identical, 0 changed, 0 missing; APKs badged `com.letbuyy.letbuyy` 4013 / 1.0.10 and `com.letbuyy.store` 1 / 1.0.0 at `258b5244` |
| Web builds pass | `pnpm run build` | PASS at `258b5244` (APPID-P1). APPID-P2 changed no application source, so it was not re-run |
| Mobile analysis and tests pass | `gate.sh --mobile` | PASS: analyze and test green for `apps/merchant/mobile` and `apps/marketplace/mobile` |
| Local startup passes | the five maintained apps started from the primary checkout through the preview tooling | PASS on 2026-09-24 at `816aced4`: storefront `/` 200; identity `/login` 200; merchant web and console redirect to identity's `/lookup` with a `return_to`; marketing 307 → `/in` 200. Pages that read data log `ECONNREFUSED` because the gateway and database were not started, which is expected |

## Gate at `a393b3dc`

`gate.sh --mobile`: failed=2, the same failure set as the programme baseline at `3a7612c6`, by name
and by content:

- `lint`: `@letbuyy/customer-web` (`no-hardcoded-hex` errors, line-for-line identical).
- `validators:sweep` 112/114: `environment-validator` and `stale-artifact-validator`. The second is
  red by method when run individually (classified by `tests/governance/ambient-red-attribution.test.mjs`).
  The first now has **one** offender instead of six: the Marketplace web service worker that
  initialises Agrimore's `agrii-mate` Firebase project, a genuine finding recorded as external
  action E-7. The other five were LetBuyy's own Firebase and Maps client keys and are now reviewed,
  value-bound exceptions.

`gate.sh --security` adds one red, `tests:security+auth`: the test "customer-web signs server-only
legacy customer lookups" (`tests/auth/customer-session-gateway.test.mjs`) fails identically at
`3a7612c6` and at `9f93af5e`. It pins two path literals in `apps/commerce/web/src/lib/api/client.ts`
that moved into `internal-only-paths.ts` on 2026-08-25 (`08d169ed`); `client.test.ts` covers the
behaviour. It is an attributed ambient red, left for the identity phase that touches customer auth.
In the same lane the theme tenant-isolation suite **skipped** because no Supabase container was
running, so it is not counted as green.

## Not verified locally

- iOS builds (no signing identity on this machine) and any device run.
- The deferred delivery app is a pub workspace member but is neither built nor tested by the gate.
- Every dashboard setting in `EXTERNAL_ACTIONS.md`.
