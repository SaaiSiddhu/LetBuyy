// lib/screens/admin/products/product_approval_screen.dart
// Admin screen to approve or reject pending products

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart'; // ✅ For ThemeProvider

class ProductApprovalScreen extends StatefulWidget {
  const ProductApprovalScreen({super.key});

  @override
  State<ProductApprovalScreen> createState() => _ProductApprovalScreenState();
}

class _ProductApprovalScreenState extends State<ProductApprovalScreen> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  String _filterStatus = 'pending'; // pending, approved, rejected, all

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: accentColor,
        foregroundColor: isDark ? Colors.black : Colors.white,
        title: const Text('Product Approvals'),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            padding: const EdgeInsets.all(16),
            color: isDark ? AppColors.surfaceDark : Colors.white,
            child: Row(
              children: [
                _buildFilterChip('Pending', 'pending', Colors.orange, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('Approved', 'approved', Colors.green, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('Rejected', 'rejected', Colors.red, isDark),
                const SizedBox(width: 8),
                _buildFilterChip('All', 'all', Colors.grey, isDark),
              ],
            ),
          ),

          // Products List
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: _buildQuery(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Text('Error: ${snapshot.error}', style: TextStyle(color: AppColors.error)),
                  );
                }

                final docs = snapshot.data?.docs ?? [];
                if (docs.isEmpty) {
                  return _buildEmptyState(isDark);
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: docs.length,
                  itemBuilder: (context, index) {
                    final data = docs[index].data() as Map<String, dynamic>;
                    final product = ProductModel.fromMap(data, docs[index].id);
                    return _buildProductCard(product, isDark, accentColor)
                        .animate()
                        .fadeIn(duration: 300.ms)
                        .slideX(begin: 0.1, end: 0, duration: 300.ms);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Stream<QuerySnapshot> _buildQuery() {
    Query query = _firestore.collection('products');
    
    if (_filterStatus != 'all') {
      query = query.where('approvalStatus', isEqualTo: _filterStatus);
    }
    
    query = query.orderBy('submittedForApprovalAt', descending: true);
    
    return query.snapshots();
  }

  Widget _buildFilterChip(String label, String value, Color color, bool isDark) {
    final isSelected = _filterStatus == value;
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _filterStatus = value),
      selectedColor: color.withValues(alpha: 0.2),
      checkmarkColor: color,
      labelStyle: TextStyle(
        color: isSelected ? color : (isDark ? Colors.white70 : Colors.black87),
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
      backgroundColor: isDark ? AppColors.surfaceDarkVariant : Colors.grey[200],
    );
  }

  Widget _buildEmptyState(bool isDark) {
    String message;
    IconData icon;
    
    switch (_filterStatus) {
      case 'pending':
        message = 'No pending products for review';
        icon = Icons.check_circle_outline;
        break;
      case 'approved':
        message = 'No approved products';
        icon = Icons.inventory_2_outlined;
        break;
      case 'rejected':
        message = 'No rejected products';
        icon = Icons.cancel_outlined;
        break;
      default:
        message = 'No products found';
        icon = Icons.search_off;
    }
    
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 80, color: isDark ? Colors.white30 : Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              fontSize: 18,
              color: isDark ? Colors.white70 : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(ProductModel product, bool isDark, Color accentColor) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
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
          // Header with image and basic info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: product.images.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: product.primaryImage,
                          width: 80,
                          height: 80,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            width: 80,
                            height: 80,
                            color: isDark ? Colors.grey[800] : Colors.grey[200],
                          ),
                        )
                      : Container(
                          width: 80,
                          height: 80,
                          color: isDark ? Colors.grey[800] : Colors.grey[200],
                          child: const Icon(Icons.image_not_supported),
                        ),
                ),
                const SizedBox(width: 16),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${product.salePrice.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: accentColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 14, color: Colors.grey),
                          const SizedBox(width: 4),
                          Text('Stock: ${product.stock}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          const SizedBox(width: 16),
                          Icon(Icons.store_outlined, size: 14, color: Colors.grey),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Seller: ${product.sellerId.substring(0, 8)}...',
                              style: TextStyle(color: Colors.grey[600], fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Status Badge
                _buildStatusBadge(product.approvalStatus),
              ],
            ),
          ),

          // Description preview
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              product.description,
              style: TextStyle(
                color: isDark ? Colors.white70 : Colors.grey[600],
                fontSize: 13,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),

          // Rejection reason if rejected
          if (product.isRejected && product.rejectionReason != null)
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, color: Colors.red, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Rejection Reason: ${product.rejectionReason}',
                      style: const TextStyle(color: Colors.red, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),

          const Divider(height: 1),

          // Actions
          if (product.isPending)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showRejectDialog(product),
                      icon: const Icon(Icons.close, color: Colors.red),
                      label: const Text('Reject', style: TextStyle(color: Colors.red)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.red),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () => _approveProduct(product),
                      icon: const Icon(Icons.check),
                      label: const Text('Approve'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else if (product.isApproved)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                'Approved on ${_formatDate(product.approvedAt)}',
                style: TextStyle(color: Colors.green[600], fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(ProductApprovalStatus status) {
    Color color;
    String label;
    IconData icon;
    
    switch (status) {
      case ProductApprovalStatus.pending:
        color = Colors.orange;
        label = 'Pending';
        icon = Icons.hourglass_empty;
        break;
      case ProductApprovalStatus.approved:
        color = Colors.green;
        label = 'Approved';
        icon = Icons.check_circle;
        break;
      case ProductApprovalStatus.rejected:
        color = Colors.red;
        label = 'Rejected';
        icon = Icons.cancel;
        break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'N/A';
    return '${date.day}/${date.month}/${date.year}';
  }

  Future<void> _approveProduct(ProductModel product) async {
    HapticFeedback.mediumImpact();
    
    try {
      final adminId = 'admin'; // TODO: Replace with actual admin ID from AuthProvider
      
      // Update product status
      await _firestore.collection('products').doc(product.id).update({
        'approvalStatus': 'approved',
        'isActive': true,
        'approvedAt': FieldValue.serverTimestamp(),
        'approvedBy': adminId,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      // Create in-app notification for seller (bell icon)
      await _firestore
          .collection('sellers')
          .doc(product.sellerId)
          .collection('notifications')
          .add({
        'title': '✅ Product Approved!',
        'message': '"${product.name}" is now live on the marketplace.',
        'type': 'product_approved',
        'productId': product.id,
        'isRead': false,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // Trigger push notification
      await _firestore.collection('push_notifications').add({
        'sellerId': product.sellerId,
        'title': '✅ Product Approved!',
        'body': '"${product.name}" is now live on the marketplace.',
        'data': {
          'type': 'product_approved',
          'productId': product.id,
          'action': 'open_product',
        },
        'createdAt': FieldValue.serverTimestamp(),
        'sent': false,
      });

      // Log audit trail
      await _firestore.collection('audit_logs').add({
        'productId': product.id,
        'adminId': adminId,
        'action': 'APPROVED',
        'reason': 'Product approved',
        'timestamp': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        SnackbarHelper.showSuccess(context, 'Product approved successfully!');
      }
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to approve product: $e');
      }
    }
  }

  void _showRejectDialog(ProductModel product) {
    final reasonController = TextEditingController();
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    String? selectedReason;
    
    // Predefined rejection reasons
    final rejectionReasons = [
      'Invalid or missing GSTIN',
      'Wrong HSN code',
      'Product requires GST registration',
      'Compliance details missing',
      'Image policy violation',
      'Pricing violation',
      'Description incomplete',
      'Category mismatch',
      'Other',
    ];
    
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
          title: Text('Reject Product', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select a reason for rejection. The seller will be notified.',
                style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[600], fontSize: 14),
              ),
              const SizedBox(height: 16),
              
              // Dropdown for predefined reasons
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                decoration: InputDecoration(
                  labelText: 'Rejection Reason',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                items: rejectionReasons.map((reason) => DropdownMenuItem(
                  value: reason,
                  child: Text(reason, style: const TextStyle(fontSize: 14)),
                )).toList(),
                onChanged: (value) => setState(() => selectedReason = value),
              ),
              
              const SizedBox(height: 16),
              
              // Additional notes
              TextField(
                controller: reasonController,
                decoration: InputDecoration(
                  labelText: 'Additional Notes (Optional)',
                  hintText: 'Add more details...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                maxLines: 2,
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
                if (selectedReason == null) {
                  SnackbarHelper.showError(context, 'Please select a rejection reason');
                  return;
                }
                
                final fullReason = reasonController.text.trim().isNotEmpty
                    ? '$selectedReason: ${reasonController.text.trim()}'
                    : selectedReason!;
                
                Navigator.pop(context);
                await _rejectProduct(product, fullReason, selectedReason!);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
              child: const Text('Reject'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _rejectProduct(ProductModel product, String reason, String reasonType) async {
    HapticFeedback.mediumImpact();
    
    try {
      final adminId = 'admin'; // TODO: Replace with actual admin ID from AuthProvider
      
      // Update product status
      await _firestore.collection('products').doc(product.id).update({
        'approvalStatus': 'rejected',
        'isActive': false,
        'rejectionReason': reason,
        'rejectionType': reasonType,
        'rejectedAt': FieldValue.serverTimestamp(),
        'rejectedBy': adminId,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      // Create in-app notification for seller (bell icon)
      await _firestore
          .collection('sellers')
          .doc(product.sellerId)
          .collection('notifications')
          .add({
        'title': '❌ Product Rejected',
        'message': '"${product.name}" needs changes: $reason',
        'type': 'product_rejected',
        'productId': product.id,
        'isRead': false,
        'createdAt': FieldValue.serverTimestamp(),
      });

      // Trigger push notification
      await _firestore.collection('push_notifications').add({
        'sellerId': product.sellerId,
        'title': '❌ Product Rejected',
        'body': '"${product.name}" needs changes: $reason',
        'data': {
          'type': 'product_rejected',
          'productId': product.id,
          'action': 'open_product',
        },
        'createdAt': FieldValue.serverTimestamp(),
        'sent': false,
      });

      // Log audit trail
      await _firestore.collection('audit_logs').add({
        'productId': product.id,
        'adminId': adminId,
        'action': 'REJECTED',
        'reason': reason,
        'reasonType': reasonType,
        'timestamp': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        SnackbarHelper.showSuccess(context, 'Product rejected. Seller notified.');
      }
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to reject product: $e');
      }
    }
  }
}
