// ============================================================
// RAZORPAY CUSTOM CHECKOUT SERVICE
// Full custom UI integration using Razorpay's Custom Checkout SDK
// Supports: UPI ID, UPI Intent (installed apps), Cards
// ============================================================

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

/// 🎯 Custom Razorpay Checkout Service
/// Provides methods for custom payment UI integration
class CustomCheckoutService {
  static final CustomCheckoutService _instance = CustomCheckoutService._internal();
  factory CustomCheckoutService() => _instance;
  CustomCheckoutService._internal();

  final FirebaseFunctions _functions = FirebaseFunctions.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  Razorpay? _razorpay;
  bool _isInitialized = false;

  // Current order state
  String? _currentOrderId;
  double? _currentAmount;
  String? _razorpayKeyId;

  // Callbacks
  void Function(PaymentResult)? _onPaymentComplete;
  void Function(String)? _onError;

  // ========================================
  // INITIALIZATION
  // ========================================

  /// Initialize the Razorpay SDK
  void initialize({
    void Function(PaymentResult)? onPaymentComplete,
    void Function(String)? onError,
  }) {
    if (_isInitialized) return;

    _razorpay = Razorpay();
    _onPaymentComplete = onPaymentComplete;
    _onError = onError;

    _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handleSuccess);
    _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _handleError);
    _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleWallet);

    _isInitialized = true;
    debugPrint('💳 CustomCheckoutService initialized');
  }

  /// Dispose resources
  void dispose() {
    _razorpay?.clear();
    _isInitialized = false;
    _currentOrderId = null;
    _currentAmount = null;
    debugPrint('💳 CustomCheckoutService disposed');
  }

  /// Force refresh the Firebase auth token before making function calls
  Future<void> _ensureFreshToken() async {
    final user = _auth.currentUser;
    if (user != null) {
      try {
        // Force refresh the ID token
        await user.getIdToken(true);
        debugPrint('🔑 Auth token refreshed');
      } catch (e) {
        debugPrint('⚠️ Token refresh failed: $e');
      }
    }
  }

  // ========================================
  // ORDER MANAGEMENT
  // ========================================

  /// Create a new Razorpay order
  /// Returns order_id and key_id for payment processing
  Future<OrderCreationResult> createOrder({
    required double amount,
    String? receipt,
    Map<String, String>? notes,
  }) async {
    try {
      debugPrint('💳 Creating Razorpay order: ₹$amount');

      // Ensure fresh auth token
      await _ensureFreshToken();

      final callable = _functions.httpsCallable(
        'createRazorpayOrder',
        options: HttpsCallableOptions(
          timeout: const Duration(seconds: 30),
        ),
      );
      
      final result = await callable.call({
        'amount': (amount * 100).toInt(), // Convert to paise
        'receipt': receipt,
        'notes': notes,
      });

      final data = result.data as Map<String, dynamic>;

      if (data['success'] == true) {
        _currentOrderId = data['orderId'] as String;
        _currentAmount = amount;
        _razorpayKeyId = data['keyId'] as String;

        debugPrint('✅ Order created: $_currentOrderId');

        return OrderCreationResult(
          success: true,
          orderId: _currentOrderId!,
          amount: data['amount'] as int,
          keyId: _razorpayKeyId!,
        );
      } else {
        throw Exception('Order creation failed');
      }
    } catch (e) {
      debugPrint('❌ Order creation error: $e');
      return OrderCreationResult(
        success: false,
        error: e.toString(),
      );
    }
  }


  // ========================================
  // UPI PAYMENT METHODS
  // ========================================

  /// Validate a UPI VPA (Virtual Payment Address)
  Future<VpaValidationResult> validateUpiId(String vpa) async {
    try {
      debugPrint('🔍 Validating UPI ID: $vpa');

      final callable = _functions.httpsCallable('validateVPA');
      final result = await callable.call({'vpa': vpa});

      final data = result.data as Map<String, dynamic>;

      return VpaValidationResult(
        valid: data['valid'] == true,
        customerName: data['customerName'] as String?,
        vpa: vpa,
        error: data['error'] as String?,
      );
    } catch (e) {
      debugPrint('❌ VPA validation error: $e');
      return VpaValidationResult(
        valid: false,
        vpa: vpa,
        error: e.toString(),
      );
    }
  }

  /// Get list of installed UPI apps on the device
  Future<List<UpiApp>> getInstalledUpiApps() async {
    if (!Platform.isAndroid && !Platform.isIOS) {
      return [];
    }

    // Common UPI app package names (Android) and URL schemes (iOS)
    final upiApps = <UpiApp>[];

    if (Platform.isAndroid) {
      // These are the most popular UPI apps in India
      final apps = [
        UpiApp(
          name: 'Google Pay',
          packageName: 'com.google.android.apps.nbu.paisa.user',
          iconAsset: 'assets/upi/gpay.png',
        ),
        UpiApp(
          name: 'PhonePe',
          packageName: 'com.phonepe.app',
          iconAsset: 'assets/upi/phonepe.png',
        ),
        UpiApp(
          name: 'Paytm',
          packageName: 'net.one97.paytm',
          iconAsset: 'assets/upi/paytm.png',
        ),
        UpiApp(
          name: 'Amazon Pay',
          packageName: 'in.amazon.mShop.android.shopping',
          iconAsset: 'assets/upi/amazonpay.png',
        ),
        UpiApp(
          name: 'BHIM',
          packageName: 'in.org.npci.upiapp',
          iconAsset: 'assets/upi/bhim.png',
        ),
        UpiApp(
          name: 'WhatsApp',
          packageName: 'com.whatsapp',
          iconAsset: 'assets/upi/whatsapp.png',
        ),
        UpiApp(
          name: 'CRED',
          packageName: 'com.dreamplug.androidapp',
          iconAsset: 'assets/upi/cred.png',
        ),
      ];

      // Check which apps are installed using MethodChannel
      const platform = MethodChannel('com.letbuyy/upi_apps');

      for (final app in apps) {
        try {
          final isInstalled = await platform.invokeMethod<bool>(
            'isAppInstalled',
            {'packageName': app.packageName},
          );
          if (isInstalled == true) {
            upiApps.add(app);
          }
        } catch (e) {
          // If method channel fails, add all common apps
          // The Razorpay SDK will handle non-installed gracefully
          debugPrint('⚠️ Could not check app: ${app.name}');
        }
      }

      // If we couldn't detect, return common apps
      if (upiApps.isEmpty) {
        // Return top 4 most common apps
        upiApps.addAll(apps.take(4));
      }
    }

    return upiApps;
  }

  /// Pay using UPI ID (collect flow)
  Future<void> payWithUpiId({
    required String vpa,
    required String userName,
    required String userEmail,
    required String userPhone,
  }) async {
    if (_currentOrderId == null || _razorpayKeyId == null) {
      _onError?.call('Order not created. Please try again.');
      return;
    }

    try {
      HapticFeedback.mediumImpact();
      
      final options = {
        'key': _razorpayKeyId,
        'amount': (_currentAmount! * 100).toInt(),
        'order_id': _currentOrderId,
        'name': 'LetBuyy',
        'description': 'Order Payment',
        'prefill': {
          'contact': userPhone,
          'email': userEmail,
          'name': userName,
          'vpa': vpa,
        },
        'method': 'upi',
      };

      debugPrint('💳 Opening UPI payment with VPA: $vpa');
      _razorpay?.open(options);
    } catch (e) {
      debugPrint('❌ UPI payment error: $e');
      _onError?.call(e.toString());
    }
  }

  /// Pay using UPI Intent (opens installed app)
  Future<void> payWithUpiApp({
    required UpiApp app,
    required String userName,
    required String userEmail,
    required String userPhone,
  }) async {
    if (_currentOrderId == null || _razorpayKeyId == null) {
      _onError?.call('Order not created. Please try again.');
      return;
    }

    try {
      HapticFeedback.mediumImpact();

      final options = {
        'key': _razorpayKeyId,
        'amount': (_currentAmount! * 100).toInt(),
        'order_id': _currentOrderId,
        'name': 'LetBuyy',
        'description': 'Order Payment',
        'prefill': {
          'contact': userPhone,
          'email': userEmail,
          'name': userName,
        },
        'method': 'upi',
        'upi': {
          'flow': 'intent',
        },
        'external': {
          'wallets': [app.packageName],
        },
      };

      debugPrint('💳 Opening UPI app: ${app.name}');
      _razorpay?.open(options);
    } catch (e) {
      debugPrint('❌ UPI app payment error: $e');
      _onError?.call(e.toString());
    }
  }

  // ========================================
  // CARD PAYMENT METHODS
  // ========================================

  /// Pay with card details
  Future<void> payWithCard({
    required String cardNumber,
    required String expiryMonth,
    required String expiryYear,
    required String cvv,
    required String cardholderName,
    required String userName,
    required String userEmail,
    required String userPhone,
    bool saveCard = false,
  }) async {
    if (_currentOrderId == null || _razorpayKeyId == null) {
      _onError?.call('Order not created. Please try again.');
      return;
    }

    try {
      HapticFeedback.mediumImpact();

      final options = {
        'key': _razorpayKeyId,
        'amount': (_currentAmount! * 100).toInt(),
        'order_id': _currentOrderId,
        'name': 'LetBuyy',
        'description': 'Order Payment',
        'prefill': {
          'contact': userPhone,
          'email': userEmail,
          'name': userName,
        },
        'method': 'card',
        'card': {
          'number': cardNumber.replaceAll(' ', ''),
          'expiry_month': expiryMonth,
          'expiry_year': expiryYear,
          'cvv': cvv,
          'name': cardholderName,
        },
        'save': saveCard ? 1 : 0,
      };

      debugPrint('💳 Processing card payment');
      _razorpay?.open(options);
    } catch (e) {
      debugPrint('❌ Card payment error: $e');
      _onError?.call(e.toString());
    }
  }

  // ========================================
  // PAYMENT VERIFICATION
  // ========================================

  /// Verify payment signature after successful payment
  Future<PaymentVerificationResult> verifyPayment({
    required String razorpayPaymentId,
    required String razorpayOrderId,
    required String razorpaySignature,
  }) async {
    try {
      debugPrint('🔐 Verifying payment: $razorpayPaymentId');

      final callable = _functions.httpsCallable('verifyPaymentSignature');
      final result = await callable.call({
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      });

      final data = result.data as Map<String, dynamic>;

      return PaymentVerificationResult(
        verified: data['verified'] == true,
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        method: data['method'] as String?,
        error: data['error'] as String?,
      );
    } catch (e) {
      debugPrint('❌ Verification error: $e');
      return PaymentVerificationResult(
        verified: false,
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        error: e.toString(),
      );
    }
  }

  // ========================================
  // SAVED CARDS
  // ========================================

  /// Get user's saved cards
  Future<List<SavedCard>> getSavedCards() async {
    try {
      final callable = _functions.httpsCallable('getSavedCards');
      final result = await callable.call();

      final data = result.data as Map<String, dynamic>;
      final cards = (data['cards'] as List?) ?? [];

      return cards.map((c) => SavedCard(
        id: c['id'] as String,
        last4: c['last4'] as String,
        network: c['network'] as String,
        cardType: c['cardType'] as String?,
        cardholderName: c['cardholderName'] as String?,
      )).toList();
    } catch (e) {
      debugPrint('❌ Get saved cards error: $e');
      return [];
    }
  }

  /// Delete a saved card
  Future<bool> deleteSavedCard(String cardId) async {
    try {
      final callable = _functions.httpsCallable('deleteSavedCard');
      await callable.call({'cardId': cardId});
      return true;
    } catch (e) {
      debugPrint('❌ Delete card error: $e');
      return false;
    }
  }

  // ========================================
  // INTERNAL HANDLERS
  // ========================================

  void _handleSuccess(PaymentSuccessResponse response) {
    debugPrint('✅ Payment success: ${response.paymentId}');
    HapticFeedback.heavyImpact();

    _onPaymentComplete?.call(PaymentResult(
      success: true,
      paymentId: response.paymentId,
      orderId: response.orderId,
      signature: response.signature,
    ));

    _clearOrderState();
  }

  void _handleError(PaymentFailureResponse response) {
    debugPrint('❌ Payment failed: ${response.message}');
    HapticFeedback.heavyImpact();

    _onError?.call(response.message ?? 'Payment failed');
    _clearOrderState();
  }

  void _handleWallet(ExternalWalletResponse response) {
    debugPrint('💳 External wallet: ${response.walletName}');
  }

  void _clearOrderState() {
    _currentOrderId = null;
    _currentAmount = null;
  }
}

// ========================================
// DATA MODELS
// ========================================

/// Result of order creation
class OrderCreationResult {
  final bool success;
  final String? orderId;
  final int? amount;
  final String? keyId;
  final String? error;

  OrderCreationResult({
    required this.success,
    this.orderId,
    this.amount,
    this.keyId,
    this.error,
  });
}

/// Result of VPA validation
class VpaValidationResult {
  final bool valid;
  final String? customerName;
  final String vpa;
  final String? error;

  VpaValidationResult({
    required this.valid,
    this.customerName,
    required this.vpa,
    this.error,
  });
}

/// UPI App info
class UpiApp {
  final String name;
  final String packageName;
  final String? iconAsset;

  UpiApp({
    required this.name,
    required this.packageName,
    this.iconAsset,
  });
}

/// Payment result
class PaymentResult {
  final bool success;
  final String? paymentId;
  final String? orderId;
  final String? signature;
  final String? error;

  PaymentResult({
    required this.success,
    this.paymentId,
    this.orderId,
    this.signature,
    this.error,
  });
}

/// Payment verification result
class PaymentVerificationResult {
  final bool verified;
  final String paymentId;
  final String orderId;
  final String? method;
  final String? error;

  PaymentVerificationResult({
    required this.verified,
    required this.paymentId,
    required this.orderId,
    this.method,
    this.error,
  });
}

/// Saved card info
class SavedCard {
  final String id;
  final String last4;
  final String network;
  final String? cardType;
  final String? cardholderName;

  SavedCard({
    required this.id,
    required this.last4,
    required this.network,
    this.cardType,
    this.cardholderName,
  });

  /// Get card icon based on network
  IconData get icon {
    switch (network.toLowerCase()) {
      case 'visa':
        return Icons.credit_card;
      case 'mastercard':
        return Icons.credit_card;
      case 'rupay':
        return Icons.credit_card;
      case 'amex':
        return Icons.credit_card;
      default:
        return Icons.credit_card;
    }
  }
}
