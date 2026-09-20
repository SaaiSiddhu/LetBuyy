// lib/screens/dashboard/new_seller_dashboard.dart
// 🏪 PREMIUM PROFESSIONAL SELLER DASHBOARD
// ✨ Spacious, Premium, Glassmorphic Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../providers/seller_provider.dart';
import '../../providers/notification_provider.dart';
import '../../app/routes.dart';

// Widgets
import 'widgets/summary_cards.dart';
import 'widgets/sales_chart.dart';
import 'widgets/orders_status_panel.dart';
import 'widgets/low_stock_alerts.dart';
import 'widgets/top_products_widget.dart';
import 'widgets/earnings_card.dart';
import 'widgets/quick_actions_bar.dart';
import 'widgets/commission_breakdown_card.dart';
import 'widgets/performance_heatmap.dart';

class NewSellerDashboard extends StatefulWidget {
  const NewSellerDashboard({super.key});

  @override
  State<NewSellerDashboard> createState() => _NewSellerDashboardState();
}

class _NewSellerDashboardState extends State<NewSellerDashboard> with TickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  
  bool _isLoading = true;
  
  // Summary Data
  double _todayRevenue = 0.0;
  double _yesterdayRevenue = 0.0;
  int _todayOrders = 0;
  int _yesterdayOrders = 0;
  int _todayUnits = 0;
  double _growthPercent = 0.0;
  int _lowStockCount = 0;
  int _outOfStockCount = 0;
  int _totalActiveSkus = 0;
  double _orderDefectRate = 0.0;
  double _lateShipmentRate = 0.0;
  double _cancellationRate = 0.0;
  double _walletBalance = 0.0;
  double _pendingAmount = 0.0;
  DateTime? _nextPayoutDate;
  
  // Sales Chart Data (Accurate)
  List<SalesDataPoint> _salesData = [];
  bool _isChartLoading = false;
  
  // Orders Status
  int _pendingOrders = 0;
  int _packedOrders = 0;
  int _shippedOrders = 0;
  int _deliveredOrders = 0;
  int _cancelledOrders = 0;
  int _returnedOrders = 0;
  int _totalOrders = 0;
  
  // Products
  List<LowStockProduct> _lowStockProducts = [];
  List<TopProduct> _topProducts = [];
  
  // Earnings (Accurate)
  double _weekEarnings = 0.0;
  double _monthEarnings = 0.0;
  double _totalEarnings = 0.0;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadDashboardData();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().initNotifications();
    });
  }
  
  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _loadDashboardData() async {
    final sellerProvider = context.read<SellerProvider>();
    final sellerId = sellerProvider.sellerId;
    if (sellerId == null) return;

    setState(() => _isLoading = true);

    try {
      await Future.wait([
        _loadAccurateSalesData(sellerId),
        _loadOrdersData(sellerId),
        _loadInventoryData(sellerId),
        _loadTopProducts(sellerId),
      ]);
    } catch (e) {
      debugPrint('Dashboard Error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// ACCURATE SALES DATA
  Future<void> _loadAccurateSalesData(String sellerId) async {
    setState(() => _isChartLoading = true);
    
    final seller = context.read<SellerProvider>().currentSeller;
    if (seller != null) {
      _walletBalance = seller.walletBalance;
      _pendingAmount = seller.pendingAmount;
    }
    
    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);
    final startOfYesterday = startOfToday.subtract(const Duration(days: 1));
    final startOfWeek = startOfToday.subtract(Duration(days: now.weekday - 1));
    final startOfMonth = DateTime(now.year, now.month, 1);
    final sevenDaysAgo = startOfToday.subtract(const Duration(days: 6));
    final sixtyDaysAgo = startOfToday.subtract(const Duration(days: 59));
    
    // Load 60 days of orders for chart data
    final ordersQuery = await _firestore
        .collection('orders')
        .where('sellerId', isEqualTo: sellerId)
        .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(sixtyDaysAgo))
        .orderBy('createdAt')
        .get();
    
    double todayRev = 0, yesterdayRev = 0, weekRev = 0, monthRev = 0;
    int todayOrd = 0, yesterdayOrd = 0, todayUnits = 0;
    int delivered = 0, cancelled = 0, defects = 0, lateShips = 0;
    
    Map<String, SalesDataPoint> dailyData = {};
    // Create 60 days of data structure for custom periods
    for (int i = 0; i < 60; i++) {
      final date = startOfToday.subtract(Duration(days: 59 - i));
      final key = DateFormat('yyyy-MM-dd').format(date);
      dailyData[key] = SalesDataPoint(date: date, revenue: 0, orders: 0, units: 0);
    }
    

    
    for (final doc in ordersQuery.docs) {
      final data = doc.data();
      final createdAt = (data['createdAt'] as Timestamp).toDate();
      final total = (data['total'] ?? 0).toDouble();
      final itemCount = (data['items'] as List?)?.length ?? 1;
      // FIXED: Use 'orderStatus' field (not 'status')
      final status = (data['orderStatus'] as String?)?.toLowerCase() ?? 'pending';
      
      monthRev += total;
      
      if (createdAt.isAfter(startOfWeek) || createdAt.isAtSameMomentAs(startOfWeek)) {
        weekRev += total;
      }
      
      if (createdAt.isAfter(startOfToday) || createdAt.isAtSameMomentAs(startOfToday)) {
        todayRev += total;
        todayOrd++;
        todayUnits += itemCount;
      }
      
      if (createdAt.isAfter(startOfYesterday) && createdAt.isBefore(startOfToday)) {
        yesterdayRev += total;
        yesterdayOrd++;
      }
      
      // Add to daily data for chart (all 60 days)
      final key = DateFormat('yyyy-MM-dd').format(createdAt);
      if (dailyData.containsKey(key)) {
        final existing = dailyData[key]!;
        dailyData[key] = SalesDataPoint(
          date: existing.date,
          revenue: existing.revenue + total,
          orders: existing.orders + 1,
          units: existing.units + itemCount,
        );
      }
      
      // Count delivered and cancelled (include status variations)
      if (status == 'delivered' || status == 'completed') delivered++;
      if (status == 'cancelled') cancelled++;
      if (data['hasDefect'] == true) defects++;
      if (data['isLateShipment'] == true) lateShips++;
    }
    
    final growth = yesterdayRev > 0 
        ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 
        : (todayRev > 0 ? 100.0 : 0.0);
    
    final totalProcessed = ordersQuery.size > 0 ? ordersQuery.size : 1;
    
    setState(() {
      _todayRevenue = todayRev;
      _yesterdayRevenue = yesterdayRev;
      _todayOrders = todayOrd;
      _yesterdayOrders = yesterdayOrd;
      _todayUnits = todayUnits;
      _growthPercent = growth;
      _weekEarnings = weekRev * 0.85;
      _monthEarnings = monthRev * 0.85;
      _totalEarnings = monthRev;
      _orderDefectRate = (defects / totalProcessed) * 100;
      _lateShipmentRate = (lateShips / totalProcessed) * 100;
      _cancellationRate = (cancelled / totalProcessed) * 100;
      _salesData = dailyData.values.toList();
      _isChartLoading = false;
    });
  }

  Future<void> _loadOrdersData(String sellerId) async {
    final ordersQuery = await _firestore
        .collection('orders')
        .where('sellerId', isEqualTo: sellerId)
        .get();
    
    int pending = 0, packed = 0, shipped = 0, delivered = 0, cancelled = 0, returned = 0;
    
    for (final doc in ordersQuery.docs) {
      final status = (doc.data()['orderStatus'] as String?)?.toLowerCase() ?? 'pending';
      switch (status) {
        // ═══════════════════════════════════════════════════════════════
        // STANDARD ORDER FLOW
        // ═══════════════════════════════════════════════════════════════
        case 'pending':
        case 'confirmed':
          pending++; 
          break;
        case 'packed': 
        case 'processing': 
          packed++; 
          break;
        case 'shipped':
        case 'outfordelivery':
          shipped++; 
          break;
        case 'delivered':
        case 'completed':
          delivered++; 
          break;
        case 'cancelled': 
          cancelled++; 
          break;
        // ═══════════════════════════════════════════════════════════════
        // RETURN FLOW (Refund)
        // ═══════════════════════════════════════════════════════════════
        case 'return_requested':
        case 'return_approved':
        case 'pickup_pending':
        case 'pickup_completed':
        case 'refund_initiated':
        case 'returned':
        case 'refunded':
        case 'rto':
        case 'failed':
          returned++; 
          break;
        // ═══════════════════════════════════════════════════════════════
        // EXCHANGE FLOW
        // ═══════════════════════════════════════════════════════════════
        case 'exchange_requested':
        case 'exchange_approved':
        case 'exchange_shipped':
        case 'exchanged':
          returned++; // Count exchanges in returned for now (dashboard shows RTO/Returns combined)
          break;
        default:
          debugPrint('⚠️ Unknown order status: $status for order ${doc.id}');
          pending++;
      }
    }
    
    setState(() {
      _pendingOrders = pending;
      _packedOrders = packed;
      _shippedOrders = shipped;
      _deliveredOrders = delivered;
      _cancelledOrders = cancelled;
      _returnedOrders = returned;
      _totalOrders = ordersQuery.size;
    });
  }

  Future<void> _loadInventoryData(String sellerId) async {
    final productsQuery = await _firestore
        .collection('products')
        .where('sellerId', isEqualTo: sellerId)
        .where('isActive', isEqualTo: true)
        .get();
    
    List<LowStockProduct> lowStock = [];
    int lowCount = 0, oosCount = 0;
    
    for (final doc in productsQuery.docs) {
      final data = doc.data();
      final stock = data['stock'] ?? 0;
      final threshold = data['lowStockThreshold'] ?? 10;
      
      if (stock == 0) {
        oosCount++;
        lowStock.add(LowStockProduct.fromFirestore(doc.id, data));
      } else if (stock <= threshold) {
        lowCount++;
        lowStock.add(LowStockProduct.fromFirestore(doc.id, data));
      }
    }
    
    lowStock.sort((a, b) => a.currentStock.compareTo(b.currentStock));
    
    setState(() {
      _totalActiveSkus = productsQuery.size;
      _lowStockCount = lowCount;
      _outOfStockCount = oosCount;
      _lowStockProducts = lowStock.take(5).toList();
    });
  }

  Future<void> _loadTopProducts(String sellerId) async {
    final productsQuery = await _firestore
        .collection('products')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('soldCount', descending: true)
        .limit(5)
        .get();
    
    setState(() {
      _topProducts = productsQuery.docs.map((doc) {
        final data = doc.data();
        final sold = data['soldCount'] ?? 0;
        final price = (data['price'] ?? 0).toDouble();
        return TopProduct(
          id: doc.id,
          name: data['name'] ?? 'Unknown',
          unitsSold: sold,
          revenue: sold * price,
          conversionRate: 3.5,
          stockRemaining: data['stock'] ?? 0,
          imageUrl: (data['images'] as List?)?.firstOrNull,
        );
      }).toList();
    });
  }

  void _handleQuickAction(QuickAction action) {
    switch (action) {
      case QuickAction.addProduct:
        Navigator.pushNamed(context, AppRoutes.sellerProducts);
        break;
      case QuickAction.manageInventory:
        Navigator.pushNamed(context, AppRoutes.sellerProducts);
        break;
      case QuickAction.viewOrders:
        Navigator.pushNamed(context, AppRoutes.sellerOrders);
        break;
      case QuickAction.viewReturns:
        Navigator.pushNamed(context, AppRoutes.sellerReturns);
        break;
      case QuickAction.createDiscount:
        break;
      case QuickAction.payments:
        Navigator.pushNamed(context, AppRoutes.sellerWallet);
        break;
      case QuickAction.analytics:
        Navigator.pushNamed(context, AppRoutes.sellerAnalytics); // Or wherever analytics is
        break;
    }
  }

  void _handleOrderStatusTap(String status) {
    Navigator.pushNamed(context, AppRoutes.sellerOrders, arguments: status);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final seller = context.watch<SellerProvider>().currentSeller;
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // Background
          _buildAnimatedBackground(isDark),
          Positioned.fill(
            child: CustomPaint(painter: _GridPatternPainter(isDark: isDark)),
          ),
          ..._buildFloatingOrbs(isDark, MediaQuery.of(context).size),
          
          // Content
          _isLoading
              ? _buildLoadingState(isDark)
              : RefreshIndicator(
                  onRefresh: _loadDashboardData,
                  color: AppColors.primary,
                  child: CustomScrollView(
                    physics: const BouncingScrollPhysics(),
                    slivers: [
                      // Glass AppBar
                      _buildGlassAppBar(isDark, seller?.storeName),
                      
                      SliverPadding(
                        padding: EdgeInsets.symmetric(
                          horizontal: isMobile ? 12 : 32,
                          vertical: 12,
                        ),
                        sliver: SliverList(
                          delegate: SliverChildListDelegate([
                            // Summary Cards
                            DashboardSummaryCards(
                              todayRevenue: _todayRevenue,
                              yesterdayRevenue: _yesterdayRevenue,
                              todayOrders: _todayOrders,
                              yesterdayOrders: _yesterdayOrders,
                              todayUnits: _todayUnits,
                              growthPercent: _growthPercent,
                              lowStockCount: _lowStockCount,
                              outOfStockCount: _outOfStockCount,
                              totalActiveSkus: _totalActiveSkus,
                              orderDefectRate: _orderDefectRate,
                              lateShipmentRate: _lateShipmentRate,
                              cancellationRate: _cancellationRate,
                              walletBalance: _walletBalance,
                              pendingAmount: _pendingAmount,
                              nextPayoutDate: _nextPayoutDate,
                            ),
                            const SizedBox(height: 24),
                            
                            // Desktop: Row, Mobile: Column
                            if (!isMobile) ...[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    flex: 2,
                                    child: SalesChartWidget(
                                      data: _salesData,
                                      isLoading: _isChartLoading,
                                    ),
                                  ),
                                  const SizedBox(width: 20),
                                  const Expanded(
                                    flex: 1,
                                    child: PerformanceHeatmap(),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    flex: 2,
                                    child: OrdersStatusPanel(
                                      pendingCount: _pendingOrders,
                                      packedCount: _packedOrders,
                                      shippedCount: _shippedOrders,
                                      deliveredCount: _deliveredOrders,
                                      cancelledCount: _cancelledOrders,
                                      returnedCount: _returnedOrders,
                                      onStatusTap: _handleOrderStatusTap,
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: QuickActionsBar(onActionTap: _handleQuickAction),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 24),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: LowStockAlertsWidget(
                                      products: _lowStockProducts,
                                      onViewAll: () => Navigator.pushNamed(context, AppRoutes.sellerProducts),
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: TopProductsWidget(
                                      products: _topProducts,
                                      onViewAll: () => Navigator.pushNamed(context, AppRoutes.sellerAnalytics),
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: EarningsCard(
                                      todayRevenue: _todayRevenue,
                                      weekRevenue: _weekEarnings / 0.85, // Convert net back to gross
                                      monthRevenue: _monthEarnings / 0.85,
                                      walletBalance: _walletBalance,
                                      pendingAmount: _pendingAmount,
                                      lifetimeEarnings: _totalEarnings,
                                      onViewDetails: () => Navigator.pushNamed(context, AppRoutes.sellerWallet),
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: CommissionBreakdownCard(
                                      sellerId: context.read<SellerProvider>().sellerId ?? '',
                                    ),
                                  ),
                                ],
                              ),
                            ] else ...[
                              // Mobile Stacked
                              SalesChartWidget(
                                data: _salesData,
                                isLoading: _isChartLoading,
                              ),
                              const SizedBox(height: 16),
                              // Performance Heatmap (right after sales chart)
                              const PerformanceHeatmap(),
                              const SizedBox(height: 20),
                              OrdersStatusPanel(
                                pendingCount: _pendingOrders,
                                packedCount: _packedOrders,
                                shippedCount: _shippedOrders,
                                deliveredCount: _deliveredOrders,
                                cancelledCount: _cancelledOrders,
                                returnedCount: _returnedOrders,
                                onStatusTap: _handleOrderStatusTap,
                              ),
                              const SizedBox(height: 20),
                              QuickActionsBar(onActionTap: _handleQuickAction),
                              const SizedBox(height: 20),
                              LowStockAlertsWidget(
                                products: _lowStockProducts,
                                onViewAll: () => Navigator.pushNamed(context, AppRoutes.sellerProducts),
                              ),
                              const SizedBox(height: 20),
                              TopProductsWidget(
                                products: _topProducts,
                                onViewAll: () => Navigator.pushNamed(context, AppRoutes.sellerAnalytics),
                              ),
                              const SizedBox(height: 20),
                              EarningsCard(
                                todayRevenue: _todayRevenue,
                                weekRevenue: _weekEarnings / 0.85,
                                monthRevenue: _monthEarnings / 0.85,
                                walletBalance: _walletBalance,
                                pendingAmount: _pendingAmount,
                                lifetimeEarnings: _totalEarnings,
                                onViewDetails: () => Navigator.pushNamed(context, AppRoutes.sellerWallet),
                              ),
                              const SizedBox(height: 20),
                              CommissionBreakdownCard(
                                sellerId: context.read<SellerProvider>().sellerId ?? '',
                              ),
                            ],
                            const SizedBox(height: 100), // Bottom padding
                          ]),
                        ),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }

  Widget _buildGlassAppBar(bool isDark, String? storeName) {
    final hour = DateTime.now().hour;
    final greeting = hour < 6 ? 'Good Night' : hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    final greetingEmoji = hour < 6 ? '🌙' : hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙';
    final seller = context.watch<SellerProvider>().currentSeller;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    final subtextColor = isDark ? Colors.white60 : AppColors.textSecondary;

    return SliverAppBar(
      expandedHeight: 170, // Increased to prevent overflow with SafeArea
      floating: false,
      pinned: true,
      snap: false,
      elevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      flexibleSpace: LayoutBuilder(
        builder: (context, constraints) {
          final expandRatio = ((constraints.maxHeight - kToolbarHeight) / (170 - kToolbarHeight)).clamp(0.0, 1.0);
          final isCollapsed = expandRatio < 0.3;
          
          return ClipRRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? [
                            const Color(0xFF0D1117).withValues(alpha: 0.97),
                            const Color(0xFF161B22).withValues(alpha: 0.95),
                          ]
                        : [
                            Colors.white.withValues(alpha: 0.95),
                            const Color(0xFFF8FAFC).withValues(alpha: 0.92),
                          ],
                  ),
                  border: Border(
                    bottom: BorderSide(
                      color: isDark 
                          ? Colors.white.withValues(alpha: 0.08) 
                          : Colors.black.withValues(alpha: 0.06),
                      width: 0.5,
                    ),
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        // ═══════════════════════════════════════════════════════
                        // Main Row: Avatar + Greeting + Actions
                        // ═══════════════════════════════════════════════════════
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Premium Avatar with Animated Ring
                            _buildPremiumAvatar(isDark, storeName, seller, isCollapsed),
                            
                            const SizedBox(width: 14),
                            
                            // Greeting + Store Name
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Greeting Row
                                  AnimatedOpacity(
                                    opacity: isCollapsed ? 0.0 : 1.0,
                                    duration: const Duration(milliseconds: 200),
                                    child: Row(
                                      children: [
                                        Text(
                                          greeting,
                                          style: TextStyle(
                                            color: subtextColor,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            letterSpacing: 0.2,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Text(greetingEmoji, style: const TextStyle(fontSize: 14)),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  // Store Name + Verified
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          storeName ?? 'Dashboard',
                                          style: TextStyle(
                                            color: textColor,
                                            fontSize: isCollapsed ? 18 : 22,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: -0.5,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (seller?.isVerified == true) ...[
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.all(3),
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                AppColors.primary.withValues(alpha: 0.2),
                                                AppColors.primaryLight.withValues(alpha: 0.1),
                                              ],
                                            ),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            Icons.verified_rounded,
                                            color: AppColors.primary,
                                            size: 16,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            
                            // Action Buttons
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Search Button
                                _buildActionButton(
                                  isDark: isDark,
                                  icon: Icons.search_rounded,
                                  onTap: () => Navigator.pushNamed(context, AppRoutes.sellerOrders),
                                ),
                                const SizedBox(width: 10),
                                // Notification Bell with Badge
                                _buildNotificationBell(isDark, textColor),
                              ],
                            ),
                          ],
                        ),
                        
                        // ═══════════════════════════════════════════════════════
                        // Quick Stats Row (Only when expanded)
                        // ═══════════════════════════════════════════════════════
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          height: isCollapsed ? 0 : 36,
                          child: AnimatedOpacity(
                            opacity: isCollapsed ? 0.0 : 1.0,
                            duration: const Duration(milliseconds: 200),
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.only(top: 12),
                              child: Row(
                                children: [
                                  _buildQuickStat(isDark, '₹${_formatCompact(_todayRevenue)}', 'Today', AppColors.success),
                                  const SizedBox(width: 16),
                                  _buildQuickStat(isDark, '$_todayOrders', 'Orders', AppColors.info),
                                  const SizedBox(width: 16),
                                  _buildQuickStat(isDark, '$_lowStockCount', 'Low Stock', AppColors.warning),
                                  const SizedBox(width: 16),
                                  _buildQuickStat(isDark, '$_pendingOrders', 'Pending', AppColors.primary),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Premium Avatar with animated gradient ring
  Widget _buildPremiumAvatar(bool isDark, String? storeName, seller, bool isCompact) {
    final size = isCompact ? 40.0 : 52.0;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: size + 6,
      height: size + 6,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Animated gradient ring
          Container(
            width: size + 6,
            height: size + 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: [
                  AppColors.primary,
                  AppColors.primaryLight,
                  const Color(0xFF10B981),
                  AppColors.primary,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
          ),
          // Inner avatar
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E293B) : Colors.white,
              shape: BoxShape.circle,
              image: seller?.photoUrl != null && seller!.photoUrl!.isNotEmpty
                  ? DecorationImage(
                      image: NetworkImage(seller.photoUrl!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: seller?.photoUrl == null || seller!.photoUrl!.isEmpty
                ? Center(
                    child: Text(
                      storeName?.substring(0, 1).toUpperCase() ?? 'S',
                      style: TextStyle(
                        fontSize: isCompact ? 18 : 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  )
                : null,
          ),
          // Online indicator
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: isCompact ? 12 : 14,
              height: isCompact ? 12 : 14,
              decoration: BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isDark ? const Color(0xFF0D1117) : Colors.white,
                  width: 2.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.4),
                    blurRadius: 6,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().scale(duration: 400.ms, curve: Curves.easeOutBack);
  }

  /// Action button with glassmorphic style
  Widget _buildActionButton({
    required bool isDark,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: isDark 
              ? Colors.white.withValues(alpha: 0.08) 
              : Colors.black.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(
            color: isDark 
                ? Colors.white.withValues(alpha: 0.1) 
                : Colors.black.withValues(alpha: 0.08),
          ),
        ),
        child: Icon(
          icon,
          color: isDark ? Colors.white70 : AppColors.textSecondary,
          size: 20,
        ),
      ),
    );
  }

  /// Notification bell with animated badge
  Widget _buildNotificationBell(bool isDark, Color textColor) {
    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, _) {
        final unreadCount = notificationProvider.unreadCount;
        final hasUnread = unreadCount > 0;
        
        return GestureDetector(
          onTap: () => Navigator.pushNamed(context, AppRoutes.notifications),
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: hasUnread
                  ? LinearGradient(
                      colors: [
                        AppColors.error.withValues(alpha: 0.15),
                        AppColors.error.withValues(alpha: 0.08),
                      ],
                    )
                  : null,
              color: hasUnread 
                  ? null 
                  : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05)),
              shape: BoxShape.circle,
              border: Border.all(
                color: hasUnread 
                    ? AppColors.error.withValues(alpha: 0.3)
                    : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.08)),
              ),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  Icons.notifications_outlined,
                  color: hasUnread ? AppColors.error : (isDark ? Colors.white70 : AppColors.textSecondary),
                  size: 22,
                ),
                if (hasUnread)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.error.withValues(alpha: 0.4),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Text(
                        unreadCount > 9 ? '9+' : '$unreadCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ).animate(
            onPlay: (controller) => hasUnread ? controller.repeat() : null,
          ).shimmer(
            duration: hasUnread ? 2.seconds : 0.ms,
            color: hasUnread ? AppColors.error.withValues(alpha: 0.3) : Colors.transparent,
          ),
        );
      },
    );
  }

  /// Quick stat chip
  Widget _buildQuickStat(bool isDark, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white54 : AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String _formatCompact(double value) {
    if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)}Cr';
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toStringAsFixed(0);
  }

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(_bgAnimController.value * 2 * math.pi) * 0.3,
                math.cos(_bgAnimController.value * 2 * math.pi) * 0.3,
              ),
              radius: 1.5,
              colors: isDark
                  ? [AppColors.surfaceDark, AppColors.backgroundDark, AppColors.backgroundDark.withValues(alpha: 0.9)]
                  : [AppColors.surface, AppColors.background, AppColors.surfaceVariant],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: -100,
        right: -100,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, _floatController.value * 30),
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.05),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      Positioned(
        bottom: 50,
        left: -50,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, -_floatController.value * 30),
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF8B5CF6).withValues(alpha: 0.15), // Violet orb
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.05),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  Widget _buildLoadingState(bool isDark) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 16),
          Text(
            'Preparing Dashboard...',
            style: TextStyle(color: textColor.withValues(alpha: 0.5)),
          ),
        ],
      ),
    );
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.03});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? AppColors.textLight : AppColors.textPrimary).withValues(alpha: opacity)
      ..strokeWidth = 1;

    const double gridSize = 40;

    for (double x = 0; x < size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    for (double y = 0; y < size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
