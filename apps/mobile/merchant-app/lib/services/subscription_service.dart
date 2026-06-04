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
      return await _api.requestJson(
        'payments/subscription/order',
        options: ApiRequestOptions(
          method: HttpMethod.post,
          body: {
            'store_id': storeId,
            'site_type': 'store',
            'plan_slug': _planSlug(plan),
            'billing_period': 'monthly',
          },
        ),
      );
    } catch (e) {
      debugPrint('Error creating subscription: $e');
      rethrow;
    }
  }

  /// Start a subscription checkout order using the gateway billing contract.
  Future<Map<String, dynamic>> createSubscriptionOrder({
    required String storeId,
    required SubscriptionPlan plan,
    String billingPeriod = 'monthly',
  }) async {
    try {
      return await _api.requestJson(
        'payments/subscription/order',
        options: ApiRequestOptions(
          method: HttpMethod.post,
          body: {
            'store_id': storeId,
            'site_type': 'store',
            'plan_slug': _planSlug(plan),
            'billing_period': billingPeriod,
          },
        ),
      );
    } catch (e) {
      debugPrint('Error creating subscription order: $e');
      rethrow;
    }
  }

  /// Verify a Razorpay subscription payment and activate the plan.
  Future<Map<String, dynamic>> verifySubscriptionPayment({
    required String storeId,
    required SubscriptionPlan plan,
    required String razorpayPaymentId,
    required String razorpaySignature,
    String? razorpayOrderId,
    String? razorpaySubscriptionId,
    String billingPeriod = 'monthly',
  }) async {
    try {
      return await _api.requestJson(
        'payments/subscription/verify',
        options: ApiRequestOptions(
          method: HttpMethod.post,
          body: {
            'store_id': storeId,
            'site_type': 'store',
            'plan_slug': _planSlug(plan),
            'billing_period': billingPeriod,
            'razorpay_payment_id': razorpayPaymentId,
            'razorpay_signature': razorpaySignature,
            if (razorpayOrderId != null) 'razorpay_order_id': razorpayOrderId,
            if (razorpaySubscriptionId != null)
              'razorpay_subscription_id': razorpaySubscriptionId,
          },
        ),
      );
    } catch (e) {
      debugPrint('Error verifying subscription payment: $e');
      rethrow;
    }
  }

  /// Cancel the active store subscription through the gateway.
  Future<Map<String, dynamic>> cancelSubscription({
    required String storeId,
    String? reason,
  }) async {
    try {
      return await _api.requestJson(
        'payments/subscription/cancel',
        options: ApiRequestOptions(
          method: HttpMethod.post,
          body: {'store_id': storeId, if (reason != null) 'reason': reason},
        ),
      );
    } catch (e) {
      debugPrint('Error cancelling subscription: $e');
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
      if (paymentId != null) {
        throw UnsupportedError(
          'Subscription payment verification requires Razorpay signature payload.',
        );
      }
      return createSubscriptionOrder(storeId: storeId, plan: newPlan);
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
      final data = await _api.requestJson(
        'payments/subscription',
        options: ApiRequestOptions(query: {'store_id': storeId}),
      );
      return _subscriptionModelFromGateway(storeId, data);
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
      final res = await _api.stores.paymentConfig.save(storeId, {
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
      return await _api.stores.paymentConfig.get(storeId);
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
      final data = await _api.stores.paymentConfig.get(storeId);
      if (data.isEmpty) {
        return PaymentConfigModel.defaultShared(storeId);
      }
      return PaymentConfigModel.fromMap(data, storeId);
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
          'color': 0xFF8B5CF6,
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
    return SubscriptionPlan.values
        .map((p) => {...getPlanInfo(p), 'plan': p})
        .toList();
  }

  static String _planSlug(SubscriptionPlan plan) => plan.name;

  SubscriptionModel? _subscriptionModelFromGateway(
    String storeId,
    Map<String, dynamic> data,
  ) {
    final store = Map<String, dynamic>.from(data['store'] as Map? ?? {});
    final subscription = data['subscription'];
    if (subscription is! Map) {
      if (store.isEmpty) return null;
      return SubscriptionModel.fromMap({
        'storeId': storeId,
        'plan': 'trial',
        'status': store['trial_status'] ?? 'active',
        'trialEndsAt': store['trial_ends_at'],
        'startDate': DateTime.now().toIso8601String(),
        'createdAt': DateTime.now().toIso8601String(),
        'productLimit': PlanConfig.productLimits[SubscriptionPlan.trial],
        'commissionPercent':
            PlanConfig.commissionPercents[SubscriptionPlan.trial],
      }, '$storeId-trial');
    }

    final row = Map<String, dynamic>.from(subscription);
    final plan = _parsePlan(row['plan']);

    return SubscriptionModel.fromMap({
      'storeId': storeId,
      'plan': plan.name,
      'status': _normalizeStatus(row['status']),
      'startDate': row['created_at'] ?? DateTime.now().toIso8601String(),
      'endDate': row['current_period_end'],
      'trialEndsAt': store['trial_ends_at'],
      'nextBillingDate': row['current_period_end'],
      'createdAt': row['created_at'] ?? DateTime.now().toIso8601String(),
      'updatedAt': row['updated_at'],
      'productLimit': PlanConfig.productLimits[plan],
      'commissionPercent': PlanConfig.commissionPercents[plan],
      'razorpaySubscriptionId': row['external_subscription_id'],
      'lastPaymentAmount': ((row['amount_paid'] as num?) ?? 0).toDouble() / 100,
      'currentProductCount': store['current_product_count'] ?? 0,
    }, '${row['id'] ?? '$storeId-${plan.name}'}');
  }

  SubscriptionPlan _parsePlan(dynamic value) {
    final text = value?.toString().toLowerCase();
    return SubscriptionPlan.values.firstWhere(
      (plan) => plan.name == text,
      orElse: () => SubscriptionPlan.trial,
    );
  }

  String _normalizeStatus(dynamic value) {
    final status = value?.toString().toLowerCase();
    if (status == 'cancelled') return 'canceled';
    if (status == 'past_due') return 'pastDue';
    return status ?? 'active';
  }
}
