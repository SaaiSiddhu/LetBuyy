# IDENTITY UI ARCHITECTURE (net-new)
### 2026-06-09 · ANALYSIS-ONLY · no predecessor in the corpus (it is auth-protocol-only)

> **Why net-new.** The transformation corpus is entirely protocol/data; it never addresses the identity *experience*. Yet in the target, the Identity Platform **is** the OIDC login/consent provider for all 15 clients (`OIDC_CLIENT_INVENTORY` #2) — so its UI is the **one screen every human in the ecosystem sees**. This document defines that reference UX, grounded in the current-state audit (`IDENTITY_PLATFORM_AUDIT/UI_UX_GOVERNANCE_REPORT.md`, `DESIGN_SYSTEM_COMPLIANCE_REPORT.md`, `THEME_FORENSICS_REPORT.md`).

---

## 1. Current state → why it can't be the reference yet (evidence)
- **Split personality:** 4 pages are fully DS-native and excellent (`reset-password`, `set-password`, `forgot-password`, `check-email`); 4 bypass the DS via `unstyled` (67/79 Buttons) over a **1,984-line shadow `globals.css`** (`UI_UX_GOVERNANCE_REPORT §1`).
- **Accessibility debt:** 9 `.auth-error` blocks have **no `aria-live`** (silent to screen readers); `outline:none ×4` with **0 `:focus-visible`** (keyboard users lose focus rings); unlabelled OTP grid; dead `href="#"` legal links.
- **Theme leakage:** real provider, but a parallel hand-written `.dark` block + an **undefined `--purple`** that renders broken in both themes.
The team clearly *knows* the right pattern (the 4 gold-standard pages) — the gap is adoption, not capability. This doc codifies the target so the reference is enforceable (`IDENTITY_GOVERNANCE_MODEL §5`).

---

## 2. Surface inventory & per-surface contract
Every identity surface must specify: **DS components used · all four states (loading/empty/error/success) · a11y · the realm it serves.** No surface ships shadow CSS.

| Surface | Purpose | Key components (`@letbuyy/ui`) | Critical states / notes |
|---|---|---|---|
| **Login** | password / passkey / magic / OTP entry; OIDC `/authorize` landing | `Input`, `Button`, `Banner`, OAuth row, `TurnstileWidget` | error announced via `Banner role=alert`; passkey-first if registered; honor `prompt`, `login_hint`, `acr_values` |
| **Signup** | email → OTP → password-set | `Input`, OTP group, `ProgressBar` | OTP inputs labelled "Digit n of 6", grouped `role=group`; real Terms/Privacy links |
| **Account recovery** | lockout / lost factor (corpus G-6) | `Input`, `Banner`, recovery-code entry | **the #1 takeover vector** — must precede MFA enforcement; rate-limited; never reveals account existence |
| **Password reset** | token → new password | `Input` + strength `ProgressBar` + `Badge×3` | gold-standard pattern exists — reuse verbatim |
| **Email verification** | confirm email | `Banner`, countdown | countdown announced via `aria-live=polite` |
| **Passkey enrollment** | WebAuthn register | `Button`, platform prompt | clear fallback if unsupported; multiple passkeys = backup devices |
| **Passkey authentication** | WebAuthn assert | `Button` | autofill/conditional UI; graceful fallback to password |
| **MFA enrollment** | TOTP/passkey + recovery codes | `Input`, QR, `Badge` | recovery codes shown once, copy + confirm-saved gate |
| **MFA verification / step-up** | satisfy `acr` for a sensitive op | `Input`, `Banner` | **step-up re-mints token, not re-login**; explains *why* (e.g. "Confirm to change payout bank") |
| **Consent screen** | 3P/CLI scope grant (corpus G-8) | `DescriptionList` of scopes, `Button` allow/deny | per-scope plain-language; first-party `skip_consent`; remembers grant |
| **Organization switcher** | pick active org (multi-org principal) | `Combobox`/menu | re-mints token with selected `org` claim (refresh rotation); shows last-active |
| **Account switcher** | pick saved account | account list | **must not** mint sessions for un-owned accounts (the `/switch` S0 — UI calls a *fixed* endpoint) |
| **Device management** | list/revoke devices | `DescriptionList`, `Button` | revoke = session kill; shows current device |
| **Session management** | list/revoke active sessions | table, `Button` | "log out everywhere"; shows realm + last-active |
| **Security dashboard** | factors, recent security events, recovery status | cards | surfaces `audit` security events for the principal |

---

## 3. State, accessibility, responsive, theme — the cross-cutting requirements
**States (mandatory on every surface):** loading (DS `Button loading`, skeletons — no bare "…" text), empty (explicit guidance, never a blank screen), error (DS `Banner variant="critical"` with `role="alert"` — **never** a silent `<div>`), success (confirmation + next action).

**Accessibility (WCAG 2.1 AA, enforced):** every input `label`+`id`; errors programmatically linked (`aria-describedby`, `aria-invalid`) **and** announced (`role=alert`/`aria-live`); **`:focus-visible` rings restored** (no `outline:none` without replacement); OTP digits individually labelled + grouped; color-contrast ≥ 4.5:1 from tokens; full keyboard operability; touch targets ≥ 44px; reduced-motion honored.

**Responsive:** single fluid auth card, 320px → desktop; the lang/theme top bar becomes one shared `AuthShell` component (kills the 8× duplication, `DUPLICATION_FORENSICS C11`); no horizontal scroll at 320px.

**Theme:** light/dark/system through `LetbuyyThemeProvider` + `ThemeScript` **only**; **all** color/space/type from `--lb-*` tokens; **zero** inline colors, zero hand-written `.dark` blocks, zero undefined tokens. (Removes the leakage in `THEME_FORENSICS §2`.)

**Design-system compliance:** **no `unstyled` on DS components** in the identity surface; **no shadow `.auth-*` classes** (delete `globals.css` shadow stylesheet as pages convert); only `@letbuyy/ui` primitives. Enforced by the lint promotion in `IDENTITY_GOVERNANCE_MODEL §5`.

---

## 4. This becomes the ecosystem reference
Because the IdP renders the login/consent for all 15 clients, these surfaces **are** the shared identity UX. Two consequences: (1) RP apps must **not** build their own login/MFA/consent screens — they redirect to the IdP (`SSO_ARCHITECTURE`); (2) the `AuthShell` + the four gold-standard pages become the published pattern other LetBuyy surfaces import, making Identity the design-system *reference implementation* the governance model requires (`IDENTITY_GOVERNANCE_MODEL §5`). Brand theming per realm/store is achieved via tokens + the `surface`/`prompt` params, never per-app CSS.

---

## 5. Migration (UI track, additive to Recovery Plan §10)
Anchor on the 4 DS-native pages → convert `login`/`lookup`/`signup`/`onboarding` to DS components, deleting matching `.auth-*` classes as each converts → extract `AuthShell` (top bar/i18n) → add the missing surfaces (passkey, MFA, consent, org/device/session management, security dashboard) DS-native from day one → delete the shadow `globals.css` when conversion completes → flip the lint rules to `error`. Each step is shippable and monotonically shrinks the shadow stylesheet.
