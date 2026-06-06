/// Runtime configuration for the Flutter merchant app.
class AppConfig {
  AppConfig._();

  /// Base URL for the mobile BFF worker (no trailing slash).
  ///
  /// The app sends `lb_session` only to this BFF. The BFF signs internal
  /// session headers and proxies to the Hono gateway.
  static const String bffBaseUrl = String.fromEnvironment(
    'BFF_BASE_URL',
    defaultValue: 'https://bff.letbuyy.store/v1',
  );

  /// Backwards-compatible API transport URL for shared services.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bff.letbuyy.store/v1',
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

  /// Real Cloudflare Turnstile response token supplied by the mobile challenge.
  static const String turnstileToken = String.fromEnvironment(
    'TURNSTILE_TOKEN',
    defaultValue: 'SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN',
  );

  /// Public Cloudflare Turnstile site key used by the in-app challenge.
  static const String turnstileSiteKey = String.fromEnvironment(
    'TURNSTILE_SITE_KEY',
    defaultValue: 'SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY',
  );
}
