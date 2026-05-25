/// Supabase & API configuration for the builder app.
class AppConfig {
  AppConfig._();

  // ── Supabase ──────────────────────────────────────────────
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  // ── Backend API ───────────────────────────────────────────
  /// Base URL for the Hono API worker (no trailing slash).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.letbuyy.store/v1',
  );

  /// Storefront base URL used for merchant preview and live links.
  static const String storefrontBaseUrl = String.fromEnvironment(
    'STOREFRONT_BASE_URL',
    defaultValue: 'https://letbuyy.store',
  );

  /// Publishable Razorpay key id only. Secrets must stay server-side.
  static const String razorpayKeyId =
      String.fromEnvironment('RAZORPAY_KEY_ID');

  static bool get hasSupabaseConfig =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
