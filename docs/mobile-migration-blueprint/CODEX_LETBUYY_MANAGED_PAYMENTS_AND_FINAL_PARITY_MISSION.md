# CODEX MISSION — LETBUYY MANAGED PAYMENTS + FINAL PARITY (single resumable run, backend + web + mobile)

> **Paste this whole document into Codex.** This is the definitive "close everything" mission. It (1) builds **LetBuyy Managed Payments** — LetBuyy's own Razorpay collects, then settles to each merchant after deducting Razorpay's fee + LetBuyy's commission — end-to-end across **backend (gateway), web (merchant-control-plane), and mobile (merchant-app)**; and (2) closes every remaining merchant pending per the capability triage in §1, and executes the cuts. **One mission, every phase, to 100%.** You do not stop, you do not ask. If budget ends mid-mission, checkpoint so the next invocation of this exact prompt resumes from the ledger.

---

## 0. WHO YOU ARE & PRIME DIRECTIVE

You are one autonomous staff-level team: **Product Platform Architect, Cloudflare Architect, Supabase Architect, Staff Next.js Engineer, Staff Flutter Engineer, Payments/Fintech Engineer**. You own the whole monorepo.

**Prime directive:** Make LetBuyy a complete mobile-first commerce OS with **managed payments**. A merchant who can't create their own Razorpay must be able to: onboard + do KYC from their phone, sell, and get **settled by LetBuyy** (Razorpay fee + LetBuyy fee deducted), and see exactly when/how much they're paid — on **both web and mobile**. Plus finish the remaining parity gaps and remove the dead weight.

**Two laws:** (1) **Never stop / never ask** — blocked → placeholder + ledger row → continue (§4). (2) **Never lose work** — commit after every phase; keep STATUS/LEDGER live so a re-invocation resumes (§3).

**Money/compliance caveat (read once):** Holding and moving other people's money in India is regulated. This mission implements the **Razorpay Route** model (Razorpay stays the licensed entity; merchants are Route **linked accounts**; Razorpay does sub-merchant KYC, holds funds, and settles). You also produce a short **Route-vs-own-PA-licence comparison** + a Razorpay confirmation checklist (§5.0) so the human can confirm before go-live. You are **not** building an RBI Payment Aggregator. Treat the PA-licence path as a documented, deferred alternative (ledger `S-PA-LICENCE`, owner = human/legal).

---

## 1. SCOPE — what to BUILD, FINISH, and CUT (the capability triage)

This is the authoritative pending list. Each "build/finish" item is delivered **end-to-end (backend route → web screen → mobile screen)** unless noted.

| Capability | Decision | Notes |
|---|---|---|
| **Payouts / settlement** | **BUILD** (headline) | Merchant sees "when do I get paid + how much," settlement history, fee breakdown. Route-settled. |
| **KYC** | **BUILD** | Mobile-first doc capture (PAN/GST/bank, camera) → submit to Razorpay Route linked account → poll status. Razorpay verifies. |
| **Business details (GSTIN/legal/invoice)** | **BUILD** | Feeds KYC + GST invoicing. |
| **Wallet / balance** | **BUILD** | Merchant balance + ledger (mirror partner ledger pattern). |
| **Commission (platform fee)** | **BUILD as read-only fee visibility** | Operator sets the rate; merchant only **sees** their fee inside payouts. **Do NOT build a merchant "commission management" editor.** |
| **Returns / RMA** | **BUILD** | Over existing `returns`/`return_requests`/`return_lines`/`refunds` tables. Request → approve → restock → refund (refund route already exists). |
| **Push device-token registration** | **BUILD** (tiny) | One gateway route to write `device_tokens`; unblocks already-built push. |
| **2FA / account security** | **BUILD** | TOTP + recovery codes + session list. |
| **Collection edit/delete** | **FINISH** | Add gateway `PATCH`/`DELETE /products/collections/:id`; wire existing mobile/web seams. |
| **Domain verify / SSL** | **FINISH** | Availability + DNS records + verify + SSL status routes; wire seams. |
| **Review replies** | **FINISH** | Merchant reply route + surface in reviews screens. |
| **AI generation / credit purchase** | **FINISH (provider-gated)** | Wire the calls; real provider key/config = ledger skip. |
| **Commission *management* screen** | **CUT** | Operator concern, not merchant. Keep fee visibility only. |
| **Localization / markets** | **CUT** | Remove the mobile stub seam. Out of scope for SMB mobile. |
| **Custom data / metafields** | **CUT** | Remove the mobile stub seam. Power-user/desktop. |
| **Embedded App Bridge (native runtime)** | **CUT → deep-link to web** | Keep the web handoff; delete the native-runtime seam. |

The nine analysis docs in `docs/mobile-migration-blueprint/` are your reference for everything else (architecture, design tokens, API alignment). V2 already delivered mobile P0–P5 (BFF auth, all feature screens, multi-store, offline, i18n). **Read `CODEX_MOBILE_FOUNDATION_STATUS.md` + `_LEDGER.md` first** — do not redo finished work.

---

## 2. OPERATING CONTRACT

- **Branch:** continue on `stream/letbuyy-foundation-v2` (or cut `stream/managed-payments-v1`; record branch+HEAD in STATUS).
- **Gateway changes ARE now in scope.** The prior "do not modify `services/api-gateway/**`" rule applied only to the BFF auth seam and is **superseded** for this mission — you must add backend routes here. Follow existing conventions exactly: route files in `services/api-gateway/src/routes/`, Zod schemas in `src/schemas/`, RBAC/`@scope` middleware, mount in `src/index.ts`, and add the new prefixes to the **BFF allow-list** (`services/mobile-bff/src/index.ts`) so mobile can reach them.
- **Constitution:** root `AGENTS.md` → local `AGENTS.md` → `docs/governance/**`. Run `node scripts/validate-governance.mjs` after every topology/import/package/env/artifact change and at the end of each phase. **Must end green** (a pre-existing `Source ledger residue` failure on operator-owned untracked root files like other `CODEX_*_MISSION.md`/`docs/*audit*` is **not yours** — do not touch those files; note it in STATUS and continue).
- **Single backend:** all mobile traffic → `services/mobile-bff` → gateway `/v1`. No direct Postgres/Firebase/second backend from clients.
- **Commit per phase:** after gates pass, `git add` only the files you changed (backend + web + mobile + governance + blueprint docs) and commit `feat(payments|merchant): <phase> — <summary>`. Never commit secrets. Never sweep operator-owned dirty files into your commits.
- **Reuse, don't reinvent:** mirror the existing app-developer Route payout pattern (`services/api-gateway/src/execution/queue-execution.adapter.ts` → `partner_payout_ledger_entries`, `payout_rail: 'razorpay_route'`, `revenue_share_bps`, `partner_gst_bps`; `src/routes/app-store/shared.ts` → `IndiaPayoutRail`, `appPayoutRail`). The merchant settlement engine is the same shape with a merchant ledger.
- **Keep stack:** Next.js/React + Tailwind (web), Flutter `provider`/`ChangeNotifier` + tokens + `ui_kit` (mobile), Hono + Zod + Supabase service client (gateway). Don't churn working cores.

---

## 3. RESUMABLE CHECKPOINT PROTOCOL

On **every** invocation: read `CODEX_MOBILE_FOUNDATION_STATUS.md`; find the first phase/feature row not `DONE`/`DONE-WITH-SKIP`; resume there. Maintain a feature-level checklist (every §5–§9 row) with status + file evidence + a `## RESUME HINT`. After each feature: update its row, run its tests, and at phase end run §10 gates + commit. If budget runs low: stop at a clean boundary, ensure it compiles, commit, write the RESUME HINT, end. The mission is complete only when every row is `DONE`/`DONE-WITH-SKIP`, §11 DoD holds, and governance is green (minus the noted operator residue).

---

## 4. SKIP-AND-CONTINUE PROTOCOL

Implement everything you can. Defer **only** via greppable placeholder + ledger row, then continue:

| Category | Action | Marker |
|---|---|---|
| Real secret values (Razorpay key/secret, BFF `INTERNAL_API_SECRET`, FCM/APNs, Turnstile) | wire it, inject placeholder | `SKIP_NEEDS_HUMAN_<SCOPE>_<KEY>` |
| Razorpay Route **account activation / live linked-account creation** (needs a real Razorpay Route-enabled account) | build the full flow against Razorpay Route API; use test keys / placeholder where live creds absent | `SKIP_NEEDS_HUMAN_RAZORPAY_ROUTE_ACCOUNT` |
| RBI **Payment Aggregator licence** path | document it as the alternative; do not build | `SKIP_NEEDS_HUMAN_PA_LICENCE` (`S-PA-LICENCE`) |
| Provider exec (AI generation), prod deploy/DNS, app-store signing | write all code+config; don't run live | `SKIP_NEEDS_HUMAN_*` |
| Capability with genuinely no contract you're allowed to build | typed stub throwing `SkipNeedsBackendException(id)` | `// [SKIP-NEEDS-BACKEND: <cap>]` |

Rules: never halt; placeholders throw loudly in prod (no silent no-op); every placeholder has a ledger row.

---

## 5. PHASE A — MANAGED PAYMENTS: BACKEND (the core)

### 5.0 First, write the decision doc (cheap, do it first)
Create `docs/mobile-migration-blueprint/MANAGED_PAYMENTS_ARCHITECTURE.md`: the money flow, the **Route vs own-PA-licence** comparison, the **fee math** (below), the data model, the gateway routes, and a **Razorpay confirmation checklist** (Route eligibility, sub-merchant KYC obligations, settlement timing, transfer/split API, refund-on-Route behaviour, GST on commission). This satisfies the "map both" decision.

**Fee math (Route model):** customer pays `order_total` into **LetBuyy's** Razorpay. At capture, split via Route transfer to the merchant's linked account:
```
razorpay_fee        = Razorpay's MDR on order_total (Razorpay deducts)
letbuyy_commission  = order_total * commission_bps / 10000
commission_gst      = letbuyy_commission * gst_bps / 10000      (e.g. 1800 = 18%)
merchant_settlement = order_total - razorpay_fee - letbuyy_commission - commission_gst
```
Mirror `revenue_share_bps`/`partner_gst_bps` from the app-developer pattern; for merchants use `commission_bps` (operator-set per store/plan; default from `store_model.commissionPercent`) + `gst_bps`.

### 5.1 Data model (Supabase migrations under `database/supabase/migrations/`)
Mirror the partner pattern. Add (names indicative — match repo conventions):
- `merchant_payment_accounts` — store_id, `razorpay_route_account_id`, `kyc_status` (pending/submitted/under_review/activated/rejected), `account_status`, bank ref, audit.
- `merchant_business_profiles` — store_id, legal_name, `gstin`, PAN, address, invoice profile.
- `merchant_settlement_ledger_entries` — store_id, order_id, gross, `razorpay_fee`, `letbuyy_commission`, `commission_gst`, net_settled, `payout_rail`, status, razorpay transfer/settlement ids, provider_mode.
- `merchant_payout_batches` / `merchant_settlements` — settlement batch status, UTR, expected/credited dates.
- `merchant_wallet_entries` (or reuse a wallet ledger) — balance, holds, credits/debits, idempotent.
- `commission_configs` — scope (plan/store), `commission_bps`, `gst_bps`, effective dates (operator-owned).
- KYC docs → R2 via `/upload` (folder `kyc/<store>`), reference rows in `merchant_kyc_documents`.
Add RLS mirroring existing tenant policies. Run governance.

### 5.2 Gateway routes (new `services/api-gateway/src/routes/merchant-payments.ts`, mounted `/v1/payments/...` or `/v1/merchant-payments/...`)
- `POST /onboarding/account` — create Razorpay Route **linked account** for the store (sub-merchant). 
- `POST /onboarding/kyc` — submit KYC docs/details to Razorpay; `GET /onboarding/status` — poll linked-account/KYC status.
- `GET /settlements` — paginated settlement ledger for the store (with fee breakdown).
- `GET /payouts` / `GET /payouts/:id` — settlement batches + UTR + dates.
- `GET /wallet` — balance + ledger.
- `GET /commission` — the store's current `commission_bps`/`gst_bps` (read-only for merchant).
- `GET/PUT /business-profile` — GSTIN/legal/invoice.
Add `@scope` RBAC, Zod schemas, and mount. Add all prefixes to the **BFF allow-list**.

### 5.3 Checkout split (storefront) + webhooks
- Make storefront order capture create a **Route transfer** (split) per the fee math when the store is in **managed mode** (`merchant_payment_accounts.account_status = activated`); otherwise keep the existing BYO `/razorpay/order` path. A store has a **payment mode**: `managed` (LetBuyy Route) vs `byo` (own keys via `store_payment_config`). Add that flag.
- `services/webhook-service`: handle Razorpay **linked-account / KYC status**, **transfer.processed/settled**, and **settlement** webhooks → update `merchant_payment_accounts`, write `merchant_settlement_ledger_entries`, update wallet. Reuse the existing signed-webhook + idempotency pattern.

### 5.4 Acceptance (or ledger): a store can be put in managed mode, a (test-key) order splits via Route, a settlement ledger row is written with the correct fee math, and `GET /settlements` returns it. Live Route account = `SKIP_NEEDS_HUMAN_RAZORPAY_ROUTE_ACCOUNT`.

Commit `feat(payments): managed payments backend (Route)`. Gates.

## 6. PHASE B — MANAGED PAYMENTS: WEB (`apps/merchant-control-plane`)

Add to the existing Settings/Payments area (mirror the current `settings/payments` + `settings/billing` patterns; thin `/api/stores/[store]/...` proxies → gateway):
- **Payments mode toggle** (managed vs BYO) on the payments settings screen.
- **Onboarding / KYC** screen: business details (GSTIN/legal) + KYC doc upload + status timeline.
- **Payouts / Settlements** screen: settlement history with **fee breakdown** (gross → Razorpay fee → LetBuyy commission+GST → net), payout batches + UTR + dates.
- **Wallet** balance + ledger.
- **Business details** screen (if not folded into onboarding).
Replace any "needs-backend" stubs (`BackendNeededPane`) for business/security with real screens. Commit `feat(merchant-web): managed payments`. Gates.

## 7. PHASE C — MANAGED PAYMENTS: MOBILE (`apps/mobile/merchant-app`)

Wire the **existing P5 stub seams** to the new routes (they currently throw `SkipNeedsBackendException`):
- `platform_blocked_service.dart` payouts/wallet/business-details/KYC seams → real `PaymentsService`/`KycService` calling the new `/v1/payments/*` + `/business-profile` via the BFF.
- New screens: **Payouts/Settlements** (fee breakdown), **Wallet**, **KYC onboarding** (camera doc capture via `image_picker`, status), **Business details** (GSTIN/legal/invoice).
- Surface a payments-mode indicator + "Get paid by LetBuyy" onboarding CTA in settings/dashboard.
Keep tokens/`ui_kit`/provider patterns. Commit `feat(mobile): managed payments`. Gates (analyze/test/Android+iOS build).

## 8. PHASE D — CLOSE REMAINING PENDINGS (each end-to-end: gateway → web → mobile)

| Feature | Backend | Web | Mobile |
|---|---|---|---|
| **Returns / RMA** | Routes over existing `returns`/`return_requests`/`return_lines`/`refunds` tables: request, approve/reject, restock, refund (refund route exists `POST /orders/:id/refund`) | Returns queue + detail in orders area | Returns list + detail + approve/refund; resolves ledger S-022 |
| **Push device-token registration** | `POST/DELETE /v1/notifications/device-tokens` (tenant-safe write to `device_tokens`) | n/a | wire `PushService.registerDeviceToken`; resolves S-009 |
| **2FA / security** | TOTP enroll/verify, recovery codes, session list routes | Security settings screen | Security screen; resolves S-023 |
| **Collection edit/delete** | `PATCH`/`DELETE /v1/products/collections/:id` | wire edit/delete | wire edit/delete; resolves S-012 |
| **Domain verify/SSL** | `/v1/stores/:id/domain` availability + DNS records + verify + SSL status | domains lifecycle UI | wire `DomainService.verify/refreshSsl`; resolves S-011 |
| **Review replies** | `POST /v1/reviews/:id/reply` (+ include replies in list) | reply UI | wire `ReviewService.replyToReview`; resolves S-014 |
| **AI generation / credits** | wire `/v1/ai/generate` + credit purchase; real provider/key = `SKIP_NEEDS_HUMAN` | AI surfaces | wire `AiStudioService`; resolves S-016/S-017 where provider exists |

Commit each as its own `feat(...)`. Gates per feature.

## 9. PHASE E — EXECUTE THE CUTS

- **Delete** the mobile stub seams + routes + registry entries + ledger rows for: **localization/markets** (S-025), **custom data/metafields** (S-026), **commission *management* screen** (S-020 as a merchant editor — keep only read-only fee visibility from Phase A), **native embedded App Bridge runtime** (S-015/S-027 — keep the web deep-link handoff only).
- Update `platform_blocked_service.dart`, `merchant_feature_definitions.dart`, routes, settings, STATUS/LEDGER accordingly. Remove dead tests.
- After cuts, P5 "platform-blocked" should contain only genuinely-deferred items (e.g., `S-PA-LICENCE`), not features you've now built or cut.
Commit `chore(mobile): execute capability cuts`. Gates.

---

## 10. PER-PHASE VERIFICATION GATES

1. Gateway: `pnpm --filter @letbuyy/api-gateway typecheck` (+ any route tests). 2. Web: `pnpm --filter @letbuyy/merchant-control-plane build` / lint. 3. Mobile: `flutter analyze` + `flutter test` + `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json` + `flutter build ios --no-codesign ...`. 4. BFF: `pnpm --filter @letbuyy/mobile-bff typecheck && test` (allow-list changes). 5. `node scripts/validate-governance.mjs` green (minus the noted operator residue). 6. Every `SKIP_*` has a ledger row. 7. Commit. 8. Update STATUS + RESUME HINT.

---

## 11. DEFINITION OF DONE

1. A store can switch to **managed mode**; a (test) order splits via Route with correct fee math; a settlement ledger row + wallet update are written; merchant sees payouts/settlements/wallet/KYC/business-details on **both web and mobile**.
2. Returns, push registration, 2FA, collection edit/delete, domain verify/SSL, review replies, AI (where provider configured) are built end-to-end.
3. The cuts are removed; P5 holds only `S-PA-LICENCE` + genuine human/provider secrets.
4. `MANAGED_PAYMENTS_ARCHITECTURE.md` documents Route vs PA + the Razorpay confirmation checklist.
5. CI green; every new gateway route reachable via the BFF; governance green (minus operator residue); every phase committed; STATUS/LEDGER complete with the human go-live checklist.

---

## 12. EXECUTION ORDER (resume-aware)

1. Read STATUS/LEDGER + the 9 docs + the payments/Route code (`queue-execution.adapter.ts`, `app-store/shared.ts`, `routes/payments.ts`, `webhook-service`). Record branch/HEAD.
2. **§5.0 decision doc** → **Phase A backend** → gates/commit.
3. **Phase B web** → gates/commit. 4. **Phase C mobile** → gates/commit.
5. **Phase D** (returns, push, 2FA, collections, domains, reviews, AI) → gates/commit each.
6. **Phase E cuts** → gates/commit.
7. Final governance + DoD + final summary (incl. the human go-live checklist: Razorpay Route account, secrets, BFF deploy, signing).
8. Budget ends anytime → checkpoint (§3) and end cleanly.

---

## 13. GUARDRAILS — DO NOT

- ❌ Build an RBI Payment Aggregator or hold funds in a LetBuyy nodal account — use **Razorpay Route** (Razorpay is the licensed entity). Document PA as deferred only.
- ❌ Put Razorpay secret keys, BFF internal secret, or provider keys in any client (web sends through its server proxies; mobile through the BFF). Placeholder + ledger only.
- ❌ Reintroduce Firebase or a second backend; ❌ call Postgres directly from clients.
- ❌ Touch operator-owned dirty/untracked files (other `CODEX_*_MISSION.md`, `FORENSIC_REPORT/*`, `infrastructure/*.tf`, `docs/*audit*`); don't sweep them into commits.
- ❌ Invent Razorpay behaviour — follow the existing Route/partner-payout pattern and the Razorpay Route API; unknowns → ledger + checklist in the decision doc.
- ❌ Build a merchant "commission management" editor (operator concern) or the cut features.
- ❌ Leave a phase uncommitted, claim DONE without §10 evidence, or leave governance red (beyond the noted operator residue).
- ❌ **Stop or ask a human.** Defer via §4, checkpoint via §3, continue — always.

### One-paragraph recap
Build LetBuyy Managed Payments on the Razorpay **Route** model (LetBuyy's Razorpay collects → splits per `order − razorpay_fee − letbuyy_commission − GST` → merchant linked account settles), mirroring the existing app-developer payout ledger pattern, end-to-end across the gateway (new `merchant_payment_accounts`/settlement-ledger/wallet/business-profile tables + `/v1/payments/*` routes + Route checkout split + settlement webhooks), the web control plane (onboarding/KYC, payouts/settlements with fee breakdown, wallet, business details), and the mobile app (wire the P5 seams + camera KYC). Then close the remaining pendings end-to-end (returns/RMA, push device-token route, 2FA, collection edit/delete, domain verify/SSL, review replies, AI generation) and execute the cuts (localization, custom data, commission-management screen, native App Bridge → web deep-link). Map Route vs PA-licence in a decision doc, keep Razorpay as the regulated entity, commit every phase, keep governance green, ledger every human/provider secret, checkpoint if budget ends, and run to 100% without ever stopping to ask.
