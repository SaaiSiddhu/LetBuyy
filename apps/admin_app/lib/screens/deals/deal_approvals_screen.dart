// Admin Deal Approvals Screen - Review and approve/reject seller deals
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:intl/intl.dart';

class DealApprovalsScreen extends StatefulWidget {
  const DealApprovalsScreen({super.key});

  @override
  State<DealApprovalsScreen> createState() => _DealApprovalsScreenState();
}

class _DealApprovalsScreenState extends State<DealApprovalsScreen> {
  final DealService _dealService = DealService();
  final _rejectionReasonController = TextEditingController();

  @override
  void dispose() {
    _rejectionReasonController.dispose();
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
          '🔥 Deal Approvals',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: StreamBuilder<List<DealModel>>(
        stream: _dealService.getPendingDeals(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final pendingDeals = snapshot.data ?? [];

          if (pendingDeals.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline_rounded, size: 80, color: AppColors.success),
                  const SizedBox(height: 16),
                  Text(
                    'All caught up!',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No pending deal approvals',
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.white54 : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: pendingDeals.length,
            itemBuilder: (context, index) => _buildDealCard(pendingDeals[index], isDark),
          );
        },
      ),
    );
  }

  Widget _buildDealCard(DealModel deal, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.orange.withValues(alpha: 0.5),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.08),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Pending Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'PENDING APPROVAL',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  'Submitted ${_formatDate(deal.createdAt)}',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white54 : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          
          // Product Info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Image
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(11),
                    child: CachedNetworkImage(
                      imageUrl: deal.productImage,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: Colors.grey[200]),
                      errorWidget: (_, __, ___) => const Icon(Icons.image, color: Colors.grey),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                
                // Deal Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        deal.title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        deal.productName,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.white70 : Colors.grey[600],
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.store_rounded, size: 14, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            deal.sellerName,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.white54 : Colors.grey[500],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Divider
          Divider(height: 1, color: isDark ? Colors.white10 : Colors.grey.shade200),
          
          // Deal Details Grid
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _buildDetailItem(
                  icon: Icons.local_offer_rounded,
                  label: 'Discount',
                  value: deal.discountLabel,
                  color: AppColors.error,
                  isDark: isDark,
                ),
                _buildDivider(isDark),
                _buildDetailItem(
                  icon: Icons.sell_rounded,
                  label: 'Deal Price',
                  value: '₹${deal.dealPrice.toStringAsFixed(0)}',
                  color: AppColors.success,
                  isDark: isDark,
                ),
                _buildDivider(isDark),
                _buildDetailItem(
                  icon: Icons.schedule_rounded,
                  label: 'Duration',
                  value: '${deal.endDate.difference(deal.startDate).inDays} days',
                  color: Colors.blue,
                  isDark: isDark,
                ),
              ],
            ),
          ),
          
          // Date Range
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 16, color: Colors.grey[500]),
                  const SizedBox(width: 8),
                  Text(
                    '${DateFormat('MMM dd, HH:mm').format(deal.startDate)} → ${DateFormat('MMM dd, HH:mm').format(deal.endDate)}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white70 : Colors.grey[700],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          
          // Action Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _showRejectDialog(deal),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: BorderSide(color: AppColors.error),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: () => _approveDeal(deal),
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Approve'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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

  Widget _buildDetailItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required bool isDark,
  }) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
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
      height: 50,
      color: isDark ? Colors.white10 : Colors.grey.shade200,
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return DateFormat('MMM dd').format(date);
    }
  }

  Future<void> _approveDeal(DealModel deal) async {
    HapticFeedback.mediumImpact();
    try {
      final adminId = FirebaseAuth.instance.currentUser?.uid ?? 'admin';
      await _dealService.approveDeal(deal.id, adminId);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Deal approved: ${deal.title}'),
            backgroundColor: AppColors.success,
          ),
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

  void _showRejectDialog(DealModel deal) {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    _rejectionReasonController.clear();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Reject Deal',
          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Provide a reason for rejection:',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white70 : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _rejectionReasonController,
              maxLines: 3,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
              decoration: InputDecoration(
                hintText: 'e.g., Discount too high, Invalid product...',
                hintStyle: TextStyle(color: Colors.grey[500]),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                filled: true,
                fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () => _rejectDeal(deal),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  Future<void> _rejectDeal(DealModel deal) async {
    final reason = _rejectionReasonController.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a rejection reason')),
      );
      return;
    }

    Navigator.pop(context); // Close dialog
    HapticFeedback.mediumImpact();

    try {
      final adminId = FirebaseAuth.instance.currentUser?.uid ?? 'admin';
      await _dealService.rejectDeal(deal.id, adminId, reason);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Deal rejected: ${deal.title}'),
            backgroundColor: AppColors.error,
          ),
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
