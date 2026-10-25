import 'dart:async';

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';

import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../services/analytics_service.dart';
import '../../services/app_badge_service.dart';
import '../../services/home_widget_service.dart';
import '../../services/store_service.dart';
import '../../services/subscription_service.dart';
import '../../models/store_model.dart';
import '../../app/routes.dart';
import '../../config/app_config.dart';
import '../customize/theme_screen.dart';
import '../../theme/app_theme_colors.dart';
// bento_grid and glass_stat_card available but not used on this screen
import '../../widgets/dashboard/hero_store_card.dart';
import '../../widgets/dashboard/skeleton_loader.dart';
import '../../widgets/dashboard/quick_actions_grid.dart';
import '../../widgets/dashboard/animated_revenue_chart.dart';
import '../../widgets/dashboard/activity_timeline.dart';
import '../../widgets/dashboard/premium_header.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import '../../widgets/shared/provider_mode_badge.dart';

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
  MerchantBillingState? _billing;
  int _loadVersion = 0;
  int? _loadedEpoch;
  String? _loadError;
  Map<String, dynamic>? _payoutSummary;
  String? _dashboardProviderMode;
  bool _isLoading = true;
  bool _isPublishing = false;
  String _selectedPeriod = '30 Days';

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    final version = ++_loadVersion;
    setState(() {
      _isLoading = true;
      _billing = null;
      _store = null;
      _loadedEpoch = null;
      _loadError = null;
    });
    final storeContext = context.read<StoreContext>();
    final epoch = storeContext.requestContextVersion;
    final analyticsService = context.read<AnalyticsService>();
    final appBadgeService = context.read<AppBadgeService>();
    final homeWidgetService = context.read<HomeWidgetService>();

    try {
      final store = await storeContext.ensureSelectedStore();
      MerchantBillingState? billing;
      StoreAnalytics? analytics;
      Map<String, dynamic>? payoutSummary;
      String? providerMode;
      if (store != null) {
        try {
          billing = await context.read<SubscriptionService>().fetchBillingState(
            store.id,
          );
        } catch (_) {}
        try {
          final snapshot = await analyticsService.getMobileDashboardSnapshot(
            store.id,
            period: _analyticsPeriod,
          );
          analytics = snapshot.analytics;
          payoutSummary = snapshot.payoutSummary;
          providerMode = snapshot.providerMode;
        } catch (dashboardError) {
          debugPrint(
            'Error loading mobile dashboard composite: $dashboardError',
          );
        }
      }
      if (!mounted || version != _loadVersion) return;
      if (epoch != storeContext.requestContextVersion ||
          storeContext.selectedStoreId != store?.id)
        throw StateError('Store changed');
      setState(() {
        _loadedEpoch = epoch;
        _billing = billing;
        _store = store;
        _analytics = analytics;
        _payoutSummary = payoutSummary;
        _dashboardProviderMode = providerMode;
      });
      if (store != null && analytics != null) {
        unawaited(
          homeWidgetService.publishDashboardSnapshot(
            store: store,
            analytics: analytics,
          ),
        );
        unawaited(
          appBadgeService.syncOpenOrderBadgeFromStatusCounts(
            analytics.ordersByStatus,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error loading store: $e');
      if (mounted && version == _loadVersion)
        setState(() => _loadError = 'Store details could not load. Try again.');
    } finally {
      if (mounted && version == _loadVersion) {
        setState(() => _isLoading = false);
      }
    }
  }

  String get _analyticsPeriod {
    switch (_selectedPeriod) {
      case '7 Days':
        return '7d';
      case '90 Days':
        return '90d';
      case '12 Months':
        return '12m';
      case '30 Days':
      default:
        return '30d';
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
    final storeContext = context.watch<StoreContext>();
    if (_loadError != null)
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_loadError!),
                FilledButton(
                  onPressed: _loadStore,
                  child: const Text('Retry store details'),
                ),
              ],
            ),
          ),
        ),
      );
    final stale =
        _loadedEpoch != null &&
        (_loadedEpoch != storeContext.requestContextVersion ||
            _store?.id != storeContext.selectedStoreId);
    if (stale && !_isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_isLoading) _loadStore();
      });
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final headerBg = isDark ? const Color(0xFF0A0912) : const Color(0xFFFAF9FF);
    final colors = AppThemeColors.of(context);
    final cardBg = isDark ? const Color(0xFF100E1C) : Colors.white;

    return Scaffold(
      backgroundColor: headerBg, // status bar inherits this color
      body: Column(
        children: [
          // ── Status bar + header — flat, solid, same primary bg ────────────
          SafeArea(
            bottom: false,
            child: ColoredBox(
              color: headerBg,
              child: _isLoading || stale || _store == null
                  ? const SizedBox(height: 62)
                  : PremiumHeader(
                      isDark: isDark,
                      onStoreChanged: _loadStore,
                      onNotificationTap: () =>
                          Navigator.pushNamed(context, AppRoutes.notifications),
                    ),
            ),
          ),
          // ── Content card — rounded top, contrasting surface ─────────────
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(28),
                topRight: Radius.circular(28),
              ),
              child: Container(
                color: cardBg,
                child: _isLoading || stale
                    ? const SkeletonLoader()
                    : _store == null
                    ? _buildNoStore(colors)
                    : _buildDashboard(colors),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboard(AppThemeColors colors) {
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
            const SizedBox(height: 20),

            // Hero Store Card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: HeroStoreCard(
                store: _store!,
                storefrontUrl: AppConfig.storefrontUrlFor(
                  subdomain: _store!.subdomain,
                  publicUrl: _store!.publicUrl,
                ),
                billing: _billing,
                onPlanTap: () async {
                  await Navigator.pushNamed(context, AppRoutes.pricing);
                  if (mounted) await _loadStore();
                },
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
                  Semantics(
                    key: const ValueKey('dashboard-period-picker'),
                    container: true,
                    excludeSemantics: true,
                    button: true,
                    enabled: true,
                    label: 'Dashboard reporting period',
                    hint: 'Current reporting period: $_selectedPeriod',
                    onTap: () => _showPeriodPicker(colors),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: InkWell(
                        excludeFromSemantics: true,
                        onTap: () => _showPeriodPicker(colors),
                        borderRadius: BorderRadius.circular(8),
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
                        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
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
              child:
                  AnimatedRevenueChart(
                        totalRevenue: revenue,
                        period: _analyticsPeriod,
                        revenueDates:
                            analytics?.dailyStats
                                .map((day) => day.date)
                                .toList(growable: false) ??
                            const [],
                        onPeriodChanged: (period) {
                          setState(
                            () => _selectedPeriod = const {
                              '7d': '7 Days',
                              '30d': '30 Days',
                              '90d': '90 Days',
                              '12m': '12 Months',
                            }[period]!,
                          );
                          _loadStore();
                        },
                        revenueData:
                            analytics?.dailyStats
                                .map((day) => day.revenue)
                                .toList(growable: false) ??
                            const <double>[],
                      )
                      .animate(delay: 200.ms)
                      .fadeIn(duration: 400.ms)
                      .slideY(begin: 0.1, end: 0),
            ),

            const SizedBox(height: 24),

            // Quick Actions & Activity Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _buildPayoutVisibilityCard(colors),
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
                              productCount: totalProducts,
                              onEditorTap: () => Navigator.push(
                                context,
                                MaterialPageRoute<void>(
                                  builder: (_) => const ThemeScreen(),
                                ),
                              ),
                              onProductsTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.products,
                              ),
                              onOrdersTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.orders,
                              ),
                              onAnalyticsTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.analytics,
                              ),
                              onSettingsTap: () => Navigator.pushNamed(
                                context,
                                AppRoutes.storeDetails,
                              ),
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

  void _showPeriodPicker(AppThemeColors colors) {
    final periods = ['7 Days', '30 Days', '90 Days', '12 Months'];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Material(
          type: MaterialType.transparency,
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
                    _loadStore();
                  },
                  leading: Icon(
                    _selectedPeriod == period
                        ? Icons.radio_button_checked_rounded
                        : Icons.radio_button_off_rounded,
                    color: _selectedPeriod == period
                        ? mobile_tokens.LetbuyyColorTokens.brandPrimary
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
                          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                          size: 18,
                        )
                      : null,
                ),
              ),
              SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
            ],
          ),
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

  Widget _buildPayoutVisibilityCard(AppThemeColors colors) {
    final next = _payoutSummary?['next_payout'];
    final nextPayout = next is Map ? Map<String, dynamic>.from(next) : null;
    final amountMinor = (nextPayout?['net_amount_minor'] as num?)?.toDouble();
    final amount = amountMinor == null
        ? 'No payout scheduled'
        : '₹${_formatMoney(amountMinor / 100)}';
    final subtitle = nextPayout == null
        ? 'Paid orders will appear here when settlement is ready.'
        : '${nextPayout['status'] ?? 'pending'} · ${nextPayout['available_on'] ?? 'available soon'}';
    final providerMode = ProviderMode.parse(
      _dashboardProviderMode ?? _payoutSummary?['provider_mode'],
    );

    void openMoney() => Navigator.pushNamed(context, AppRoutes.money);

    return AccessibleTapRegion(
      label: 'Next payout, $amount. $subtitle',
      hint: 'Open Money and payouts',
      onTap: openMoney,
      excludeChildSemantics: true,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          excludeFromSemantics: true,
          onTap: openMoney,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.glassMedium,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.24,
                ),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.account_balance_wallet_outlined,
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Next payout',
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        amount,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                ProviderModeBadge(mode: providerMode, compact: true),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right_rounded, color: colors.textSecondary),
              ],
            ),
          ),
        ),
      ),
    );
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
              const SizedBox(width: 6),
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: isPositive
                        ? colors.success.withValues(alpha: 0.15)
                        : colors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    trend,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: isPositive ? colors.success : colors.warning,
                    ),
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
