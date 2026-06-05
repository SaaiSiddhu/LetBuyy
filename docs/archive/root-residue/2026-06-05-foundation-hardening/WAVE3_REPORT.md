# Wave 3 Report: Merchant Control Plane

Generated: 2026-06-03
Wave owner: `apps/merchant-control-plane/**`

## Scope

Wave 3 aligned Merchant Control Plane color usage with Purple V1. No business logic, API logic, auth logic, payment logic, database code, layout, typography, or spacing was changed.

## Changed Files

| File | Change |
|---|---|
| `apps/merchant-control-plane/src/app/globals.css` | Added Purple V1 active/subtle tokens and `--lb-*` brand aliases; aligned dark primary to `#8B5CF6` |
| `apps/merchant-control-plane/src/app/[store]/login/page.tsx` | Replaced blue redirect spinner border with the Purple V1 primary token |
| `apps/merchant-control-plane/src/app/[store]/settings/subscribe/checkout/SubscribeCheckoutClient.tsx` | Replaced Razorpay checkout fallback color from `#2563eb` to `#8B5CF6` |

## Drift Removed

- `border-t-blue-600` removed from merchant redirect/login spinner.
- `#2563eb` removed from checkout theme fallback.
- App-level dark `--primary` now resolves to Purple V1 instead of the lighter support shade.

## Scan Result

Checked `apps/merchant-control-plane/src` for active blue/cyan/indigo brand drift:

- `#2563eb`: none
- `#60a5fa`: none
- `#1d4ed8`: none
- `#93c5fd`: none
- `border-t-blue`: none
- `bg-blue`, `text-blue`, `border-blue`, `ring-blue`: none
- `cyan-*`: none
- `indigo-*`: none

## Screenshots

The local Merchant Control Plane dev server was already running on `localhost:3002`. Protected route attempts redirect through merchant auth because no `lb_session` and local accounts/API-backed store ownership state are available in this environment.

| Requested screen | Screenshot path | Result |
|---|---|---|
| Dashboard | `.tmp/screenshots/wave3-merchant-dashboard-attempt.png` | Captured protected route attempt |
| Products | `.tmp/screenshots/wave3-merchant-products-attempt.png` | Captured protected route attempt |
| Orders | `.tmp/screenshots/wave3-merchant-orders-attempt.png` | Captured protected route attempt |
| Settings | `.tmp/screenshots/wave3-merchant-settings-attempt.png` | Captured protected route attempt |
| Checkout | `.tmp/screenshots/wave3-merchant-checkout-attempt.png` | Captured protected route attempt |
| Theme editor | `.tmp/screenshots/wave3-merchant-theme-editor-attempt.png` | Captured protected route attempt |
| Accessible app page | `.tmp/screenshots/wave3-merchant-launching-soon.png` | Captured renderable local route |

## Validation

| Command | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/merchant-control-plane build` | Failed in sandbox | Turbopack could not create a process or bind an internal local port |
| `pnpm --filter @letbuyy/merchant-control-plane build` with escalated execution | Pass | Next build completed successfully |

## Preserved Exceptions

- `--accent-blue` and `--info` remain `#3B82F6` as semantic/support colors.
- `--accent-cyan` remains as an existing support accent and was not promoted to brand.
- Existing purple support shades used for dark-mode legibility remain where they are not primary brand authority.
- No provider, storefront, merchant theme preset, API, auth, payment, or database code was changed.

## Status

Wave 3 is complete. Merchant Control Plane no longer carries the old shared blue primary fallback or blue redirect spinner, and app-level primary variables align with Purple V1.
