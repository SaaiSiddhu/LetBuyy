import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

/// Service for managing store subscriptions via the API.
///
/// Replaces Firebase Functions + Firestore with REST calls to the Hono backend.
class SubscriptionService {
  final ApiClient _api;

  SubscriptionService({required ApiClient api}) : _api = api;

  // ============================================================
  // CREATE SUBSCRIPTION
  // ============================================================

  /// Create a new subscription for a store
  Future<Map<String, dynamic>> createSubscription({
    required String storeId,
    required SubscriptionPlan plan,
  }) async {
    try {
      final res = await _api.post('stores/$storeId/subscription', body: {
        'plan': plan.name,
      });
      return Map<String, dynamic>.from(res['data'] ?? res);
    } catch (e) {
      debugPrint('Error creating subscription: $e');
      rethrow;
    }
  }

  // ============================================================
  // UPGRADE SUBSCRIPTION
  // ============================================================

  /// Upgrade or downgrade subscription plan
  Future<Map<String, dynamic>> upgradeSubscription({
    required String storeId,
    required SubscriptionPlan newPlan,
    String? paymentId,
  }) async {
    try {
      final res = await _api.patch('stores/$storeId/subscription', body: {
        'plan': newPlan.name,
        if (paymentId != null) 'payment_id': paymentId,
      });
      return Map<String, dynamic>.from(res['data'] ?? res);
    } catch (e) {
      debugPrint('Error upgrading subscription: $e');
      rethrow;
    }
  }

  // ============================================================
  // GET CURRENT SUBSCRIPTION
  // ============================================================

  /// Get current subscription for a store
  Future<SubscriptionModel?> getSubscription(String storeId) async {
    try {
      final res = await _api.get('stores/$storeId/subscription');
      final data = res['data'];
      if (data == null) return null;
      return SubscriptionModel.fromMap(
        data as Map<String, dynamic>,
        data['id'] ?? '',
      );
    } catch (e) {
      debugPrint('Error getting subscription: $e');
      return null;
    }
  }

  // ============================================================
  // CONNECT OWN RAZORPAY
  // ============================================================

  /// Connect seller's own Razorpay account (Professional plan only)
  Future<Map<String, dynamic>> connectOwnRazorpay({
    required String storeId,
    required String keyId,
    required String keySecret,
    bool testMode = false,
  }) async {
    try {
      final res = await _api.post('stores/$storeId/payment-config', body: {
        'key_id': keyId,
        'key_secret': keySecret,
        'test_mode': testMode,
      });
      return Map<String, dynamic>.from(res['data'] ?? res);
    } catch (e) {
      debugPrint('Error connecting Razorpay: $e');
      rethrow;
    }
  }

  // ============================================================
  // GET PAYMENT CONFIG
  // ============================================================

  /// Get payment configuration for order creation
  Future<Map<String, dynamic>> getPaymentConfig(String storeId) async {
    try {
      final res = await _api.get('stores/$storeId/payment-config');
      return Map<String, dynamic>.from(res['data'] ?? res);
    } catch (e) {
      debugPrint('Error getting payment config: $e');
      rethrow;
    }
  }

  // ============================================================
  // GET PAYMENT CONFIG MODEL
  // ============================================================

  /// Get payment config document
  Future<PaymentConfigModel?> getPaymentConfigModel(String storeId) async {
    try {
      final res = await _api.get('stores/$storeId/payment-config');
      final data = res['data'];
      if (data == null) {
        return PaymentConfigModel.defaultShared(storeId);
      }
      return PaymentConfigModel.fromMap(data as Map<String, dynamic>, storeId);
    } catch (e) {
      debugPrint('Error getting payment config model: $e');
      return null;
    }
  }

  // ============================================================
  // HELPER: Plan Display Info
  // ============================================================

  static Map<String, dynamic> getPlanInfo(SubscriptionPlan plan) {
    switch (plan) {
      case SubscriptionPlan.trial:
        return {
          'name': 'Free Trial',
          'price': 0,
          'priceLabel': 'Free',
          'period': '30 days',
          'productLimit': 50,
          'commission': 3.0,
          'badge': '🎁',
          'color': 0xFF6366F1,
          'features': [
            '50 products',
            '3% commission',
            'Basic analytics',
            'Subdomain included',
          ],
        };
      case SubscriptionPlan.starter:
        return {
          'name': 'Starter',
          'price': 99,
          'priceLabel': '₹99',
          'period': '/month',
          'productLimit': 5,
          'commission': 5.0,
          'badge': '🚀',
          'color': 0xFF10B981,
          'features': [
            '5 products',
            '5% commission',
            'Subdomain included',
            'Email support',
          ],
        };
      case SubscriptionPlan.business:
        return {
          'name': 'Business',
          'price': 399,
          'priceLabel': '₹399',
          'period': '/month',
          'productLimit': 30,
          'commission': 3.0,
          'badge': '⭐',
          'color': 0xFF8B5CF6,
          'isPopular': true,
          'features': [
            '30 products',
            '3% commission',
            'Custom domain',
            'Advanced analytics',
            'Bulk upload',
            'Coupons & inventory',
            'Remove badge',
          ],
        };
      case SubscriptionPlan.professional:
        return {
          'name': 'Professional',
          'price': 799,
          'priceLabel': '₹799',
          'period': '/month',
          'productLimit': -1,
          'commission': 0.0,
          'badge': '👑',
          'color': 0xFFF59E0B,
          'features': [
            'Unlimited products',
            '0% commission',
            'Own Razorpay account',
            'Team access',
            'API access',
            'Priority support',
            'All Business features',
          ],
        };
    }
  }

  /// Get all plans info for comparison
  static List<Map<String, dynamic>> getAllPlansInfo() {
    return SubscriptionPlan.values.map((p) => {
      ...getPlanInfo(p),
      'plan': p,
    }).toList();
  }
}
