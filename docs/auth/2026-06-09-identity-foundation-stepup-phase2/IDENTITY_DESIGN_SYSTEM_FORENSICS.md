# IDENTITY DESIGN SYSTEM FORENSICS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · measured against CURRENT tree (post Wave-0/3 edits)

> Code is truth. All counts re-measured this pass against `apps/identity-platform/src`. Where this differs from earlier reports it is because real fixes were applied (a11y focus ring, signup semantics, `--purple`) — those are reflected.

## Compliance scorecard (measured)
| Dimension | Compliance | Basis (file:line / count) |
|---|--:|---|
| Design-system (overall) | **~45%** | strong infra, low adoption (below) |
| Token compliance | **~40%** | color ~73% tokenized in CSS, but spacing/type ~0% (429 raw `px`, 77 `font-size:` in `globals.css`) |
| Component compliance | **~19%** | **76 `unstyled`** of ~94 DS Button/Input instances (~81% bypassed) |
| Typography compliance | **~15%** | 77 hardcoded `font-size:` in `globals.css`; DS type scale bypassed |
| Spacing compliance | **~10%** | 429 raw `px` in `globals.css` + 42 inline `style={{}}` |
| Accessibility compliance | **~60%** | improved: `:focus-visible` app-wide (7 refs), signup announced (4 `role="alert"`) + OTP labeled; **but 5 silent errors remain** + 2 dead links + only 1 `aria-invalid` |
| Responsive compliance | **~65%** | 5 `@media` in `globals.css`; **0** Tailwind responsive prefixes in TSX; relies on DS-component responsiveness |
| Theme compliance | **~70%** | real provider; `--purple` fixed → 0 reachable undefined tokens; parallel `.dark` block + 60 raw `rgb()` remain |

## Per-surface-type audit (what exists vs the target's needs)
| Surface type | Count in app | Finding |
|---|--:|---|
| Pages | 10 | 4 mostly-DS (`forgot`/`reset`/`set`/`check-email` — but even these carry 2/6/4/2 `unstyled`), 5 shadow-CSS (`login`/`lookup`/`signup`/`onboarding`/`select`) |
| Layouts | 1 (`layout.tsx`) | real DS provider; 1 `rgb()` literal (`:102`) |
| Forms | 8 | DS `Input`/`Button` imported then `unstyled`; shadow `.auth-field` styles them |
| Alerts | shadow `.auth-error` + DS `Banner` | two regimes; shadow path was screen-reader-silent (now fixed only in signup) |
| **Modals / Dialogs / Sheets / Drawers** | **0** | do not exist |
| **Dropdowns / Popovers / Tooltips** | **0** | the "user menu" is a hand-rolled `showUserMenu` show/hide (`select`/`onboarding`), not a DS primitive |
| **Tables** | **0** | do not exist |
| **Toasts** | **0** | do not exist |
| **Tabs / Accordion** | **0** | do not exist |

**Reading:** the app is **forms-only.** The frozen target requires consent screens, session/device tables, MFA enrollment dialogs, org switchers, and toasts — **none of which exist as DS primitives.** This is both a design-system gap and a foundation-readiness gap (`IDENTITY_FOUNDATION_READINESS.md`).

## Violation inventory (evidence)
| Violation | Count | Representative evidence | Severity |
|---|--:|---|:--:|
| `unstyled` DS components (the core loophole) | 76 | `login:245,332`; `signup:502,525,580`; per-page: login 12 / lookup 13 / signup 14 / onboarding 19 / select 4 / reset 6 / set 4 / check-email 2 / forgot 2 | **S1** |
| Shadow design system (`globals.css`) | 2,005 LOC | `.auth-btn*`, `.auth-field`, `.auth-otp-input` re-implement DS primitives | **S0** |
| Hardcoded `px` (spacing/size) | 429 | `globals.css` pervasive | **S1** |
| Hardcoded `font-size:` | 77 | `globals.css` | **S1** |
| Raw `rgb()/rgba()` in CSS | 60 | `globals.css:21-39,476,1108` | **S2** |
| Inline `style={{}}` | 42 | `onboarding` (33), `login`/`lookup`/`select` (9) | **S2** |
| Hex in TSX | 0 | lint `no-hardcoded-hex: error` works | — |
| Parallel token namespace | — | `--text-*`/`--bg-*`/`--input-bg` defined with raw `rgb()` (`globals.css:5-40`), separate from `--lb-color-*` | **S2** |
| Custom shadows/borders | present | shadow `.auth-card`/`.auth-btn` box-shadows + 1px borders not tokenized | **S3** |

## What's genuinely strong (keep)
`@letbuyy/ui` v1.0.0 dependency + `LetbuyyThemeProvider`/`ThemeScript` + enforced ESLint (`eslint.config.mjs:11-22`) + 0 hex in TSX. The infrastructure is real (~80); the gap is **adoption** (~25). The 4 DS-native pages prove the target pattern.

## Recommendation (analysis-only)
The number rises automatically as the conversion in `docs/auth/2026-06-09-identity-execution-recovery/DESIGN_SYSTEM_RECOVERY_REPORT.md` proceeds (delete shadow CSS, remove the 76 `unstyled`, build the missing primitives DS-native). Promote the 3 `warn` lint rules to `error` + add an `unstyled`-ban rule after conversion. **Severity: the shadow design system (S0) is the single biggest design-system debt; the absent overlay/table/toast primitives (S1) block the target surfaces.**
