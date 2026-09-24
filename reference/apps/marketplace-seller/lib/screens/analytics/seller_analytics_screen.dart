// lib/screens/seller/analytics/seller_analytics_screen.dart
// 📊 ADVANCED SELLER ANALYTICS WITH REAL CHARTS
// Line, Bar, Pie charts with Firebase data integration

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../providers/seller_provider.dart';

class SellerAnalyticsScreen extends StatefulWidget {
  const SellerAnalyticsScreen({super.key});

  @override
  State<SellerAnalyticsScreen> createState() => _SellerAnalyticsScreenState();
}

class _SellerAnalyticsScreenState extends State<SellerAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  late TabController _tabController;
  String _selectedPeriod = '7days';
  bool _isLoading = true;

  // Analytics Data
  double _totalRevenue = 0.0;
  double _previousRevenue = 0.0;
  int _totalOrders = 0;
  int _previousOrders = 0;
  int _totalCustomers = 0;
  int _previousCustomers = 0;
  double _avgOrderValue = 0.0;
  double _previousAvgOrder = 0.0;

  // Chart Data
  List<FlSpot> _revenueSpots = [];
  List<FlSpot> _ordersSpots = [];
  List<BarChartGroupData> _weeklyBars = [];
  List<PieChartSectionData> _orderStatusPie = [];
  List<PieChartSectionData> _categoryPie = [];
  List<Map<String, dynamic>> _topProducts = [];
  Map<String, int> _ordersByStatus = {};
  Map<String, double> _revenueByCategory = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadAnalyticsData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  int _getPeriodDays() {
    switch (_selectedPeriod) {
      case '7days': return 7;
      case '30days': return 30;
      case '90days': return 90;
      case 'year': return 365;
      default: return 7;
    }
  }

  Future<void> _loadAnalyticsData() async {
    final sellerId = context.read<SellerProvider>().sellerId;
    if (sellerId == null) return;

    setState(() => _isLoading = true);

    try {
      final periodDays = _getPeriodDays();
      final now = DateTime.now();
      final periodStart = now.subtract(Duration(days: periodDays));
      final previousStart = periodStart.subtract(Duration(days: periodDays));

      // Fetch orders for both periods
      final ordersQuery = await _firestore
          .collection('orders')
          .where('sellerId', isEqualTo: sellerId)
          .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(previousStart))
          .orderBy('createdAt', descending: true)
          .get();

      final currentPeriodOrders = <QueryDocumentSnapshot>[];
      final previousPeriodOrders = <QueryDocumentSnapshot>[];

      for (var doc in ordersQuery.docs) {
        final createdAt = (doc.data()['createdAt'] as Timestamp).toDate();
        if (createdAt.isAfter(periodStart)) {
          currentPeriodOrders.add(doc);
        } else {
          previousPeriodOrders.add(doc);
        }
      }

      // Calculate current period metrics
      _totalOrders = currentPeriodOrders.length;
      _totalRevenue = currentPeriodOrders.fold(
          0.0, (sum, doc) => sum + (doc.data() as Map)['total'].toDouble());
      _totalCustomers = currentPeriodOrders
          .map((doc) => (doc.data() as Map)['customerId'])
          .toSet()
          .length;
      _avgOrderValue = _totalOrders > 0 ? _totalRevenue / _totalOrders : 0;

      // Calculate previous period metrics
      _previousOrders = previousPeriodOrders.length;
      _previousRevenue = previousPeriodOrders.fold(
          0.0, (sum, doc) => sum + (doc.data() as Map)['total'].toDouble());
      _previousCustomers = previousPeriodOrders
          .map((doc) => (doc.data() as Map)['customerId'])
          .toSet()
          .length;
      _previousAvgOrder = _previousOrders > 0 ? _previousRevenue / _previousOrders : 0;

      // Build Revenue Line Chart Data
      _buildRevenueChart(currentPeriodOrders, periodDays);

      // Build Orders Line Chart Data
      _buildOrdersChart(currentPeriodOrders, periodDays);

      // Build Weekly Bar Chart
      _buildWeeklyBarChart(currentPeriodOrders);

      // Build Order Status Pie Chart
      _buildOrderStatusPie(currentPeriodOrders);

      // Build Category Revenue Pie Chart
      _buildCategoryPie(currentPeriodOrders);

      // Get Top Products
      await _loadTopProducts(sellerId);

      setState(() => _isLoading = false);
    } catch (e) {
      debugPrint('Analytics Error: $e');
      setState(() => _isLoading = false);
    }
  }

  void _buildRevenueChart(List<QueryDocumentSnapshot> orders, int days) {
    final now = DateTime.now();
    final dailyRevenue = <int, double>{};

    for (int i = 0; i < days; i++) {
      dailyRevenue[i] = 0;
    }

    for (var doc in orders) {
      final data = doc.data() as Map;
      final createdAt = (data['createdAt'] as Timestamp).toDate();
      final dayIndex = now.difference(createdAt).inDays;
      if (dayIndex >= 0 && dayIndex < days) {
        dailyRevenue[days - 1 - dayIndex] =
            (dailyRevenue[days - 1 - dayIndex] ?? 0) + (data['total'] ?? 0).toDouble();
      }
    }

    _revenueSpots = dailyRevenue.entries
        .map((e) => FlSpot(e.key.toDouble(), e.value / 1000)) // Scale to thousands
        .toList();
  }

  void _buildOrdersChart(List<QueryDocumentSnapshot> orders, int days) {
    final now = DateTime.now();
    final dailyOrders = <int, int>{};

    for (int i = 0; i < days; i++) {
      dailyOrders[i] = 0;
    }

    for (var doc in orders) {
      final createdAt = ((doc.data() as Map)['createdAt'] as Timestamp).toDate();
      final dayIndex = now.difference(createdAt).inDays;
      if (dayIndex >= 0 && dayIndex < days) {
        dailyOrders[days - 1 - dayIndex] = (dailyOrders[days - 1 - dayIndex] ?? 0) + 1;
      }
    }

    _ordersSpots = dailyOrders.entries
        .map((e) => FlSpot(e.key.toDouble(), e.value.toDouble()))
        .toList();
  }

  void _buildWeeklyBarChart(List<QueryDocumentSnapshot> orders) {
    final weeklyData = List.generate(7, (_) => 0.0);
    final now = DateTime.now();

    for (var doc in orders) {
      final createdAt = ((doc.data() as Map)['createdAt'] as Timestamp).toDate();
      final dayOfWeek = createdAt.weekday - 1; // 0 = Monday
      final daysAgo = now.difference(createdAt).inDays;
      if (daysAgo < 7) {
        weeklyData[dayOfWeek] += ((doc.data() as Map)['total'] ?? 0).toDouble();
      }
    }

    _weeklyBars = List.generate(7, (i) {
      return BarChartGroupData(
        x: i,
        barRods: [
          BarChartRodData(
            toY: weeklyData[i] / 1000,
            color: AppColors.primary,
            width: 16,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
          ),
        ],
      );
    });
  }

  void _buildOrderStatusPie(List<QueryDocumentSnapshot> orders) {
    _ordersByStatus = {};
    for (var doc in orders) {
      final status = (doc.data() as Map)['status'] ?? 'unknown';
      _ordersByStatus[status] = (_ordersByStatus[status] ?? 0) + 1;
    }

    final colors = [
      AppColors.pending,
      AppColors.processing,
      AppColors.shipped,
      AppColors.delivered,
      AppColors.cancelled,
    ];

    int colorIndex = 0;
    _orderStatusPie = _ordersByStatus.entries.map((e) {
      final color = colors[colorIndex % colors.length];
      colorIndex++;
      return PieChartSectionData(
        color: color,
        value: e.value.toDouble(),
        title: '${e.value}',
        radius: 50,
        titleStyle: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      );
    }).toList();
  }

  void _buildCategoryPie(List<QueryDocumentSnapshot> orders) {
    _revenueByCategory = {};
    for (var doc in orders) {
      final data = doc.data() as Map;
      final items = data['items'] as List? ?? [];
      for (var item in items) {
        final category = item['categoryName'] ?? 'Other';
        final price = (item['price'] ?? 0).toDouble() * (item['quantity'] ?? 1);
        _revenueByCategory[category] = (_revenueByCategory[category] ?? 0) + price;
      }
    }

    final colors = [
      AppColors.primary,
      AppColors.primaryLight,
      AppColors.secondary,
      AppColors.accent,
      AppColors.warning,
      AppColors.info,
    ];

    int colorIndex = 0;
    _categoryPie = _revenueByCategory.entries.take(5).map((e) {
      final color = colors[colorIndex % colors.length];
      colorIndex++;
      return PieChartSectionData(
        color: color,
        value: e.value,
        title: '',
        radius: 45,
      );
    }).toList();
  }

  Future<void> _loadTopProducts(String sellerId) async {
    final productsQuery = await _firestore
        .collection('products')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('totalSold', descending: true)
        .limit(5)
        .get();

    _topProducts = productsQuery.docs.map((doc) {
      final data = doc.data();
      return {
        'name': data['name'] ?? 'Unknown',
        'sold': data['totalSold'] ?? 0,
        'revenue': ((data['salePrice'] ?? 0) * (data['totalSold'] ?? 0)).toDouble(),
        'image': (data['images'] as List?)?.firstOrNull,
      };
    }).toList();
  }

  double _calculateChange(double current, double previous) {
    if (previous == 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        title: Text(
          'Analytics',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 22,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded,
                color: isDark ? AppColors.textLight : AppColors.textPrimary),
            onPressed: _loadAnalyticsData,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: _buildPeriodSelector(isDark),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _loadAnalyticsData,
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildMetricsGrid(isDark),
                    const SizedBox(height: 24),
                    _buildRevenueLineChart(isDark),
                    const SizedBox(height: 24),
                    _buildWeeklyBarChartCard(isDark),
                    const SizedBox(height: 24),
                    _buildOrderStatusChart(isDark),
                    const SizedBox(height: 24),
                    _buildCategoryRevenueChart(isDark),
                    const SizedBox(height: 24),
                    _buildTopProductsList(isDark),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildPeriodSelector(bool isDark) {
    final periods = ['7days', '30days', '90days', 'year'];
    final labels = ['7 Days', '30 Days', '90 Days', 'Year'];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: List.generate(periods.length, (i) {
          final isSelected = _selectedPeriod == periods[i];
          return Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() => _selectedPeriod = periods[i]);
                _loadAnalyticsData();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isSelected
                        ? Colors.white
                        : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildMetricsGrid(bool isDark) {
    final revenueChange = _calculateChange(_totalRevenue, _previousRevenue);
    final ordersChange = _calculateChange(_totalOrders.toDouble(), _previousOrders.toDouble());
    final customersChange = _calculateChange(_totalCustomers.toDouble(), _previousCustomers.toDouble());
    final avgChange = _calculateChange(_avgOrderValue, _previousAvgOrder);

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _buildMetricCard('Revenue', '₹${currencyFormat.format(_totalRevenue)}',
            revenueChange, AppColors.success, isDark),
        _buildMetricCard('Orders', '$_totalOrders',
            ordersChange, AppColors.info, isDark),
        _buildMetricCard('Customers', '$_totalCustomers',
            customersChange, AppColors.primary, isDark),
        _buildMetricCard('Avg. Order', '₹${currencyFormat.format(_avgOrderValue)}',
            avgChange, AppColors.warning, isDark),
      ],
    );
  }

  Widget _buildMetricCard(String title, String value, double change, Color color, bool isDark) {
    final isPositive = change >= 0;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: AppColors.shadowLight, blurRadius: 8)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            fontSize: 12,
          )),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(value, style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ), maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: (isPositive ? AppColors.success : AppColors.error).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPositive ? Icons.arrow_upward : Icons.arrow_downward,
                      size: 10,
                      color: isPositive ? AppColors.success : AppColors.error,
                    ),
                    Text(
                      '${change.abs().toStringAsFixed(0)}%',
                      style: TextStyle(
                        color: isPositive ? AppColors.success : AppColors.error,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRevenueLineChart(bool isDark) {
    return _buildChartCard('Revenue Trend', isDark, 
      child: SizedBox(
        height: 200,
        child: _revenueSpots.isEmpty
            ? _buildEmptyChart(isDark)
            : LineChart(
                LineChartData(
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    horizontalInterval: 5,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight,
                      strokeWidth: 1,
                    ),
                  ),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 40,
                        getTitlesWidget: (value, meta) => Text(
                          '₹${value.toInt()}K',
                          style: TextStyle(
                            color: isDark ? AppColors.textLightHint : AppColors.textHint,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                    bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  borderData: FlBorderData(show: false),
                  lineBarsData: [
                    LineChartBarData(
                      spots: _revenueSpots,
                      isCurved: true,
                      color: AppColors.primary,
                      barWidth: 3,
                      isStrokeCapRound: true,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary.withValues(alpha: 0.3),
                            AppColors.primary.withValues(alpha: 0.0),
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildWeeklyBarChartCard(bool isDark) {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return _buildChartCard('Weekly Revenue', isDark,
      child: SizedBox(
        height: 200,
        child: _weeklyBars.isEmpty
            ? _buildEmptyChart(isDark)
            : BarChart(
                BarChartData(
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) => Text(
                          days[value.toInt()],
                          style: TextStyle(
                            color: isDark ? AppColors.textLightHint : AppColors.textHint,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                  ),
                  barGroups: _weeklyBars,
                ),
              ),
      ),
    );
  }

  Widget _buildOrderStatusChart(bool isDark) {
    return _buildChartCard('Order Status', isDark,
      child: Row(
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: _orderStatusPie.isEmpty
                ? _buildEmptyChart(isDark)
                : PieChart(
                    PieChartData(
                      sections: _orderStatusPie,
                      centerSpaceRadius: 25,
                      sectionsSpace: 2,
                    ),
                  ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _ordersByStatus.entries.map((e) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        width: 10, height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.getOrderStatusColor(e.key),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${e.key.capitalize()} (${e.value})',
                        style: TextStyle(
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryRevenueChart(bool isDark) {
    return _buildChartCard('Revenue by Category', isDark,
      child: Row(
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: _categoryPie.isEmpty
                ? _buildEmptyChart(isDark)
                : PieChart(
                    PieChartData(
                      sections: _categoryPie,
                      centerSpaceRadius: 30,
                      sectionsSpace: 2,
                    ),
                  ),
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _revenueByCategory.entries.take(5).map((e) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        e.key,
                        style: TextStyle(
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        '₹${currencyFormat.format(e.value)}',
                        style: TextStyle(
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopProductsList(bool isDark) {
    return _buildChartCard('Top Selling Products', isDark,
      child: Column(
        children: _topProducts.isEmpty
            ? [_buildEmptyChart(isDark)]
            : _topProducts.asMap().entries.map((entry) {
                final product = entry.value;
                final index = entry.key;
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(
                          child: Text(
                            '#${index + 1}',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product['name'],
                              style: TextStyle(
                                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              '${product['sold']} sold',
                              style: TextStyle(
                                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '₹${currencyFormat.format(product['revenue'])}',
                        style: const TextStyle(
                          color: AppColors.success,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
      ),
    );
  }

  Widget _buildChartCard(String title, bool isDark, {required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.shadowLight, blurRadius: 10)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildEmptyChart(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.insights_rounded,
              size: 40, color: isDark ? AppColors.textLightDisabled : AppColors.textDisabled),
          const SizedBox(height: 8),
          Text(
            'No data available',
            style: TextStyle(
              color: isDark ? AppColors.textLightHint : AppColors.textHint,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }
}
