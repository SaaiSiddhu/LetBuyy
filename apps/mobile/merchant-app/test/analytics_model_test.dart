import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/analytics_service.dart';

void main() {
  test('StoreAnalytics parses gateway-shaped dashboard data', () {
    final analytics = StoreAnalytics.fromJson({
      'totalRevenue': 1299.50,
      'totalOrders': 12,
      'totalProducts': 4,
      'averageOrderValue': 108.29,
      'ordersByStatus': {'paid': 9, 'pending': 3},
      'dailyStats': [
        {'date': '2026-06-01', 'revenue': 499, 'orders': 5, 'views': 0},
      ],
      'topProducts': [
        {'id': 'prod_1', 'name': 'Cotton Tee', 'total_sold': 7, 'revenue': 899},
      ],
    });

    expect(analytics.totalRevenue, 1299.50);
    expect(analytics.ordersByStatus['paid'], 9);
    expect(analytics.dailyStats.single.orders, 5);
    expect(analytics.topProducts.single.orders, 7);
  });
}
