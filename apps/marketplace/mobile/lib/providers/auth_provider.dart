// lib/providers/auth_provider.dart
//
// 🔥 FIXED: Fast synchronous initialization for web
// Auth state is checked quickly without blocking app startup

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

class AuthProvider with ChangeNotifier {
  // ============================================
  // SERVICES & FIREBASE
  // ============================================

  final AuthService _authService = AuthService();
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  FirebaseAuth get _firebaseAuth => FirebaseAuth.instance;
  SharedPreferences? _prefs;

  // ============================================
  // STATE VARIABLES
  // ============================================

  UserModel? _currentUser;
  bool _isLoading = false;
  // 🔥 CRITICAL FIX: On web, don't block with isInitializing
  // Start as false on web, true on mobile
  bool _isInitializing = kIsWeb ? false : true;
  String? _error;
  DateTime? _lastAuthCheck;
  bool _rememberMe = false;
  int _failedLoginAttempts = 0;
  DateTime? _lockoutUntil;
  StreamSubscription<User?>? _authStateSubscription;
  bool _sessionRestored = false;
  bool _isDisposed = false;

  // ============================================
  // GETTERS
  // ============================================

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isInitializing => _isInitializing;
  bool get sessionRestored => _sessionRestored;
  String? get error => _error;
  bool get isLoggedIn => _currentUser != null;
  bool get isAdmin => _currentUser?.isAdmin ?? false;
  bool get isSeller => _currentUser?.isSeller ?? false;
  bool get isBuyer => _currentUser?.isBuyer ?? false;
  bool get isLocked =>
      _lockoutUntil != null && DateTime.now().isBefore(_lockoutUntil!);
  bool get rememberMe => _rememberMe;
  String? get userEmail => _currentUser?.email;
  String? get userName => _currentUser?.name;
  String? get userPhone => _currentUser?.phone;
  String? get userPhotoUrl => _currentUser?.photoUrl;
  String? get userUid => _currentUser?.uid;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  AuthProvider() {
    _initialize();
  }

  // ============================================
  // INITIALIZE
  // ============================================

  void _initialize() {
    debugPrint('🔄 AuthProvider initializing... (Web: $kIsWeb)');

    // Phase 1R corrective (C2): this whole chain (currentUser, then authStateChanges via
    // _listenToAuthChanges) touches FirebaseAuth.instance unguarded, with no try/catch anywhere
    // between here and the constructor. Confirmed empirically: FirebaseAuth.instance throws
    // FirebaseException([core/no-app]) synchronously with no Firebase.initializeApp() call --
    // meaning AuthProvider's own constructor threw, uncaught, the instant anything first read
    // it. AuthProvider is read unconditionally inside CartScreen's Consumer<AuthProvider>, and
    // CartScreen sits in MainScreen's IndexedStack (built eagerly, every tab, on every launch) --
    // this was a guaranteed app-boot crash, not a single-tab one. Falls back to the same
    // "no user" state the code already uses when currentUser is legitimately null.
    try {
      // 🔥 WEB: Fast synchronous check
      if (kIsWeb) {
        _initializeWeb();
      } else {
        // Mobile: async initialization
        _initializeMobile();
      }
    } catch (e) {
      debugPrint('⚠️ AuthProvider: Firebase unavailable, starting signed-out: $e');
      _sessionRestored = true;
      _isInitializing = false;
    }
  }

  // 🔥 WEB: Synchronous fast initialization
  void _initializeWeb() {
    debugPrint('🌐 WEB: Quick auth check starting...');
    
    // Check if Firebase already has a user (synchronous check)
    final firebaseUser = _firebaseAuth.currentUser;
    
    if (firebaseUser != null) {
      debugPrint('🌐 WEB: Firebase user exists: ${firebaseUser.uid}');
      // Start loading user data in background
      _loadUserDataInBackground(firebaseUser.uid);
    } else {
      debugPrint('🌐 WEB: No Firebase user found');
      _sessionRestored = true;
      _isInitializing = false;
    }
    
    // Setup auth state listener
    _listenToAuthChanges();
    
    // Initialize preferences in background
    _initializePreferences();
  }

  // 🚀 PERFORMANCE FIX: Mobile now uses same fast path as web
  // Auth restoration happens in background AFTER navigation
  void _initializeMobile() {
    debugPrint('📱 MOBILE: Fast auth check starting...');
    
    // Check cached Firebase user (INSTANT - no network)
    final firebaseUser = _firebaseAuth.currentUser;
    
    if (firebaseUser != null) {
      debugPrint('📱 MOBILE: Cached Firebase user: ${firebaseUser.email}');
      // 🚀 Load user data in BACKGROUND (non-blocking)
      _loadUserDataInBackground(firebaseUser.uid);
    } else {
      debugPrint('📱 MOBILE: No cached user');
      _sessionRestored = true;
      _isInitializing = false;
    }
    
    // Setup auth state listener
    _listenToAuthChanges();
    
    // Initialize preferences in background
    _initializePreferences();
  }

  // 🔥 Load user data without blocking
  void _loadUserDataInBackground(String uid) async {
    try {
      debugPrint('🔄 Loading user data in background...');
      
      _currentUser = await _authService.getUserData(uid);
      
      if (_isDisposed) return;
      
      await _saveSessionData(_currentUser!);
      await _updateLastLogin(uid);
      
      debugPrint('✅ User data loaded: ${_currentUser?.email}');
      _sessionRestored = true;
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error loading user data: $e');
      _currentUser = null;
      await _clearSessionData();
      _sessionRestored = true;
      _safeNotifyListeners();
    }
  }

  // ============================================
  // 🔥 INITIALIZE SHARED PREFERENCES
  // ============================================

  Future<void> _initializePreferences() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      debugPrint('✅ SharedPreferences initialized');

      _rememberMe = _prefs?.getBool(StorageConstants.keyRememberMe) ?? false;
      debugPrint('💾 Loaded preferences: rememberMe=$_rememberMe');
    } catch (e) {
      debugPrint('⚠️ Error initializing preferences: $e');
    }
  }

  // ============================================
  // 🔥 SAFE NOTIFY LISTENERS (Prevents disposed errors)
  // ============================================

  void _safeNotifyListeners() {
    if (!_isDisposed) {
      try {
        notifyListeners();
      } catch (e) {
        debugPrint('⚠️ Error notifying listeners: $e');
      }
    }
  }

  // ============================================
  // 🔥 LISTEN TO AUTH STATE CHANGES
  // ============================================

  void _listenToAuthChanges() {
    debugPrint('🔐 Setting up auth state listener...');

    _authStateSubscription?.cancel();

    _authStateSubscription =
        _authService.authStateChanges.listen((User? user) async {
      if (_isDisposed) return;

      debugPrint('🔄 Auth state changed: user=${user?.uid}');

      if (user != null) {
        // If we already have the user loaded correctly, skip reloading
        if (_currentUser?.uid == user.uid) {
          debugPrint('ℹ️ User already loaded, skipping reload');
          return;
        }

        try {
          debugPrint('🔐 Firebase user detected: ${user.uid}');

          // 🔥 Verify token validity
          try {
            await user.getIdToken(true);
            debugPrint('✅ Token refreshed successfully');
          } catch (tokenError) {
            debugPrint('❌ Token refresh failed: $tokenError');
            _currentUser = null;
            await _clearSessionData();
            _isInitializing = false;
            _sessionRestored = true;
            _safeNotifyListeners();
            return;
          }

          if (_isDisposed) return;

          _currentUser = await _authService.getUserData(user.uid);

          if (_isDisposed) return;

          await _saveSessionData(_currentUser!);
          await _updateLastLogin(user.uid);

          debugPrint('✅ User loaded: ${_currentUser?.email}');
          
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
        } catch (e) {
          if (_isDisposed) return;
          
          debugPrint('❌ Error loading user data: $e');
          _error = e.toString();
          _currentUser = null;
          await _clearSessionData();
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
        }
      } else {
        if (_isDisposed) return;
        
        debugPrint('👤 No Firebase user logged in');
        _currentUser = null;
        await _clearSessionData();
        _isInitializing = false;
        _sessionRestored = true;
        _safeNotifyListeners();
      }
    });
  }

  // ============================================
  // 🔥 RESTORE SESSION ON APP START
  // ============================================

  Future<void> restoreSession() async {
    try {
      debugPrint('🔄 Restoring session...');
      
      // Ensure preferences are initialized
      if (_prefs == null) {
        await _initializePreferences();
      }

      if (_isDisposed) return;

      // Get current Firebase user
      final firebaseUser = _firebaseAuth.currentUser;

      if (firebaseUser != null) {
        debugPrint('🔐 Firebase user found: ${firebaseUser.uid}');

        // 🔥 Verify token validity
        try {
          await firebaseUser.getIdToken(true);
          debugPrint('✅ Token valid and refreshed');
        } catch (e) {
          debugPrint('⚠️ Token refresh failed, clearing session: $e');
          await _firebaseAuth.signOut();
          _currentUser = null;
          await _clearSessionData();
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
          return;
        }

        if (_isDisposed) return;

        // 🔥 Load user data WITH RETRY
        try {
          for (int attempt = 0; attempt < 3; attempt++) {
            if (_isDisposed) return;
            
            try {
              _currentUser = await _authService.getUserData(firebaseUser.uid)
                  .timeout(const Duration(seconds: 5));
              
              if (_isDisposed) return;
              
              await _saveSessionData(_currentUser!);
              debugPrint('✅ Session restored: ${_currentUser?.email}');
              break;
            } catch (e) {
              if (attempt == 2) rethrow;
              debugPrint('⚠️ Retry loading user data (${attempt + 1}/3): $e');
              await Future.delayed(Duration(seconds: attempt + 1));
            }
          }
        } catch (e) {
          if (_isDisposed) return;
          
          debugPrint('❌ Failed to load user data after retries: $e');
          _currentUser = null;
          await _clearSessionData();
        }
      } else {
        debugPrint('❌ No Firebase user found');
        _currentUser = null;
        await _clearSessionData();
      }

      if (_isDisposed) return;

      _isInitializing = false;
      _sessionRestored = true;
      _safeNotifyListeners();
      debugPrint('✅ Session restoration complete. User: ${_currentUser?.email ?? "none"}');
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error in restoreSession: $e');
      _isInitializing = false;
      _sessionRestored = true;
      _error = e.toString();
      _currentUser = null;
      await _clearSessionData();
      _safeNotifyListeners();
    }
  }

  // ============================================
  // 🔥 SAVE SESSION DATA TO LOCAL STORAGE
  // ============================================

  Future<void> _saveSessionData(UserModel user) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      await _prefs?.setString(StorageConstants.keyUserId, user.uid);
      await _prefs?.setString(StorageConstants.keyUserEmail, user.email);
      await _prefs?.setString(StorageConstants.keyUserName, user.name);
      await _prefs?.setString(StorageConstants.keyUserRole, user.role);

      final userType = user.isSeller ? 'seller' : 'buyer';
      await _prefs?.setString(StorageConstants.keyUserType, userType);

      await _prefs?.setInt(
        StorageConstants.keyLastLoginTime,
        DateTime.now().millisecondsSinceEpoch,
      );

      await _prefs?.setInt(
        StorageConstants.keySessionStartTime,
        DateTime.now().millisecondsSinceEpoch,
      );

      await _prefs?.setBool(StorageConstants.keyIsLoggedIn, true);

      debugPrint('💾 Session data saved to local storage');
    } catch (e) {
      debugPrint('⚠️ Error saving session data: $e');
    }
  }

  // ============================================
  // 🔥 CLEAR SESSION DATA FROM LOCAL STORAGE
  // ============================================

  Future<void> _clearSessionData() async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      await _prefs?.remove(StorageConstants.keyUserId);
      await _prefs?.remove(StorageConstants.keyUserEmail);
      await _prefs?.remove(StorageConstants.keyUserName);
      await _prefs?.remove(StorageConstants.keyUserRole);
      await _prefs?.remove(StorageConstants.keyUserType);
      await _prefs?.remove(StorageConstants.keyLastLoginTime);
      await _prefs?.remove(StorageConstants.keySessionStartTime);
      await _prefs?.setBool(StorageConstants.keyIsLoggedIn, false);

      debugPrint('🧹 Session data cleared from local storage');
    } catch (e) {
      debugPrint('⚠️ Error clearing session data: $e');
    }
  }

  // ============================================
  // ... (REST OF THE METHODS REMAIN UNCHANGED)
  // ============================================

  Future<bool> checkUserExists(String email) async {
    try {
      debugPrint('🔍 Checking if user exists: $email');
      final exists = await _authService.checkUserExists(email);
      _lastAuthCheck = DateTime.now();
      debugPrint(
          '${exists ? '✅' : '❌'} User ${exists ? 'EXISTS' : 'NOT FOUND'}: $email');
      return exists;
    } catch (e) {
      debugPrint('⚠️ Error checking user: $e');
      return true;
    }
  }

  Future<void> _updateLastLogin(String uid) async {
    try {
      await _firestore.collection('users').doc(uid).update({
        'lastLogin': FieldValue.serverTimestamp(),
        'loginCount': FieldValue.increment(1),
      });
      debugPrint('✅ Updated last login for: $uid');
    } catch (e) {
      debugPrint('⚠️ Error updating last login: $e');
    }
  }

  void _incrementFailedAttempts() {
    _failedLoginAttempts++;
    if (_failedLoginAttempts >= 5) {
      _lockoutUntil = DateTime.now().add(const Duration(minutes: 15));
      debugPrint('🔒 Account locked for 15 minutes');
      _error = 'Too many failed attempts. Try again in 15 minutes.';
    }
    _safeNotifyListeners();
  }

  void _resetFailedAttempts() {
    _failedLoginAttempts = 0;
    _lockoutUntil = null;
    debugPrint('✅ Failed attempts reset');
  }

  Future<bool> registerWithEmail({
    required String email,
    required String password,
    required String name,
    String? phone,
  }) async {
    try {
      if (isLocked) {
        _error = 'Too many attempts. Please try again later.';
        _safeNotifyListeners();
        return false;
      }

      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📝 Registering user: $email');

      _currentUser = await _authService.registerWithEmail(
        email: email.trim(),
        password: password,
        name: name.trim(),
        phone: phone?.trim(),
      );

      if (_isDisposed) return false;

      await _saveSessionData(_currentUser!);
      await _logAuthEvent('registration', true, email);

      if (_rememberMe) {
        await _storeCredentials(email);
      }

      debugPrint('✅ Registration successful: ${_currentUser?.uid}');
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Firebase Auth Registration error: ${e.code} - ${e.message}');
      _error = _getFirebaseErrorMessage(e.code);
      _incrementFailedAttempts();
      await _logAuthEvent('registration', false, email, error: e.code);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Registration error: ${e.message}');
      _error = e.message;
      _incrementFailedAttempts();
      await _logAuthEvent('registration', false, email, error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Registration error: $e');
      _error = 'Registration failed. Please try again.';
      _incrementFailedAttempts();
      await _logAuthEvent('registration', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<bool> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      if (isLocked) {
        _error = 'Too many attempts. Please try again later.';
        _safeNotifyListeners();
        return false;
      }

      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Signing in user: $email');

      _currentUser = await _authService.signInWithEmail(
        email: email.trim(),
        password: password,
      );

      if (_isDisposed) return false;

      await _saveSessionData(_currentUser!);
      await _logAuthEvent('login', true, email);

      if (_rememberMe) {
        await _storeCredentials(email);
      }

      debugPrint('✅ Sign in successful: ${_currentUser?.uid}');
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Firebase Auth Sign in error: ${e.code} - ${e.message}');
      _error = _getFirebaseErrorMessage(e.code);
      _incrementFailedAttempts();
      await _logAuthEvent('login', false, email, error: e.code);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Sign in error: ${e.message}');
      _error = e.message;
      _incrementFailedAttempts();
      await _logAuthEvent('login', false, email, error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Sign in error: $e');
      _error = 'Sign in failed. Please try again.';
      _incrementFailedAttempts();
      await _logAuthEvent('login', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    try {
      if (isLocked) {
        _error = 'Too many attempts. Please try again later.';
        _safeNotifyListeners();
        return false;
      }

      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Signing in with Google...');

      _currentUser = await _authService.signInWithGoogle();

      if (_isDisposed) return false;

      await _saveSessionData(_currentUser!);
      await _logAuthEvent('google_login', true, _currentUser?.email ?? 'unknown');

      debugPrint('✅ Google sign in successful: ${_currentUser?.uid}');
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Google sign in error: ${e.message}');
      _error = e.message;
      _incrementFailedAttempts();
      await _logAuthEvent('google_login', false, 'unknown', error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Google sign in error: $e');
      if (e.toString().contains('PlatformException')) {
        _error = 'Google sign in cancelled';
      } else {
        _error = 'Google sign in failed. Please try again.';
      }
      _incrementFailedAttempts();
      await _logAuthEvent('google_login', false, 'unknown', error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<bool> updateUserProfile({
    String? name,
    String? phone,
    String? photoUrl,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📝 Updating user profile...');

      if (_currentUser == null) {
        _error = 'No user logged in';
        _isLoading = false;
        _safeNotifyListeners();
        return false;
      }

      final updatedUser = _currentUser!.copyWith(
        name: name ?? _currentUser!.name,
        phone: phone ?? _currentUser!.phone,
        photoUrl: photoUrl ?? _currentUser!.photoUrl,
      );

      await _firestore
          .collection('users')
          .doc(_currentUser!.uid)
          .update(updatedUser.toMap());

      if (_isDisposed) return false;

      _currentUser = updatedUser;
      await _saveSessionData(_currentUser!);

      _error = null;
      await _logAuthEvent('profile_update', true, _currentUser!.email);

      debugPrint('✅ User profile updated successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error updating profile: $e');
      _error = 'Failed to update profile: $e';
      await _logAuthEvent('profile_update', false,
          _currentUser?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile({
    String? name,
    String? phone,
    String? photoUrl,
  }) async {
    return updateUserProfile(
      name: name,
      phone: phone,
      photoUrl: photoUrl,
    );
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Changing password...');

      await _authService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      if (_isDisposed) return false;

      await _logAuthEvent('password_change', true, _currentUser?.email ?? 'unknown');

      debugPrint('✅ Password changed successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Firebase Auth Password change error: ${e.code}');
      _error = _getFirebaseErrorMessage(e.code);
      await _logAuthEvent('password_change', false,
          _currentUser?.email ?? 'unknown',
          error: e.code);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error changing password: $e');
      _error = 'Failed to change password. Please try again.';
      await _logAuthEvent('password_change', false,
          _currentUser?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<bool> sendPasswordResetEmail(String email) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📧 Sending password reset email to: $email');

      await _authService.sendPasswordResetEmail(email.trim());
      
      if (_isDisposed) return false;
      
      await _logAuthEvent('password_reset_request', true, email);

      debugPrint('✅ Password reset email sent successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on FirebaseAuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Firebase Auth Password reset error: ${e.code}');
      _error = _getFirebaseErrorMessage(e.code);
      await _logAuthEvent('password_reset_request', false, email, error: e.code);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error sending password reset email: $e');
      _error = 'Failed to send reset email. Please try again.';
      await _logAuthEvent('password_reset_request', false, email,
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<void> signOut() async {
    try {
      debugPrint('🚪 Signing out...');

      if (_currentUser != null) {
        try {
          await _firestore
              .collection('sessions')
              .where('userId', isEqualTo: _currentUser!.uid)
              .get()
              .then((snapshot) {
            for (var doc in snapshot.docs) {
              doc.reference.delete();
            }
          });
        } catch (e) {
          debugPrint('⚠️ Error clearing Firestore sessions: $e');
        }
      }

      await _authService.signOut();
      await _clearSessionData();

      _currentUser = null;
      _error = null;
      _resetFailedAttempts();

      await _logAuthEvent('logout', true, 'user');

      debugPrint('✅ Sign out successful');
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error signing out: $e');
      _error = e.toString();
      _safeNotifyListeners();
    }
  }

  Future<bool> deleteAccount() async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🗑️ Deleting account...');

      final email = _currentUser?.email ?? 'unknown';

      await _authService.deleteAccount();
      
      if (_isDisposed) return false;
      
      await _clearSessionData();

      _currentUser = null;
      _resetFailedAttempts();

      await _logAuthEvent('account_deletion', true, email);

      debugPrint('✅ Account deleted successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error deleting account: $e');
      _error = 'Failed to delete account. Please try again.';
      await _logAuthEvent('account_deletion', false,
          _currentUser?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  Future<void> _storeCredentials(String email) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      await _prefs?.setString(StorageConstants.keyRememberEmail, email);
      await _prefs?.setBool(StorageConstants.keyRememberMe, true);

      debugPrint('💾 Stored credentials for remember me: $email');
    } catch (e) {
      debugPrint('⚠️ Error storing credentials: $e');
    }
  }

  Future<void> _logAuthEvent(
    String eventType,
    bool success,
    String email, {
    String? error,
  }) async {
    try {
      await _firestore.collection('auth_logs').add({
        'event': eventType,
        'success': success,
        'email': email,
        'error': error,
        'timestamp': FieldValue.serverTimestamp(),
        'platform': 'flutter',
        'uid': _currentUser?.uid,
      });

      debugPrint('📊 Logged auth event: $eventType ($success)');
    } catch (e) {
      debugPrint('⚠️ Error logging auth event: $e');
    }
  }

  Future<void> refreshUserData() async {
    try {
      if (_currentUser == null) return;

      debugPrint('🔄 Refreshing user data...');

      _currentUser = await _authService.getUserData(_currentUser!.uid);
      
      if (_isDisposed) return;
      
      await _saveSessionData(_currentUser!);

      _safeNotifyListeners();
      debugPrint('✅ User data refreshed');
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error refreshing user data: $e');
      _error = 'Failed to refresh user data';
      _safeNotifyListeners();
    }
  }

  void clearError() {
    _error = null;
    _safeNotifyListeners();
  }

  void setRememberMe(bool value) {
    _rememberMe = value;
    _safeNotifyListeners();
  }

  String _getFirebaseErrorMessage(String code) {
    switch (code) {
      case 'email-already-in-use':
        return '📧 Email already registered. Please login instead.';
      case 'weak-password':
        return '🔐 Password too weak. Use 8+ chars with uppercase, lowercase, and numbers.';
      case 'user-not-found':
        return '👤 Email not registered. Please sign up.';
      case 'wrong-password':
        return '🔑 Wrong password. Please try again.';
      case 'invalid-email':
        return '✉️ Invalid email address. Please check and try again.';
      case 'too-many-requests':
        return '⏰ Too many login attempts. Try again later.';
      case 'network-request-failed':
        return '🌐 Network error. Check your internet connection.';
      case 'operation-not-allowed':
        return '❌ Operation not allowed. Please contact support.';
      case 'invalid-credential':
        return '🔓 Invalid credentials. Please try again.';
      case 'user-disabled':
        return '🚫 This account has been disabled.';
      case 'requires-recent-login':
        return '🔑 Please re-authenticate to continue.';
      default:
        return '⚠️ Authentication failed. Please try again.';
    }
  }

  void printUserInfo() {
    if (_currentUser != null) {
      debugPrint(_currentUser!.debugInfo);
    } else {
      debugPrint('❌ No user logged in');
    }
  }

  Future<Map<String, dynamic>> getSessionInfo() async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      return {
        'isLoggedIn': _prefs?.getBool(StorageConstants.keyIsLoggedIn) ?? false,
        'userId': _prefs?.getString(StorageConstants.keyUserId),
        'userEmail': _prefs?.getString(StorageConstants.keyUserEmail),
        'userName': _prefs?.getString(StorageConstants.keyUserName),
        'userRole': _prefs?.getString(StorageConstants.keyUserRole),
        'userType': _prefs?.getString(StorageConstants.keyUserType),
        'lastLoginTime': _prefs?.getInt(StorageConstants.keyLastLoginTime),
        'sessionStartTime':
            _prefs?.getInt(StorageConstants.keySessionStartTime),
      };
    } catch (e) {
      debugPrint('❌ Error getting session info: $e');
      return {};
    }
  }

  // ============================================
  // 🔥 EMAIL OTP AUTHENTICATION
  // ============================================

  String? _pendingOtpEmail;
  String? _pendingOtpCode;

  /// Send OTP to email for authentication
  Future<void> sendEmailOTP(String email) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📧 Sending OTP to: $email');

      // Call Firebase Function to send OTP
      final response = await _authService.sendEmailOTP(email.trim());
      
      if (_isDisposed) return;

      _pendingOtpEmail = email.trim();
      
      debugPrint('✅ OTP sent successfully to $email');
      _isLoading = false;
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error sending OTP: $e');
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      _safeNotifyListeners();
      rethrow;
    }
  }

  /// Verify OTP and login existing user
  Future<void> verifyEmailOTPAndLogin({
    required String email,
    required String otp,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Verifying OTP for login: $email');

      // Call Firebase Function to verify OTP and sign in
      final result = await _authService.verifyEmailOTPAndLogin(
        email: email.trim(),
        otp: otp.trim(),
      );
      
      if (_isDisposed) return;

      // Get user data
      final uid = result['uid'] as String;
      _currentUser = await _authService.getUserData(uid);
      
      if (_isDisposed) return;

      await _saveSessionData(_currentUser!);
      await _updateLastLogin(uid);
      await _logAuthEvent('otp_login', true, email);

      debugPrint('✅ OTP login successful: ${_currentUser?.email}');
      _pendingOtpEmail = null;
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ OTP login error: $e');
      _error = e.toString().replaceAll('Exception: ', '');
      _incrementFailedAttempts();
      await _logAuthEvent('otp_login', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      rethrow;
    }
  }

  /// Verify OTP and signup new user
  Future<void> verifyEmailOTPAndSignup({
    required String email,
    required String otp,
    required String name,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Verifying OTP for signup: $email');

      // Call Firebase Function to verify OTP and create account
      final result = await _authService.verifyEmailOTPAndSignup(
        email: email.trim(),
        otp: otp.trim(),
        name: name.trim(),
      );
      
      if (_isDisposed) return;

      // Get user data
      final uid = result['uid'] as String;
      _currentUser = await _authService.getUserData(uid);
      
      if (_isDisposed) return;

      await _saveSessionData(_currentUser!);
      await _updateLastLogin(uid);
      await _logAuthEvent('otp_signup', true, email);

      debugPrint('✅ OTP signup successful: ${_currentUser?.email}');
      _pendingOtpEmail = null;
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ OTP signup error: $e');
      _error = e.toString().replaceAll('Exception: ', '');
      _incrementFailedAttempts();
      await _logAuthEvent('otp_signup', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      rethrow;
    }
  }

  @override
  void dispose() {
    debugPrint('🧹 AuthProvider disposing...');
    _isDisposed = true;
    _authStateSubscription?.cancel();
    _authStateSubscription = null;
    super.dispose();
  }
}