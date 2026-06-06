# MERGE RUNBOOK — land both streams into `develop`, then run V2

**Why this exists:** the V2 precondition gate correctly **blocked** (neither branch is in `develop`; Codex made zero changes). But inspection found the two streams have an **unintended scope overlap inside `packages/typescript/ui`** that a naive merge would resolve wrong and **silently break ~29 app files**. Follow this exactly.

## The overlap (what conflicts and why)
Both branches were cut from `develop@127a850e`. The broad `stream/letbuyy-foundation-v2` **also edited 6 files inside `packages/typescript/ui`** (it was supposed to leave the package to the UI stream). The collisions:

| File | foundation-v2 has | ui-foundation has | Resolution |
|---|---|---|---|
| `src/formatting.ts` | 8 fns incl. `formatInrCurrency`, `formatDisplayDate`, `formatIndiaDate(+Time/WithTime/DayMonthTime)`, `formatUsShortDate`, `formatUsLongDate` | 3 **different** fns: `formatCurrency`, `formatDate`, `formatNumber` | **UNION both** |
| `src/index.ts` | exports `formatInrCurrency` (+type) | exports `formatCurrency`/`formatDate`/`formatNumber` (+types) **and** all the new components/tokens | **UNION the formatting exports; take ui-foundation for everything else (it is a superset)** |
| `package.json` exports | `.`, `./formatting`, `./logging`, `./marketplace`, `./tokens` | `.`, `./formatting`, `./preview`, `./tokens` | **UNION the subpaths**: `.`, `./formatting`, `./logging`, `./marketplace`, `./preview`, `./tokens`. Take ui-foundation's version/scripts/deps otherwise |
| `AGENTS.md` | regen (old) | regen (U8, newer) | **take ui-foundation** (will be re-generated later anyway) |
| `pnpm-lock.yaml` | dep changes | UI test/build dep changes | **do not hand-merge — regenerate with `pnpm install` after package.jsons are resolved** |

**Confirmed breakage risk:** foundation-v2's apps import `formatIndiaDate` (18 files), `formatInrCurrency` (6), `formatUsShortDate` (3), `formatDisplayDate` (2). If the UI branch's `formatting.ts` wins as-is, all ~29 fail to compile. Hence the union.

**One manual reconciliation — `FormatDateOptions` type collision:** both export a type named `FormatDateOptions` with **incompatible shapes**. Keep foundation-v2's (consumed by its ~29 files). **Rename the ui-foundation one** (`export interface FormatDateOptions extends Intl.DateTimeFormatOptions { locale? }`) to e.g. `FormatDateStyleOptions`, and update the ui-foundation `formatDate` signature + the `index.ts` type export accordingly. No **function** names collide, so the union is otherwise clean.

---

## Step 0 — preserve the untracked docs (they exist only in this dirty tree)
The audit docs + both mission prompts are currently **untracked** (`??`) — committed nowhere. Don't lose them.
```bash
# from the main checkout (currently on stream/letbuyy-foundation-v2)
git add docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md docs/ui-system-audit \
        CODEX_UI_FOUNDATION_HARDENING_MISSION.md CODEX_UI_FOUNDATION_MISSION_V2.md MERGE_RUNBOOK.md
git commit -m "docs(ui): add UI foundation audit + Codex missions + merge runbook"
# (or cherry-pick these onto develop directly — the point is: get them committed somewhere)
```

## Step 1 — land the broad mission first
It is the larger base (807 files). Merge it, resolve its own conflicts, prove green.
```bash
git checkout develop && git pull
git merge --no-ff stream/letbuyy-foundation-v2
# resolve foundation-v2's own conflicts per that mission's rules
pnpm install
pnpm turbo typecheck && pnpm turbo build && pnpm turbo test
node scripts/validate-governance.mjs        # must be all-green
git push origin develop
```

## Step 2 — land the UI stream with the UNION resolution
```bash
git checkout develop && git pull
git merge --no-ff stream/letbuyy-ui-foundation
# Expect conflicts in: packages/typescript/ui/{src/index.ts, src/formatting.ts, package.json, AGENTS.md} + pnpm-lock.yaml
```
Resolve each conflict using the table above. Concretely:

- **`src/formatting.ts`** → keep **all 11 functions** (foundation-v2's 8 + ui-foundation's 3). Rename ui-foundation's `FormatDateOptions` → `FormatDateStyleOptions` (and its `formatDate(value, options: FormatDateStyleOptions)` + index export).
- **`src/index.ts`** → keep ui-foundation's whole file (it has the 211-export superset), then ADD the foundation-v2 formatting exports so the block reads:
  ```ts
  export { formatInrCurrency, formatDisplayDate, formatIndiaDate, formatIndiaDateTime,
           formatIndiaDateWithTime, formatIndiaDayMonthTime, formatUsLongDate, formatUsShortDate,
           formatCurrency, formatDate, formatNumber } from './formatting';
  export type { FormatInrCurrencyOptions, FormatDateOptions,
                FormatCurrencyOptions, FormatDateStyleOptions, FormatNumberOptions } from './formatting';
  ```
- **`package.json`** → take ui-foundation's file, but make `exports` the union:
  ```json
  "exports": { ".":"./src/index.ts", "./formatting":"./src/formatting.ts",
               "./logging":"./src/logging.ts", "./marketplace":"./src/marketplace.tsx",
               "./preview":"./src/preview.tsx", "./tokens":"./src/tokens.ts" }
  ```
  Confirm `src/logging.ts` and `src/marketplace.tsx` exist on the merged tree (they came from the base/foundation-v2); if missing, restore from `stream/letbuyy-foundation-v2`.
- **`AGENTS.md`** → `git checkout --theirs packages/typescript/ui/AGENTS.md` (ui-foundation).
- **All other `packages/typescript/ui/**`** → ui-foundation wins (`git checkout --theirs <path>`); foundation-v2 only touched the 6 files above.
- **`pnpm-lock.yaml`** → don't hand-merge: `git checkout --theirs pnpm-lock.yaml` then run `pnpm install` to reconcile against the merged `package.json`s.

## Step 3 — prove zero breakage (the union is correct only if these pass)
```bash
pnpm install
pnpm --filter @letbuyy/ui validate:ui        # tests + public-API + token + alias snapshots
pnpm turbo typecheck                          # MUST compile all ~29 formatter-importing files
pnpm turbo build && pnpm lint
node scripts/validate-governance.mjs          # all-green, count >= baseline
# spot-check the formatters survived:
git grep -c "formatIndiaDate\|formatInrCurrency" -- 'apps/**' | head   # still resolve
git commit && git push origin develop
```
If typecheck flags a missing formatter import → the union dropped a function; re-add it to `formatting.ts` + `index.ts`.

## Step 4 — now run V2
Precondition is satisfied (both tips are ancestors of `develop`). Hand Codex `CODEX_UI_FOUNDATION_MISSION_V2.md`; it will pass the gate and start Stream A (A1 brand purple → A2 codemods → A3 lint fence → … → 1.0), then Stream B.

> **Note:** the temporary redundancy of `formatInrCurrency` (specific) + `formatCurrency` (generic) is fine — V2 **Stream B2 (i18n/multi-currency)** unifies them into one locale-aware layer with INR preserved. Leave both for now.
