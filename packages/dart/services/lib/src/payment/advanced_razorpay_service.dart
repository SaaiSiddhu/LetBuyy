// lib/services/payment/advanced_razorpay_service.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:letbuyy_core/letbuyy_core.dart';

const Color _letbuyyCheckoutPrimary = Color(0xFF00B3B3);

class _RazorpayServerOrder {
  final String orderId;
  final int amount;
  final String currency;
  final String keyId;

  const _RazorpayServerOrder({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });
}

class AdvancedRazorpayService {
  final Color themeColor;
  final String? logoAsset;
  final String? authToken;
  final String orderEndpoint;
  final String verifyEndpoint;

  late Razorpay _razorpay;
  bool _isInitialized = false;
  String? _currentAppOrderId;
  String? _currentOrderId;
  _RazorpayServerOrder? _currentServerOrder;

  // Callbacks passed from the constructor (optional)
  final void Function(PaymentSuccessResponse)? onSuccess;
  final void Function(PaymentFailureResponse)? onFailure;
  final void Function(ExternalWalletResponse)? onWalletSelected;

  AdvancedRazorpayService({
    this.themeColor = _letbuyyCheckoutPrimary,
    this.logoAsset,
    this.authToken,
    this.orderEndpoint = ApiConstants.razorpayOrderEndpoint,
    this.verifyEndpoint = ApiConstants.razorpayVerifyEndpoint,
    this.onSuccess,
    this.onFailure,
    this.onWalletSelected,
  });

  /// 🔹 Initializes Razorpay and attaches listeners
  void initialize({
    // Callbacks passed from the screen (preferred)
    void Function(PaymentSuccessResponse)? onSuccess,
    void Function(PaymentFailureResponse)? onFailure,
    void Function(ExternalWalletResponse)? onWalletSelected,
  }) {
    if (_isInitialized) return;

    try {
      RazorpayConfig.logConfiguration();
      _razorpay = Razorpay();

      // Attach the internal handlers
      _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (
        PaymentSuccessResponse response,
      ) {
        // ✅ FIXED: Pass the correct callback parameter
        _handlePaymentSuccess(response, onSuccess ?? this.onSuccess);
      });

      _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (
        PaymentFailureResponse response,
      ) {
        // ✅ FIXED: Pass the correct callback parameter
        _handlePaymentError(response, onFailure ?? this.onFailure);
      });

      _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (
        ExternalWalletResponse response,
      ) {
        debugPrint("💳 Wallet: ${response.walletName}");
        (this.onWalletSelected ?? onWalletSelected)?.call(response);
      });

      _isInitialized = true;
      debugPrint("🟢 Razorpay Initialized (${RazorpayConfig.paymentMode})");
    } catch (e) {
      debugPrint("❌ Initialization Error: $e");
    }
  }

  Map<String, String> get _headers {
    return {
      'Content-Type': 'application/json',
      if (authToken != null && authToken!.isNotEmpty)
        'Authorization': 'Bearer $authToken',
    };
  }

  /// Creates a Razorpay order through the LetBuyy backend.
  ///
  /// Provider secrets must never be shipped in Flutter. The backend endpoint is
  /// responsible for loading the stored order, recalculating payable totals, and
  /// creating the Razorpay order with the secret key.
  Future<String?> createOrder({
    required double amount,
    required String currency,
    String? receipt,
    Map<String, dynamic>? notes,
  }) async {
    try {
      final appOrderId =
          notes?['order_id']?.toString() ??
          notes?['orderId']?.toString() ??
          receipt;

      if (appOrderId == null || appOrderId.isEmpty) {
        onFailure?.call(
          PaymentFailureResponse(
            400,
            'A backend order_id is required before creating a Razorpay order',
            {},
          ),
        );
        return null;
      }

      final response = await http.post(
        Uri.parse(orderEndpoint),
        headers: _headers,
        body: jsonEncode({
          'order_id': appOrderId,
          'orderId': appOrderId,
          'idempotency_key': notes?['idempotency_key'],
        }),
      );

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final data = (payload['data'] as Map<String, dynamic>?) ?? payload;
      final providerOrderId =
          data['razorpay_order_id']?.toString() ??
          data['razorpayOrderId']?.toString();

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          providerOrderId != null &&
          providerOrderId.isNotEmpty) {
        final providerKeyId =
            data['key_id']?.toString() ?? data['keyId']?.toString();
        final providerAmount = (data['amount'] as num?)?.toInt();
        final providerCurrency = data['currency']?.toString();

        if (providerKeyId == null ||
            providerKeyId.isEmpty ||
            providerAmount == null ||
            providerAmount <= 0 ||
            providerCurrency == null ||
            providerCurrency.isEmpty) {
          onFailure?.call(
            PaymentFailureResponse(
              502,
              'Payment order response is missing provider checkout fields',
              {},
            ),
          );
          return null;
        }

        _currentAppOrderId = appOrderId;
        _currentOrderId = providerOrderId;
        _currentServerOrder = _RazorpayServerOrder(
          orderId: providerOrderId,
          amount: providerAmount,
          currency: providerCurrency,
          keyId: providerKeyId,
        );
        debugPrint("✅ Order Created by backend: $_currentOrderId");
        return _currentOrderId;
      }

      final error = payload['error'];
      final message = error is Map<String, dynamic>
          ? error['message']?.toString() ?? error['description']?.toString()
          : error?.toString();
      debugPrint("❌ Order Failed: ${message ?? response.body}");
      onFailure?.call(
        PaymentFailureResponse(
          response.statusCode,
          message ?? 'Failed to create Razorpay order',
          {},
        ),
      );
      return null;
    } catch (e) {
      debugPrint("❌ Order Exception: $e");
      onFailure?.call(PaymentFailureResponse(500, e.toString(), {}));
      return null;
    }
  }

  /// Opens the advanced, unified Razorpay checkout.
  Future<void> openAdvancedCheckout({
    required double amount,
    required String userName,
    required String userEmail,
    required String userPhone,
    String? paymentMethod, // Nullable to show all options
    String? orderId,
    String? description,
    Map<String, String>? customNotes,
  }) async {
    if (!_isInitialized) {
      debugPrint("⚠️ Razorpay not initialized");
      onFailure?.call(
        PaymentFailureResponse(0, 'Payment service not initialized', {}),
      );
      return;
    }

    // 1. Create Order
    final createdOrderId = await createOrder(
      amount: amount,
      currency: RazorpayConfig.currency,
      receipt: 'order_${DateTime.now().millisecondsSinceEpoch}',
      notes: customNotes?.map((k, v) => MapEntry(k, v)),
    );

    if (createdOrderId == null) {
      onFailure?.call(
        PaymentFailureResponse(1, 'Failed to create Razorpay order', {}),
      );
      return;
    }

    // 2. Open Checkout
    try {
      final serverOrder = _currentServerOrder;
      if (serverOrder == null || serverOrder.keyId.isEmpty) {
        onFailure?.call(
          PaymentFailureResponse(
            2,
            'Payment order was not initialized by the backend',
            {},
          ),
        );
        return;
      }

      var options = {
        'key': serverOrder.keyId,
        'amount': serverOrder.amount,
        'order_id': createdOrderId,
        'name': RazorpayConfig.appName,
        'description': description ?? 'Secure Payment',
        'currency': serverOrder.currency,
        'timeout': RazorpayConfig.paymentTimeoutSeconds,
        'prefill': {'contact': userPhone, 'email': userEmail, 'name': userName},
        'retry': {'enabled': true, 'max_count': RazorpayConfig.maxRetries},
        'theme': {'color': RazorpayConfig.themeColor},
        'modal': {
          'backdropclose': false,
          'escape': false,
          'confirm_close': true,
        },
        'notes': customNotes ?? {},
        'send_sms_hash': true,
      };

      // Conditionally add the payment method to pre-select it
      if (paymentMethod != null) {
        options['method'] = paymentMethod;
      }

      debugPrint(
        "🎯 Opening Checkout | ₹$amount | ${RazorpayConfig.paymentMode}",
      );
      _razorpay.open(options);
    } catch (e) {
      debugPrint("❌ Checkout Error: $e");
      onFailure?.call(PaymentFailureResponse(2, 'Checkout failed: $e', {}));
    }
  }

  Future<bool> verifyPaymentOnBackend({
    required String appOrderId,
    required String razorpayOrderId,
    required String paymentId,
    required String signature,
  }) async {
    try {
      if (appOrderId.isEmpty ||
          razorpayOrderId.isEmpty ||
          paymentId.isEmpty ||
          signature.isEmpty) {
        debugPrint("❌ Missing payment verification fields");
        return false;
      }

      final response = await http.post(
        Uri.parse(verifyEndpoint),
        headers: _headers,
        body: jsonEncode({
          'order_id': appOrderId,
          'orderId': appOrderId,
          'razorpay_order_id': razorpayOrderId,
          'razorpay_payment_id': paymentId,
          'razorpay_signature': signature,
        }),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        debugPrint("❌ Backend signature verification failed: ${response.body}");
        return false;
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      if (payload.containsKey('success')) return payload['success'] == true;
      final data = payload['data'];
      return data is Map<String, dynamic> && data['verified'] == true;
    } catch (e) {
      debugPrint("❌ Backend verification error: $e");
      return false;
    }
  }

  // --- Internal Handlers ---

  Future<void> _handlePaymentSuccess(
    PaymentSuccessResponse response,
    void Function(PaymentSuccessResponse)? onSuccess, // ✅ FIXED: Parameter name
  ) async {
    HapticFeedback.mediumImpact();

    final isValid = await verifyPaymentOnBackend(
      appOrderId: _currentAppOrderId ?? '',
      razorpayOrderId: response.orderId ?? _currentOrderId ?? '',
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
    );

    if (isValid) {
      debugPrint("✅ PAYMENT SUCCESS | ${response.paymentId}");
      onSuccess?.call(response);
    } else {
      debugPrint("⚠️ Invalid signature");
      onFailure?.call(
        PaymentFailureResponse(999, 'Signature verification failed', {}),
      );
    }
  }

  void _handlePaymentError(
    PaymentFailureResponse response,
    void Function(PaymentFailureResponse)? onFailure, // ✅ FIXED: Parameter name
  ) {
    HapticFeedback.heavyImpact();
    debugPrint("❌ PAYMENT ERROR (${response.code}): ${response.message}");
    onFailure?.call(response);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    debugPrint("💳 Wallet: ${response.walletName}");
    onWalletSelected?.call(response);
  }

  void dispose() {
    if (_isInitialized) {
      _razorpay.clear();
      _isInitialized = false;
      debugPrint("🧹 Razorpay Disposed");
    }
  }
}
