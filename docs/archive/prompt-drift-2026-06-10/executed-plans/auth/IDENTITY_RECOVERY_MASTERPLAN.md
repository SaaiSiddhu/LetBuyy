# IDENTITY RECOVERY MASTERPLAN
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · synthesis of the 6 forensic docs (current tree)

> Single planning view across `IDENTITY_DESIGN_SYSTEM_FORENSICS`, `IDENTITY_THEME_FORENSICS`, `IDENTITY_UI_GOVERNANCE_FORENSICS`, `IDENTITY_AUTH_UX_FORENSICS`, `IDENTITY_CODE_HEALTH_FORENSICS`, `IDENTITY_FOUNDATION_READINESS`. Architecture is frozen; this is *how to recover*, not *what to design*. Aligns with the already-applied Wave 0/3/4 fixes and the build-gated waves in `docs/auth/2026-06-09-identity-execution-recovery/`.

## 1. Severity-ranked findings (front-end recovery scope)
| Rank | Finding | Sev | Source doc |
|---|---|:--:|---|
| 1 | Shadow design system (2,005-LOC `globals.css`) + 76 `unstyled` = a parallel design system | **S0** | DS §violation |
| 2 | `login`≈`lookup` clone (282 lines), both live, already drifting | **S0** | UI-GOV |
| 3 | 5 target surfaces absent (session/device mgmt, MFA/passkey enroll, consent, security dashboard) + 0 overlay/table/toast primitives | **S1** | DS / AUTH-UX / READINESS |
| 4 | Duplicate **security** primitives (2 Turnstile, dev-bypass forks) — divergence = vulnerability | **S1** | CODE-HEALTH |
| 5 | 9× page boilerplate + no `AuthShell` | **S1** | UI-GOV |
| 6 | Split-personality consistency (4 DS-native vs 5 shadow flows) | **S1** | AUTH-UX |
| 7 | Spacing/typography ~0% tokenized (429 px, 77 font-size) | **S1** | DS |
| 8 | Residual a11y: 5 silent errors (login/lookup/onboarding), 2 dead links, sparse `aria-invalid` | **S2** | AUTH-UX |
| 9 | Parallel `.dark` block + 60 raw `rgb()` (theme leakage) | **S2** | THEME |
| 10 | `/lookup` enumeration UX (contradicts reset/magic privacy) | **S2** | AUTH-UX |
| 11 | base64url/timingSafeEqual sprawl; reset≈set UI dup; gateway dual auth backend | **S2** | CODE-HEALTH |

(Security S0s — switch ATO, console secret, mock KMS — are **already fixed in code** in Wave 0; tracked in the execution-recovery folder, not re-listed here.)

## 2. Dependency graph (execution order)
```
[Wave 0 Security — DONE in code] ──► (human build + security review)
        │
        ├──► A. AuthShell + i18n module (centralize)  ─┐
        │                                              ├──► B. Convert shadow pages → DS  ──► C. Delete shadow globals.css ──► D. Flip lint to error
        ├──► A2. login+lookup merge ───────────────────┘                                   │
        │                                                                                  └──► E. Theme cleanup (delete parallel .dark, tokenize)
        ├──► F. Consolidate security primitives (1 Turnstile, 1 CSRF, 1 dev-bypass) [build]
        │
        └──► G. Build missing surfaces DS-native (session/device/MFA/passkey/consent/security-dashboard)
                   └── (G depends on the Session service + MFA from the execution waves 3-5)
```
**Critical path for front-end recovery:** A → B → C/D/E (the design-system + theme recovery). **G** (missing surfaces) is gated on the backend session/MFA waves. **F** is independent and high-priority (security drift).

## 3. Quick wins (safe, hours-to-days, low risk)
- ✅ **DONE this engagement:** `--purple` token fix; app-wide `:focus-visible`; signup `role="alert"` + OTP labels; runnable security gate; one dev-bypass fork removed.
- **Extend `role="alert"` to `login`/`lookup`/`onboarding`** (5 remaining silent blocks) — pure attribute additions, no build risk.
- **Wire real Terms/Privacy URLs** (replace `href="#"`, `signup:556`) — needs the URLs (content decision).
- **Delete the parallel `.dark` block** + the 2 hardcoded bg literals — small CSS edits.

## 4. Refactor classification
**Mandatory (foundation blockers — can't reach target without):** real key service + OIDC endpoints; one session service (rotation/reuse/idle); merchant MFA + passkeys + account-recovery; RLS tenant safety net.
**Safe (do with a build loop):** `AuthShell`/`AuthLayout` extraction; per-page DS conversion (with visual diff); token cleanup; reset/set strength-UI dedup.
**Dangerous (high blast radius — stage carefully):** deleting `globals.css` (must follow full conversion); cross-app security-primitive consolidation (Turnstile/CSRF across Next+Hono runtimes); `service_role` decomposition; flipping KMS hard-fail in prod; enabling OIDC/`FEATURE_NEW_KEY_SERVICE` flags.

## 5. Deletion candidates
Legacy Supabase auth path (`routes/auth.ts:1214-1372`, Wave 7); in-memory auth Maps (`routes/auth.ts:82-85`); `lb_csrf` dual name; shadow `.auth-*` (~1,700 LOC, post-convert); orphan `.auth-label`/`.auth-input`. **Do NOT delete:** the dormant `*-core`/`identity-foundation`/`oauth2`-skeleton/migration-159 frozen target.

## 6. Consolidation candidates
One **auth-runtime module** (Turnstile + CSRF + dev-bypass + cookie-domain — collapses the 4 drift-dangerous clusters); **`AuthShell`** (kills 9× chrome/i18n dup); one **i18n module**; shared **base64url/timingSafeEqual** in `auth-core`; **login+lookup** → one screen; **reset+set** strength UI → one component.

## 7. Risk analysis
- **Highest risk if untouched:** the two divergent Turnstile validators (bot-bypass drift) and the unconverted shadow system blocking the "reference UX" mandate.
- **Highest risk if done blind:** any sweep that can't be build-verified (this sandbox can't compile) — hence the build-loop gating.
- **Sequencing risk:** building the missing surfaces (G) before the session/MFA backend exists would create throwaway UI — gate G on execution Waves 3-5.

## 8. Effort (one front-end squad + the identity backend squad)
Quick wins **S** (days) · AuthShell + login/lookup merge **M** · full DS conversion + globals.css deletion **M-L** · theme cleanup **S** (rides with conversion) · security-primitive consolidation **M** · build 5 missing surfaces **L** (gated on backend). Front-end recovery to ≥95% DS/theme compliance ≈ **1 quarter** with a dedicated squad; full foundation readiness (incl. OIDC/session/MFA) ≈ the 2-3 quarter program in the execution masterplan.

## 9. Definition of done (front-end recovery)
DS compliance ≥95%; `globals.css` ≤ ~300 LOC (identity-specific only); 0 `unstyled` on DS components; 0 reachable undefined tokens (✅ already) + 0 parallel `.dark`/raw-rgb; all flows DS-native + `AuthShell`; WCAG 2.1 AA on every surface; login/lookup unified; the 5 missing surfaces built DS-native; lint/stylelint gates at `error`. Then — and only then, with the strict gate satisfied — the OIDC/SSO waves may begin.
