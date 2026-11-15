import 'dart:async';
import 'package:flutter/material.dart';
import 'package:letbuyy_core/letbuyy_core.dart' show PriceFormatter;
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../models/order_model.dart' show OrderStatus;
import '../../services/analytics_service.dart';
import '../../services/api_client.dart';
import '../../widgets/shared/recorded_history_chart.dart';

/// Existing report readers, bound to one applied store/account/period lifetime.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});
  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  late final StoreContext _stores;
  late final AnalyticsService _service;
  Object? _boundContext;
  StoreModel? _store;
  StoreAnalytics? _analytics;
  StoreLiveView? _liveView;
  String _selectedPeriod = '7d';
  bool _reading = false, _liveReading = false, _retired = false;
  bool _denied = false, _emptyStore = false, _selectingInitialStore = false;
  int _generation = 0, _discoveryEpoch = 0;
  String? _error, _liveError;

  Object get _currentContext =>
      (_stores.requestContextKey, _service.requestContext);
  bool get _current => mounted && !_retired && _boundContext == _currentContext;
  bool get _active => mounted && ModalRoute.of(context)?.isCurrent == true;
  bool _owns(int generation) => _current && generation == _generation;
  String _amount(double value) =>
      '₹${PriceFormatter.formatPriceWithoutSymbol(value)}';

  @override
  void initState() {
    super.initState();
    _stores = context.read<StoreContext>();
    _service = context.read<AnalyticsService>();
    _boundContext = _currentContext;
    _stores.addListener(_observeOwner);
    _service.addListener(_observeOwner);
    Future<void>.microtask(_load);
  }

  void _observeOwner() {
    if (!mounted || _boundContext == _currentContext) return;
    // First store discovery has no previous report to disclose. An account
    // epoch change still retires it. The returned selection is checked below.
    if (_selectingInitialStore &&
        _stores.requestContextVersion == _discoveryEpoch) {
      _boundContext = _currentContext;
      return;
    }
    _retireOwner();
  }

  void _retireOwner() {
    ++_generation;
    setState(() {
      _retired = true;
      _store = null;
      _analytics = null;
      _liveView = null;
      _reading = _liveReading = false;
      _error = _liveError = null;
    });
  }

  @override
  void dispose() {
    ++_generation;
    _stores.removeListener(_observeOwner);
    _service.removeListener(_observeOwner);
    super.dispose();
  }

  void _deny() {
    ++_generation;
    setState(() {
      _denied = true;
      _analytics = null;
      _liveView = null;
      _reading = _liveReading = false;
      _error = _liveError = null;
    });
  }

  bool _accessFailure(Object error) =>
      error is ApiException && const [401, 403].contains(error.statusCode);

  Future<void> _load({String? period}) async {
    if (!mounted ||
        !identical(context.read<StoreContext>(), _stores) ||
        !identical(context.read<AnalyticsService>(), _service))
      return;
    if (!_active || (_reading && (period == null || period == _selectedPeriod)))
      return;
    final changedPeriod = period != null && period != _selectedPeriod;
    final generation = ++_generation;
    _boundContext = _currentContext;
    final selectedBefore = _stores.selectedStoreId;
    _discoveryEpoch = _stores.requestContextVersion;
    _selectingInitialStore = selectedBefore == null;
    setState(() {
      _retired = _denied = _emptyStore = false;
      _reading = true;
      _liveReading = false;
      _error = _liveError = null;
      if (period != null) _selectedPeriod = period;
      if (changedPeriod) {
        _analytics = null;
        _liveView = null;
      }
    });
    final requestedPeriod = _selectedPeriod;
    try {
      final store = await _stores.ensureSelectedStore();
      _selectingInitialStore = false;
      if (!_owns(generation)) return;
      if (store == null) {
        setState(() {
          _emptyStore = true;
          _store = null;
          _analytics = null;
          _liveView = null;
          _reading = false;
        });
        return;
      }
      if (_stores.selectedStoreId != store.id ||
          (selectedBefore != null && selectedBefore != store.id)) {
        _retireOwner();
        return;
      }
      setState(() => _store = store);
      final analytics = await _service.getStoreAnalytics(
        store.id,
        period: requestedPeriod,
      );
      if (!_owns(generation)) return;
      setState(() {
        _analytics = analytics;
        _reading = false;
        _liveReading = true;
      });
      // The primary report is useful now. Optional activity never gates it.
      await _readLive(store.id, generation);
    } catch (error) {
      _selectingInitialStore = false;
      if (!_owns(generation)) return;
      if (_accessFailure(error)) {
        _deny();
      } else {
        setState(() {
          _reading = false;
          _error = _analytics == null
              ? 'Analytics could not load. Try again.'
              : 'Refresh failed. Showing the last loaded report for this store and period.';
        });
      }
    }
  }

  Future<void> _readLive(String storeId, int generation) async {
    try {
      final live = await _service.getLiveView(storeId);
      if (!_owns(generation)) return;
      setState(() {
        _liveView = live;
        _liveReading = false;
      });
    } catch (error) {
      if (!_owns(generation)) return;
      if (_accessFailure(error)) {
        _deny();
      } else {
        setState(() {
          _liveReading = false;
          _liveError = _liveView == null
              ? 'Live activity could not load.'
              : 'Activity refresh failed. Showing the last loaded activity snapshot.';
        });
      }
    }
  }

  Future<void> _retryLive() async {
    if (!_current ||
        !_active ||
        _denied ||
        _reading ||
        _liveReading ||
        _store == null)
      return;
    final generation = _generation;
    setState(() {
      _liveReading = true;
      _liveError = null;
    });
    await _readLive(_store!.id, generation);
  }

  @override
  Widget build(BuildContext context) {
    // Provider replacement/context changes also hide old data before any action.
    final stores = context.watch<StoreContext>(),
        service = context.watch<AnalyticsService>();
    final ownerChanged =
        !_current ||
        !identical(stores, _stores) ||
        !identical(service, _service);
    final replacedOwner =
        !identical(stores, _stores) || !identical(service, _service);
    final capturedContext = _boundContext, capturedGeneration = _generation;
    bool currentAction() =>
        _active &&
        _current &&
        !_denied &&
        capturedContext == _boundContext &&
        capturedGeneration == _generation;
    final theme = Theme.of(context);
    final analytics = !ownerChanged && !_denied ? _analytics : null;
    return Scaffold(
      appBar: CustomAppBar.responsive(
        context: context,
        title: 'Analytics',
        actions: [
          IconButton(
            tooltip: 'Refresh analytics',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: currentAction() && !_reading
                ? () {
                    if (currentAction()) unawaited(_load());
                  }
                : null,
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_reading && !ownerChanged)
              const LinearProgressIndicator(
                semanticsLabel: 'Loading analytics',
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  key: const PageStorageKey('merchant-analytics-report'),
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                  children: [
                    LetbuyyChoiceField<String>(
                      label: 'Reporting period',
                      value: _selectedPeriod,
                      choices: const [
                        LetbuyyChoice(value: '7d', label: 'Last 7 days'),
                        LetbuyyChoice(value: '30d', label: 'Last 30 days'),
                        LetbuyyChoice(value: '90d', label: 'Last 90 days'),
                        LetbuyyChoice(value: '12m', label: 'Last 12 months'),
                      ],
                      onChanged: !ownerChanged && !_denied
                          ? (value) {
                              if (currentAction())
                                unawaited(_load(period: value));
                            }
                          : null,
                    ),
                    const SizedBox(height: LetbuyySpacingTokens.space16),
                    if (ownerChanged)
                      _state(
                        'Store or account changed',
                        replacedOwner
                            ? 'Reopen Analytics to load the current account’s report.'
                            : 'Load the selected store’s report to continue.',
                        action: 'Load selected store',
                        onPressed: replacedOwner ? null : () => _load(),
                      )
                    else if (_denied)
                      _state(
                        'Analytics access unavailable',
                        'Report access could not be confirmed. No previous report is displayed.',
                        action: 'Check access again',
                        onPressed: () => _load(),
                      )
                    else if (_emptyStore)
                      _state(
                        'No store selected',
                        'Choose a store to view its analytics.',
                        action: 'Check selected store',
                        onPressed: () => _load(),
                      )
                    else ...[
                      if (_store != null) ...[
                        Text(_store!.name, style: theme.textTheme.titleMedium),
                        const SizedBox(height: LetbuyySpacingTokens.space8),
                      ],
                      Text(
                        _getPeriodLabel(_selectedPeriod),
                        style: theme.textTheme.titleLarge,
                      ),
                      if (_reading)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: LetbuyySpacingTokens.space12,
                          ),
                          child: Text(
                            analytics == null
                                ? 'Loading this period’s report…'
                                : 'Refreshing this store and period. Previous values remain below.',
                            style: theme.textTheme.bodyMedium,
                          ),
                        ),
                      if (_error != null)
                        _state(
                          'Report unavailable',
                          _error!,
                          action: 'Retry analytics',
                          onPressed: _reading ? null : () => _load(),
                        ),
                      if (analytics != null) ...[
                        const SizedBox(height: LetbuyySpacingTokens.space16),
                        _overview(analytics),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _comparison(analytics.comparison),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _live(),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _history(analytics, revenue: true),
                        const SizedBox(height: LetbuyySpacingTokens.space16),
                        _history(analytics, revenue: false),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _orderStatuses(analytics),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _products(analytics),
                        const SizedBox(height: LetbuyySpacingTokens.space24),
                        _traffic(analytics),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _state(
    String title,
    String message, {
    String? action,
    VoidCallback? onPressed,
  }) => Card(
    margin: const EdgeInsets.symmetric(vertical: LetbuyySpacingTokens.space8),
    child: Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: LetbuyySpacingTokens.space8),
          Text(message),
          if (action != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(onPressed: onPressed, child: Text(action)),
            ),
          ],
        ],
      ),
    ),
  );

  Widget _overview(StoreAnalytics data) => StatGrid(
    children: [
      StatTile(
        icon: Icons.payments_outlined,
        label: 'Revenue',
        value: data.summaryAvailable
            ? _amount(data.totalRevenue)
            : 'Unavailable',
        supportingText: 'Paid-order revenue · rolling period',
      ),
      StatTile(
        icon: Icons.shopping_bag_outlined,
        label: 'Orders',
        value: data.summaryAvailable ? '${data.totalOrders}' : 'Unavailable',
        supportingText: 'Orders created in the rolling period',
      ),
      StatTile(
        icon: Icons.visibility_outlined,
        label: 'Visits',
        value: data.viewsAvailable ? '${data.totalViews}' : 'Unavailable',
        supportingText: 'Reported visits for this period',
      ),
      StatTile(
        icon: Icons.inventory_2_outlined,
        label: 'Products',
        value: data.summaryAvailable ? '${data.totalProducts}' : 'Unavailable',
        supportingText: 'Active catalog · not period filtered',
      ),
    ],
  );

  Widget _comparison(
    StoreAnalyticsComparison comparison,
  ) => _section('Period comparison', [
    Text(comparison.previousLabel),
    const SizedBox(height: LetbuyySpacingTokens.space12),
    StatGrid(
      children: [
        for (final row in [
          (label: 'Revenue', metric: comparison.revenue, money: true),
          (label: 'Orders', metric: comparison.orders, money: false),
          (
            label: 'Average order value',
            metric: comparison.averageOrderValue,
            money: true,
          ),
        ])
          StatTile(
            icon: Icons.compare_arrows_rounded,
            label: row.label,
            value: row.metric.available
                ? (row.money
                      ? _amount(row.metric.value)
                      : row.metric.value.toStringAsFixed(0))
                : 'Unavailable',
            supportingText: row.metric.available
                ? 'Previous: ${row.money ? _amount(row.metric.previous) : row.metric.previous.toStringAsFixed(0)}\n${row.metric.changePct > 0 ? '+' : ''}${row.metric.changePct.toStringAsFixed(1)}% change reported'
                : 'No complete comparison returned.',
          ),
      ],
    ),
  ]);

  Widget _section(String title, List<Widget> children) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: LetbuyySpacingTokens.space12),
          ...children,
        ],
      ),
    ),
  );

  Widget _live() {
    final snapshot = _liveView;
    return _section('Live View', [
      if (_liveReading) ...[
        const LinearProgressIndicator(semanticsLabel: 'Loading live activity'),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          snapshot == null
              ? 'Loading live activity…'
              : 'Refreshing activity. Previous snapshot remains below.',
        ),
      ],
      if (_liveError != null) ...[
        Text(_liveError!),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            onPressed: _reading || _liveReading ? null : _retryLive,
            child: const Text('Retry live activity'),
          ),
        ),
      ],
      if (snapshot == null && !_liveReading && _liveError == null)
        const Text('Live view unavailable')
      else if (snapshot != null && !snapshot.available)
        const Text(
          'No live traffic yet. Activity appears after traffic data is collected.',
        )
      else if (snapshot != null) ...[
        Text(
          snapshot.lastSeenAt == null
              ? 'Last activity time unavailable'
              : 'Last recorded activity: ${snapshot.lastSeenAt!.toUtc().toIso8601String()}',
        ),
        const SizedBox(height: LetbuyySpacingTokens.space12),
        if (!snapshot.metricsAvailable)
          const Text('Live metrics incomplete. Missing values are unavailable.')
        else
          StatGrid(
            children: [
              for (final metric in [
                (label: 'Active now', value: '${snapshot.activeSessions}'),
                (label: 'Visitors', value: '${snapshot.visitors}'),
                (label: 'Page views', value: '${snapshot.pageViews}'),
                (label: 'Carts', value: '${snapshot.cartAdds}'),
                (label: 'Checkouts', value: '${snapshot.checkoutsStarted}'),
                (label: 'Window', value: '${snapshot.windowMinutes}m'),
              ])
                StatTile(
                  icon: Icons.radar_rounded,
                  label: metric.label,
                  value: metric.value,
                ),
            ],
          ),
        const SizedBox(height: LetbuyySpacingTokens.space16),
        _liveEntries('Top pages · up to 3', snapshot.topPages),
        const SizedBox(height: LetbuyySpacingTokens.space12),
        _liveEntries('Traffic sources · up to 3', snapshot.trafficSources),
      ],
    ]);
  }

  Widget _liveEntries(String title, List<LiveViewEntry> entries) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(title, style: Theme.of(context).textTheme.titleSmall),
      for (final entry in entries.take(3))
        Padding(
          padding: const EdgeInsets.symmetric(
            vertical: LetbuyySpacingTokens.space8,
          ),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            spacing: LetbuyySpacingTokens.space12,
            runSpacing: LetbuyySpacingTokens.space4,
            children: [
              Text(entry.label.isEmpty ? 'Label unavailable' : entry.label),
              Text(entry.valueAvailable ? '${entry.value}' : 'Unavailable'),
            ],
          ),
        ),
    ],
  );

  Widget _history(StoreAnalytics analytics, {required bool revenue}) {
    RecordedHistorySeries series(String label, List<DailyStats> days) =>
        RecordedHistorySeries(
          label: label,
          dates: days.map((day) => day.date).toList(growable: false),
          values: days
              .map(
                (day) => revenue
                    ? (day.revenueAvailable ? day.revenue : null)
                    : (day.ordersAvailable ? day.orders.toDouble() : null),
              )
              .toList(growable: false),
        );
    return RecordedHistoryChart(
      key: ValueKey((
        'analytics-history',
        revenue,
        _selectedPeriod,
        _boundContext,
      )),
      title: revenue ? 'Revenue' : 'Paid orders',
      icon: revenue ? Icons.trending_up_rounded : Icons.shopping_bag_outlined,
      current: series(_getPeriodLabel(_selectedPeriod), analytics.dailyStats),
      previous: analytics.comparison.previousDailyStats.isEmpty
          ? null
          : series(
              analytics.comparison.previousLabel,
              analytics.comparison.previousDailyStats,
            ),
      formatValue: revenue ? _amount : (value) => value.toStringAsFixed(0),
      discreteValues: !revenue,
      valuesTitle: revenue ? 'Daily revenue values' : 'Daily paid-order values',
      supportingText: revenue
          ? 'Paid-order revenue · calendar buckets in Asia/Kolkata. Summary uses a rolling period.'
          : 'Paid orders only · calendar buckets in Asia/Kolkata. The summary includes all created orders in its rolling period.',
    );
  }

  Widget _orderStatuses(StoreAnalytics analytics) =>
      _section('Orders by status', [
        const Text('All recorded orders · not filtered by reporting period.'),
        const SizedBox(height: LetbuyySpacingTokens.space12),
        if (analytics.ordersByStatus.isEmpty)
          const Text('No order statuses returned.')
        else
          StatGrid(
            children: [
              for (final entry in analytics.ordersByStatus.entries)
                StatTile(
                  icon: Icons.receipt_long_outlined,
                  label:
                      OrderStatus.values
                          .where((status) => status.name == entry.key)
                          .firstOrNull
                          ?.displayName ??
                      (entry.key.isEmpty ? 'Status unavailable' : entry.key),
                  value: '${entry.value}',
                ),
            ],
          ),
      ]);

  Widget _products(StoreAnalytics analytics) => _section('Top Products', [
    const Text(
      'Up to 5 reported products · ranked by units sold · not period filtered.',
    ),
    if (analytics.topProducts.isEmpty) ...[
      const SizedBox(height: LetbuyySpacingTokens.space12),
      const Text(
        'No ranked products returned. This does not establish that sales are zero.',
      ),
    ],
    for (final entry in analytics.topProducts.asMap().entries) ...[
      const SizedBox(height: LetbuyySpacingTokens.space16),
      Text('${entry.key + 1}', style: Theme.of(context).textTheme.labelLarge),
      Text(
        entry.value.name.isEmpty
            ? 'Product name unavailable'
            : entry.value.name,
        style: Theme.of(context).textTheme.titleSmall,
      ),
      const SizedBox(height: LetbuyySpacingTokens.space8),
      Text(
        entry.value.revenueAvailable
            ? '${_amount(entry.value.revenue)} revenue'
            : 'Revenue unavailable',
      ),
      Text(
        entry.value.ordersAvailable
            ? '${entry.value.orders} sold'
            : 'Units sold unavailable',
      ),
    ],
  ]);

  Widget _traffic(StoreAnalytics analytics) => _section('Traffic Sources', [
    const Text('Up to 5 reported sources · selected reporting period.'),
    const SizedBox(height: LetbuyySpacingTokens.space12),
    if (!analytics.trafficSourcesAvailable)
      const Text('Traffic attribution unavailable for this period.')
    else if (analytics.trafficSources.isEmpty)
      const Text('No traffic sources returned for this period.')
    else
      for (final source in analytics.trafficSources) ...[
        Text(
          source.label.isEmpty ? 'Source label unavailable' : source.label,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          source.sessionsAvailable
              ? '${source.sessions} sessions'
              : 'Sessions unavailable',
        ),
        if (source.percentageAvailable) ...[
          const SizedBox(height: LetbuyySpacingTokens.space8),
          LinearProgressIndicator(
            value: (source.percentage / 100).clamp(0.0, 1.0).toDouble(),
            semanticsLabel: '${source.label} reported share',
            semanticsValue: '${source.percentage.toStringAsFixed(1)}%',
          ),
          const SizedBox(height: LetbuyySpacingTokens.space4),
          Text('${source.percentage.toStringAsFixed(1)}%'),
        ] else
          const Text('Share unavailable'),
        const SizedBox(height: LetbuyySpacingTokens.space16),
      ],
  ]);

  String _getPeriodLabel(String period) {
    switch (period) {
      case '7d':
        return 'Last 7 days';
      case '30d':
        return 'Last 30 days';
      case '90d':
        return 'Last 90 days';
      case '12m':
        return 'Last 12 months';
      default:
        return 'Last 7 days';
    }
  }
}
