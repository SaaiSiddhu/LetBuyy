/// Runtime configuration for the Flutter customer app.
///
/// Every value is a `--dart-define`, never a tracked literal, and never a secret. This app is a
/// public buyer client: anything compiled into it is readable by anyone who installs it, so only
/// public endpoints and publishable identifiers belong here. Signing material, service-role keys and
/// provider secrets stay server-side.
///
/// The pattern deliberately matches `apps/merchant_app/lib/config/app_config.dart`
/// (`String.fromEnvironment` with a production default) rather than inventing a second convention.
class AppConfig {
  AppConfig._();

  /// Base URL of the canonical API gateway, including its version path.
  ///
  /// The marketplace surface this app reads — `/storefront/marketplace/{feed,categories,listings/:id}`
  /// — is public and unauthenticated by design, so no token is attached to these calls.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.letbuyy.com/v1',
  );

  /// Deployment environment label, for diagnostics only. Never used to gate behaviour: a client
  /// flag that changes what the app trusts is a flag an attacker sets.
  static const String environment = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'production',
  );
}
