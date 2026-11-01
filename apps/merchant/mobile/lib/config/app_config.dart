/// Runtime configuration for the Flutter merchant app.
class AppConfig {
  AppConfig._();

  /// Checked before restoring a session or constructing authenticated clients.
  /// A staging label must never turn production defaults into a test backend.
  static String? endpointConfigurationError({
    String environmentName = environment,
    String bffUrl = bffBaseUrl,
    String apiUrl = apiBaseUrl,
    String identityUrl = identityBaseUrl,
    String adminUrl = adminBaseUrl,
  }) {
    if (environmentName == 'local' || environmentName == 'development') {
      return null;
    }
    final production = environmentName == 'production';
    if (!production && environmentName != 'staging') {
      return 'The app environment is not supported.';
    }
    final bffHosts = production
        ? const {'bff.letbuyy.com'}
        : const {'bff-staging.letbuyy.com', 'bff.staging.letbuyy.com'};
    final identityHosts = production
        ? const {'accounts.letbuyy.com'}
        : const {'accounts-staging.letbuyy.com'};
    final adminHosts = production
        ? const {'admin.letbuyy.com'}
        : const {'admin-staging.letbuyy.com', 'admin.staging.letbuyy.com'};

    bool matches(String value, Set<String> hosts, String path) {
      final uri = Uri.tryParse(value);
      return uri != null &&
          uri.scheme == 'https' &&
          hosts.contains(uri.host) &&
          (!uri.hasPort || uri.port == 443) &&
          uri.userInfo.isEmpty &&
          !uri.hasQuery &&
          !uri.hasFragment &&
          (uri.path == path || uri.path == '$path/');
    }

    if (!matches(bffUrl, bffHosts, '/v1') ||
        !matches(apiUrl, bffHosts, '/v1') ||
        Uri.tryParse(bffUrl)?.host != Uri.tryParse(apiUrl)?.host ||
        !matches(identityUrl, identityHosts, '') ||
        !matches(adminUrl, adminHosts, '')) {
      return 'The app endpoints do not match its environment. Install a corrected build.';
    }
    return null;
  }

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
    'ADMIN_BASE_URL',
    defaultValue: 'https://admin.letbuyy.com',
  );

  /// Storefront base URL used for merchant preview and live links.
  static const String storefrontBaseUrl = String.fromEnvironment(
    'STOREFRONT_BASE_URL',
    defaultValue: 'https://letbuyy.com',
  );

  /// Resolve the running local storefront while retaining canonical public URLs
  /// outside local development (including verified custom domains).
  static String storefrontUrlFor({
    required String subdomain,
    required String publicUrl,
  }) {
    if (environment != 'local') return publicUrl;
    final base = storefrontBaseUrl.replaceFirst(RegExp(r'/$'), '');
    return '$base/store/${Uri.encodeComponent(subdomain)}';
  }

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

  // Public Android client configuration. Server credentials never belong here.
  static const pushApiKey = String.fromEnvironment('FCM_ANDROID_API_KEY');
  static const pushAppId = String.fromEnvironment('FCM_ANDROID_APP_ID');
  static const pushSenderId = String.fromEnvironment('FCM_SENDER_ID');
  static const pushProjectId = String.fromEnvironment('FCM_PROJECT_ID');
  static bool get hasAndroidPushConfiguration =>
      [pushApiKey, pushAppId, pushSenderId, pushProjectId].every(
        (value) => value.isNotEmpty && !value.startsWith('SKIP_NEEDS_HUMAN_'),
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
