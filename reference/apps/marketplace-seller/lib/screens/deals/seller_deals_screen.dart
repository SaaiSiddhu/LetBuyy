// Seller Deals Screen - Manage promotional deals
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'create_deal_screen.dart';

class SellerDealsScreen extends StatefulWidget {
  final String sellerId;
  
  const SellerDealsScreen({super.key, required this.sellerId});

  @override
  State<SellerDealsScreen> createState() => _SellerDealsScreenState();
}

class _SellerDealsScreenState extends State<SellerDealsScreen> 
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final DealService _dealService = DealService();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_rounded, 
            color: isDark ? Colors.white : AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          '🔥 Flash Deals',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.error, // Red theme for deals
          unselectedLabelColor: isDark ? Colors.white54 : Colors.grey,
          indicatorColor: AppColors.error,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Active'),
            Tab(text: 'Pending'),
            Tab(text: 'Approved'),
            Tab(text: 'All'),
          ],
        ),
      ),
      body: StreamBuilder<List<DealModel>>(
        stream: _dealService.getSellerDeals(widget.sellerId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final allDeals = snapshot.data ?? [];

          return TabBarView(
            controller: _tabController,
            children: [
              _buildDealsList(allDeals.where((d) => d.status == DealStatus.active).toList(), isDark),
              _buildDealsList(allDeals.where((d) => d.status == DealStatus.pending).toList(), isDark),
              _buildDealsList(allDeals.where((d) => d.status == DealStatus.approved).toList(), isDark),
              _buildDealsList(allDeals, isDark),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _navigateToCreateDeal(context),
        backgroundColor: AppColors.error, // Red theme
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Create Deal', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildDealsList(List<DealModel> deals, bool isDark) {
    if (deals.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_offer_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No deals found',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white54 : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a deal to boost your sales!',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white38 : Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: deals.length,
      itemBuilder: (context, index) => _buildDealCard(deals[index], isDark),
    );
  }

  Widget _buildDealCard(DealModel deal, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _getStatusColor(deal.status).withValues(alpha: 0.3),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header with product info
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Product Image
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(9),
                    child: CachedNetworkImage(
                      imageUrl: deal.productImage,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: Colors.grey[200]),
                      errorWidget: (_, __, ___) => const Icon(Icons.image, color: Colors.grey),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                
                // Deal Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              deal.title,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          _buildStatusBadge(deal.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        deal.productName,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.white54 : Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Divider
          Divider(height: 1, color: isDark ? Colors.white10 : Colors.grey.shade200),
          
          // Stats Row
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Discount
                _buildStatItem(
                  icon: Icons.local_offer_rounded,
                  label: 'Discount',
                  value: deal.discountLabel,
                  color: AppColors.error,
                  isDark: isDark,
                ),
                _buildDivider(isDark),
                
                // Deal Price
                _buildStatItem(
                  icon: Icons.sell_rounded,
                  label: 'Deal Price',
                  value: '₹${deal.dealPrice.toStringAsFixed(0)}',
                  color: AppColors.success,
                  isDark: isDark,
                ),
                _buildDivider(isDark),
                
                // Time Remaining / Status
                if (deal.isActive)
                  _buildStatItem(
                    icon: Icons.timer_rounded,
                    label: 'Ends In',
                    value: _formatDuration(deal.timeRemaining),
                    color: Colors.orange,
                    isDark: isDark,
                  )
                else
                  _buildStatItem(
                    icon: Icons.calendar_today_rounded,
                    label: 'Duration',
                    value: '${deal.endDate.difference(deal.startDate).inDays}d',
                    color: Colors.blue,
                    isDark: isDark,
                  ),
              ],
            ),
          ),
          
          // Actions (if pending or active)
          if (deal.status == DealStatus.active || deal.status == DealStatus.pending)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.shade50,
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  if (deal.status == DealStatus.pending)
                    Expanded(
                      child: Text(
                        '⏳ Waiting for admin approval',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.white54 : Colors.grey[600],
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  if (deal.status == DealStatus.active)
                    Expanded(
                      child: Row(
                        children: [
                          Icon(Icons.visibility_rounded, size: 14, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            'Live on marketplace',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.success,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  TextButton.icon(
                    onPressed: () => _cancelDeal(deal),
                    icon: const Icon(Icons.cancel_outlined, size: 16),
                    label: const Text('Cancel'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
            
          // Rejection reason (if rejected)
          if (deal.status == DealStatus.rejected && deal.rejectionReason != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 16, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Rejected: ${deal.rejectionReason}',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(DealStatus status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getStatusColor(status).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        _getStatusLabel(status),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: _getStatusColor(status),
        ),
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required bool isDark,
  }) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.white38 : Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Container(
      width: 1,
      height: 40,
      color: isDark ? Colors.white10 : Colors.grey.shade200,
    );
  }

  Color _getStatusColor(DealStatus status) {
    switch (status) {
      case DealStatus.active:
        return AppColors.success;
      case DealStatus.pending:
        return Colors.orange;
      case DealStatus.approved:
        return Colors.blue;
      case DealStatus.rejected:
        return AppColors.error;
      case DealStatus.expired:
        return Colors.grey;
      case DealStatus.cancelled:
        return Colors.grey;
      case DealStatus.soldOut:
        return Colors.purple;
    }
  }

  String _getStatusLabel(DealStatus status) {
    switch (status) {
      case DealStatus.active:
        return 'LIVE';
      case DealStatus.pending:
        return 'PENDING';
      case DealStatus.approved:
        return 'APPROVED';
      case DealStatus.rejected:
        return 'REJECTED';
      case DealStatus.expired:
        return 'EXPIRED';
      case DealStatus.cancelled:
        return 'CANCELLED';
      case DealStatus.soldOut:
        return 'SOLD OUT';
    }
  }

  String _formatDuration(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inMinutes}m';
    }
  }

  void _navigateToCreateDeal(BuildContext context) {
    HapticFeedback.lightImpact();
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CreateDealScreen(sellerId: widget.sellerId),
      ),
    );
  }

  Future<void> _cancelDeal(DealModel deal) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Deal?'),
        content: const Text('This will remove the deal from the marketplace. This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Cancel Deal'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _dealService.cancelDeal(deal.id, widget.sellerId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Deal cancelled successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }
}
