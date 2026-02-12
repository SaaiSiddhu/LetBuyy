import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase service for LetBuyy platform
/// Handles initialization and provides access to Supabase client
class SupabaseService {
  static SupabaseService? _instance;
  static SupabaseClient? _client;

  SupabaseService._();

  static SupabaseService get instance {
    _instance ??= SupabaseService._();
    return _instance!;
  }

  /// Get Supabase client
  static SupabaseClient get client {
    if (_client == null) {
      throw Exception('Supabase not initialized. Call initialize() first.');
    }
    return _client!;
  }

  /// Initialize Supabase
  /// Call this in main.dart before runApp
  static Future<void> initialize({
    required String supabaseUrl,
    required String supabaseAnonKey,
  }) async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      debug: kDebugMode,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
    _client = Supabase.instance.client;
  }

  /// Get current authenticated user
  User? get currentUser => client.auth.currentUser;

  /// Get current session
  Session? get currentSession => client.auth.currentSession;

  /// Check if user is authenticated
  bool get isAuthenticated => currentUser != null;

  /// Auth state stream
  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;

  // ============================================
  // AUTH METHODS
  // ============================================

  /// Sign up with email and password
  Future<AuthResponse> signUpWithEmail({
    required String email,
    required String password,
    Map<String, dynamic>? metadata,
  }) async {
    return await client.auth.signUp(
      email: email,
      password: password,
      data: metadata,
    );
  }

  /// Sign in with email and password
  Future<AuthResponse> signInWithEmail({
    required String email,
    required String password,
  }) async {
    return await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  /// Sign in with OAuth (Google, Apple, Facebook)
  Future<bool> signInWithOAuth(OAuthProvider provider) async {
    final success = await client.auth.signInWithOAuth(
      provider,
      redirectTo: kIsWeb ? null : 'io.letbuyy.builder://login-callback',
    );
    return success;
  }

  /// Sign in with Google
  Future<bool> signInWithGoogle() => signInWithOAuth(OAuthProvider.google);

  /// Sign in with Apple
  Future<bool> signInWithApple() => signInWithOAuth(OAuthProvider.apple);

  /// Sign in with Facebook
  Future<bool> signInWithFacebook() => signInWithOAuth(OAuthProvider.facebook);

  /// Sign out
  Future<void> signOut() async {
    await client.auth.signOut();
  }

  /// Handle deep link (for OAuth callback)
  Future<AuthSessionUrlResponse?> handleDeepLink(Uri uri) async {
    try {
      return await client.auth.getSessionFromUrl(uri);
    } catch (e) {
      debugPrint('Error handling deep link: $e');
      return null;
    }
  }

  // ============================================
  // DATABASE HELPERS
  // ============================================

  /// Get reference to a table
  SupabaseQueryBuilder from(String table) => client.from(table);

  /// Get reference to storage bucket
  StorageFileApi storage(String bucket) => client.storage.from(bucket);

  /// Execute RPC function
  Future<dynamic> rpc(String fn, {Map<String, dynamic>? params}) {
    return client.rpc(fn, params: params);
  }
}

/// Extension for easy access
extension SupabaseX on SupabaseService {
  // Table shortcuts
  SupabaseQueryBuilder get users => from('users');
  SupabaseQueryBuilder get sites => from('sites');
  SupabaseQueryBuilder get products => from('products');
  SupabaseQueryBuilder get orders => from('orders');
  SupabaseQueryBuilder get coupons => from('coupons');
  SupabaseQueryBuilder get projects => from('projects');
  SupabaseQueryBuilder get skills => from('skills');
  SupabaseQueryBuilder get education => from('education');
  SupabaseQueryBuilder get testimonials => from('testimonials');
  SupabaseQueryBuilder get workExperience => from('work_experience');
  SupabaseQueryBuilder get certifications => from('certifications');
  SupabaseQueryBuilder get resumeVersions => from('resume_versions');
  SupabaseQueryBuilder get leads => from('leads');
  SupabaseQueryBuilder get leadForms => from('lead_forms');
  SupabaseQueryBuilder get contacts => from('contacts');
}
