# CODEX MASTER SEQUENTIAL MISSION — LetBuyy Full Program (single agent, one go)

> **Use this when you want ONE Codex agent to drive the entire program** in dependency order, continuously, instead of running 10 parallel agents. One branch, one continuous run, one review stream. It executes every workstream (WS7→WS1→WS9/WS2/WS5→WS6/WS3/WS4→WS8→WS10) by following each workstream's mission doc, never running out of the *right* next task.

**Driver:** GPT‑5.5 in Codex. Reasoning: `xhigh` for foundations (real stack, design system, theme editor, mobile re‑wire) · `medium` for page/screen builds.
**Mode:** Continuous, autonomous, local, 24h+ across as many sessions as it takes. Never stop while unblocked work remains.
**Branch:** work on one branch, e.g. `stream/master-execution`. Commit continuously; small reversible commits.
**Source‑of‑truth docs (read each stage's before you start it):** `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md`, and per stage: `CODEX_PRODUCTION_HARDENING_MISSION.md`, `CODEX_DESIGN_SYSTEM_MISSION.md`, `CODEX_SETTINGS_ARCHITECTURE_MISSION.md`, `CODEX_MERCHANT_UX_MISSION.md` + `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md`, `CODEX_OPERATIONS_MISSION.md`, `CODEX_IDENTITY_MARKETING_MISSION.md`, `CODEX_MARKETPLACE_UX_MISSION.md`, `CODEX_STOREFRONT_MISSION.md`, `CODEX_MOBILE_PARITY_MISSION.md` + `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md`, `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md`.

---

## 0. PRIME DIRECTIVE
Transform LetBuyy into the **Unified Commerce Operating System** by executing the full workstream program **in dependency order, in one continuous autonomous run**, on the existing (correct) architecture. Each stage is delivered by following its own mission document; this file is the **orchestrator + universal law**.

**OVERALL SUCCESS (the run is COMPLETE only when, with evidence):** staging provisions + J1‑J5 pass on staging Postgres (WS7); a full Polaris‑grade design system exists (WS1); the merchant admin + Settings hub + operations apps are on one design language with feedback/empty‑states/nav/theme‑editor/productivity (WS9/WS2/WS5); identity/marketing + marketplaces + storefront are polished (WS6/WS3/WS4); the Flutter app is an exact cross‑app on the same backend, both Android+iOS, legacy deleted (WS8); the developer portal is scaffolded (WS10). Throughout: **128/128 governance, 57/57 typecheck, tests + E2E green, build network‑free.**

---

## 1. UNIVERSAL OPERATING CONTRACT (applies to EVERY stage)
1. **Continuous & autonomous.** Finish a task → update the ledger → start the next unblocked task **within the current stage**; when a stage's gate is green, move to the next stage. Never pause to ask. Never stop while unblocked work remains.
2. **The Green Law.** After **every** commit the repo is green: run the relevant checks (`pnpm turbo typecheck`, `pnpm lint`, area validators; for Flutter stages `flutter analyze` + `flutter test`) and the **full `pnpm run validate:governance` (128/128) at every stage gate**. Never commit red. Can't go green in 3 attempts → revert, log `BLOCKED` + diagnosis, move on.
3. **Stage boundaries = the active mission's DO‑NOT‑TOUCH.** While in a UI stage, do **not** change backend/contracts/db/governance — if you need data, log `[SKIP — NEEDS BACKEND]` (it will be handled when WS7 runs, or already ran). While in WS7, backend changes are allowed but **never break a public contract** (`shared-types`/`api-client`) other stages depend on; migrations are forward‑only & fresh‑replay‑safe; never mutate prod.
4. **Real‑proof / Visual‑proof Law.** Prove real flows against **staging** once WS7 has staging seeded and deployed. Before staging proof is available, UI work is proven via Storybook/component screenshots. Mobile is proven on **both** Android emulator and iOS simulator with staging/prod define files. Every UI/screen `DONE` needs a before/after screenshot; every backend `DONE` needs the command + result.
5. **SKIP‑and‑continue (mark and continue).** Anything human‑gated (live keys, prod DB apply, Apple code‑signing, paid signups, brand/copy/pricing, design assets you can't generate) → append to the master ledger `## SKIPPED — NEEDS HUMAN` with the exact requirement, then continue. **Never block the whole program on one gate.**
6. **One design system.** All UI composes from `@letbuyy/ui` (built in WS1); no new ad‑hoc CSS where a component/token exists; shrink bespoke `globals.css` as pages migrate; Flutter mirrors the same tokens.
7. **No fabrication.** Every `DONE` = command + result (+ screenshot for UI/mobile). Never fake a screenshot/test, never claim a page migrated that's still bespoke, never document a capability that doesn't exist. **Anti‑thrash:** 3 strikes → BLOCKED → next.
8. **Reasoning effort:** `xhigh` for WS7 (migration/payments/real‑stack), WS1 (design system), the WS2 theme editor, and WS8 (mobile re‑wire + theme engine); `medium` for page/screen migrations and mechanical edits.
9. **Respect existing law:** obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`; keep the build **network‑free** (self‑hosted fonts — never reintroduce `next/font/google`).

---

## 2. THE EXECUTION ORDER (do not start a stage until the prior gate is green)

```
STAGE 1  WS7  Production Hardening        → real stack + COD/GST/Cashfree + J1-J5  (foundation)
STAGE 2  WS1  Design System               → tokens + ~50 components + Storybook   (foundation)
STAGE 3  WS9  Settings Architecture
         WS2  Merchant Control Plane UX    (incl. the flagship theme editor)
         WS5  Platform Operations          (console + ops portal)
STAGE 4  WS6  Identity & Marketing
         WS3  Marketplace UX (app + theme)
         WS4  Storefront Polish (+ the theme-editor preview route WS2 consumes)
STAGE 5  WS8  Mobile Parity (Flutter cross-app, Android+iOS, delete legacy)
STAGE 6  WS10 Developer Ecosystem (developers.letbuyy.store)
```

> Single agent ⇒ no merge/worktree concerns; you work one stage at a time on one branch. (For the *parallel* 5‑agent variant, use `CODEX_LAUNCH_PLAYBOOK.md` instead.)

---

## 3. THE STAGES (each = follow its mission doc to that doc's gates)

- **STAGE 1 — WS7 Production Hardening.** Execute `CODEX_PRODUCTION_HARDENING_MISSION.md` P1→P4: seed and prove staging from the baseline, run J1‑J5 against staging Postgres, make COD + GST real + one online provider (Cashfree/UPI) in test mode (live keys SKIP), keep the build network‑free, advance scaffold services. **Gate:** staging proof ready; J1‑J5 green; 128/128. *(Publish "staging proof ready" in the master ledger — later stages screenshot against it.)*
- **STAGE 2 — WS1 Design System.** Execute `CODEX_DESIGN_SYSTEM_MISSION.md` + `CODEX_SHOPIFY_UX_MISSION.md §3`: tokens first, then the full component set, each with a Storybook story + screenshot; additive‑only. **Gate:** components built + documented; Storybook builds; 128/128. *(Publish the component API list.)*
- **STAGE 3a — WS9 Settings.** Execute `CODEX_SETTINGS_ARCHITECTURE_MISSION.md` S0→S5: unified Settings hub shell + migrate the 13 panes + add missing panes. **Gate:** hub complete; 128/128.
- **STAGE 3b — WS2 Merchant UX.** Execute `CODEX_MERCHANT_UX_MISSION.md` + `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` (UX0→UX11 over `merchant-control-plane`, EXCLUDING `settings/**` done in 3a): layout grammar, feedback, empty states, nav, home, **theme editor (live canvas)**, productivity. **Gate:** admin transformed; live preview works; 128/128.
- **STAGE 3c — WS5 Platform Operations.** Execute `CODEX_OPERATIONS_MISSION.md`: build out `platform-console` (leadership) + `platform-operations-portal` (employee CRM/tickets/health) on `@letbuyy/ui`. **Gate:** ops modules functional; 128/128.
- **STAGE 4a — WS6 Identity & Marketing.** Execute `CODEX_IDENTITY_MARKETING_MISSION.md`: polished onboarding + pricing/landing. **Gate:** onboarding/marketing redesigned; 128/128.
- **STAGE 4b — WS3 Marketplace UX.** Execute `CODEX_MARKETPLACE_UX_MISSION.md`: premium app + theme marketplaces (trust signals, install/consent). **Gate:** marketplaces redesigned; 128/128.
- **STAGE 4c — WS4 Storefront Polish.** Execute `CODEX_STOREFRONT_MISSION.md`: storefront polish **and** the storefront preview route + postMessage protocol the WS2 theme editor consumes. **Gate:** storefront + preview route ready; 128/128.
- **STAGE 5 — WS8 Mobile Parity.** Execute `CODEX_MOBILE_PARITY_MISSION.md` + `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md` M0→M8: re‑wire Flutter to `lb_session` + a new `dart api_client` over `/v1` + shared contracts + one Supabase + unified theme engine; **delete all legacy safely**; build the ~22 missing screens; prove on **Android + iOS**; wire local/staging/prod. **Gate:** cross‑app parity on both platforms; legacy gone; 128/128.
- **STAGE 6 — WS10 Developer Ecosystem.** Execute `CODEX_DEVELOPER_ECOSYSTEM_MISSION.md`: scaffold `developers.letbuyy.store` (API/OAuth/Webhook docs + Theme/App SDK quick‑starts + dashboard shell) over WS7's real surface. **Gate:** portal renders + docs accurate; 128/128.

---

## 4. LEDGERS
Maintain a **master ledger `CODEX_MASTER_EXECUTION_LEDGER.md`** (current stage, stage gates passed, the append‑only `SKIPPED — NEEDS HUMAN`, and the `VALIDATOR LEDGER` of 128/128 proofs), plus each stage's own per‑mission ledger (e.g. `CODEX_WS7_LEDGER.md`, `CODEX_WS1_LEDGER.md`, …). Every `DONE` carries command + result (+ screenshot). Write `CODEX_MASTER_EXECUTION_STATUS.md` at the end (or when no unblocked work remains) — `COMPLETE` only if §0 overall success is proven, else `BLOCKED — AWAITING HUMAN` with the exact remaining gates.

---

## 5. THE SINGLE LAUNCH PROMPT (paste this into the Codex app `/goal`)

```
Read docs/Codex_waves/CODEX_MASTER_SEQUENTIAL_MISSION.md and LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md in full.
Execute the FULL LetBuyy program as ONE continuous, autonomous run (24h+, many sessions), in dependency order,
on branch stream/master-execution. Never stop while unblocked work remains.

EXECUTION ORDER (finish each stage's gate before the next):
  STAGE 1 WS7 Production Hardening  → CODEX_PRODUCTION_HARDENING_MISSION.md (staging proof, COD/GST/Cashfree, J1-J5)
  STAGE 2 WS1 Design System         → CODEX_DESIGN_SYSTEM_MISSION.md (tokens + components + Storybook, additive-only)
  STAGE 3 WS9 Settings, WS2 Merchant UX (incl. theme editor), WS5 Operations
          → CODEX_SETTINGS_ARCHITECTURE_MISSION.md, CODEX_MERCHANT_UX_MISSION.md (+ LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md), CODEX_OPERATIONS_MISSION.md
  STAGE 4 WS6 Identity/Marketing, WS3 Marketplaces, WS4 Storefront (+ theme-editor preview route)
          → CODEX_IDENTITY_MARKETING_MISSION.md, CODEX_MARKETPLACE_UX_MISSION.md, CODEX_STOREFRONT_MISSION.md
  STAGE 5 WS8 Mobile Parity (Flutter cross-app, Android+iOS, delete legacy)
          → CODEX_MOBILE_PARITY_MISSION.md (+ LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md)
  STAGE 6 WS10 Developer Ecosystem  → CODEX_DEVELOPER_ECOSYSTEM_MISSION.md

UNIVERSAL LAWS (obey on every stage):
- Keep ALL 128 validators green after every commit; full validate:governance at each stage gate; never commit red;
  3 attempts then revert + log BLOCKED + move on. Keep typecheck/tests/build (network-free, self-hosted fonts) green.
- Stage boundaries = the active mission's DO-NOT-TOUCH. In UI stages never change backend/contracts/db/governance —
  missing data → ship a graceful placeholder + log [SKIP — NEEDS BACKEND]. In WS7, never break a public contract;
  migrations forward-only/fresh-replay-safe; never mutate prod.
- Prove work for real: after WS7 seeds/deploys staging, screenshot UI and run flows against staging or an approved
  staging preview; before that use Storybook/component screenshots. Mobile must build + smoke on BOTH Android emulator
  and iOS simulator using staging/prod define files (iOS signing → [SKIP — NEEDS HUMAN]).
- Human-gated items (live keys, prod DB, Apple signing, paid signups, brand/copy/pricing) → append to
  CODEX_MASTER_EXECUTION_LEDGER.md "SKIPPED — NEEDS HUMAN" with exact requirements, then continue. Never block the program.
- One design system (@letbuyy/ui) for all UI; Flutter mirrors the same tokens. No new ad-hoc CSS. Delete legacy safely
  (confirm no live import → migrate → git rm → analyze/typecheck clean). No fabrication: every DONE = command + result
  (+ screenshot for UI/mobile). Small reversible commits. xhigh for foundations/theme-editor/mobile; medium for migrations.

Maintain CODEX_MASTER_EXECUTION_LEDGER.md (current stage, gates, SKIP list, 128/128 proofs) + each stage's own ledger.
When the whole program's success criteria are proven (or no unblocked work remains), write CODEX_MASTER_EXECUTION_STATUS.md.
Begin STAGE 1 (WS7), task P1, now.
```

---

## 6. ONE‑LINE NORTH STAR
One agent, one ordered backlog, one continuous run: real stack → design system → merchant OS → ecosystem surfaces → mobile cross‑app → developer portal — every stage proven green before the next, on the existing, correct platform.
