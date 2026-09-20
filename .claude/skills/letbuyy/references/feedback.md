# `feedback` lane — feedback-system compliance (binding whenever anything renders a message)

**Canonical authority:** DOC 06 §4.6 (the nine states) and §4.10 (the honesty badge),
`docs/ui-standards/{error-states,empty-states,loading-states,merchant-ux,forms-patterns}.md`, and
the exported feedback surfaces of `@letbuyy/ui`. Measured 2026-09-04 at `a751a2ff`.

**Fires when** a change touches any user-visible surface: a page, component, form, dialog, toast,
banner, empty/error/loading state, a money or fulfilment surface, a Flutter screen or widget, or any
string a merchant, shopper or operator reads — whatever the phase is called. A checkout phase, a
payouts phase and a settings phase all qualify the moment they render a message. Order of authority
for a UI change: this file (what to use, never re-implement) → `uiux.md` (canonical system, tokens,
a11y) → the phase's own workstreams.

## 1. Never build a new one — the canonical surfaces exist

```
WEB      packages/typescript/ui/src/feedback.tsx   Badge · StatusBadge · StatusPresentationBadge · ProviderModeBadge · Banner (info/success/warning/critical, action)
                                                    ToastProvider + useToast() · Skeleton (variant table/…) · EmptyStateIllustration (36 motifs) · EmptyState · SaveBar
         packages/typescript/ui/src/input.tsx      InlineError (+ Input/Textarea/NumberField `error`/`helperText`)
         packages/typescript/ui/src/overlays.tsx   ConfirmDialog (destructive confirmation) · Modal · Drawer
         packages/typescript/ui/src/primitives.tsx Spinner · ProgressBar (inline only — never a spinner-only screen for structured content)
         @letbuyy/ui/formatting                     formatInrCurrency (every INR amount in a message)
         @letbuyy/ui/logging                        the only logging surface (never console.*)
         services/api-gateway/src/lib/public-errors.ts       the SERVER copy owner: one fixed public message per error code
         services/api-gateway/src/middleware/security.ts:90  errorResponseSanitizer — nothing else reaches a client
FLUTTER  packages/dart/ui_kit/lib/src/widgets/     empty_state · error_view · loading_indicator · loading_overlay · shimmer_loading · confirmation_dialog · badge_widget
                                                    (empty_state_widget.dart and error_widget.dart are DUPLICATES — canonicalization debt, UX-4; never add a third)
         apps/merchant_app                          in scope; customer_app / phase_2 are HOLD (D-UIUX); admin_app is RESERVED (FB-1)
```

Success → `useToast()` (web) / the kit's snackbar pattern (Flutter). Submit failure →
`Banner variant="critical"` at page level plus field `error` inline; input preserved. Read failed →
`Banner` + a retry that re-runs the fetch, or `error_view` with retry. Nothing to show → `EmptyState`
with an icon, a title, a body that teaches the value, and a `primaryAction` (first-run vs
filtered-empty distinguished). Loading → `Skeleton` mirroring the layout (never a blank flash);
per-row busy state keyed by id; `Button loading`. Destructive → `ConfirmDialog` explaining the
consequence, then a toast. Unsaved changes → `SaveBar` (saved/unsaved/saving). Money mode →
`ProviderModeBadge` (`live | sandbox | scaffold`, text + role, never colour alone).

## 2. Copy has one owner per side

- **Server:** `services/api-gateway/src/lib/public-errors.ts` defines the fixed public message for
  every error code; `errorResponseSanitizer` is the only path to a client; `raw-error-message-validator`
  polices both (ambient red at `a751a2ff` — attribute in CI-1, never silence). No stack trace, table
  name, RPC name or provider payload ever reaches a user.
- **Client:** map codes to plain language at the surface; never render `err.message` /
  `error instanceof Error ? error.message` to a user. Distinguish not-found · forbidden · validation
  (422) · server (5xx) · network, and word each. Money and auth errors are precise ("gift card is
  invalid or unavailable", "Not authorized", "Refund failed"), never a bare "Something went wrong".
- **Best-effort side effects** (email, gift-card restore) never block the primary action; the UI shows
  the primary success and the failure is logged server-side.

## 3. India-first copy

INR via `formatInrCurrency` (₹, lakh/crore grouping where natural — `inr-currency-format-validator`);
amounts arrive as `*_minor bigint` and are formatted at the edge only; dates `en-IN`
(`date-format-validator`); GSTIN, pincode, `+91`, COD and UPI named as merchants name them; clear
English for small merchants; no US-centric idioms; no jargon in an error.

## 4. Flutter colour and copy

Colour is a function of `Theme.of(context)` brightness through the generated bridge
(`LetbuyyColorTokens` in `letbuyy_tokens.dart`), never a `const Color` or a status hex; no
colour-only status; a money screen without the honesty badge is BLOCKING (`money_screen.dart` was
the recorded offender). **No localisation pipeline was measured in `merchant_app` this session** —
before adding a `.arb`/l10n layer, measure what exists and record it in `uiux/EVIDENCE_LEDGER.md`;
classify a string before localising it (a rendered label is localised; an enum wire value, route,
asset key or `switch` discriminator is not); flag every new user-facing string in the report so a
future l10n phase can find it.

## 5. Measure before claiming a contrast defect

A colour has no ratio until its rendering role and composited backdrop are established: text 4.5:1,
meaningful icon or UI boundary 3:1, focus ring 3:1 against adjacent. Alpha dilution is a contrast
change. A chip labelled in its own tint is colour-on-tint, not colour-on-surface. Record the pair and
the ratio; `validateLetbuyyBrandContrast` (`tokens.ts`) validates injected brands at runtime — cite it.

## 6. The gates that fail a phase (run them; list them as invariants to preserve)

`pnpm --filter @letbuyy/ui run validate:ui` (vitest under `packages/typescript/ui/tests/{components,
validators,visual}` + ESLint rule tests + codemod dry-run + public-API / token / alias snapshots) ·
`node scripts/validators/raw-error-message-validator.mjs` · `provider-mode-badge-validator.mjs` ·
`inr-currency-format-validator.mjs` · `date-format-validator.mjs` · `validate-design-system.mjs` ·
`( cd apps/merchant_app && flutter test )` (172 canary) · the gateway `security*.test.ts` for
sanitized errors.

## 7. Do not let the census restart

Seven feedback-related documents exist (DOC 06, five `docs/ui-standards` files, the untracked
2026-08-16 UI feedback audit under `docs/research/`); DOC 06 plus the ui-standards files are
authoritative, the audit is dated evidence. Never commission another census. If a rule changes,
update the **gate**, not just prose.

## 8. Lane report

```
FEEDBACK LANE — <phase>
Verdict: PASS | PASS_WITH_FINDINGS | BLOCKING
Surfaces touched: path · surface kind · canonical component used
Copy: server codes touched (public-errors.ts) · client mappings · raw err.message renders: 0 · INR/date formatting verified · new user-facing strings flagged (count)
Money surfaces: ProviderModeBadge present (path) · stub-as-success: none
Gates run: names + exit codes
Findings: severity · path:line · rule (§1–§7) · fix
```

`BLOCKING` = a new feedback component or a third Flutter empty/error widget, a rendered `err.message`,
a hardcoded status colour, an unformatted INR amount on a money surface, a stub that reads as
success, a money surface without the badge, a silent blank on failure, or a governance test skipped.
