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
  final List<TrafficSourceEntry> trafficSources;
  final StoreAnalyticsComparison comparison;

  /// Availability describes an observed server value, including a real zero.
  /// A successful partial composite is not evidence that a missing metric is 0.
  final bool summaryAvailable;
  final bool viewsAvailable;
  final bool trafficSourcesAvailable;

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
    this.trafficSources = const [],
    this.comparison = const StoreAnalyticsComparison(),
    this.summaryAvailable = true,
    this.viewsAvailable = false,
    this.trafficSourcesAvailable = false,
  });

  factory StoreAnalytics.fromJson(Map<String, dynamic> json) {
    return StoreAnalytics(
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0,
      totalOrders: json['totalOrders'] as int? ?? 0,
      totalProducts: json['totalProducts'] as int? ?? 0,
      totalViews: json['totalViews'] as int? ?? 0,
      averageOrderValue: (json['averageOrderValue'] as num?)?.toDouble() ?? 0,
      conversionRate: (json['conversionRate'] as num?)?.toDouble() ?? 0,
      summaryAvailable:
          json['totalRevenue'] is num &&
          json['totalOrders'] is num &&
          json['totalProducts'] is num,
      viewsAvailable: json['totalViews'] is num,
      trafficSourcesAvailable: json['trafficSources'] is List,
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
      trafficSources:
          (json['trafficSources'] as List?)
              ?.map((e) => TrafficSourceEntry.fromJson(e))
              .toList() ??
          [],
      comparison: StoreAnalyticsComparison.fromJson(
        _jsonMapOrEmpty(json['comparison']),
      ),
    );
  }
}

class MobileDashboardSnapshot {
  const MobileDashboardSnapshot({
    required this.analytics,
    required this.payoutSummary,
    required this.providerMode,
  });

  final StoreAnalytics analytics;
  final Map<String, dynamic>? payoutSummary;
  final String? providerMode;
}

/// Daily statistics for chart visualization.
class DailyStats {
  final DateTime date;
  // Presence metadata only; the original numeric decoding remains unchanged.
  final bool revenueAvailable, ordersAvailable;
  final double revenue;
  final int orders;
  final int views;

  DailyStats({
    required this.date,
    this.revenueAvailable = false,
    this.ordersAvailable = false,
    this.revenue = 0,
    this.orders = 0,
    this.views = 0,
  });

  factory DailyStats.fromJson(Map<String, dynamic> json) {
    return DailyStats(
      date: DateTime.parse(json['date'] as String),
      revenueAvailable:
          json['revenue'] is num && (json['revenue'] as num).isFinite,
      ordersAvailable: json['orders'] is int,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
      orders: json['orders'] as int? ?? 0,
      views: json['views'] as int? ?? 0,
    );
  }
}

class AnalyticsMetricDelta {
  final bool available;
  final double value;
  final double previous;
  final double changePct;

  const AnalyticsMetricDelta({
    this.available = false,
    this.value = 0,
    this.previous = 0,
    this.changePct = 0,
  });

  factory AnalyticsMetricDelta.fromJson(Map<String, dynamic> json) {
    return AnalyticsMetricDelta(
      available: const [
        'value',
        'prev',
        'change_pct',
      ].every((key) => json[key] is num && (json[key] as num).isFinite),
      value: _parseDouble(json['value']),
      previous: _parseDouble(json['prev']),
      changePct: _parseDouble(json['change_pct']),
    );
  }

  bool get hasPrevious => previous > 0;
}

class StoreAnalyticsComparison {
  final String previousLabel;
  final DateTime? previousFrom;
  final DateTime? previousTo;
  final AnalyticsMetricDelta revenue;
  final AnalyticsMetricDelta orders;
  final AnalyticsMetricDelta averageOrderValue;
  final List<DailyStats> previousDailyStats;

  const StoreAnalyticsComparison({
    this.previousLabel = 'Previous period',
    this.previousFrom,
    this.previousTo,
    this.revenue = const AnalyticsMetricDelta(),
    this.orders = const AnalyticsMetricDelta(),
    this.averageOrderValue = const AnalyticsMetricDelta(),
    this.previousDailyStats = const [],
  });

  factory StoreAnalyticsComparison.fromJson(Map<String, dynamic> json) {
    final period = _jsonMapOrEmpty(json['previous_period']);
    return StoreAnalyticsComparison(
      previousLabel: period['label']?.toString().trim().isNotEmpty == true
          ? period['label'].toString()
          : 'Previous period',
      previousFrom: _parseDate(period['from']),
      previousTo: _parseDate(period['to']),
      revenue: AnalyticsMetricDelta.fromJson(_jsonMapOrEmpty(json['revenue'])),
      orders: AnalyticsMetricDelta.fromJson(_jsonMapOrEmpty(json['orders'])),
      averageOrderValue: AnalyticsMetricDelta.fromJson(
        _jsonMapOrEmpty(json['average_order_value']),
      ),
      previousDailyStats:
          asJsonList(json['previousDailyStats'] ?? const <dynamic>[])
              .map((item) => DailyStats.fromJson(asJsonMap(item)))
              .toList(growable: false),
    );
  }

  factory StoreAnalyticsComparison.fromGateway({
    required Map<String, dynamic> dashboard,
    required Map<String, dynamic> revenue,
  }) {
    final comparison = _jsonMapOrEmpty(dashboard['comparison']);
    final revenueComparison = _jsonMapOrEmpty(revenue['comparison']);
    return StoreAnalyticsComparison.fromJson({
      ...comparison,
      'previousDailyStats': asJsonList(
        revenueComparison['chart'] ?? const <dynamic>[],
      ),
    });
  }

  bool get hasPreviousData {
    return revenue.hasPrevious ||
        orders.hasPrevious ||
        averageOrderValue.hasPrevious ||
        previousDailyStats.any(
          (day) => day.revenue > 0 || day.orders > 0 || day.views > 0,
        );
  }
}

/// Top performing product data.
class TopProduct {
  final bool revenueAvailable, ordersAvailable;
  final String id;
  final String name;
  final int views;
  final int orders;
  final double revenue;

  TopProduct({
    this.revenueAvailable = false,
    this.ordersAvailable = false,
    required this.id,
    required this.name,
    this.views = 0,
    this.orders = 0,
    this.revenue = 0,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) {
    return TopProduct(
      revenueAvailable:
          json['revenue'] is num && (json['revenue'] as num).isFinite,
      ordersAvailable:
          json['orders'] is int ||
          json['total_sold'] is int ||
          json['units_sold'] is int,
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

class TrafficSourceEntry {
  final bool sessionsAvailable, percentageAvailable;
  final String label;
  final int sessions;
  final double percentage;
  final Map<String, dynamic> metadata;

  const TrafficSourceEntry({
    this.sessionsAvailable = false,
    this.percentageAvailable = false,
    required this.label,
    this.sessions = 0,
    this.percentage = 0,
    this.metadata = const {},
  });

  factory TrafficSourceEntry.fromJson(Map<String, dynamic> json) {
    return TrafficSourceEntry(
      sessionsAvailable:
          json['value'] is num && (json['value'] as num).isFinite,
      percentageAvailable:
          json['percentage'] is num && (json['percentage'] as num).isFinite,
      label: json['label']?.toString() ?? '',
      sessions: _parseInt(json['value']),
      percentage: _parseDouble(json['percentage']),
      metadata: _jsonMapOrEmpty(json['metadata']),
    );
  }
}

class LiveViewEntry {
  final bool valueAvailable;
  final String label;
  final int value;
  final Map<String, dynamic> metadata;

  const LiveViewEntry({
    this.valueAvailable = false,
    required this.label,
    this.value = 0,
    this.metadata = const {},
  });

  factory LiveViewEntry.fromJson(Map<String, dynamic> json) {
    return LiveViewEntry(
      valueAvailable: json['value'] is num && (json['value'] as num).isFinite,
      label: json['label']?.toString() ?? '',
      value: _parseInt(json['value']),
      metadata: _jsonMapOrEmpty(json['metadata']),
    );
  }
}

class LiveViewSignal {
  final String metricName;
  final String label;
  final int value;
  final DateTime? seenAt;

  const LiveViewSignal({
    required this.metricName,
    required this.label,
    this.value = 0,
    this.seenAt,
  });

  factory LiveViewSignal.fromJson(Map<String, dynamic> json) {
    final seenAt = json['seen_at']?.toString();
    return LiveViewSignal(
      metricName: json['metric_name']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      value: _parseInt(json['value']),
      seenAt: seenAt == null ? null : DateTime.tryParse(seenAt),
    );
  }
}

class StoreLiveView {
  final bool available;
  final bool metricsAvailable;
  final int windowMinutes;
  final int activeSessions;
  final int visitors;
  final int pageViews;
  final int cartAdds;
  final int checkoutsStarted;
  final List<LiveViewEntry> topPages;
  final List<LiveViewEntry> trafficSources;
  final List<LiveViewEntry> devices;
  final List<LiveViewEntry> countries;
  final List<LiveViewSignal> recentSignals;
  final DateTime generatedAt;
  final DateTime? lastSeenAt;
  final int refreshAfterSeconds;

  const StoreLiveView({
    this.metricsAvailable = false,
    this.available = false,
    this.windowMinutes = 15,
    this.activeSessions = 0,
    this.visitors = 0,
    this.pageViews = 0,
    this.cartAdds = 0,
    this.checkoutsStarted = 0,
    this.topPages = const [],
    this.trafficSources = const [],
    this.devices = const [],
    this.countries = const [],
    this.recentSignals = const [],
    required this.generatedAt,
    this.lastSeenAt,
    this.refreshAfterSeconds = 30,
  });

  factory StoreLiveView.fromJson(Map<String, dynamic> json) {
    final generatedAt = DateTime.tryParse(
      json['generated_at']?.toString() ?? '',
    );
    final lastSeenAt = json['last_seen_at']?.toString();
    return StoreLiveView(
      metricsAvailable: const [
        'active_sessions',
        'visitors',
        'page_views',
        'cart_adds',
        'checkouts_started',
        'window_minutes',
      ].every((key) => json[key] is num && (json[key] as num).isFinite),
      available: json['available'] == true,
      windowMinutes: _parseInt(json['window_minutes'], fallback: 15),
      activeSessions: _parseInt(json['active_sessions']),
      visitors: _parseInt(json['visitors']),
      pageViews: _parseInt(json['page_views']),
      cartAdds: _parseInt(json['cart_adds']),
      checkoutsStarted: _parseInt(json['checkouts_started']),
      topPages: asJsonList(json['top_pages'])
          .map((item) => LiveViewEntry.fromJson(asJsonMap(item)))
          .toList(growable: false),
      trafficSources: asJsonList(json['traffic_sources'])
          .map((item) => LiveViewEntry.fromJson(asJsonMap(item)))
          .toList(growable: false),
      devices: asJsonList(json['devices'])
          .map((item) => LiveViewEntry.fromJson(asJsonMap(item)))
          .toList(growable: false),
      countries: asJsonList(json['countries'])
          .map((item) => LiveViewEntry.fromJson(asJsonMap(item)))
          .toList(growable: false),
      recentSignals: asJsonList(json['recent_signals'])
          .map((item) => LiveViewSignal.fromJson(asJsonMap(item)))
          .toList(growable: false),
      generatedAt: generatedAt ?? DateTime.now().toUtc(),
      lastSeenAt: lastSeenAt == null ? null : DateTime.tryParse(lastSeenAt),
      refreshAfterSeconds: _parseInt(
        json['refresh_after_seconds'],
        fallback: 30,
      ),
    );
  }
}

/// Service for fetching store analytics from the gateway analytics contract.
class AnalyticsService extends ChangeNotifier {
  final ApiClient _api;

  AnalyticsService({required ApiClient api}) : _api = api;

  /// Read-only presentation lifetime; this does not grant report access.
  Object? get requestContext => _api.captureRequestContext();

  StoreAnalytics? _analytics;
  StoreAnalytics? get analytics => _analytics;
  StoreLiveView? _liveView;
  StoreLiveView? get liveView => _liveView;

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
      final revenue = await _api.analytics.revenue(query);
      final topProductRows = await _api.requestData<List<Map<String, dynamic>>>(
        '/analytics/top-products',
        options: ApiRequestOptions(query: {'store_id': storeId, 'limit': 5}),
        decoder: (value) => asJsonList(
          value,
        ).map((item) => asJsonMap(item)).toList(growable: false),
      );
      final trafficSources = await _api.analytics.trafficSources({
        'store_id': storeId,
        'period': period,
        'limit': 5,
      });

      final summary = asJsonMap(dashboard['summary']);
      final revenueMetric = asJsonMap(summary['revenue']);
      final ordersMetric = asJsonMap(summary['orders']);
      final ordersByStatus = _intMap(asJsonMap(orderBreakdown['breakdown']));
      final dailyStats = asJsonList(revenue['chart'])
          .map((item) => DailyStats.fromJson(asJsonMap(item)))
          .toList(growable: false);

      _analytics = StoreAnalytics(
        totalRevenue: _number(revenueMetric['value']),
        summaryAvailable:
            revenueMetric['value'] is num &&
            ordersMetric['value'] is num &&
            summary['products'] is num &&
            summary['avg_order_value'] is num,
        viewsAvailable: summary['visitors'] is num,
        trafficSourcesAvailable:
            trafficSources['available'] == true &&
            trafficSources['sources'] is List,
        totalViews: _integer(summary['visitors']),
        totalOrders: _integer(ordersMetric['value']),
        totalProducts: _integer(summary['products']),
        averageOrderValue: _number(summary['avg_order_value']),
        ordersByStatus: ordersByStatus,
        dailyStats: dailyStats,
        topProducts: topProductRows.map(TopProduct.fromJson).toList(),
        trafficSources: asJsonList(trafficSources['sources'])
            .map((item) => TrafficSourceEntry.fromJson(asJsonMap(item)))
            .toList(growable: false),
        comparison: StoreAnalyticsComparison.fromGateway(
          dashboard: dashboard,
          revenue: revenue,
        ),
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

  Future<MobileDashboardSnapshot> getMobileDashboardSnapshot(
    String storeId, {
    String period = '30d',
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.requestJson(
        '/mobile/dashboard',
        options: ApiRequestOptions(
          query: {'store_id': storeId, 'period': period},
        ),
      );
      final analyticsPayload = _jsonMapOrEmpty(response['analytics']);
      final dashboard = _jsonMapOrEmpty(analyticsPayload['dashboard']);
      final orderBreakdown = _jsonMapOrEmpty(
        analyticsPayload['order_breakdown'],
      );
      final revenue = _jsonMapOrEmpty(analyticsPayload['revenue']);
      final trafficSources = _jsonMapOrEmpty(
        analyticsPayload['traffic_sources'],
      );
      final topProductRows = asJsonList(
        analyticsPayload['top_products'] ?? const [],
      ).map((item) => asJsonMap(item)).toList(growable: false);
      final summary = _jsonMapOrEmpty(dashboard['summary']);
      final revenueMetric = _jsonMapOrEmpty(summary['revenue']);
      final ordersMetric = _jsonMapOrEmpty(summary['orders']);
      final ordersByStatus = _intMap(
        _jsonMapOrEmpty(orderBreakdown['breakdown']),
      );
      final dailyStats = asJsonList(revenue['chart'] ?? const [])
          .map((item) => DailyStats.fromJson(asJsonMap(item)))
          .toList(growable: false);

      _analytics = StoreAnalytics(
        totalRevenue: _number(revenueMetric['value']),
        summaryAvailable:
            revenueMetric['value'] is num &&
            ordersMetric['value'] is num &&
            summary['products'] is num &&
            summary['avg_order_value'] is num,
        viewsAvailable: summary['visitors'] is num,
        trafficSourcesAvailable:
            trafficSources['available'] == true &&
            trafficSources['sources'] is List,
        totalViews: _integer(summary['visitors']),
        totalOrders: _integer(ordersMetric['value']),
        totalProducts: _integer(summary['products']),
        averageOrderValue: _number(summary['avg_order_value']),
        ordersByStatus: ordersByStatus,
        dailyStats: dailyStats,
        topProducts: topProductRows.map(TopProduct.fromJson).toList(),
        trafficSources: asJsonList(trafficSources['sources'] ?? const [])
            .map((item) => TrafficSourceEntry.fromJson(asJsonMap(item)))
            .toList(growable: false),
        comparison: StoreAnalyticsComparison.fromGateway(
          dashboard: dashboard,
          revenue: revenue,
        ),
      );

      final payoutSummary = response['payout_summary'] is Map
          ? Map<String, dynamic>.from(response['payout_summary'] as Map)
          : null;

      return MobileDashboardSnapshot(
        analytics: _analytics!,
        payoutSummary: payoutSummary,
        providerMode: response['provider_mode']?.toString(),
      );
    } catch (e) {
      debugPrint('getMobileDashboardSnapshot error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<StoreLiveView> getLiveView(
    String storeId, {
    int windowMinutes = 15,
  }) async {
    try {
      final payload = await _api.analytics.live({
        'store_id': storeId,
        'window_minutes': windowMinutes,
      });
      _liveView = StoreLiveView.fromJson(payload);
      notifyListeners();
      return _liveView!;
    } catch (e) {
      debugPrint('getLiveView error: $e');
      rethrow;
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

int _parseInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _parseDouble(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

Map<String, dynamic> _jsonMapOrEmpty(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

DateTime? _parseDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
