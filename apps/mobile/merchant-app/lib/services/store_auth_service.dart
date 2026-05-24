import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api_client.dart';

/// Authentication service using Supabase Auth.
///
/// Replaces the old Firebase Auth + Google Sign-In + Cloud Functions flow.
/// All user management (signup, signin, OAuth, password reset) now goes
/// through Supabase directly, while seller/store data is fetched via the API.
class StoreAuthService extends ChangeNotifier {
  final ApiClient _api;

  StoreAuthService({required ApiClient api}) : _api = api;

  // ── Convenience getters ──────────────────────────────────

  SupabaseClient get _supabase => Supabase.instance.client;

  /// Currently signed-in Supabase user, or `null`.
  User? get currentUser => _supabase.auth.currentUser;

  /// Whether a user session exists.
  bool get isSignedIn => currentUser != null;

  /// Current access token (JWT), or `null`.
  String? get accessToken =>
      _supabase.auth.currentSession?.accessToken;

  /// Stream of auth state changes (sign-in, sign-out, token refresh).
  Stream<AuthState> get authStateChanges =>
      _supabase.auth.onAuthStateChange;

  // ── Email / Password ─────────────────────────────────────

  /// Sign in with email + password. Returns the authenticated user.
  Future<User?> signInWithPassword(String email, String password) async {
    try {
      final res = await _supabase.auth.signInWithPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );
      notifyListeners();
      return res.user;
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  /// Register a new account with email + password.
  Future<User?> signUp(String email, String password, {String? name}) async {
    try {
      final res = await _supabase.auth.signUp(
        email: email.trim().toLowerCase(),
        password: password,
        data: {
          if (name != null) 'name': name,
          'role': 'seller',
        },
      );
      notifyListeners();
      return res.user;
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  // ── Google OAuth ─────────────────────────────────────────

  /// Sign in with Google via Supabase OAuth (opens browser).
  Future<void> signInWithGoogle() async {
    try {
      await _supabase.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: 'io.supabase.letbuyy://login-callback',
      );
      // Auth state change will fire automatically on redirect back
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  // ── Apple Sign-In ────────────────────────────────────────

  /// Sign in with Apple via Supabase OAuth.
  Future<void> signInWithApple() async {
    try {
      await _supabase.auth.signInWithOAuth(
        OAuthProvider.apple,
        redirectTo: 'io.supabase.letbuyy://login-callback',
      );
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  // ── Password Reset ───────────────────────────────────────

  /// Send a password reset email.
  Future<void> resetPassword(String email) async {
    try {
      await _supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  /// Update the password (requires a valid session from the reset link).
  Future<void> updatePassword(String newPassword) async {
    try {
      await _supabase.auth.updateUser(
        UserAttributes(password: newPassword),
      );
    } on AuthException catch (e) {
      throw Exception(e.message);
    }
  }

  // ── Session Management ───────────────────────────────────

  /// Sign out the current user.
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Sign-out error: $e');
    }
  }

  /// Refresh the current session token.
  Future<void> refreshSession() async {
    try {
      await _supabase.auth.refreshSession();
    } catch (e) {
      debugPrint('❌ Session refresh error: $e');
    }
  }

  // ── Store helpers ────────────────────────────────────────

  /// Check whether the current user owns any stores.
  /// Returns the first store data map, or `null`.
  Future<Map<String, dynamic>?> getFirstStore() async {
    try {
      final res = await _api.get('stores', query: {'limit': '1'});
      final items = res['data'] as List? ?? [];
      return items.isNotEmpty ? items.first as Map<String, dynamic> : null;
    } catch (e) {
      debugPrint('❌ Error fetching stores: $e');
      return null;
    }
  }

  // ── FCM Token ────────────────────────────────────────────
  // FCM token management is now handled separately via firebase_messaging.
  // The token can be saved to the user's profile via the API if needed.
}
