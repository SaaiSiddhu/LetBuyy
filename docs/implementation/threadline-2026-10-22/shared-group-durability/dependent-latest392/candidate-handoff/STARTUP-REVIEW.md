# Fresh Editor candidate: default-LATEST392 with manual checkout TLS

This is a **read-only preparation handoff**, not permission to copy or launch. No copier, build, database, application, browser, certificate command or trust command was run. Only this handoff directory was written. The historical 19/19 native run remains frozen and was not repeated.

The existing source copier and canonical manual wrapper can support the next candidate. Startup still awaits the final bounded observer/replay source release, the coordinator's exact final source admission, a quiet copy window and the allocated build/database/browser slots. Current `9cd50e893016`, `d4eb85047858`, `ff9941a78139`, the owner's Threadline preview/login and all tabs remain untouched.

## Exact command proposed for admission

The proposed fresh destination is `/private/tmp/theme-editor-candidate-20261023-latest392-manualtls01`. It and all proposed output paths were absent at observation; recheck immediately before use. Refuse an existing destination or output, select another explicitly admitted fresh name, and preserve earlier candidates. Neither command below was executed.

After the coordinator grants **copy only**, the existing copier command is:

```sh
python3 /private/tmp/theme-editor-prepare-candidate.py \
  /private/tmp/theme-editor-candidate-20261023-latest392-manualtls01
```

After the coordinator verifies the resulting copy/dependency/source proof and separately grants **launch**, use the following from that candidate root:

```sh
env -u LETBUYY_THREADLINE_BROWSER_HOLD \
  -u LETBUYY_THREADLINE_QA \
  -u LETBUYY_THREADLINE_STATE_PATH \
  -u LETBUYY_THREADLINE_MAILPIT_ORIGIN \
  -u LETBUYY_EXECUTABLE_REPORT_DIR \
  LETBUYY_THEME_EDITOR_BROWSER_HOLD=1 \
  LETBUYY_THREADLINE_PRODUCTION_BROWSER=1 \
  LETBUYY_MANUAL_CHECKOUT_TLS_MODE=manual-os-trusted \
  node scripts/governance/run-executable-suites.mjs \
    --kind gateway-db \
    --suite services/api-gateway/src/__tests__/owned-db/theme-editor-browser.manual.ts \
    --jobs 1 --no-reap --prepared-transactions 2 --timeout 24000 \
    --log-dir /private/tmp/theme-editor-latest392-manualtls01-suite-logs \
    --json-out /private/tmp/theme-editor-latest392-manualtls01-runner.json \
    --json \
    > /private/tmp/theme-editor-latest392-manualtls01-runner.stdout \
    2> /private/tmp/theme-editor-latest392-manualtls01-runner.stderr
```

There is **no `--through-migration`**. The admitted candidate must contain the actual source chain with maximum 392, the exact unique 391/392 UP and DOWN files and 321 UP files. Compare every applied migration hash with the admitted candidate source manifest. Do not use broad `--gateway-db` discovery for this manual hold, `--keep-container`, a named existing container, or a reaper. The explicit `.manual.ts` wrapper is intentionally outside normal test discovery, so `--kind gateway-db` is required.

The coordinator now proposes `24000` seconds as the **total suite timeout**, starting before fixture setup and three sequential production builds. This allocates the existing six-hour post-readiness hold plus a forty-minute setup/build margin. The internal six-hour timer is unchanged. If setup/build exceeds forty minutes, the outer deadline still limits the available browser hold; record actual readiness and finish before that deadline. The existing service-role lifetime calculation gives 24,300 seconds for this proposed outer budget. No runner or fixture source change is needed, and no launch was performed.

## Source and dependency freeze

1. Finish all source writers and evidence writers before copying. The copier inventories tracked, modified and intended untracked Git-visible files twice. Its equality check includes documentation and receipts, so even an unrelated inventoried document changing during the copy causes `SOURCE_CHANGED_DO_NOT_RUN.json` and a refused, preserved candidate. Do not rewrite this handoff during that window.
2. Verify the copier's exact SHA-256 `0857d4be9d84c73f3d5d7cb34b64fafab221df959370942eb1124ffda8971e93`. It accepts only a nonexistent `/private/tmp/theme-editor-candidate-*` destination. It excludes `.git`, env/dev-vars files, dependency directories and the listed caches; preserves source deletions; and checks each copied file and the complete before/after inventory. It does not launch anything. Its inventory is Git-visible source, not a guarantee that every arbitrary ignored runtime asset is included; explicitly confirm all required app/theme assets are present in the admitted manifest.
3. Preserve and verify the source manifest's complete file list and internal source symlinks. Include all 47 frozen release sources, nine exact descriptor artifacts, pinned Threadline 382, all SQL pairs through 392, source admissions, and every released repair (merchant origin, same-UUID rename, platform query, preview platform origin, manual TLS, Editor entitlement and final observer/replay delta). The separate native admission `1738fce154529168c02de2631ec46f97f18b2a3f5fb521da2c1a883ab2d33b7e` applies to the frozen historical native epoch; it must not be rewritten to pretend later approved fixture changes were present in that run.
4. The helper remains `bd87cee74313edf0842c275a944814c6f63b2a6e90353d5428fbef30c8301f12`. The Editor entitlement source is now independently admitted as `8a58c5d250239434ab52cd63540e8d9ba1160c26df75168fc5b82ba207c24910`, replacing historical `3cd5…` in the **new candidate epoch only**. The coordinator's `editor-enterprise-startup-source-admission.json` requires actual synthetic owner/site/one Enterprise row and canonical allowance readback. Final observer/replay source admission is still a separate required input.
5. Pin the root/app/service package manifests, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, installed module metadata, Node executable/version, tsx, TypeScript, Next and their actual resolved paths. Reuse installed third-party storage without installation or mutation. Keep that shared storage unchanged through copy, builds and the held run. Node observed here is v22.23.3; tsx 4.20.6; TypeScript 5.9.3; all three app Next packages 16.1.6. Exact hashes are in the JSON observations.
6. The copier rebuilds each consumer's `node_modules` directories and redirects workspace leaf links into the candidate. It does not merely link an entire live app dependency directory. After copying, independently resolve **every recorded workspace link** and all `@letbuyy/*` dependencies from Identity, Merchant, Commerce, Gateway and copied workspace package consumers. Require every workspace result to be inside the fresh candidate. Check executable shims use candidate lookup paths and external third-party links resolve to the admitted installed storage. Record actual counts, not the earlier candidate's counts.
7. The old `/private/tmp/theme-editor-verify-candidate-collection-fix.mjs` is **not reusable unchanged**: it pins old `0a867…` fixture and `9e87…` hydration bytes and only an older migration/repair set. A coordinator-admitted source map must replace those historical assumptions before the existing verification procedure can authorize this candidate. Do not change its guards to tolerate drift or execute it expecting a current-candidate pass.

The read-only source dependency observation resolved all **40 workspace dependencies** and 68 direct runtime entrypoints. `react-email` is an installed CLI-only package with no package-root main/exports, so a generic `require.resolve('react-email')` failed. The separate CLI follow-up verified its package and declared executable bytes; no missing-workspace-dependency or install requirement was inferred. These are observations of the source checkout, **not proof of a future candidate's isolation**.

## Startup ownership, builds and TLS

The wrapper calls `requireOwnedDatabase()` before the pooled SQL proxy and existing fixture. The runner creates a fresh labeled PostgreSQL cluster, network, volume, suite database and PostgREST sidecar. The guard checks the actual runner PID/command, labels, image, mounts, network, DB marker, REST ownership and run ID; an announced name alone is insufficient. No environment-file/database fallback is allowed. The runner strips inherited database endpoints and injects only its verified fixture binding. Capture the actual new run ID and bind the copy manifest, source admission, migration evidence and private state to it.

The fixture allocates fresh random ports and a run-scoped cookie domain, then uses the existing supervisor to build/start **Identity → Merchant → Commerce sequentially**. Each production build runs `next build --webpack`, then verifies ownership again before `next start --hostname localhost`. Each uses its own claimed `.next-session-runtime-<pid>-<kind>` directory and cleanup receipt. Do not prebuild into or reuse an existing fixture's `.next` directory, hot-copy into a running candidate, override loaders/hostnames, or restart another owner's app. Inspect unexpected ambient loader/image/Docker overrides before launch and bind any intentionally approved image configuration exactly.

Manual TLS requires Darwin, Editor opt-in and no Threadline QA profile. The helper consumes only `/private/tmp/letbuyy-owned-checkout-manual-<actual uid>/cert.pem` and `key.pem`; these paths are not caller-configurable. It requires a canonical nonsymlink 0700 directory and owned single-link 0600 regular files. It checks one non-CA server-auth leaf, exact `DNS:checkout.localhost`, validity and matching key, then runs the fixed Apple SSL policy verification against an immutable public-cert snapshot. It preserves the provisioned inputs and never issues a CA/leaf or installs trust.

The coordinator's trusted-checkout setup receipt reports approved OS setup complete and browser verification pending. This handoff did not read private certificates/keys or run OS verification itself. A new bridge listener is required; the old 9cd listener cannot gain this mode by changing environment or trust after startup. Do not use certificate bypasses, SPKI exceptions, permissive Node TLS flags or an alternate checkout origin.

The native ownership/binding prefix was compared byte-for-byte with the archived pre-admission helper and still hashes to `77d9dfb051678a2eb55f9a2e68faf7de0e44150748139814661cde568b33f8c1`. The default native certificate generation/cleanup body is also exact: `ba74460b6ccf58b1592a9d7038e161ba5413df933d2e35aa976c164c32e73586`. No green test suite was rerun to establish these source comparisons.

## Readiness and browser handoff

Require all three `THREADLINE_BROWSER_APP_READY` markers and `THREADLINE_BROWSER_READY`. The fixture reserves its private `/private/tmp/threadline-<new run id>-state.json`, captured mail file and app logs exclusively; refuse collisions. Credentials, control nonce, signing keys and captured mail stay out of reports. Share only whitelisted origin/run/site/product references with the sole Editor browser controller. Normal fresh merchant login must use this fixture's private owner credentials; never replace the owner's retained login.

Before journey credit, read back the exact synthetic user/site binding, single active Enterprise precondition and canonical theme allowance (`limit: null`), and distinguish that local test entitlement from any payment or paid-upgrade acceptance. Confirm actual migrations include 391/392. Existing Editor setup may seed its bounded synthetic catalog; that is setup evidence, not normal merchant-UI creation or purchase evidence. Threadline QA stays unset, so its buyer/order setup path does not run.

Editor then uses new owned tabs only, navigates normal checkout HTTPS without an interstitial, and performs normal install/edit/header-footer save/full reload/publish/public readback on the fresh store. Record actual acknowledged revisions, release and visible markers. Preserve native API proof and browser evidence as separate classes. Preview origin and merchant Save repairs require actual retest; known deferred Playfield/Kindred defects receive no acceptance credit from this startup.

At the agreed end, only the owner of this **new** run may invoke its authenticated finish control or stop its exact runner. Await supervised client/build-directory cleanup, proxy closure, suite database/REST/container/network/volume removal and the final runner result. Verify cleanup failures and remaining resources are empty, and `reaped` is empty. Retain source manifests, dependency proofs and whitelisted browser evidence. Do not invoke any retained fixture's finish/refresh endpoint or global cleanup command.

Machine-readable source pins and proposed argv/env are in [startup-handoff.json](startup-handoff.json). No copy or startup approval is implied by this document.
