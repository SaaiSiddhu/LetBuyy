# Wave 5 Report - Platform Console

## Scope

Wave 5 replaced platform console red-as-brand usage with Purple V1. Red remains available only for semantic error, danger, and failed/critical status states.

## Changed Files

| File | Change |
|---|---|
| `apps/platform-console/src/app/globals.css` | Added `--lb-color-*` Purple V1 variables for brand, hover, active, subtle, and focus ring. |
| `apps/platform-console/src/app/(auth)/login/page.tsx` | Replaced red login icon, input focus, submit button, hover, active, and focus states with Purple V1 tokens. |
| `apps/platform-console/src/app/(auth)/mfa/page.tsx` | Replaced amber action/focus accent with Purple V1 tokens. Error alert red remains semantic. |
| `apps/platform-console/src/app/(dashboard)/layout.tsx` | Replaced console badge and focus rings with Purple V1 tokens. |
| `apps/platform-console/src/components/ConsoleDataTable.tsx` | Replaced sky focus rings and search action button with Purple V1 tokens. Status badge red remains semantic. |
| `apps/platform-console/src/app/(dashboard)/audit-logs/page.tsx` | Replaced filter focus accent with Purple V1. |
| `apps/platform-console/src/app/(dashboard)/employees/page.tsx` | Replaced filter focus accent with Purple V1. |
| `apps/platform-console/src/app/(dashboard)/stores/page.tsx` | Replaced filter focus accent with Purple V1. |
| `apps/platform-console/src/app/(dashboard)/subscriptions/page.tsx` | Replaced filter focus accent with Purple V1. |

## Validation

| Command | Result |
|---|---|
| Targeted drift scan for red-as-brand, sky focus, blue/indigo classes | Passed. No brand/action/focus matches remain. |
| `pnpm --filter @letbuyy/platform-console build` | Passed when rerun escalated after sandbox Turbopack hang. |

Semantic red still exists in:

| File | Purpose |
|---|---|
| `apps/platform-console/src/app/(auth)/login/page.tsx` | Error alert. |
| `apps/platform-console/src/app/(auth)/mfa/page.tsx` | Error alert. |
| `apps/platform-console/src/components/ConsoleDataTable.tsx` | Red status badge for suspended/cancelled/inactive/false. |
| `apps/platform-console/src/app/(dashboard)/operations/page.tsx` | Failed/blocked/exhausted/critical operation status. |

## Screenshots

Screenshots were captured from the existing console dev server on `http://127.0.0.1:3010`.

| Requested screen | Screenshot | Final URL |
|---|---|---|
| Login | `.tmp/screenshots/wave5-console-login.png` | `http://127.0.0.1:3010/login` |
| MFA | `.tmp/screenshots/wave5-console-mfa.png` | `http://127.0.0.1:3010/login` |
| Dashboard | `.tmp/screenshots/wave5-console-dashboard.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3010%2Fdashboard` |
| Stores | `.tmp/screenshots/wave5-console-stores.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3010%2Fstores` |
| Subscriptions | `.tmp/screenshots/wave5-console-subscriptions.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3010%2Fsubscriptions` |
| Audit logs | `.tmp/screenshots/wave5-console-audit-logs.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3010%2Faudit-logs` |

## Blockers

Protected console pages redirect to the identity lookup flow without a valid console session. The screenshot evidence for protected pages is therefore route-attempt evidence, not authenticated dashboard evidence.
