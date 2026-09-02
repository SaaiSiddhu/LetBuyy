// apps/marketplace/lib/screens/returns/return_tracking_screen.dart
// 📦 RETURN TRACKING SCREEN
// Customer tracks return status and timeline

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import '../../widgets/premium_scaffold.dart';

class ReturnTrackingScreen extends StatefulWidget {
  final String returnId;

  const ReturnTrackingScreen({
    super.key,
    required this.returnId,
  });

  @override
  State<ReturnTrackingScreen> createState() => _ReturnTrackingScreenState();
}

class _ReturnTrackingScreenState extends State<ReturnTrackingScreen> {
  final ReturnService _returnService = ReturnService();
  final _currencyFormat = NumberFormat('#,##,###', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Return Status',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
      ),
      body: StreamBuilder<ReturnRequestModel?>(
        stream: _returnService.streamReturnRequest(widget.returnId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError || !snapshot.hasData) {
            return _buildErrorState(isDark);
          }

          final request = snapshot.data!;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status Header
                _buildStatusHeader(request, isDark),
                const SizedBox(height: 24),

                // Timeline
                _buildTimeline(request, isDark),
                const SizedBox(height: 24),

                // Product Info
                _buildProductCard(request, isDark),
                const SizedBox(height: 16),

                // Request Details
                _buildDetailsCard(request, isDark),
                const SizedBox(height: 16),

                // Pickup Info
                if (request.status.isAwaitingPickup ||
                    request.pickupScheduledAt != null)
                  _buildPickupCard(request, isDark),
                const SizedBox(height: 16),

                // Refund Info
                if (request.type == ReturnType.refund)
                  _buildRefundCard(request, isDark),

                // Actions
                if (request.canCancel) ...[
                  const SizedBox(height: 24),
                  _buildCancelButton(request, isDark),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusHeader(ReturnRequestModel request, bool isDark) {
    final statusConfig = _getStatusConfig(request.status);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            statusConfig['color'].withValues(alpha: 0.2),
            statusConfig['color'].withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: statusConfig['color'].withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: statusConfig['color'].withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              statusConfig['icon'],
              color: statusConfig['color'],
              size: 32,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            request.status.displayName,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            request.status.description,
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.grey[600],
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
          if (request.pickupScheduledAt != null &&
              request.status == ReturnStatus.pickupScheduled) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? Colors.white10 : Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.calendar_today,
                      size: 16, color: statusConfig['color']),
                  const SizedBox(width: 8),
                  Text(
                    DateFormat('EEE, dd MMM yyyy')
                        .format(request.pickupScheduledAt!),
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (request.pickupSlot != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      request.pickupSlot!,
                      style: TextStyle(
                        color: isDark ? Colors.white60 : Colors.grey[600],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95));
  }

  Widget _buildTimeline(ReturnRequestModel request, bool isDark) {
    final steps = _getTimelineSteps(request);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Timeline',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          ...steps.asMap().entries.map((entry) {
            final index = entry.key;
            final step = entry.value;
            final isLast = index == steps.length - 1;

            return _buildTimelineStep(
              isDark: isDark,
              title: step['title'],
              subtitle: step['subtitle'],
              time: step['time'],
              isCompleted: step['completed'],
              isCurrent: step['current'],
              isLast: isLast,
            );
          }),
        ],
      ),
    );
  }

  Widget _buildTimelineStep({
    required bool isDark,
    required String title,
    String? subtitle,
    String? time,
    required bool isCompleted,
    required bool isCurrent,
    required bool isLast,
  }) {
    final color = isCompleted
        ? AppColors.primary
        : (isCurrent ? AppColors.warning : Colors.grey);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isCompleted ? color : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: 2),
                ),
                child: isCompleted
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: isCompleted ? AppColors.primary : Colors.grey[300],
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black,
                          fontWeight: isCurrent || isCompleted
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      if (time != null)
                        Text(
                          time,
                          style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.grey,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: isDark ? Colors.white54 : Colors.grey[600],
                        fontSize: 12,
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

  Widget _buildProductCard(ReturnRequestModel request, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              request.productImage ?? '',
              width: 70,
              height: 70,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 70,
                height: 70,
                color: Colors.grey[300],
                child: const Icon(Icons.image),
              ),
            ),
          ),
          const SizedBox(width: 16),
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
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (request.variantInfo != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    request.variantInfo!,
                    style: TextStyle(
                      color: isDark ? Colors.white54 : Colors.grey[600],
                      fontSize: 12,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  'Qty: ${request.quantity}',
                  style: TextStyle(
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsCard(ReturnRequestModel request, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Request Details',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          _buildDetailRow('Type', request.type.displayName, isDark),
          _buildDetailRow('Reason', request.reasonTitle, isDark),
          _buildDetailRow('Order ID', '#${request.orderNumber}', isDark),
          _buildDetailRow(
            'Requested On',
            DateFormat('dd MMM yyyy, hh:mm a').format(request.createdAt),
            isDark,
          ),
          if (request.customerNotes != null)
            _buildDetailRow('Your Notes', request.customerNotes!, isDark),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey[600],
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickupCard(ReturnRequestModel request, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.info.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_shipping, color: AppColors.infoDark),
              const SizedBox(width: 8),
              Text(
                'Pickup Information',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            request.pickupAddress ?? 'Pickup address not set',
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          if (request.pickupAgentName != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.person, size: 16, color: AppColors.infoDark),
                const SizedBox(width: 8),
                Text(
                  '${request.pickupAgentName}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
                if (request.pickupAgentPhone != null) ...[
                  const Text(' • '),
                  Text(
                    request.pickupAgentPhone!,
                    style: TextStyle(
                      color: AppColors.infoDark,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRefundCard(ReturnRequestModel request, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.currency_rupee, color: AppColors.success),
              const SizedBox(width: 8),
              Text(
                'Refund Details',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Amount'),
              Text(
                '₹${_currencyFormat.format(request.refundAmount)}',
                style: TextStyle(
                  color: AppColors.success,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (request.refundMethod != null) ...[
            const SizedBox(height: 8),
            Text(
              'Refund to: ${request.refundMethod == 'original_source' ? 'Original payment method' : request.refundMethod!.toUpperCase()}',
              style: TextStyle(
                color: isDark ? Colors.white70 : Colors.black87,
                fontSize: 13,
              ),
            ),
          ],
          if (request.refundCompletedAt != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.check_circle, size: 16, color: AppColors.success),
                const SizedBox(width: 4),
                Text(
                  'Refunded on ${DateFormat('dd MMM yyyy').format(request.refundCompletedAt!)}',
                  style: const TextStyle(
                    color: AppColors.success,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCancelButton(ReturnRequestModel request, bool isDark) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: () => _showCancelDialog(request),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.error,
          side: const BorderSide(color: AppColors.error),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: const Text('Cancel Return Request'),
      ),
    );
  }

  void _showCancelDialog(ReturnRequestModel request) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Return?'),
        content: const Text(
          'Are you sure you want to cancel this return request? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No, Keep It'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await _returnService.cancelReturn(request.id);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Return request cancelled'),
                      backgroundColor: AppColors.warning,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Failed to cancel: $e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.errorLight),
          const SizedBox(height: 16),
          const Text('Return request not found'),
        ],
      ),
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

  List<Map<String, dynamic>> _getTimelineSteps(ReturnRequestModel request) {
    final dateFormat = DateFormat('dd MMM, hh:mm a');
    final steps = <Map<String, dynamic>>[];

    // Requested
    steps.add({
      'title': 'Return Requested',
      'subtitle': 'Waiting for seller approval',
      'time': dateFormat.format(request.createdAt),
      'completed': true,
      'current': request.status == ReturnStatus.requested,
    });

    // Approved/Rejected
    if (request.status == ReturnStatus.rejected) {
      steps.add({
        'title': 'Rejected',
        'subtitle': request.sellerRejectionReason ?? 'Request was rejected',
        'time': request.sellerRespondedAt != null
            ? dateFormat.format(request.sellerRespondedAt!)
            : null,
        'completed': true,
        'current': true,
      });
      return steps;
    }

    final isApproved = request.status != ReturnStatus.requested;
    steps.add({
      'title': 'Approved',
      'subtitle': 'Seller approved your request',
      'time': request.sellerRespondedAt != null
          ? dateFormat.format(request.sellerRespondedAt!)
          : null,
      'completed': isApproved,
      'current': request.status == ReturnStatus.approved,
    });

    // Pickup Scheduled
    final isPickupScheduled = [
      ReturnStatus.pickupScheduled,
      ReturnStatus.pickupInProgress,
      ReturnStatus.pickupCompleted,
      ReturnStatus.refundInitiated,
      ReturnStatus.refundCompleted,
      ReturnStatus.exchangeShipped,
      ReturnStatus.exchangeDelivered,
    ].contains(request.status);
    
    steps.add({
      'title': 'Pickup Scheduled',
      'subtitle': request.pickupScheduledAt != null
          ? DateFormat('dd MMM yyyy').format(request.pickupScheduledAt!)
          : 'Awaiting pickup schedule',
      'time': null,
      'completed': isPickupScheduled,
      'current': request.status == ReturnStatus.pickupScheduled,
    });

    // Pickup Completed
    final isPickupDone = [
      ReturnStatus.pickupCompleted,
      ReturnStatus.refundInitiated,
      ReturnStatus.refundCompleted,
      ReturnStatus.exchangeShipped,
      ReturnStatus.exchangeDelivered,
    ].contains(request.status);

    steps.add({
      'title': 'Pickup Completed',
      'subtitle': 'Item picked up successfully',
      'time': request.pickupCompletedAt != null
          ? dateFormat.format(request.pickupCompletedAt!)
          : null,
      'completed': isPickupDone,
      'current': request.status == ReturnStatus.pickupCompleted,
    });

    // Refund or Exchange
    if (request.type == ReturnType.refund) {
      steps.add({
        'title': 'Refund Processed',
        'subtitle': '₹${_currencyFormat.format(request.refundAmount)} credited',
        'time': request.refundCompletedAt != null
            ? dateFormat.format(request.refundCompletedAt!)
            : null,
        'completed': request.status == ReturnStatus.refundCompleted,
        'current': request.status == ReturnStatus.refundInitiated ||
            request.status == ReturnStatus.refundCompleted,
      });
    } else {
      steps.add({
        'title': 'Exchange Shipped',
        'subtitle': 'New item on the way',
        'time': null,
        'completed': request.status == ReturnStatus.exchangeShipped ||
            request.status == ReturnStatus.exchangeDelivered,
        'current': request.status == ReturnStatus.exchangeShipped,
      });
      steps.add({
        'title': 'Exchange Delivered',
        'subtitle': 'Exchange completed',
        'time': null,
        'completed': request.status == ReturnStatus.exchangeDelivered,
        'current': request.status == ReturnStatus.exchangeDelivered,
      });
    }

    return steps;
  }
}
