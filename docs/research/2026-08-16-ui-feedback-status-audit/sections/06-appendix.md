## 29. Appendix

### 29.1 Canonical primitive source locations

| Primitive | File | Line |
|---|---|---|
| `Badge`, `BadgeProps` | `packages/typescript/ui/src/feedback.tsx` | 64, 69 |
| `StatusVariant` (union) | `packages/typescript/ui/src/feedback.tsx` | 29 |
| `statusStyles` (tone→class map) | `packages/typescript/ui/src/feedback.tsx` | 31-62 |
| `statusToBadgeVariant` | `packages/typescript/ui/src/feedback.tsx` | 94-102 |
| `StatusBadge` | `packages/typescript/ui/src/feedback.tsx` | 117 |
| `Banner` | `packages/typescript/ui/src/feedback.tsx` | 121-158 |
| `ToastMessage` / `ToastVariant` | `packages/typescript/ui/src/feedback.tsx` | 163-170, 160 |
| `toastPlacementStyles` | `packages/typescript/ui/src/feedback.tsx` | 185-195 |
| `ToastProvider` / `useToast` | `packages/typescript/ui/src/feedback.tsx` | 199 |
| `EmptyStateKind` | `packages/typescript/ui/src/feedback.tsx` | 338-352 |
| `EmptyState`, `EmptyStateIllustration` | `packages/typescript/ui/src/feedback.tsx` | — |
| `SaveBar` | `packages/typescript/ui/src/feedback.tsx` | 562-568 |
| `Skeleton` | `packages/typescript/ui/src/feedback.tsx` | — |
| `InlineError` | `packages/typescript/ui/src/input.tsx` | 162, 166 |
| `ConfirmDialogProps` / `ConfirmDialog` | `packages/typescript/ui/src/overlays.tsx` | 496-506, 508 |
| `useScrollLock` / `acquireScrollLock` | `packages/typescript/ui/src/overlay-hooks.ts` | 147+ |
| `FilterChips` | `packages/typescript/ui/src/primitives.tsx` | 393, 399 |
| `ProgressBar` | `packages/typescript/ui/src/primitives.tsx` | 443 |
| `Spinner` | `packages/typescript/ui/src/primitives.tsx` | 634 |
| `InternalStatusPill` | `packages/typescript/ui/src/internal-workspace.tsx` | 146-175 |
| `InternalEmptyDataState` | `packages/typescript/ui/src/internal-workspace.tsx` | 205-211 |
| `Table` / `TableProps` | `packages/typescript/ui/src/table.tsx` | 48-69, 103 |
| `warnDeprecated` (0 callers) | `packages/typescript/ui/src/deprecations.ts` | — |

> **Correction to the research brief:** `FilterChips`, `ProgressBar` and `Spinner` live in
> `primitives.tsx`, not `productivity.tsx`. `productivity.tsx` contains only `Avatar`,
> `CommandPalette`, `FilterBar`, `MetricCard`, `Pagination`.

### 29.2 Competing `StatusBadge` implementations

| # | File | Line | API | Tone source |
|---|---|---|---|---|
| 1 | `packages/typescript/ui/src/feedback.tsx` | 117 | `{status, label?, variant?}` | `--lb-component-banner-*` (700/800 ramp) |
| 2 | `apps/platform-console/src/components/ConsoleDataTable.tsx` | 89 | `{value, tone?}` | raw Tailwind `bg-emerald-500/10 text-emerald-300` |
| 3 | `apps/developer-portal/src/components/_local-ui/developer-docs.tsx` `[FROZEN]` | 68 | `{status: CapabilityStatus}` | local |

Imports of `StatusBadge`/`statusToBadgeVariant` from `@letbuyy/ui` across all apps: **0**.

### 29.3 Token pipeline

```
primitive.color.*                       tokens.ts:47-174
  └─ letbuyyColorTokens (flat aliases)  tokens.ts:210-237
      └─ letbuyySemanticTokens[theme]   tokens.ts:239-368
          │   .status      → raw hue    (#22C55E #F59E0B #EF4444 #3B82F6)
          │   .statusText  → 700/800    (accessible foreground)
          │   .statusSoft  → 100 / 950  (surface)
          └─ letbuyyComponentTokens     tokens.ts:370-550
              └─ sharedCssVariables     tokens.ts:905-1038
                 colorVariables         tokens.ts:1057-1126
                  └─ letbuyyTokenCssVariables   tokens.ts:1482-1491
                      └─ surfaceVariables       tokens.ts:1254-1357
                          └─ letbuyyTokenCss    tokens.ts:1520-1634
                              └─ <style data-letbuyy-token-source>
                                     token-style-boundary.tsx:24-27
```
403 distinct `--lb-*` variables emitted; 401 per theme. `adminSurfaceIdentity` (`tokens.ts:1140-1248`)
overrides **zero** status tokens — status colour is surface-invariant.

### 29.4 Resolved status colour values

| Role | Light | Dark |
|---|---|---|
| success — raw / text / soft | `#22C55E` / `#15803D` / `#DCFCE7` | `#22C55E` / `#22C55E` / `#052E16` |
| warning — raw / text / soft | `#F59E0B` / `#92400E` / `#FEF3C7` | `#F59E0B` / `#F59E0B` / `#422006` |
| danger — raw / text / soft | `#EF4444` / `#B91C1C` / `#FEE2E2` | `#EF4444` / `#FCA5A5` / `#451A1A` |
| info — raw / text / soft | `#3B82F6` / `#1D4ED8` / `#E0F2FE` | `#3B82F6` / `#7DD3FC` / `#082F49` |

Contrast (independently computed twice, WCAG relative luminance):

| Variant | Theme | Text on soft | Ratio | AA |
|---|---|---|---|---|
| success | light | `#15803D` on `#DCFCE7` | **4.57** | PASS (thin) |
| warning | light | `#92400E` on `#FEF3C7` | 6.37 | PASS |
| critical | light | `#B91C1C` on `#FEE2E2` | 5.30 | PASS |
| info | light | `#1D4ED8` on `#E0F2FE` | 5.84 | PASS |
| danger | dark | `#FCA5A5` on `#451A1A` | 7.82 | PASS |
| info | dark | `#7DD3FC` on `#082F49` | 8.32 | PASS |

`InternalStatusPill` uses the **raw 500 ramp as foreground** on the same soft surfaces:
1.93:1 (warning), 2.07:1 (success), 3.08:1 (critical), 3.21:1 (info) — **all fail AA**.

### 29.5 `statusToBadgeVariant` substring hazard

The mapper (`feedback.tsx:94-102`) uses `String.includes`, checking the success list **first**.
Negated statuses therefore match their positive keyword. Executed against the real value set:

| Status (real DB value) | Resolves to | Correct? |
|---|---|---|
| `inactive` | `success` | ✗ contains `active` |
| `unpublished` | `success` | ✗ contains `published` |
| `unverified` | `success` | ✗ contains `verified` |
| `partially_paid` | `success` | ✗ contains `paid` — should be warning |
| `past_due` | `default` | ✗ unmapped, renders neutral |
| `voided` | `default` | ✗ unmapped, renders neutral |
| `failed`, `payment_failed` | `critical` | ✓ |
| `partially_fulfilled` | `warning` | ✓ |

**Latent, not live** — the function has zero consumers. It must not be adopted as-is.

### 29.6 Verified live database facts

Local Supabase, `public` schema — 439 tables. **No native Postgres enums** repo-wide
(`grep "AS ENUM" *.sql` → 0 hits); every status is `text` + `CHECK`. 237 CHECK-ARRAY constraints in
`database/supabase/migrations/000_baseline.sql` alone, plus ~75 later migrations that DROP and re-ADD
them — so the authoritative value set for a field is the **last migration touching it**, not the baseline.

```
sites.status         draft | published | unpublished | frozen | suspended
sites.trial_status   active | grace | frozen | cancelled | paid
custom_domain_status none | pending | review | verifying | active | error
ssl_status           pending | active | failed
orders.status        10 values, migrations/147_executable_order_state_risk.sql:34-46
                     (NOT the 7 in baseline:10172)
```
Live `sites` rows at audit time: `published` ×3, `draft` ×2 — **zero** rows could ever satisfy
`AllStoresClient.tsx:165`'s `status === 'active'` test.

### 29.7 Raw palette class distribution (`apps/**/*.tsx`, build output excluded)

| App | Count | Status |
|---|---:|---|
| `platform-console` | 78 | active — worst offender |
| `storefront-runtime` | 64 | active — customer-facing |
| `marketing-site` | 24 | active (exempt from ratchet by design) |
| `platform-operations-portal` | 12 | `[FROZEN]` |
| `theme-marketplace` | 6 | `[FROZEN]` |
| `merchant-control-plane` | **0** | active — fully token-compliant |
| `identity-platform` | **0** | active — fully token-compliant |
| `developer-portal` | 0 | `[FROZEN]` |
| `app-marketplace` | 0 | `[FROZEN]` |

### 29.8 Governance references

- `scripts/validators/validate-design-system.mjs` — walks `apps/` only; exempts
  `packages/typescript/ui` as the token layer; 10 ratchet metrics, all visual.
- `scripts/validators/design-system-baseline.json` — the ratchet floor.
- `scripts/validators/shell-single-validator.mjs` — shell authority allow-list.
- Root `AGENTS.md` UI-R1 (one token source, :288) · UI-R2 (one app shell, :289) ·
  UI-R3 (light+dark, skeleton/empty/error, :290) · UI-R4 (WCAG AA floor, :291) ·
  UI-R5 (Lucide icons, avoid inline styles, :292) · UI-R6 (honesty badge, :293) ·
  UI-R7 (ratchet must block new drift, :294).
- **No validator measures component adoption or copy.** Findings ①③④⑤ in §1.3 are invisible to CI.

### 29.9 Audit provenance

| Phase | Agents | Output |
|---|---:|---|
| Survey | 16 | primitives, tokens, duplicates, toast, validation, api-errors, loading, empty-states, banners, domain enums, domain→UI mapping, a11y, responsive, copy, tables/modals, cross-app/legacy |
| Adversarial verification | 4 | zero-usage claims · colour conflicts · contrast maths · swallowed-error & double-submit claims |
| Authoring | 5 | §2–§28 |

~7.7M subagent tokens, ~1,900 tool calls. Verification refuted 33 claims across the four panels —
including the `fulfilled`/`returned` order-status conflicts (values unwritable), several Tailwind v3
hex assumptions (this repo is Tailwind v4/OKLCH), and the `ConflictDialog` double-submit claim (it
closes synchronously). Those corrections are reflected throughout.
