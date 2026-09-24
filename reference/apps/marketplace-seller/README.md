# reference/apps/marketplace-seller

System A's seller app, kept as a **donor** for the merchant product's marketplace-selling surfaces.
REFERENCE class (Constitution §16, Amendment 3): never built, deployed, installed as a workspace
member or imported. It does not build as it stands — its Firebase configuration was removed on import
and `lib/main.dart` still imports the deleted `firebase_options.dart` — and that is intentional
(`AGENTS.md`, Migration Notes).

## Provenance

- **Source:** System A's seller app (`apps/seller`, `github.com/SiddhuSaai/letbuyy.git`). The owner's
  scope decision was measured against System A's bundle at `be716ae` (96,098 lines, 171 files,
  Firestore-direct, 23 Cloud Functions; `decisions.md` §2a).
- **Imported:** 2026-09-20, `81bb40af`, from an untracked `apps/seller` tree in this repository's
  working copy, as `apps/phase_2/seller_app`. Whether that tree is byte-identical to `be716ae:apps/seller`
  was not verified at import and is UNKNOWN.
- **Moved:** 2026-09-24, APPID-P1 (`19f79bab`, pure rename) to this path.
- **Removed on import** (never restore): three competing Gradle scripts, two of which declared
  `com.letbuyy.letbuyy` (the shipped Marketplace identity) and `com.agrimate.agrimate`; a debug
  keystore; Firebase client configuration for `letbuy-y` and for Agrimore's `agrii-mate`; inline
  Google Maps keys. Details in `AGENTS.md`.
- **Identity:** Dart package `letbuyy_seller`; Android and iOS `com.letbuyy.seller`, never published and
  not in `config/governance/android-identity-registry.json`.
- **History:** System A's full history is in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle`
  (outside the repository; nothing in CI depends on it).

## Intended recipient

The merchant product, one product on two clients (D-ONE-PRODUCT, 2026-09-24: *"There is one merchant
product delivered through web and mobile: … Marketplace selling."*): `apps/merchant/mobile`
(`letbuyy_store`, `com.letbuyy.store`) first, and `apps/merchant/web` for each capability's web half.
Every port talks to `services/api-gateway` (D-0 = A).

## Unique capabilities

What the donor source contains (`lib/screens/*`, `lib/services/*`), grouped by the owner's scope
decision of 2026-09-04 (`decisions.md` §2a). The list says what exists in the donor, not what has been
ported; port status is in `CAPABILITY_BACKLOG.md`.

| In the donor | §2a disposition |
|---|---|
| Reels (`screens/reels`) and reel boosts | survives; media through the existing media route; a boost is a campaign (D-5) |
| Flash deals (`screens/deals`) | survives as a scheduled discount plus listing moderation |
| Seller ↔ admin support chat (`screens/chat`, the non-AI part) | survives with an `apps/internal/console` inbox |
| Performance tiers and penalties (`penalty_service`, `bonus_service`) | survives **non-monetary** only: ranking, badges, suspension; bonuses become credits |
| Product form and management, drafts, bulk export, HSN/GST (`screens/products`, `product_draft_service`, `product_export_service`, `hsn_gst_service`) | ports onto existing canonical backend |
| Order management and details, returns (`screens/orders`, `screens/returns`) | fulfilment UI ports onto existing canonical backend |
| Seller analytics and dashboard (`screens/analytics`, `screens/dashboard`) | dashboard charts port |
| Listing approval (`product_approval_service`) | needs canonical listing moderation first |
| Ad campaigns, ad wallet, campaign analytics (`screens/ads`) | needs the canonical campaign and prepaid-credit ledger first (D-5) |
| KYC wizard, status, rejection, suspension (`screens/kyc`, `core/seller_status_router.dart`) | needs `merchant_kyc_documents` and the vendor adapter first (D-7) |
| Bank account and payout screens (`bank_account_service`, `models/*payout*`) | bank details blocked by D-2; the payout request flow is retired |
| Hindi and Tamil strings (`lib/l10n/app_hi.arb`, `app_ta.arb`), Indian districts, bank and business-category data (`lib/data`) | reusable reference data, ported only with a consuming feature |

Retired outright, never ported (§2a, D-1): seller sign-up, sign-in, email verification and password
reset (`screens/auth`), because `apps/platform/identity` is the sole issuer; the mutable seller wallet
and automatic payouts (`wallet_service`); the commission engine, penalties as deductions and cash
bonuses; the Gemini seller AI chat.

## Transfer gates

A capability moves only when every gate holds for it:

1. **Scope.** It is on §2a's survive list. `D-FEAT-EXTRA` is open and scopes nothing.
2. **Backend.** The canonical endpoint exists in `services/api-gateway` and is the port's only data
   path. No Firestore, Firebase Auth, Cloud Functions or direct database client.
3. **Identity.** The merchant realm session from `apps/platform/identity` (D-ONE-IDENTITY). No seller
   account, login or password store is created.
4. **Money.** Nothing custodial and no fee (D-1, Constitution §6). Ads and boosts spend prepaid credits
   on their own ledger liability (D-5); ads and loyalty reach the double-entry ledger (D-9). Nothing may
   assume LetBuyy is merchant of record while D-2 is open.
5. **KYC.** Only through the vendor adapter seam (D-7); no vendor SDK until `D-KYC-VENDOR` names one.
6. **Authorisation.** A staff-facing screen relies on staff permissions that fail closed, with denial
   tests (founder, 2026-09-24, §8 of the restructuring brief).
7. **Evidence.** Tests live in the recipient, a debug APK is built and badged, and
   `CAPABILITY_BACKLOG.md` records the port.
8. **Identity preservation.** The port ships inside `com.letbuyy.store`; `com.letbuyy.seller` is never
   published.

This donor is deleted when every row of the capability table is ported or retired by an owner
decision, in a phase with its own disposition row.
