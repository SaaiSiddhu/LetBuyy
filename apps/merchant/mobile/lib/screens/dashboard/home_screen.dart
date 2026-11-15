import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../app/routes.dart';
import '../../config/app_config.dart';
import '../../models/store_model.dart';
import '../../services/analytics_service.dart';
import '../../services/app_badge_service.dart';
import '../../services/home_widget_service.dart';
import '../../services/store_service.dart';
import '../../services/subscription_service.dart';
import '../customize/theme_screen.dart';
import '../../widgets/dashboard/activity_timeline.dart';
import '../../widgets/dashboard/animated_revenue_chart.dart';
import '../../widgets/dashboard/hero_store_card.dart';
import '../../widgets/dashboard/premium_header.dart';
import '../../widgets/dashboard/quick_actions_grid.dart';
import '../../widgets/dashboard/skeleton_loader.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import '../../widgets/shared/provider_mode_badge.dart';

/// The dashboard presents existing composite/billing reads. StoreContext owns
/// selection and the services retain all publication and persistence authority.
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
  Object? _requestedViewKey;
  Object? _loadedViewKey;
  Object? _publishingViewKey;
  Object? _publication;
  bool _resolvingSelection = false;
  bool _reloadScheduled = false;
  bool _periodOpening = false;
  final _periodFocus = FocusNode(debugLabel: 'Dashboard reporting period');
  String? _loadError;
  Map<String, dynamic>? _payoutSummary;
  String? _dashboardProviderMode;
  bool _isLoading = true;
  String _selectedPeriod = '30 Days';

  bool get _isPublishing =>
      _publication != null && _publishingViewKey == _loadedViewKey;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  @override
  void dispose() {
    _loadVersion++;
    _periodFocus.dispose();
    super.dispose();
  }

  bool _currentView(Object? key, {String? storeId}) =>
      mounted &&
      key != null &&
      context.read<StoreContext>().requestContextKey == key &&
      (storeId == null ||
          context.read<StoreContext>().selectedStoreId == storeId);

  Future<void> _loadStore() async {
    if (!mounted) return;
    final stores = context.read<StoreContext>();
    final version = ++_loadVersion;
    final epoch = stores.requestContextVersion;
    final startingStore = stores.selectedStoreId;
    var viewKey = stores.requestContextKey;
    // A query owns its period before any optional read can wait.
    final period = _analyticsPeriod;
    final analyticsService = context.read<AnalyticsService>();
    final billingService = context.read<SubscriptionService>();
    final appBadgeService = context.read<AppBadgeService>();
    final homeWidgetService = context.read<HomeWidgetService>();
    bool current() => version == _loadVersion && _currentView(viewKey);
    setState(() {
      _requestedViewKey = viewKey;
      _resolvingSelection = true;
      _isLoading = true;
      _billing = null;
      _store = null;
      _analytics = null;
      _payoutSummary = null;
      _dashboardProviderMode = null;
      _loadedViewKey = null;
      _loadError = null;
    });
    try {
      final store = await stores.ensureSelectedStore();
      if (!mounted || version != _loadVersion) return;
      // Initial discovery may select a store. An already selected frame may
      // never adopt a later A -> B -> A selection or a different actor.
      if (epoch != stores.requestContextVersion ||
          (startingStore != null && stores.requestContextKey != viewKey) ||
          stores.selectedStoreId != store?.id) {
        return;
      }
      viewKey = stores.requestContextKey;
      _requestedViewKey = viewKey;
      _resolvingSelection = false;
      MerchantBillingState? billing;
      StoreAnalytics? analytics;
      Map<String, dynamic>? payoutSummary;
      String? providerMode;
      if (store != null) {
        try {
          billing = await billingService.fetchBillingState(store.id);
        } catch (_) {
          // An optional billing failure is unavailable, not a guessed quota.
        }
        if (!current()) return;
        try {
          final snapshot = await analyticsService.getMobileDashboardSnapshot(
            store.id,
            period: period,
          );
          analytics = snapshot.analytics;
          payoutSummary = snapshot.payoutSummary;
          providerMode = snapshot.providerMode;
        } catch (_) {
          // Preserve the existing partial dashboard contract and expose retry.
        }
        if (!current()) return;
      }
      if (!current()) return;
      setState(() {
        _loadedViewKey = viewKey;
        _billing = billing;
        _store = store;
        _analytics = analytics;
        _payoutSummary = payoutSummary;
        _dashboardProviderMode = providerMode;
      });
      if (store != null && analytics != null && analytics.summaryAvailable) {
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
    } catch (_) {
      if (current()) {
        setState(() => _loadError = 'Store details could not load. Try again.');
      }
    } finally {
      if (mounted && version == _loadVersion) {
        setState(() {
          _resolvingSelection = false;
          if (current()) _isLoading = false;
        });
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
    final store = _store, viewKey = _loadedViewKey;
    if (store == null ||
        !_currentView(viewKey, storeId: store.id) ||
        _isPublishing) {
      return;
    }
    final publication = Object();
    final service = context.read<StoreService>();
    bool current() =>
        identical(_publication, publication) &&
        _currentView(viewKey, storeId: store.id);
    setState(() {
      _publication = publication;
      _publishingViewKey = viewKey;
    });
    try {
      if (store.isPublished) {
        await service.unpublishStore(store.id);
      } else {
        await service.publishStore(store.id);
      }
      if (!current()) return;
      // The command acknowledgement does not refresh StoreContext's cached
      // member model. Reuse its existing authorized reader before presenting
      // the changed publication state; no caller-supplied model is adopted.
      await context.read<StoreContext>().reloadSelectedStore(store.id);
      if (!current()) return;
      await _loadStore();
      if (current()) HapticFeedback.mediumImpact();
    } catch (_) {
      if (current()) {
        showLetbuyyOperationFeedback(
          context,
          message:
              'The publication result could not be confirmed. Refresh store details before trying again.',
          isError: true,
        );
      }
    } finally {
      if (current()) {
        setState(() {
          _publication = null;
          _publishingViewKey = null;
        });
      }
    }
  }

  Future<void> _openStoreDetails() async {
    final key = _loadedViewKey, storeId = _store?.id;
    if (storeId == null || !_currentView(key, storeId: storeId)) return;
    await Navigator.pushNamed(context, AppRoutes.storeDetails);
    if (_currentView(key, storeId: storeId)) await _loadStore();
  }

  void _scheduleCurrentRead(StoreContext stores) {
    if (_requestedViewKey == stores.requestContextKey ||
        stores.selectedStoreId == null ||
        _resolvingSelection ||
        _reloadScheduled) {
      return;
    }
    _reloadScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _reloadScheduled = false;
      if (mounted && _requestedViewKey != stores.requestContextKey)
        _loadStore();
    });
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    final stale = _requestedViewKey != stores.requestContextKey;
    _scheduleCurrentRead(stores);
    // A cleared selection is unresolved access, not an empty store list. Do
    // not spin discovery again when a denied read retires its own context.
    final needsSelectionRead =
        stale && !_resolvingSelection && stores.selectedStoreId == null;
    final pending = (_isLoading || stale) && !needsSelectionRead;
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (!pending && !needsSelectionRead && _store != null)
              PremiumHeader(
                isDark: theme.brightness == Brightness.dark,
                onStoreChanged: _loadStore,
                onNotificationTap: () =>
                    Navigator.pushNamed(context, AppRoutes.notifications),
              )
            else
              Padding(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Semantics(
                    header: true,
                    child: Text('Dashboard', style: theme.textTheme.titleLarge),
                  ),
                ),
              ),
            Expanded(
              child: needsSelectionRead
                  ? ErrorView(
                      title: 'Reload store access',
                      message:
                          'The active store context changed. Reload access to continue.',
                      onRetry: _loadStore,
                      retryLabel: 'Reload store access',
                    )
                  : pending
                  ? const SkeletonLoader()
                  : _loadError != null
                  ? ErrorView(
                      title: 'Store details unavailable',
                      message: _loadError!,
                      onRetry: _loadStore,
                      retryLabel: 'Retry store details',
                    )
                  : _store == null
                  ? _buildNoStore()
                  : _buildDashboard(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard() {
    final analytics = _analytics;
    final summaryAvailable = analytics?.summaryAvailable == true;
    final visitorsAvailable = analytics?.viewsAvailable == true;
    final totalOrders = analytics?.totalOrders ?? _store!.totalOrders;
    final totalProducts = analytics?.totalProducts ?? _store!.productCount;
    final totalVisitors = analytics?.totalViews ?? 0;
    final revenue = analytics?.totalRevenue ?? 0.0;
    final averageOrderValue =
        analytics?.averageOrderValue ??
        (totalOrders > 0 ? revenue / totalOrders : 0.0);
    final convRate = totalVisitors > 0
        ? (totalOrders / totalVisitors * 100).toStringAsFixed(1)
        : '0';
    final viewKey = _loadedViewKey;
    final theme = Theme.of(context);
    final activities = <ActivityItem>[];
    if (_store!.isPublished) {
      activities.add(ActivityItems.storePublished(_store!.publishedAt));
    }
    if (summaryAvailable && totalOrders > 0) {
      activities.add(
        ActivityItems.ordersReceived(totalOrders, scope: _selectedPeriod),
      );
    }
    if (visitorsAvailable && totalVisitors > 0) {
      activities.add(
        ActivityItems.visitorMilestone(totalVisitors, scope: _selectedPeriod),
      );
    }
    final metrics = <Widget>[
      _metric(
        icon: Icons.shopping_bag_outlined,
        label: 'Orders',
        value: summaryAvailable ? totalOrders.toString() : '—',
        scope: summaryAvailable
            ? _selectedPeriod
            : 'Unavailable · refresh to retry',
      ),
      _metric(
        icon: Icons.account_balance_wallet_outlined,
        label: 'Revenue',
        value: summaryAvailable ? PriceFormatter.formatPrice(revenue) : '—',
        scope: summaryAvailable
            ? _selectedPeriod
            : 'Unavailable · refresh to retry',
      ),
      _metric(
        icon: Icons.visibility_outlined,
        label: 'Visitors',
        value: visitorsAvailable ? totalVisitors.toString() : '—',
        scope: visitorsAvailable
            ? _selectedPeriod
            : 'Unavailable · refresh to retry',
      ),
      _metric(
        icon: Icons.inventory_2_outlined,
        label: 'Products',
        value: summaryAvailable ? totalProducts.toString() : '—',
        scope: summaryAvailable ? 'Current' : 'Unavailable · refresh to retry',
      ),
      _metric(
        icon: Icons.speed_outlined,
        label: 'Conversion rate',
        value: summaryAvailable && visitorsAvailable ? '$convRate%' : '—',
        scope: summaryAvailable && visitorsAvailable
            ? _selectedPeriod
            : 'Unavailable · refresh to retry',
      ),
      _metric(
        icon: Icons.receipt_long_outlined,
        label: 'Average order value',
        value: summaryAvailable
            ? PriceFormatter.formatPrice(averageOrderValue)
            : '—',
        scope: summaryAvailable
            ? _selectedPeriod
            : 'Unavailable · refresh to retry',
      ),
    ];
    return RefreshIndicator(
      onRefresh: _loadStore,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            HeroStoreCard(
              key: ValueKey(viewKey),
              store: _store!,
              storefrontUrl: AppConfig.storefrontUrlFor(
                subdomain: _store!.subdomain,
                publicUrl: _store!.publicUrl,
              ),
              billing: _billing,
              onSettingsTap: _openStoreDetails,
              onPlanTap: () async {
                if (!_currentView(viewKey)) return;
                await Navigator.pushNamed(context, AppRoutes.pricing);
                if (_currentView(viewKey)) await _loadStore();
              },
              onPublishToggle: _togglePublish,
              isPublishing: _isPublishing,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space24),
            Wrap(
              spacing: LetbuyySpacingTokens.space16,
              runSpacing: LetbuyySpacingTokens.space8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Semantics(
                  header: true,
                  child: Text('Performance', style: theme.textTheme.titleLarge),
                ),
                AccessibleTapRegion(
                  key: const ValueKey('dashboard-period-picker'),
                  focusNode: _periodFocus,
                  label: 'Dashboard reporting period',
                  hint: 'Current reporting period: $_selectedPeriod',
                  onTap: _showPeriodPicker,
                  excludeChildSemantics: true,
                  child: OutlinedButton.icon(
                    focusNode: _periodFocus,
                    onPressed: _showPeriodPicker,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(48, 48),
                    ),
                    icon: const Icon(Icons.calendar_today_outlined),
                    label: Text(_selectedPeriod),
                  ),
                ),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            LayoutBuilder(
              builder: (context, constraints) {
                final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
                final columns = scale > 1.5
                    ? 1
                    : constraints.maxWidth >= 600
                    ? 3
                    : constraints.maxWidth >= 360
                    ? 2
                    : 1;
                const gap = LetbuyySpacingTokens.space12;
                final width =
                    (constraints.maxWidth - gap * (columns - 1)) / columns;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final metric in metrics)
                      SizedBox(width: width, child: metric),
                  ],
                );
              },
            ),
            const SizedBox(height: LetbuyySpacingTokens.space24),
            if (!summaryAvailable)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Revenue data could not be loaded.'),
                      OutlinedButton.icon(
                        onPressed: _loadStore,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Refresh dashboard'),
                      ),
                    ],
                  ),
                ),
              )
            else
              AnimatedRevenueChart(
                totalRevenue: revenue,
                period: _analyticsPeriod,
                revenueDates:
                    analytics?.dailyStats
                        .map((day) => day.date)
                        .toList(growable: false) ??
                    const [],
                onPeriodChanged: (period) => _applyPeriod(period, viewKey),
                revenueData:
                    analytics?.dailyStats
                        .map((day) => day.revenue)
                        .toList(growable: false) ??
                    const <double>[],
              ),
            const SizedBox(height: LetbuyySpacingTokens.space24),
            _buildPayoutVisibilityCard(),
            const SizedBox(height: LetbuyySpacingTokens.space24),
            QuickActionsGrid(
              productCount: totalProducts,
              onEditorTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const ThemeScreen()),
              ),
              onProductsTap: () =>
                  Navigator.pushNamed(context, AppRoutes.products),
              onOrdersTap: () => Navigator.pushNamed(context, AppRoutes.orders),
              onAnalyticsTap: () =>
                  Navigator.pushNamed(context, AppRoutes.analytics),
              onSettingsTap: _openStoreDetails,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space24),
            if (activities.isNotEmpty || !_store!.isPublished)
              ActivityTimeline(
                activities: activities.isEmpty
                    ? [ActivityItems.readyToLaunch()]
                    : activities,
                showEmpty: !_store!.isPublished && activities.isEmpty,
              ),
            // The existing root navigation/FAB shell owns its own safe area.
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _metric({
    required IconData icon,
    required String label,
    required String value,
    required String scope,
  }) {
    final theme = Theme.of(context);
    return Card(
      key: ValueKey('dashboard-metric-$label'),
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Icon(icon, color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Text(label, style: theme.textTheme.titleMedium),
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(value, style: theme.textTheme.headlineSmall),
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(scope, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  void _applyPeriod(String period, Object? viewKey) {
    const labels = {
      '7d': '7 Days',
      '30d': '30 Days',
      '90d': '90 Days',
      '12m': '12 Months',
    };
    final label = labels[period];
    if (!_currentView(viewKey) || label == null || label == _selectedPeriod)
      return;
    setState(() => _selectedPeriod = label);
    _loadStore();
  }

  Future<void> _showPeriodPicker() async {
    final viewKey = _loadedViewKey;
    if (_periodOpening || !_currentView(viewKey)) return;
    _periodOpening = true;
    try {
      final period = await showLetbuyyFormSheet<String>(
        context: context,
        builder: (_) => _DashboardPeriodSheet(
          viewKey: viewKey!,
          selected: _analyticsPeriod,
        ),
      );
      if (period != null) _applyPeriod(period, viewKey);
    } finally {
      _periodOpening = false;
      if (_currentView(viewKey) && ModalRoute.of(context)?.isCurrent == true) {
        _periodFocus.requestFocus();
      }
    }
  }

  Widget _buildPayoutVisibilityCard() {
    final next = _payoutSummary?['next_payout'];
    final nextPayout = next is Map ? Map<String, dynamic>.from(next) : null;
    final amountMinor = (nextPayout?['net_amount_minor'] as num?)?.toDouble();
    final summaryAvailable = _payoutSummary?.containsKey('next_payout') == true;
    final amount = !summaryAvailable
        ? 'Payout summary unavailable'
        : amountMinor == null
        ? 'No payout scheduled'
        : PriceFormatter.formatPrice(amountMinor / 100);
    final subtitle = !summaryAvailable
        ? 'Refresh to retry.'
        : nextPayout == null
        ? 'Paid orders will appear here when settlement is ready.'
        : '${nextPayout['status'] ?? 'pending'} · ${nextPayout['available_on'] ?? 'available soon'}';
    final providerMode = ProviderMode.parse(
      _dashboardProviderMode ?? _payoutSummary?['provider_mode'],
    );
    final theme = Theme.of(context);
    final viewKey = _loadedViewKey;
    void openMoney() {
      if (_currentView(viewKey)) Navigator.pushNamed(context, AppRoutes.money);
    }

    return AccessibleTapRegion(
      label: 'Next payout, $amount. $subtitle',
      hint: 'Open Money and payouts',
      onTap: openMoney,
      excludeChildSemantics: true,
      child: Card(
        clipBehavior: Clip.antiAlias,
        margin: EdgeInsets.zero,
        child: InkWell(
          excludeFromSemantics: true,
          onTap: openMoney,
          child: Padding(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.account_balance_wallet_outlined,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: LetbuyySpacingTokens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Next payout', style: theme.textTheme.titleMedium),
                      const SizedBox(height: LetbuyySpacingTokens.space8),
                      Text(amount, style: theme.textTheme.headlineSmall),
                      const SizedBox(height: LetbuyySpacingTokens.space8),
                      Text(subtitle, style: theme.textTheme.bodyMedium),
                      const SizedBox(height: LetbuyySpacingTokens.space8),
                      ProviderModeBadge(mode: providerMode, compact: true),
                    ],
                  ),
                ),
                const SizedBox(width: LetbuyySpacingTokens.space8),
                Icon(
                  Icons.chevron_right_rounded,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNoStore() => EmptyState(
    icon: Icons.store_rounded,
    title: 'Create Your Store',
    message: 'Set up your online store and start selling.',
    actionLabel: 'Get Started',
    onAction: () => Navigator.pushNamed(context, AppRoutes.createStore),
  );
}

class _DashboardPeriodSheet extends StatefulWidget {
  const _DashboardPeriodSheet({required this.viewKey, required this.selected});
  final Object viewKey;
  final String selected;
  @override
  State<_DashboardPeriodSheet> createState() => _DashboardPeriodSheetState();
}

class _DashboardPeriodSheetState extends State<_DashboardPeriodSheet> {
  late String _draft = widget.selected;
  @override
  Widget build(BuildContext context) {
    final current =
        context.watch<StoreContext>().requestContextKey == widget.viewKey;
    return LetbuyyFormSheet(
      title: 'Select Period',
      description: current
          ? 'Apply a reporting period to reload the dashboard.'
          : 'The active store changed. Close and choose a period again.',
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: current ? () => Navigator.pop(context, _draft) : null,
          child: const Text('Apply'),
        ),
      ],
      child: current
          ? RadioGroup<String>(
              groupValue: _draft,
              onChanged: (value) {
                if (value != null) setState(() => _draft = value);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final entry in const {
                    '7d': '7 Days',
                    '30d': '30 Days',
                    '90d': '90 Days',
                    '12m': '12 Months',
                  }.entries)
                    RadioListTile<String>(
                      value: entry.key,
                      title: Text(entry.value),
                    ),
                ],
              ),
            )
          : const SizedBox.shrink(),
    );
  }
}
