import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/store_context.dart';
import '../../services/analytics_service.dart';

import '../../models/store_model.dart';
import '../../widgets/home/stats_row.dart';

/// Analytics screen
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  StoreModel? _store;
  StoreAnalytics? _analytics;
  bool _isLoading = true;
  String _selectedPeriod = '7d';

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      final analytics = store == null
          ? null
          : await context.read<AnalyticsService>().getStoreAnalytics(
              store.id,
              period: _selectedPeriod,
            );
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Analytics'),
        backgroundColor: AppColors.background,
        surfaceTintColor: AppColors.background,
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
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Stats overview
          StatsRow(
            views: _analytics?.totalViews ?? _store?.totalVisitors ?? 0,
            sales: _analytics?.totalOrders ?? _store?.totalOrders ?? 0,
            revenue: (_analytics?.totalRevenue ?? 0).round(),
            products:
                _analytics?.totalProducts ??
                _store?.selectedProductIds.length ??
                0,
          ),
          const SizedBox(height: 24),

          // Traffic chart placeholder
          _buildChartCard(
            title: 'Visitors',
            icon: Icons.trending_up_rounded,
            color: Colors.blue,
          ),
          const SizedBox(height: 16),

          // Sales chart placeholder
          _buildChartCard(
            title: 'Sales',
            icon: Icons.shopping_bag_rounded,
            color: Colors.green,
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

  Widget _buildChartCard({
    required String title,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      height: 200,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
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
          const Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.bar_chart_rounded, size: 48, color: Colors.grey),
                  SizedBox(height: 8),
                  Text(
                    'Charts coming soon',
                    style: TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopProductsList() {
    final products = _analytics?.topProducts ?? const <TopProduct>[];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
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
                    '₹${product.revenue.toStringAsFixed(0)} revenue',
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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: _buildMetricPlaceholder(
        icon: Icons.query_stats_rounded,
        title: 'Traffic sources unavailable',
        body:
            'The mobile app needs a gateway analytics endpoint for source attribution.',
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
            style: TextStyle(color: Colors.grey[600], fontSize: 13),
          ),
        ],
      ),
    );
  }
}
