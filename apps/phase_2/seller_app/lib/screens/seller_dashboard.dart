// lib/screens/seller/seller_dashboard.dart
// 🏪 ULTRA-PROFESSIONAL SELLER DASHBOARD
// Advanced Teal/Green Theme with Premium UI/UX

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../l10n/generated/app_localizations.dart';
import '../providers/seller_provider.dart';
import '../providers/notification_provider.dart';
import '../app/routes.dart';

class SellerDashboard extends StatefulWidget {
  const SellerDashboard({super.key});

  @override
  State<SellerDashboard> createState() => _SellerDashboardState();
}

class _SellerDashboardState extends State<SellerDashboard> with SingleTickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final currencyFormat = NumberFormat('#,##,##0', 'en_IN');
  
  // Animation
  late AnimationController _animController;
  
  // Dashboard Data
  bool _isLoading = true;
  double _totalRevenue = 0.0;
  double _todayRevenue = 0.0;
  int _newOrders = 0;
  int _processingOrders = 0;
  final int _totalOrders = 0;
  int _totalProducts = 0;
  int _activeProducts = 0;
  int _totalCustomers = 0;
  double _walletBalance = 0.0;
  double _pendingAmount = 0.0;
  double _rating = 0.0;
  
  List<Map<String, dynamic>> _recentOrders = [];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800));
    _loadDashboardData();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().initNotifications();
      _animController.forward();
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadDashboardData() async {
    final sellerProvider = context.read<SellerProvider>();
    final sellerId = sellerProvider.sellerId;
    if (sellerId == null) return;

    if (mounted) setState(() => _isLoading = true);

    try {
      // 1. Get Seller Data
      final seller = sellerProvider.currentSeller;
      if (seller != null) {
        _totalRevenue = seller.totalRevenue;
        _walletBalance = seller.walletBalance;
        _pendingAmount = seller.pendingAmount;
        _rating = seller.rating;
      }

      // 2. Get Products (Optimized Count)
      final productsQuery = await _firestore
          .collection('products')
          .where('sellerId', isEqualTo: sellerId)
          .get();
      
      _totalProducts = productsQuery.size;
      _activeProducts = productsQuery.docs
          .where((doc) => doc.data()['isActive'] == true)
          .length;

      // 3. Get Recent Orders & Today's Stats
      final now = DateTime.now();
      final startOfDay = DateTime(now.year, now.month, now.day);

      final ordersQuery = await _firestore
          .collection('orders')
          .where('sellerId', isEqualTo: sellerId)
          .orderBy('createdAt', descending: true)
          .limit(20) // Limit to last 20 for efficient specific stats
          .get();

      // For total count, we might need a separate count query or aggregation if scale is large, 
      // but for now relying on SellerModel's totalOrders or this snapshot for small scale.
      // Better to trust the query for recent data.
      
      // Calculate today's stats from refined query or fallback
      var todayOrders = ordersQuery.docs.where((doc) {
        final date = (doc.data()['createdAt'] as Timestamp).toDate();
        return date.isAfter(startOfDay);
      });

      _todayRevenue = todayOrders.fold(0.0, (sum, doc) => sum + (doc.data()['total'] ?? 0));
      _newOrders = todayOrders.length;
      
      // Process recent order list
      _recentOrders = ordersQuery.docs.take(5).map((doc) {
        final data = doc.data();
        return {
          'id': doc.id,
          'orderNumber': data['orderNumber'] ?? 'Unknown',
          'customerName': data['customerName'] ?? 'Customer',
          'total': (data['total'] ?? 0).toDouble(),
          'status': data['status'] ?? 'pending',
          'createdAt': (data['createdAt'] as Timestamp).toDate(),
          'itemsCount': (data['items'] as List?)?.length ?? 0,
        };
      }).toList();

      // Stats from collection aggregation (or simpler local calculation for now)
      _processingOrders = ordersQuery.docs.where((d) => d.data()['status'] == 'processing').length;
      _totalCustomers = ordersQuery.docs.map((d) => d.data()['customerId']).toSet().length;

      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      debugPrint('Dashboard Error: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final seller = context.watch<SellerProvider>().currentSeller;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: _isLoading 
        ? _buildLoadingState(isDark) 
        : RefreshIndicator(
            onRefresh: _loadDashboardData,
            color: AppColors.primary,
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                _buildSliverAppBar(isDark, seller?.storeName),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildTodayOverview(isDark),
                        const SizedBox(height: 24),
                        _buildSectionTitle(AppLocalizations.of(context)?.revenue ?? 'Business Insights', isDark),
                        const SizedBox(height: 16),
                        _buildMetricsGrid(isDark),
                        const SizedBox(height: 24),
                        _buildSectionTitle(AppLocalizations.of(context)?.quickActions ?? 'Quick Actions', isDark),
                        const SizedBox(height: 16),
                        _buildQuickActions(isDark),
                        const SizedBox(height: 24),
                        _buildSectionTitle(AppLocalizations.of(context)?.recentOrders ?? 'Recent Orders', isDark, action: AppLocalizations.of(context)?.viewAll ?? 'View All', onTap: () {
                          Navigator.pushNamed(context, AppRoutes.sellerOrders);

                        }),
                        const SizedBox(height: 16),
                        _buildRecentOrders(isDark),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
    );
  }

  // ==========================================
  // 🎨 WIDGETS
  // ==========================================

  Widget _buildSliverAppBar(bool isDark, String? storeName) {
    return SliverAppBar(
      expandedHeight: 140,
      floating: true,
      pinned: true,
      elevation: 0,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.primary,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: BoxDecoration(
            gradient: isDark ? AppColors.backgroundGradientDark : AppColors.primaryGradient,
          ),
          child: Stack(
            children: [
              // Decorative Circles
              Positioned(
                right: -30, top: -20,
                child: Container(
                  width: 150, height: 150,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                left: 20, bottom: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Welcome back,',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      storeName ?? 'Seller Portal',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined, color: Colors.white),
          onPressed: () => Navigator.pushNamed(context, AppRoutes.notifications),
        ),
        IconButton(
          icon: const Icon(Icons.settings_outlined, color: Colors.white),
          onPressed: () => Navigator.pushNamed(context, AppRoutes.sellerSettings),
        ),
      ],
    );
  }

  Widget _buildTodayOverview(bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: isDark 
          ? AppColors.primaryGradientDark 
          : AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "TODAY'S REVENUE",
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '₹${currencyFormat.format(_todayRevenue)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.trending_up_rounded, color: Colors.white, size: 28),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              _buildStatPill('$_newOrders', 'New Orders', Icons.shopping_bag_outlined),
              const SizedBox(width: 12),
              _buildStatPill('$_processingOrders', 'Processing', Icons.local_shipping_outlined),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatPill(String value, String label, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricsGrid(bool isDark) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: 1.5,
      children: [
        _buildMetricCard(
          isDark,
          title: 'Total Sales',
          value: '₹${currencyFormat.format(_totalRevenue)}',
          icon: Icons.account_balance_wallet_rounded,
          color: AppColors.success,
        ),
        _buildMetricCard(
          isDark,
          title: 'Products',
          value: '$_totalProducts',
          subtitle: '$_activeProducts Active',
          icon: Icons.inventory_2_rounded,
          color: AppColors.primary,
        ),
        _buildMetricCard(
          isDark,
          title: 'Customers',
          value: '$_totalCustomers',
          icon: Icons.people_rounded,
          color: AppColors.warning,
        ),
        _buildMetricCard(
          isDark,
          title: 'Rating',
          value: _rating.toStringAsFixed(1),
          icon: Icons.star_rounded,
          color: AppColors.wallet,
        ),
      ],
    );
  }

  Widget _buildMetricCard(bool isDark, {
    required String title,
    required String value,
    String? subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowLight,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                title,
                style: TextStyle(
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(bool isDark) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          _buildActionChip(isDark, 'Add Product', Icons.add_rounded, AppColors.primary, () {
            Navigator.pushNamed(context, AppRoutes.sellerProducts);
          }),
          const SizedBox(width: 12),
          _buildActionChip(isDark, 'My Orders', Icons.shopping_bag_rounded, AppColors.info, () {
            Navigator.pushNamed(context, AppRoutes.sellerOrders);
          }),
          const SizedBox(width: 12),
          _buildActionChip(isDark, 'Wallet', Icons.account_balance_rounded, AppColors.wallet, () {
            Navigator.pushNamed(context, AppRoutes.sellerWallet);
          }),
          const SizedBox(width: 12),
          _buildActionChip(isDark, 'Reports', Icons.bar_chart_rounded, AppColors.secondary, () {
            Navigator.pushNamed(context, AppRoutes.sellerAnalytics);
          }),
        ],
      ),
    );
  }

  Widget _buildActionChip(bool isDark, String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.1),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentOrders(bool isDark) {
    if (_recentOrders.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        width: double.infinity,
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        child: Column(
          children: [
            Icon(Icons.inbox_rounded, 
              size: 48, 
              color: isDark ? AppColors.textLightDisabled : AppColors.textDisabled
            ),
            const SizedBox(height: 12),
            Text(
              'No new orders yet',
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _recentOrders.asMap().entries.map((entry) {
        final order = entry.value;
        final index = entry.key;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _buildOrderCard(isDark, order),
        );
      }).toList(),
    );
  }

  Widget _buildOrderCard(bool isDark, Map<String, dynamic> order) {
    final statusColor = AppColors.getOrderStatusColor(order['status']);
    
    return InkWell(
      onTap: () => Navigator.pushNamed(context, AppRoutes.sellerOrders, arguments: order['id']),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.shadowLight,
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 50, height: 50,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.shopping_bag_rounded, color: statusColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '#${order['orderNumber']}',
                        style: TextStyle(
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          order['status'].toString().toUpperCase(),
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${order['customerName']} • ${order['itemsCount']} items',
                        style: TextStyle(
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        '₹${currencyFormat.format(order['total'])}',
                        style: TextStyle(
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark, {String? action, VoidCallback? onTap}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onTap,
            child: Text(
              action,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 20),
          Text(
            'Updating Dashboard...',
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
