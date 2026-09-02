// lib/screens/admin/admin_dashboard.dart

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:fl_chart/fl_chart.dart';

// App Theme & Providers
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart'; // Uses shared AppColors
import '../../providers/auth_provider.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

// Routes
import 'products/add_product_screen.dart';
import 'orders/order_management_screen.dart';

// Performance Utils
import '../../utils/performance_utils.dart';

// ==============================================================================
// 🧠 ADVANCED ANALYTICS DATA MODEL
// ==============================================================================

class DashboardAnalytics {
  final double totalRevenue;
  final double previousRevenue;
  final int totalOrders;
  final int previousOrders;
  final double aov;
  final double returnRate;
  final double netProfit;
  final double conversionRate;
  final double cartAbandonmentRate;
  
  final Map<int, double> chartData;
  final Map<int, double> ordersChartData;
  final Map<String, int> orderStatusCounts;
  
  final List<ProductPerformance> topProducts;
  final List<CategoryPerformance> topCategories;
  final List<RevenueByHour> hourlyRevenue;
  
  final int activeCoupons;
  final int totalCouponUsage;
  final double couponSavings;
  final int lowStockItems;
  final int outOfStockItems;
  final int newCustomers;
  final int returningCustomers;
  final double customerRetentionRate;
  final List<QueryDocumentSnapshot> recentOrders;
  final Map<String, double> paymentMethods;
  final Map<String, int> topLocations;
  
  // NEW KPI FIELDS
  final int activeSellers;
  final int activeUsers;
  final int productsLive;
  final double platformCommission;
  final double adsRevenue;
  final int todayOrders;
  final int monthOrders;
  final double todayGMV;
  final double monthGMV;

  DashboardAnalytics({
    required this.totalRevenue,
    required this.previousRevenue,
    required this.totalOrders,
    required this.previousOrders,
    required this.aov,
    required this.returnRate,
    required this.netProfit,
    required this.conversionRate,
    required this.cartAbandonmentRate,
    required this.chartData,
    required this.ordersChartData,
    required this.orderStatusCounts,
    required this.topProducts,
    required this.topCategories,
    required this.hourlyRevenue,
    required this.activeCoupons,
    required this.totalCouponUsage,
    required this.couponSavings,
    required this.lowStockItems,
    required this.outOfStockItems,
    required this.newCustomers,
    required this.returningCustomers,
    required this.customerRetentionRate,
    required this.recentOrders,
    required this.paymentMethods,
    required this.topLocations,
    // NEW KPI (optional with defaults)
    this.activeSellers = 0,
    this.activeUsers = 0,
    this.productsLive = 0,
    this.platformCommission = 0,
    this.adsRevenue = 0,
    this.todayOrders = 0,
    this.monthOrders = 0,
    this.todayGMV = 0,
    this.monthGMV = 0,
  });

  factory DashboardAnalytics.empty() {
    return DashboardAnalytics(
      totalRevenue: 0, previousRevenue: 0, totalOrders: 0, previousOrders: 0,
      aov: 0, returnRate: 0, netProfit: 0, conversionRate: 0, cartAbandonmentRate: 0,
      chartData: {}, ordersChartData: {}, orderStatusCounts: {},
      topProducts: [], topCategories: [], hourlyRevenue: [],
      activeCoupons: 0, totalCouponUsage: 0, couponSavings: 0,
      lowStockItems: 0, outOfStockItems: 0, newCustomers: 0, returningCustomers: 0,
      customerRetentionRate: 0, recentOrders: [], paymentMethods: {}, topLocations: {},
      activeSellers: 0, activeUsers: 0, productsLive: 0, platformCommission: 0,
      adsRevenue: 0, todayOrders: 0, monthOrders: 0, todayGMV: 0, monthGMV: 0,
    );
  }
}

class ProductPerformance {
  final String name;
  final int quantitySold;
  final double revenue;
  final double profitMargin;
  final int views;
  ProductPerformance(this.name, this.quantitySold, this.revenue, this.profitMargin, this.views);
}

class CategoryPerformance {
  final String name;
  final double value;
  final double percentage;
  final int itemCount;
  CategoryPerformance(this.name, this.value, this.percentage, this.itemCount);
}

class CategoryStats {
  double revenue;
  int itemCount;
  CategoryStats(this.revenue, this.itemCount);
}

class RevenueByHour {
  final int hour;
  final double revenue;
  final int orders;
  RevenueByHour(this.hour, this.revenue, this.orders);
}

// ==============================================================================
// 🖥️ ADVANCED ADMIN DASHBOARD SCREEN
// ==============================================================================

enum TimeRange { today, week, month, quarter, year, custom }
enum ChartType { revenue, orders, profit, customers }

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({super.key});

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> with TickerProviderStateMixin {
  TimeRange _selectedTimeRange = TimeRange.week;
  ChartType _selectedChartType = ChartType.revenue;
  late AnimationController _pulseController;
  late AnimationController _shimmerController;
  // ignore: unused_field - reserved for comparison feature toggle
  final bool _showComparison = true;
  DateTime? _customStartDate;
  DateTime? _customEndDate;

  @override
  void initState() {
    super.initState();
    
    // Check if running on mobile web to reduce animations
    final isMobileWeb = PerformanceUtils.isMobileWeb;
    
    _pulseController = AnimationController(
      vsync: this, 
      duration: const Duration(seconds: 2)
    );
    // Only run pulse animation on non-mobile-web
    if (!isMobileWeb) _pulseController.repeat(reverse: true);
    
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500)
    );
    // Only run shimmer animation on non-mobile-web
    if (!isMobileWeb) _shimmerController.repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  // 📅 Advanced Date Range Logic
  DateTime get _startDate {
    if (_selectedTimeRange == TimeRange.custom && _customStartDate != null) {
      return _customStartDate!;
    }
    
    final now = DateTime.now();
    switch (_selectedTimeRange) {
      case TimeRange.today: 
        return DateTime(now.year, now.month, now.day);
      case TimeRange.week: 
        return now.subtract(const Duration(days: 6));
      case TimeRange.month: 
        return now.subtract(const Duration(days: 29));
      case TimeRange.quarter: 
        return now.subtract(const Duration(days: 89));
      case TimeRange.year: 
        return now.subtract(const Duration(days: 364));
      case TimeRange.custom:
        return now.subtract(const Duration(days: 29));
    }
  }

  DateTime get _endDate {
    if (_selectedTimeRange == TimeRange.custom && _customEndDate != null) {
      return _customEndDate!;
    }
    return DateTime.now();
  }

  // ⚙️ ADVANCED DATA PROCESSING ENGINE
  DashboardAnalytics _processData(
    List<QueryDocumentSnapshot> orders, 
    List<QueryDocumentSnapshot> products,
    List<QueryDocumentSnapshot> coupons,
    int activeSellersCount,
    int activeUsersCount,
  ) {
    final start = _startDate;
    final end = _endDate;
    final duration = end.difference(start);
    final prevStart = start.subtract(duration);

    double revenue = 0, prevRevenue = 0, profit = 0;
    int count = 0, prevCount = 0;
    int cancelledCount = 0, returnedCount = 0;
    
    Map<String, int> statuses = {
      'pending': 0, 'confirmed': 0, 'processing': 0, 
      'shipped': 0, 'delivered': 0, 'cancelled': 0, 'returned': 0
    };
    
    Map<int, double> chartPoints = {};
    Map<int, double> orderPoints = {};
    Map<int, double> hourlyRev = {};
    Map<int, int> hourlyOrders = {};
    
    int points = _selectedTimeRange == TimeRange.today ? 24 : 
                 (_selectedTimeRange == TimeRange.year ? 12 : 
                 (_selectedTimeRange == TimeRange.quarter ? 12 : 7));
    
    for(int i=0; i<points; i++) {
      chartPoints[i] = 0.0;
      orderPoints[i] = 0.0;
    }
    
    for(int i=0; i<24; i++) {
      hourlyRev[i] = 0.0;
      hourlyOrders[i] = 0;
    }

    Map<String, ProductPerformance> prodStats = {};
    Map<String, CategoryStats> catStats = {};
    Map<String, int> custFreq = {};
    Map<String, double> paymentMethods = {};
    Map<String, int> locations = {};
    double couponDiscounts = 0;
    
    // NEW KPI tracking
    int todayOrderCount = 0, monthOrderCount = 0;
    double todayGMVAmount = 0, monthGMVAmount = 0;
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final monthStart = DateTime(now.year, now.month, 1);

    for (var doc in orders) {
      final data = doc.data() as Map<String, dynamic>;
      final ts = data['createdAt'] as Timestamp?;
      if (ts == null) continue;
      final date = ts.toDate();
      final status = (data['orderStatus'] ?? 'pending').toString().toLowerCase();
      final total = (data['total'] ?? 0).toDouble();
      final userId = data['userId'] ?? 'Guest';
      final paymentMethod = data['paymentMethod']?.toString() ?? 'COD';
      final location = data['location']?.toString() ?? 'Unknown';

      custFreq[userId] = (custFreq[userId] ?? 0) + 1;
      
      paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] ?? 0) + total;
      locations[location] = (locations[location] ?? 0) + 1;
      
      // Track today/month KPIs
      if (date.isAfter(todayStart) || date.isAtSameMomentAs(todayStart)) {
        todayOrderCount++;
        todayGMVAmount += total;
      }
      if (date.isAfter(monthStart) || date.isAtSameMomentAs(monthStart)) {
        monthOrderCount++;
        monthGMVAmount += total;
      }
      locations[location] = (locations[location] ?? 0) + 1;
      
      if (data['couponDiscount'] != null) {
        couponDiscounts += (data['couponDiscount'] as num).toDouble();
      }

      if (date.isAfter(start) && date.isBefore(end.add(const Duration(days: 1)))) {
        if (statuses.containsKey(status)) statuses[status] = statuses[status]! + 1;

        hourlyRev[date.hour] = (hourlyRev[date.hour] ?? 0) + total;
        hourlyOrders[date.hour] = (hourlyOrders[date.hour] ?? 0) + 1;

        if (status == 'cancelled') {
          cancelledCount++;
        } else if (status == 'returned') {
          returnedCount++;
        } else {
          revenue += total;
          profit += total * 0.25;
          count++;
          
          int xIndex;
          if (_selectedTimeRange == TimeRange.today) {
            xIndex = date.hour;
          } else if (_selectedTimeRange == TimeRange.year) {
            xIndex = date.month - 1;
          } else if (_selectedTimeRange == TimeRange.quarter) {
            xIndex = (date.difference(start).inDays / 7).floor();
            if (xIndex >= 12) xIndex = 11;
          } else {
            xIndex = date.difference(start).inDays;
            if (xIndex < 0) xIndex = 0;
            if (xIndex >= points) xIndex = points - 1;
          }
          
          chartPoints[xIndex] = (chartPoints[xIndex] ?? 0) + total;
          orderPoints[xIndex] = (orderPoints[xIndex] ?? 0) + 1;

          if (data['items'] is List) {
            for (var item in data['items']) {
              final iMap = item as Map<String, dynamic>;
              final name = iMap['name'] ?? 'Unknown';
              final cat = iMap['category'] ?? 'Uncategorized';
              final qty = (iMap['quantity'] ?? 1) as int;
              final price = (iMap['price'] ?? 0).toDouble();
              final lineTotal = price * qty;
              final views = (iMap['views'] ?? 0) as int;

              if (prodStats.containsKey(name)) {
                var existing = prodStats[name]!;
                prodStats[name] = ProductPerformance(
                  name, 
                  existing.quantitySold + qty, 
                  existing.revenue + lineTotal,
                  25.0,
                  existing.views + views
                );
              } else {
                prodStats[name] = ProductPerformance(name, qty, lineTotal, 25.0, views);
              }
              
              if (catStats.containsKey(cat)) {
                catStats[cat]!.revenue += lineTotal;
                catStats[cat]!.itemCount += qty;
              } else {
                catStats[cat] = CategoryStats(lineTotal, qty);
              }
            }
          }
        }
      } 
      else if (date.isAfter(prevStart) && date.isBefore(start)) {
        if (status != 'cancelled' && status != 'returned') {
          prevRevenue += total;
          prevCount++;
        }
      }
    }

    int lowStock = 0, outStock = 0;
    for (var p in products) {
      final d = p.data() as Map<String, dynamic>;
      final q = (d['stock'] ?? d['quantity'] ?? 0) as int;
      if (q == 0) {
        outStock++;
      } else if (q < 10) lowStock++;
    }

    int activeC = 0, totalUsed = 0;
    for (var c in coupons) {
      final d = c.data() as Map<String, dynamic>;
      if ((d['isActive'] ?? false) == true) activeC++;
      totalUsed += (d['usedCount'] ?? 0) as int;
    }

    List<ProductPerformance> sortedProds = prodStats.values.toList()
      ..sort((a, b) => b.revenue.compareTo(a.revenue));
    
    double totalCatRev = catStats.values.fold(0.0, (p, c) => p + c.revenue);
    List<CategoryPerformance> sortedCats = [];
    catStats.forEach((k, v) {
      sortedCats.add(CategoryPerformance(
        k, 
        v.revenue, 
        totalCatRev > 0 ? (v.revenue/totalCatRev)*100 : 0,
        v.itemCount
      ));
    });
    sortedCats.sort((a, b) => b.value.compareTo(a.value));

    List<RevenueByHour> hourlyData = [];
    hourlyRev.forEach((hour, rev) {
      hourlyData.add(RevenueByHour(hour, rev, hourlyOrders[hour] ?? 0));
    });
    hourlyData.sort((a, b) => a.hour.compareTo(b.hour));

    int newCust = 0, retCust = 0;
    custFreq.forEach((k, v) => v > 1 ? retCust++ : newCust++);
    double retentionRate = (newCust + retCust) > 0 
      ? (retCust / (newCust + retCust)) * 100 
      : 0.0;

    int totalOps = count + cancelledCount + returnedCount;
    double calculatedReturnRate = totalOps > 0 ? ((cancelledCount + returnedCount) / totalOps) * 100 : 0.0;
    double convRate = count > 0 ? (count / (count * 1.5)) * 100 : 0;

    return DashboardAnalytics(
      totalRevenue: revenue,
      previousRevenue: prevRevenue,
      totalOrders: count,
      previousOrders: prevCount,
      aov: count > 0 ? revenue / count : 0,
      netProfit: profit,
      returnRate: calculatedReturnRate,
      conversionRate: convRate,
      cartAbandonmentRate: 100 - convRate,
      chartData: chartPoints,
      ordersChartData: orderPoints,
      orderStatusCounts: statuses,
      topProducts: sortedProds.take(5).toList(),
      topCategories: sortedCats.take(5).toList(),
      hourlyRevenue: hourlyData,
      activeCoupons: activeC,
      totalCouponUsage: totalUsed,
      couponSavings: couponDiscounts,
      lowStockItems: lowStock,
      outOfStockItems: outStock,
      newCustomers: newCust,
      returningCustomers: retCust,
      customerRetentionRate: retentionRate,
      recentOrders: orders.take(10).toList(),
      paymentMethods: paymentMethods,
      topLocations: locations,
      // NEW KPI fields
      activeSellers: activeSellersCount,
      activeUsers: activeUsersCount,
      productsLive: products.where((p) => (p.data() as Map)['isActive'] == true).length,
      platformCommission: revenue * 0.05, // 5% platform commission
      adsRevenue: 0, // TODO: Query from ad payments collection
      todayOrders: todayOrderCount,
      monthOrders: monthOrderCount,
      todayGMV: todayGMVAmount,
      monthGMV: monthGMVAmount,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final authProvider = Provider.of<AuthProvider>(context);
    final bg = isDark ? AppColors.backgroundDark : AppColors.background;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: bg,
      body: StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance
            .collection('orders')
            .orderBy('createdAt', descending: true)
            .limit(1000)
            .snapshots(),
        builder: (context, orderSnap) {
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance.collection('products').snapshots(),
            builder: (context, prodSnap) {
              return StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance.collection('coupons').snapshots(),
                builder: (context, couponSnap) {
                  return StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance
                        .collection('sellers')
                        .where('isActive', isEqualTo: true)
                        .snapshots(),
                    builder: (context, sellerSnap) {
                      return StreamBuilder<QuerySnapshot>(
                        stream: FirebaseFirestore.instance.collection('users').snapshots(),
                        builder: (context, userSnap) {
                  
                    if (orderSnap.connectionState == ConnectionState.waiting && !orderSnap.hasData) {
                      return Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      );
                    }

                    final analytics = _processData(
                      orderSnap.data?.docs ?? [],
                      prodSnap.data?.docs ?? [],
                      couponSnap.data?.docs ?? [],
                      sellerSnap.data?.docs.length ?? 0,
                      userSnap.data?.docs.length ?? 0,
                    );

                  return SafeArea(
                    child: RefreshIndicator(
                      onRefresh: () async => setState((){}),
                      color: AppColors.primary,
                      child: CustomScrollView(
                        physics: const BouncingScrollPhysics(),
                        slivers: [
                          // 1. Header
                          SliverToBoxAdapter(
                            child: _buildProfessionalHeader(authProvider, isDark, screenWidth),
                          ),
                          
                          // 2. Time Controls
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: _buildAdvancedTimeControls(isDark, screenWidth),
                              ),
                            ),
                          ),

                          // 3. KPI Command Center (7 Cards)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                              child: _buildKPICommandCenter(analytics, isDark, screenWidth),
                            ),
                          ),

                          // 4. Charts
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: _buildProfessionalChartSection(analytics, isDark, screenWidth),
                            ),
                          ),
                          
                          // Spacing
                          const SliverToBoxAdapter(child: SizedBox(height: 24)),

                          // 5. Performance Grid
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: _buildPerformanceGrid(analytics, isDark, screenWidth),
                            ),
                          ),
                          
                          const SliverToBoxAdapter(child: SizedBox(height: 24)),

                          // 6. Status & Marketing
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: _buildStatusMarketingSection(analytics, isDark, screenWidth),
                            ),
                          ),

                          // 7. Orders Table
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(24, 24, 24, 100),
                              child: _buildProfessionalOrdersTable(analytics.recentOrders, isDark, screenWidth),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                        },
                      );
                    },
                  );
                },
              );
            }
          );
        }
      ),
      floatingActionButton: _buildQuickActionsFAB(isDark),
    );
  }

  // ============================================
  // 🎨 WIDGET BUILDERS
  // ============================================

  Widget _buildProfessionalHeader(AuthProvider auth, bool isDark, double screenWidth) {
    final isCompact = screenWidth < 800;
    final hour = DateTime.now().hour;
    
    // Time-based greeting
    String greeting;
    IconData greetingIcon;
    Color greetingColor;
    
    if (hour < 12) {
      greeting = "Good Morning";
      greetingIcon = Icons.wb_sunny_rounded;
      greetingColor = const Color(0xFFF59E0B); // Amber
    } else if (hour < 17) {
      greeting = "Good Afternoon";
      greetingIcon = Icons.wb_sunny_outlined;
      greetingColor = const Color(0xFFF97316); // Orange
    } else {
      greeting = "Good Evening";
      greetingIcon = Icons.nightlight_round;
      greetingColor = const Color(0xFF8B5CF6); // Purple
    }
    
    final userName = auth.currentUser?.name ?? "Admin";
    final firstName = userName.split(' ').first;

    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: isCompact ? 16 : 24, 
        vertical: 16
      ),
      padding: EdgeInsets.all(isCompact ? 20 : 28),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark 
            ? [
                const Color(0xFF1E293B),
                const Color(0xFF0F172A),
              ]
            : [
                Colors.white,
                const Color(0xFFF8FAFC),
              ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark 
            ? Colors.white.withValues(alpha: 0.08) 
            : Colors.black.withValues(alpha: 0.04),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark 
              ? Colors.black.withValues(alpha: 0.3) 
              : Colors.black.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Greeting Icon Container
          Container(
            width: isCompact ? 56 : 72,
            height: isCompact ? 56 : 72,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  greetingColor,
                  greetingColor.withValues(alpha: 0.7),
                ],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: greetingColor.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Icon(
              greetingIcon, 
              color: Colors.white, 
              size: isCompact ? 28 : 36,
            ),
          ).animate().scale(
            duration: 600.ms,
            curve: Curves.elasticOut,
          ),
          
          SizedBox(width: isCompact ? 16 : 24),
          
          // Text Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Greeting & Name
                Row(
                  children: [
                    Text(
                      "$greeting, ",
                      style: TextStyle(
                        fontSize: isCompact ? 18 : 24,
                        fontWeight: FontWeight.w500,
                        color: isDark 
                          ? Colors.white.withValues(alpha: 0.7) 
                          : const Color(0xFF64748B),
                        letterSpacing: -0.3,
                      ),
                    ),
                    Flexible(
                      child: Text(
                        firstName,
                        style: TextStyle(
                          fontSize: isCompact ? 18 : 24,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                          letterSpacing: -0.5,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      " 👋",
                      style: TextStyle(fontSize: isCompact ? 18 : 24),
                    ).animate(
                      onPlay: (c) => c.repeat(reverse: true),
                    ).rotate(
                      begin: -0.05,
                      end: 0.05,
                      duration: 500.ms,
                    ),
                  ],
                ),
                
                const SizedBox(height: 8),
                
                // Subtitle
                Text(
                  "Here's what's happening with your store today.",
                  style: TextStyle(
                    fontSize: isCompact ? 13 : 15,
                    fontWeight: FontWeight.w500,
                    color: isDark 
                      ? Colors.white.withValues(alpha: 0.45) 
                      : const Color(0xFF94A3B8),
                    height: 1.4,
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // Date Chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isDark 
                      ? AppColors.primary.withValues(alpha: 0.15) 
                      : AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.calendar_today_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        DateFormat('EEEE, MMMM d, yyyy').format(DateTime.now()),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1);
  }

  Widget _buildHeaderActionButton(
    IconData icon, 
    String label, 
    Color color,
    bool isDark,
    VoidCallback onTap,
    {bool isCompact = false, Color? fillColor}
  ) {
    final hasFill = fillColor != null;
    
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: isCompact ? 16 : 20, 
            vertical: 14
          ),
          decoration: BoxDecoration(
            gradient: hasFill ? LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [fillColor, fillColor.withValues(alpha: 0.85)]
            ) : null,
            color: hasFill ? null : (isDark ? const Color(0xFF1E293B) : Colors.white),
            borderRadius: BorderRadius.circular(14),
            border: hasFill ? null : Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.06),
              width: 1.5
            ),
            boxShadow: hasFill ? [
              BoxShadow(
                color: fillColor.withValues(alpha: 0.4),
                blurRadius: 12,
                offset: const Offset(0, 4)
              )
            ] : [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2)
              )
            ]
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: 0.2
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }



  Widget _buildAdvancedTimeControls(bool isDark, double screenWidth) {
    String getLabel(TimeRange range) {
      switch (range) {
        case TimeRange.today: return 'Today';
        case TimeRange.week: return 'This Week';
        case TimeRange.month: return 'This Month';
        case TimeRange.quarter: return 'This Quarter';
        case TimeRange.year: return 'This Year';
        case TimeRange.custom: return 'Custom Range';
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: PopupMenuButton<TimeRange>(
        initialValue: _selectedTimeRange,
        onSelected: (TimeRange range) async {
          if (range == TimeRange.custom) {
            final picked = await showDateRangePicker(
              context: context,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
              builder: (context, child) {
                return Theme(
                  data: ThemeData.light().copyWith(
                    primaryColor: AppColors.primary,
                    colorScheme: const ColorScheme.light(primary: AppColors.primary),
                  ),
                  child: child!,
                );
              },
            );
            if (picked != null) {
              setState(() {
                _customStartDate = picked.start;
                _customEndDate = picked.end;
                _selectedTimeRange = range;
              });
            }
          } else {
            setState(() => _selectedTimeRange = range);
          }
        },
        offset: const Offset(0, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: isDark ? AppColors.surfaceDark : Colors.white,
        itemBuilder: (context) => TimeRange.values.map((range) {
          final isSelected = _selectedTimeRange == range;
          return PopupMenuItem<TimeRange>(
            value: range,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary.withValues(alpha: 0.1) : null,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    _getTimeRangeIcon(range),
                    size: 18,
                    color: isSelected ? AppColors.primary : (isDark ? Colors.white60 : Colors.black54),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    getLabel(range),
                    style: TextStyle(
                      color: isSelected 
                        ? AppColors.primary 
                        : (isDark ? Colors.white : Colors.black87),
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                      fontSize: 14,
                    ),
                  ),
                  const Spacer(),
                  if (isSelected)
                    Icon(Icons.check_rounded, size: 18, color: AppColors.primary),
                ],
              ),
            ),
          );
        }).toList(),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.calendar_today_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Period',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white38 : Colors.black38,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  getLabel(_selectedTimeRange),
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ],
        ),
      ),
    );
  }

  IconData _getTimeRangeIcon(TimeRange range) {
    switch (range) {
      case TimeRange.today: return Icons.today_rounded;
      case TimeRange.week: return Icons.view_week_rounded;
      case TimeRange.month: return Icons.calendar_month_rounded;
      case TimeRange.quarter: return Icons.date_range_rounded;
      case TimeRange.year: return Icons.calendar_today_rounded;
      case TimeRange.custom: return Icons.edit_calendar_rounded;
    }
  }

  // ============================================
  // 🎯 KPI COMMAND CENTER (7 Premium Cards)
  // ============================================
  
  Widget _buildKPICommandCenter(DashboardAnalytics analytics, bool isDark, double screenWidth) {
    final isMobile = screenWidth < 600;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final compactFormat = NumberFormat.compact();
    
    // Reorganized KPI data for 2-column synchronized scroll
    // Column 1: Total Orders, GMV, Active Users
    // Column 2: Commission, Ads Revenue, Active Sellers
    final column1 = [
      _KPIData(
        title: 'Total Orders',
        value: analytics.totalOrders.toString(),
        subtitle: 'Today: ${analytics.todayOrders}',
        icon: Icons.shopping_cart_rounded,
        color: AppColors.warning,
        trend: analytics.previousOrders > 0 
            ? ((analytics.totalOrders - analytics.previousOrders) / analytics.previousOrders * 100) 
            : 0,
        route: '/analytics/orders',
      ),
      _KPIData(
        title: 'GMV',
        value: currencyFormat.format(analytics.totalRevenue),
        subtitle: 'Today: ${currencyFormat.format(analytics.todayGMV)}',
        icon: Icons.payments_rounded,
        color: AppColors.success,
        trend: analytics.previousRevenue > 0 
            ? ((analytics.totalRevenue - analytics.previousRevenue) / analytics.previousRevenue * 100) 
            : 0,
        route: '/analytics/gmv',
      ),
      _KPIData(
        title: 'Active Users',
        value: compactFormat.format(analytics.activeUsers),
        subtitle: 'Registered customers',
        icon: Icons.people_rounded,
        color: Colors.purple,
        trend: 0,
        route: '/analytics/users',
      ),
    ];

    final column2 = [
      _KPIData(
        title: 'Commission',
        value: currencyFormat.format(analytics.platformCommission),
        subtitle: 'Platform earnings',
        icon: Icons.percent_rounded,
        color: AppColors.primary,
        trend: 0,
        route: '/commission',
      ),
      _KPIData(
        title: 'Ads Revenue',
        value: currencyFormat.format(analytics.adsRevenue),
        subtitle: 'Sponsored earnings',
        icon: Icons.trending_up_rounded,
        color: Colors.pink,
        trend: 0,
        route: '/analytics/ads',
      ),
      _KPIData(
        title: 'Active Sellers',
        value: compactFormat.format(analytics.activeSellers),
        subtitle: 'Registered stores',
        icon: Icons.storefront_rounded,
        color: AppColors.secondary,
        trend: 0,
        route: '/analytics/sellers',
      ),
    ];

    final cardWidth = isMobile ? (screenWidth - 48 - 12) / 2 : 200.0;
    final cardHeight = isMobile ? 110.0 : 130.0;
    final gap = 12.0;

    // Build card pairs (row1col1, row1col2), (row2col1, row2col2), etc.
    List<Widget> cardPairs = [];
    for (int i = 0; i < column1.length; i++) {
      cardPairs.add(
        Padding(
          padding: EdgeInsets.only(right: i == column1.length - 1 ? 0 : gap),
          child: Column(
            children: [
              SizedBox(
                width: cardWidth,
                height: cardHeight,
                child: _buildKPICard(column1[i], isDark, compact: isMobile),
              ),
              SizedBox(height: gap),
              SizedBox(
                width: cardWidth,
                height: cardHeight,
                child: _buildKPICard(column2[i], isDark, compact: isMobile),
              ),
            ],
          ),
        ),
      );
    }

    // Single horizontal scroll for synchronized scrolling
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: cardPairs,
      ),
    );
  }

  Widget _buildKPICard(_KPIData kpi, bool isDark, {bool compact = false}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, kpi.route),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: EdgeInsets.all(compact ? 14 : 18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                  : [Colors.white, const Color(0xFFF8FAFC)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark 
                  ? kpi.color.withValues(alpha: 0.2) 
                  : kpi.color.withValues(alpha: 0.15),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: kpi.color.withValues(alpha: 0.15),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Icon Row
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(compact ? 8 : 10),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [kpi.color, kpi.color.withValues(alpha: 0.7)],
                      ),
                      borderRadius: BorderRadius.circular(compact ? 10 : 12),
                      boxShadow: [
                        BoxShadow(
                          color: kpi.color.withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(kpi.icon, color: Colors.white, size: compact ? 16 : 20),
                  ),
                  const Spacer(),
                  if (kpi.trend != 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: kpi.trend > 0 
                            ? Colors.green.withValues(alpha: 0.15) 
                            : Colors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            kpi.trend > 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                            size: 10,
                            color: kpi.trend > 0 ? Colors.green : Colors.red,
                          ),
                          Text(
                            '${kpi.trend.abs().toStringAsFixed(0)}%',
                            style: TextStyle(
                              color: kpi.trend > 0 ? Colors.green : Colors.red,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              // Value & Title
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      kpi.value,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: compact ? 18 : 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      kpi.title,
                      style: TextStyle(
                        color: isDark ? Colors.white60 : Colors.black54,
                        fontSize: compact ? 11 : 12,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // 🔢 ENTERPRISE METRIC CARDS
  Widget _buildProfessionalMetricCard(
    String title, 
    double value, 
    double previousValue, 
    bool isCurrency, 
    IconData icon,
    Color accentColor,
    bool isDark,
    double screenWidth,
    {bool isPercent = false}
  ) {
    double change = 0;
    if (previousValue != 0) {
      change = ((value - previousValue) / previousValue) * 100;
    }
    bool isPositive = change >= 0;
    
    // Format Value
    String formattedValue;
    if (isCurrency) {
      formattedValue = NumberFormat.currency(symbol: '₹', locale: 'en_IN', decimalDigits: 0).format(value);
    } else if (isPercent) {
      formattedValue = "${value.toStringAsFixed(1)}%";
    } else {
      formattedValue = NumberFormat.compact().format(value);
    }

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
              : [Colors.white, const Color(0xFFF8FAFC)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark 
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.04),
          width: 1.5
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: isDark ? 0.15 : 0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
            spreadRadius: -4
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4)
          )
        ]
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            // Subtle gradient overlay
            Positioned(
              top: -40,
              right: -40,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      accentColor.withValues(alpha: 0.12),
                      accentColor.withValues(alpha: 0.0),
                    ]
                  ),
                ),
              ),
            ),
            
            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Icon Badge
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              accentColor.withValues(alpha: 0.2),
                              accentColor.withValues(alpha: 0.05),
                            ]
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: accentColor.withValues(alpha: 0.2),
                            width: 1
                          )
                        ),
                        child: Icon(icon, color: accentColor, size: 18),
                      ),
                      
                      // Trend Badge
                      if (previousValue != 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: (isPositive ? AppColors.success : AppColors.error).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: (isPositive ? AppColors.success : AppColors.error).withValues(alpha: 0.2),
                          )
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isPositive ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                              size: 10,
                              color: isPositive ? AppColors.success : AppColors.error
                            ),
                            const SizedBox(width: 3),
                            Text(
                              "${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%",
                              style: TextStyle(
                                color: isPositive ? AppColors.success : AppColors.error,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 12),
                  
                  // Value
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      formattedValue,
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1,
                        height: 1.0
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 4),
                  
                  // Title
                  Text(
                    title.toUpperCase(),
                    style: TextStyle(
                      color: isDark ? Colors.white.withValues(alpha: 0.5) : const Color(0xFF64748B),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 500.ms, curve: Curves.easeOut).slideY(begin: 0.1, end: 0);
  }


  // 📈 ENTERPRISE CHART SECTION - Production Quality
  Widget _buildProfessionalChartSection(DashboardAnalytics analytics, bool isDark, double screenWidth) {
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final compactFormat = NumberFormat.compact();
    
    // Metric data based on selection
    Map<int, double> chartData;
    String chartTitle;
    Color chartColor;
    double maxY;
    
    switch (_selectedChartType) {
      case ChartType.revenue:
      case ChartType.profit:
      case ChartType.customers:
        chartData = analytics.chartData;
        chartTitle = 'Revenue';
        chartColor = AppColors.success;
        maxY = analytics.chartData.values.isEmpty ? 1.0 : analytics.chartData.values.fold(0.0, math.max);
        break;
      case ChartType.orders:
        chartData = analytics.ordersChartData.map((k, v) => MapEntry(k, v.toDouble()));
        chartTitle = 'Orders';
        chartColor = Colors.orange;
        maxY = analytics.ordersChartData.values.isEmpty ? 1.0 : analytics.ordersChartData.values.fold(0.0, math.max);
        break;
    }
    
    // Calculate trends
    final revenueGrowth = analytics.previousRevenue > 0 
        ? ((analytics.totalRevenue - analytics.previousRevenue) / analytics.previousRevenue * 100) 
        : 0.0;
    final ordersGrowth = analytics.previousOrders > 0 
        ? ((analytics.totalOrders - analytics.previousOrders) / analytics.previousOrders * 100) 
        : 0.0;
    
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
              : [Colors.white, const Color(0xFFF8FAFC)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.04),
          width: 1.5
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          )
        ]
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Metric Selector Cards
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                // Revenue Card
                _buildMetricTab(
                  title: 'Revenue',
                  value: currencyFormat.format(analytics.totalRevenue),
                  trend: revenueGrowth,
                  icon: Icons.payments_rounded,
                  color: AppColors.success,
                  isSelected: _selectedChartType == ChartType.revenue,
                  isDark: isDark,
                  onTap: () => setState(() => _selectedChartType = ChartType.revenue),
                ),
                const SizedBox(width: 12),
                // Commission Card (info only)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.percent_rounded, color: AppColors.primary, size: 18),
                          const SizedBox(width: 8),
                          Text('Commission', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? Colors.white54 : Colors.black54)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(currencyFormat.format(analytics.platformCommission), style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87, letterSpacing: -0.5)),
                      const SizedBox(height: 4),
                      Text('5% of GMV', style: TextStyle(fontSize: 11, color: isDark ? Colors.white30 : Colors.black38)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Orders Card
                _buildMetricTab(
                  title: 'Orders',
                  value: compactFormat.format(analytics.totalOrders),
                  trend: ordersGrowth,
                  icon: Icons.shopping_bag_rounded,
                  color: Colors.orange,
                  isSelected: _selectedChartType == ChartType.orders,
                  isDark: isDark,
                  onTap: () => setState(() => _selectedChartType = ChartType.orders),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Chart Header
          Row(
            children: [
              Container(width: 4, height: 20, decoration: BoxDecoration(color: chartColor, borderRadius: BorderRadius.circular(2))),
              const SizedBox(width: 10),
              Text('$chartTitle Trend', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: isDark ? Colors.white70 : Colors.black87)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: chartColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Text('Last 30 days', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: chartColor)),
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Chart
          SizedBox(
            height: 220,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true, drawVerticalLine: false,
                  horizontalInterval: math.max(1, maxY / 4),
                  getDrawingHorizontalLine: (value) => FlLine(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.04), strokeWidth: 1),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true, reservedSize: 28, interval: 1,
                      getTitlesWidget: (value, meta) {
                        if (value.toInt() % 7 != 0) return const SizedBox.shrink(); 
                        return Padding(padding: const EdgeInsets.only(top: 8), child: Text("Day ${value.toInt() + 1}", style: TextStyle(color: isDark ? Colors.white30 : Colors.black38, fontSize: 10, fontWeight: FontWeight.w500)));
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true, reservedSize: 50,
                      getTitlesWidget: (value, meta) {
                        final label = _selectedChartType == ChartType.revenue ? '₹${NumberFormat.compact().format(value)}' : NumberFormat.compact().format(value);
                        return Padding(padding: const EdgeInsets.only(right: 6), child: Text(label, style: TextStyle(color: isDark ? Colors.white30 : Colors.black38, fontSize: 10, fontWeight: FontWeight.w500)));
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                minX: 0, maxX: math.max(1, chartData.length.toDouble() - 1), minY: 0,
                lineTouchData: LineTouchData(
                  enabled: true,
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => chartColor,
                    tooltipRoundedRadius: 12,
                    tooltipPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    getTooltipItems: (touchedSpots) => touchedSpots.map((spot) {
                      final formatted = _selectedChartType == ChartType.revenue ? currencyFormat.format(spot.y) : '${spot.y.toInt()} orders';
                      return LineTooltipItem(formatted, const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13));
                    }).toList(),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: chartData.entries.map((e) => FlSpot(e.key.toDouble(), e.value)).toList(),
                    isCurved: true, curveSmoothness: 0.3, color: chartColor, barWidth: 3, isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(colors: [chartColor.withValues(alpha: 0.2), chartColor.withValues(alpha: 0.0)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTab({
    required String title, required String value, required double trend, required IconData icon,
    required Color color, required bool isSelected, required bool isDark, required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: 200.ms,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: isDark ? 0.2 : 0.1) : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02)),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? color.withValues(alpha: 0.5) : Colors.transparent, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 8),
              Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? Colors.white54 : Colors.black54)),
            ]),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87, letterSpacing: -0.5)),
            const SizedBox(height: 4),
            Row(children: [
              Icon(trend >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded, size: 14, color: trend >= 0 ? AppColors.success : AppColors.error),
              const SizedBox(width: 4),
              Text('${trend >= 0 ? '+' : ''}${trend.toStringAsFixed(1)}%', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: trend >= 0 ? AppColors.success : AppColors.error)),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _buildChartSummaryCard(String title, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white54 : Colors.black45,
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideX(begin: 0.1);
  }
  
  Widget _buildChartLegendItem(String label, Color color, bool isDark) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.4),
                blurRadius: 4,
                offset: const Offset(0, 2)
              )
            ]
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white.withValues(alpha: 0.6) : const Color(0xFF64748B)
          ),
        ),
      ],
    );
  }

  Widget _buildChartTypeSelector(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark : AppColors.background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildChartTypeItem(ChartType.revenue, "Revenue", isDark),
          _buildChartTypeItem(ChartType.orders, "Orders", isDark),
        ],
      ),
    );
  }

  Widget _buildChartTypeItem(ChartType type, String label, bool isDark) {
    final isSelected = _selectedChartType == type;
    return GestureDetector(
      onTap: () => setState(() => _selectedChartType = type),
      child: AnimatedContainer(
        duration: 200.ms,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected 
            ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)]
            : null
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? AppColors.primary : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            fontSize: 12
          ),
        ),
      ),
    );
  }

  // 📊 PERFORMANCE GRID SECTION
  Widget _buildPerformanceGrid(DashboardAnalytics analytics, bool isDark, double screenWidth) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useVertical = screenWidth < 900;
        return Flex(
          direction: useVertical ? Axis.vertical : Axis.horizontal,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: useVertical ? 0 : 3,
              child: _buildTableCard(
                "Top Products", 
                _buildTopProductsList(analytics.topProducts, isDark),
                isDark,
                icon: Icons.star_rounded,
                iconColor: AppColors.warning
              ),
            ),
            SizedBox(width: useVertical ? 0 : 20, height: useVertical ? 20 : 0),
            Expanded(
              flex: useVertical ? 0 : 2,
              child: _buildTableCard(
                "Top Categories", 
                _buildCategoriesPieChart(analytics.topCategories, isDark),
                isDark,
                icon: Icons.category_rounded,
                iconColor: AppColors.primary
              ),
            ),
          ],
        );
      }
    );
  }

  Widget _buildTopProductsList(List<ProductPerformance> products, bool isDark) {
    if (products.isEmpty) {
      return Center(
        child: Text(
          "No sales data yet",
          style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
        ),
      );
    }
    
    return Column(
      children: products.asMap().entries.map((e) {
        final idx = e.key;
        final prod = e.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Container(
                width: 32, height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                   color: idx == 0 ? AppColors.warning : AppColors.lightGrey,
                   shape: BoxShape.circle,
                   gradient: idx == 0 ? AppColors.accentGradient : null
                ),
                child: Text(
                  "${idx + 1}",
                  style: TextStyle(
                    color: idx == 0 ? AppColors.primary : AppColors.textSecondary,
                    fontWeight: FontWeight.bold
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      prod.name,
                      style: TextStyle(
                         fontWeight: FontWeight.w600,
                         color: isDark ? AppColors.textLight : AppColors.textPrimary
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      "${prod.quantitySold} sold • ${prod.views} views",
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                NumberFormat.currency(symbol: '\$').format(prod.revenue),
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCategoriesPieChart(List<CategoryPerformance> cats, bool isDark) {
    if (cats.isEmpty) {
      return Center(
        child: Text(
          "No category data",
          style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
        ),
      );
    }

    return SizedBox(
      height: 200,
      child: PieChart(
        PieChartData(
          sectionsSpace: 2,
          centerSpaceRadius: 40,
          sections: cats.asMap().entries.map((e) {
            final idx = e.key;
            final cat = e.value;
            return PieChartSectionData(
              color: AppColors.categoryColors[idx % AppColors.categoryColors.length],
              value: cat.value,
              title: "${cat.percentage.toInt()}%",
              radius: 50,
              titleStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTableCard(String title, Widget content, bool isDark, {IconData? icon, Color? iconColor}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowLight,
            blurRadius: 20,
            offset: const Offset(0, 8)
          )
        ],
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 0.5
        )
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: iconColor, size: 20),
                const SizedBox(width: 8),
              ],
              Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          content,
        ],
      ),
    );
  }

  // 🎯 STATUS & MARKETING SECTION
  Widget _buildStatusMarketingSection(DashboardAnalytics analytics, bool isDark, double screenWidth) {
    final useVertical = screenWidth < 900;
    
    return Flex(
      direction: useVertical ? Axis.vertical : Axis.horizontal,
      children: [
        Expanded(
          flex: useVertical ? 0 : 1,
          child: _buildInfoCard(
            "Inventory Alert",
            "${analytics.lowStockItems} Items Low Stock",
            "${analytics.outOfStockItems} Items Out of Stock",
            Icons.inventory_2_rounded,
            AppColors.warning,
            isDark
          ),
        ),
        SizedBox(width: useVertical ? 0 : 20, height: useVertical ? 16 : 0),
        Expanded(
          flex: useVertical ? 0 : 1,
          child: _buildInfoCard(
            "Coupon Performance",
            "${analytics.activeCoupons} Active Coupons",
            "${NumberFormat.currency(symbol: '\$').format(analytics.couponSavings)} Saved",
            Icons.local_offer_rounded,
            AppColors.accent,
            isDark
          ),
        ),
        SizedBox(width: useVertical ? 0 : 20, height: useVertical ? 16 : 0),
        Expanded(
          flex: useVertical ? 0 : 1,
          child: _buildInfoCard(
            "Customer Growth",
            "${analytics.newCustomers} New Customers",
            "${analytics.returningCustomers} Returning",
            Icons.group_add_rounded,
            AppColors.secondary,
            isDark
          ),
        ),
      ],
    );
  }

  Widget _buildInfoCard(
    String title, 
    String sub1, 
    String sub2, 
    IconData icon, 
    Color color,
    bool isDark
  ) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4)
          )
        ]
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10)
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            sub1,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary
            ),
          ),
          const SizedBox(height: 4),
          Text(
            sub2,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textLightHint : AppColors.textHint
            ),
          ),
        ],
      ),
    );
  }

  // 📦 ORDERS TABLE - PROFESSIONAL
  Widget _buildProfessionalOrdersTable(List<QueryDocumentSnapshot> orders, bool isDark, double screenWidth) {
    final isMobile = screenWidth < 800;
    final currencyFormat = NumberFormat.currency(symbol: '₹', locale: 'en_IN', decimalDigits: 0);
    
    return Container(
      padding: EdgeInsets.all(isMobile ? 16 : 24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 1
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4)
          )
        ]
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    "Recent Orders",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () {
                   Navigator.push(
                    context, 
                    MaterialPageRoute(builder: (_) => const OrderManagementScreen())
                  );
                },
                child: Row(
                  children: [
                    Text(
                      "View All",
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 13
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.primary),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          
          if (orders.isEmpty)
             Center(
               child: Padding(
                 padding: const EdgeInsets.all(40.0),
                 child: Column(
                   children: [
                     Icon(Icons.inbox_rounded, size: 48, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                     const SizedBox(height: 12),
                     Text(
                       "No recent orders",
                       style: TextStyle(
                         color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                         fontSize: 14,
                       ),
                     ),
                   ],
                 ),
               ),
             )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: orders.length > 5 ? 5 : orders.length,
              separatorBuilder: (_, __) => Divider(
                color: isDark ? AppColors.borderDark : AppColors.border,
                height: 24,
              ),
              itemBuilder: (context, index) {
                final doc = orders[index];
                final data = doc.data() as Map<String, dynamic>;
                final date = (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now();
                
                // Get Order Number
                final orderNumber = data['orderNumber']?.toString() ?? '#${doc.id.substring(0, 8).toUpperCase()}';
                
                // Get Customer Name
                String customerName = 'Guest';
                if (data['deliveryAddress'] != null && data['deliveryAddress'] is Map) {
                  final addr = data['deliveryAddress'] as Map<String, dynamic>;
                  customerName = addr['name']?.toString() ?? addr['fullName']?.toString() ?? 'Guest';
                }
                if (customerName == 'Guest' && data['userName'] != null) {
                  customerName = data['userName'].toString();
                }
                
                // Get Total
                final total = (data['total'] ?? 0).toDouble();
                
                // Get Products Summary
                String productsSummary = 'No items';
                if (data['items'] is List && (data['items'] as List).isNotEmpty) {
                  final items = data['items'] as List;
                  final firstItem = items[0] as Map<String, dynamic>;
                  final firstProductName = firstItem['name']?.toString() ?? firstItem['productName']?.toString() ?? 'Product';
                  if (items.length == 1) {
                    productsSummary = firstProductName;
                  } else {
                    productsSummary = '$firstProductName + ${items.length - 1} more';
                  }
                }
                
                // Get Status
                final status = (data['orderStatus'] ?? 'pending').toString().toLowerCase();
                
                return _buildOrderRow(
                  orderNumber: orderNumber,
                  customerName: customerName,
                  date: date,
                  amount: currencyFormat.format(total),
                  status: status,
                  productsSummary: productsSummary,
                  isDark: isDark,
                  isMobile: isMobile,
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildOrderRow({
    required String orderNumber,
    required String customerName,
    required DateTime date,
    required String amount,
    required String status,
    required String productsSummary,
    required bool isDark,
    required bool isMobile,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: isMobile
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Row 1: Order ID & Status
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      orderNumber,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontFamily: 'Monospace',
                      ),
                    ),
                    _buildStatusBadge(status),
                  ],
                ),
                const SizedBox(height: 8),
                // Row 2: Customer & Products
                Row(
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                      child: Text(
                        customerName.isNotEmpty ? customerName[0].toUpperCase() : 'G',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customerName,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.textLight : AppColors.textPrimary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            productsSummary,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Row 3: Date & Amount
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      DateFormat('dd MMM, hh:mm a').format(date),
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textLightHint : AppColors.textTertiary,
                      ),
                    ),
                    Text(
                      amount,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ],
            )
          : Row(
              children: [
                // Order Number
                SizedBox(
                  width: 120,
                  child: Text(
                    orderNumber,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      fontFamily: 'Monospace',
                    ),
                  ),
                ),
                // Customer
                Expanded(
                  flex: 2,
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                        child: Text(
                          customerName.isNotEmpty ? customerName[0].toUpperCase() : 'G',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              customerName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              productsSummary,
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Date
                SizedBox(
                  width: 130,
                  child: Text(
                    DateFormat('dd MMM, hh:mm a').format(date),
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textLightSecondary : AppColors.textTertiary,
                    ),
                  ),
                ),
                // Amount
                SizedBox(
                  width: 100,
                  child: Text(
                    amount,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: AppColors.primary,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
                const SizedBox(width: 16),
                // Status
                _buildStatusBadge(status),
                const SizedBox(width: 8),
                // Action
                IconButton(
                  icon: Icon(Icons.arrow_forward_ios_rounded, size: 16, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                  onPressed: () {
                    // Navigate to order details
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color = AppColors.getOrderStatusColor(status);
    String displayStatus = status.replaceAll('_', ' ');
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        displayStatus.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5
        ),
      ),
    );
  }

  Widget _buildQuickActionsFAB(bool isDark) {
    return FloatingActionButton.extended(
      onPressed: () {
         Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const AddProductScreen())
        );
      },
      backgroundColor: AppColors.secondary,
      icon: const Icon(Icons.add_rounded, color: Colors.white),
      label: const Text(
        "Quick Add", 
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)
      ),
    );
  }
}

// ============================================
// 📊 KPI Data Model
// ============================================
class _KPIData {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final double trend;
  final String route;

  _KPIData({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.trend,
    required this.route,
  });
}
