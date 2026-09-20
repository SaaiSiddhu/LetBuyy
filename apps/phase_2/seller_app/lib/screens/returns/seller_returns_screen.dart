// apps/seller/lib/screens/returns/seller_returns_screen.dart
// 📦 SELLER RETURNS DASHBOARD
// Manage return requests with tabs and actions

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../providers/seller_provider.dart';
import 'return_detail_screen.dart';

class SellerReturnsScreen extends StatefulWidget {
  const SellerReturnsScreen({super.key});

  @override
  State<SellerReturnsScreen> createState() => _SellerReturnsScreenState();
}

class _SellerReturnsScreenState extends State<SellerReturnsScreen>
    with SingleTickerProviderStateMixin {
  final ReturnService _returnService = ReturnService();
  late TabController _tabController;

  final List<Map<String, dynamic>> _tabs = [
    {'label': 'Pending', 'status': ReturnStatus.requested},
    {'label': 'Approved', 'status': null}, // Multiple statuses
    {'label': 'Completed', 'status': null},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sellerProvider = context.watch<SellerProvider>();
    final sellerId = sellerProvider.currentSeller?.sellerId;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
      body: sellerId == null
          ? const Center(child: Text('Please login as seller'))
          : CustomScrollView(
              slivers: [
                // Header
                _buildHeader(isDark),
                
                // Stats
                SliverToBoxAdapter(
                  child: _buildStatsRow(sellerId, isDark),
                ),
                
                // Tab Bar
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _TabBarDelegate(
                    tabBar: _buildTabBar(isDark),
                    backgroundColor: isDark
                        ? const Color(0xFF0A0E14)
                        : const Color(0xFFF5F7FA),
                  ),
                ),
                
                // Returns List
                SliverFillRemaining(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildReturnsTab(sellerId, ReturnStatus.requested, isDark),
                      _buildApprovedTab(sellerId, isDark),
                      _buildCompletedTab(sellerId, isDark),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      backgroundColor: isDark ? const Color(0xFF0A0E14) : Colors.white,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
        title: Text(
          'Returns & Exchanges',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        background: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [const Color(0xFF1E293B), const Color(0xFF0A0E14)]
                  : [AppColors.primary.withValues(alpha: 0.1), Colors.white],
            ),
          ),
        ),
      ),
      actions: [
        IconButton(
          icon: Icon(
            Icons.refresh,
            color: isDark ? Colors.white : Colors.black,
          ),
          onPressed: () => setState(() {}),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildStatsRow(String sellerId, bool isDark) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _returnService.getSellerReturnStats(sellerId),
      builder: (context, snapshot) {
        final stats = snapshot.data ?? {};
        
        return Container(
          margin: const EdgeInsets.all(16),
          child: Row(
            children: [
              _buildStatCard(
                'Pending',
                '${stats['pending'] ?? 0}',
                Colors.orange,
                isDark,
              ),
              const SizedBox(width: 12),
              _buildStatCard(
                'In Progress',
                '${stats['approved'] ?? 0}',
                Colors.blue,
                isDark,
              ),
              const SizedBox(width: 12),
              _buildStatCard(
                'Refunded',
                '${stats['refunded'] ?? 0}',
                Colors.green,
                isDark,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatCard(String label, String value, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDark ? 0.15 : 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(10),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: Colors.white,
        unselectedLabelColor: isDark ? Colors.white54 : Colors.grey,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        dividerColor: Colors.transparent,
        tabs: _tabs.map((t) => Tab(text: t['label'])).toList(),
      ),
    );
  }

  Widget _buildReturnsTab(String sellerId, ReturnStatus status, bool isDark) {
    return StreamBuilder<List<ReturnRequestModel>>(
      stream: _returnService.getSellerReturns(
        sellerId: sellerId,
        statusFilter: status,
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final returns = snapshot.data ?? [];
        
        if (returns.isEmpty) {
          return _buildEmptyState(isDark, 'No pending returns');
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: returns.length,
          itemBuilder: (context, index) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ReturnRequestCard(
                request: returns[index],
                isDark: isDark,
                onTap: () => _navigateToDetail(returns[index]),
                onApprove: () => _approveReturn(returns[index]),
                onReject: () => _showRejectDialog(returns[index]),
              ),
            ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.05);
          },
        );
      },
    );
  }

  Widget _buildApprovedTab(String sellerId, bool isDark) {
    return StreamBuilder<List<ReturnRequestModel>>(
      stream: _returnService.getSellerReturns(sellerId: sellerId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final returns = (snapshot.data ?? []).where((r) =>
            [
              ReturnStatus.approved,
              ReturnStatus.pickupScheduled,
              ReturnStatus.pickupInProgress,
              ReturnStatus.pickupCompleted,
              ReturnStatus.refundInitiated,
            ].contains(r.status)).toList();

        if (returns.isEmpty) {
          return _buildEmptyState(isDark, 'No returns in progress');
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: returns.length,
          itemBuilder: (context, index) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ReturnRequestCard(
                request: returns[index],
                isDark: isDark,
                onTap: () => _navigateToDetail(returns[index]),
                showActions: false,
              ),
            ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.05);
          },
        );
      },
    );
  }

  Widget _buildCompletedTab(String sellerId, bool isDark) {
    return StreamBuilder<List<ReturnRequestModel>>(
      stream: _returnService.getSellerReturns(sellerId: sellerId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final returns = (snapshot.data ?? []).where((r) => r.isResolved).toList();

        if (returns.isEmpty) {
          return _buildEmptyState(isDark, 'No completed returns');
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: returns.length,
          itemBuilder: (context, index) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ReturnRequestCard(
                request: returns[index],
                isDark: isDark,
                onTap: () => _navigateToDetail(returns[index]),
                showActions: false,
              ),
            ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.05);
          },
        );
      },
    );
  }

  Widget _buildEmptyState(bool isDark, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.assignment_return_outlined,
              size: 48,
              color: isDark ? Colors.white38 : Colors.grey[400],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.grey[600],
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  void _navigateToDetail(ReturnRequestModel request) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReturnDetailScreen(returnId: request.id),
      ),
    );
  }

  Future<void> _approveReturn(ReturnRequestModel request) async {
    try {
      await _returnService.approveReturn(returnId: request.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Return request approved'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to approve: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showRejectDialog(ReturnRequestModel request) {
    final reasonController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reject Return Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Please provide a reason for rejection:'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Enter reason...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (reasonController.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please enter a reason')),
                );
                return;
              }
              Navigator.pop(context);
              await _rejectReturn(request, reasonController.text.trim());
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _rejectReturn(ReturnRequestModel request, String reason) async {
    try {
      await _returnService.rejectReturn(
        returnId: request.id,
        rejectionReason: reason,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Return request rejected'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reject: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB BAR DELEGATE
// ═══════════════════════════════════════════════════════════════════════════

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final Widget tabBar;
  final Color backgroundColor;

  _TabBarDelegate({required this.tabBar, required this.backgroundColor});

  @override
  Widget build(context, shrinkOffset, overlapsContent) {
    return Container(
      color: backgroundColor,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: tabBar,
    );
  }

  @override
  double get maxExtent => 56;

  @override
  double get minExtent => 56;

  @override
  bool shouldRebuild(covariant _TabBarDelegate oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════════════════════
// RETURN REQUEST CARD
// ═══════════════════════════════════════════════════════════════════════════

class _ReturnRequestCard extends StatelessWidget {
  final ReturnRequestModel request;
  final bool isDark;
  final VoidCallback onTap;
  final VoidCallback? onApprove;
  final VoidCallback? onReject;
  final bool showActions;

  const _ReturnRequestCard({
    required this.request,
    required this.isDark,
    required this.onTap,
    this.onApprove,
    this.onReject,
    this.showActions = true,
  });

  @override
  Widget build(BuildContext context) {
    final statusConfig = _getStatusConfig(request.status);
    final dateFormat = DateFormat('dd MMM, hh:mm a');
    final priorityInfo = _getPriorityInfo(request);
    final timeAgo = _getTimeAgo(request.createdAt);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: priorityInfo['level'] == 'urgent'
                ? Colors.red.withValues(alpha: 0.5)
                : (isDark ? Colors.white10 : Colors.grey.shade200),
            width: priorityInfo['level'] == 'urgent' ? 2 : 1,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Priority Banner (if urgent/high)
            if (priorityInfo['level'] == 'urgent' || priorityInfo['level'] == 'high')
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: priorityInfo['color'].withValues(alpha: 0.1),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(15),
                    topRight: Radius.circular(15),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(priorityInfo['icon'], size: 14, color: priorityInfo['color']),
                    const SizedBox(width: 6),
                    Text(
                      priorityInfo['label'],
                      style: TextStyle(
                        color: priorityInfo['color'],
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      timeAgo,
                      style: TextStyle(
                        color: priorityInfo['color'],
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Row
                  Row(
                    children: [
                      // Type Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: request.type == ReturnType.refund
                                ? [Colors.blue.withValues(alpha: 0.2), Colors.blue.withValues(alpha: 0.1)]
                                : [Colors.purple.withValues(alpha: 0.2), Colors.purple.withValues(alpha: 0.1)],
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              request.type == ReturnType.refund
                                  ? Icons.currency_rupee_rounded
                                  : Icons.swap_horiz_rounded,
                              size: 12,
                              color: request.type == ReturnType.refund ? Colors.blue : Colors.purple,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              request.type.displayName,
                              style: TextStyle(
                                color: request.type == ReturnType.refund ? Colors.blue : Colors.purple,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Status Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: statusConfig['color'].withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(statusConfig['icon'], size: 12, color: statusConfig['color']),
                            const SizedBox(width: 4),
                            Text(
                              request.status.displayName,
                              style: TextStyle(
                                color: statusConfig['color'],
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // Order Number
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? Colors.white10 : Colors.grey[100],
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '#${request.orderNumber}',
                          style: TextStyle(
                            color: isDark ? Colors.white54 : Colors.grey[700],
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Product Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Image
                      Stack(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isDark ? Colors.white10 : Colors.grey.shade200,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(9),
                              child: Image.network(
                                request.productImage ?? '',
                                width: 60,
                                height: 60,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 60,
                                  height: 60,
                                  color: Colors.grey[300],
                                  child: const Icon(Icons.image, size: 24),
                                ),
                              ),
                            ),
                          ),
                          // Quantity badge
                          Positioned(
                            right: -4,
                            bottom: -4,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isDark ? Colors.black : Colors.white,
                                  width: 2,
                                ),
                              ),
                              child: Text(
                                '×${request.quantity}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              request.productName,
                              style: TextStyle(
                                color: isDark ? Colors.white : Colors.black,
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 6),
                            // Reason Tag
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.orange.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.report_problem_rounded, size: 12, color: Colors.orange[700]),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      request.reasonTitle,
                                      style: TextStyle(
                                        color: Colors.orange[700],
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            // Customer Info
                            Row(
                              children: [
                                Icon(Icons.person_outline, size: 14, color: isDark ? Colors.white38 : Colors.grey),
                                const SizedBox(width: 4),
                                Text(
                                  request.userName,
                                  style: TextStyle(
                                    color: isDark ? Colors.white54 : Colors.grey[600],
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Refund Amount
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${NumberFormat('#,##,###').format(request.refundAmount)}',
                            style: TextStyle(
                              color: Colors.green[700],
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          Text(
                            'Refund',
                            style: TextStyle(
                              color: isDark ? Colors.white38 : Colors.grey,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Customer Notes (if present)
                  if (request.customerNotes != null && request.customerNotes!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isDark ? Colors.white10 : Colors.grey.shade200,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.message_rounded, size: 14, color: isDark ? Colors.white38 : Colors.grey),
                              const SizedBox(width: 6),
                              Text(
                                'Customer Notes',
                                style: TextStyle(
                                  color: isDark ? Colors.white38 : Colors.grey,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            request.customerNotes!,
                            style: TextStyle(
                              color: isDark ? Colors.white70 : Colors.grey[800],
                              fontSize: 13,
                              fontStyle: FontStyle.italic,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Customer Images Preview
                  if (request.customerImages.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(Icons.photo_library_rounded, size: 14, color: isDark ? Colors.white38 : Colors.grey),
                        const SizedBox(width: 6),
                        Text(
                          'Evidence Photos',
                          style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.grey,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${request.customerImages.length} photo${request.customerImages.length > 1 ? 's' : ''}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 50,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: request.customerImages.length > 4 ? 4 : request.customerImages.length,
                        itemBuilder: (context, index) {
                          if (index == 3 && request.customerImages.length > 4) {
                            return Container(
                              width: 50,
                              height: 50,
                              margin: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(
                                color: isDark ? Colors.white10 : Colors.grey[200],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: Text(
                                  '+${request.customerImages.length - 3}',
                                  style: TextStyle(
                                    color: isDark ? Colors.white54 : Colors.grey[700],
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            );
                          }
                          return Container(
                            width: 50,
                            height: 50,
                            margin: const EdgeInsets.only(right: 6),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isDark ? Colors.white10 : Colors.grey.shade200,
                              ),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                request.customerImages[index],
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Icon(
                                  Icons.broken_image,
                                  color: isDark ? Colors.white24 : Colors.grey,
                                  size: 20,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  // Actions
                  if (showActions && request.status == ReturnStatus.requested) ...[
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: onReject,
                            icon: const Icon(Icons.close_rounded, size: 16),
                            label: const Text('Reject'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            onPressed: onApprove,
                            icon: const Icon(Icons.check_rounded, size: 16),
                            label: const Text('Approve Return'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, dynamic> _getPriorityInfo(ReturnRequestModel request) {
    final hoursSinceCreation = DateTime.now().difference(request.createdAt).inHours;
    
    if (request.status == ReturnStatus.closed || 
        request.status == ReturnStatus.refundCompleted ||
        request.status == ReturnStatus.exchangeDelivered) {
      return {'level': 'resolved', 'color': Colors.grey, 'icon': Icons.check_circle, 'label': 'Resolved'};
    }
    
    if (hoursSinceCreation > 48 && request.status == ReturnStatus.requested) {
      return {'level': 'urgent', 'color': Colors.red, 'icon': Icons.warning_rounded, 'label': 'URGENT - Pending 48+ hrs'};
    }
    
    if (hoursSinceCreation > 24 && request.status == ReturnStatus.requested) {
      return {'level': 'high', 'color': Colors.orange, 'icon': Icons.schedule, 'label': 'Action needed within 24 hrs'};
    }
    
    return {'level': 'normal', 'color': Colors.grey, 'icon': Icons.info, 'label': 'Normal'};
  }

  String _getTimeAgo(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('dd MMM').format(dateTime);
  }

  Map<String, dynamic> _getStatusConfig(ReturnStatus status) {
    switch (status) {
      case ReturnStatus.requested:
        return {'color': Colors.orange, 'icon': Icons.hourglass_top};
      case ReturnStatus.approved:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.rejected:
        return {'color': Colors.red, 'icon': Icons.cancel};
      case ReturnStatus.pickupScheduled:
        return {'color': Colors.blue, 'icon': Icons.schedule};
      case ReturnStatus.pickupInProgress:
        return {'color': Colors.blue, 'icon': Icons.local_shipping};
      case ReturnStatus.pickupCompleted:
        return {'color': Colors.teal, 'icon': Icons.inventory};
      case ReturnStatus.qcFailed:
        return {'color': Colors.red, 'icon': Icons.error};
      case ReturnStatus.refundInitiated:
        return {'color': Colors.purple, 'icon': Icons.payment};
      case ReturnStatus.refundCompleted:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.exchangeShipped:
        return {'color': Colors.blue, 'icon': Icons.local_shipping};
      case ReturnStatus.exchangeDelivered:
        return {'color': Colors.green, 'icon': Icons.check_circle};
      case ReturnStatus.closed:
        return {'color': Colors.grey, 'icon': Icons.done_all};
      case ReturnStatus.cancelled:
        return {'color': Colors.grey, 'icon': Icons.block};
    }
  }
}
