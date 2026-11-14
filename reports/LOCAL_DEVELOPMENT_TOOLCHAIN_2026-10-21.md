# LetBuyy local development toolchain and storage plan

Inspected 21 October 2026 (Asia/Kolkata). Checkout: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, branch `develop`, HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`. Working tree was clean before this report. This is a repository-wide **development dependency audit**, not a claim that every implementation is correct or production-ready. No application dependencies or system SDKs were installed during this audit. The requested personal LetBuyy skill was installed separately.

## What the project actually needs

LetBuyy combines an India-focused merchant commerce OS, buyer storefront/hosted checkout, merchant web/mobile operations, identity, a thin internal console, and public marketing. The repository also contains buyer marketplace mobile work, deferred delivery code, frozen portals, historical donor apps, and extensive intelligence tooling. Their presence does not make every associated service mandatory.

The governing core is a modular API gateway, queue workers, mobile BFF and webhook workers, with the identity application as the token issuer. Next.js applications provide the web surfaces; PostgreSQL/Supabase provides persistent data and authorization, Liquid supplies the portable-theme direction, and external adapters handle payments, messaging and shipping. The ledger, server-authoritative checkout, tenant isolation, identity realms, and outbox require real integration testing. A successful web build alone cannot establish those properties.

The current Constitution and amendments, root AGENTS, canonical registry and actual workspace/deploy files take precedence over archived architecture and the transferred skill's dated snapshot. No new service or architectural replacement is proposed here (AUTH-R1, ARCH-R1–R8, WIN-R2–R4).

## Observed machine state

| Item | Observed result | Action |
|---|---|---|
| CPU architecture | Apple silicon `arm64` | Choose arm64 downloads and emulator images |
| Repository disk allocation | About 410 MiB, including about 163 MiB `.git` | Source is small compared with future caches/SDKs |
| Free space | About 416 GiB reported by `df` | Enough for the proposed stack; backups remain a separate budget |
| Node | `24.22.0` | Use Node **22**, as both `.nvmrc` and `.node-version` specify |
| pnpm | `11.25.0`, supplied through Codex fallback | Use **10.6.2**, the root `packageManager` pin; pnpm 11 warned that root overrides were ignored |
| Homebrew | Not found on PATH | Optional convenient installer, not a runtime dependency |
| Apple Command Line Tools | Unavailable; system Git/Python invoke an installation error | First setup prerequisite |
| Git | `/usr/bin/git` fails; Codex bundled fallback works | Install functional developer Git for ordinary terminals |
| Python | `/usr/bin/python3` fails; Codex bundled Python works | Install a standalone Python for skill and optional tooling use |
| Docker | Not found | Needed for genuine database fixture lanes |
| Flutter / Dart / adb / CocoaPods / psql | Not found on PATH | Install according to target workflows below |
| Java | Apple launcher exists | This does not establish an installed JDK |
| Xcode / Android Studio | Neither application present in `/Applications` | Mobile target-specific setup |
| Android SDK / pub cache | Not present at standard user paths | Expect first-build downloads |
| Project dependencies | No root `node_modules` or `.dart_tool` | Repository has not been bootstrapped here |
| Chrome | Present | Useful for manual testing; Playwright has its own versioned browser |
| Wrangler | Global version `4.151.3`; about 215 MiB package tree | Prefer workspace-resolved version; version command hit sandbox log permission errors |
| Vercel CLI | `65.0.0`; about 352 MiB package tree | Already available, optional for local development |
| GitHub CLI | `2.102.1` | Already available; authentication not checked |
| Supabase CLI | Executable present | Version invocation failed writing telemetry in the sandbox; not evidence that the binary is absent |
| rg / jq | Available | Useful audit helpers |

RAM could not be read through the sandbox. Capacity advice below is guidance, not a hardware measurement. No credentials, hosting identity, external backups or cloud state were inspected.

## Essential web/backend tools and size budget

**Sizes below are planning estimates for installed files and initial caches, not measured downloads or vendor promises.** Release, architecture, selected SDKs and cached versions change them. Existing measured sizes are identified above. GB here denotes approximate decimal capacity; filesystem measurements above use GiB/MiB. Avoid adding overlapping rows twice.

| Tool or storage category | Version / selection | Approximate disk budget | Why / priority |
|---|---|---:|---|
| Apple Command Line Tools | Version supported by installed macOS | 3–6 GB | Git, compilers and native package prerequisites; install first. Included developer capabilities overlap with full Xcode |
| Homebrew and initial metadata | arm64 `/opt/homebrew`, if chosen | 0.5–2 GB before formulae | Convenient installer; count installed formulae separately |
| Node + npm | Node 22 | 0.15–0.35 GB per version | Next.js, Hono tools, scripts and builds |
| pnpm | 10.6.2 | 0.03–0.15 GB | Workspace and lockfile owner |
| JavaScript dependencies + pnpm store | `pnpm install --frozen-lockfile` | 2–6 GB combined initial budget | TS, Next, React, Turbo, Hono, Zod, jose, Liquid, UI and test libraries; shared/hardlinked storage means naive `du` totals can double count |
| Next/Turbo/build caches | Generated as used | 2–10 GB | Multiple apps can grow substantially; not part of Git source |
| Docker-compatible runtime | Choose one, e.g. Docker Desktop | 1–3 GB app + 2–5 GB VM baseline | Required Docker CLI/daemon semantics for DB fixtures; don't install multiple competing runtimes by default |
| Fixture images + synthetic databases | `postgres:16-alpine`, `public.ecr.aws/supabase/postgrest:v16.2` | 1–4 GB initially | Actual executable/gateway DB tests; data and repeated fixture runs can grow |
| Full local Supabase stack | CLI + project-selected service images | 5–12 GB images/data initially | Local integrated backend; separate from the smaller owned fixture lane. Reserve 10–20 GB working room if used heavily |
| Supabase CLI | Compatible CLI; no dedicated root package pin found | 0.05–0.2 GB | Local stack/schema tooling; existing binary needs an ordinary-terminal check |
| Playwright Chromium | Workspace Playwright **1.60.0** matching browser | 0.4–0.8 GB | Root E2E configuration selects Chromium only; full multi-browser downloads are unnecessary for that lane |
| Test screenshots/videos/traces | Produced during browser tests | 1–5 GB working allowance | Failures retain video/screenshots; avoid treating these as executable tools |
| Standalone Python | Compatible Python 3, e.g. 3.12 in a venv | 0.15–0.4 GB before optional packages | Personal context probe and Python tooling; not the commerce server runtime |
| PostgreSQL client tools | Match server versions when doing dumps/restores | 0.05–0.3 GB plus packaging dependencies | Optional host `psql`, `pg_dump`, `pg_restore`; fixture scripts already execute `psql` inside containers |
| Editor | Existing editor/Codex or optional VS Code | 0.5–1.5 GB plus extensions | No need to install several editors |

Wrangler, Miniflare/workerd, TypeScript 5.9.3, Turbo 2.8.9, tsx 4.20.6, ESLint, Stylelint, Next 16.1.6, React 19.2.3 and other manifest libraries belong to the pnpm dependency budget. They do **not** need separate global installs. `wrangler` package manifests currently request `^4.100.0`; honor the lockfile rather than selecting a global release.

Cloudflare R2, Queues, KV and Durable Objects are platform capabilities, not four desktop applications. Wrangler provides local runtime emulation where supported; real-provider behavior still needs appropriate sandbox/live verification.

## Mobile tools and size budget

The root `pubspec.yaml` asks for Dart `^3.11.0`, app manifests ask for `^3.10.0`, but the actual **root lockfile** records Dart `>=3.12.0 <4.0.0` and Flutter `>=3.44.0`. Choose a stable arm64 Flutter satisfying the lockfile and verify package resolution; do not assume an older SDK works because one app manifest permits it. CI uses an unpinned stable Flutter channel, so the exact reproducible Flutter patch release remains a setup choice to verify.

| Tool or storage category | Selection | Approximate disk budget | Need |
|---|---|---:|---|
| Flutter SDK + platform artifacts | Compatible stable Flutter ≥3.44 / Dart ≥3.12 | 3–6 GB initially | Dart is bundled: do not separately install another Dart SDK by default |
| Dart pub cache / workspace metadata | Root workspace dependencies | 0.5–2 GB | Shared across mobile packages; Melos 7 is already a dev dependency |
| Android Studio | Apple silicon version | 2–4 GB application | Convenient SDK/device manager and bundled JBR; CLI-only SDK setup is possible |
| JDK | Compatible with AGP 8.11.1 / Gradle 8.14 | 0.3–0.7 GB if separate | App source/JVM target is Java 17. Reuse compatible Studio JBR where supported instead of duplicating it |
| Android SDK/build tools/platform tools | SDK chosen by selected Flutter; adb included | 3–8 GB | Android builds and physical-device testing |
| Android NDK | `flutter.ndkVersion`, if required by build/plugins | 2–4 GB per version | Conditional; don't fetch every NDK |
| Android emulator system image + AVD | One arm64 image initially | 6–15 GB per usable device | Optional when using a physical Android phone |
| Gradle dependencies/distributions | Wrapper downloads Gradle 8.14 `all` | 1–4 GB initially | Do not install global Gradle or Kotlin; wrapper/plugins manage these |
| Flutter app build outputs | Selected apps/targets | 2–8 GB | Incremental/native build caches, separate from SDK |
| Full Xcode + selected iOS SDK | Compatible with macOS/Flutter | 15–25 GB initial planning allowance | Needed only for iOS/native Apple target development; selected components change size |
| One iOS simulator runtime/device | Choose only required OS | 8–15 GB | Optional with physical-device-only work; additional OS versions multiply cost |
| CocoaPods + Ruby support | Preserve existing Podfiles/locks | 0.2–1 GB plus 1–4 GB pod caches | Existing iOS projects use Pods. New Flutter supports SwiftPM with fallback; don't migrate packaging as setup work |
| Xcode DerivedData / archives | Generated | 5–15 GB working allowance | Grows with targets/builds; signing and archives need deliberate preservation |

Android project evidence: AGP **8.11.1**, Kotlin plugin **2.2.20**, Gradle wrapper **8.14**, Java source/target **17**; compile SDK and NDK are delegated to Flutter. Do not guess a fixed Android API level before selecting Flutter and checking its required SDK.

Start with a physical Android device to avoid emulator overhead. Device signing keys, provisioning, production dart-defines and store credentials are required only for the relevant signed/release workflows and must be supplied securely, not invented or printed.

## Optional tooling and hosted dependencies

| Item | Local requirement | Approximate additional size |
|---|---|---:|
| GitHub CLI | Useful for PR/CI work; already installed | 0.05–0.15 GB |
| Vercel CLI | Optional preview/deploy operations; ordinary `next dev` does not require it | Existing tree about 352 MiB |
| Host `rg`, `jq`, curl | Small command helpers; currently available | Usually <0.1 GB combined, excluding package-manager dependencies |
| Database GUI / Postman / API GUI | Optional; SQL CLI/browser/curl can cover many tasks | 0.3–1 GB per application |
| LCIS Qdrant | Only when working on its vector memory tooling | 0.2–1 GB image initially, then vectors/data |
| LCIS ClickHouse + SigNoz + OTel + frontend | Separate compose stack; not required for core commerce | 3–8 GB initial images; reserve 10–30+ GB for logs/data |
| LCIS Python research tooling | graphrag, lancedb, pyarrow, pandas, crawl4ai, aiohttp, aiofiles in an isolated environment | 2–8 GB initially; models/indexes extra |
| Additional browser engines | Only for explicit compatibility coverage | 0.5–1.5 GB extra depending on engines |

`tools/central-intelligence` has its own package and compose setup, outside the explicit pnpm tooling membership; root `pnpm install` does not make that entire stack ready. Its requirements use broad lower bounds and Qdrant uses `latest`, so exact reproducibility and arm64 image support must be checked before opting in. Do not start it merely because the repository contains it.

Hosted accounts/configuration may be needed for Cloudflare, Supabase, Vercel, GitHub, payment providers, email/WhatsApp, shipping, maps/OAuth and any explicitly selected AI provider. These are **not local installers**. Inspect active adapter modes and sanitized environment examples for the task; use available mocks/sandboxes. A provider name in a historical file is not proof that it is active or mandatory.

No demonstrated core requirement was found for a local Kubernetes cluster, Kafka, a service mesh, a global Redis server, Elasticsearch, MongoDB, Go or Rust toolchain. Firebase archived source is not a reason to install Firebase tooling. Redis HTTP client dependencies/Upstash credentials likewise do not establish a need for a local Redis daemon. Do not activate reserved services or deferred apps to make a setup checklist look complete.

## Practical total capacity

These are rounded working budgets with shared components counted once, not exact sums of every upper bound above:

| Workflow | Reserve for tools, dependencies and working caches |
|---|---:|
| Web/API + actual PostgreSQL/PostgREST tests + Chromium | 25–45 GB |
| Above plus full local Supabase backend | 35–60 GB |
| Above plus Android/Flutter and a physical phone | 55–85 GB |
| Above plus one Android emulator | 65–100 GB |
| Web/backend + Android + iOS/Xcode/simulators | 100–160 GB |
| Optional LCIS research/observability | Add 10–30+ GB; datasets/models/logs can exceed that |

Keep at least another 30–50 GB free for upgrades and transient downloads. Database backups, exported media, unpublished worktrees and old-machine transfers are **outside** these budgets. Never delete them to reach a target number. The observed 416 GiB free is ample for ordinary full-stack use; actual growth should be measured after first successful builds.

For simultaneous containers, multiple Next apps and mobile tooling, 16 GB RAM can require running fewer processes; 24–32 GB is more comfortable guidance. The root dev scripts request concurrency 25, which is not proof that launching every app is appropriate for this Mac. Prefer `pnpm dev:store` or selected filters while working on a single journey.

## Setup order and acceptance

1. Install Apple Command Line Tools through the normal macOS installer. Check `xcode-select -p` and `git --version`. Full Xcode can provide developer capabilities when iOS is required; do not double count all standalone tools.
2. Install/select Node 22 and pnpm 10.6.2. Confirm versions in the normal terminal. The agent's bundled runtimes are useful fallbacks, not a substitute for a stable project toolchain. Do not regenerate the lockfile with pnpm 11 as a setup shortcut.
3. From the repository root run `pnpm install --frozen-lockfile`, then `pnpm exec playwright install chromium`. Review failures without relaxing the lockfile. This audit did not run either installation.
4. Install one Docker-compatible runtime, start it, and check `docker info`. Deliberately pre-pull the two exact fixture images above or use the runner's documented missing-image opt-in. The gateway lane needs a real daemon, ownership labels, isolated networks/volumes and a PostgREST sidecar.
5. If full local backend development is needed, verify Supabase CLI compatibility and start from the repository's actual configuration/runbook. The local Supabase config names PostgreSQL **17**, while synthetic fixture defaults are **16**. Keep those distinct; native version-specific behavior needs appropriate verification. A fixture bootstrap is not a production clone.
6. Review `scripts/dev/setup-local-env.mjs` and sanitized configuration, then use the existing `pnpm dev:setup`/focused dev scripts. They write environment files; don't overwrite restored credentials blindly. Check endpoint health and the actual buyer/merchant/identity journey, rather than assuming a running terminal proves readiness.
7. Add compatible Flutter, then resolve the root Dart workspace (`flutter pub get`), check `flutter doctor -v`, install only Android/iOS target tooling needed, and verify one app on the intended device. Flutter's Dart and package-managed Melos avoid duplicate global SDK/tools.
8. Run repository-native gates for the work being done: focused unit/contract checks, owned DB integration/security lanes, browser E2E, and Flutter analyze/tests for touched mobile work. Configure necessary local services before interpreting failures. No behavioral suites were run in this toolchain audit.

Acceptance means commands work in an ordinary terminal, locked dependencies resolve, the selected services answer, one relevant browser/device journey completes, and affected real integration/security checks pass. It does not mean cloud deployments or real payments have been authorized.

## ZIP skill analysis and installation

Source: `/Users/saai_mithra/Downloads/letbuyy-skill-2026-10-19.zip`. Archive has 15 entries: 13 skill source files, transfer README and hash manifest; total uncompressed archive payload **81,350 bytes**. All 13 source hashes matched before configuration. Entry paths were checked for traversal; extraction stayed under `/tmp`. The only executable helper is a read-only metadata/context probe; it reads Git status/HEAD and document locations, not environment contents. No ZIP helper was executed before inspection.

Installed **14 files** to `/Users/saai_mithra/.codex/skills/letbuyy` without overwriting an existing installation. Thirteen original source files were retained, with two local configuration edits, plus one new reference:

- Changed the context probe's old workspace default to this repository.
- Added a short SKILL entry pointing to `references/local-checkout.md`.
- Added that reference with the current path, dated HEAD, current tool pins, snapshot limitations and commercial/governance conflict handling.
- Preserved the 3 October snapshot and old-machine paths as historical context, rather than rewriting them as current facts. Packaging on 19 October did not refresh the snapshot.
- Preserved UI metadata (`LetBuyy`, `$letbuyy`) and normal discovery behavior. No MCP dependency or automatic release permission was added.

Validation: copied bytes matched the staged configured skill; Python helper parses; all relative Markdown links resolve; context probe ran successfully with bundled Git/Python, locating this clean `develop` checkout and current evidence. The bundled `quick_validate.py` could not run because its Python environment lacks PyYAML; full validator acceptance is therefore unverified. This does not affect the successful context-probe run. The configured frontmatter and UI metadata were inspected directly. The skill should be available for discovery on the next turn.

The skill's broad role language and dated roadmap are guidance, not new user requests. In particular its historical marketplace commission direction must not silently override the current repository's commercial authority. No money behavior, architecture, phase acceptance or repository governance was changed.

## Coverage and limits

The dependency inventory traversed the whole checkout excluding `.git` internals and generated/vendor directories (`node_modules`, `.next`, `.dart_tool`, build/dist, `.turbo`, `.wrangler`, `.venv`). Those generated dependency directories were not used as source authority. It found **60 package.json files** across active, frozen, reference, archive and tooling areas, and **298 migration SQL files**, highest numeric prefix **369**. These are checkout observations, not amendments to old governance counts or proof that migrations are correct.

| Area | Inspected evidence | Conclusion / limit |
|---|---|---|
| Authority/concept | Constitution/amendment structure, root AGENTS, canonical registry, transferred skill context | Distinguishes canonical core from archived/deferred proposals; unresolved policy conflicts retained |
| Web and identity | All discovered JS manifests, workspace filters, root dev/build scripts, Next versions | Node/pnpm/workspace libraries required; builds not executed |
| Services/jobs/storage | Gateway route inventory, all Worker manifests/config paths, adapters/deploy scripts | Wrangler/local emulation and provider config; no live binding/provider test |
| Shared packages | Manifest inventory of domain, UI, API and LCIS packages; Dart workspace | Install through workspace managers; no package-by-package correctness certification |
| Database/security | Local Supabase config, fixture lifecycle, owned DB provisioner/runner, migrations inventory | Docker + real PostgreSQL/PostgREST needed; no live database/authorization proof |
| Native clients | Root/app pubspecs, lockfile SDK constraints, Android Gradle setup, iOS Pod/project presence, mobile CI | Flutter/Android and optional iOS prerequisites identified; no device execution |
| Tests/CI/release | Workflow inventory, root/package test scripts, Playwright config, signed mobile workflow | Browser images, fixture images, signing/config boundaries; no deploy/signing action |
| Intelligence tooling | Own package, compose stack, two Python requirements files | Optional additional images/venvs/data, not commerce prerequisites |
| Reference/archive/frozen | Classified separately from active workspace/default build filters | Not activated; their dependencies don't all become mandatory |
| Host | PATH checks, command version probes, standard install paths, disk measurements | Not a scan of all user disks/backups; RAM and cloud state unavailable |

This report covers tooling and storage across the project. A line-by-line security/functional audit of every source file, complete user journey testing, production readiness, remote branch freshness and restoration of external secrets/backups remain outside the evidence obtained here.

## Current primary-source checks

Checked on 21 October 2026. These establish supported installation mechanics; the disk ranges above remain planning estimates, not quoted vendor package sizes.

- [Supabase local development](https://supabase.com/docs/guides/local-development): CLI and local runtime setup; the repository's test lane specifically uses Docker semantics.
- [Playwright browsers](https://playwright.dev/docs/browsers): matching browser binaries and selective Chromium installation.
- [Flutter SDK archive](https://docs.flutter.dev/install/archive): choose a Flutter release by its bundled Dart version.
- [Flutter manual installation](https://docs.flutter.dev/install/manual): macOS developer-tool prerequisites.
- [Android Studio installation requirements](https://developer.android.com/studio/install): application/SDK/emulator requirements differ; official free-space requirements are not the same as installed application size.
- [Flutter iOS setup](https://docs.flutter.dev/platform-integration/ios/setup) and [SwiftPM integration](https://docs.flutter.dev/packages-and-plugins/swift-package-manager/for-app-developers): Xcode/plugins and CocoaPods fallback.
- [Xcode system requirements](https://developer.apple.com/xcode/system-requirements): choose a version compatible with this Mac's OS.
