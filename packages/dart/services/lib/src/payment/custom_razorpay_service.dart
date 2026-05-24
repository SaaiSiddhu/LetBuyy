// lib/services/payment/custom_razorpay_service.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:letbuyy_core/letbuyy_core.dart';

/// 🎨 Custom Razorpay Service - NO POPUP, Fully Custom UI
class CustomRazorpayService {
  final String? authToken;
  final String orderEndpoint;
  final String verifyEndpoint;

  CustomRazorpayService({
    this.authToken,
    this.orderEndpoint = ApiConstants.razorpayOrderEndpoint,
    this.verifyEndpoint = ApiConstants.razorpayVerifyEndpoint,
  });

  Map<String, String> get _headers {
    return {
      'Content-Type': 'application/json',
      if (authToken != null && authToken!.isNotEmpty)
        'Authorization': 'Bearer $authToken',
    };
  }
  
  /// Create a Razorpay order through the LetBuyy backend.
  ///
  /// `notes` must include `order_id` or `orderId` for the LetBuyy order.
  /// Razorpay secrets are intentionally not available in Flutter.
  Future<CustomOrderResponse?> createOrder({
    required double amount,
    Map<String, dynamic>? notes,
  }) async {
    try {
      final appOrderId =
          notes?['order_id']?.toString() ?? notes?['orderId']?.toString();

      if (appOrderId == null || appOrderId.isEmpty) {
        debugPrint("❌ Backend order_id is required before creating a payment order");
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
          data['razorpay_order_id']?.toString() ?? data['razorpayOrderId']?.toString();

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          providerOrderId != null &&
          providerOrderId.isNotEmpty) {
        debugPrint("✅ Order Created by backend: $providerOrderId");
        
        return CustomOrderResponse(
          orderId: providerOrderId,
          amount: ((data['amount'] as num?)?.toDouble() ?? amount * 100) / 100,
          currency: data['currency']?.toString() ?? RazorpayConfig.currency,
          receipt: appOrderId,
        );
      } else {
        debugPrint("❌ Order Creation Failed: ${response.body}");
        return null;
      }
    } catch (e) {
      debugPrint("❌ Order Exception: $e");
      return null;
    }
  }

  /// Process UPI Payment
  Future<PaymentResponse> processUpiPayment({
    required String orderId,
    required double amount,
    required String vpa, // UPI ID like user@paytm
    required String customerName,
    required String customerEmail,
    required String customerPhone,
  }) async {
    return PaymentResponse(
      success: false,
      orderId: orderId,
      error: 'Direct UPI payment creation requires a backend payment-intent endpoint. Use Razorpay Checkout or add a server endpoint for UPI intents.',
      method: 'upi',
    );
  }

  /// Get Available UPI Apps
  List<UpiApp> getAvailableUpiApps() {
    return [
      UpiApp(
        name: 'Google Pay',
        packageName: 'com.google.android.apps.nbu.paisa.user',
        icon: '💳',
        color: const Color(0xFF4285F4),
      ),
      UpiApp(
        name: 'PhonePe',
        packageName: 'com.phonepe.app',
        icon: '📱',
        color: const Color(0xFF5F259F),
      ),
      UpiApp(
        name: 'Paytm',
        packageName: 'net.one97.paytm',
        icon: '💰',
        color: const Color(0xFF00BAF2),
      ),
      UpiApp(
        name: 'BHIM',
        packageName: 'in.org.npci.upiapp',
        icon: '🏦',
        color: const Color(0xFF005BAA),
      ),
      UpiApp(
        name: 'Amazon Pay',
        packageName: 'in.amazon.mShop.android.shopping',
        icon: '🛒',
        color: const Color(0xFFFF9900),
      ),
    ];
  }

  Future<bool> verifySignature({
    required String orderId,
    required String paymentId,
    required String signature,
    required String appOrderId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(verifyEndpoint),
        headers: _headers,
        body: jsonEncode({
          'order_id': appOrderId,
          'orderId': appOrderId,
          'razorpay_order_id': orderId,
          'razorpay_payment_id': paymentId,
          'razorpay_signature': signature,
        }),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return false;
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      if (payload.containsKey('success')) return payload['success'] == true;
      final data = payload['data'];
      return data is Map<String, dynamic> && data['verified'] == true;
    } catch (_) {
      return false;
    }
  }
}

/// Custom Order Response Model
class CustomOrderResponse {
  final String orderId;
  final double amount;
  final String currency;
  final String receipt;

  CustomOrderResponse({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.receipt,
  });
}

/// Payment Response Model
class PaymentResponse {
  final bool success;
  final String? paymentId;
  final String? orderId;
  final String? signature;
  final String? error;
  final String method;

  PaymentResponse({
    required this.success,
    this.paymentId,
    this.orderId,
    this.signature,
    this.error,
    required this.method,
  });
}

/// UPI App Model
class UpiApp {
  final String name;
  final String packageName;
  final String icon;
  final Color color;

  UpiApp({
    required this.name,
    required this.packageName,
    required this.icon,
    required this.color,
  });
}
