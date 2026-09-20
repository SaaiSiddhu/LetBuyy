// lib/providers/seller_provider.dart
//
// 🔥 FIXED: Compatible with web refresh behavior
// Prevents "deactivated widget" errors during async initialization

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

class SellerProvider with ChangeNotifier {
  // ============================================
  // SERVICES & FIREBASE
  // ============================================

  final SellerService _sellerService = SellerService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  SharedPreferences? _prefs;

  // ============================================
  // STATE VARIABLES
  // ============================================

  SellerModel? _currentSeller;
  bool _isLoading = false;
  // 🔥 Default to TRUE so app waits for check to complete
  bool _isInitializing = true; 
  String? _error;
  bool _rememberMe = false;
  int _failedLoginAttempts = 0;
  DateTime? _lockoutUntil;
  StreamSubscription<User?>? _authStateSubscription;
  StreamSubscription<DocumentSnapshot>? _sellerDocSubscription;
  bool _sessionRestored = false;
  bool _isDisposed = false; 

  // ============================================
  // GETTERS
  // ============================================

  SellerModel? get currentSeller => _currentSeller;
  bool get isLoading => _isLoading;
  bool get isInitializing => _isInitializing;
  bool get sessionRestored => _sessionRestored;
  String? get error => _error;
  bool get isLoggedIn => _currentSeller != null;
  bool get isVerified => _currentSeller?.isVerified ?? false;
  bool get isPending => _currentSeller?.isPending ?? false;
  bool get isRejected => _currentSeller?.isRejected ?? false;
  bool get isSuspended => _currentSeller?.isSuspended ?? false;
  bool get isLocked =>
      _lockoutUntil != null && DateTime.now().isBefore(_lockoutUntil!);
  bool get rememberMe => _rememberMe;
  String? get sellerEmail => _currentSeller?.email;
  String? get sellerName => _currentSeller?.name;
  String? get storeName => _currentSeller?.storeName;
  String? get sellerId => _currentSeller?.sellerId;
  double? get walletBalance => _currentSeller?.walletBalance;
  double? get rating => _currentSeller?.rating;
  int? get totalProducts => _currentSeller?.totalProducts;
  int? get totalOrders => _currentSeller?.totalOrders;
  VerificationStatus? get verificationStatus => _currentSeller?.verificationStatus;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  SellerProvider() {
    _initialize();
  }

  // ============================================
  // 🔥 INITIALIZE - Called on app startup
  // ============================================

  void _initialize() {
    debugPrint('🔄 SellerProvider initializing...');
    _initializePreferences().then((_) {
      if (_isDisposed) return;
      _listenToAuthChanges();
    });
  }

  // ============================================
  // 🔥 INITIALIZE SHARED PREFERENCES
  // ============================================

  Future<void> _initializePreferences() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      debugPrint('✅ SellerProvider SharedPreferences initialized');

      _rememberMe = _prefs?.getBool(StorageConstants.keyRememberMe) ?? false;
      debugPrint('💾 Loaded seller preferences: rememberMe=$_rememberMe');
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
        debugPrint('⚠️ SellerProvider: Error notifying listeners: $e');
      }
    }
  }

  // ============================================
  // 🔥 LISTEN TO AUTH STATE CHANGES
  // ============================================

  void _listenToAuthChanges() {
    debugPrint('🔐 Setting up seller auth state listener...');

    _authStateSubscription?.cancel();

    _authStateSubscription =
        _sellerService.authStateChanges.listen((User? user) async {
      if (_isDisposed) return; 

      debugPrint('🔄 Seller auth state changed: user=${user?.uid}');

      if (user != null) {
        if (_currentSeller?.sellerId == user.uid) return;

        try {
          debugPrint('🔐 Firebase seller user detected: ${user.uid}');

          // 🔥 Force token refresh to verify session is still valid
          try {
            await user.getIdToken(true);
            debugPrint('✅ Seller token refreshed successfully');
          } catch (tokenError) {
            debugPrint('❌ Seller token refresh failed: $tokenError');
            _currentSeller = null;
            await _clearSellerSession();
            _isInitializing = false;
            _sessionRestored = true;
            _safeNotifyListeners();
            return;
          }

          if (_isDisposed) return; 

          _currentSeller = await _sellerService.getSellerData(user.uid);

          if (_isDisposed) return; 

          await _saveSellerSession(_currentSeller!);
          await _updateLastLogin(user.uid);

          debugPrint('✅ Seller loaded: ${_currentSeller?.email}');
          
          // 🔥 Start listening to real-time seller document changes
          _startSellerDocListener(_currentSeller!.sellerId);
          
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
        } catch (e) {
          if (_isDisposed) return;
          
          debugPrint('❌ Error loading seller data: $e');
          _error = e.toString();
          _currentSeller = null;
          
          // 🔥 FIX: If error is "Seller data not found", DON'T clear session
          // This allows new sellers (Firebase Auth exists but no Firestore doc)
          // to stay authenticated and be redirected to signup/complete profile
          final isNewSeller = e.toString().contains('not found') || 
                               e.toString().contains('No seller');
          
          if (!isNewSeller) {
            // Only clear session for OTHER errors (auth issues, network, etc.)
            await _clearSellerSession();
          } else {
            debugPrint('⚠️ New seller detected - keeping Firebase Auth session');
          }
          
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
        }
      } else {
        if (_isDisposed) return;
        
        debugPrint('👤 No Firebase seller user logged in');
        _currentSeller = null;
        await _clearSellerSession();
        _isInitializing = false;
        _sessionRestored = true;
        _safeNotifyListeners();
      }
    });
  }

  // ============================================
  // 🔥 MANUAL LOAD SELLER (For Web/Auth Wrapper)
  // ============================================

  Future<void> loadSeller(String uid) async {
    if (_isDisposed) return;
    
    // Don't reload if already loaded and matching
    if (_currentSeller?.sellerId == uid) return;

    try {
      debugPrint('🔄 Manually loading seller data: $uid');
      _currentSeller = await _sellerService.getSellerData(uid);
      
      if (_isDisposed) return;

      if (_currentSeller != null) {
        await _saveSellerSession(_currentSeller!);
        await _updateLastLogin(uid);
        
        // Start listener if not already active
        _startSellerDocListener(uid);
        
        debugPrint('✅ Manual load successful: ${_currentSeller?.email}');
      } else {
        debugPrint('⚠️ Manual load: Seller not found for uid $uid');
      }
      
      _isInitializing = false;
      _sessionRestored = true;
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      debugPrint('❌ Manual load error: $e');
      _error = e.toString();
      _isInitializing = false;
      _sessionRestored = true;
      _safeNotifyListeners();
    }
  }

  // ============================================
  // 🔥 RESTORE SESSION ON APP START
  // ============================================

  Future<void> restoreSession() async {
    try {
      debugPrint('🔄 Restoring seller session...');
      // _isInitializing stays true until finished
      
      if (_prefs == null) {
        await _initializePreferences();
      }

      if (_isDisposed) return; 

      final firebaseUser = _firebaseAuth.currentUser;

      if (firebaseUser != null) {
        debugPrint('🔐 Firebase seller user found: ${firebaseUser.uid}');

        // 🔥 Verify token is still valid
        try {
          await firebaseUser.getIdToken(true);
          debugPrint('✅ Seller token valid and refreshed');
        } catch (e) {
          debugPrint('⚠️ Seller token refresh failed, clearing session: $e');
          await _firebaseAuth.signOut();
          _currentSeller = null;
          await _clearSellerSession();
          _isInitializing = false;
          _sessionRestored = true;
          _safeNotifyListeners();
          return;
        }

        if (_isDisposed) return; 

        try {
          _currentSeller =
              await _sellerService.getSellerData(firebaseUser.uid);
          
          if (_isDisposed) return;
          
          await _saveSellerSession(_currentSeller!);
          debugPrint('✅ Seller session restored: ${_currentSeller?.email}');
        } catch (e) {
          if (_isDisposed) return;
          
          debugPrint('❌ Failed to load seller data: $e');
          _currentSeller = null;
          await _clearSellerSession();
        }
      } else {
        debugPrint('❌ No Firebase seller user found');
        _currentSeller = null;
        await _clearSellerSession();
      }

      if (_isDisposed) return; 

      _isInitializing = false; // 🔥 Mark initialization complete
      _sessionRestored = true;
      _safeNotifyListeners();
      debugPrint('✅ Seller session restoration complete. Seller: ${_currentSeller?.email ?? "none"}');
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error in seller restoreSession: $e');
      _isInitializing = false; // 🔥 Ensure we don't get stuck loading
      _sessionRestored = true;
      _error = e.toString();
      _currentSeller = null;
      await _clearSellerSession();
      _safeNotifyListeners();
    }
  }

  // ============================================
  // 🔥 SAVE SELLER SESSION TO LOCAL STORAGE
  // ============================================

  Future<void> _saveSellerSession(SellerModel seller) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      await _prefs?.setString(StorageConstants.keyUserId, seller.sellerId);
      await _prefs?.setString(StorageConstants.keyUserEmail, seller.email);
      await _prefs?.setString(StorageConstants.keyUserName, seller.name);
      await _prefs?.setString(StorageConstants.keyUserRole, 'seller');
      await _prefs?.setString(StorageConstants.keyUserType, 'seller');

      await _prefs?.setInt(
        StorageConstants.keyLastLoginTime,
        DateTime.now().millisecondsSinceEpoch,
      );

      await _prefs?.setInt(
        StorageConstants.keySessionStartTime,
        DateTime.now().millisecondsSinceEpoch,
      );

      await _prefs?.setBool(StorageConstants.keyIsLoggedIn, true);

      // 🚀 Cache full seller model for fast startup
      await _cacheSellerModel(seller);

      debugPrint('💾 Seller session saved to local storage: ${seller.email}');
    } catch (e) {
      debugPrint('⚠️ Error saving seller session: $e');
    }
  }

  // ============================================
  // 🔥 CLEAR SELLER SESSION FROM LOCAL STORAGE
  // ============================================

  Future<void> _clearSellerSession() async {
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
      await _prefs?.remove(StorageConstants.keyRememberEmail);
      await _prefs?.setBool(StorageConstants.keyIsLoggedIn, false);
      await _prefs?.remove('cached_seller_model'); // 🚀 Clear cached model too

      debugPrint('🧹 Seller session cleared from local storage');
    } catch (e) {
      debugPrint('⚠️ Error clearing seller session: $e');
    }
  }

  // ============================================
  // 🚀 CACHE FULL SELLER MODEL FOR FAST STARTUP
  // ============================================

  static const String _cachedSellerKey = 'cached_seller_model';

  /// Cache the full seller model as JSON for instant startup routing
  Future<void> _cacheSellerModel(SellerModel seller) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }
      
      final jsonString = jsonEncode(seller.toJson());
      await _prefs?.setString(_cachedSellerKey, jsonString);
      await _prefs?.setString('cached_seller_id', seller.sellerId);
      debugPrint('💾 Cached full seller model for fast startup');
    } catch (e) {
      debugPrint('⚠️ Error caching seller model: $e');
    }
  }

  /// Load cached seller model instantly (no network) for fast routing
  Future<SellerModel?> loadCachedSeller(String uid) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }
      
      // Check if cached seller matches requested uid
      final cachedId = _prefs?.getString('cached_seller_id');
      if (cachedId != uid) {
        debugPrint('⚠️ Cached seller ID mismatch: cached=$cachedId, requested=$uid');
        return null;
      }
      
      final jsonString = _prefs?.getString(_cachedSellerKey);
      if (jsonString == null || jsonString.isEmpty) {
        debugPrint('⚠️ No cached seller model found');
        return null;
      }
      
      final Map<String, dynamic> map = jsonDecode(jsonString);
      final cachedSeller = SellerModel.fromJson(map);
      
      debugPrint('⚡ Loaded cached seller: ${cachedSeller.email}');
      return cachedSeller;
    } catch (e) {
      debugPrint('⚠️ Error loading cached seller: $e');
      return null;
    }
  }

  /// Load seller with cache-first strategy for fast startup
  Future<void> loadSellerWithCache(String uid) async {
    if (_isDisposed) return;
    
    // Don't reload if already loaded and matching
    if (_currentSeller?.sellerId == uid) return;

    try {
      debugPrint('🚀 Fast loading seller: $uid');
      
      // 1️⃣ Try cache first (instant, no network)
      final cachedSeller = await loadCachedSeller(uid);
      if (cachedSeller != null) {
        _currentSeller = cachedSeller;
        _isInitializing = false;
        _sessionRestored = true;
        _safeNotifyListeners();
        
        debugPrint('⚡ Using cached seller for instant routing');
        
        // 2️⃣ Refresh from Firestore in background
        _refreshSellerInBackground(uid);
        return;
      }
      
      // 3️⃣ Fallback: Load from Firestore (slower)
      await loadSeller(uid);
    } catch (e) {
      if (_isDisposed) return;
      debugPrint('❌ Fast load error: $e');
      _error = e.toString();
      _isInitializing = false;
      _sessionRestored = true;
      _safeNotifyListeners();
    }
  }

  /// Refresh seller from Firestore in background (non-blocking)
  void _refreshSellerInBackground(String uid) {
    Future.microtask(() async {
      try {
        debugPrint('🔄 Background refreshing seller from Firestore...');
        final freshSeller = await _sellerService.getSellerData(uid);
        
        if (_isDisposed) return;
        
        _currentSeller = freshSeller;
        await _cacheSellerModel(freshSeller);
        await _updateLastLogin(uid);
        _safeNotifyListeners();
        debugPrint('✅ Background refresh complete: ${freshSeller.email}');
            } catch (e) {
        debugPrint('⚠️ Background refresh failed: $e');
      }
    });
  }

  // ============================================
  // CHECK IF SELLER EXISTS
  // ============================================

  Future<bool> checkSellerExists(String email) async {
    try {
      debugPrint('🔍 Checking if seller exists: $email');
      final exists = await _sellerService.checkSellerExists(email);
      debugPrint(
          '${exists ? '✅' : '❌'} Seller ${exists ? 'EXISTS' : 'NOT FOUND'}: $email');
      return exists;
    } catch (e) {
      debugPrint('⚠️ Error checking seller: $e');
      return false;
    }
  }

  // ============================================
  // UPDATE LAST LOGIN TIMESTAMP
  // ============================================

  Future<void> _updateLastLogin(String sellerId) async {
    try {
      await _firestore.collection('sellers').doc(sellerId).update({
        'lastLogin': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Updated last login for seller: $sellerId');
    } catch (e) {
      debugPrint('⚠️ Error updating last login: $e');
    }
  }

  // ============================================
  // HANDLE LOGIN ATTEMPTS (Rate Limiting)
  // ============================================

  void _incrementFailedAttempts() {
    _failedLoginAttempts++;
    if (_failedLoginAttempts >= 5) {
      _lockoutUntil = DateTime.now().add(const Duration(minutes: 15));
      debugPrint('🔒 Seller account locked for 15 minutes');
      _error = 'Too many failed attempts. Try again in 15 minutes.';
    }
    _safeNotifyListeners();
  }

  void _resetFailedAttempts() {
    _failedLoginAttempts = 0;
    _lockoutUntil = null;
    debugPrint('✅ Failed attempts reset');
  }

  // ============================================
  // REGISTER SELLER
  // ============================================

  Future<bool> registerSeller({
    required String email,
    required String password,
    required String name,
    required String phone,
    required String businessType,
    required String businessLegalName,
    required String storeName,
    required String businessAddress,
    required String businessContact,
    required String businessCity,
    required String businessPincode,
    required String businessState,
    required String panNumber,
    required String gstNumber,
    bool gstExempt = false,
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

      debugPrint('📝 Registering seller: $email');

      _currentSeller = await _sellerService.registerSeller(
        email: email,
        password: password,
        name: name,
        phone: phone,
        businessType: businessType,
        businessLegalName: businessLegalName,
        storeName: storeName,
        businessAddress: businessAddress,
        businessContact: businessContact,
        businessCity: businessCity,
        businessPincode: businessPincode,
        businessState: businessState,
        panNumber: panNumber,
        gstNumber: gstNumber,
        gstExempt: gstExempt,
      );

      if (_isDisposed) return false;

      await _saveSellerSession(_currentSeller!);
      await _logSellerEvent('registration', true, email);

      if (_rememberMe) {
        await _storeCredentials(email);
      }

      debugPrint('✅ Seller registration successful: ${_currentSeller?.sellerId}');
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Seller registration error: ${e.message}');
      _error = e.message;
      _incrementFailedAttempts();
      await _logSellerEvent('registration', false, email, error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Seller registration error: $e');
      _error = 'Registration failed. Please try again.';
      _incrementFailedAttempts();
      await _logSellerEvent('registration', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // SIGN IN SELLER
  // ============================================

  Future<bool> signInSeller({
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

      debugPrint('🔐 Signing in seller: $email');

      _currentSeller = await _sellerService.signInSeller(
        email: email,
        password: password,
      );

      if (_isDisposed) return false;

      await _saveSellerSession(_currentSeller!);
      await _logSellerEvent('login', true, email);

      if (_rememberMe) {
        await _storeCredentials(email);
      }

      // ✅ ADDED: Save FCM token for seller push notifications (mobile only)
      if (!kIsWeb && _currentSeller?.sellerId != null) {
        try {
          await FCMService().saveSellerToken(_currentSeller!.sellerId);
          debugPrint('✅ Seller FCM token saved for push notifications');
        } catch (fcmError) {
          debugPrint('⚠️ Could not save seller FCM token: $fcmError');
        }
      }

      debugPrint('✅ Seller sign in successful: ${_currentSeller?.sellerId}');
      _resetFailedAttempts();
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Seller sign in error: ${e.message}');
      _error = e.message;
      _incrementFailedAttempts();
      await _logSellerEvent('login', false, email, error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Seller sign in error: $e');
      _error = 'Sign in failed. Please try again.';
      _incrementFailedAttempts();
      await _logSellerEvent('login', false, email, error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // UPDATE SELLER PROFILE
  // ============================================

  Future<bool> updateSellerProfile({
    String? name,
    String? phone,
    String? photoUrl,
    String? storeName,
    String? businessAddress,
    String? businessAddress2,
    String? businessLandmark,
    String? businessContact,
    String? businessCity,
    String? businessPincode,
    String? businessState,
    String? businessDistrict,
    // KYC Fields
    String? panNumber,
    String? panName,
    String? aadhaarNumber,
    String? aadhaarName,
    String? businessType,
    String? gstNumber,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📝 Updating seller profile...');

      if (_currentSeller == null) {
        _error = 'No seller logged in';
        _isLoading = false;
        _safeNotifyListeners();
        return false;
      }

      // Build update data map
      final Map<String, dynamic> updateData = {};
      if (name != null) updateData['name'] = name;
      if (phone != null) updateData['phone'] = phone;
      if (photoUrl != null) updateData['photoUrl'] = photoUrl;
      if (storeName != null) updateData['storeName'] = storeName;
      if (businessAddress != null) updateData['businessAddress'] = businessAddress;
      if (businessAddress2 != null) updateData['businessAddress2'] = businessAddress2;
      if (businessLandmark != null) updateData['businessLandmark'] = businessLandmark;
      if (businessContact != null) updateData['businessContact'] = businessContact;
      if (businessCity != null) updateData['businessCity'] = businessCity;
      if (businessPincode != null) updateData['businessPincode'] = businessPincode;
      if (businessState != null) updateData['businessState'] = businessState;
      if (businessDistrict != null) updateData['businessDistrict'] = businessDistrict;
      // KYC Fields
      if (panNumber != null) updateData['panNumber'] = panNumber;
      if (panName != null) updateData['panName'] = panName;
      if (aadhaarNumber != null) updateData['aadhaarNumber'] = aadhaarNumber;
      if (aadhaarName != null) updateData['aadhaarName'] = aadhaarName;
      if (businessType != null) updateData['businessType'] = businessType;
      if (gstNumber != null) updateData['gstNumber'] = gstNumber;
      
      // Set KYC status to pending when KYC data is submitted
      if (panNumber != null || aadhaarNumber != null) {
        updateData['verificationStatus'] = 'pending';
        updateData['kycSubmittedAt'] = FieldValue.serverTimestamp();
      }
      
      updateData['updatedAt'] = FieldValue.serverTimestamp();

      await _firestore.collection('sellers').doc(_currentSeller!.sellerId).update(updateData);

      if (_isDisposed) return false;

      _currentSeller = _currentSeller!.copyWith(
        name: name ?? _currentSeller!.name,
        phone: phone ?? _currentSeller!.phone,
        photoUrl: photoUrl ?? _currentSeller!.photoUrl,
        storeName: storeName ?? _currentSeller!.storeName,
        businessAddress: businessAddress ?? _currentSeller!.businessAddress,
        businessAddress2: businessAddress2 ?? _currentSeller!.businessAddress2,
        businessLandmark: businessLandmark ?? _currentSeller!.businessLandmark,
        businessContact: businessContact ?? _currentSeller!.businessContact,
        businessCity: businessCity ?? _currentSeller!.businessCity,
        businessPincode: businessPincode ?? _currentSeller!.businessPincode,
        businessState: businessState ?? _currentSeller!.businessState,
        businessDistrict: businessDistrict ?? _currentSeller!.businessDistrict,
      );

      await _saveSellerSession(_currentSeller!);
      await _logSellerEvent('profile_update', true, _currentSeller!.email);

      debugPrint('✅ Seller profile updated successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error updating seller profile: $e');
      _error = 'Failed to update profile: $e';
      await _logSellerEvent('profile_update', false,
          _currentSeller?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // UPDATE BANK DETAILS
  // ============================================

  Future<bool> updateBankDetails({
    required String accountNumber,
    required String ifscCode,
    required String accountHolderName,
    required String bankName,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('💳 Updating bank details...');

      if (_currentSeller == null) {
        _error = 'No seller logged in';
        _isLoading = false;
        _safeNotifyListeners();
        return false;
      }

      await _sellerService.updateBankDetails(
        sellerId: _currentSeller!.sellerId,
        accountNumber: accountNumber,
        ifscCode: ifscCode,
        accountHolderName: accountHolderName,
        bankName: bankName,
      );

      if (_isDisposed) return false;

      _currentSeller = _currentSeller!.copyWith(
        bankAccountNumber: accountNumber,
        bankIfscCode: ifscCode,
        bankAccountHolderName: accountHolderName,
        bankName: bankName,
      );

      await _saveSellerSession(_currentSeller!);
      await _logSellerEvent('bank_update', true, _currentSeller!.email);

      debugPrint('✅ Bank details updated successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error updating bank details: $e');
      _error = 'Failed to update bank details: $e';
      await _logSellerEvent('bank_update', false,
          _currentSeller?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // SUBMIT KYC DOCUMENTS
  // ============================================

  Future<bool> submitKYCDocuments({
    required String aadharNumber,
    required String aadharName,
    required String panNumber,
    required String panName,
    required File aadharFrontImage,
    required File aadharBackImage,
    required File panCardImage,
    required File selfieImage,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📄 Submitting KYC documents...');

      if (_currentSeller == null) {
        _error = 'No seller logged in';
        _isLoading = false;
        _safeNotifyListeners();
        return false;
      }

      final storage = FirebaseStorage.instance;
      final sellerId = _currentSeller!.sellerId;

      debugPrint('📤 Uploading Aadhar front...');
      final aadharFrontRef = storage.ref().child('kyc/$sellerId/aadhar_front.jpg');
      await aadharFrontRef.putFile(aadharFrontImage);
      
      if (_isDisposed) return false;
      
      final aadharFrontUrl = await aadharFrontRef.getDownloadURL();

      debugPrint('📤 Uploading Aadhar back...');
      final aadharBackRef = storage.ref().child('kyc/$sellerId/aadhar_back.jpg');
      await aadharBackRef.putFile(aadharBackImage);
      
      if (_isDisposed) return false;
      
      final aadharBackUrl = await aadharBackRef.getDownloadURL();

      debugPrint('📤 Uploading PAN card...');
      final panCardRef = storage.ref().child('kyc/$sellerId/pan_card.jpg');
      await panCardRef.putFile(panCardImage);
      
      if (_isDisposed) return false;
      
      final panCardUrl = await panCardRef.getDownloadURL();

      debugPrint('📤 Uploading selfie...');
      final selfieRef = storage.ref().child('kyc/$sellerId/selfie.jpg');
      await selfieRef.putFile(selfieImage);
      
      if (_isDisposed) return false;
      
      final selfieUrl = await selfieRef.getDownloadURL();

      debugPrint('💾 Saving KYC data to Firestore...');
      await _firestore.collection('sellers').doc(sellerId).update({
        'kycDocuments': {
          'aadharNumber': aadharNumber,
          'aadharName': aadharName,
          'aadharFrontUrl': aadharFrontUrl,
          'aadharBackUrl': aadharBackUrl,
          'panNumber': panNumber,
          'panName': panName,
          'panCardUrl': panCardUrl,
          'selfieUrl': selfieUrl,
          'submittedAt': FieldValue.serverTimestamp(),
          'verificationStatus': 'pending',
        },
        'verificationStatus': 'pending',
        'updatedAt': FieldValue.serverTimestamp(),
      });

      if (_isDisposed) return false;

      _currentSeller = _currentSeller!.copyWith(
        verificationStatus: VerificationStatus.pending,
      );

      await _saveSellerSession(_currentSeller!);
      await _logSellerEvent('kyc_submission', true, _currentSeller!.email);

      debugPrint('✅ KYC documents submitted successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error submitting KYC documents: $e');
      _error = 'Failed to submit KYC documents: $e';
      await _logSellerEvent('kyc_submission', false,
          _currentSeller?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // CHANGE PASSWORD
  // ============================================

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🔐 Changing seller password...');

      await _sellerService.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      if (_isDisposed) return false;

      await _logSellerEvent(
          'password_change', true, _currentSeller?.email ?? 'unknown');

      debugPrint('✅ Password changed successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Password change error: ${e.message}');
      _error = e.message;
      await _logSellerEvent('password_change', false,
          _currentSeller?.email ?? 'unknown',
          error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error changing password: $e');
      _error = 'Failed to change password. Please try again.';
      await _logSellerEvent('password_change', false,
          _currentSeller?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // SEND PASSWORD RESET EMAIL
  // ============================================

  Future<bool> sendPasswordResetEmail(String email) async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('📧 Sending password reset email to seller: $email');

      await _sellerService.sendPasswordResetEmail(email);
      
      if (_isDisposed) return false;
      
      await _logSellerEvent('password_reset_request', true, email);

      debugPrint('✅ Password reset email sent successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } on AuthException catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Password reset error: ${e.message}');
      _error = e.message;
      await _logSellerEvent('password_reset_request', false, email,
          error: e.message);
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error sending password reset email: $e');
      _error = 'Failed to send reset email. Please try again.';
      await _logSellerEvent('password_reset_request', false, email,
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // SIGN OUT
  // ============================================

  Future<void> signOut() async {
    try {
      debugPrint('🚪 Signing out seller...');

      if (_currentSeller != null) {
        // 🔔 Remove FCM token on logout
        try {
          await FCMService().removeSellerToken(_currentSeller!.sellerId);
          debugPrint('🔔 FCM token removed for seller');
        } catch (e) {
          debugPrint('⚠️ Error removing FCM token: $e');
        }
        
        try {
          await _firestore
              .collection('sessions')
              .where('userId', isEqualTo: _currentSeller!.sellerId)
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

      await _sellerService.signOut();
      await _clearSellerSession();

      _currentSeller = null;
      _error = null;
      _resetFailedAttempts();

      await _logSellerEvent('logout', true, 'seller');

      debugPrint('✅ Seller sign out successful');
      _safeNotifyListeners();
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error signing out seller: $e');
      _error = e.toString();
      _safeNotifyListeners();
    }
  }

  // ============================================
  // DELETE ACCOUNT
  // ============================================

  Future<bool> deleteAccount() async {
    try {
      _isLoading = true;
      _error = null;
      _safeNotifyListeners();

      debugPrint('🗑️ Deleting seller account...');

      final email = _currentSeller?.email ?? 'unknown';

      await _sellerService.deleteAccount();
      
      if (_isDisposed) return false;
      
      await _clearSellerSession();

      _currentSeller = null;
      _resetFailedAttempts();

      await _logSellerEvent('account_deletion', true, email);

      debugPrint('✅ Seller account deleted successfully');
      _isLoading = false;
      _safeNotifyListeners();
      return true;
    } catch (e) {
      if (_isDisposed) return false;
      
      debugPrint('❌ Error deleting seller account: $e');
      _error = 'Failed to delete account. Please try again.';
      await _logSellerEvent('account_deletion', false,
          _currentSeller?.email ?? 'unknown',
          error: e.toString());
      _isLoading = false;
      _safeNotifyListeners();
      return false;
    }
  }

  // ============================================
  // STORE CREDENTIALS (Remember Me)
  // ============================================

  Future<void> _storeCredentials(String email) async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      await _prefs?.setString(StorageConstants.keyRememberEmail, email);
      await _prefs?.setBool(StorageConstants.keyRememberMe, true);

      debugPrint('💾 Stored seller credentials for remember me: $email');
    } catch (e) {
      debugPrint('⚠️ Error storing seller credentials: $e');
    }
  }

  // ============================================
  // LOG SELLER EVENTS (Analytics)
  // ============================================

  Future<void> _logSellerEvent(
    String eventType,
    bool success,
    String email, {
    String? error,
  }) async {
    try {
      await _firestore.collection('seller_logs').add({
        'event': eventType,
        'success': success,
        'email': email,
        'error': error,
        'timestamp': FieldValue.serverTimestamp(),
        'platform': 'flutter',
        'sellerId': _currentSeller?.sellerId,
      });

      debugPrint('📊 Logged seller event: $eventType ($success)');
    } catch (e) {
      debugPrint('⚠️ Error logging seller event: $e');
    }
  }

  // ============================================
  // REFRESH SELLER DATA
  // ============================================

  Future<void> refreshSellerData() async {
    try {
      if (_currentSeller == null) return;

      debugPrint('🔄 Refreshing seller data...');

      _currentSeller =
          await _sellerService.getSellerData(_currentSeller!.sellerId);

      if (_isDisposed) return;

      await _saveSellerSession(_currentSeller!);

      _safeNotifyListeners();
      debugPrint('✅ Seller data refreshed');
    } catch (e) {
      if (_isDisposed) return;
      
      debugPrint('❌ Error refreshing seller data: $e');
      _error = 'Failed to refresh seller data';
      _safeNotifyListeners();
    }
  }

  // ============================================
  // CLEAR ERROR
  // ============================================

  void clearError() {
    _error = null;
    _safeNotifyListeners();
  }

  // ============================================
  // SET REMEMBER ME
  // ============================================

  void setRememberMe(bool value) {
    _rememberMe = value;
    _safeNotifyListeners();
  }

  // ============================================
  // GET SESSION INFO (DEBUG)
  // ============================================

  Future<Map<String, dynamic>> getSessionInfo() async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }

      return {
        'isLoggedIn': _prefs?.getBool(StorageConstants.keyIsLoggedIn) ?? false,
        'userId': _prefs?.getString(StorageConstants.keyUserId),
        'userEmail': _prefs?.getString(StorageConstants.keyUserEmail),
        'userType': _prefs?.getString(StorageConstants.keyUserType),
        'lastLoginTime': _prefs?.getInt(StorageConstants.keyLastLoginTime),
        'sessionStartTime':
            _prefs?.getInt(StorageConstants.keySessionStartTime),
      };
    } catch (e) {
      debugPrint('❌ Error getting seller session info: $e');
      return {};
    }
  }

  // ============================================
  // DEBUG: Print Seller Info
  // ============================================

  void printSellerInfo() {
    if (_currentSeller != null) {
      debugPrint(_currentSeller!.debugInfo);
    } else {
      debugPrint('❌ No seller logged in');
    }
  }

  // ============================================
  // 🔥 CLEANUP - Clean up resources
  // ============================================

  @override
  void dispose() {
    debugPrint('🧹 SellerProvider disposing...');
    _isDisposed = true;
    _authStateSubscription?.cancel();
    _authStateSubscription = null;
    _sellerDocSubscription?.cancel();
    _sellerDocSubscription = null;
    super.dispose();
  }

  // ============================================
  // 🔥 REAL-TIME KYC STATUS LISTENER
  // ============================================

  void _startSellerDocListener(String sellerId) {
    debugPrint('🔄 Starting real-time seller document listener for: $sellerId');
    
    _sellerDocSubscription?.cancel();
    
    _sellerDocSubscription = _firestore
        .collection('sellers')
        .doc(sellerId)
        .snapshots()
        .listen((snapshot) {
      if (_isDisposed || !snapshot.exists) return;
      
      try {
        final data = snapshot.data();
        if (data == null) return;
        
        final rawStatus = data['verificationStatus'];
        String? newStatusString;
        
        // Handle different storage formats for verificationStatus
        if (rawStatus is String) {
          newStatusString = rawStatus;
        } else if (rawStatus is Map) {
          // If stored as a map, try to get the status field
          newStatusString = rawStatus['status'] as String?;
        }
        
        final oldStatus = _currentSeller?.verificationStatus;
        
        // Parse the new verification status
        VerificationStatus? newStatus;
        if (newStatusString != null) {
          newStatus = VerificationStatus.values.firstWhere(
            (e) => e.name == newStatusString,
            orElse: () => VerificationStatus.pending,
          );
        }
        
        // Check if status actually changed
        if (newStatus != null && newStatus != oldStatus) {
          debugPrint('🔔 KYC Status changed: $oldStatus → $newStatus');
          
          // Update local seller model from snapshot
          _currentSeller = SellerModel.fromMap(data, sellerId);
          
          // Save updated session
          _saveSellerSession(_currentSeller!);
          
          // Notify listeners to trigger UI updates
          _safeNotifyListeners();
          
          debugPrint('✅ Seller data updated from real-time listener');
        }
      } catch (e) {
        debugPrint('⚠️ Error processing seller doc update: $e');
      }
    }, onError: (e) {
      debugPrint('❌ Seller doc listener error: $e');
    });
  }

  void stopSellerDocListener() {
    _sellerDocSubscription?.cancel();
    _sellerDocSubscription = null;
    debugPrint('🛑 Stopped seller document listener');
  }
}