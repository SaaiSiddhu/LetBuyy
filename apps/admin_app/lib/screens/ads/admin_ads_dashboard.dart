import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class AdminAdsDashboard extends StatefulWidget {
  const AdminAdsDashboard({super.key});

  @override
  State<AdminAdsDashboard> createState() => _AdminAdsDashboardState();
}

class _AdminAdsDashboardState extends State<AdminAdsDashboard>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final AdService _adService = AdService();

  List<AdCampaignModel> _pendingCampaigns = [];
  List<AdCampaignModel> _allCampaigns = [];
  Map<String, dynamic> _platformStats = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      // Load pending campaigns
      final pendingSnapshot = await FirebaseFirestore.instance
          .collection('ad_campaigns')
          .where('status', isEqualTo: 'pendingReview')
          .orderBy('createdAt', descending: true)
          .limit(50)
          .get();

      _pendingCampaigns = pendingSnapshot.docs
          .map((d) => AdCampaignModel.fromFirestore(d))
          .toList();

      // Load all campaigns
      final allSnapshot = await FirebaseFirestore.instance
          .collection('ad_campaigns')
          .orderBy('createdAt', descending: true)
          .limit(100)
          .get();

      _allCampaigns = allSnapshot.docs
          .map((d) => AdCampaignModel.fromFirestore(d))
          .toList();

      // Get platform stats (basic stats from Firestore)
      final activeCampaigns = _allCampaigns.where((c) => c.status == CampaignStatus.active).length;
      final totalSpent = _allCampaigns.fold<double>(0, (sum, c) => sum + c.spentTotal);
      final totalClicks = _allCampaigns.fold<int>(0, (sum, c) => sum + c.clicks);
      
      _platformStats = {
        'activeCampaigns': activeCampaigns,
        'totalSpent': totalSpent,
        'totalClicks': totalClicks,
        'totalRevenue': totalSpent, // Platform revenue = total spent
        'todayRevenue': 0.0,
        'monthRevenue': totalSpent,
        'avgCpc': totalClicks > 0 ? totalSpent / totalClicks : 0.5,
      };
    } catch (e) {
      debugPrint('Error loading admin ads data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(isDark),
            _buildStatsCards(isDark),
            _buildTabBar(isDark),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildPendingTab(isDark),
                        _buildAllCampaignsTab(isDark),
                        _buildRevenueTab(isDark),
                        _buildSettingsTab(isDark),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // HEADER
  // ============================================================
  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.ads_click_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sponsored Ads',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    letterSpacing: -1,
                  ),
                ),
                Text(
                  'Manage campaigns & revenue',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          // Pending Badge
          if (_pendingCampaigns.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.pending_actions_rounded, 
                      size: 18, color: Colors.orange[700]),
                  const SizedBox(width: 8),
                  Text(
                    '${_pendingCampaigns.length} Pending',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Colors.orange[700],
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn().shake(delay: 500.ms),
        ],
      ),
    ).animate().fadeIn().slideY(begin: -0.2);
  }

  // ============================================================
  // STATS CARDS
  // ============================================================
  Widget _buildStatsCards(bool isDark) {
    final stats = [
      {
        'label': 'Total Revenue',
        'value': '₹${((_platformStats['totalRevenue'] as num?) ?? 0).toStringAsFixed(0)}',
        'icon': Icons.currency_rupee_rounded,
        'color': const Color(0xFF10B981),
        'gradient': [const Color(0xFF10B981), const Color(0xFF34D399)],
      },
      {
        'label': 'Active Campaigns',
        'value': '${_platformStats['activeCampaigns'] ?? 0}',
        'icon': Icons.play_circle_rounded,
        'color': const Color(0xFF3B82F6),
        'gradient': [const Color(0xFF3B82F6), const Color(0xFF60A5FA)],
      },
      {
        'label': 'Total Clicks',
        'value': '${_platformStats['totalClicks'] ?? 0}',
        'icon': Icons.touch_app_rounded,
        'color': const Color(0xFF8B5CF6),
        'gradient': [const Color(0xFF8B5CF6), const Color(0xFFA78BFA)],
      },
      {
        'label': 'Pending Review',
        'value': '${_pendingCampaigns.length}',
        'icon': Icons.hourglass_empty_rounded,
        'color': const Color(0xFFF59E0B),
        'gradient': [const Color(0xFFF59E0B), const Color(0xFFFBBF24)],
      },
    ];

    return SizedBox(
      height: 130,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: stats.length,
        itemBuilder: (context, index) {
          final stat = stats[index];
          return Container(
            width: 160,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  (stat['color'] as Color).withValues(alpha: 0.15),
                  (stat['color'] as Color).withValues(alpha: 0.05),
                ],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: (stat['color'] as Color).withValues(alpha: 0.2),
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: stat['gradient'] as List<Color>,
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(stat['icon'] as IconData,
                            size: 18, color: Colors.white),
                      ),
                      const Spacer(),
                      Text(
                        stat['value'] as String,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                      Text(
                        stat['label'] as String,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ).animate(delay: (80 * index).ms).fadeIn().slideX(begin: 0.2);
        },
      ),
    );
  }

  // ============================================================
  // TAB BAR
  // ============================================================
  Widget _buildTabBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6366F1).withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(4),
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
        tabs: [
          Tab(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.pending_actions_rounded, size: 14),
                  const SizedBox(width: 4),
                  const Text('Pending'),
                  if (_pendingCampaigns.isNotEmpty) ...[ 
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.orange,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${_pendingCampaigns.length}',
                        style: const TextStyle(fontSize: 9, color: Colors.white),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const Tab(text: 'Campaigns'),
          const Tab(text: 'Revenue'),
          const Tab(text: 'Settings'),
        ],
      ),
    );
  }

  // ============================================================
  // PENDING TAB
  // ============================================================
  Widget _buildPendingTab(bool isDark) {
    if (_pendingCampaigns.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  size: 60, color: Color(0xFF10B981)),
            ),
            const SizedBox(height: 20),
            Text(
              'All Caught Up!',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No campaigns pending review',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      ).animate().fadeIn().scale(begin: const Offset(0.9, 0.9));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: _pendingCampaigns.length,
        itemBuilder: (context, index) {
          final campaign = _pendingCampaigns[index];
          return _buildPendingCampaignCard(campaign, isDark, index);
        },
      ),
    );
  }

  Widget _buildPendingCampaignCard(AdCampaignModel campaign, bool isDark, int index) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF1E293B) : Colors.white).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.orange.withValues(alpha: 0.3),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black26 : Colors.grey.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.orange.withValues(alpha: 0.1),
                  Colors.orange.withValues(alpha: 0.02),
                ],
              ),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.campaign_rounded,
                      color: Colors.orange, size: 22),
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
                      Text(
                        'By Seller: ${campaign.sellerId.substring(0, 8)}...',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'PENDING',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.orange,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Campaign Details
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Row 1: Ad Type & Billing
                Row(
                  children: [
                    _buildCampaignDetailChip(
                      _getAdTypeIcon(campaign.adType),
                      _getAdTypeLabel(campaign.adType),
                      _getAdTypeColor(campaign.adType),
                      isDark,
                    ),
                    const SizedBox(width: 12),
                    _buildCampaignDetailChip(
                      Icons.payment_rounded,
                      campaign.billingType.name.toUpperCase(),
                      const Color(0xFFEC4899),
                      isDark,
                    ),
                    const SizedBox(width: 12),
                    _buildCampaignDetailChip(
                      Icons.gavel_rounded,
                      '₹${campaign.bidAmount.toStringAsFixed(1)} bid',
                      const Color(0xFFF59E0B),
                      isDark,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Row 2: Budget & Targeting
                Row(
                  children: [
                    _buildCampaignDetailChip(
                      Icons.account_balance_wallet_rounded,
                      '₹${campaign.dailyBudget.toStringAsFixed(0)}/day',
                      const Color(0xFF10B981),
                      isDark,
                    ),
                    const SizedBox(width: 12),
                    _buildCampaignDetailChip(
                      Icons.savings_rounded,
                      '₹${campaign.totalBudget.toStringAsFixed(0)} total',
                      const Color(0xFF3B82F6),
                      isDark,
                    ),
                    const SizedBox(width: 12),
                    _buildCampaignDetailChip(
                      Icons.category_rounded,
                      campaign.targetType.name.toUpperCase(),
                      const Color(0xFF8B5CF6),
                      isDark,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Keywords
                if (campaign.keywords.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: campaign.keywords.take(5).map((kw) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '#$kw',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
              ],
            ),
          ),

          // Action Buttons
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _showRejectDialog(campaign),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: () => _approveCampaign(campaign),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Approve Campaign'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate(delay: (80 * index).ms).fadeIn().slideY(begin: 0.1);
  }

  Widget _buildCampaignDetailChip(IconData icon, String label, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Helper: Get icon for ad type
  IconData _getAdTypeIcon(AdType adType) {
    switch (adType) {
      case AdType.sponsoredProduct: return Icons.shopping_bag_rounded;
      case AdType.keywordSearch: return Icons.search_rounded;
      case AdType.categoryBoost: return Icons.star_rounded;
      case AdType.reelsBoost: return Icons.videocam_rounded;
      case AdType.brandStore: return Icons.store_rounded;
      case AdType.homeBanner: return Icons.panorama_rounded;
      case AdType.retargeting: return Icons.track_changes_rounded;
    }
  }

  // Helper: Get label for ad type
  String _getAdTypeLabel(AdType adType) {
    switch (adType) {
      case AdType.sponsoredProduct: return 'Product Ad';
      case AdType.keywordSearch: return 'Keyword';
      case AdType.categoryBoost: return 'Category';
      case AdType.reelsBoost: return 'Reels';
      case AdType.brandStore: return 'Brand Store';
      case AdType.homeBanner: return 'Banner';
      case AdType.retargeting: return 'Retarget';
    }
  }

  // Helper: Get color for ad type
  Color _getAdTypeColor(AdType adType) {
    switch (adType) {
      case AdType.sponsoredProduct: return const Color(0xFF3B82F6);  // Blue
      case AdType.keywordSearch: return const Color(0xFF10B981);     // Green
      case AdType.categoryBoost: return const Color(0xFFF59E0B);     // Amber
      case AdType.reelsBoost: return const Color(0xFFEC4899);        // Pink
      case AdType.brandStore: return const Color(0xFF8B5CF6);        // Purple
      case AdType.homeBanner: return const Color(0xFF06B6D4);        // Cyan
      case AdType.retargeting: return const Color(0xFFEF4444);       // Red
    }
  }

  // ============================================================
  // ALL CAMPAIGNS TAB
  // ============================================================
  Widget _buildAllCampaignsTab(bool isDark) {
    if (_allCampaigns.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.campaign_outlined,
                size: 60, color: Colors.grey.withValues(alpha: 0.5)),
            const SizedBox(height: 16),
            Text(
              'No Campaigns Yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: _allCampaigns.length,
        itemBuilder: (context, index) {
          final campaign = _allCampaigns[index];
          return _buildCampaignListItem(campaign, isDark, index);
        },
      ),
    );
  }

  Widget _buildCampaignListItem(AdCampaignModel campaign, bool isDark, int index) {
    final statusColors = {
      CampaignStatus.active: const Color(0xFF10B981),
      CampaignStatus.paused: const Color(0xFFF59E0B),
      CampaignStatus.pendingReview: const Color(0xFF3B82F6),
      CampaignStatus.rejected: const Color(0xFFEF4444),
      CampaignStatus.exhausted: const Color(0xFF6B7280),
      CampaignStatus.ended: const Color(0xFF6B7280),
      CampaignStatus.draft: const Color(0xFF9CA3AF),
    };

    final statusLabels = {
      CampaignStatus.active: 'Active',
      CampaignStatus.paused: 'Paused',
      CampaignStatus.pendingReview: 'Pending',
      CampaignStatus.rejected: 'Rejected',
      CampaignStatus.exhausted: 'Exhausted',
      CampaignStatus.ended: 'Ended',
      CampaignStatus.draft: 'Draft',
    };

    final color = statusColors[campaign.status] ?? Colors.grey;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF1E293B) : Colors.white).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.campaign_rounded, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        campaign.name,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Ad Type badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getAdTypeColor(campaign.adType).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_getAdTypeIcon(campaign.adType), 
                               size: 10, color: _getAdTypeColor(campaign.adType)),
                          const SizedBox(width: 3),
                          Text(
                            _getAdTypeLabel(campaign.adType),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                              color: _getAdTypeColor(campaign.adType),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '₹${campaign.spentTotal.toStringAsFixed(0)} spent',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${campaign.clicks} clicks',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '• ${campaign.billingType.name.toUpperCase()}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.grey[500] : Colors.grey[500],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              statusLabels[campaign.status] ?? 'Unknown',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
        ],
      ),
    ).animate(delay: (40 * index).ms).fadeIn().slideX(begin: 0.05);
  }

  // ============================================================
  // REVENUE TAB
  // ============================================================
  Widget _buildRevenueTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Revenue Cards
          Row(
            children: [
              Expanded(child: _buildRevenueCard(
                'Today\'s Revenue',
                '₹${((_platformStats['todayRevenue'] as num?) ?? 0).toStringAsFixed(0)}',
                Icons.today_rounded,
                const Color(0xFF10B981),
                isDark,
              )),
              const SizedBox(width: 12),
              Expanded(child: _buildRevenueCard(
                'This Month',
                '₹${((_platformStats['monthRevenue'] as num?) ?? 0).toStringAsFixed(0)}',
                Icons.calendar_month_rounded,
                const Color(0xFF3B82F6),
                isDark,
              )),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildRevenueCard(
                'Total Revenue',
                '₹${((_platformStats['totalRevenue'] as num?) ?? 0).toStringAsFixed(0)}',
                Icons.savings_rounded,
                const Color(0xFF8B5CF6),
                isDark,
              )),
              const SizedBox(width: 12),
              Expanded(child: _buildRevenueCard(
                'Avg CPC',
                '₹${((_platformStats['avgCpc'] as num?) ?? 0.5).toStringAsFixed(2)}',
                Icons.price_check_rounded,
                const Color(0xFFF59E0B),
                isDark,
              )),
            ],
          ),
          const SizedBox(height: 24),
          // Analytics Placeholder
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
              ),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.analytics_rounded,
                      size: 50, color: const Color(0xFF6366F1).withValues(alpha: 0.5)),
                  const SizedBox(height: 16),
                  Text(
                    'Revenue Charts Coming Soon',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[300] : Colors.grey[700],
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

  Widget _buildRevenueCard(String label, String value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withValues(alpha: 0.15), color.withValues(alpha: 0.05)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 12),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95));
  }

  // ============================================================
  // SETTINGS TAB
  // ============================================================
  Widget _buildSettingsTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ad Platform Settings',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 16),
          _buildSettingItem(
            'Minimum CPC',
            '₹0.50 per click',
            Icons.price_check_rounded,
            isDark,
          ),
          _buildSettingItem(
            'Minimum Daily Budget',
            '₹50.00',
            Icons.account_balance_wallet_rounded,
            isDark,
          ),
          _buildSettingItem(
            'Auto-Approve Campaigns',
            'Disabled - Manual review required',
            Icons.verified_rounded,
            isDark,
          ),
          _buildSettingItem(
            'Revenue Share',
            '100% to platform',
            Icons.pie_chart_rounded,
            isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem(String title, String value, IconData icon, bool isDark) {
    return Container(
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
              color: const Color(0xFF6366F1).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: const Color(0xFF6366F1), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded,
              color: isDark ? Colors.grey[600] : Colors.grey[400]),
        ],
      ),
    );
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  Future<void> _approveCampaign(AdCampaignModel campaign) async {
    try {
      final adminId = FirebaseAuth.instance.currentUser?.uid ?? 'unknown';
      await _adService.approveCampaign(campaign.id, adminId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                Text('✅ Campaign "${campaign.name}" approved!'),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showRejectDialog(AdCampaignModel campaign) {
    final reasonController = TextEditingController();
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.block, color: Colors.red, size: 22),
            ),
            const SizedBox(width: 12),
            Text(
              'Reject Campaign',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Rejecting: ${campaign.name}',
              style: TextStyle(
                color: isDark ? Colors.grey[300] : Colors.grey[700],
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Enter rejection reason...',
                filled: true,
                fillColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _rejectCampaign(campaign, reasonController.text);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  Future<void> _rejectCampaign(AdCampaignModel campaign, String reason) async {
    try {
      final adminId = FirebaseAuth.instance.currentUser?.uid ?? 'unknown';
      await _adService.rejectCampaign(
        campaign.id, 
        adminId,
        reason.isNotEmpty ? reason : 'Campaign does not meet guidelines',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Campaign "${campaign.name}" rejected'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }
}
