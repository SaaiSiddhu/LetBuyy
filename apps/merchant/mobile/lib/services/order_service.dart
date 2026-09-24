import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'app_badge_service.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Service for managing orders via the LetBuyy API.
///
/// Replaces legacy real-time streams with API-backed polling.
class OrderService extends ChangeNotifier {
  final ApiClient _api;
  final CacheService? _cache;
  final AppBadgeService? _appBadgeService;

  OrderService({
    required ApiClient api,
    CacheService? cache,
    AppBadgeService? appBadgeService,
  }) : _api = api,
       _cache = cache,
       _appBadgeService = appBadgeService;

  // ── Cached state ─────────────────────────────────────────

  List<OrderContract> _orders = [];
  List<OrderContract> get orders => List.unmodifiable(_orders);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _ordersNextCursor;
  String? get ordersNextCursor => _ordersNextCursor;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch orders for a store (paginated, optional status filter).
  Future<List<OrderContract>> fetchOrders(
    String storeId, {
    String? status,
    String? customerEmail,
    int page = 1,
    int limit = 20,
    String? cursor,
  }) async {
    _isLoading = true;
    final normalizedCursor = cursor?.trim();
    final cacheKey = CacheService.ordersKey(
      storeId,
      status: status,
      customerEmail: customerEmail,
      cursor: normalizedCursor,
      page: page,
      limit: limit,
    );
    final cachedRows = _cache?.readJsonList(cacheKey) ?? [];
    if (cachedRows.isNotEmpty) {
      _orders = cachedRows.map(OrderContract.fromJson).toList(growable: false);
    }
    notifyListeners();

    try {
      final pageResult = await _api.orders.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (normalizedCursor != null && normalizedCursor.isNotEmpty)
            'cursor': normalizedCursor,
          if (status != null) 'status': status,
          if (customerEmail != null && customerEmail.trim().isNotEmpty)
            'customer_email': customerEmail.trim(),
        },
      );
      _ordersNextCursor = pageResult.nextCursor;
      _orders = pageResult.data
          .map(OrderContract.fromJson)
          .toList(growable: false);
      await _cache?.writeJson(
        cacheKey,
        _orders.map((order) => order.toJson()).toList(growable: false),
      );
      for (final order in _orders) {
        await _cache?.writeJson(
          CacheService.orderDetailKey(order.id),
          order.toJson(),
        );
      }
      await syncOpenOrderBadge();
      return _orders;
    } catch (e) {
      debugPrint('❌ fetchOrders error: $e');
      if (_orders.isNotEmpty) {
        await syncOpenOrderBadge();
        return _orders;
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get a single order by ID.
  Future<OrderContract> fetchOrder(String id) async {
    try {
      final order = OrderContract.fromJson(await _api.orders.get(id));
      await _cache?.writeJson(CacheService.orderDetailKey(id), order.toJson());
      return order;
    } catch (e) {
      debugPrint('❌ fetchOrder error: $e');
      final cached = _cache?.readJsonMap(CacheService.orderDetailKey(id));
      if (cached != null) return OrderContract.fromJson(cached);
      rethrow;
    }
  }

  OrderContract? cachedOrder(String id) {
    final trimmedId = id.trim();
    if (trimmedId.isEmpty) return null;

    for (final order in _orders) {
      if (order.id == trimmedId) return order;
    }

    final cached = _cache?.readJsonMap(CacheService.orderDetailKey(trimmedId));
    if (cached == null) return null;
    return OrderContract.fromJson(cached);
  }

  Future<List<Map<String, dynamic>>> fetchDraftOrders(
    String storeId, {
    String status = 'draft',
    int page = 1,
    int limit = 20,
  }) async {
    final pageResult = await _api.orders.listDrafts(
      query: {
        'store_id': storeId,
        'status': status,
        'page': page,
        'limit': limit,
      },
    );
    return pageResult.data
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> exportOrders(String storeId, {String? status}) {
    return _api.exports.orders(storeId: storeId, status: status);
  }

  Future<Map<String, dynamic>> fetchExportJob(String id) {
    return _api.exports.job(id);
  }

  Future<Map<String, dynamic>> createDraftOrder({
    required String storeId,
    required String customerName,
    required String customerEmail,
    String? customerPhone,
    required List<Map<String, dynamic>> items,
    String paymentMethod = 'cod',
    String shippingMethod = 'standard',
    String? notes,
    String? idempotencyKey,
  }) async {
    final draftIdempotencyKey =
        idempotencyKey ??
        'mobile-draft-$storeId-${DateTime.now().microsecondsSinceEpoch}';
    final draft = await _api.orders.createDraft({
      'store_id': storeId,
      'idempotency_key': draftIdempotencyKey,
      'customer_name': customerName.trim(),
      'customer_email': customerEmail.trim(),
      if (customerPhone != null && customerPhone.trim().isNotEmpty)
        'customer_phone': customerPhone.trim(),
      'items': items,
      'payment_method': paymentMethod,
      'shipping_method': shippingMethod,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
    return Map<String, dynamic>.from(draft);
  }

  Future<OrderContract> convertDraftOrder(
    String draftId, {
    String? idempotencyKey,
  }) async {
    final convertIdempotencyKey =
        idempotencyKey ??
        'mobile-draft-convert-$draftId-${DateTime.now().microsecondsSinceEpoch}';
    final result = await _api.orders.convertDraft(draftId, {
      'idempotency_key': convertIdempotencyKey,
    });
    final order = result['order'];
    if (order is! Map) {
      throw StateError('Draft conversion response did not include an order.');
    }
    final converted = OrderContract.fromJson(Map<String, dynamic>.from(order));
    _orders = [
      converted,
      ..._orders.where((existing) => existing.id != converted.id),
    ];
    await _cache?.writeJson(
      CacheService.orderDetailKey(converted.id),
      converted.toJson(),
    );
    notifyListeners();
    return converted;
  }

  // ── Status Updates ───────────────────────────────────────

  /// Update order status and optional fields.
  Future<OrderContract> updateOrderStatus(
    String id, {
    required String status,
    String? trackingNumber,
    String? carrier,
    String? cancellationReason,
    String? notes,
    String? idempotencyKey,
  }) async {
    final statusIdempotencyKey =
        idempotencyKey ??
        'mobile-status-$id-$status-${DateTime.now().microsecondsSinceEpoch}';
    final updated = OrderContract.fromJson(
      await _api.orders.update(id, {
        'idempotency_key': statusIdempotencyKey,
        'status': status,
        if (trackingNumber != null) 'tracking_number': trackingNumber,
        if (carrier != null) 'carrier': carrier,
        if (cancellationReason != null && cancellationReason.trim().isNotEmpty)
          'cancellation_reason': cancellationReason.trim(),
        if (notes != null) 'notes': notes,
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    await _cache?.writeJson(CacheService.orderDetailKey(id), updated.toJson());
    notifyListeners();
    return updated;
  }

  Future<OrderContract> cancelOrder(
    String id, {
    required String reason,
    String? notes,
    String? idempotencyKey,
  }) {
    return updateOrderStatus(
      id,
      status: 'cancelled',
      cancellationReason: reason,
      notes: notes,
      idempotencyKey:
          idempotencyKey ??
          'mobile-cancel-$id-${DateTime.now().microsecondsSinceEpoch}',
    );
  }

  // ── Fulfill ──────────────────────────────────────────────

  /// Mark an order as shipped with optional tracking info.
  Future<OrderContract> fulfillOrder(
    String id, {
    String? trackingNumber,
    String? carrier,
    bool createShippingLabel = false,
    String? logisticsProvider,
    int? packageWeightGrams,
    double? packageLengthCm,
    double? packageWidthCm,
    double? packageHeightCm,
    String? idempotencyKey,
  }) async {
    final fulfillIdempotencyKey =
        idempotencyKey ??
        'mobile-fulfill-$id-${DateTime.now().microsecondsSinceEpoch}';
    final updated = OrderContract.fromJson(
      await _api.orders.fulfill(id, {
        'idempotency_key': fulfillIdempotencyKey,
        if (trackingNumber != null) 'tracking_number': trackingNumber,
        if (carrier != null) 'carrier': carrier,
        'create_shipping_label': createShippingLabel,
        if (logisticsProvider != null) 'logistics_provider': logisticsProvider,
        if (packageWeightGrams != null)
          'package_weight_grams': packageWeightGrams,
        if (packageLengthCm != null &&
            packageWidthCm != null &&
            packageHeightCm != null)
          'package_dimensions_cm': {
            'length': packageLengthCm,
            'width': packageWidthCm,
            'height': packageHeightCm,
          },
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    await _cache?.writeJson(CacheService.orderDetailKey(id), updated.toJson());
    notifyListeners();
    return updated;
  }

  Future<OrderContract> updateLineItems(
    String id, {
    List<Map<String, dynamic>> lines = const [],
    List<Map<String, dynamic>> addItems = const [],
    List<String> removeLineItemIds = const [],
    String? notes,
    String? idempotencyKey,
  }) async {
    final lineItemsIdempotencyKey =
        idempotencyKey ??
        'mobile-order-lines-$id-${DateTime.now().microsecondsSinceEpoch}';
    final updated = OrderContract.fromJson(
      await _api.orders.updateLineItems(id, {
        'idempotency_key': lineItemsIdempotencyKey,
        'lines': lines,
        'add_items': addItems,
        'remove_line_item_ids': removeLineItemIds,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    await _cache?.writeJson(CacheService.orderDetailKey(id), updated.toJson());
    notifyListeners();
    return updated;
  }

  Future<Map<String, dynamic>> fetchPackingSlip(String id) {
    return _api.orders.packingSlip(id);
  }

  Future<Map<String, dynamic>> fetchShippingLabelRates(
    String orderId, {
    String provider = 'shiprocket',
    int packageWeightGrams = 500,
    double? packageLengthCm,
    double? packageWidthCm,
    double? packageHeightCm,
  }) {
    return _api.shippingLabels.rates({
      'order_id': orderId,
      'provider': provider,
      'package': {
        'weight_grams': packageWeightGrams,
        if (packageLengthCm != null) 'length_cm': packageLengthCm,
        if (packageWidthCm != null) 'width_cm': packageWidthCm,
        if (packageHeightCm != null) 'height_cm': packageHeightCm,
      },
    });
  }

  Future<Map<String, dynamic>> buyShippingLabel(
    String orderId, {
    String provider = 'shiprocket',
    int packageWeightGrams = 500,
    double? packageLengthCm,
    double? packageWidthCm,
    double? packageHeightCm,
    String? idempotencyKey,
  }) {
    return _api.shippingLabels.buy({
      'order_id': orderId,
      'provider': provider,
      'idempotency_key':
          idempotencyKey ??
          'mobile-label-$orderId-${DateTime.now().microsecondsSinceEpoch}',
      'package': {
        'weight_grams': packageWeightGrams,
        if (packageLengthCm != null) 'length_cm': packageLengthCm,
        if (packageWidthCm != null) 'width_cm': packageWidthCm,
        if (packageHeightCm != null) 'height_cm': packageHeightCm,
      },
    });
  }

  // ── Refund / Cancel ──────────────────────────────────────

  /// Cancel and refund an order.
  Future<OrderContract> refundOrder(
    String id, {
    String? reason,
    double? amount,
    String? idempotencyKey,
  }) async {
    final refundIdempotencyKey =
        idempotencyKey ??
        'mobile-refund-$id-${DateTime.now().microsecondsSinceEpoch}';
    final updated = OrderContract.fromJson(
      await _api.orders.refund(id, {
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
        if (amount != null) 'amount': amount,
        if (amount != null) 'amount_minor': (amount * 100).round(),
      }, options: ApiRequestOptions(idempotencyKey: refundIdempotencyKey)),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  /// Complete a provider-side refund after the gateway marks it ready.
  Future<OrderContract> completeRefund(
    String id, {
    String? refundId,
    String? providerRefundId,
    String? notes,
  }) async {
    final updated = OrderContract.fromJson(
      await _api.orders.completeRefund(id, {
        if (refundId != null && refundId.trim().isNotEmpty)
          'refund_id': refundId.trim(),
        if (providerRefundId != null && providerRefundId.trim().isNotEmpty)
          'provider_refund_id': providerRefundId.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Counts / Stats ───────────────────────────────────────

  /// Quick counts per status (uses the cached list).
  Map<String, int> get statusCounts {
    final counts = <String, int>{};
    for (final o in _orders) {
      final key = o.status.isEmpty ? 'unknown' : o.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  int get openOrderCount =>
      AppBadgeService.openOrderCountFromStatusCounts(statusCounts);

  Future<int> syncOpenOrderBadge() async {
    final badgeService = _appBadgeService;
    final count = openOrderCount;
    if (badgeService != null) {
      await badgeService.setBadgeCount(count);
    }
    return count;
  }
}
