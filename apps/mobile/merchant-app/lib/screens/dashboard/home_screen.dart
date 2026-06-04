import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/analytics_service.dart';
import '../../services/store_service.dart';
import '../../services/store_auth_service.dart';
import '../../models/store_model.dart';
import '../../app/routes.dart';
import '../../theme/app_theme_colors.dart';
// bento_grid and glass_stat_card available but not used on this screen
import '../../widgets/dashboard/hero_store_card.dart';
import '../../widgets/dashboard/skeleton_loader.dart';
import '../../widgets/dashboard/quick_actions_grid.dart';
import '../../widgets/dashboard/animated_revenue_chart.dart';
import '../../widgets/dashboard/activity_timeline.dart';

/// Premium Enhanced Dashboard - Bento Grid Layout
/// Modern 2025/2026 UI with glassmorphism, micro-interactions, and animations
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  StoreModel? _store;
  StoreAnalytics? _analytics;
  bool _isLoading = true;
  bool _isPublishing = false;
  String _selectedPeriod = '30 Days';

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      StoreAnalytics? analytics;
      if (store != null) {
        try {
          analytics = await context.read<AnalyticsService>().getStoreAnalytics(
            store.id,
          );
        } catch (analyticsError) {
          debugPrint('Error loading dashboard analytics: $analyticsError');
        }
      }
      setState(() {
        _store = store;
        _analytics = analytics;
      });
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _togglePublish() async {
    if (_store == null || _isPublishing) return;

    setState(() => _isPublishing = true);
    try {
      final storeService = context.read<StoreService>();
      if (_store!.isPublished) {
        await storeService.unpublishStore(_store!.id);
      } else {
        await storeService.publishStore(_store!.id);
      }
      await _loadStore();
      HapticFeedback.mediumImpact();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      setState(() => _isPublishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: Stack(
          children: [
            // Mesh gradient overlay for premium effect
            Positioned(
              top: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      colors.accent.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Main content
            SafeArea(
              child: _isLoading
                  ? const SkeletonLoader()
                  : _store == null
                  ? _buildNoStore(colors)
                  : _buildDashboard(colors),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(AppThemeColors colors) {
    final authService = context.read<StoreAuthService>();
    final userName =
        authService.currentUser?.userMetadata?['full_name'] as String? ??
        authService.currentUser?.email?.split('@').first ??
        'there';
    final firstName = userName.split(' ').first;

    final analytics = _analytics;
    final totalOrders = analytics?.totalOrders ?? _store!.totalOrders;
    final totalProducts = analytics?.totalProducts ?? _store!.productCount;
    final totalVisitors = (analytics?.totalViews ?? 0) > 0
        ? analytics!.totalViews
        : _store!.totalVisitors;
    final revenue = analytics?.totalRevenue ?? 0.0;
    final averageOrderValue =
        analytics?.averageOrderValue ??
        (totalOrders > 0 ? revenue / totalOrders : 0.0);
    final convRate = totalVisitors > 0
        ? (totalOrders / totalVisitors * 100).toStringAsFixed(1)
        : '0';

    // Build activity items
    final activities = <ActivityItem>[];
    if (_store!.isPublished) {
      activities.add(ActivityItems.storePublished(_store!.publishedAt));
    }
    if (_store!.totalOrders > 0) {
      activities.add(ActivityItems.ordersReceived(totalOrders));
    }
    if (totalVisitors > 0) {
      activities.add(ActivityItems.visitorMilestone(totalVisitors));
    }

    return RefreshIndicator(
      onRefresh: _loadStore,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Premium Header
            _buildHeader(firstName, colors),

            const SizedBox(height: 20),

            // Hero Store Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: HeroStoreCard(
                store: _store!,
                onPublishToggle: _togglePublish,
                isPublishing: _isPublishing,
              ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0),
            ),

            const SizedBox(height: 24),

            // Stats Section Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Performance',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                  // Period Dropdown
                  GestureDetector(
                    onTap: () => _showPeriodPicker(colors),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: colors.glassMedium,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.glassMediumBorder),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _selectedPeriod,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 14,
                            color: colors.textSecondary,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
            ),

            const SizedBox(height: 12),

            // Stats 2x3 Horizontal Scroll
            SizedBox(
              height: 180,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  // Column 1
                  Column(
                    children: [
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.shopping_bag_outlined,
                        label: 'Orders',
                        value: totalOrders.toString(),
                        trend: analytics == null ? 'Store' : 'Gateway',
                        color: const Color(0xFF3B82F6),
                      ),
                      const SizedBox(height: 8),
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.account_balance_wallet_outlined,
                        label: 'Revenue',
                        value: '₹${_formatMoney(revenue)}',
                        trend: analytics == null ? 'Pending' : 'Gateway',
                        color: const Color(0xFF10B981),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  // Column 2
                  Column(
                    children: [
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.visibility_outlined,
                        label: 'Visitors',
                        value: _formatNumber(totalVisitors),
                        trend: totalVisitors > 0 ? 'Store' : 'Pending',
                        color: const Color(0xFF8B5CF6),
                      ),
                      const SizedBox(height: 8),
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.inventory_2_outlined,
                        label: 'Products',
                        value: totalProducts.toString(),
                        trend: totalProducts > 0 ? 'Catalog' : 'Add',
                        color: const Color(0xFFF59E0B),
                        isPositive: totalProducts > 0,
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  // Column 3
                  Column(
                    children: [
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.speed_outlined,
                        label: 'Conv. Rate',
                        value: '$convRate%',
                        trend: totalVisitors > 0 ? 'Computed' : 'Pending',
                        color: const Color(0xFFEC4899),
                      ),
                      const SizedBox(height: 8),
                      _buildCompactStatCard(
                        colors: colors,
                        icon: Icons.receipt_long_outlined,
                        label: 'Avg. Order',
                        value: '₹${_formatMoney(averageOrderValue)}',
                        trend: totalOrders > 0 ? 'Computed' : 'Pending',
                        color: const Color(0xFF06B6D4),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Revenue Chart
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AnimatedRevenueChart(totalRevenue: revenue)
                  .animate(delay: 200.ms)
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.1, end: 0),
            ),

            const SizedBox(height: 24),

            // Quick Actions & Activity Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Quick Actions (2/3 width)
                  Expanded(
                    flex: 2,
                    child:
                        QuickActionsGrid(
                              productCount: _store!.selectedProductIds.length,
                              onEditorTap: () => _showTabHint('Editor'),
                              onProductsTap: () => _showTabHint('Products'),
                              onOrdersTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.orders,
                              ),
                              onAnalyticsTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.analytics,
                              ),
                              onSettingsTap: () => _showTabHint('Settings'),
                            )
                            .animate(delay: 300.ms)
                            .fadeIn(duration: 400.ms)
                            .slideY(begin: 0.1, end: 0),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Activity Timeline
            if (activities.isNotEmpty || !_store!.isPublished)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child:
                    ActivityTimeline(
                          activities: activities.isEmpty
                              ? [ActivityItems.readyToLaunch()]
                              : activities,
                          showEmpty: !_store!.isPublished && activities.isEmpty,
                        )
                        .animate(delay: 400.ms)
                        .fadeIn(duration: 400.ms)
                        .slideY(begin: 0.1, end: 0),
              ),

            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String firstName, AppThemeColors colors) {
    final greetingTime = _getGreetingTime();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          // Avatar with gradient border
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              gradient: colors.heroGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: colors.elevation1,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(
                  firstName[0].toUpperCase(),
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  greetingTime,
                  style: TextStyle(fontSize: 13, color: colors.textSecondary),
                ),
                Text(
                  firstName,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          // Notifications button
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.glassMedium,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.glassMediumBorder),
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: Icon(
                Icons.notifications_outlined,
                size: 20,
                color: colors.textSecondary,
              ),
              onPressed: () {},
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideX(begin: -0.1, end: 0);
  }

  String _getGreetingTime() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }

  void _showTabHint(String tabName) {
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Tap the $tabName tab below'),
        duration: const Duration(seconds: 1),
        backgroundColor: colors.elevation2,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showPeriodPicker(AppThemeColors colors) {
    final periods = ['7 Days', '30 Days', '3 Months', '6 Months', '1 Year'];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Select Period',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            ...periods.map(
              (period) => ListTile(
                onTap: () {
                  setState(() => _selectedPeriod = period);
                  Navigator.pop(context);
                },
                leading: Icon(
                  _selectedPeriod == period
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: _selectedPeriod == period
                      ? const Color(0xFF8B5CF6)
                      : colors.textSecondary,
                  size: 20,
                ),
                title: Text(
                  period,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: _selectedPeriod == period
                        ? FontWeight.w600
                        : FontWeight.w500,
                    color: _selectedPeriod == period
                        ? colors.textPrimary
                        : colors.textSecondary,
                  ),
                ),
                trailing: _selectedPeriod == period
                    ? const Icon(
                        Icons.check_rounded,
                        color: Color(0xFF8B5CF6),
                        size: 18,
                      )
                    : null,
              ),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
          ],
        ),
      ),
    );
  }

  String _formatNumber(int number) {
    if (number >= 100000) return '${(number / 100000).toStringAsFixed(1)}L';
    if (number >= 1000) return '${(number / 1000).toStringAsFixed(1)}K';
    return number.toString();
  }

  String _formatMoney(double amount) {
    if (amount >= 100000) return '${(amount / 100000).toStringAsFixed(1)}L';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(1)}K';
    return amount.toStringAsFixed(0);
  }

  Widget _buildCompactStatCard({
    required IconData icon,
    required String label,
    required String value,
    required String trend,
    required Color color,
    required AppThemeColors colors,
    bool isPositive = true,
  }) {
    return Container(
      width: 130,
      height: 86,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top row: Icon + Trend
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 14),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isPositive
                      ? colors.success.withValues(alpha: 0.15)
                      : colors.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  trend,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    color: isPositive ? colors.success : colors.warning,
                  ),
                ),
              ),
            ],
          ),
          // Bottom: Value + Label
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                  height: 1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNoStore(AppThemeColors colors) {
    return Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    gradient: colors.heroGradient,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: colors.accent.withValues(alpha: 0.3),
                        blurRadius: 24,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.store_rounded,
                    color: Colors.white,
                    size: 48,
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'Create Your Store',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Set up your online store in minutes\nand start selling today',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.createStore),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.accent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      'Get Started',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        )
        .animate()
        .fadeIn(duration: 500.ms)
        .scale(begin: const Offset(0.95, 0.95), end: const Offset(1, 1));
  }
}
