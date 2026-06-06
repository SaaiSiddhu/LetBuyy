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
      dailyStats:
          (json['dailyStats'] as List?)
              ?.map((e) => DailyStats.fromJson(e))
              .toList() ??
          [],
      topProducts:
          (json['topProducts'] as List?)
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
      orders:
          (json['orders'] as int?) ??
          (json['total_sold'] as int?) ??
          (json['units_sold'] as int?) ??
          0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Service for fetching store analytics from the gateway analytics contract.
class AnalyticsService extends ChangeNotifier {
  final ApiClient _api;

  AnalyticsService({required ApiClient api}) : _api = api;

  StoreAnalytics? _analytics;
  StoreAnalytics? get analytics => _analytics;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  /// Fetch analytics for a store from `/analytics/*` gateway endpoints.
  Future<StoreAnalytics> getStoreAnalytics(
    String storeId, {
    String period = '30d',
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final query = {'store_id': storeId, 'period': period};
      final dashboard = await _api.analytics.dashboard(query);
      final orderBreakdown = await _api.analytics.orders({'store_id': storeId});
      final revenue = await _api.requestJson(
        '/analytics/revenue',
        options: ApiRequestOptions(query: query),
      );
      final topProductRows = await _api.requestData<List<Map<String, dynamic>>>(
        '/analytics/top-products',
        options: ApiRequestOptions(query: {'store_id': storeId, 'limit': 5}),
        decoder: (value) => asJsonList(
          value,
        ).map((item) => asJsonMap(item)).toList(growable: false),
      );

      final summary = asJsonMap(dashboard['summary']);
      final revenueMetric = asJsonMap(summary['revenue']);
      final ordersMetric = asJsonMap(summary['orders']);
      final ordersByStatus = _intMap(asJsonMap(orderBreakdown['breakdown']));
      final dailyStats = asJsonList(revenue['chart'])
          .map((item) => DailyStats.fromJson(asJsonMap(item)))
          .toList(growable: false);

      _analytics = StoreAnalytics(
        totalRevenue: _number(revenueMetric['value']),
        totalOrders: _integer(ordersMetric['value']),
        totalProducts: _integer(summary['products']),
        averageOrderValue: _number(summary['avg_order_value']),
        ordersByStatus: ordersByStatus,
        dailyStats: dailyStats,
        topProducts: topProductRows.map(TopProduct.fromJson).toList(),
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

  Map<String, int> _intMap(Map<String, dynamic> json) {
    return json.map((key, value) => MapEntry(key, _integer(value)));
  }

  int _integer(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  double _number(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }
}
