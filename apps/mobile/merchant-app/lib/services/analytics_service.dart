import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Analytics data model for store performance.
class StoreAnalytics {
  final double totalRevenue;
  final int totalOrders;
  final int totalProducts;
  final int totalViews;
  final double averageOrderValue;
  final double conversionRate;
  final Map<String, int> ordersByStatus;
  final List<DailyStats> dailyStats;
  final List<TopProduct> topProducts;

  StoreAnalytics({
    this.totalRevenue = 0,
    this.totalOrders = 0,
    this.totalProducts = 0,
    this.totalViews = 0,
    this.averageOrderValue = 0,
    this.conversionRate = 0,
    this.ordersByStatus = const {},
    this.dailyStats = const [],
    this.topProducts = const [],
  });

  factory StoreAnalytics.fromJson(Map<String, dynamic> json) {
    return StoreAnalytics(
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0,
      totalOrders: json['totalOrders'] as int? ?? 0,
      totalProducts: json['totalProducts'] as int? ?? 0,
      totalViews: json['totalViews'] as int? ?? 0,
      averageOrderValue: (json['averageOrderValue'] as num?)?.toDouble() ?? 0,
      conversionRate: (json['conversionRate'] as num?)?.toDouble() ?? 0,
      ordersByStatus: Map<String, int>.from(json['ordersByStatus'] ?? {}),
      dailyStats: (json['dailyStats'] as List?)
              ?.map((e) => DailyStats.fromJson(e))
              .toList() ??
          [],
      topProducts: (json['topProducts'] as List?)
              ?.map((e) => TopProduct.fromJson(e))
              .toList() ??
          [],
    );
  }
}

/// Daily statistics for chart visualization.
class DailyStats {
  final DateTime date;
  final double revenue;
  final int orders;
  final int views;

  DailyStats({
    required this.date,
    this.revenue = 0,
    this.orders = 0,
    this.views = 0,
  });

  factory DailyStats.fromJson(Map<String, dynamic> json) {
    return DailyStats(
      date: DateTime.parse(json['date'] as String),
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
      orders: json['orders'] as int? ?? 0,
      views: json['views'] as int? ?? 0,
    );
  }
}

/// Top performing product data.
class TopProduct {
  final String id;
  final String name;
  final int views;
  final int orders;
  final double revenue;

  TopProduct({
    required this.id,
    required this.name,
    this.views = 0,
    this.orders = 0,
    this.revenue = 0,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) {
    return TopProduct(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      views: json['views'] as int? ?? 0,
      orders: json['orders'] as int? ?? 0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Service for fetching and managing store analytics via API.
///
/// Replaces Firestore-based analytics with REST API calls.
/// Some analytics data is computed from existing orders/products endpoints
/// until dedicated analytics endpoints are added to the backend.
class AnalyticsService extends ChangeNotifier {
  final ApiClient _api;

  AnalyticsService({required ApiClient api}) : _api = api;

  StoreAnalytics? _analytics;
  StoreAnalytics? get analytics => _analytics;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  /// Fetch analytics for a store.
  ///
  /// Currently computes basic stats from orders + products endpoints.
  /// Replace with a dedicated analytics endpoint when available.
  Future<StoreAnalytics> getStoreAnalytics(String storeId) async {
    _isLoading = true;
    notifyListeners();

    try {
      // Fetch orders to compute stats
      final ordersRes = await _api.get('orders', query: {
        'store_id': storeId,
        'limit': '100',
      });
      final ordersList = ordersRes['data'] as List? ?? [];

      // Fetch products count
      final productsRes = await _api.get('products', query: {
        'store_id': storeId,
        'limit': '1',
      });
      final totalProducts = productsRes['pagination']?['total'] as int? ?? 0;

      // Compute stats from orders
      double totalRevenue = 0;
      final ordersByStatus = <String, int>{};

      for (final order in ordersList) {
        totalRevenue += (order['total'] as num?)?.toDouble() ?? 0;
        final status = order['status'] as String? ?? 'unknown';
        ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
      }

      final totalOrders = ordersList.length;
      final avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0.0;

      _analytics = StoreAnalytics(
        totalRevenue: totalRevenue,
        totalOrders: totalOrders,
        totalProducts: totalProducts,
        averageOrderValue: avgOrderValue,
        ordersByStatus: ordersByStatus,
      );

      return _analytics!;
    } catch (e) {
      debugPrint('❌ getStoreAnalytics error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
