import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import 'api_client.dart';
import 'subscription_catalog.dart';
export 'subscription_catalog.dart';

/// Public saved money only; tax applicability and arithmetic remain server-owned.
class SubscriptionTaxBreakdown {
  const SubscriptionTaxBreakdown({required this.gross,required this.base,required this.tax,required this.cgst,required this.sgst,required this.igst,required this.supplyType});
  final int gross,base,tax,cgst,sgst,igst;
  final String supplyType;
  factory SubscriptionTaxBreakdown.fromJson(Object? value,{required Object? grossMinor}) {
    if(value is! Map || value['schema_version']!=1 || value['policy_version']!='D-SUB-TAX-INCLUSIVE-V1' || value['basis']!='inclusive' || value['currency']!='INR') {
      throw const FormatException('The saved subscription tax breakdown needs review before paying.');
    }
    int minor(Object? v) {
      if(v is! num || !v.isFinite || v<0 || v!=v.round() || v>2147483647) throw const FormatException('Subscription money is unavailable.');
      return v.toInt();
    }
    final gross=minor(value['gross_minor']),base=minor(value['taxable_minor']),tax=minor(value['tax_minor']),
      cgst=minor(value['cgst_minor']),sgst=minor(value['sgst_minor']),igst=minor(value['igst_minor']),supply=value['supply_type'];
    if(gross<=0 || gross!=minor(grossMinor) || base+tax!=gross || cgst+sgst+igst!=tax ||
      !(supply=='intra_state' ? igst==0 && cgst==tax~/2 && sgst==tax-cgst : supply=='inter_state' && cgst==0 && sgst==0 && igst==tax)) {
      throw const FormatException('The saved subscription tax breakdown does not match the charge.');
    }
    return SubscriptionTaxBreakdown(gross:gross,base:base,tax:tax,cgst:cgst,sgst:sgst,igst:igst,supplyType:supply as String);
  }
}

class BillingHistoryEntry {
  const BillingHistoryEntry({
    required this.id,
    required this.amountPaid,
    required this.status,
    required this.billingPeriod,
    required this.createdAt,
    this.invoiceNumber,
    this.taxAmount,
    this.totalAmount,
    this.taxBreakdown,
  });

  factory BillingHistoryEntry.fromJson(Map<String, dynamic> json) {
    if (json['currency'] != null && json['currency'] != 'INR')
      throw const FormatException('Invoice currency is unavailable.');
    return BillingHistoryEntry(
      id: _stringValue(json['id']),
      amountPaid: _invoiceMinor(json['amount'] ?? json['amount_paid']),
      taxBreakdown:json['tax']==null?null:SubscriptionTaxBreakdown.fromJson(json['tax'],grossMinor:json['amount']??json['amount_paid']),
      status: _stringValue(
        json['payment_status'] ?? json['status'],
        fallback: 'unknown',
      ),
      billingPeriod: _stringValue(json['billing_period'], fallback: 'monthly'),
      createdAt: _stringValue(json['created_at']),
      invoiceNumber: json['invoice_number'] as String?,
      taxAmount: json['tax_amount'] == null
          ? null
          : _invoiceMinor(json['tax_amount']),
      totalAmount: json['total_amount'] == null
          ? null
          : _invoiceMinor(json['total_amount']),
    );
  }

  final String id;
  final num amountPaid;
  final String status;
  final String billingPeriod;
  final String createdAt;

  final String? invoiceNumber;
  final int? taxAmount, totalAmount;
  final SubscriptionTaxBreakdown? taxBreakdown;
  String get amountLabel => 'INR ${(amountPaid / 100).toStringAsFixed(2)}';
  static int _invoiceMinor(Object? value) {
    if (value is! num ||
        !value.isFinite ||
        value < 0 ||
        value != value.round() ||
        value > 9007199254740991) {
      throw const FormatException('Invoice amount is unavailable.');
    }
    return value.toInt();
  }
}

/// Service for managing store subscriptions via the API.
///
/// Replaces provider-local functions and database access with REST calls.
class SubscriptionService {
  final ApiClient _api;

  SubscriptionService({
    required ApiClient api,
    String? Function()? actorIdProvider,
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _api = api,
       _actorIdProvider = actorIdProvider,
       _storage = storage;

  final String? Function()? _actorIdProvider;
  final FlutterSecureStorage _storage;
  static Future<void> _mutationTail = Future<void>.value();

  String _actor() {
    final actor = _actorIdProvider?.call();
    if (actor == null || actor.isEmpty)
      throw StateError('Sign in again before continuing checkout.');
    return actor;
  }

  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = Completer<T>();
    _mutationTail = _mutationTail.then((_) async {
      try {
        result.complete(await action());
      } catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }

  String _storageKey(String actor) =>
      'letbuyy.subscription.checkouts.v1:$actor';

  Future<Map<String, dynamic>> _readIntents(String actor) async {
    final raw = await _storage.read(key: _storageKey(actor));
    return raw == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  Future<Map<String, dynamic>> _checkout(
    String operation,
    Map<String, dynamic> body,
    Future<Map<String, dynamic>> Function(ApiRequestOptions) send,
  ) => _serialized(() async {
    final actor = _actor();
    final pending = await _readIntents(actor);
    if (_actor() != actor)
      throw StateError('Account changed. Open checkout again.');
    final intent = jsonEncode([operation, body]);
    final retained = pending[intent] is Map
        ? Map<String, dynamic>.from(pending[intent] as Map)
        : <String, dynamic>{};
    final key = retained['key'] is String
        ? retained['key'] as String
        : 'subscription-checkout:${const Uuid().v4()}';
    pending[intent] = {...retained, 'key': key};
    await _storage.write(key: _storageKey(actor), value: jsonEncode(pending));
    if (_actor() != actor)
      throw StateError('Account changed. Open checkout again.');
    final value = await send(
      ApiRequestOptions(
        method: HttpMethod.post,
        body: body,
        idempotencyKey: key,
      ),
    );
    if (_actor() != actor)
      throw StateError('Account changed. Open checkout again.');
    if(value['tax']!=null) SubscriptionTaxBreakdown.fromJson(value['tax'],grossMinor:value['amount']);
    if (value['activated'] == true) {
      pending.remove(intent);
    } else {
      pending[intent] = {
        'key': key,
        'reference':
            value['razorpay_order_id'] ?? value['razorpay_subscription_id'],
      };
    }
    await _storage.write(key: _storageKey(actor), value: jsonEncode(pending));
    return value;
  });

  Future<void> _completeCheckout(String actor, String? reference) =>
      _serialized(() async {
        if (reference == null || reference.isEmpty) return;
        final pending = await _readIntents(actor);
        pending.removeWhere(
          (_, receipt) => receipt is Map && receipt['reference'] == reference,
        );
        await _storage.write(
          key: _storageKey(actor),
          value: jsonEncode(pending),
        );
      });

  // ============================================================
  // CREATE SUBSCRIPTION
  // ============================================================

  /// Create a new subscription for a store
  Future<Map<String, dynamic>> createSubscription({
    required String storeId,
    required SubscriptionPlan plan,
  }) => createSubscriptionOrder(storeId: storeId, plan: plan);

  Future<List<MerchantBillingPlan>> fetchPlans(String storeId) async {
    final rows = await _api.payments.plans({
      'site_type': 'store',
      'store_id': storeId,
    });
    return rows.map(MerchantBillingPlan.fromJson).toList(growable: false);
  }

  Future<MerchantBillingState> fetchBillingState(String storeId) async =>
      MerchantBillingState.fromJson(
        await _api.requestJson(
          'payments/subscription',
          options: ApiRequestOptions(query: {'store_id': storeId}),
        ),
      );

  Future<Map<String, dynamic>> createCatalogCheckout({
    required String storeId,
    required String planSlug,
    String billingPeriod = 'monthly',
  }) => _checkout(
    'checkout',
    {
      'store_id': storeId,
      'site_type': 'store',
      'plan_slug': planSlug,
      'billing_period': billingPeriod,
    },
    (options) =>
        _api.requestJson('payments/subscription/order', options: options),
  );

  /// Retain the same logical intent through timeout, dismissal and app restart.
  Future<Map<String, dynamic>> createSubscriptionOrder({
    required String storeId,
    required SubscriptionPlan plan,
    String billingPeriod = 'monthly',
  }) => createCatalogCheckout(
    storeId: storeId,
    planSlug: _planSlug(plan),
    billingPeriod: billingPeriod,
  );

  /// Verify a Razorpay subscription payment and activate the plan.
  Future<Map<String, dynamic>> verifySubscriptionPayment({
    required String storeId,
    required SubscriptionPlan plan,
    required String razorpayPaymentId,
    required String razorpaySignature,
    String? razorpayOrderId,
    String? razorpaySubscriptionId,
    String billingPeriod = 'monthly',
  }) => verifyCatalogSubscriptionPayment(
    storeId: storeId,
    planSlug: _planSlug(plan),
    razorpayPaymentId: razorpayPaymentId,
    razorpaySignature: razorpaySignature,
    razorpayOrderId: razorpayOrderId,
    razorpaySubscriptionId: razorpaySubscriptionId,
    billingPeriod: billingPeriod,
  );

  Future<Map<String, dynamic>> verifyCatalogSubscriptionPayment({
    required String storeId,
    required String planSlug,
    required String razorpayPaymentId,
    required String razorpaySignature,
    String? razorpayOrderId,
    String? razorpaySubscriptionId,
    String billingPeriod = 'monthly',
  }) async {
    final actor = _actor();
    try {
      final result = await _api.requestJson(
        'payments/subscription/verify',
        options: ApiRequestOptions(
          method: HttpMethod.post,
          idempotencyKey: 'subscription-verify:$razorpayPaymentId',
          body: {
            'store_id': storeId,
            'site_type': 'store',
            'plan_slug': planSlug,
            'billing_period': billingPeriod,
            'razorpay_payment_id': razorpayPaymentId,
            'razorpay_signature': razorpaySignature,
            if (razorpayOrderId != null) 'razorpay_order_id': razorpayOrderId,
            if (razorpaySubscriptionId != null)
              'razorpay_subscription_id': razorpaySubscriptionId,
          },
        ),
      );
      if (_actor() != actor)
        throw StateError('Account changed. Open billing again.');
      // Verification already committed. Storage cleanup failure must not claim payment failure.
      try {
        await _completeCheckout(
          actor,
          razorpaySubscriptionId ?? razorpayOrderId,
        );
      } catch (_) {}
      return result;
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
      return await createSubscriptionOrder(storeId: storeId, plan: newPlan);
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

  Future<List<BillingHistoryEntry>> fetchBillingHistory(String storeId) async {
    try {
      final rows = await _api.payments.subscription.history(storeId);
      return rows.map(BillingHistoryEntry.fromJson).toList(growable: false);
    } catch (e) {
      debugPrint('Error getting subscription history: $e');
      rethrow;
    }
  }

  /// Start a checkout that recovers the latest failed subscription payment.
  Future<Map<String, dynamic>> recoverFailedPayment({
    required String storeId,
    String? billingPeriod,
  }) => _checkout(
    'recover',
    {
      'store_id': storeId,
      if (billingPeriod != null) 'billing_period': billingPeriod,
    },
    (options) => _api.payments.subscription.recover(
      Map<String, dynamic>.from(options.body as Map),
      options: options,
    ),
  );

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
          'commission': 0.0,
          'commissionLabel': '0% transaction fee',
          'badge': '🎁',
          'color': LetbuyyColorTokens.brandPrimary.toARGB32(),
          'features': [
            '50 products',
            '0% transaction fee',
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
          'commission': 0.0,
          'commissionLabel': '0% transaction fee',
          'badge': '🚀',
          'color': 0xFF10B981,
          'features': [
            '5 products',
            '0% transaction fee',
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
          'commission': 0.0,
          'commissionLabel': '0% transaction fee',
          'badge': '⭐',
          'color': LetbuyyColorTokens.brandPrimary.toARGB32(),
          'isPopular': true,
          'features': [
            '30 products',
            '0% transaction fee',
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
          'commissionLabel': '0% transaction fee',
          'badge': '👑',
          'color': 0xFFF59E0B,
          'features': [
            'Unlimited products',
            '0% transaction fee',
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
    if (status == 'failed') return 'pastDue';
    return status ?? 'active';
  }
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}

num _numValue(Object? value, {num fallback = 0}) {
  if (value is num) return value;
  return num.tryParse(value?.toString() ?? '') ?? fallback;
}
