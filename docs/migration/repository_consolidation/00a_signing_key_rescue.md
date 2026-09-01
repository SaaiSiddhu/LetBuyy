# 00a — Signing-Key Rescue (executed first, before any other work)

## Why this ran first

Three Android keystores exist only on local disk, inside `Ecommerce/`, which later consolidation phases will delete. They are in no git commit, in neither of the two nested repositories, and on no remote (verified below). The shipped Play Store app is `com.letbuyy.letbuyy`. If these are lost before a backup exists, that listing can never be updated again.

## Step 1 — pre-existing backup search (whole home directory, by SHA-256)

`find ~ -type f \( -iname "*.jks" -o -iname "*.keystore" \) -not -path "*/node_modules/*" -not -path "*/.Trash/*"` returned **26 files**. Every one was hashed with `shasum -a 256` and compared against the five target files' hashes.

**Result: no pre-existing backup of any of the five target files exists anywhere else on disk.** The only files sharing a hash with a target file are the target files themselves (`key.jks` and `key-1.jks`, both `94a4eea1…`, are literally the same keystore under two names). All other `.jks`/`.keystore` files found on the home volume are either the universal Android debug keystore (hash `53b74d45…`, identical across every Flutter project on this machine — not sensitive) or distinct, unrelated keystores belonging to a separate standalone project (`Projects/Clients/Agrimore*`, out of scope for this rescue). No directory named `*signing-recovery*`, `*key-backup*`, or `*keystore-backup*` existed anywhere in the home tree before this session created one.

## Step 2 — recovery directory

Created outside every repository: `~/LetBuyy-signing-recovery-2026-08-29` (`mkdir -p`, confirmed via `ls -ld` before use).

## Step 3–5 — copy and verify (source → destination, SHA-256 equal)

| Source | Destination | Size | mtime | SHA-256 (source) | SHA-256 (dest) | Match |
|---|---|---|---|---|---|---|
| `Ecommerce/LetBuyy/key.jks` | `key.jks` | 2,762 B | Nov 17 2025 14:15:12 | `94a4eea1c1388f65359152db30115e409d72897e9ab56ff3eb27aaf52261561c` | same | ✅ |
| `Ecommerce/LetBuyy/key-1.jks` | `key-1.jks` | 2,762 B | Dec 17 2025 14:32:47 | `94a4eea1c1388f65359152db30115e409d72897e9ab56ff3eb27aaf52261561c` | same | ✅ |
| `Ecommerce/LetBuyy/apps/marketplace/android/app/key.jks` | `marketplace-app-key.jks` | 2,746 B | Dec 14 2025 23:06:44 | `5db2ebe86eca9e932a86ce816695e362079636ee6646cbd6943d89d607fe32bc` | same | ✅ |
| `Ecommerce/LetBuyy/apps/marketplace/android/key.properties` | `marketplace-key.properties` | 83 B | Dec 14 2025 23:07:03 | `07d2bfd83d65cca834773568d3b073a59a914d3c5f9f27a29947a635d0d46894` | same | ✅ |
| `Ecommerce/LetBuyy/apps/admin/android/key.properties` | `admin-key.properties` | 92 B | Dec 13 2025 11:06:15 | `2399294be8b77e846685b7dfd61d8e472df52aace0575901da4e449119f266ce` | same | ✅ |

`cp -p` was used throughout (timestamps preserved, confirmed via `ls -la` and `stat`). All five SHA-256 pairs match exactly — **acceptance criterion 1 satisfied, zero mismatches, no stop condition triggered.**

**Interpretation of `key.jks` vs `key-1.jks`:** identical content under two filenames — not two candidate signing identities. Only one real production keystore exists at the repo root.

## Step 6 — remaining signing/config material in both nested repos

`find Ecommerce/LetBuyy -type f \( -iname "*.jks" -o -iname "*.keystore" -o -iname "*.p12" -o -iname "*.mobileprovision" -o -iname "google-services.json" -o -iname "GoogleService-Info.plist" \)` (excluding `node_modules`) found **25 files**. No `.p12` or `.mobileprovision` files exist anywhere in either repository. Full listing, hashed:

| Path | Type | SHA-256 | Notes |
|---|---|---|---|
| `Ecommerce/LetBuyy/key.jks` | jks | `94a4eea1…61c` | already rescued |
| `Ecommerce/LetBuyy/key-1.jks` | jks | `94a4eea1…61c` | same content as above |
| `Ecommerce/LetBuyy/apps/marketplace/android/app/key.jks` | jks | `5db2ebe8…bc` | already rescued |
| `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/apps/marketplace/android/key.jks` | jks | `f78e75fd…41` | **third, distinct keystore** — belongs to System B's frozen `legacy_archive_v2`, not to any of the five rescued files. Not previously known to this rescue's scope; flagged here so a future phase does not lose it. |
| `apps/{seller,admin,marketplace}/android/app/debug.keystore`, plus 6 more `debug.keystore` copies under `Agrimore/legacy_archive_v2/**` | debug keystore | mostly `53b74d45…16` (the universal Flutter/Android debug key), three app-specific variants (`83b5e8f5…9`, `389f134a…79`, `a154fed8…7e`) | **not sensitive** — Android's standard local debug keystore, publicly documented password, cannot sign a Play Store release |
| `apps/store/builder/ios/GoogleService-Info.plist` + `.../ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `ad0416f2…49` (both, identical) | client config, not a secret (see 03 unique-file report) |
| `apps/seller/android/app/google-services.json` | Firebase Android config | `44f4e099…04` | client config |
| `apps/seller/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `49eb373f…40` | client config |
| `apps/admin/android/app/google-services.json` | Firebase Android config | `dc9efa77…32` | client config |
| `apps/admin/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `49eb373f…40` | identical to seller's — see below |
| `apps/marketplace/android/app/google-services.json` | Firebase Android config | `428cade4…cb` | client config |
| `apps/marketplace/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `49eb373f…40` | identical to seller's and admin's |
| `apps/store/builder/android/app/google-services.json` | Firebase Android config | `3584d779…07` | client config |
| `Agrimore/legacy_archive_v2/apps/{marketplace,admin}/android/app/google-services.json` | Firebase Android config | `5365c542…7` (both identical) | archived client config |
| `Agrimore/legacy_archive_v2/apps/marketplace/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `8c866f25…16` | archived client config |
| `Agrimore/legacy_archive_v2/apps/admin/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `93d6d375…07` | archived client config |
| `Agrimore/legacy_archive_v2/pre_v2_root_archive/legacy_archive/android/app/google-services.json` | Firebase Android config | `593904f4…ee` | archived client config |
| `Agrimore/legacy_archive_v2/pre_v2_root_archive/legacy_archive/ios/Runner/GoogleService-Info.plist` | Firebase iOS config | `e477e748…a2` | archived client config |

**One admin/marketplace/seller `GoogleService-Info.plist` hash (`49eb373f…40`) is shared across all three active System A apps** — they were registered as the same Firebase iOS app entry, or the file was copy-pasted without re-registering per-app. Worth a Firebase-console check in a later phase; not itself a secret leak (see below).

`google-services.json`/`GoogleService-Info.plist` are Google's own documented **client identifiers**, not secrets — they are meant to ship inside the compiled app bundle, and access is enforced by Firebase Security Rules and API-key restrictions server-side, not by hiding this file. They are listed here for completeness because the task asked for every file of this type, not because they require the same rotation urgency as a keystore or a Razorpay secret.

**The third keystore (`f78e75fd…41`, `Agrimore/legacy_archive_v2/apps/marketplace/android/key.jks`) was NOT copied into the rescue directory.** It is out of the five-file scope defined for this rescue, it belongs to a `legacy_archive_v2` tree (Constitution-adjacent equivalent of "frozen"), and copying it without owner direction risks scope creep into System B's own signing material. **Recommend the owner decide explicitly whether this third keystore also needs rescue** before any phase that could delete `legacy_archive_v2`.

## `key.properties` — filenames referenced, no values printed

Per instruction, only the field *names* and the non-secret `storeFile` filename reference were extracted — `storePassword`, `keyPassword`, and `keyAlias` values were never read into any output.

- `apps/marketplace/android/key.properties`: fields `storePassword`, `keyPassword`, `keyAlias`, `storeFile`. `storeFile=key.jks` (resolves to `apps/marketplace/android/app/key.jks`, the rescued `5db2ebe8…bc` keystore).
- `apps/admin/android/key.properties`: fields `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. **`storeFile=debug.keystore`** — the admin app's release-signing config currently points at the debug keystore, not a production key. This means `apps/admin` has **no dedicated production signing key configured** via this file; it is either unreleased, released some other way, or currently unable to produce a properly-signed release build. Flagged for the survivor scorecard (04) and worth the owner's direct confirmation — I did not attempt to build the app to verify this, which is out of scope.

## Acceptance criteria for this document

1. All five files copied with source/destination SHA-256 shown equal — **done**, table above.
2. Zero keystore contents, passwords, or secret values appear in this document — **confirmed**, only filenames, hashes, sizes, and field *names* (never `keyAlias`/password *values*) are recorded.
3. No keystore was opened, decoded, printed, or unlocked; `keytool` was never invoked.
4. No keystore was deleted.

## Stop conditions checked and not triggered

- No SHA-256 mismatch after copy.
- No two non-identical keystores plausibly sign the same `com.letbuyy.letbuyy` production app — `key.jks`/`key-1.jks` are identical, and `marketplace-app-key.jks` is a distinct keystore for a distinct build path (`apps/marketplace/android/app/key.jks`), not a competing identity for the same artifact. (Whether the root-level `key.jks`/`key-1.jks` and the app-level `apps/marketplace/android/app/key.jks` are the *same signing identity used at different times*, or two genuinely different keys, was **not determined** — that requires `keytool -list`, which this rescue is explicitly forbidden from running. Flagged as UNKNOWN, not resolved by guessing.)

## Correction — 2026-08-29, Phase 0.5

The original version of this document (Phase 0) rescued two of the three distinct release keystores and *identified but did not rescue* the third, flagging it for a future phase. That gap is now closed. Restated precisely, because the exact count matters:

**Three distinct release keystores exist across the two nested trees, by SHA-256 — not two:**

| Distinct hash (first 16 hex) | File(s) sharing it | Rescued as of this correction |
|---|---|---|
| `94a4eea1c1388f65` | `Ecommerce/LetBuyy/key.jks` **and** `key-1.jks` — byte-identical duplicates of one keystore, not two | Yes (`~/LetBuyy-signing-recovery-2026-08-29/key.jks`, `key-1.jks`) |
| `5db2ebe86eca9e93` | `Ecommerce/LetBuyy/apps/marketplace/android/app/key.jks` | Yes (`marketplace-app-key.jks`) |
| `f78e75fdca13b925` | `Ecommerce/LetBuyy/Agrimore/legacy_archive_v2/apps/marketplace/android/key.jks` | **Yes, as of 2026-08-29** (`legacy-archive-marketplace-key.jks`) — this is the one this document originally left unrescued |

A full re-sweep of both nested trees for `.jks`/`.keystore`/`.p12`/`.mobileprovision` this session found **7 distinct hashes total**: the 3 release keystores above, plus 4 distinct `debug.keystore` hashes (Android's standard local debug key — public, well-known password, cannot produce a Play-Store-installable signed release; correctly left un-rescued). No `.p12` or `.mobileprovision` file exists anywhere in either tree. No fourth distinct release keystore was found.

**`key.jks`/`key-1.jks` being byte-identical duplicates does not mean only two real candidates exist for "which key signs the live Play Store listing."** There are three genuinely distinct keystores, and **which one actually produced the binary currently live on the Play Store is UNPROVEN by anything gathered in this rescue.** `keytool` was never run (forbidden in every phase to date), so no keystore's certificate fingerprint has been read. The only way to resolve this is to compare each rescued keystore's release-certificate SHA-256 fingerprint (via `keytool -list -v`, run by the owner, not this session) against the fingerprint the **Google Play Console** shows under App integrity → App signing for `com.letbuyy.letbuyy`. Until that comparison happens, treat all three rescued keystores as potentially load-bearing — none should be discarded on the assumption it's "probably the old one."
