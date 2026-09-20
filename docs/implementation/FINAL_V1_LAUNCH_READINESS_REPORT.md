# FINAL V1 LAUNCH READINESS REPORT

**Program:** LETBUYY V1 FINAL LAUNCH COMPLETION (GIFT CARDS INCLUDED) — execution mode.
**Date:** 2026-06-13
**Branch:** `stepup/main`
**Scope of this program:** LB-9 (appearance bridge), LB-10 (order email dispatch), LB-11 (gift cards COMPLETE), PHASE FINAL.
Explicitly out of scope per the program brief: Liquid migration/parity/canary, React deletion, ART-17, marketplace/developer-portal/extensions, governance rewrites, identity/money/tenancy/checkout **architecture** changes.

---

## 1. Delivered this program (all committed)

| Item | Commit | What landed | Evidence |
|------|--------|-------------|----------|
| **LB-9 Appearance Bridge** | `550bb1aa` | `sites.site_settings` (snake_case) selected by the gateway and mapped into the camelCase storefront theme tokens (`primary_color→primaryColor`, `font_family→fontFamily`+`headingFontFamily`, `border_radius→borderRadius`, `logo_url`), merchant appearance wins the merge → `layout.tsx :root`. | `tests/launch/lb9-appearance-bridge.test.mjs` (3) |
| **LB-10 Email Dispatch** | core `bad39b21`, dispatch `5254cb6e` | `order_cancelled` / `order_refunded` templates + `planEmailNotificationForEvent` (core); producer `enqueueOrderLifecycleEmail` renders + enqueues `email.order_cancelled` / `email.order_refunded`; `PATCH /orders/:id` dispatches best-effort on terminal status; queue-workers recognises both jobs → existing Resend consumer. | `tests/launch/lb10-order-emails.test.mjs` (3), `tests/launch/lb10-dispatch.test.mjs` (4) |
| **LB-11 Gift Cards COMPLETE** | `7261b6c0` | Issuance + lifecycle cut over to the canonical `gift_card_accounts` + `gift_card_ledger_entries` + `gift_card_redemptions` model the checkout already redeems from. See §3. | `tests/launch/lb11-giftcards.test.mjs` (11), migration 173, money B3-B5 (4) |

---

## 2. PHASE FINAL verification (this sweep)

| Check | Result |
|-------|--------|
| `tsc --noEmit` services/api-gateway | **0 errors** |
| `tsc --noEmit` services/queue-workers | **0 errors** |
| `tsc -b` packages/typescript/api-client (+ refs) | **0 errors** |
| MCP gift-cards page + new `[id]` route (`tsc -p merchant-control-plane`) | **0 errors in the changed files** (3 pre-existing, unrelated MCP errors in `orders/page.tsx` + `collections/page.tsx` left untouched) |
| Launch suite `tests/launch/*.test.mjs` | **137 / 137 pass** |
| Federation `app-api-route-ownership` | **3 / 3 pass** |
| Money B3-B5 convergence (redemption ledger guard) | **4 / 4 pass** |
| Governance gate `validate-governance.mjs` | **107 / 107 validators pass** |

---

## 3. Gift cards — the fix, end to end

**The defect.** Issuance wrote the legacy `public.gift_cards` table (plaintext `code`, `store_id`, no ledger). The canonical checkout redemption (`create_checkout_order`) reads `public.gift_card_accounts` (hashed `code_hash`, `site_id`) and projects the spendable balance from `public.gift_card_ledger_entries`. **Two disconnected models — a gift card issued from the merchant UI could never be redeemed at checkout.**

**The fix (in-architecture, additive).** Migration `173_v1_gift_card_issuance_lifecycle.sql` adds six `SECURITY DEFINER` RPCs that issue and manage cards on the **same canonical model** the redemption already reads. `create_checkout_order` is **untouched**.

| Lifecycle capability | How it is satisfied |
|----------------------|---------------------|
| **Create / issue** | `issue_gift_card` — atomic `gift_card_accounts` row + `issued` ledger entry. |
| **Store (secure)** | Only `code_hash = encode(digest(code,'sha256'),'hex')` + `code_last4` persisted; plaintext returned to the merchant **once**, never stored. |
| **Validate** | `check_gift_card_balance` — masked lookup by code (last4 + projected balance + redeemability). |
| **Redeem (partial + full)** | Existing `create_checkout_order` — now reachable because issuance writes the table it reads. `issue_gift_card` hashes with the **identical** sha256 the redemption looks up by. |
| **Balance tracking** | `gift_card_available_balance` — ledger projection (the same formula the redemption uses); the `balance` column is the issued snapshot and is **never** mutably decremented. |
| **Transactions / audit** | `gift_card_transactions` — full ledger + order-linked redemptions. |
| **Order linkage** | `gift_card_redemptions.order_id` + `gift_card_ledger_entries.order_id` (written by the redemption). |
| **Fraud protection** | `set_gift_card_status` (hold / disable / reactivate) + an audit `fraud_hold`/`release` ledger entry; redemption only matches `status = 'active'`. |
| **RLS / tenant isolation** | `gift_card_accounts` RLS (owner-read + service-all) already in baseline; all six RPCs are `site_id`-scoped `SECURITY DEFINER`; every gateway route calls `verifySiteOwnership`. |
| **Emails** | `enqueueGiftCardIssuedEmail` → `email.gift_card_issued`; worker recognises it; the recipient receives the code once (best-effort, never blocks issuance). |
| **Merchant visibility** | `list_gift_cards` + MCP UI: code reveal once, projected balance, redemption count, transactions drawer, disable/reactivate. |
| **Customer visibility** | Balance is applied + shown at checkout (the redemption path); `check_gift_card_balance` backs a balance check. |

**Governance posture:** all canonical-table mutations route through `db.rpc(...)` (no direct `.from('gift_card_accounts').insert/update` in TS) → canonical-ledger-only validator clean. Route inventory lockstep 128 → 129 (domain-boundary, federation, lb6, lb12 mirror, ownership doc). Migration is additive/replayable with a rollback that drops only the new functions.

---

## 4. Human / infrastructure gates (operator action required — NOT repo code)

These are the **only** remaining steps to a live launch of the LB-9/10/11 scope. Each is an explicit STOP condition under the program brief (Cloudflare / Supabase / Razorpay / Resend / Turnstile / production deployment):

1. **Apply migration 173** (and the prior tracked migrations) to staging then production Supabase. **Gift cards do not function live until 173 is applied** — it adds the issuance/lifecycle RPCs the gateway calls.
2. **`HR-ESP-LIVE` — live Resend delivery.** LB-10 lifecycle emails and the LB-11 gift-card-issued email **render and enqueue** today; live delivery needs the Resend API key + `LETBUYY_EMAIL_MODE=live`. Without it the worker logs `missing-resend-secret` and skips send (no crash).
3. **Deploy + secrets.** Cloudflare Workers deploy of `api-gateway` + `queue-workers` + the Next runtimes, with the bound secrets (`CUSTOMER_SESSION_SECRET`, `QUEUE_TENANT_ENVELOPE_SECRET`, Razorpay, Resend, Turnstile). Gift cards use the existing service-role gateway path and the bound `NOTIFICATION_QUEUE`.

---

## 5. Disclosed, separately tracked (out of this program's scope)

- **LB-8 announcement bar — constitutionally BLOCKED.** A new React-per-section is forbidden by the `no-new-react-sections` freeze + Constitution ART-17; Liquid is out of scope and default-off. Recorded as `HR-LB8-ANNOUNCEMENT-BAR`; needs an ARB approach decision (ship-without / signed React exception / Liquid canary).
- **Full Liquid V1 wave (L14→L18) — BLOCKED.** Staging parity (`HR-LIQUID-PARITY-STAGING`), canary deploy (`HR-LIQUID-CANARY-DEPLOY`), ARB flip (`HR-LIQUID-ARB-FLIP`), and React decommission (`HR-LIQUID-REACT-DECOMMISSION`, constitutional). Engine-side render parity is committed and test-verified; the cross-engine + canary steps are deploy/ARB-gated. Explicitly excluded by this program ("NO LIQUID WORK").

---

## 6. Verdict

**`[V1 REPOSITORY COMPLETE]`** for the scope of this program — **LB-9, LB-10, and LB-11 are implemented, committed, and verified** (typechecks 0, launch suite 137/137, governance gate 107/107, money convergence 4/4). Gift cards are a genuinely complete lifecycle on the canonical model, **not hidden and not deleted**.

The path to a *live* V1 launch is gated only on **operator-owned infrastructure** (apply migration 173, deploy, bind secrets, flip ESP to live) and the **separately-tracked LB-8 + Liquid** decisions, which sit behind human/ARB/constitutional gates and were out of this program's scope. No money, identity, tenancy, or checkout architecture was changed; `create_checkout_order` is untouched; the React storefront and Liquid canary-off posture are unchanged.
