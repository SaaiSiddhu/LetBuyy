# Merchant mobile parity — source handoff

Date: 30 October 2026 (Asia/Kolkata). Branch `codex/merchant-mobile-parity`. Qualified source checkpoint: `75984e1efe15b476ea5d6d587b6da7103ce34699`, based on `55975acd0da3fd39bcff56168e19b05ff598bc43`. Worktree: `/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy`. The primary checkout's uncommitted Merchant web/UI work was preserved.

## Current source work

- Merchant store selection rejects unknown and forged local stores; money, shipping, tax and domain views block actions after the selected store changes. Monotonic selection generations retire A→B→A requests; preference writes are ordered against logout.
- Payout release uses the existing MFA action proof and a stable retry key, with readback before a released result is shown.
- Merchant-owned Razorpay sandbox connection is reachable without a stale plan restriction; read failures remain errors. The shared Merchant fee display projects the constitutional 0% LetBuyy transaction fee.
- A live domain registrar purchase can no longer proceed from a caller-provided payment reference. Gateway and mobile permit only the development sandbox purchase flow. Merchant web describes search and indicative pricing accurately. Live registration remains unavailable until server-owned, verified payment proof is implemented.
- Native storefront/share/preview/settings links use a shared Dart storefront-root mirror checked against the canonical TS brand declaration. Active custom public links also require observed TLS readiness.
- Native domain registry/setup/verify/history/primary/redirect/removal flows use the existing Gateway/BFF. Adding an alias cannot invent primary status; mutations use persisted readback. Open DNS dialogs hide private contents on context change.
- Native secure-checkout view uses the same address/readiness/provisioning contract as web, displaying exact server DNS, current origin and fallback. Customer-verification readiness stays separate from TLS. `DOMAIN_PARITY.md` contains the exact bounded trace.

## Verification actually completed

- Merchant Flutter analysis: pass. Current full Flutter suite: 411/411 pass. Shared Dart transport/context tests: 12/12 pass. Domain declaration/policy regressions: 12/12 pass.
- Owned disposable Gateway/Postgres domain suites: 10/10 pass; run `18910d8675cc`, cleanup verified. Earlier payout suites: 24/24 pass; run `4500cb6bbc09`, cleanup verified. Earlier Gateway 1,848-unit and web/Gateway typecheck results remain bounded evidence for their unchanged source; they do not establish device/provider acceptance.
- Full governance gate in an exact disposable source clone: 114 PASS, 0 FAIL/BLOCKED/SKIP, 1 report-only NOT_APPLICABLE. Cleanup ran only inside that clone.
- Current iOS simulator debug build with `dart-defines/production.json`: pass, without production signing. Complete bundle manifest SHA-256: `0dc24f727644142a9788b6ef3541ca77a12e759937b882490487f2f1f0c33997`; Dart kernel payload: `95e376babe12a54574f21430162427e9d94217fbf5fbcd935db558e0f70a9834`. The native Runner executable alone does not identify Dart source. The first-pass `ios-simulator-login.png` predates this continuation and proves sign-in rendering only.
- `git diff --check`: pass. Source checkpoint is committed; generated Podfile/SwiftPM churn was removed and build output excluded. No migration, push, merge, deploy, PR, paid provider or production account operation occurred. `QUALIFICATION.json` contains the compact versioned receipts.

## Open gates

- The 122 rows in `FEATURE_LEDGER.md` are an initial scope inventory. They need exact web/client/API/DTO/RLS/effect and acceptance evidence per item; none is marked complete.
- Authenticated simulator interaction was unavailable to this chat. The supplied production account credentials were not used or saved. No signed-in owner/staff, revoked membership, web↔mobile readback, offline/retry, push, or accessibility device journey was observed.
- Current ADB discovery has no attached device; CUA inventory/full-path access cannot select Simulator. Android key properties and the complete release-signing environment are absent. Broader database/RLS, actual native/physical-device, signed-release, hosted staging, real provider/bank and post-deploy readback gates remain open.
- The primary checkout's uncommitted Merchant web changes, especially shipping/tax, must be reconciled before a parity or release claim. Do not overwrite that checkout.
- Live domain purchase needs a canonical payment intent/capture verification bound to site, domain, quote, amount and idempotency before a registrar charge. The fail-closed guard must stay active until provider and owned-DB effect-once tests pass.

Next dependency-ready work: complete catalog/product/media/options/collection and inventory/order/settings traces, repair evidenced differences, then prove both-direction web/native readback and concurrent/revoked-authority controls. Review the global large-text clamp and small-screen/accessibility behavior; widget success is not device acceptance.

Current state: **qualified source checkpoint; full 122-item parity programme in progress; not a release candidate or production acceptance**.
