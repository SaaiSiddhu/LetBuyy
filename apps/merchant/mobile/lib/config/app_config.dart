/// Runtime configuration for the Flutter merchant app.
class AppConfig {
  AppConfig._();

  /// Base URL for the mobile BFF worker (no trailing slash).
  ///
  /// The app sends `lb_session` only to this BFF. The BFF signs internal
  /// session headers and proxies to the Hono gateway.
  static const String bffBaseUrl = String.fromEnvironment(
    'BFF_BASE_URL',
    defaultValue: 'https://bff.letbuyy.com/v1',
  );

  /// Backwards-compatible API transport URL for shared services.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bff.letbuyy.com/v1',
  );

  /// Base URL for the identity platform that issues `lb_session`.
  static const String identityBaseUrl = String.fromEnvironment(
    'IDENTITY_BASE_URL',
    defaultValue: 'https://accounts.letbuyy.com',
  );

  /// Public Merchant origin used to validate pasted invitation destinations.
  static const String adminBaseUrl = String.fromEnvironment(
    'ADMIN_BASE_URL', defaultValue: 'https://admin.letbuyy.com');

  /// Storefront base URL used for merchant preview and live links.
  static const String storefrontBaseUrl = String.fromEnvironment(
    'STOREFRONT_BASE_URL',
    defaultValue: 'https://letbuyy.com',
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

  /// Optional local/dev harness token for exercising mobile device registration.
  ///
  /// Production builds should provide this through the native push provider
  /// integration instead of a static dart-define.
  static const String mobilePushDeviceToken = String.fromEnvironment(
    'MOBILE_PUSH_DEVICE_TOKEN',
  );

  /// Runtime environment label attached to diagnostics and telemetry.
  static const String environment = String.fromEnvironment(
    'ENVIRONMENT',
    defaultValue: 'development',
  );

  /// Public Sentry DSN for crash reporting. No provider secret belongs here.
  static const String sentryDsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: 'SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN',
  );

  /// App release identifier attached to crash reports.
  static const String appRelease = String.fromEnvironment(
    'APP_RELEASE',
    defaultValue: 'letbuyy-merchant-mobile@1.0.0+1',
  );

  /// Default logistics provider for in-app shipping label purchase.
  ///
  /// Shiprocket is the India-first default; live credentials remain server-side.
  static const String defaultLogisticsProvider = String.fromEnvironment(
    'DEFAULT_LOGISTICS_PROVIDER',
    defaultValue: 'shiprocket',
  );

  static const Set<String> supportedLogisticsProviders = {
    'shiprocket',
    'delhivery',
    'pickrr',
  };

  static bool isConfiguredValue(String value) {
    final trimmed = value.trim();
    return trimmed.isNotEmpty && !trimmed.startsWith('SKIP_NEEDS_HUMAN_');
  }

  static String get normalizedDefaultLogisticsProvider {
    final normalized = defaultLogisticsProvider.trim().toLowerCase();
    return supportedLogisticsProviders.contains(normalized)
        ? normalized
        : 'shiprocket';
  }

  static bool get hasTurnstileToken => isConfiguredValue(turnstileToken);
  static bool get hasTurnstileSiteKey => isConfiguredValue(turnstileSiteKey);
  static bool get hasRazorpayKeyId => isConfiguredValue(razorpayKeyId);
  static bool get hasSentryDsn => isConfiguredValue(sentryDsn);
}
