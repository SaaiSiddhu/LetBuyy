// apps/seller/lib/screens/orders/widgets/order_return_exchange_section.dart
// Widget to display return/exchange status in order details

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:intl/intl.dart';

class OrderReturnExchangeSection extends StatelessWidget {
  final String orderId;
  final bool hasReturnRequest;
  final bool hasExchangeRequest;
  final String? returnRequestId;
  final String? returnStatus;
  final String? returnType;

  const OrderReturnExchangeSection({
    super.key,
    required this.orderId,
    this.hasReturnRequest = false,
    this.hasExchangeRequest = false,
    this.returnRequestId,
    this.returnStatus,
    this.returnType,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isExchange = returnType == 'exchange' || hasExchangeRequest;
    
    // If no return/exchange, don't show section
    if (!hasReturnRequest && !hasExchangeRequest) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isExchange
              ? [
                  const Color(0xFFF59E0B).withValues(alpha: 0.1),
                  const Color(0xFFD97706).withValues(alpha: 0.05),
                ]
              : [
                  const Color(0xFFEF4444).withValues(alpha: 0.1),
                  const Color(0xFFDC2626).withValues(alpha: 0.05),
                ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isExchange
              ? const Color(0xFFF59E0B).withValues(alpha: 0.3)
              : const Color(0xFFEF4444).withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isExchange
                  ? const Color(0xFFF59E0B).withValues(alpha: 0.1)
                  : const Color(0xFFEF4444).withValues(alpha: 0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isExchange
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.2)
                        : const Color(0xFFEF4444).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isExchange ? Icons.swap_horiz_rounded : Icons.replay_rounded,
                    color: isExchange
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFFEF4444),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isExchange ? 'Exchange Request' : 'Return Request',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _getStatusLabel(returnStatus ?? 'requested'),
                        style: TextStyle(
                          fontSize: 13,
                          color: _getStatusColor(returnStatus ?? 'requested'),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (returnRequestId != null)
                  IconButton(
                    icon: Icon(
                      Icons.open_in_new_rounded,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                    onPressed: () {
                      // Navigate to return details
                      _navigateToReturnDetails(context, returnRequestId!);
                    },
                    tooltip: 'View Details',
                  ),
              ],
            ),
          ),
          
          // Status Timeline
          if (returnRequestId != null)
            _buildReturnContent(context, isDark, isExchange),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildReturnContent(BuildContext context, bool isDark, bool isExchange) {
    return StreamBuilder<ReturnRequestModel?>(
      stream: ReturnService().streamReturnRequest(returnRequestId!),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        
        final request = snapshot.data;
        if (request == null) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Return request not found',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
          );
        }
        
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Info
              Row(
                children: [
                  if (request.productImage != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        request.productImage!,
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 50,
                          height: 50,
                          color: isDark ? Colors.white10 : Colors.grey[200],
                          child: const Icon(Icons.image_not_supported, size: 20),
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
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (request.variantInfo != null)
                          Text(
                            request.variantInfo!,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.white54 : Colors.black45,
                            ),
                          ),
                        Text(
                          'Qty: ${request.quantity} · ₹${request.itemPrice.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.white70 : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Reason
              _buildInfoRow(
                isDark,
                'Reason',
                request.reasonTitle,
                Icons.help_outline_rounded,
              ),
              
              if (request.customerNotes != null && request.customerNotes!.isNotEmpty)
                _buildInfoRow(
                  isDark,
                  'Notes',
                  request.customerNotes!,
                  Icons.notes_rounded,
                ),
              
              // Pickup Info (if scheduled)
              if (request.pickupScheduledAt != null)
                _buildInfoRow(
                  isDark,
                  'Pickup',
                  '${DateFormat.MMMd().format(request.pickupScheduledAt!)} ${request.pickupSlot ?? ''}',
                  Icons.local_shipping_outlined,
                ),
              
              // Refund Amount (for returns)
              if (!isExchange && request.refundAmount > 0)
                _buildInfoRow(
                  isDark,
                  'Refund',
                  '₹${request.refundAmount.toStringAsFixed(0)}',
                  Icons.currency_rupee_rounded,
                ),
              
              const SizedBox(height: 12),
              
              // Action Buttons
              if (request.status == ReturnStatus.requested)
                _buildActionButtons(context, isDark, request),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(bool isDark, String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 16,
            color: isDark ? Colors.white54 : Colors.black45,
          ),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, bool isDark, ReturnRequestModel request) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _rejectReturn(context, request),
            icon: const Icon(Icons.close_rounded, size: 18),
            label: const Text('Reject'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFEF4444),
              side: const BorderSide(color: Color(0xFFEF4444)),
              padding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () => _approveReturn(context, request),
            icon: const Icon(Icons.check_rounded, size: 18),
            label: const Text('Approve'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ],
    );
  }

  String _getStatusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'requested': return '⏳ Pending Approval';
      case 'approved': return '✅ Approved';
      case 'rejected': return '❌ Rejected';
      case 'pickupscheduled': return '📅 Pickup Scheduled';
      case 'pickupcompleted': return '📦 Picked Up';
      case 'refundinitiated': return '💰 Refund Processing';
      case 'refundcompleted': return '✅ Refunded';
      case 'exchangeshipped': return '🚚 Exchange Shipped';
      case 'exchangedelivered': return '✅ Exchange Complete';
      case 'cancelled': return '🚫 Cancelled';
      default: return status.toUpperCase();
    }
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'requested': return const Color(0xFFF59E0B);
      case 'approved':
      case 'refundcompleted':
      case 'exchangedelivered': return const Color(0xFF10B981);
      case 'rejected':
      case 'cancelled': return const Color(0xFFEF4444);
      default: return const Color(0xFF6B7280);
    }
  }

  void _navigateToReturnDetails(BuildContext context, String returnId) {
    // Navigate to seller return details screen
    Navigator.pushNamed(context, '/seller/returns/detail', arguments: returnId);
  }

  Future<void> _approveReturn(BuildContext context, ReturnRequestModel request) async {
    try {
      await ReturnService().approveReturn(returnId: request.id);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Return approved successfully'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _rejectReturn(BuildContext context, ReturnRequestModel request) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Return'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Enter rejection reason...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (reason != null && reason.isNotEmpty) {
      try {
        await ReturnService().rejectReturn(
          returnId: request.id,
          rejectionReason: reason,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Return rejected'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
