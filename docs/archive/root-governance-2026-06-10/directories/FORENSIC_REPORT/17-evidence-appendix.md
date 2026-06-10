# Evidence Appendix

**Investigation date:** 2026-06-05 (second pass, post-remediation; HEAD `127a850e` on `develop`)
**Purpose:** Consolidated proof layer for the report set: (A) the second‑pass fact‑check log re‑verifying resolved and newly‑introduced findings, (B) the first‑pass fact‑check log (retained), (C) reproducible commands, (D) corrections and investigation conditions. Per‑finding evidence lives in each domain report's own "Evidence Index"; this appendix records the *cross‑checking*.

**Method:** A separate fact‑checking pass re‑derived each claim from source (reads + greps) without relying on the originating report. Verdicts: **CONFIRMED / PARTIALLY‑CONFIRMED / REFUTED / CANNOT‑VERIFY**. Paths relative to repo root `/Users/saai_sidd/Git/Letbuyy_Store`.

---

## A. Second-pass fact-check log (10 highest-stakes claims)

| # | Claim (abbreviated) | Verdict | Evidence |
|---|---|---|---|
| 1 | Internal payment routes FAIL OPEN off‑prod; siblings fail closed | **CONFIRMED** | `routes/storefront/internal-payment-routes.ts:71‑76` `if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true;` guards all 5 endpoints (109/129/154/185/212). `internal-billing.ts:49‑53` & `internal-events.ts:20‑24` `if (!secret) return false;`. `wrangler.toml:27` `ENVIRONMENT = "staging"`; `INTERNAL_API_SECRET` in no `[vars]`. Prod fails closed (`:210`). |
| 2 | App access_token + show‑once signing_secret persisted plaintext ~24h | **CONFIRMED** | `app-store.ts:2146` `access_token: accessToken`, `:2154` `signing_secret: defaultSigningSecret`, `:2158` `idempotency.complete({ responseBody: installResponse })`; adapter `idempotency-execution.adapter.ts:151‑156` writes `response_body`, `:69` TTL `24*60*60`, `:112‑118` returns it on replay. DB `app_installations.config` stores only `access_token_hash` (`:2051`). |
| 3 | `gateway-events.ts` duplicated webhook‑service ↔ queue‑workers | **CONFIRMED** (nuance) | Both files exist (1541 B / 1490 B); `diff` differs only in indentation/quotes + binding import‑vs‑inline; logic line‑identical. `"API_GATEWAY_SERVICE binding is required"` in **8 files** (4 source + 4 tests). |
| 4 | theme‑marketplace checkout "Pay" still a fake success `<Link>` | **CONFIRMED** | `apps/theme-marketplace/src/app/checkout/page.tsx:206‑217` `<Link href={\`/checkout/success?theme=${theme.slug}\`}>` with toast‑only onClick; only `fetch` is `:89` (loads theme); PSP buttons `:143‑163` set local state only. |
| 5 | `CODEX_WS9_LEDGER.md` inside a Next route segment; ~8 CODEX_*.md at root | **CONFIRMED** | `apps/merchant-control-plane/src/app/[store]/settings/CODEX_WS9_LEDGER.md` exists; root has exactly 8 `CODEX_*.md`; strays also at `packages/typescript/ui/` and `apps/developer-portal/`. |
| 6 | Governance "(129 validators)"; single‑writer validator exists with that table list | **CONFIRMED** | `node scripts/validate-governance.mjs` → exit 0, `Governance validation passed (129 validators).` + `Single-writer ownership validator passed (107 source files checked)`. Validator `:23‑27` lists orders/products/subscriptions/sites/billing_history/outbox_events. |
| 7 | Crypto helpers re‑declared in `storefront.ts`, byte‑similar to `lib/crypto.ts` | **PARTIALLY‑CONFIRMED** | `storefront.ts:1791/1804/1819` re‑declare `timingSafeEqualHex`/`hmacSha256Hex`/`sha256Hex`; first two char‑identical to `lib/crypto.ts:10‑21/23‑36` (minus `export`); storefront imports nothing from `lib/crypto`. **Correction:** `lib/crypto.ts` has NO `sha256Hex` (only the two), so the third duplicates *other* inline copies (e.g. idempotency adapter), not crypto.ts. |
| 8 | The two new `.ts` contract tests run in no runner | **CONFIRMED** | Root `package.json` `test`=`node --test tests/*/*.test.mjs` (`.mjs` only); `api-gateway` `test`=`echo 'No tests yet'`; `.github/workflows/*` run `pnpm turbo test` / `pnpm run test` (no `tsx`); `test-coverage-governance-validator.mjs:67‑76` lists only `.mjs`. Zero `tsx` in any package.json. |
| 9 | Editor preview still mock; CenterPanel.tsx orphan | **CONFIRMED** | `…/editor/page.tsx:191‑200` `const PREVIEW_PRODUCTS = [...]`; `PreviewCanvas` invoked `:1401`, defined `:1842` (React divs, no iframe); `components/theme-editor/CenterPanel.tsx` grep across merchant‑control‑plane src (excl. itself) = 0 importers. |
| 10 | AGENTS.md line ~85 lists only 8 web apps (omits developer‑portal) | **PARTIALLY‑CONFIRMED** | `AGENTS.md:85` lists 8 web apps, no `developer-portal`, while CLAUDE.md includes it. **But** AGENTS.md `:22` does mention `Developer Portal: apps/developer-portal` — so it's an internal AGENTS.md inconsistency (line 22 vs 85) + an AGENTS.md↔CLAUDE.md mismatch, not a total omission. |

**Second‑pass score:** 8 CONFIRMED, 2 PARTIALLY‑CONFIRMED, 0 REFUTED. No claim overturned; the two refinements are citation‑level.

## B. First-pass fact-check log (retained — 14 claims)

13 CONFIRMED, 1 PARTIALLY‑CONFIRMED (vestigial unused `carts` table), 0 REFUTED. Key items (all still valid at second pass unless a §A row supersedes): single‑gateway monolith; 6 manifest‑only services; app token one call site; compliance topics never published; app billing fabricated refs; editor preview mock; operator‑app counter demo; theme‑marketplace fake checkout; all‑12 no‑op test scripts; `storefront.ts` god file; `@letbuyy/utils` 8/0 dead edge; no committed secrets; Wasm memory limit unenforced. Full table in the first‑pass git history of this file.

## C. Reproducible commands & captured output

**C‑1. Governance — passes at the new count.**
```
$ node scripts/validate-governance.mjs
…
Single-writer ownership validator passed (107 source files checked).
…
Governance validation passed (129 validators).
EXIT: 0
```
The new validator (#129) is `single-writer-ownership-validator.mjs`. The green result now genuinely covers single‑writer ownership and the reconciled runtime map — it certifies more than the first‑pass 128 did, but still not runtime behavior, N‑1's off‑prod branch, or the open product Criticals.

**C‑2. Single‑writer proof.**
```
$ grep -RnE "\.(insert|update|upsert|delete)\(|patchRows\((env, ?)?\"(orders|products|subscriptions|sites|billing_history|outbox_events)\"" services/webhook-service/src services/queue-workers/src
# → only payment_webhook_events writes remain in webhook-service; gateway-owned tables: 0
```

**C‑3. New surface map (edges added since first pass).**
```
/v1/internal/billing/subscriptions/{activate,sync,invoice}     routes/internal-billing.ts      (fail-closed)
/v1/internal/events/domain                                     routes/internal-events.ts       (fail-closed, Zod)
/v1/storefront/internal/payments/{confirm,failure,event,reference} + /internal/orders/:id/payable
                                                               routes/storefront/internal-payment-routes.ts (FAIL-OPEN off-prod — N-1)
```

**C‑4. Test‑script reality.**
```
$ grep -h '"test"' apps/*/package.json services/*/package.json
# webhook-service, queue-workers → real `node --test …`; the other 10 → "echo 'No tests yet' && exit 0"
```

**C‑5. God‑file size after the split.**
```
$ wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/internal-payment-routes.ts
4833  storefront.ts        # was ~4,826 first pass — net grew despite the extraction
 233  internal-payment-routes.ts
```

## D. Corrections, caveats & investigation conditions

1. **Commit window.** `63053d18..HEAD` = `127a850e`; 68 commits, 292 files, +21,140 −8,527; all dated 2026‑06‑05 IST. Two reports' agents independently measured the window (68 commits) consistently.
2. **Repo edited during BOTH passes.** During this second pass, several `FORENSIC_REPORT/*` files were modified concurrently by the parallel report agents; **no source file under apps/services/packages changed mid‑pass** (verified). Only untracked file: `.claude/settings.local.json`.
3. **`pnpm`/`node_modules` unavailable in this environment** — standalone per‑workspace `tsc`/`pnpm turbo` could not be reproduced; the remediation ledger's "typecheck 60/60 + lint pass" is recorded as a **claim**, while governance 129/129 was independently reproduced. Import‑integrity relied on path/grep analysis.
4. **Numbering note.** `FORENSIC_REPORT/` contains the canonical `00`–`17` set plus residual earlier‑run stub files (`03-application-reports.md`, `08-dead-code.md`, `09-duplication.md`, `10-architecture-violations.md`, `11-shopify-gap-analysis.md`, `12-technical-debt.md`, `13-risk-assessment.md`, `14-evidence-appendix.md`) left in place at the user's instruction. The canonical set is listed in [README.md](README.md); the stubs are superseded. A separate `FORENSIC_REPORT_OPERATIONS/` (16 files) was produced by another process and is outside this investigation.
5. **Citation drift.** Several line anchors moved between passes (e.g. `verifyAppScopedAccessToken` call 1253→1263; app install 1943→1953; fabricated ref 1541→1551). Domain reports carry current anchors; this appendix uses second‑pass numbers.
6. **Two refinements (not reversals).** §A‑7: `sha256Hex` duplicates inline copies, not `lib/crypto.ts` (which lacks it). §A‑10: `developer-portal` does appear at `AGENTS.md:22`, just not in the line‑85 canonical list.

---

### Provenance
Each domain report (`01`–`14`) has its own "Method" + "Evidence Index" with current anchors and a "Changes since first pass" section. This appendix records only the cross‑cutting verification. No command modified, created, deleted, moved, or renamed any platform file; the only writes were the report files in `FORENSIC_REPORT/`.
