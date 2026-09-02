// lib/screens/admin/analytics/analytics_screen.dart

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:shimmer/shimmer.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../../providers/admin_provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'widgets/analytics_card.dart';
import 'widgets/revenue_chart.dart';
import 'widgets/orders_chart.dart';
import 'widgets/top_products_list.dart';
import 'widgets/kpi_grid.dart';
import 'widgets/sales_funnel.dart';
import 'widgets/heat_map_calendar.dart';
import 'widgets/comparison_widget.dart';
import 'widgets/export_button.dart';

enum RangeKey { 
  day7, 
  day30, 
  day90, 
  month6, 
  year1, 
  custom 
}

enum ComparisonMode { 
  none, 
  previous, 
  yearAgo 
}

extension RangeKeyExtension on RangeKey {
  String get label {
    switch (this) {
      case RangeKey.day7: return '7 Days';
      case RangeKey.day30: return '30 Days';
      case RangeKey.day90: return '90 Days';
      case RangeKey.month6: return '6 Months';
      case RangeKey.year1: return '1 Year';
      case RangeKey.custom: return 'Custom';
    }
  }

  int get days {
    switch (this) {
      case RangeKey.day7: return 7;
      case RangeKey.day30: return 30;
      case RangeKey.day90: return 90;
      case RangeKey.month6: return 180;
      case RangeKey.year1: return 365;
      case RangeKey.custom: return 30;
    }
  }
}

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  RangeKey selectedRange = RangeKey.day30;
  ComparisonMode comparisonMode = ComparisonMode.none;
  bool isLoading = false;
  bool showAdvanced = false;
  DateTime? lastRefresh;

  final ScrollController scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      loadData();
    });
  }

  @override
  void dispose() {
    scrollController.dispose();
    super.dispose();
  }

  Future<void> loadData() async {
    if (!mounted) return;
    
    setState(() {
      isLoading = true;
    });

    try {
      final adminProvider = Provider.of<AdminProvider>(context, listen: false);
      
      // Just load admin stats - OrderProvider is already listening to orders
      await adminProvider.loadDashboardStats();
    } catch (e) {
      debugPrint('Error loading analytics data: $e');
    }

    if (!mounted) return;

    setState(() {
      isLoading = false;
      lastRefresh = DateTime.now();
    });
  }

  bool get isMobile => MediaQuery.of(context).size.width < 600;
  bool get isTablet => MediaQuery.of(context).size.width >= 600 && 
                       MediaQuery.of(context).size.width < 1200;
  bool get isDesktop => MediaQuery.of(context).size.width >= 1200;

  int get crossAxisCount {
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 4;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        title: Text(
          'Analytics Dashboard',
          style: AppTextStyles.headlineSmall.copyWith(
            color: isDark ? AppColors.textPrimary : AppColors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
        backgroundColor: accentColor,
        elevation: 0,
        actions: [
          if (lastRefresh != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Updated: ${formatLastRefresh()}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textLight : AppColors.white,
                  ),
                ),
              ),
            ),
          ExportButton(
            onExport: handleExport,
            isDark: isDark,
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: showSettingsDialog,
            tooltip: 'Settings',
          ),
        ],
      ),
      body: isLoading && lastRefresh == null
          ? buildLoadingState(isDark)
          : RefreshIndicator(
              onRefresh: loadData,
              child: Consumer2<AdminProvider, OrderProvider>(
                builder: (context, adminProvider, orderProvider, child) {
                  final analytics = computeAnalytics(
                    adminProvider, 
                    orderProvider, 
                    isDark
                  );

                  return CustomScrollView(
                    controller: scrollController,
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      // Filters
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: buildCompactFilter(isDark, accentColor),
                        ).animate().fadeIn(duration: 300.ms).slideX(begin: -0.1),
                      ),

                      // Metrics Carousel (Mobile/Tablet)
                      if (!isDesktop)
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: buildMetricsCarousel(analytics, isDark, accentColor),
                          ),
                        ),

                      // KPI Grid (Desktop)
                      if (isDesktop)
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          sliver: SliverGrid(
                            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: crossAxisCount,
                              crossAxisSpacing: 16,
                              mainAxisSpacing: 16,
                              childAspectRatio: 1.5,
                            ),
                            delegate: SliverChildListDelegate([
                              AnalyticsCard(
                                title: 'Revenue',
                                value: NumberFormat.currency(
                                  symbol: '₹',
                                  decimalDigits: 0,
                                ).format(analytics.totalRevenue),
                                icon: Icons.currency_rupee_rounded,
                                color: AppColors.success,
                                isDark: isDark,
                                trend: analytics.revenueTrend,
                              ),
                              AnalyticsCard(
                                title: 'Orders',
                                value: NumberFormat.compact().format(analytics.totalOrders),
                                icon: Icons.shopping_cart_rounded,
                                color: AppColors.info,
                                isDark: isDark,
                              ),
                              AnalyticsCard(
                                title: 'Customers',
                                value: NumberFormat.compact().format(analytics.totalCustomers),
                                icon: Icons.people_rounded,
                                color: AppColors.warning,
                                isDark: isDark,
                              ),
                              AnalyticsCard(
                                title: 'AOV',
                                value: NumberFormat.currency(
                                  symbol: '₹',
                                  decimalDigits: 0,
                                ).format(analytics.avgOrderValue),
                                icon: Icons.trending_up_rounded,
                                color: AppColors.processing,
                                isDark: isDark,
                                trend: analytics.aovTrend,
                              ),
                            ]),
                          ),
                        ),

                      // Charts
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              // Revenue Chart
                              RevenueChart(
                                timeSeries: analytics.timeSeries,
                                selectedRange: selectedRange,
                                comparisonMode: comparisonMode,
                                isDark: isDark,
                                height: 350,
                                showPrediction: true,
                              ),

                              const SizedBox(height: 16),

                              // Orders Chart
                              OrdersChart(
                                orderStats: analytics.orderStats,
                                isDark: isDark,
                              ),

                              const SizedBox(height: 16),

                              // Comparison Widget
                              if (comparisonMode != ComparisonMode.none)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: ComparisonWidget(
                                    currentData: analytics.timeSeries,
                                    comparisonMode: comparisonMode,
                                    isDark: isDark,
                                  ),
                                ),

                              // Product Analytics
                              if (analytics.topProducts.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: TopProductsList(
                                    products: analytics.topProducts,
                                    isDark: isDark,
                                  ),
                                ),

                              // Sales Funnel
                              SalesFunnel(
                                funnelData: {
                                  'visitors': analytics.totalCustomers,
                                },
                                isDark: isDark,
                              ),

                              const SizedBox(height: 16),

                              // Heat Map Calendar
                              HeatMapCalendar(
                                activityData: _generateHeatMapData(orderProvider.orders),
                                isDark: isDark,
                              ),

                              const SizedBox(height: 16),

                              // KPI Grid
                              KPIGrid(
                                kpiData: {
                                  'conversionRate': 3.2,
                                  'avgOrderValue': analytics.avgOrderValue,
                                  'customerLTV': analytics.revenuePerCustomer * 3,
                                  'cartAbandonment': 68.5,
                                  'activeUsers': analytics.totalCustomers,
                                  'returnRate': 2.1,
                                  'repeatRate': 28.4,
                                  'revenuePerCustomer': analytics.revenuePerCustomer,
                                },
                                isDark: isDark,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
      floatingActionButton: buildFloatingActions(isDark, accentColor),
    );
  }

  Widget buildCompactFilter(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<RangeKey>(
                value: selectedRange,
                isDense: true,
                isExpanded: true,
                items: RangeKey.values
                    .where((r) => r != RangeKey.custom)
                    .map((range) {
                  return DropdownMenuItem(
                    value: range,
                    child: Text(range.label),
                  );
                }).toList(),
                onChanged: (range) {
                  if (range != null) {
                    setState(() {
                      selectedRange = range;
                    });
                  }
                },
              ),
            ),
          ),
          VerticalDivider(
            color: isDark ? AppColors.borderDark : AppColors.border,
            width: 1,
          ),
          IconButton(
            icon: Icon(
              comparisonMode != ComparisonMode.none
                  ? Icons.compare_arrows_rounded
                  : Icons.check_circle_rounded,
              color: comparisonMode != ComparisonMode.none ? accentColor : null,
            ),
            onPressed: () {
              setState(() {
                comparisonMode = comparisonMode == ComparisonMode.none
                    ? ComparisonMode.previous
                    : ComparisonMode.none;
              });
            },
            tooltip: 'Compare periods',
          ),
        ],
      ),
    );
  }

  Widget buildMetricsCarousel(
    AnalyticsData analytics,
    bool isDark,
    Color accentColor,
  ) {
    final metrics = [
      MetricCard(
        'Revenue',
        analytics.totalRevenue,
        Icons.currency_rupee_rounded,
        AppColors.success,
      ),
      MetricCard(
        'Orders',
        analytics.totalOrders.toDouble(),
        Icons.shopping_cart_rounded,
        AppColors.info,
      ),
      MetricCard(
        'Customers',
        analytics.totalCustomers.toDouble(),
        Icons.people_rounded,
        AppColors.warning,
      ),
      MetricCard(
        'AOV',
        analytics.avgOrderValue,
        Icons.trending_up_rounded,
        AppColors.processing,
      ),
    ];

    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: metrics.length,
        itemBuilder: (context, index) {
          final metric = metrics[index];
          return Container(
            width: 160,
            margin: const EdgeInsets.only(right: 12),
            child: AnalyticsCard(
              title: metric.title,
              value: metric.title == 'Orders' || metric.title == 'Customers'
                  ? NumberFormat.compact().format(metric.value)
                  : NumberFormat.currency(symbol: '₹', decimalDigits: 0)
                      .format(metric.value),
              icon: metric.icon,
              color: metric.color,
              isDark: isDark,
              compact: true,
              child: const SizedBox.shrink(),
            ),
          );
        },
      ),
    );
  }

  Widget buildFloatingActions(bool isDark, Color accentColor) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (scrollController.hasClients && scrollController.offset > 500)
          FloatingActionButton.small(
            heroTag: 'scroll-top',
            onPressed: () {
              scrollController.animateTo(
                0,
                duration: const Duration(milliseconds: 500),
                curve: Curves.easeInOut,
              );
            },
            backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
            child: Icon(
              Icons.arrow_upward_rounded,
              color: accentColor,
            ),
          ).animate().fadeIn().scale(),
        const SizedBox(height: 12),
        FloatingActionButton(
          onPressed: isLoading ? null : loadData,
          backgroundColor: accentColor,
          child: Icon(
            Icons.refresh_rounded,
            color: isDark ? AppColors.textPrimary : AppColors.white,
          ),
        ),
      ],
    );
  }

  void handleExport(String format) async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Exporting analytics as $format...'),
        action: SnackBarAction(
          label: 'VIEW',
          onPressed: () {},
        ),
      ),
    );
  }

  void showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Analytics Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              title: const Text('Auto-refresh'),
              value: true,
              onChanged: (value) {},
            ),
            SwitchListTile(
              title: const Text('Show predictions'),
              value: true,
              onChanged: (value) {},
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CLOSE'),
          ),
        ],
      ),
    );
  }

  Widget buildLoadingState(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.surfaceDarkVariant : AppColors.shimmerBase,
      highlightColor: isDark ? AppColors.surfaceDarkContainer : AppColors.shimmerHighlight,
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.5,
              ),
              itemCount: crossAxisCount,
              itemBuilder: (context, i) => Container(
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              height: 350,
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              height: 300,
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  AnalyticsData computeAnalytics(
    AdminProvider adminProvider,
    OrderProvider orderProvider,
    bool isDark,
  ) {
    final orders = orderProvider.orders;
    final days = selectedRange.days;

    final ts = generateTimeSeries(orders, days);
    final orderStats = orderProvider.getOrderStatistics();
    final adminStats = adminProvider.dashboardStats;

    final deliveredOrders = orders.where((o) => o.isDelivered).toList();
    final totalRevenue = deliveredOrders.fold<double>(
      0.0,
      (sum, order) => sum + order.total,
    );

    final avgOrderValue = deliveredOrders.isEmpty
        ? 0.0
        : totalRevenue / deliveredOrders.length;

    final topProducts = calculateTopProducts(orders, days);

    return AnalyticsData(
      timeSeries: ts,
      orderStats: orderStats,
      totalRevenue: totalRevenue,
      totalOrders: orderStats['total'] ?? 0,
      totalCustomers: adminStats['users'] ?? 0,
      totalProducts: adminStats['products'] ?? 0,
      avgOrderValue: avgOrderValue,
      revenuePerCustomer: (adminStats['users'] ?? 0) > 0
          ? totalRevenue / (adminStats['users'] ?? 1)
          : 0.0,
      topProducts: topProducts,
      revenueTrend: calculateTrend(orders, days, 'revenue'),
      aovTrend: calculateTrend(orders, days, 'aov'),
      rpcTrend: calculateTrend(orders, days, 'rpc'),
    );
  }

  List<ProductAnalytics> calculateTopProducts(
    List<OrderModel> orders,
    int days,
  ) {
    final now = DateTime.now();
    final startDate = now.subtract(Duration(days: days));

    final filteredOrders = orders.where((order) {
      return order.createdAt.isAfter(startDate) &&
          order.createdAt.isBefore(now);
    }).toList();

    final Map<String, ProductAnalytics> productMap = {};

    for (final order in filteredOrders) {
      for (final item in order.items) {
        final productId = item.productId;

        if (productMap.containsKey(productId)) {
          final existing = productMap[productId]!;
          productMap[productId] = ProductAnalytics(
            id: existing.id,
            name: existing.name,
            imageUrl: existing.imageUrl,
            revenue: existing.revenue + (item.price * item.quantity),
            unitsSold: existing.unitsSold + item.quantity,
          );
        } else {
          productMap[productId] = ProductAnalytics(
            id: productId,
            name: item.productName,
            imageUrl: item.imageUrl,
            revenue: item.price * item.quantity,
            unitsSold: item.quantity,
          );
        }
      }
    }

    final products = productMap.values.toList();
    products.sort((a, b) => b.revenue.compareTo(a.revenue));

    return products.take(20).toList();
  }

  double calculateTrend(List<OrderModel> orders, int days, String metric) {
    final now = DateTime.now();
    final currentStart = now.subtract(Duration(days: days));
    final previousStart = currentStart.subtract(Duration(days: days));

    final currentOrders = orders
        .where((o) =>
            o.createdAt.isAfter(currentStart) && o.isDelivered)
        .toList();

    final previousOrders = orders
        .where((o) =>
            o.createdAt.isAfter(previousStart) &&
            o.createdAt.isBefore(currentStart) &&
            o.isDelivered)
        .toList();

    double currentValue = 0;
    double previousValue = 0;

    switch (metric) {
      case 'revenue':
        currentValue = currentOrders.fold(0.0, (sum, o) => sum + o.total);
        previousValue = previousOrders.fold(0.0, (sum, o) => sum + o.total);
        break;
      case 'aov':
        currentValue = currentOrders.isEmpty
            ? 0
            : currentOrders.fold(0.0, (sum, o) => sum + o.total) /
                currentOrders.length;
        previousValue = previousOrders.isEmpty
            ? 0
            : previousOrders.fold(0.0, (sum, o) => sum + o.total) /
                previousOrders.length;
        break;
      case 'rpc':
        currentValue = currentOrders.fold(0.0, (sum, o) => sum + o.total);
        previousValue = previousOrders.fold(0.0, (sum, o) => sum + o.total);
        break;
    }

    if (previousValue == 0) return 0.0;

    return ((currentValue - previousValue) / previousValue) * 100;
  }

  TimeSeriesResult generateTimeSeries(List<OrderModel> orders, int days) {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: days - 1));

    final Map<String, double> map = {};

    DateTime cursor = start;
    while (!cursor.isAfter(now)) {
      map[_dateKey(cursor)] = 0.0;
      cursor = cursor.add(const Duration(days: 1));
    }

    for (final order in orders) {
      if (!order.isDelivered) continue;

      final dt = order.createdAt;
      if (dt.isBefore(start) || dt.isAfter(now)) continue;

      final key = _dateKey(dt);
      if (map.containsKey(key)) {
        map[key] = (map[key] ?? 0) + order.total;
      }
    }

    final spots = <FlSpot>[];
    final labels = <String>[];
    int idx = 0;

    for (final entry in map.entries) {
      spots.add(FlSpot(idx.toDouble(), entry.value));
      labels.add(entry.key);
      idx++;
    }

    final total = spots.fold(0.0, (p, s) => p + s.y);
    final avg = days > 0 ? total / days : 0.0;
    final maxY = spots.isEmpty ? 0.0 : spots.map((s) => s.y).reduce(max);

    return TimeSeriesResult(
      spots: spots,
      labels: labels,
      total: total,
      average: avg,
      maxY: maxY,
      startDate: start,
      endDate: now,
    );
  }

  Map<DateTime, double> _generateHeatMapData(List<OrderModel> orders) {
    final Map<DateTime, double> data = {};
    final now = DateTime.now();
    
    for (int i = 0; i < 90; i++) {
      final date = DateTime(now.year, now.month, now.day).subtract(Duration(days: i));
      data[date] = 0.0;
    }

    for (final order in orders) {
      final date = DateTime(
        order.createdAt.year,
        order.createdAt.month,
        order.createdAt.day,
      );
      
      if (data.containsKey(date)) {
        data[date] = (data[date] ?? 0) + order.total;
      }
    }

    return data;
  }

  String formatLastRefresh() {
    if (lastRefresh == null) return '';

    final now = DateTime.now();
    final diff = now.difference(lastRefresh!);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  static String _dateKey(DateTime dt) {
    final d = DateTime(dt.year, dt.month, dt.day);
    return DateFormat('yyyy-MM-dd').format(d);
  }
}

// Data models
class AnalyticsData {
  final TimeSeriesResult timeSeries;
  final Map<String, int> orderStats;
  final double totalRevenue;
  final int totalOrders;
  final int totalCustomers;
  final int totalProducts;
  final double avgOrderValue;
  final double revenuePerCustomer;
  final List<ProductAnalytics> topProducts;
  final double revenueTrend;
  final double aovTrend;
  final double rpcTrend;

  AnalyticsData({
    required this.timeSeries,
    required this.orderStats,
    required this.totalRevenue,
    required this.totalOrders,
    required this.totalCustomers,
    required this.totalProducts,
    required this.avgOrderValue,
    required this.revenuePerCustomer,
    required this.topProducts,
    required this.revenueTrend,
    required this.aovTrend,
    required this.rpcTrend,
  });
}

class TimeSeriesResult {
  final List<FlSpot> spots;
  final List<String> labels;
  final double total;
  final double average;
  final double maxY;
  final DateTime startDate;
  final DateTime endDate;

  TimeSeriesResult({
    required this.spots,
    required this.labels,
    required this.total,
    required this.average,
    required this.maxY,
    required this.startDate,
    required this.endDate,
  });
}

class ProductAnalytics {
  final String id;
  final String name;
  final double revenue;
  final int unitsSold;
  final String imageUrl;

  ProductAnalytics({
    required this.id,
    required this.name,
    required this.revenue,
    required this.unitsSold,
    required this.imageUrl,
  });
}

class MetricCard {
  final String title;
  final double value;
  final IconData icon;
  final Color color;

  MetricCard(this.title, this.value, this.icon, this.color);
}
