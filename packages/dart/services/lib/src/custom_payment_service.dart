import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

void _assertBackendOrder({
  required String keyId,
  required String orderId,
  required double amount,
}) {
  if (keyId.isEmpty || orderId.isEmpty || amount <= 0) {
    throw PaymentException(
      'Backend-created payment order data is required before opening checkout',
      code: 'PAYMENT_ORDER_REQUIRED',
    );
  }
}

class RazorpayCustomService {
  late Razorpay _razorpay;
  Function(String paymentId, String orderId, String signature)? onSuccess;
  Function(String error)? onFailure;

  void initialize({
    required Function(String paymentId, String orderId, String signature) onSuccess,
    required Function(String error) onFailure,
  }) {
    _razorpay = Razorpay();
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    debugPrint('✅ Payment Success: ${response.paymentId}');
    onSuccess?.call(
      response.paymentId ?? '',
      response.orderId ?? '',
      response.signature ?? '',
    );
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    debugPrint('❌ Payment Error: ${response.code} - ${response.message}');
    onFailure?.call(response.message ?? 'Payment failed');
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    debugPrint('💼 External Wallet: ${response.walletName}');
  }

  // Open Razorpay with UPI preselected
  void openUpiPayment({
    required String keyId,
    required String orderId,
    required double amount,
    required String userName,
    required String userEmail,
    required String userPhone,
    String? preferredUpiApp,
  }) {
    _assertBackendOrder(keyId: keyId, orderId: orderId, amount: amount);

    var options = {
      'key': keyId,
      'amount': (amount * 100).toInt(), // Amount in paise
      'order_id': orderId,
      'name': RazorpayConfig.appName,
      'description': 'Order Payment',
      'prefill': {
        'contact': userPhone,
        'email': userEmail,
      },
      'method': {
        'upi': true,
        'card': false,
        'netbanking': false,
        'wallet': false,
      },
      'theme': {'color': '#4CAF50'},
    };

    if (preferredUpiApp != null) {
      options['_'] = <String, String>{
        'flow': 'intent',
        'package': preferredUpiApp,
      };
    }

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Error: $e');
      onFailure?.call('Failed to open payment gateway');
    }
  }

  // Open Razorpay with Card preselected
  void openCardPayment({
    required String keyId,
    required String orderId,
    required double amount,
    required String userName,
    required String userEmail,
    required String userPhone,
  }) {
    _assertBackendOrder(keyId: keyId, orderId: orderId, amount: amount);

    var options = {
      'key': keyId,
      'amount': (amount * 100).toInt(),
      'order_id': orderId,
      'name': RazorpayConfig.appName,
      'description': 'Order Payment',
      'prefill': {
        'contact': userPhone,
        'email': userEmail,
      },
      'method': {
        'card': true,
        'upi': false,
        'netbanking': false,
        'wallet': false,
      },
      'theme': {'color': '#4CAF50'},
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Error: $e');
      onFailure?.call('Failed to open payment gateway');
    }
  }

  // Open Razorpay with all payment methods
  void openAllPaymentMethods({
    required String keyId,
    required String orderId,
    required double amount,
    required String userName,
    required String userEmail,
    required String userPhone,
  }) {
    _assertBackendOrder(keyId: keyId, orderId: orderId, amount: amount);

    var options = {
      'key': keyId,
      'amount': (amount * 100).toInt(),
      'order_id': orderId,
      'name': RazorpayConfig.appName,
      'description': 'Order Payment',
      'prefill': {
        'contact': userPhone,
        'email': userEmail,
      },
      'theme': {'color': '#4CAF50'},
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('Error: $e');
      onFailure?.call('Failed to open payment gateway');
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
