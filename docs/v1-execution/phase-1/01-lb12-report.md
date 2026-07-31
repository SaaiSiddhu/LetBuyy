# LB-12 — Customer Registration (Dead Button) — Report

**Stream:** A · **Severity:** 🔴 Critical · **Status:** ✅ CLOSED (code complete + tested)

## Root cause
The customer registration **backend was already fully implemented and tested** — the gap was purely in the storefront UI.

The account bottom-sheet (`account-bottom-sheet.tsx`) routed users into two broken branches:
- **New email** (`exists: false`) → `not_found` state — a dead-end telling the shopper to "place an order"; no register path.
- **Existing passwordless** (guest) account (`hasPassword: false`) → `set_password` state, which calls `setPassword(email, password, storeId)` **without a `resetToken`**. The context guard `if (!resetToken) return { success:false, error:'Reset link is required…' }` (`customer-auth-context.tsx:146`) short-circuits before any API call, and the `set-password` route independently rejects token-less requests. Result: "Create Account" always failed.

The context already exposed a correct `register()` (posts to `/api/customer/register`), the storefront proxy route existed, and the gateway `POST /customer/register` existed (rate-limit → Turnstile → not-exists precondition → bcrypt → HS256 session). **None of it was wired to the UI.**

## Fix
Wired the existing `register()` into the bottom-sheet (`apps/storefront-runtime/src/components/account/account-bottom-sheet.tsx`):
- Added a `register` sheet state + destructured `register` from `useCustomerAuth()`.
- `handleEmailSubmit` now routes **both** new emails and existing-passwordless accounts to `register` (the gateway register route already upserts an existing credential-less customer). This eliminates the `not_found` dead-end and the broken token-less `set_password` path from the normal flow.
- Added `handleRegister` → `register(email, password, storeId, null, turnstileToken)`; enforces the backend's **8-char** minimum (the old `set_password` UI wrongly allowed 6) and password confirmation.
- Added a register form with a Turnstile widget (the gateway enforces `requireValidTurnstile`), password + confirm fields, and a "Create Account" button.

**Issuer invariant preserved:** registration stays entirely within the HS256 customer issuer (`/api/customer/register` → `createSession`); no merchant/ES256 path is touched (asserted by the LB-12 test).

## Target flow (now)
`Customer → Continue (email) → Create Account (password + Turnstile) → Account created → logged_in → session cookie set`

## Files changed
- `apps/storefront-runtime/src/components/account/account-bottom-sheet.tsx` (UI wiring)
- `tests/launch/lb12-registration.test.mjs` (+5 UI regression assertions)

No backend changes were required (register route, proxy, api-client, context `register()` already present and correct).

## Tests & validation
- `tests/launch/lb12-registration.test.mjs`: **10/10 pass** (was 5/5; +5 new UI assertions covering: register state + handler, new/passwordless routing, the removed `not_found` dead-end, the 8-char minimum, the Turnstile widget, and the HS256 `/api/customer/register` proxy contract).
- `pnpm --filter @letbuyy/storefront-runtime typecheck`: **clean (exit 0)**.

## Evidence
```
PASS  lb12-registration  (10 ok)
storefront-runtime typecheck EXIT=0
```

## Verification not run (and why)
Full browser registration (Continue → Create Account → session) needs the whole local stack (gateway + storefront + migrated Supabase + a configured store + Turnstile dev bypass). It is not previewable in isolation; the source-contract test + typecheck are this repo's authoritative gate for the change.
