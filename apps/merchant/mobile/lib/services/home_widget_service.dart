import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/store_model.dart';
import 'analytics_service.dart';

class HomeWidgetSnapshot {
  static const storeIdKey = 'letbuyy.widget.store_id';
  static const storeNameKey = 'letbuyy.widget.store_name';
  static const revenueKey = 'letbuyy.widget.revenue';
  static const ordersKey = 'letbuyy.widget.orders';
  static const productsKey = 'letbuyy.widget.products';
  static const visitorsKey = 'letbuyy.widget.visitors';
  static const averageOrderValueKey = 'letbuyy.widget.average_order_value';
  static const openOrdersKey = 'letbuyy.widget.open_orders';
  static const updatedAtKey = 'letbuyy.widget.updated_at';

  final String storeId;
  final String storeName;
  final double revenue;
  final int orders;
  final int products;
  final int visitors;
  final double averageOrderValue;
  final int openOrders;
  final DateTime updatedAt;

  const HomeWidgetSnapshot({
    required this.storeId,
    required this.storeName,
    required this.revenue,
    required this.orders,
    required this.products,
    required this.visitors,
    required this.averageOrderValue,
    required this.openOrders,
    required this.updatedAt,
  });

  factory HomeWidgetSnapshot.fromStoreAnalytics({
    required StoreModel store,
    required StoreAnalytics analytics,
    DateTime? updatedAt,
  }) {
    return HomeWidgetSnapshot(
      storeId: store.id,
      storeName: store.name,
      revenue: analytics.totalRevenue,
      orders: analytics.totalOrders,
      products: analytics.totalProducts,
      visitors: analytics.totalViews,
      averageOrderValue: analytics.averageOrderValue,
      openOrders: _openOrderCount(analytics.ordersByStatus),
      updatedAt: updatedAt ?? DateTime.now().toUtc(),
    );
  }

  Map<String, Object> toPlatformPayload() => {
    storeIdKey: storeId,
    storeNameKey: storeName,
    revenueKey: revenue,
    ordersKey: orders,
    productsKey: products,
    visitorsKey: visitors,
    averageOrderValueKey: averageOrderValue,
    openOrdersKey: openOrders,
    updatedAtKey: updatedAt.toIso8601String(),
  };

  Future<void> save(SharedPreferences prefs) async {
    await prefs.setString(storeIdKey, storeId);
    await prefs.setString(storeNameKey, storeName);
    await prefs.setDouble(revenueKey, revenue);
    await prefs.setInt(ordersKey, orders);
    await prefs.setInt(productsKey, products);
    await prefs.setInt(visitorsKey, visitors);
    await prefs.setDouble(averageOrderValueKey, averageOrderValue);
    await prefs.setInt(openOrdersKey, openOrders);
    await prefs.setString(updatedAtKey, updatedAt.toIso8601String());
  }

  static int _openOrderCount(Map<String, int> statuses) {
    const openStatuses = {'pending', 'processing', 'confirmed', 'packed'};
    return statuses.entries
        .where((entry) => openStatuses.contains(entry.key.toLowerCase()))
        .fold<int>(0, (sum, entry) => sum + entry.value);
  }
}

class HomeWidgetService {
  static const MethodChannel defaultChannel = MethodChannel(
    'com.letbuyy.store/home_widgets',
  );

  final MethodChannel _channel;

  const HomeWidgetService({MethodChannel channel = defaultChannel})
    : _channel = channel;

  Future<HomeWidgetSnapshot> publishDashboardSnapshot({
    required StoreModel store,
    required StoreAnalytics analytics,
    DateTime? updatedAt,
  }) async {
    final snapshot = HomeWidgetSnapshot.fromStoreAnalytics(
      store: store,
      analytics: analytics,
      updatedAt: updatedAt,
    );
    final prefs = await SharedPreferences.getInstance();
    await snapshot.save(prefs);

    try {
      await _channel.invokeMethod<void>(
        'publishMetricsSnapshot',
        snapshot.toPlatformPayload(),
      );
    } on MissingPluginException {
      // Native widgets are not present in Flutter unit tests and some dev builds.
    } on PlatformException catch (error) {
      debugPrint('Home widget refresh unavailable: ${error.code}');
    }

    return snapshot;
  }
}
