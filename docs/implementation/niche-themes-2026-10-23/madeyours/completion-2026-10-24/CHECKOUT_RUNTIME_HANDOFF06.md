# Checkout packaging06 — ready for one independent native22 batch

**Packaging/runtime preflight PASS; native tests NOT_RUN; MadeYours browser0/23.** All11 implementation overlays remain byte-for-byte sealed05. No Main source, frozen version, environment/credential file, old fixture, browser or database was changed.

Candidate: `/private/tmp/madeyours-checkout-reentry-proposal-20261024-06`. Treat this boundary as immutable. The requesting independent reviewer owns the next single native lane; no second run is authorized here. Helpers were explicitly resumed by the human in requesting-chat message `01a16d22-523d-7be0-a40d-774d113d358f` (“Yes — resume both shared owners”), read directly. That does not grant a browser or shared-source write lease to this chat.

| Sealed input | SHA256 |
| --- | --- |
| `packaging-receipts/sealed-boundary.json` | `bee033918c136b3e9f264d20b54a7d47423721e5c7349c61df11bc51b33a9f00` |
| `packaging-receipts/source-input-closure06.json` | `50f579a11ec54901f34f2dbb4b463bca44b96e3e9b45a4c7c8adddd903b09a04` |
| `packaging-receipts/runtime-package-metadata06.json` | `f1afb583687582f79306398b04cca63e0ed346ab65724428ff8326eb9298d4db` |
| `packaging-receipts/dependency-links06.json` | `d51a8b7012c9bbc18098f76bb144cc4fe43d889fc6e64267fa284e34c1573123` |
| `packaging-receipts/native-command06.json` | `125cd6ee36cbbd1609c7f7351210a395ca0d8fe9376afb817f08b4656f60e6d9` |

[Structured handoff](CHECKOUT_RUNTIME_HANDOFF06.json) contains absolute paths and hashes for the third-party identities, preflight and exact CLI evidence. The source manifest binds1,127 physical private files: unchanged1071 sealed05 inputs,16 additional real runtime configs and40 unchanged registered runner-inventory sources that are **not selected**. All18 package manifests are copied;15 workspace packages and1,087 dependency links are bound. Workspace sources resolve inside06; only unchanged installed third-party dependencies are shared. The original pnpm shell shim with Main NODE_PATH is replaced only by a candidate-local link to the unchanged vendor tsx CLI, not by a modified runner.

Actual default Node/tsx preflight03:342 workspace +337 external +1648 relative resolutions,455 actual loaded private workspace modules,5 export checks,0Main source,0executed declarations,0fetch calls,0failures. Exact candidate-local tsx CLI additionally imported the actual Worker and new canonical buyer-binding function:457 private modules,489 pinned third-party runtime files,0Main source/declarations/fetch/socket/subprocess calls. Official unchanged runner `--list --json` now selects exactly the two intended suites. No test suite was imported during module preflight.

Preserved failures:05 actually resolved checkout-core to Main and returned an undefined new export; preflight01 mistakenly expected a named route export instead of its canonical default; tsx CLI initially hit sandbox IPC EPERM before its script, then the exact bounded CLI preflight passed with tool approval; runner listing initially refused missing40 registered source files before any DB, then actual unchanged sources were materialized. Original reports and probe sources are sealed, including earlier preflight02 before that inventory addendum. No guard/catalog weakening or stub suite was used.

After independently verifying the boundary, source, metadata, link and shared-vendor hashes, the reviewer runs this command **from the candidate directory**, recording output in a new reviewer-owned location:

```sh
env -u NODE_PATH -u NODE_OPTIONS -u TSX_TSCONFIG_PATH node scripts/governance/run-executable-suites.mjs \
  --kind gateway-db \
  --suite services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts \
  --suite services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts \
  --jobs 1 --timeout 180 --through-migration 393 --json
```

Expected:7 new recovery +15 existing hosted-buyer/local-provider cases, not23 MadeYours browser cases. The source contains322 UP SQL files through393 and paired rollback/bootstrap inputs. Do not use gateway TS declaration aliases as runtime execution targets, inherit Main NODE_PATH, apply to Main or re-use old browser bindings. Preserve native failures and owned cleanup evidence. Actual Razorpay Test Mode/provider delivery remains a separate unrun requirement.
