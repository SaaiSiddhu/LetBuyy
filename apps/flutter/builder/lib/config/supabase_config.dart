/// Supabase & API configuration for the builder app.
class AppConfig {
  AppConfig._();

  // ── Supabase ──────────────────────────────────────────────
  static const String supabaseUrl = 'https://your-project.supabase.co';
  static const String supabaseAnonKey = 'your-anon-key';

  // ── Backend API ───────────────────────────────────────────
  /// Base URL for the Hono API worker (no trailing slash).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.letbuyy.store/v1',
  );
}
