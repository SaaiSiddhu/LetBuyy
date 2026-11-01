# Merchant App Dart Defines

Use these checked-in environment contracts with Flutter's `--dart-define-from-file` flag.

```sh
flutter run --dart-define-from-file=dart-defines/staging.json
flutter build apk --debug --dart-define-from-file=dart-defines/staging.json
flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json
flutter build apk --release --dart-define-from-file=dart-defines/production.json
```

`BFF_BASE_URL` / `API_BASE_URL` must point at the mobile BFF, not the raw gateway. The staging and production files intentionally contain `SKIP_NEEDS_HUMAN_*` placeholders for public provider values that must come from the governed secret/config owner before live proof. Do not add private service-role keys, Supabase keys, internal HMAC secrets, or provider secrets to these files.

`SENTRY_DSN` is optional in local builds. When it is omitted or still set to `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`, the app keeps crash reports in the local diagnostics outbox and does not call a provider.

Staging uses `bff-staging.letbuyy.com`, `accounts-staging.letbuyy.com` and
`admin-staging.letbuyy.com`. Startup checks the hosted BFF/API, identity and
Merchant destinations before restoring a session. A staging label with production
endpoints is rejected. Correct endpoint configuration does not establish that
hosted staging secrets, sign-in or provider integrations are ready.
