import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../providers/seller_provider.dart';

// Sub-screens
import 'create_campaign_screen.dart';
import 'campaign_detail_screen.dart';
import 'ad_wallet_screen.dart';

class SellerAdsScreen extends StatefulWidget {
  const SellerAdsScreen({super.key});

  @override
  State<SellerAdsScreen> createState() => _SellerAdsScreenState();
}

class _SellerAdsScreenState extends State<SellerAdsScreen> {
  final AdService _adService = AdService();
  
  bool _isLoading = true;
  AdWalletModel? _wallet;
  List<AdCampaignModel> _campaigns = [];
  Map<String, dynamic> _analytics = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
    if (sellerId == null) return;

    setState(() => _isLoading = true);

    try {
      _wallet = await _adService.getOrCreateAdWallet(sellerId);
      _analytics = await _adService.getSellerAdsAnalytics(sellerId);
      
      // Get campaigns snapshot
      final campaignsQuery = await _adService.getSellerCampaigns(sellerId).first;
      _campaigns = campaignsQuery;
    } catch (e) {
      debugPrint('Error loading ads data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final sellerName = Provider.of<SellerProvider>(context).currentSeller?.storeName ?? 'Seller';

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: SafeArea(
        child: Column(
          children: [
            _buildPremiumHeader(isDark, sellerName),
            _buildWalletCard(isDark),
            _buildPerformanceStats(isDark),
            _buildQuickLaunchSection(isDark),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _buildCampaignsTab(isDark),
            ),
          ],
        ),
      ),
      floatingActionButton: _buildFAB(isDark),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  // ============================================================
  // PREMIUM HEADER with Greeting
  // ============================================================
  Widget _buildPremiumHeader(bool isDark, String sellerName) {
    // Time-based greeting
    final hour = DateTime.now().hour;
    String greeting;
    IconData greetingIcon;
    if (hour < 12) {
      greeting = 'Good Morning';
      greetingIcon = Icons.wb_sunny_rounded;
    } else if (hour < 17) {
      greeting = 'Good Afternoon';
      greetingIcon = Icons.wb_cloudy_rounded;
    } else {
      greeting = 'Good Evening';
      greetingIcon = Icons.nightlight_round;
    }

    // Calculate today's impressions from campaigns
    final todayImpressions = _campaigns.fold<int>(0, (sum, c) => sum + c.impressions);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Greeting Section
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(greetingIcon, color: const Color(0xFFF59E0B), size: 18),
                        const SizedBox(width: 6),
                        Text(
                          '$greeting,',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      sellerName,
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.visibility_rounded, 
                            size: 14, color: isDark ? Colors.grey[500] : Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          todayImpressions > 1000 
                              ? '${(todayImpressions / 1000).toStringAsFixed(1)}K impressions'
                              : '$todayImpressions impressions',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Wallet Button
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AdWalletScreen()),
                ).then((_) => _loadData()),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.account_balance_wallet_rounded, 
                          color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        '₹${_wallet?.balance.toStringAsFixed(0) ?? '0'}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn().scale(delay: 200.ms),
            ],
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: -0.2);
  }

  // ============================================================
  // WALLET CARD
  // ============================================================
  Widget _buildWalletCard(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF6366F1).withValues(alpha: 0.15),
                  const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                ],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: const Color(0xFF6366F1).withValues(alpha: 0.2),
              ),
            ),
            child: Row(
              children: [
                // Balance Section
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ads Wallet Balance',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${_wallet?.balance.toStringAsFixed(2) ?? '0.00'}',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: isDark ? Colors.white : const Color(0xFF111827),
                              letterSpacing: -1,
                            ),
                          ),
                          if (_wallet != null && _wallet!.isLowBalance)
                            Container(
                              margin: const EdgeInsets.only(left: 8, bottom: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.orange.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'LOW',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.orange,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Action Buttons
                Column(
                  children: [
                    _buildQuickAction(
                      icon: Icons.add_rounded,
                      label: 'Top Up',
                      color: const Color(0xFF10B981),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AdWalletScreen()),
                      ).then((_) => _loadData()),
                    ),
                    const SizedBox(height: 8),
                    _buildQuickAction(
                      icon: Icons.swap_horiz_rounded,
                      label: 'Transfer',
                      color: const Color(0xFF3B82F6),
                      onTap: () => _showTransferDialog(),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1);
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // PERFORMANCE STATS - 6 Cards
  // ============================================================
  Widget _buildPerformanceStats(bool isDark) {
    // Calculate stats from campaigns
    final activeCampaigns = _campaigns.where((c) => c.status == CampaignStatus.active).length;
    final totalSpent = _campaigns.fold<double>(0, (sum, c) => sum + c.spentTotal);
    final totalImpressions = _campaigns.fold<int>(0, (sum, c) => sum + c.impressions);
    final totalClicks = _campaigns.fold<int>(0, (sum, c) => sum + c.clicks);
    final avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0.0;
    final conversions = (_analytics['conversions'] as int?) ?? 0;

    final stats = [
      {'label': 'Active', 'value': '$activeCampaigns', 'icon': Icons.play_circle_rounded, 'color': const Color(0xFF10B981)},
      {'label': 'Spent', 'value': '₹${totalSpent.toStringAsFixed(0)}', 'icon': Icons.payments_rounded, 'color': const Color(0xFFF59E0B)},
      {'label': 'Impressions', 'value': _formatNumber(totalImpressions), 'icon': Icons.visibility_rounded, 'color': const Color(0xFF3B82F6)},
      {'label': 'Clicks', 'value': _formatNumber(totalClicks), 'icon': Icons.touch_app_rounded, 'color': const Color(0xFF8B5CF6)},
      {'label': 'Avg CTR', 'value': '${avgCtr.toStringAsFixed(1)}%', 'icon': Icons.trending_up_rounded, 'color': const Color(0xFF06B6D4)},
      {'label': 'Orders', 'value': '$conversions', 'icon': Icons.shopping_cart_rounded, 'color': const Color(0xFFEF4444)},
    ];

    return SizedBox(
      height: 80,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: stats.length,
        itemBuilder: (context, index) {
          final stat = stats[index];
          return Container(
            width: 100,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (stat['color'] as Color).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: (stat['color'] as Color).withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Icon(stat['icon'] as IconData, size: 14, color: stat['color'] as Color),
                    const Spacer(),
                    Text(
                      stat['value'] as String,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Text(
                  stat['label'] as String,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: stat['color'] as Color),
                ),
              ],
            ),
          ).animate(delay: (60 * index).ms).fadeIn().slideX(begin: 0.15);
        },
      ),
    );
  }

  String _formatNumber(int num) {
    if (num >= 1000000) return '${(num / 1000000).toStringAsFixed(1)}M';
    if (num >= 1000) return '${(num / 1000).toStringAsFixed(1)}K';
    return '$num';
  }

  // ============================================================
  // QUICK LAUNCH - 7 Ad Types
  // ============================================================
  Widget _buildQuickLaunchSection(bool isDark) {
    final adTypes = [
      {'type': AdType.sponsoredProduct, 'label': 'Product', 'icon': Icons.shopping_bag_rounded, 'color': const Color(0xFF3B82F6)},
      {'type': AdType.keywordSearch, 'label': 'Keyword', 'icon': Icons.search_rounded, 'color': const Color(0xFF10B981)},
      {'type': AdType.categoryBoost, 'label': 'Category', 'icon': Icons.star_rounded, 'color': const Color(0xFFF59E0B)},
      {'type': AdType.reelsBoost, 'label': 'Reels', 'icon': Icons.videocam_rounded, 'color': const Color(0xFFEC4899)},
      {'type': AdType.homeBanner, 'label': 'Banner', 'icon': Icons.panorama_rounded, 'color': const Color(0xFF06B6D4)},
      {'type': AdType.brandStore, 'label': 'Store', 'icon': Icons.store_rounded, 'color': const Color(0xFF8B5CF6)},
      {'type': AdType.retargeting, 'label': 'Retarget', 'icon': Icons.track_changes_rounded, 'color': const Color(0xFFEF4444)},
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Quick Launch',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              const Spacer(),
              Icon(Icons.rocket_launch_rounded, size: 14, color: isDark ? Colors.grey[500] : Colors.grey[500]),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: adTypes.length,
              itemBuilder: (context, index) {
                final ad = adTypes[index];
                return GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CreateCampaignScreen()),
                  ).then((_) => _loadData()),
                  child: Container(
                    width: 56,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: (ad['color'] as Color).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: (ad['color'] as Color).withValues(alpha: 0.25)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(ad['icon'] as IconData, size: 20, color: ad['color'] as Color),
                        const SizedBox(height: 4),
                        Text(
                          ad['label'] as String,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: ad['color'] as Color,
                          ),
                        ),
                      ],
                    ),
                  ),
                ).animate(delay: (50 * index).ms).fadeIn().scale(begin: const Offset(0.8, 0.8));
              },
            ),
          ),
        ],
      ),
    );
  }



  // ============================================================
  // CAMPAIGNS TAB
  // ============================================================
  Widget _buildCampaignsTab(bool isDark) {
    if (_campaigns.isEmpty) {
      return _buildEmptyState(isDark);
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: _campaigns.length,
        itemBuilder: (context, index) {
          final campaign = _campaigns[index];
          return _buildCampaignCard(campaign, isDark, index);
        },
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.campaign_rounded,
                size: 40,
                color: AppColors.primary.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No Campaigns Yet',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Create your first ad campaign\nto boost product visibility',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CreateCampaignScreen()),
              ).then((_) => _loadData()),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Create Campaign'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9));
  }

  Widget _buildCampaignCard(AdCampaignModel campaign, bool isDark, int index) {
    final statusColors = {
      CampaignStatus.active: const Color(0xFF10B981),
      CampaignStatus.paused: const Color(0xFFF59E0B),
      CampaignStatus.pendingReview: const Color(0xFF3B82F6),
      CampaignStatus.rejected: const Color(0xFFEF4444),
      CampaignStatus.exhausted: const Color(0xFF6B7280),
      CampaignStatus.ended: const Color(0xFF6B7280),
      CampaignStatus.draft: const Color(0xFF9CA3AF),
    };

    final statusColor = statusColors[campaign.status] ?? Colors.grey;
    
    // Check if campaign can be deleted
    final canDelete = [
      CampaignStatus.ended,
      CampaignStatus.exhausted,
      CampaignStatus.rejected,
      CampaignStatus.draft,
      CampaignStatus.paused,
    ].contains(campaign.status);

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CampaignDetailScreen(campaignId: campaign.id),
        ),
      ).then((_) => _loadData()),
      onLongPress: () => _showCampaignActions(campaign, isDark, canDelete),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: (isDark ? const Color(0xFF1E293B) : Colors.white).withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: statusColor.withValues(alpha: 0.3),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: isDark ? Colors.black26 : Colors.grey.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.campaign_rounded, color: statusColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        campaign.name,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        campaign.targetType.name.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _getStatusLabel(campaign.status),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ),
                // Menu Button
                IconButton(
                  icon: Icon(Icons.more_vert, color: isDark ? Colors.grey[500] : Colors.grey[600], size: 20),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => _showCampaignActions(campaign, isDark, canDelete),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Ad Type & Billing Row
            Row(
              children: [
                // Ad Type Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getAdTypeColor(campaign.adType).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_getAdTypeIcon(campaign.adType), size: 12, color: _getAdTypeColor(campaign.adType)),
                      const SizedBox(width: 4),
                      Text(
                        _getAdTypeLabel(campaign.adType),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _getAdTypeColor(campaign.adType)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Billing Type
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    campaign.billingType.name.toUpperCase(),
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                ),
                const Spacer(),
                // Inline Pause/Resume Button
                if (campaign.status == CampaignStatus.active || campaign.status == CampaignStatus.paused)
                  GestureDetector(
                    onTap: () async {
                      if (campaign.status == CampaignStatus.active) {
                        await _adService.pauseCampaign(campaign.id);
                      } else {
                        await _adService.resumeCampaign(campaign.id);
                      }
                      _loadData();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (campaign.status == CampaignStatus.active ? Colors.orange : const Color(0xFF10B981)).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            campaign.status == CampaignStatus.active ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            size: 14,
                            color: campaign.status == CampaignStatus.active ? Colors.orange : const Color(0xFF10B981),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            campaign.status == CampaignStatus.active ? 'Pause' : 'Resume',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: campaign.status == CampaignStatus.active ? Colors.orange : const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            // Stats Row
            Row(
              children: [
                _buildCampaignStat('Budget', '₹${campaign.dailyBudget.toStringAsFixed(0)}/day', isDark),
                _buildCampaignStat('Spent', '₹${campaign.spentTotal.toStringAsFixed(0)}', isDark),
                _buildCampaignStat('Clicks', '${campaign.clicks}', isDark),
                _buildCampaignStat('CTR', '${campaign.ctr.toStringAsFixed(1)}%', isDark),
              ],
            ),
            // Progress Bar
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: campaign.totalBudget > 0 
                    ? (campaign.spentTotal / campaign.totalBudget).clamp(0, 1) 
                    : 0,
                backgroundColor: statusColor.withValues(alpha: 0.2),
                valueColor: AlwaysStoppedAnimation(statusColor),
                minHeight: 4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${((campaign.spentTotal / campaign.totalBudget) * 100).toStringAsFixed(0)}% of ₹${campaign.totalBudget.toStringAsFixed(0)} budget used',
              style: TextStyle(
                fontSize: 10,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    ).animate(delay: (50 * index).ms).fadeIn().slideY(begin: 0.1);
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
      case AdType.sponsoredProduct: return 'Product';
      case AdType.keywordSearch: return 'Keyword';
      case AdType.categoryBoost: return 'Category';
      case AdType.reelsBoost: return 'Reels';
      case AdType.homeBanner: return 'Banner';
      case AdType.brandStore: return 'Store';
      case AdType.retargeting: return 'Retarget';
    }
  }

  Color _getAdTypeColor(AdType type) {
    switch (type) {
      case AdType.sponsoredProduct: return const Color(0xFF3B82F6);
      case AdType.keywordSearch: return const Color(0xFF10B981);
      case AdType.categoryBoost: return const Color(0xFFF59E0B);
      case AdType.reelsBoost: return const Color(0xFFEC4899);
      case AdType.homeBanner: return const Color(0xFF06B6D4);
      case AdType.brandStore: return const Color(0xFF8B5CF6);
      case AdType.retargeting: return const Color(0xFFEF4444);
    }
  }

  void _showCampaignActions(AdCampaignModel campaign, bool isDark, bool canDelete) {
    HapticFeedback.mediumImpact();
    
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              campaign.name,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
            const SizedBox(height: 16),
            // View Details
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.visibility_rounded, color: Colors.blue),
              ),
              title: Text('View Details', style: TextStyle(color: isDark ? Colors.white : Colors.black)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => CampaignDetailScreen(campaignId: campaign.id)),
                ).then((_) => _loadData());
              },
            ),
            // Pause/Resume
            if (campaign.status == CampaignStatus.active || campaign.status == CampaignStatus.paused)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    campaign.status == CampaignStatus.active ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.orange,
                  ),
                ),
                title: Text(
                  campaign.status == CampaignStatus.active ? 'Pause Campaign' : 'Resume Campaign',
                  style: TextStyle(color: isDark ? Colors.white : Colors.black),
                ),
                onTap: () async {
                  Navigator.pop(context);
                  if (campaign.status == CampaignStatus.active) {
                    await _adService.pauseCampaign(campaign.id);
                  } else {
                    await _adService.resumeCampaign(campaign.id);
                  }
                  _loadData();
                },
              ),
            // Delete
            if (canDelete)
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.delete_rounded, color: Colors.red),
                ),
                title: const Text('Delete Campaign', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  _confirmDeleteCampaign(campaign, isDark);
                },
              ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteCampaign(AdCampaignModel campaign, bool isDark) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete Campaign?',
          style: TextStyle(color: isDark ? Colors.white : Colors.black),
        ),
        content: Text(
          'Are you sure you want to delete "${campaign.name}"? This action cannot be undone.',
          style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              
              final success = await _adService.deleteCampaign(campaign.id);
              
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Campaign deleted successfully'),
                    backgroundColor: Colors.green,
                  ),
                );
              } else if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Failed to delete campaign'),
                    backgroundColor: Colors.red,
                  ),
                );
              }
              
              _loadData();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }


  Widget _buildCampaignStat(String label, String value, bool isDark) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.grey[500] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  String _getStatusLabel(CampaignStatus status) {
    switch (status) {
      case CampaignStatus.active: return 'Active';
      case CampaignStatus.paused: return 'Paused';
      case CampaignStatus.pendingReview: return 'Pending';
      case CampaignStatus.rejected: return 'Rejected';
      case CampaignStatus.exhausted: return 'Out of Budget';
      case CampaignStatus.ended: return 'Ended';
      case CampaignStatus.draft: return 'Draft';
    }
  }

  Widget _buildAnalyticsCard(String label, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: color),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  Widget _buildTopCampaignRow(AdCampaignModel campaign, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _getAdTypeColor(campaign.adType).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_getAdTypeIcon(campaign.adType), size: 16, color: _getAdTypeColor(campaign.adType)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campaign.name,
                  style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF111827)),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                Text('${campaign.clicks} clicks • ${campaign.ctr.toStringAsFixed(1)}% CTR',
                    style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[500] : Colors.grey[600])),
              ],
            ),
          ),
          Text('₹${campaign.spentTotal.toStringAsFixed(0)}',
              style: TextStyle(fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF111827))),
        ],
      ),
    );
  }

  Widget _buildAdTypePerformanceRow(AdType type, Map<String, dynamic> data, bool isDark) {
    final color = _getAdTypeColor(type);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(_getAdTypeIcon(type), size: 18, color: color),
          const SizedBox(width: 10),
          Text(_getAdTypeLabel(type), style: TextStyle(fontWeight: FontWeight.w600, color: color)),
          const Spacer(),
          Text('${data['count']} campaigns', style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600])),
          const SizedBox(width: 12),
          Text('${data['clicks']} clicks', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  Widget _buildEmptyAnalyticsCard(String message, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(30),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(message, style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600])),
      ),
    );
  }

  Widget _buildSettingItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: isDark ? Colors.grey[600] : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // FAB
  // ============================================================
  Widget _buildFAB(bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 100), // Space above floating bottom nav
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CreateCampaignScreen()),
            ).then((_) => _loadData()),
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'New Campaign',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        'Boost your products',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_forward_rounded, 
                        color: Colors.white, size: 16),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.3);
  }

  // ============================================================
  // DIALOGS
  // ============================================================
  void _showTransferDialog() {
    final controller = TextEditingController();
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Transfer from Main Wallet',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter amount to transfer to your Ads Wallet',
                style: TextStyle(
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  prefixStyle: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  hintText: '0',
                  filled: true,
                  fillColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    final amount = double.tryParse(controller.text);
                    if (amount == null || amount <= 0) return;

                    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
                    if (sellerId == null) return;

                    final result = await _adService.transferFromMainWallet(
                      sellerId: sellerId,
                      amount: amount,
                    );
                    final success = result['success'] == true;

                    if (mounted) {
                      Navigator.pop(context);
                      _loadData();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success 
                              ? '✅ Transferred ₹$amount to Ads Wallet'
                              : '❌ ${result['message'] ?? 'Insufficient balance'}'),
                          backgroundColor: success ? Colors.green : Colors.red,
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Transfer',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
