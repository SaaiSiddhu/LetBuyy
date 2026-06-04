# Wave 4 Pilot Report - Merchant Flutter App

## Scope

Wave 4 was a pilot only. The source migration was limited to login, dashboard refresh behavior, and navigation brand accents.

Full Flutter app migration remains deferred for human review.

## Changed Files

| File | Change |
|---|---|
| `packages/dart/ui_kit/lib/src/themes/app_colors.dart` | Replaced the runtime shared `AppColors.primary` cyan ladder with Purple V1 and added hover/active brand constants. |
| `apps/mobile/merchant-app/lib/screens/auth/login_screen.dart` | Replaced pilot login indigo accents with `AppColors.primary` / `AppColors.primaryHover`. |
| `apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart` | Replaced dashboard refresh accent from lavender to `AppColors.primary`. |
| `apps/mobile/merchant-app/lib/theme/app_theme_colors.dart` | Replaced bottom navigation selected color/background with Purple V1. |

## Validation

| Command | Result |
|---|---|
| `flutter analyze` in `apps/mobile/merchant-app` | Passed. `No issues found!` |
| Pilot color scan | Passed for pilot runtime files. No `#00B3B3` / `0xFF00B3B3` remains in the pilot login/dashboard/navigation files. |

## Screenshots

| Capture | Path |
|---|---|
| Flutter login, dark mode | `.tmp/screenshots/wave4-flutter-login-dark.png` |
| Flutter login, light mode | `.tmp/screenshots/wave4-flutter-login-light.png` |

The screenshots were captured through `flutter run -d web-server --web-hostname 127.0.0.1 --web-port 3104` and Playwright. Flutter reported that the app is not configured for normal web build output, but the debug web-server successfully served `lib/main.dart` for screenshot capture.

## Remaining Exceptions Deferred

These were intentionally not migrated in Wave 4 because the mission specified pilot only:

| Area | Examples | Reason |
|---|---|---|
| Merchant theme presets | `widgets/theme/preset_grid.dart`, `screens/customize/theme_screen.dart` | Storefront and merchant theme palette exceptions. |
| Builder/editor preview defaults | `widgets/editor/**`, `preview_sections/**`, `compact_settings_sheet.dart` | Full builder migration requires human review after pilot. |
| Landing/admin promotional surfaces | `screens/landing/**`, `theme/store_admin_colors.dart` | Full Flutter migration is not included in this pilot. |
| Product/import accents | `screens/products/products_screen.dart`, `screens/products/import_products_screen.dart` | Non-pilot screens. |
| Legacy palette constants | `AppColors.indigo`, `AppColors.lavenderDark`, teal/secondary gradient constants | Existing palette/support colors; not runtime primary after pilot change. |

## Stop Gate

Wave 4 pilot is complete. Do not continue with full Flutter migration until human review approves expanding beyond login, dashboard, and navigation.
