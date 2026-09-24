// apps/marketplace/lib/screens/returns/my_returns_screen.dart
// 📋 MY RETURNS SCREEN
// Customer views all their return/exchange requests

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import '../../providers/auth_provider.dart';
import 'return_tracking_screen.dart';

class MyReturnsScreen extends StatefulWidget {
  const MyReturnsScreen({super.key});

  @override
  State<MyReturnsScreen> createState() => _MyReturnsScreenState();
}

class _MyReturnsScreenState extends State<MyReturnsScreen>
    with SingleTickerProviderStateMixin {
  final ReturnService _returnService = ReturnService();
  late TabController _tabController;

  final List<String> _tabs = ['All', 'Active', 'Completed'];

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
    final authProvider = context.watch<AuthProvider>();
    final userId = authProvider.currentUser?.uid;

    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'My Returns',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: _buildTabBar(isDark),
        ),
      ),
      body: userId == null
          ? _buildNotLoggedIn(isDark)
          : StreamBuilder<List<ReturnRequestModel>>(
              stream: _returnService.getCustomerReturns(userId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError) {
                  return _buildErrorState(isDark, snapshot.error.toString());
                }

                final allReturns = snapshot.data ?? [];

                return TabBarView(
                  controller: _tabController,
                  children: [
                    _buildReturnsList(allReturns, isDark),
                    _buildReturnsList(
                      allReturns.where((r) => !r.isResolved).toList(),
                      isDark,
                    ),
                    _buildReturnsList(
                      allReturns.where((r) => r.isResolved).toList(),
                      isDark,
                    ),
                  ],
                );
              },
            ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
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
        tabs: _tabs.map((t) => Tab(text: t)).toList(),
      ),
    );
  }

  Widget _buildReturnsList(List<ReturnRequestModel> returns, bool isDark) {
    if (returns.isEmpty) {
      return _buildEmptyState(isDark);
    }

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: returns.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: _ReturnCard(
            request: returns[index],
            isDark: isDark,
            onTap: () => _navigateToDetails(returns[index]),
          ),
        ).animate(delay: (index * 50).ms).fadeIn().slideY(begin: 0.1);
      },
    );
  }

  void _navigateToDetails(ReturnRequestModel request) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReturnTrackingScreen(returnId: request.id),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
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
              size: 64,
              color: isDark ? Colors.white38 : Colors.grey[400],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'No returns found',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You haven\'t made any return requests yet',
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotLoggedIn(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.lock_outline, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          const Text('Please login to view your returns'),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.errorLight),
          const SizedBox(height: 16),
          Text('Error: $error'),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RETURN CARD WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class _ReturnCard extends StatelessWidget {
  final ReturnRequestModel request;
  final bool isDark;
  final VoidCallback onTap;

  const _ReturnCard({
    required this.request,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final statusConfig = _getStatusConfig(request.status);
    final dateFormat = DateFormat('dd MMM yyyy');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? Colors.white10 : Colors.grey.shade200,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
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
                // Type Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: request.type == ReturnType.refund
                        ? AppColors.info.withValues(alpha: 0.1)
                        : AppColors.accent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        request.type == ReturnType.refund
                            ? Icons.currency_rupee
                            : Icons.swap_horiz,
                        size: 12,
                        color: request.type == ReturnType.refund
                            ? AppColors.info
                            : AppColors.accent,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        request.type.displayName,
                        style: TextStyle(
                          color: request.type == ReturnType.refund
                              ? AppColors.info
                              : AppColors.accent,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                // Status Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusConfig['color'].withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: statusConfig['color'].withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        statusConfig['icon'],
                        size: 12,
                        color: statusConfig['color'],
                      ),
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
              ],
            ),
            const SizedBox(height: 16),

            // Product Row
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    request.productImage ?? '',
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 56,
                      height: 56,
                      color: Colors.grey[300],
                      child: const Icon(Icons.image, size: 24),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        request.productName,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.reasonTitle,
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.grey[600],
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Order #${request.orderNumber}',
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.grey,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Footer
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today,
                        size: 14,
                        color: isDark ? Colors.white38 : Colors.grey,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        dateFormat.format(request.createdAt),
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.grey[600],
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  if (request.type == ReturnType.refund)
                    Text(
                      '₹${NumberFormat('#,##,###').format(request.refundAmount)}',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 14,
                    color: isDark ? Colors.white38 : Colors.grey,
                  ),
                ],
              ),
            ),

            // ✅ APPEAL BUTTON FOR REJECTED RETURNS
            if (request.status == ReturnStatus.rejected && request.canAppeal) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => _showAppealDialog(context, request),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.warning.withValues(alpha: 0.15),
                        AppColors.error.withValues(alpha: 0.1),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.support_agent, color: AppColors.warning, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Appeal this decision',
                              style: TextStyle(
                                color: AppColors.warningDark,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              '${request.hoursRemainingToAppeal}h left to appeal',
                              style: TextStyle(
                                color: AppColors.warning,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.warning,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Contact Support',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            // Show "Already Appealed" indicator
            if (request.status == ReturnStatus.rejected && request.hasAppealed) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.info, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Appeal submitted - Support team will review',
                        style: TextStyle(
                          color: AppColors.infoDark,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Show "Appeal Expired" indicator
            if (request.status == ReturnStatus.rejected && 
                !request.hasAppealed && 
                request.isAppealExpired) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(Icons.timer_off, color: Colors.grey[500], size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'Appeal window expired (24 hours)',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showAppealDialog(BuildContext context, ReturnRequestModel request) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AppealBottomSheet(request: request),
    );
  }

  Map<String, dynamic> _getStatusConfig(ReturnStatus status) {
    switch (status) {
      case ReturnStatus.requested:
        return {'color': AppColors.info, 'icon': Icons.hourglass_top};
      case ReturnStatus.approved:
        return {'color': AppColors.success, 'icon': Icons.check_circle};
      case ReturnStatus.rejected:
        return {'color': AppColors.error, 'icon': Icons.cancel};
      case ReturnStatus.pickupScheduled:
        return {'color': AppColors.warning, 'icon': Icons.schedule};
      case ReturnStatus.pickupInProgress:
        return {'color': AppColors.warning, 'icon': Icons.local_shipping};
      case ReturnStatus.pickupCompleted:
        return {'color': AppColors.primary, 'icon': Icons.inventory};
      case ReturnStatus.qcFailed:
        return {'color': AppColors.error, 'icon': Icons.error};
      case ReturnStatus.refundInitiated:
        return {'color': AppColors.accent, 'icon': Icons.payment};
      case ReturnStatus.refundCompleted:
        return {'color': AppColors.success, 'icon': Icons.check_circle};
      case ReturnStatus.exchangeShipped:
        return {'color': AppColors.info, 'icon': Icons.local_shipping};
      case ReturnStatus.exchangeDelivered:
        return {'color': AppColors.success, 'icon': Icons.check_circle};
      case ReturnStatus.closed:
        return {'color': Colors.grey, 'icon': Icons.done_all};
      case ReturnStatus.cancelled:
        return {'color': Colors.grey, 'icon': Icons.block};
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEAL BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════════════════

class _AppealBottomSheet extends StatelessWidget {
  final ReturnRequestModel request;

  const _AppealBottomSheet({required this.request});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[400],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 24),

          // Appeal Icon
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.support_agent,
              size: 40,
              color: AppColors.warning,
            ),
          ),
          const SizedBox(height: 16),

          Text(
            'Appeal Rejection',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),

          Text(
            'Your return request was rejected by the seller.\nYou can appeal this decision through our support team.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),

          // Rejection Reason
          if (request.sellerRejectionReason != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Seller\'s Rejection Reason:',
                    style: TextStyle(
                      color: AppColors.error,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    request.sellerRejectionReason!,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : Colors.grey[800],
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          
          const SizedBox(height: 16),

          // Time remaining
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.timer, color: Colors.amber[700], size: 18),
                const SizedBox(width: 8),
                Text(
                  '${request.hoursRemainingToAppeal} hours left to appeal',
                  style: TextStyle(
                    color: Colors.amber[800],
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: BorderSide(
                      color: isDark ? Colors.white24 : Colors.grey[300]!,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'Cancel',
                    style: TextStyle(
                      color: isDark ? Colors.white70 : Colors.grey[700],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: () => _openSupportChat(context),
                  icon: const Icon(Icons.chat, size: 18),
                  label: const Text('Contact Support'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.warning,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Safe area padding
          SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
        ],
      ),
    );
  }

  void _openSupportChat(BuildContext context) {
    // Close bottom sheet first
    Navigator.pop(context);
    
    // Navigate to support chat with prefilled appeal context
    // The support chat route should handle the return appeal scenario
    Navigator.pushNamed(
      context,
      '/support-chat',
      arguments: {
        'type': 'return_appeal',
        'returnId': request.id,
        'orderId': request.orderId,
        'orderNumber': request.orderNumber,
        'productName': request.productName,
        'rejectionReason': request.sellerRejectionReason,
        'prefillMessage': 
            'Hi, I would like to appeal the rejection of my return request.\n\n'
            'Order: #${request.orderNumber}\n'
            'Product: ${request.productName}\n'
            'Return ID: ${request.id}\n\n'
            'Seller\'s reason: ${request.sellerRejectionReason ?? "Not specified"}\n\n'
            'I believe this should be reconsidered because:',
      },
    );
  }
}
