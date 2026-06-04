import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

/// Service for managing orders via the LetBuyy API.
///
/// Replaces Firestore real-time streams with periodic API polling.
class OrderService extends ChangeNotifier {
  final ApiClient _api;

  OrderService({required ApiClient api}) : _api = api;

  // ── Cached state ─────────────────────────────────────────

  List<OrderContract> _orders = [];
  List<OrderContract> get orders => List.unmodifiable(_orders);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch orders for a store (paginated, optional status filter).
  Future<List<OrderContract>> fetchOrders(
    String storeId, {
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.orders.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (status != null) 'status': status,
        },
      );
      _orders = pageResult.data
          .map(OrderContract.fromJson)
          .toList(growable: false);
      return _orders;
    } catch (e) {
      debugPrint('❌ fetchOrders error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get a single order by ID.
  Future<OrderContract> fetchOrder(String id) async {
    return OrderContract.fromJson(await _api.orders.get(id));
  }

  // ── Status Updates ───────────────────────────────────────

  /// Update order status and optional fields.
  Future<OrderContract> updateOrderStatus(
    String id, {
    required String status,
    String? trackingNumber,
    String? carrier,
    String? notes,
  }) async {
    final updated = OrderContract.fromJson(
      await _api.orders.update(id, {
        'status': status,
        if (trackingNumber != null) 'tracking_number': trackingNumber,
        if (carrier != null) 'carrier': carrier,
        if (notes != null) 'notes': notes,
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Fulfill ──────────────────────────────────────────────

  /// Mark an order as shipped with optional tracking info.
  Future<OrderContract> fulfillOrder(
    String id, {
    String? trackingNumber,
    String? carrier,
  }) async {
    final updated = OrderContract.fromJson(
      await _api.orders.fulfill(id, {
        if (trackingNumber != null) 'tracking_number': trackingNumber,
        if (carrier != null) 'carrier': carrier,
      }),
    );
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Refund / Cancel ──────────────────────────────────────

  /// Cancel and refund an order.
  Future<OrderContract> refundOrder(String id, {String? reason}) async {
    final updated = OrderContract.fromJson(
      await _api.orders.refund(id, {if (reason != null) 'reason': reason}),
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
}
