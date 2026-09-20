import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Campaign Analytics Screen with performance charts and metrics
class CampaignAnalyticsScreen extends StatefulWidget {
  final String campaignId;
  final String campaignName;

  const CampaignAnalyticsScreen({
    super.key,
    required this.campaignId,
    required this.campaignName,
  });

  @override
  State<CampaignAnalyticsScreen> createState() => _CampaignAnalyticsScreenState();
}

class _CampaignAnalyticsScreenState extends State<CampaignAnalyticsScreen> {
  final AdService _adService = AdService();
  AdCampaignModel? _campaign;
  bool _isLoading = true;
  String _selectedPeriod = '7d';
  
  // Time-series data from Firestore (real data, not mock!)
  List<int> _impressionsData = [];
  List<int> _clicksData = [];
  List<String> _dateLabels = [];

  @override
  void initState() {
    super.initState();
    _loadCampaign();
  }

  Future<void> _loadCampaign() async {
    setState(() => _isLoading = true);
    try {
      final campaign = await _adService.getCampaign(widget.campaignId);
      
      // Load real time-series data
      await _loadTimeSeries();
      
      setState(() {
        _campaign = campaign;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      debugPrint('Error loading campaign: $e');
    }
  }
  
  Future<void> _loadTimeSeries() async {
    try {
      final timeSeries = await _adService.getCampaignTimeSeries(
        widget.campaignId,
        period: _selectedPeriod,
      );
      
      final impressions = timeSeries['impressions'] ?? [];
      final clicks = timeSeries['clicks'] ?? [];
      
      setState(() {
        _impressionsData = impressions.map((e) => (e['value'] as num).toInt()).toList();
        _clicksData = clicks.map((e) => (e['value'] as num).toInt()).toList();
        _dateLabels = impressions.map((e) {
          final date = e['date'] as String;
          // Format: 2024-01-15 -> Jan 15
          final parts = date.split('-');
          if (parts.length >= 3) {
            final monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return '${monthNames[int.parse(parts[1])]} ${parts[2]}';
          }
          return date;
        }).toList();
      });
    } catch (e) {
      debugPrint('Error loading time series: $e');
      // Fallback to empty data
      setState(() {
        _impressionsData = [];
        _clicksData = [];
        _dateLabels = [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.scaffoldDark : AppColors.scaffoldLight,
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  _buildAppBar(isDark),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Period selector
                          _buildPeriodSelector(isDark),
                          const SizedBox(height: 20),
                          
                          // Performance chart
                          _buildPerformanceChart(isDark),
                          const SizedBox(height: 24),
                          
                          // Metrics grid
                          _buildMetricsGrid(isDark),
                          const SizedBox(height: 24),
                          
                          // Quick actions
                          _buildQuickActions(isDark),
                          const SizedBox(height: 24),
                          
                          // Performance tips
                          _buildPerformanceTips(isDark),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildAppBar(bool isDark) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      backgroundColor: isDark ? AppColors.primaryDark : AppColors.primary,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary,
                AppColors.primaryLight,
              ],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(left: 56, right: 16, bottom: 16, top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    widget.campaignName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _buildStatusBadge(_campaign?.status ?? CampaignStatus.draft),
                      const SizedBox(width: 8),
                      Text(
                        _campaign?.adType.name ?? '',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
        ),
        onPressed: () => Navigator.pop(context),
      ),
    );
  }

  Widget _buildStatusBadge(CampaignStatus status) {
    Color color;
    String label;
    
    switch (status) {
      case CampaignStatus.active:
        color = Colors.green;
        label = 'Active';
        break;
      case CampaignStatus.paused:
        color = Colors.orange;
        label = 'Paused';
        break;
      case CampaignStatus.ended:
        color = Colors.grey;
        label = 'Ended';
        break;
      default:
        color = Colors.blue;
        label = status.name;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildPeriodSelector(bool isDark) {
    return Row(
      children: [
        _buildPeriodChip('Today', '1d', isDark),
        const SizedBox(width: 8),
        _buildPeriodChip('7 Days', '7d', isDark),
        const SizedBox(width: 8),
        _buildPeriodChip('30 Days', '30d', isDark),
        const SizedBox(width: 8),
        _buildPeriodChip('All Time', 'all', isDark),
      ],
    );
  }

  Widget _buildPeriodChip(String label, String value, bool isDark) {
    final isSelected = _selectedPeriod == value;
    
    return GestureDetector(
      onTap: () {
        setState(() => _selectedPeriod = value);
        _loadTimeSeries(); // Reload data when period changes
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(colors: [AppColors.primary, AppColors.primaryLight])
              : null,
          color: isSelected ? null : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
          border: isSelected ? null : Border.all(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[700]),
          ),
        ),
      ),
    );
  }

  Widget _buildPerformanceChart(bool isDark) {
    // Use REAL data from Firestore (no more mock!)
    final impressions = _impressionsData;
    final clicks = _clicksData;
    
    // Handle empty data case
    if (impressions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.show_chart_rounded, size: 48, color: Colors.grey.withValues(alpha: 0.5)),
              const SizedBox(height: 12),
              Text(
                'No data available for this period',
                style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
              ),
            ],
          ),
        ),
      );
    }
    
    // Calculate max value for scaling
    final maxImpressions = impressions.reduce((a, b) => a > b ? a : b).toDouble();
    final horizontalInterval = maxImpressions > 0 ? (maxImpressions / 4).clamp(10.0, 1000.0) : 50.0;
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Performance Overview',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
              const Spacer(),
              _buildChartLegend('Impressions', Colors.blue, isDark),
              const SizedBox(width: 16),
              _buildChartLegend('Clicks', AppColors.primary, isDark),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: horizontalInterval,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                    strokeWidth: 1,
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: (_dateLabels.length / 5).clamp(1, 7).toDouble(),
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx >= 0 && idx < _dateLabels.length) {
                          return Text(
                            _dateLabels[idx],
                            style: TextStyle(
                              fontSize: 9,
                              color: isDark ? Colors.grey[500] : Colors.grey[600],
                            ),
                          );
                        }
                        return const Text('');
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  // Impressions line
                  LineChartBarData(
                    spots: impressions.asMap().entries.map(
                      (e) => FlSpot(e.key.toDouble(), e.value.toDouble())
                    ).toList(),
                    isCurved: true,
                    color: Colors.blue,
                    barWidth: 3,
                    dotData: FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: Colors.blue.withValues(alpha: 0.1),
                    ),
                  ),
                  // Clicks line (scaled up for visibility)
                  LineChartBarData(
                    spots: clicks.asMap().entries.map(
                      (e) => FlSpot(e.key.toDouble(), e.value.toDouble() * (maxImpressions > 0 ? maxImpressions / (clicks.reduce((a, b) => a > b ? a : b).toDouble().clamp(1, 9999)) * 0.3 : 10))
                    ).toList(),
                    isCurved: true,
                    color: AppColors.primary,
                    barWidth: 3,
                    dotData: FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.primary.withValues(alpha: 0.1),
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

  Widget _buildChartLegend(String label, Color color, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildMetricsGrid(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Key Metrics',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.6,
          children: [
            _buildMetricCard('Total Spend', '₹${_campaign?.spentTotal.toStringAsFixed(0) ?? '0'}', Icons.account_balance_wallet_rounded, Colors.purple, isDark),
            _buildMetricCard('Impressions', '${_campaign?.impressions ?? 0}', Icons.visibility_rounded, Colors.blue, isDark),
            _buildMetricCard('Clicks', '${_campaign?.clicks ?? 0}', Icons.touch_app_rounded, AppColors.primary, isDark),
            _buildMetricCard('CTR', '${((_campaign?.clicks ?? 0) / ((_campaign?.impressions ?? 1) == 0 ? 1 : _campaign!.impressions) * 100).toStringAsFixed(2)}%', Icons.trending_up_rounded, Colors.orange, isDark),
            _buildMetricCard('Orders', '${_campaign?.conversions ?? 0}', Icons.shopping_cart_rounded, Colors.green, isDark),
            _buildMetricCard('Avg CPC', '₹${_campaign?.clicks != null && _campaign!.clicks > 0 ? (_campaign!.spentTotal / _campaign!.clicks).toStringAsFixed(2) : '0'}', Icons.payments_rounded, Colors.teal, isDark),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildActionButton(
                _campaign?.status == CampaignStatus.active ? 'Pause Campaign' : 'Resume Campaign',
                _campaign?.status == CampaignStatus.active ? Icons.pause_rounded : Icons.play_arrow_rounded,
                _campaign?.status == CampaignStatus.active ? Colors.orange : Colors.green,
                () => _toggleCampaignStatus(),
                isDark,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildActionButton(
                'Edit Budget',
                Icons.edit_rounded,
                AppColors.primary,
                () {/* Navigate to edit */},
                isDark,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: _buildActionButton(
            'End Campaign',
            Icons.stop_rounded,
            Colors.red,
            () => _confirmEndCampaign(),
            isDark,
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(String label, IconData icon, Color color, VoidCallback onTap, bool isDark) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPerformanceTips(bool isDark) {
    final tips = <Map<String, dynamic>>[];
    
    // Generate tips based on campaign performance
    final ctr = (_campaign?.clicks ?? 0) / ((_campaign?.impressions ?? 1) == 0 ? 1 : _campaign!.impressions) * 100;
    
    if (ctr < 1) {
      tips.add({
        'icon': Icons.trending_up_rounded,
        'color': Colors.orange,
        'text': 'Low CTR detected. Consider improving your product images or increasing bid.',
      });
    }
    
    if ((_campaign?.spentToday ?? 0) < (_campaign?.dailyBudget ?? 1) * 0.5) {
      tips.add({
        'icon': Icons.lightbulb_rounded,
        'color': Colors.amber,
        'text': 'Budget underutilized. Increase your CPC to get more visibility.',
      });
    }
    
    tips.add({
      'icon': Icons.check_circle_rounded,
      'color': Colors.green,
      'text': 'Your campaign is performing! Keep monitoring for best results.',
    });
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Performance Tips',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),
        ...tips.map((tip) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: (tip['color'] as Color).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: (tip['color'] as Color).withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Icon(tip['icon'] as IconData, size: 20, color: tip['color'] as Color),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  tip['text'] as String,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                  ),
                ),
              ),
            ],
          ),
        )),
      ],
    );
  }

  Future<void> _toggleCampaignStatus() async {
    if (_campaign == null) return;
    
    try {
      if (_campaign!.status == CampaignStatus.active) {
        await _adService.pauseCampaign(_campaign!.id);
      } else {
        await _adService.resumeCampaign(_campaign!.id);
      }
      await _loadCampaign();
    } catch (e) {
      debugPrint('Error toggling campaign: $e');
    }
  }

  void _confirmEndCampaign() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('End Campaign?'),
        content: const Text('This will permanently stop this campaign. This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await _adService.updateCampaign(_campaign!.id, {'status': CampaignStatus.ended.name});
              await _loadCampaign();
            },
            child: const Text('End Campaign', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
