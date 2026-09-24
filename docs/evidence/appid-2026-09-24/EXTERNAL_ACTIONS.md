# Pending external actions: application restructuring and one identity (2026-09-24)

Actions the repository cannot perform or verify. Each is **PENDING** until the owner records it done.
Nothing here is done by a repository change, and nothing in the repository proves any of them happened.
Opened by APPID-P2; later phases of this programme append to it.

## Deployment dashboards

| # | Action | Why | Status |
|---|---|---|---|
| E-1 | In each Vercel project, set **Root Directory** to the new path, or clear it: `letbuyy-customer-web` → `apps/commerce/web` (was `apps/customer_web`), `letbuyy-merchant-web` → `apps/merchant/web` (was `apps/merchant_web`), `letbuyy-identity-platform` → `apps/platform/identity` (was `apps/identity-platform`), `letbuyy-admin-web` → `apps/internal/console` (was `apps/admin_web`), `letbuyy-marketing-site` → `apps/marketing/web` (was `apps/marketing-site`). | The deploy workflows now run `vercel deploy` from `apps/<new path>`; a project whose dashboard setting still names the old directory will not build. The project IDs in `config/vercel/projects.json` are placeholders, so which real projects exist is UNKNOWN from here. | PENDING |
| E-2 | In the same projects, check any **Ignored Build Step** command and any path-based build filter for the old directory names. | Such commands live only in the dashboard. | PENDING |
| E-3 | If Vercel projects still exist for the frozen apps (the legacy plan records the app marketplace and developer portal as deployed, LEG-020 and LEG-021), either de-deploy them as that plan says or repoint them to `apps/frozen/…`. | Their directories moved too. | PENDING |
| E-4 | Check GitHub branch protection for required status checks whose names contain a deploy-matrix value. Matrix values changed from `customer_web`, `merchant_web`, `identity-platform`, `admin_web`, `marketing-site` to `commerce/web`, `merchant/web`, `platform/identity`, `internal/console`, `marketing/web`. CI job names did not change. | Required-check names are dashboard state. The deploy workflows are `workflow_dispatch`-only (D-DEPLOY), so such a requirement is unlikely, but unverified. | PENDING |

Unchanged, so no action: Worker names and routes (no service moved), every GitHub secret name, the
Play Console and App Store identities (`com.letbuyy.letbuyy`, `com.letbuyy.store`; the files that carry
them are byte-identical across the move), Firebase project settings, Supabase.

## Provider keys

| # | Action | Why | Status |
|---|---|---|---|
| E-5 | In Google Cloud (project `letbuy-y`), confirm the Android, iOS and Web **Firebase API keys** are restricted to Firebase APIs and never allow the Generative Language (Gemini) API. | `config/governance/secret-scan-exceptions.json` exempts them as public client identifiers. Google's guidance makes that safe only for keys restricted to Firebase services (firebase.google.com/docs/projects/api-keys, updated 2026-09-17). | PENDING |
| E-6 | Confirm the **Maps Platform key** used by the Marketplace app's Android manifest and web Maps loader has Android-app (package and signing SHA-1) and HTTP-referrer restrictions, plus API restrictions. | The same registry exempts it as a client key; unrestricted, it is a billing exposure. | PENDING |
| E-7 | Decide what the Marketplace app's web **service worker** should use. `apps/marketplace/mobile/web/firebase-messaging-sw.js` initialises Agrimore's `agrii-mate` Firebase project, not `letbuy-y`. Either point it at the app's own `letbuy-y` web configuration (already in `lib/firebase_options.dart`) or drop the web push worker until FB-4. | It is the one remaining `environment-validator` finding, and it is genuine, not a false positive. It was left unchanged because the Firebase retirement programme forbids switching live Firebase behaviour without a compatibility assessment, and whether the Flutter web target is deployed anywhere is UNKNOWN. | PENDING (owner decision) |
| E-8 | Rotate or retire the old customer app's Razorpay **test-mode** key id that `docs/migration/repository_consolidation/12_final_verification.md` quoted in full; APPID-P2 redacted it from the file, but it stays in git history. | The journal itself recommended adding it to the rotation list; a key id is not a secret, but it belongs to a real account. | PENDING |

## Other checkouts and machines

| # | Action | Why | Status |
|---|---|---|---|
| E-9 | In every other clone of this repository (other machines, external-drive copies), after pulling `develop`: move untracked `.env.local`, `android/key.properties`, `*.jks`, `*.keystore` and `android/local.properties` from each old application root to the same relative path under its new root (mapping in `.claude/skills/letbuyy/references/decisions.md` §2g), then delete the old roots' `node_modules`, `.next`, `.dart_tool` and `build` directories and run `pnpm install --frozen-lockfile` and `flutter pub get`. | Git moves tracked files only. The primary checkout was relocated on 2026-09-24 (66 local files moved, 51 cache entries set aside outside the repository), and `runtime-validator` there reports no leftover roots. | PENDING for every other clone |
| E-10 | Update local IDE run configurations (Android Studio, Xcode schemes, VS Code) that point at old application paths. | They are untracked. The primary checkout's `.claude/launch.json` was updated. | PENDING |
