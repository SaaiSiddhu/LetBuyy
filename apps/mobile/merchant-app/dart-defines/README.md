# Merchant App Dart Defines

Use these checked-in environment contracts with Flutter's `--dart-define-from-file` flag.

```sh
flutter run --dart-define-from-file=dart-defines/staging.json
flutter build apk --debug --dart-define-from-file=dart-defines/staging.json
flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json
flutter build apk --release --dart-define-from-file=dart-defines/production.json
```

`BFF_BASE_URL` / `API_BASE_URL` must point at the mobile BFF, not the raw gateway. The staging and production files intentionally contain `SKIP_NEEDS_HUMAN_*` placeholders for public provider values that must come from the governed secret/config owner before live proof. Do not add private service-role keys, Supabase keys, internal HMAC secrets, or provider secrets to these files.
