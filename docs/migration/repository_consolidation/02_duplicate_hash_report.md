# 02 — Content-Hash Duplicate Report

## Method

Three file lists were generated with `find`, excluding `node_modules`, `build`, `.dart_tool`, `.next`, `.turbo`, `.git`, `.pnpm-store`, `ios/Pods`, `ios/.symlinks`, `.vercel`, `dist`:

- **Set A** — `Ecommerce/LetBuyy`, excluding the nested `Agrimore/` subtree → **1,807 files**
- **Set B** — `Ecommerce/LetBuyy/Agrimore` → **2,453 files**
- **Set C** — canonical `apps/` + `services/` → **1,916 files**

**Total hashed: 6,176 files (SHA-256, `shasum -a 256`), zero read errors.**

**Total skipped: ~209,270 files**, almost entirely generated/dependency output:
- Unfiltered `Ecommerce/` file count: 207,366 (vs. 4,260 kept from A+B combined → 203,106 skipped)
- Unfiltered `apps/`+`services/` file count: 6,075 (vs. 1,916 kept from C → 4,159 skipped)

Hashing 6,176 files (a few MB of source text plus some binary assets) took under 60 seconds total; hashing the full 213,000+ file, 35+ GB unfiltered universe was avoided per the sizing hazard and was never attempted.

## Duplicate-content summary

- Unique content hashes across all three sets: **4,870**
- Hashes appearing more than once: **350** (covering **1,656** files — 27% of everything hashed)
- Of those 350 duplicate-hash groups, **142 span more than one of the three systems** (i.e. the identical file exists in at least two of A/B/C); after excluding three pure-boilerplate hashes (see below), **140 real cross-system duplicate groups (740 files) remain**.

### Boilerplate noise, excluded from the "meaningful" count

| Hash | Count | What it is |
|---|---|---|
| `e3b0c442…55` | 128 files (47 in A, 76 in B, 5 in C) | The SHA-256 of an **empty file** — placeholder/stub files, not meaningful duplication |
| `01ba4719…31` | 59 files | `.gitkeep`-style placeholder content (e.g. `Agrimore/supabase/tests/rls/.gitkeep`) |
| `30b0832e…4b` | 28 files | Stock Flutter-template `AndroidManifest.xml` (profile/debug build-type boilerplate), identical across every Flutter app in this workspace |

### The 140 real cross-system duplicate groups (740 files) — what they actually are

A basename breakdown of all 740 files shows this is overwhelmingly **scaffold/template boilerplate, not shared business logic**:

```
40  ic_launcher.png              16  IDEWorkspaceChecks.plist     10  vercel.svg
32  .gitignore                   14  next-env.d.ts                10  next.svg
24  launch_background.xml        14  gradlew.bat / gradlew        10  postcss.config.mjs
23  styles.xml                   14  gradle-wrapper.{properties,jar}  10  ic_launcher_foreground.png
16  WorkspaceSettings.xcsettings  14  contents.xcworkspacedata / Contents.json   10  README.md
13  flutter_lldbinit / flutter_lldb_helper.py     13  GeneratedPluginRegistrant.h   13  .DS_Store
11  favicon.ico                  11  build.gradle.kts (project-level — see below)  10  window.svg / globe.svg / file.svg
```

`window.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `file.svg` are the literal default assets `create-next-app` ships with every new project — their presence, identically, across A/B/C confirms every Next.js app in this workspace still carries its unmodified scaffold assets, not that anyone copy-pasted between systems.

**The one cross-system duplicate worth real attention:** the **project-level** `android/build.gradle.kts` (not the app-level one flagged in doc 01) is byte-identical (`6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba`) across **11 files**:

```
A: apps/admin, apps/marketplace, apps/seller, apps/store/builder            (4)
B: Agrimore/apps/{admin_app,customer_app,rider_app,seller_app,store_ops_app},
   Agrimore/legacy_archive_v2/apps/delivery                                  (6)
C: apps/mobile/merchant-app                                                  (1)
```

Every Flutter app in this entire workspace — across all three systems, including the currently-active canonical `apps/mobile/merchant-app` — shares one unmodified project-level Gradle scaffold file. This is strong, direct evidence (not inference) that System C's canonical mobile app, System A's shipped apps, and System B's donor apps all trace back to the same Flutter project template lineage. It corroborates the `com.agrimate.agrimate` namespace found in `build.gradle.kts.backup` (doc 01) and is the concrete evidence base for the lineage note in doc 04.

`README.md` also duplicates cross-system (32 total instances, 2 in this 10-name summary are the generic Flutter/Xcode `LaunchImage.imageset/README.md` template text, present in 5 files across A/B/C with hash `a985b626…f9` — again template boilerplate, not authored documentation).

## Same-name, different-content ("dangerous") files

Every file was grouped by basename; a basename is flagged if it has **more than one distinct content hash**. **583 basenames** meet this bar. The top of the list, unsurprisingly, is ordinary per-app source that is *supposed* to differ (297 different `page.tsx`, 46 `index.ts`, 34 `layout.tsx`, 29 `pubspec.yaml`, 27 `package.json` — every app legitimately has its own).

**This 583-basename list was generated but not individually reviewed line-by-line — that would mean opening and diffing several hundred file pairs, which is Phase 1 reconciliation work, not Phase 0 inventory.** What Phase 0 can respons­ibly say:

- The list exists at `/tmp/samename_diffcontent.txt` (ephemeral, not committed — regenerate with the method above if needed) and is available to hand to Phase 1 as a starting worklist, ranked by cross-system spread.
- A small number of **domain-named** (not generic-scaffold-named) basenames recur 5+ times across all three systems with different content each time — e.g. `order_service.dart`, `order_model.dart`, `analytics_service.dart`, `analytics_screen.dart`, `storage_service.dart`, `theme_provider.dart`, `home_screen.dart`, `settings_screen.dart`, `login_screen.dart`, `help_screen.dart`, `empty_state.dart`, `loading_overlay.dart`, `routes.dart`, `splash_screen.dart`. These are the ones a real reconciliation pass should prioritize — same concept, implemented independently (or forked and diverged) in each app family. **I did not read these files to determine whether they're independent implementations or forked-and-diverged copies of one original — that determination requires Phase 1 effort and is marked UNKNOWN here rather than guessed.**
- Everything else in the 583 is either legitimate per-app source (page/route/model files, expected to differ) or config filenames that are supposed to be unique per project (`package.json`, `pubspec.yaml`, `tsconfig.json`, `AndroidManifest.xml`, `Info.plist`, `Podfile`).

## What this report proves and does not prove

**Proves:** the exact set of byte-identical files across and within the three trees, with hash evidence; that duplication in this workspace is dominated by shared tooling scaffolds, not copy-pasted business logic; that one specific Gradle file links System C's live canonical mobile app to the same template lineage as the Firebase-era and Agrimore apps.

**Does not prove:** that any same-named-but-different-content file pair is safe to merge, safe to delete one side of, or represents intentional forking vs. accidental divergence. That judgment needs a human or a Phase 1 pass reading the actual diffs — this document supplies the ranked candidate list, not the verdict.
