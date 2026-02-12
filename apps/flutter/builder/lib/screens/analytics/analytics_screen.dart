import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/store_service.dart';

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
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      setState(() => _store = store);
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
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
            },
            itemBuilder: (context) => [
              _buildPeriodMenuItem('24h', 'Last 24 hours'),
              _buildPeriodMenuItem('7d', 'Last 7 days'),
              _buildPeriodMenuItem('30d', 'Last 30 days'),
              _buildPeriodMenuItem('all', 'All time'),
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
            views: _store?.totalVisitors ?? 0,
            sales: _store?.totalOrders ?? 0,
            revenue: 0, // No revenue field in model
            products: _store?.selectedProductIds.length ?? 0,
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
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _buildTopProductsList(),
          const SizedBox(height: 24),

          // Traffic sources
          const Text(
            'Traffic Sources',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
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
      case '24h': return 'Last 24h';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case 'all': return 'All time';
      default: return 'Last 7 days';
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
    // Mock data - replace with real analytics
    final products = [
      {'name': 'Product A', 'views': 152, 'sales': 23},
      {'name': 'Product B', 'views': 98, 'sales': 15},
      {'name': 'Product C', 'views': 76, 'sales': 12},
    ];

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
      child: Column(
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
            title: Text(product['name'] as String),
            subtitle: Text('${product['views']} views'),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${product['sales']} sales',
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
      case 0: return Colors.amber;
      case 1: return Colors.grey;
      case 2: return Colors.orange;
      default: return Colors.grey;
    }
  }

  Widget _buildTrafficSourcesList() {
    final sources = [
      {'name': 'Direct', 'percent': 45, 'icon': Icons.link_rounded},
      {'name': 'Google', 'percent': 30, 'icon': Icons.search_rounded},
      {'name': 'Social', 'percent': 15, 'icon': Icons.share_rounded},
      {'name': 'Other', 'percent': 10, 'icon': Icons.more_horiz_rounded},
    ];

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
      child: Column(
        children: sources.map((source) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Icon(
                  source['icon'] as IconData,
                  size: 20,
                  color: Colors.grey[600],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        source['name'] as String,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: (source['percent'] as int) / 100,
                        backgroundColor: Colors.grey[200],
                        valueColor: AlwaysStoppedAnimation(AppColors.primary),
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${source['percent']}%',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
