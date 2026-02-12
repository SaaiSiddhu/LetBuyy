/// Supabase configuration for LetBuyy platform
class SupabaseConfig {
  /// Supabase project URL
  static const String url = 'https://rvzgkynwhbiksffusqnb.supabase.co';

  /// Supabase anon/public key
  static const String anonKey = 'sb_publishable_QLP5LDcWD3ef6JRr70pdEw_SRNvGdAD';

  /// Redirect URL for OAuth on mobile
  /// Must match the URL scheme configured in your app
  static const String mobileRedirectUrl = 'io.letbuyy.builder://login-callback';

  /// Redirect URL for OAuth on web
  /// Will use current origin automatically
  static String? get webRedirectUrl => null;

  /// Storage bucket names
  static const String imagesBucket = 'images';
  static const String resumesBucket = 'resumes';
  static const String assetsBucket = 'assets';
}
