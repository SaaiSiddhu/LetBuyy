import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/store_context.dart';
import '../../theme/app_theme_colors.dart';
import '../../services/analytics_service.dart';

import '../../models/store_model.dart';
import '../../widgets/dashboard/stats_row.dart';

/// Analytics screen
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  StoreModel? _store;
  StoreAnalytics? _analytics;
  StoreLiveView? _liveView;
  bool _isLoading = true;
  bool _loadFailed = false;
  AppThemeColors get _colors => AppThemeColors.of(context);
  String _selectedPeriod = '7d';

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() {
      _isLoading = true;
      _loadFailed = false;
    });
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      StoreAnalytics? analytics;
      StoreLiveView? liveView;
      if (store != null) {
        final analyticsService = context.read<AnalyticsService>();
        analytics = await analyticsService.getStoreAnalytics(
          store.id,
          period: _selectedPeriod,
        );
        try {
          liveView = await analyticsService.getLiveView(store.id);
        } catch (error) {
          debugPrint('Error loading live view: $error');
        }
      }
      if (!mounted) return;
      setState(() {
        _store = store;
        _analytics = analytics;
        _liveView = liveView;
      });
    } catch (e) {
      if (mounted) setState(() => _loadFailed = true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: _colors.bgStart,
      appBar: AppBar(
        title: const Text('Analytics'),
        backgroundColor: _colors.bgStart,
        surfaceTintColor: _colors.bgStart,
        actions: [
          PopupMenuButton<String>(
            initialValue: _selectedPeriod,
            onSelected: (value) {
              setState(() => _selectedPeriod = value);
              _loadStore();
            },
            itemBuilder: (context) => [
              _buildPeriodMenuItem('7d', 'Last 7 days'),
              _buildPeriodMenuItem('30d', 'Last 30 days'),
              _buildPeriodMenuItem('90d', 'Last 90 days'),
              _buildPeriodMenuItem('12m', 'Last 12 months'),
            ],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Text(
                    _getPeriodLabel(_selectedPeriod),
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: _loadFailed
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Analytics could not load. Please retry.'),
                  TextButton(
                    onPressed: _loadStore,
                    child: const Text('Retry analytics'),
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Stats overview
                StatsRow(
                  views: _analytics?.totalViews ?? _store?.totalVisitors ?? 0,
                  sales: _analytics?.totalOrders ?? _store?.totalOrders ?? 0,
                  revenue: (_analytics?.totalRevenue ?? 0).round(),
                  products:
                      _analytics?.totalProducts ?? 0,
                ),
                const SizedBox(height: 24),

                _buildComparisonStrip(),
                const SizedBox(height: 24),

                _buildLiveViewCard(),
                const SizedBox(height: 24),

                // Real order and revenue charts from analytics daily buckets.
                _buildChartCard(
                  title: 'Revenue',
                  icon: Icons.trending_up_rounded,
                  color: Colors.blue,
                  series: _analytics?.dailyStats ?? const <DailyStats>[],
                  previousSeries:
                      _analytics?.comparison.previousDailyStats ??
                      const <DailyStats>[],
                  previousLabel:
                      _analytics?.comparison.previousLabel ?? 'Previous period',
                  valueFor: (day) => day.revenue,
                  valueLabel: (value) => '₹${value.toStringAsFixed(2)}',
                ),
                const SizedBox(height: 16),

                _buildChartCard(
                  title: 'Orders',
                  icon: Icons.shopping_bag_rounded,
                  color: Colors.green,
                  series: _analytics?.dailyStats ?? const <DailyStats>[],
                  previousSeries:
                      _analytics?.comparison.previousDailyStats ??
                      const <DailyStats>[],
                  previousLabel:
                      _analytics?.comparison.previousLabel ?? 'Previous period',
                  valueFor: (day) => day.orders.toDouble(),
                  valueLabel: (value) => value.toStringAsFixed(0),
                ),
                const SizedBox(height: 24),

                // Top products
                const Text(
                  'Top Products',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                const SizedBox(height: 12),
                _buildTopProductsList(),
                const SizedBox(height: 24),

                // Traffic sources
                const Text(
                  'Traffic Sources',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
                const SizedBox(height: 12),
                _buildTrafficSourcesList(),
              ],
            ),
    );
  }

  Widget _buildLiveViewCard() {
    final liveView = _liveView;
    final snapshot = liveView?.available == true ? liveView : null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _colors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.monitor_heart_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Live View',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
              ),
              if (snapshot != null)
                Text(
                  'Updated ${_formatSeen(snapshot.lastSeenAt)}',
                  style: TextStyle(color: _colors.textSecondary, fontSize: 12),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (snapshot == null)
            _buildMetricPlaceholder(
              icon: Icons.radar_rounded,
              title: liveView == null
                  ? 'Live view unavailable'
                  : 'No live traffic yet',
              body:
                  'Live storefront activity appears after traffic data is collected.',
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: _buildLiveMetric(
                    'Active now',
                    snapshot.activeSessions,
                  ),
                ),
                Expanded(
                  child: _buildLiveMetric('Visitors', snapshot.visitors),
                ),
                Expanded(
                  child: _buildLiveMetric('Page views', snapshot.pageViews),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _buildLiveMetric('Carts', snapshot.cartAdds)),
                Expanded(
                  child: _buildLiveMetric(
                    'Checkouts',
                    snapshot.checkoutsStarted,
                  ),
                ),
                Expanded(
                  child: _buildLiveMetric(
                    'Window',
                    snapshot.windowMinutes,
                    suffix: 'm',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _buildLiveEntryList('Top pages', snapshot.topPages),
            const SizedBox(height: 12),
            _buildLiveEntryList('Traffic sources', snapshot.trafficSources),
          ],
        ],
      ),
    );
  }

  Widget _buildLiveMetric(String label, int value, {String suffix = ''}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value$suffix',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(color: _colors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildLiveEntryList(String title, List<LiveViewEntry> entries) {
    if (entries.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...entries
            .take(3)
            .map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        entry.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      entry.value.toString(),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  String _formatSeen(DateTime? seenAt) {
    if (seenAt == null) return 'recently';
    final diff = DateTime.now().toUtc().difference(seenAt.toUtc());
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    return '${diff.inHours}h ago';
  }

  PopupMenuItem<String> _buildPeriodMenuItem(String value, String label) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Text(label),
          if (_selectedPeriod == value) ...[
            const Spacer(),
            Icon(Icons.check_rounded, size: 18, color: AppColors.primary),
          ],
        ],
      ),
    );
  }

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

  Widget _buildComparisonStrip() {
    final comparison = _analytics?.comparison;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _colors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: comparison?.hasPreviousData == true
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.compare_arrows_rounded,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Period comparison',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            comparison!.previousLabel,
                            style: TextStyle(
                              color: _colors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _buildComparisonMetric(
                      'Revenue',
                      comparison.revenue,
                      (value) => '₹${value.toStringAsFixed(2)}',
                    ),
                    _buildComparisonMetric(
                      'Orders',
                      comparison.orders,
                      (value) => value.toStringAsFixed(0),
                    ),
                    _buildComparisonMetric(
                      'AOV',
                      comparison.averageOrderValue,
                      (value) => '₹${value.toStringAsFixed(2)}',
                    ),
                  ],
                ),
              ],
            )
          : _buildMetricPlaceholder(
              icon: Icons.compare_arrows_rounded,
              title: 'No comparison yet',
              body:
                  'Period comparison appears after a full previous range is recorded.',
            ),
    );
  }

  Widget _buildComparisonMetric(
    String label,
    AnalyticsMetricDelta metric,
    String Function(double value) formatValue,
  ) {
    final changeColor = metric.changePct > 0
        ? Colors.green[700]!
        : metric.changePct < 0
        ? Colors.red[700]!
        : Colors.grey[700]!;
    final sign = metric.changePct > 0 ? '+' : '';

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 140, maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.14)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(color: _colors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Text(
              formatValue(metric.value),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
            const SizedBox(height: 4),
            Text(
              '$sign${metric.changePct.toStringAsFixed(1)}% vs ${formatValue(metric.previous)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: changeColor,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChartCard({
    required String title,
    required IconData icon,
    required Color color,
    required List<DailyStats> series,
    required List<DailyStats> previousSeries,
    required String previousLabel,
    required double Function(DailyStats day) valueFor,
    required String Function(double value) valueLabel,
  }) {
    final spots = <FlSpot>[
      for (var index = 0; index < series.length; index += 1)
        FlSpot(index.toDouble(), valueFor(series[index])),
    ];
    final previousSpots = <FlSpot>[
      for (var index = 0; index < previousSeries.length; index += 1)
        FlSpot(index.toDouble(), valueFor(previousSeries[index])),
    ];
    final chartLength = [
      series.length,
      previousSeries.length,
    ].reduce((value, element) => value > element ? value : element);
    final hasData =
        spots.any((spot) => spot.y > 0) ||
        previousSpots.any((spot) => spot.y > 0);
    final maxValue = [
      ...spots,
      ...previousSpots,
    ].fold<double>(0, (max, spot) => spot.y > max ? spot.y : max);
    final labelSeries = series.isNotEmpty ? series : previousSeries;

    return Container(
      height: 236,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _colors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          Expanded(
            child: hasData && chartLength > 1
                ? Padding(
                    padding: const EdgeInsets.only(top: 18),
                    child: LineChart(
                      LineChartData(
                        minY: 0,
                        maxY: maxValue <= 0 ? 1 : maxValue * 1.2,
                        gridData: FlGridData(
                          drawVerticalLine: false,
                          horizontalInterval: maxValue <= 0
                              ? 1
                              : (maxValue / 3).ceilToDouble(),
                          getDrawingHorizontalLine: (_) => FlLine(
                            color: Colors.grey.withValues(alpha: 0.14),
                            strokeWidth: 1,
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        titlesData: FlTitlesData(
                          topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 40,
                              getTitlesWidget: (value, _) => Text(
                                valueLabel(value),
                                style: TextStyle(
                                  color: _colors.textSecondary,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              interval: (chartLength / 3)
                                  .clamp(1, 10)
                                  .toDouble(),
                              getTitlesWidget: (value, _) {
                                final index = value.round();
                                if (index < 0 || index >= labelSeries.length) {
                                  return const SizedBox.shrink();
                                }
                                final date = labelSeries[index].date;
                                return Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(
                                    '${date.day}/${date.month}',
                                    style: TextStyle(
                                      color: _colors.textSecondary,
                                      fontSize: 10,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                        lineBarsData: [
                          if (previousSpots.isNotEmpty)
                            LineChartBarData(
                              spots: previousSpots,
                              isCurved: true,
                              color: color.withValues(alpha: 0.38),
                              barWidth: 2,
                              dashArray: const [6, 4],
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(show: false),
                            ),
                          if (spots.isNotEmpty)
                            LineChartBarData(
                              spots: spots,
                              isCurved: true,
                              color: color,
                              barWidth: 3,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                color: color.withValues(alpha: 0.12),
                              ),
                            ),
                        ],
                      ),
                    ),
                  )
                : _buildMetricPlaceholder(
                    icon: Icons.bar_chart_rounded,
                    title: 'No ${title.toLowerCase()} data yet',
                    body: 'This chart appears after real orders are recorded.',
                  ),
          ),
          if (hasData) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                _buildChartLegend(color, _getPeriodLabel(_selectedPeriod)),
                const SizedBox(width: 14),
                _buildChartLegend(
                  color.withValues(alpha: 0.42),
                  previousLabel,
                  dashed: true,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChartLegend(Color color, String label, {bool dashed = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: dashed ? 2 : 3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: _colors.textSecondary, fontSize: 11),
        ),
      ],
    );
  }

  Widget _buildTopProductsList() {
    final products = _analytics?.topProducts ?? const <TopProduct>[];

    return Container(
      decoration: BoxDecoration(
        color: _colors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: products.isEmpty
          ? _buildMetricPlaceholder(
              icon: Icons.inventory_2_outlined,
              title: 'No product sales yet',
              body:
                  'Product ranking appears after order line items are recorded.',
            )
          : Column(
              children: products.asMap().entries.map((entry) {
                final index = entry.key;
                final product = entry.value;
                return ListTile(
                  leading: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _getRankColor(index).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _getRankColor(index),
                        ),
                      ),
                    ),
                  ),
                  title: Text(product.name),
                  subtitle: Text(
                    '₹${product.revenue.toStringAsFixed(2)} revenue',
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green[50],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${product.orders} sold',
                      style: TextStyle(
                        color: Colors.green[700],
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }

  Color _getRankColor(int index) {
    switch (index) {
      case 0:
        return Colors.amber;
      case 1:
        return Colors.grey;
      case 2:
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  Widget _buildTrafficSourcesList() {
    final sources = _analytics?.trafficSources ?? const <TrafficSourceEntry>[];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _colors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: sources.isEmpty
          ? _buildMetricPlaceholder(
              icon: Icons.query_stats_rounded,
              title: 'No traffic sources yet',
              body:
                  'Source attribution appears after traffic data is collected.',
            )
          : Column(
              children: sources
                  .map(
                    (source) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  source.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Text(
                                '${source.sessions} sessions',
                                style: TextStyle(
                                  color: _colors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: (source.percentage / 100)
                                  .clamp(0.0, 1.0)
                                  .toDouble(),
                              minHeight: 8,
                              backgroundColor: Colors.grey[200],
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              '${source.percentage.toStringAsFixed(1)}%',
                              style: TextStyle(
                                color: _colors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
    );
  }

  Widget _buildMetricPlaceholder({
    required IconData icon,
    required String title,
    required String body,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          Icon(icon, size: 36, color: Colors.grey[500]),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            textAlign: TextAlign.center,
            style: TextStyle(color: _colors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
