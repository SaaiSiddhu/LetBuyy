# Merchant App Dart Defines

Use these checked-in environment contracts with Flutter's `--dart-define-from-file` flag.

```sh
flutter run --dart-define-from-file=dart-defines/staging.json
flutter build apk --debug --dart-define-from-file=dart-defines/staging.json
flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json
flutter build apk --release --dart-define-from-file=dart-defines/production.json
```

The staging and production files intentionally contain `SKIP_NEEDS_HUMAN_*` placeholders for public provider values that must come from the governed secret/config owner before live proof. Do not add private service-role keys or provider secrets to these files.
