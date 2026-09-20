import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'select_products_screen.dart';
import 'campaign_analytics_screen.dart';

class CampaignDetailScreen extends StatefulWidget {
  final String campaignId;

  const CampaignDetailScreen({super.key, required this.campaignId});

  @override
  State<CampaignDetailScreen> createState() => _CampaignDetailScreenState();
}

class _CampaignDetailScreenState extends State<CampaignDetailScreen> {
  final AdService _adService = AdService();
  
  AdCampaignModel? _campaign;
  List<AdProductModel> _products = [];
  Map<String, dynamic> _analytics = {};
  Map<String, int> _placementBreakdown = {}; // NEW: Click placement analytics
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      _campaign = await _adService.getCampaign(widget.campaignId);
      _analytics = await _adService.getCampaignAnalytics(widget.campaignId);
      _placementBreakdown = await _adService.getClickPlacementBreakdown(widget.campaignId); // NEW
      
      // Get products
      final productsStream = _adService.getCampaignProducts(widget.campaignId);
      _products = await productsStream.first;
    } catch (e) {
      debugPrint('Error loading campaign: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded,
              color: isDark ? Colors.white : const Color(0xFF111827)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _campaign?.name ?? 'Campaign Details',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          if (_campaign != null)
            PopupMenuButton(
              icon: Icon(Icons.more_vert_rounded,
                  color: isDark ? Colors.white : const Color(0xFF111827)),
              itemBuilder: (context) => [
                PopupMenuItem(
                  child: Row(
                    children: [
                      Icon(Icons.analytics_rounded, size: 20),
                      const SizedBox(width: 8),
                      Text('View Analytics'),
                    ],
                  ),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CampaignAnalyticsScreen(
                        campaignId: widget.campaignId,
                        campaignName: _campaign?.name ?? 'Campaign',
                      ),
                    ),
                  ),
                ),
                PopupMenuItem(
                  child: Row(
                    children: [
                      Icon(
                        _campaign!.status == CampaignStatus.active
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(_campaign!.status == CampaignStatus.active
                          ? 'Pause Campaign'
                          : 'Resume Campaign'),
                    ],
                  ),
                  onTap: () => _toggleStatus(),
                ),
              ],
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _campaign == null
              ? const Center(child: Text('Campaign not found'))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildStatusCard(isDark),
                        const SizedBox(height: 20),
                        _buildStatsGrid(isDark),
                        const SizedBox(height: 24),
                        _buildClickSourcesSection(isDark), // NEW: Click placement analytics
                        const SizedBox(height: 24),
                        _buildBudgetProgress(isDark),
                        const SizedBox(height: 24),
                        _buildProductsSection(isDark),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatusCard(bool isDark) {
    final statusColors = {
      CampaignStatus.active: const Color(0xFF10B981),
      CampaignStatus.paused: const Color(0xFFF59E0B),
      CampaignStatus.pendingReview: const Color(0xFF3B82F6),
      CampaignStatus.rejected: const Color(0xFFEF4444),
      CampaignStatus.exhausted: const Color(0xFF6B7280),
    };

    final statusColor = statusColors[_campaign!.status] ?? Colors.grey;
    final statusLabels = {
      CampaignStatus.active: 'Active',
      CampaignStatus.paused: 'Paused',
      CampaignStatus.pendingReview: 'Pending Review',
      CampaignStatus.rejected: 'Rejected',
      CampaignStatus.exhausted: 'Out of Budget',
    };

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF1E293B) : Colors.white).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: statusColor.withValues(alpha: 0.3),
        ),
        boxShadow: [
          BoxShadow(
            color: statusColor.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Ad Type Icon Area
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      statusColor.withValues(alpha: 0.2),
                      statusColor.withValues(alpha: 0.1),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: statusColor.withValues(alpha: 0.2)),
                ),
                child: Icon(_getAdTypeIcon(_campaign!.adType), color: statusColor, size: 32),
              ),
              const SizedBox(width: 20),
              // Status & Name
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          statusLabels[_campaign!.status] ?? 'Unknown',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: statusColor,
                            letterSpacing: -0.5,
                          ),
                        ),
                        if (_campaign!.status == CampaignStatus.rejected && _campaign!.rejectionReason != null)
                          IconButton(
                            icon: const Icon(Icons.info_outline, color: Colors.red, size: 20),
                            onPressed: () => _showRejectionReason(),
                            padding: const EdgeInsets.only(left: 8),
                            constraints: const BoxConstraints(),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.layers_outlined, 
                              size: 14, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                          const SizedBox(width: 6),
                          Text(
                            '${_getAdTypeLabel(_campaign!.adType)} • ${_campaign!.billingType.name.toUpperCase()}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: -0.1);
  }

  Widget _buildStatsGrid(bool isDark) {
    final stats = [
      {'label': 'Total Impressions', 'value': '${_analytics['impressions'] ?? 0}', 'icon': Icons.visibility_rounded, 'color': const Color(0xFF6366F1)},
      {'label': 'Total Clicks', 'value': '${_analytics['clicks'] ?? 0}', 'icon': Icons.touch_app_rounded, 'color': const Color(0xFF10B981)},
      {'label': 'Click Through Rate', 'value': '${((_analytics['ctr'] as num?) ?? 0).toStringAsFixed(2)}%', 'icon': Icons.trending_up_rounded, 'color': const Color(0xFFF59E0B)},
      {'label': 'Total Conversions', 'value': '${_analytics['conversions'] ?? 0}', 'icon': Icons.shopping_bag_rounded, 'color': const Color(0xFFEF4444)},
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 1.4,
      ),
      itemCount: stats.length,
      itemBuilder: (context, index) {
        final stat = stats[index];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (stat['color'] as Color).withValues(alpha: 0.15),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (stat['color'] as Color).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(stat['icon'] as IconData, size: 20, color: stat['color'] as Color),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stat['value'] as String,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    stat['label'] as String,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ).animate(delay: (50 * index).ms).fadeIn().scale(begin: const Offset(0.9, 0.9));
      },
    );
  }

  /// NEW: Click Sources Section - Shows WHERE clicks come from
  Widget _buildClickSourcesSection(bool isDark) {
    if (_placementBreakdown.isEmpty) {
      return const SizedBox.shrink(); // No data yet
    }

    final totalClicks = _placementBreakdown.values.fold<int>(0, (a, b) => a + b);
    if (totalClicks == 0) return const SizedBox.shrink();

    // Placement display config
    final placementConfig = {
      'home': {'label': 'Home Page', 'icon': Icons.home_rounded, 'color': const Color(0xFF6366F1)},
      'productPage': {'label': 'Product Page', 'icon': Icons.shopping_bag_rounded, 'color': const Color(0xFF10B981)},
      'search': {'label': 'Search Results', 'icon': Icons.search_rounded, 'color': const Color(0xFFF59E0B)},
      'category': {'label': 'Category Page', 'icon': Icons.category_rounded, 'color': const Color(0xFF3B82F6)},
      'cart': {'label': 'Cart Page', 'icon': Icons.shopping_cart_rounded, 'color': const Color(0xFFEF4444)},
    };

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.pie_chart_rounded, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'Click Sources',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...(_placementBreakdown.entries.map((entry) {
            final config = placementConfig[entry.key] ?? {
              'label': entry.key.toUpperCase(),
              'icon': Icons.touch_app_rounded,
              'color': Colors.grey,
            };
            final percentage = (entry.value / totalClicks * 100).toStringAsFixed(1);
            
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: (config['color'] as Color).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      config['icon'] as IconData,
                      size: 18,
                      color: config['color'] as Color,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          config['label'] as String,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : const Color(0xFF111827),
                          ),
                        ),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: entry.value / totalClicks,
                            backgroundColor: (config['color'] as Color).withValues(alpha: 0.1),
                            valueColor: AlwaysStoppedAnimation(config['color'] as Color),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${entry.value}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: config['color'] as Color,
                        ),
                      ),
                      Text(
                        '$percentage%',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          })),
        ],
      ),
    ).animate().fadeIn(delay: 150.ms);
  }

  Widget _buildBudgetProgress(bool isDark) {
    final spent = _campaign!.spentTotal;
    final total = _campaign!.totalBudget;
    final progress = total > 0 ? (spent / total).clamp(0.0, 1.0) : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Budget Used',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
              Text(
                '₹${spent.toStringAsFixed(0)} / ₹${total.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.grey[300] : Colors.grey[700],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: AppColors.primary.withValues(alpha: 0.2),
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
              minHeight: 10,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildBudgetInfo('Daily', '₹${_campaign!.dailyBudget.toStringAsFixed(0)}', isDark),
              _buildBudgetInfo('Today', '₹${_campaign!.spentToday.toStringAsFixed(0)}', isDark),
              _buildBudgetInfo('Remaining', '₹${(_campaign!.remainingTotalBudget).toStringAsFixed(0)}', isDark),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  Widget _buildBudgetInfo(String label, String value, bool isDark) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.grey[500] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildProductsSection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Products (${_products.length})',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            TextButton.icon(
              onPressed: () => _addProducts(),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_products.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                style: BorderStyle.solid,
              ),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.inventory_2_outlined, 
                      size: 40, color: Colors.grey.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  Text(
                    'No products added yet',
                    style: TextStyle(
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => _addProducts(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Add Products'),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _products.length,
            itemBuilder: (context, index) {
              final product = _products[index];
              return _buildProductCard(product, isDark, index);
            },
          ),
      ],
    );
  }

  Widget _buildProductCard(AdProductModel product, bool isDark, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          // Product Image
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: product.productImage != null
                ? Image.network(
                    product.productImage!,
                    width: 50,
                    height: 50,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 50,
                      height: 50,
                      color: Colors.grey[300],
                      child: const Icon(Icons.image, color: Colors.grey),
                    ),
                  )
                : Container(
                    width: 50,
                    height: 50,
                    color: Colors.grey[300],
                    child: const Icon(Icons.image, color: Colors.grey),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.productName ?? 'Product',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _buildProductStat('Bid', '₹${product.bidAmount}'),
                    const SizedBox(width: 12),
                    _buildProductStat('Clicks', '${product.clicks}'),
                    const SizedBox(width: 12),
                    _buildProductStat('CTR', '${product.ctr.toStringAsFixed(1)}%'),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.more_vert, 
                color: isDark ? Colors.grey[400] : Colors.grey[600]),
            onPressed: () {},
          ),
        ],
      ),
    ).animate(delay: (50 * index).ms).fadeIn().slideX(begin: 0.1);
  }

  Widget _buildProductStat(String label, String value) {
    return Text(
      '$label: $value',
      style: TextStyle(
        fontSize: 11,
        color: Colors.grey[500],
      ),
    );
  }

  void _toggleStatus() async {
    if (_campaign == null) return;
    
    if (_campaign!.status == CampaignStatus.active) {
      await _adService.pauseCampaign(widget.campaignId);
    } else if (_campaign!.status == CampaignStatus.paused) {
      await _adService.resumeCampaign(widget.campaignId);
    }
    
    _loadData();
  }

  void _showRejectionReason() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Campaign Rejected'),
        content: Text(_campaign?.rejectionReason ?? 'No reason provided'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _addProducts() async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SelectProductsScreen(
          campaignId: widget.campaignId,
          alreadyAddedProductIds: _products.map((p) => p.productId).toList(),
        ),
      ),
    );
    
    if (result == true) {
      _loadData(); // Refresh to show newly added products
    }
  }

  // Helper methods for ad types
  IconData _getAdTypeIcon(AdType type) {
    switch (type) {
      case AdType.sponsoredProduct: return Icons.shopping_bag_rounded;
      case AdType.keywordSearch: return Icons.search_rounded;
      case AdType.categoryBoost: return Icons.star_rounded;
      case AdType.reelsBoost: return Icons.videocam_rounded;
      case AdType.homeBanner: return Icons.panorama_rounded;
      case AdType.brandStore: return Icons.store_rounded;
      case AdType.retargeting: return Icons.track_changes_rounded;
    }
  }

  String _getAdTypeLabel(AdType type) {
    switch (type) {
      case AdType.sponsoredProduct: return 'Product Ad';
      case AdType.keywordSearch: return 'Keyword Search';
      case AdType.categoryBoost: return 'Category Boost';
      case AdType.reelsBoost: return 'Reels Boost';
      case AdType.homeBanner: return 'Home Banner';
      case AdType.brandStore: return 'Brand Store';
      case AdType.retargeting: return 'Retargeting';
    }
  }
}
