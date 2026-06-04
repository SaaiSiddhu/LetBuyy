# Wave 6 Report - Platform Operations Portal

## Scope

Wave 6 replaced operations portal indigo-as-brand usage with Purple V1. Red remains available only for failure, error, and reject states in operations workflows.

## Changed Files

| File | Change |
|---|---|
| `apps/platform-operations-portal/src/app/globals.css` | Added `--lb-color-*` Purple V1 variables for brand, hover, active, subtle, and focus ring. |
| `apps/platform-operations-portal/src/app/(auth)/login/page.tsx` | Replaced indigo input focus, submit button, hover, active, and focus states with Purple V1 tokens. |
| `apps/platform-operations-portal/src/app/(auth)/invite/page.tsx` | Replaced indigo invite form focus and submit states with Purple V1 tokens. |
| `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx` | Replaced indigo Team badge with Purple V1 subtle/text tokens. |
| `apps/platform-operations-portal/src/app/(dashboard)/stores/page.tsx` | Replaced search focus accent with Purple V1. |
| `apps/platform-operations-portal/src/app/(dashboard)/users/page.tsx` | Replaced search focus accent with Purple V1. |

## Validation

| Command | Result |
|---|---|
| Targeted drift scan for indigo/blue/sky | Passed. No matches remain in operations portal source. |
| `pnpm --filter @letbuyy/platform-operations-portal build` | Passed when rerun escalated after sandbox Turbopack hang. |

Semantic red still exists in:

| File | Purpose |
|---|---|
| `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` | Failed review status, API error panel, and reject action. |

## Screenshots

Screenshots were captured from the existing operations portal dev server on `http://127.0.0.1:3011`.

| Requested screen | Screenshot | Final URL |
|---|---|---|
| Login | `.tmp/screenshots/wave6-operations-login.png` | `http://127.0.0.1:3011/login` |
| Invite | `.tmp/screenshots/wave6-operations-invite.png` | `http://127.0.0.1:3011/invite` |
| Dashboard | `.tmp/screenshots/wave6-operations-dashboard.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3011%2F` |
| Support | `.tmp/screenshots/wave6-operations-support.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3011%2Fsupport` |
| Stores | `.tmp/screenshots/wave6-operations-stores.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3011%2Fstores` |
| Users | `.tmp/screenshots/wave6-operations-users.png` | `http://localhost:3001/lookup?return_to=http%3A%2F%2Flocalhost%3A3011%2Fusers` |

## Blockers

Dashboard and operational pages redirect to the identity lookup flow without a valid session. The screenshot evidence for protected pages is route-attempt evidence, not authenticated page evidence.
