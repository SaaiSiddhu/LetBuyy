/// Runtime configuration for the Flutter merchant app.
class AppConfig {
  AppConfig._();

  /// Base URL for the Hono API worker (no trailing slash).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.letbuyy.store/v1',
  );

  /// Base URL for the identity platform that issues `lb_session`.
  static const String identityBaseUrl = String.fromEnvironment(
    'IDENTITY_BASE_URL',
    defaultValue: 'https://accounts.letbuyy.store',
  );

  /// Storefront base URL used for merchant preview and live links.
  static const String storefrontBaseUrl = String.fromEnvironment(
    'STOREFRONT_BASE_URL',
    defaultValue: 'https://letbuyy.store',
  );

  /// Publishable Razorpay key id only. Secrets must stay server-side.
  static const String razorpayKeyId = String.fromEnvironment('RAZORPAY_KEY_ID');
}
