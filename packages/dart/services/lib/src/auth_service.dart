import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();

  factory AuthService() => _instance;

  AuthService._internal();

  final StreamController<UserModel?> _authStateController =
      StreamController<UserModel?>.broadcast();
  UserModel? _currentUser;

  Future<void> initializePersistence() => restoreSession();

  Stream<UserModel?> get authStateChanges => _authStateController.stream;
  UserModel? get currentUser => _currentUser;
  String? get currentUserId => _currentUser?.uid;
  bool get isLoggedIn => _currentUser != null;
  bool get isGuestMode => !isLoggedIn;

  String? getCurrentUserId() => currentUserId;

  UserModel? getCurrentUser() => _currentUser;

  Future<UserModel> registerWithEmail({
    required String email,
    required String password,
    required String name,
    String? phone,
  }) async {
    throw AuthException(
      'Registration must use the LetBuyy identity platform lb_session flow.',
    );
  }

  Future<UserModel> signInWithEmail({
    required String email,
    required String password,
  }) async {
    throw AuthException(
      'Sign-in must use the LetBuyy identity platform lb_session flow.',
    );
  }

  Future<UserModel> getUserData(String uid) async {
    final user = await restoreSession();
    if (user != null && user.uid == uid) return user;
    throw UserNotFoundException('User not found in the local lb_session');
  }

  Future<bool> checkUserExists(String email) async {
    return false;
  }

  Future<void> updateProfile({
    String? name,
    String? phone,
    String? photoUrl,
  }) async {
    final user = _currentUser;
    if (user == null) throw UnauthorizedException();

    final updated = user.copyWith(
      name: name ?? user.name,
      phone: phone ?? user.phone,
      photoUrl: photoUrl ?? user.photoUrl,
      lastLogin: DateTime.now(),
    );
    await _savePersistentSession(updated);
    _currentUser = updated;
    _authStateController.add(updated);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    throw AuthException('Password changes must use the identity platform.');
  }

  Future<void> sendPasswordResetEmail(String email) async {
    throw AuthException('Password reset must use the identity platform.');
  }

  Future<bool> isAdmin() async => _currentUser?.isAdmin ?? false;

  Future<bool> isSeller() async => _currentUser?.isSeller ?? false;

  Future<void> signOut() async {
    await SharedPreferencesService.clearUserSession();
    _currentUser = null;
    _authStateController.add(null);
  }

  Future<void> deleteAccount() async {
    throw AuthException('Account deletion must use the identity platform.');
  }

  Future<void> reloadUser() async {
    await restoreSession();
  }

  Future<UserModel?> restoreSession() async {
    try {
      final userId = SharedPreferencesService.getUserId();
      final email = SharedPreferencesService.getUserEmail();
      if (userId == null || email == null || email.isEmpty) {
        _currentUser = null;
        return null;
      }

      final user = UserModel(
        uid: userId,
        email: email,
        name: SharedPreferencesService.getUserName() ?? email.split('@').first,
        role: SharedPreferencesService.getUserRole() ?? 'user',
        createdAt: DateTime.now(),
        lastLogin: DateTime.now(),
      );
      _currentUser = user;
      _authStateController.add(user);
      return user;
    } catch (error) {
      debugPrint('Could not restore local identity session: $error');
      _currentUser = null;
      return null;
    }
  }

  void requireAuth(String action) {
    if (!isLoggedIn) {
      throw UnauthorizedException('Please login to $action');
    }
  }

  Future<void> sendEmailOTP(String email) async {
    throw AuthException('Email OTP must use the identity platform.');
  }

  Future<Map<String, dynamic>> verifyEmailOTPAndLogin({
    required String email,
    required String otp,
  }) async {
    throw AuthException('Email OTP must use the identity platform.');
  }

  Future<Map<String, dynamic>> verifyEmailOTPAndSignup({
    required String email,
    required String otp,
    required String name,
  }) async {
    throw AuthException('Email OTP must use the identity platform.');
  }

  Future<void> _savePersistentSession(UserModel userModel) async {
    await SharedPreferencesService.saveUserSession(
      userId: userModel.uid,
      email: userModel.email,
      name: userModel.name,
      role: userModel.role,
    );
  }
}
