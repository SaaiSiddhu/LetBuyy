# IDENTITY AUTH UX FORENSICS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · measured against CURRENT tree

## Per-flow assessment
| Flow | Exists | UX consistency | A11y (current) | Trust signals | Notes / evidence |
|---|:--:|---|---|---|---|
| **Lookup** | ✅ | shadow CSS | error block **silent** (no role) | rate-limited | enumeration oracle returns `{exists,hasPassword,emailVerified}` (`lookup/route.ts:56-60`) — UX leaks account existence |
| **Login** | ✅ | shadow CSS; ~clone of lookup | 2 silent error blocks | Turnstile + new-device email | `login/page.tsx`; rate-limit IP-only |
| **Signup (email→OTP→password)** | ✅ | shadow CSS | **fixed**: 4 `role="alert"`, OTP `aria-label` + `role="group"` | Turnstile; OTP 6-digit | dead `href="#"` Terms/Privacy remain (`signup:556`) |
| **Forgot password** | ✅ | **DS-native** | DS `Banner` (announced) | no enumeration leak (`send-reset:68`) | exemplar |
| **Reset password** | ✅ | **DS-native** | DS `Banner` + strength meter | destroys all sessions on reset | exemplar |
| **Email verification** | ✅ | redirect-based | n/a | single-use token | token-in-URL via GET (`verify/route.ts:26`) |
| **Account switching** | ✅ | (no dedicated UI; via saved-accounts list) | — | **now requires session + proven account** (Wave-0 fix) | `switch/route.ts` hardened |
| **Onboarding** | ✅ | **mixed (3 paradigms)** | inline styles, orphan classes | — | 1,090-LOC file |
| **Session management** | ❌ **absent** | — | — | — | no UI to view/revoke sessions or devices |
| **MFA / passkey enrollment** | ❌ **absent** | — | — | — | merchant MFA/passkeys unbuilt |
| **Consent screen** | ❌ **absent** | — | — | — | required for OIDC clients |

## Cross-cutting UX
- **Consistency:** split-personality — 4 DS-native flows (gold standard) vs 5 shadow-CSS flows; loading is `Button loading` (DS) vs bare `'...'` (shadow); errors are announced (DS `Banner`) vs (mostly) silent (shadow). **Inconsistent within the same product.**
- **Accessibility:** materially improved this pass — `:focus-visible` app-wide, signup announced + OTP labeled — **but 5 error blocks in `login`/`lookup`/`onboarding` remain screen-reader-silent**, `aria-invalid` used once, 2 dead links persist.
- **Mobile friendliness:** responsive via 5 `@media` in `globals.css`; **0 Tailwind breakpoints in TSX**; the native merchant app authenticates against this host over HTTP (Flutter `StoreAuthService`), so these screens are also a mobile-webview surface where the shadow CSS responsiveness matters. Not systematically tested at 320px.
- **Trust signals:** present — Turnstile bot challenge, new-device-login email (`login/route.ts:99-104`), HTTPS/HttpOnly cookies, "we never reveal if an email exists" on reset/magic (but **contradicted by `/lookup`** which does reveal it). Mixed.
- **Enterprise readiness:** **low.** No SSO login UI, no SCIM, no org/team/invitation UI, no consent, no session/device management, no audit-visible security dashboard. For a future ecosystem IdP serving enterprise tenants this is a large UX gap (cross-ref `IDENTITY_FOUNDATION_READINESS.md`).

## Severity-ranked UX findings
1. **S1 — 5 surfaces the target needs don't exist** (session mgmt, device mgmt, MFA/passkey enroll, consent, security dashboard).
2. **S1 — split-personality consistency** (DS vs shadow) erodes trust on the most-seen screens (login/lookup).
3. **S2 — `/lookup` enumeration UX** leaks account existence (contradicts the reset/magic privacy posture).
4. **S2 — residual a11y** (5 silent errors, 2 dead links, sparse `aria-invalid`).
5. **S2 — onboarding** is a 3-paradigm 1,090-LOC flow — highest-friction surface to maintain.

## Recommendation (analysis-only)
Standardize all flows on the 4 DS-native exemplars + `AuthShell`; build the 5 missing surfaces DS-native; make `/lookup` non-enumerating as part of the OIDC-era login redesign; finish the a11y pass (extend the signup `role="alert"` pattern to login/lookup/onboarding, wire real Terms/Privacy URLs). Enterprise readiness is gated on the org/SSO/consent surfaces (frozen target).
