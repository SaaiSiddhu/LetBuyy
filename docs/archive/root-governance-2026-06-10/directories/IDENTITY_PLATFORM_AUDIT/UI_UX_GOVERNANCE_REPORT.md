# UI/UX GOVERNANCE REPORT
### Phase 8 of the Identity Platform Master Audit · 2026-06-09 · ANALYSIS-ONLY

## UI/UX GOVERNANCE SCORE: **56 / 100**

> Not "no design system." A **mature DS exists and is enforced by ESLint**, but the app is **mid-migration**: ~4 pages are DS-native and excellent, ~4 bypass the DS through an `unstyled` escape hatch backed by a **1,984-line hand-rolled shadow stylesheet**. The split-personality consistency is the dominant drag.

---

## 1. Inventory

- **Pages: 11** (10 `page.tsx` + 1 root redirect). **Components: 4** (`AuthIcon`, `BrandLogo`, `OAuthBrandIcon`, `TurnstileWidget`). **Forms: 8** (login, lookup, signup×3 steps, forgot, reset, set, onboarding). **Stylesheet: `src/app/globals.css` = 1,984 lines.**

| Page | File | Lines | Styling regime |
|---|---|---|---|
| Home redirect | `src/app/page.tsx` | 6 | `redirect('/lookup')` |
| Login | `src/app/login/page.tsx` | 373 | shadow CSS (`unstyled`×12) |
| Lookup | `src/app/lookup/page.tsx` | 634 | shadow CSS (`unstyled`×13) — ~90% clone of Login |
| Signup | `src/app/signup/page.tsx` | 720 | shadow CSS (`unstyled`×14) |
| Onboarding | `src/app/onboarding/page.tsx` | 1,090 | **mixed** — steps 1-3 DS-native, 4-6 shadow+inline |
| Select | `src/app/select/page.tsx` | 248 | hybrid |
| Check-email | `src/app/check-email/page.tsx` | 220 | **DS-native (gold standard)** |
| Forgot | `src/app/forgot-password/page.tsx` | 183 | **DS-native** |
| Reset | `src/app/reset-password/page.tsx` | 274 | **DS-native** |
| Set | `src/app/set-password/page.tsx` | 285 | **DS-native** |

---

## 2. Consistency findings

- **Two visual regimes for the same surface.** DS-native pages use `<Input label helperText error rightIcon>`, `Banner`, `ProgressBar`, `Badge`, token classes. Shadow pages render `<Button unstyled className="auth-btn-primary">` and `<Input unstyled className="auth-otp-input">`, styled entirely by `.auth-*` CSS. Same product, two implementations.
- **Top bar duplicated ~8×** — the lang/theme bar is a local `TopBar` component only in onboarding (`onboarding/page.tsx:1050`) and hand-inlined everywhere else (`login:207-214`, `lookup:415-422`, `check-email:136-143`, `signup:469-476`, `select:171-178`, `forgot:112-119`, `reset:178-185`, `set:179-186`).
- **login ≈ lookup**: ~282 identical non-blank lines (two routes shipping the same login screen — Phase 10 C12).

---

## 3. Accessibility (file:line)

**Good:** every input has `htmlFor`/`id` (`login:230-232`, `signup:491-493`); `AuthIcon` sets `aria-hidden`/`role="img"` correctly (`AuthIcon.tsx:51-56`); `BrandLogo` decorative imgs `alt=""`+`aria-hidden` with labelled wrapper (`BrandLogo.tsx:9-16`); DS pages link errors via `Input error=`/`Banner variant="critical"` (`reset-password:234,249`).

**Bad:**
- **No `role="alert"`/`aria-live` anywhere in page JSX** — the **9 custom `.auth-error` blocks are silent to screen readers** (`signup:513,585,695,697`; `lookup:496,590`; `login:243,330`; `onboarding:662`). Only the DS `Banner` path is announced.
- **Focus rings removed without replacement** — `outline:none` ×4 (`globals.css:371,432,1011,1498`), **0 `:focus-visible` rules**; shadow buttons have no focus style (WCAG 2.4.7).
- **Unlabelled OTP grid** — 6 identical text boxes, no per-digit `aria-label`/group role (`signup:568-582`).
- **Dead legal links** — `<a href="#">` Terms & Privacy (`signup:546`).
- **`aria-invalid`/`aria-describedby` used in only 2 places** (`signup:505-506`); other shadow fields lack programmatic error linkage.
- **Loading not announced** — `select:187` "Loading your sites…", `check-email` countdown lack `aria-live`.

---

## 4. State coverage

Loading/empty/error/success states all exist, but **inconsistently**: DS pages use `Button loading=` (`check-email:188`, `reset:257`); shadow pages use bare `'...'` text (`login:250,337`). Suspense fallbacks are inline-styled one-offs (`login:369`, `lookup:630`, `select:187`). Error states split into announced (DS `Banner`) vs silent (`.auth-error`) regimes.

---

## 5. Worst offenders → best exemplars

**Worst:** `onboarding/page.tsx` (three paradigms in one 1,090-line file; orphan `.auth-label`/`.auth-input` at `:885,908,948,950`); `globals.css` (the shadow DS); `lookup`+`login` (90% clone); `signup` (silent errors, unlabelled OTP, dead links).
**Best (set the bar):** `reset-password`, `set-password`, `forgot-password`, `check-email` — fully DS-native, accessible errors, token-driven. The team knows the right pattern; **adoption is the gap, not capability.**

## 6. Score rationale (56/100)
High accessibility/consistency ceiling on DS pages, systemic gaps on legacy pages (9 silent errors, removed focus rings, dead links, unlabelled OTP, 8× duplicated top bar, login/lookup clone). Strong upward trajectory as the visible migration completes. Deductions: −18 accessibility (announce/focus), −14 consistency (two regimes), −8 duplication, −4 dead/placeholder UI.
