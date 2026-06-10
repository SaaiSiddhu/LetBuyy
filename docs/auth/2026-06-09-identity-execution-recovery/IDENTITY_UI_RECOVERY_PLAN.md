# IDENTITY UI RECOVERY PLAN
### Phase 3 — Execution Recovery · 2026-06-09 · ANALYSIS-ONLY · target frozen at `IDENTITY_RECOVERY_ENHANCEMENT/IDENTITY_UI_ARCHITECTURE.md`
### Per-surface execution plan to converge the identity UI on `@letbuyy/ui`

> Counts are from this pass. The frozen target is the published reference UX (the IdP renders login/consent for all 15 OIDC clients). This plan does **not** redesign UX — it sequences moving each surface from current state to the frozen target.

## Current surface map (what exists vs what the target needs)
| Surface | Exists? | File / LOC | Styling regime | Action |
|---|:--:|---|---|---|
| Login | ✅ | `login/page.tsx` (375) | shadow CSS (`unstyled`) | **convert** + merge with lookup |
| Lookup | ✅ | `lookup/page.tsx` (645) | shadow CSS | **merge into login** (CD-S0-2) |
| Signup (3-step + OTP) | ✅ | `signup/page.tsx` (730) | shadow CSS | **convert**; fix OTP a11y, dead links |
| Onboarding | ✅ | `onboarding/page.tsx` (1,090) | **mixed** (3 paradigms) | **convert** steps 4-6; remove inline styles (33) |
| Select (store/account picker) | ✅ | `select/page.tsx` (248) | hybrid | **convert**; becomes Account/Org switcher base |
| Forgot password | ✅ | `forgot-password/page.tsx` (183) | **DS-native ✅** | reference exemplar |
| Reset password | ✅ | `reset-password/page.tsx` (274) | **DS-native ✅** | reference exemplar |
| Set password | ✅ | `set-password/page.tsx` (285) | **DS-native ✅** | reference exemplar |
| Check email | ✅ | `check-email/page.tsx` (220) | **DS-native ✅** | reference exemplar |
| **MFA enroll/verify** | ❌ MISSING | — | — | **build DS-native** (Wave 4/5) |
| **Passkey enroll/auth** | ❌ MISSING | — | — | **build DS-native** (Wave 5) |
| **Consent screen** | ❌ MISSING | — | — | **build** (Wave 5, OIDC) |
| **Session management** | ❌ MISSING | — | — | **build** (Wave 3/4) |
| **Device management** | ❌ MISSING | — | — | **build** (Wave 4) |
| **Organization switcher** | ❌ MISSING | — | — | **build** (Wave 6) |
| **Invitations / team mgmt** | ❌ MISSING | — | — | **build** (Wave 6, org model) |
| **Security dashboard** | ❌ MISSING | — | — | **build** (Wave 4) |

**Key reading:** the identity app today is **login-flow-only**; ~half the surfaces the frozen target requires (MFA, passkeys, consent, session/device/org/team management, security dashboard) **do not exist** and must be built DS-native from day one — which is cheaper than converting shadow-CSS pages.

---

## Cross-cutting UI debt (evidence)
| Check | Finding | Evidence |
|---|---|---|
| **Typography** | not tokenized in shadow sheet | 77 hardcoded `font-size:` in `globals.css` |
| **Spacing** | not tokenized | **426** raw `px` in `globals.css`; 42 inline `style={{}}` |
| **Color** | 0 hex in TSX (lint works) but 60 raw `rgb()` in CSS + parallel `--text-*` namespace | `globals.css` |
| **Layout/responsive** | adequate; top bar duplicated 8× | `login:206-214` + 7 others |
| **Dark mode** | real provider; leakage + 1 broken token | `globals.css:31-40,1108`; `--purple` `:212,527` |
| **Accessibility** | 9 silent `.auth-error` (no `aria-live`); `outline:none ×4` no `:focus-visible`; unlabelled OTP; dead `href="#"` | `signup:513,546,568-582`; `globals.css:371,432,1011,1498` |
| **Loading states** | inconsistent (DS `Button loading` vs bare "…") | `check-email:188` vs `login:250` |
| **Error states** | two regimes (DS `Banner` announced vs silent `.auth-error`) | `forgot:152` vs `signup:513` |
| **Success states** | present but ad hoc | onboarding success screen |

---

## Recovery sequence (UI track)
1. **Anchor (Wave 2 start):** adopt the 4 DS-native pages as the published pattern; extract `AuthShell` (top bar + i18n) → kills 8× duplication (CD-S1-1).
2. **Convert (Wave 2):** login (+merge lookup), signup, onboarding steps 4-6, select → DS components; **delete matching `.auth-*` classes as each converts** so `globals.css` shrinks monotonically.
3. **Fix a11y inline with conversion:** route every error through DS `Banner role=alert`; restore `:focus-visible`; label OTP digits + group; wire real Terms/Privacy.
4. **Theme cleanup:** delete parallel `.dark` block + `rgb(5 8 16)`/`rgb(10 15 26)`; define/remove `--purple`; source all color/space/type from `--lb-*`.
5. **Build the missing surfaces DS-native** (MFA, passkeys, consent, session/device/org/team mgmt, security dashboard) as their waves land — never via shadow CSS.
6. **Delete the shadow stylesheet** once conversion completes (target: 1,986 → a few hundred lines of genuinely identity-specific CSS); flip lint rules to `error` (`IDENTITY_DESIGN_SYSTEM_ENFORCEMENT`).

**Effort:** convert 4 shadow pages + extract shell ≈ **M-L**; build ~8 missing surfaces ≈ **L** (but greenfield-DS, low risk). Each step is independently shippable.
