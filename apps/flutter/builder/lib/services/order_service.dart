import 'package:flutter/foundation.dart';

import '../models/order_model.dart';
import 'api_client.dart';

/// Service for managing orders via the LetBuyy API.
///
/// Replaces Firestore real-time streams with periodic API polling.
class OrderService extends ChangeNotifier {
  final ApiClient _api;

  OrderService({required ApiClient api}) : _api = api;

  // ── Cached state ─────────────────────────────────────────

  List<OrderModel> _orders = [];
  List<OrderModel> get orders => List.unmodifiable(_orders);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch orders for a store (paginated, optional status filter).
  Future<List<OrderModel>> fetchOrders(
    String storeId, {
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get('orders', query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (status != null) 'status': status,
      });
      final items = res['data'] as List? ?? [];
      _orders = items
          .map((e) => OrderModel.fromJson(e as Map<String, dynamic>))
          .toList();
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
  Future<OrderModel> fetchOrder(String id) async {
    final res = await _api.get('orders/$id');
    return OrderModel.fromJson(res['data'] as Map<String, dynamic>);
  }

  // ── Status Updates ───────────────────────────────────────

  /// Update order status and optional fields.
  Future<OrderModel> updateOrderStatus(
    String id, {
    required String status,
    String? trackingNumber,
    String? carrier,
    String? notes,
  }) async {
    final res = await _api.patch('orders/$id', body: {
      'status': status,
      if (trackingNumber != null) 'tracking_number': trackingNumber,
      if (carrier != null) 'carrier': carrier,
      if (notes != null) 'notes': notes,
    });
    final updated = OrderModel.fromJson(res['data'] as Map<String, dynamic>);
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Fulfill ──────────────────────────────────────────────

  /// Mark an order as shipped with optional tracking info.
  Future<OrderModel> fulfillOrder(
    String id, {
    String? trackingNumber,
    String? carrier,
  }) async {
    final res = await _api.post('orders/$id/fulfill', body: {
      if (trackingNumber != null) 'tracking_number': trackingNumber,
      if (carrier != null) 'carrier': carrier,
    });
    final updated = OrderModel.fromJson(res['data'] as Map<String, dynamic>);
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx != -1) _orders[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Refund / Cancel ──────────────────────────────────────

  /// Cancel and refund an order.
  Future<OrderModel> refundOrder(String id, {String? reason}) async {
    final res = await _api.post('orders/$id/refund', body: {
      if (reason != null) 'reason': reason,
    });
    final updated = OrderModel.fromJson(res['data'] as Map<String, dynamic>);
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
      final key = o.status.name;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
